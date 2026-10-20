import type http from "node:http";
import type { RawData, WebSocketServer, WebSocket } from "ws";
import { URL } from "node:url";
import type { Config } from "../lib/config.js";
import type { Store } from "../store.js";
import type { SosBroker, SosEvent, SosLocation } from "../services/sosBroker.js";

type LocationMsg = SosLocation;

export function attachSosWebSocket({
  server,
  wss,
  config: _config,
  store,
  sosBroker
}: {
  server: http.Server;
  wss: WebSocketServer;
  config: Config;
  store: Store;
  sosBroker: SosBroker;
}) {
  const watchersByToken = new Map<string, Set<WebSocket>>();
  const publisherBySessionId = new Map<string, WebSocket>();
  const unsubscribeByUserId = new Map<string, { count: number; unsubscribe: () => Promise<void> }>();

  async function ensureUserSubscribed(userId: string) {
    const existing = unsubscribeByUserId.get(userId);
    if (existing) {
      unsubscribeByUserId.set(userId, { ...existing, count: existing.count + 1 });
      return;
    }
    const unsubscribe = await sosBroker.subscribeUser(userId, (event) => {
      if (event.type !== "location") return;
      broadcastToUserContacts(event.userId, event.location);
    });
    unsubscribeByUserId.set(userId, { count: 1, unsubscribe });
  }

  async function releaseUserSubscribed(userId: string) {
    const existing = unsubscribeByUserId.get(userId);
    if (!existing) return;
    if (existing.count > 1) {
      unsubscribeByUserId.set(userId, { ...existing, count: existing.count - 1 });
      return;
    }
    unsubscribeByUserId.delete(userId);
    await existing.unsubscribe();
  }

  function broadcastToUserContacts(userId: string, loc: SosLocation) {
    const contacts = store.contactsByUserId.get(userId);
    if (!contacts) return;
    const msg = JSON.stringify({ type: "location", ...loc });
    for (const c of contacts.values()) {
      const watchers = watchersByToken.get(c.shareToken);
      if (!watchers) continue;
      for (const w of watchers) {
        if (w.readyState === w.OPEN) w.send(msg);
      }
    }
  }

  server.on("upgrade", (req, socket, head) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== "/sos/stream") return;

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } catch {
      socket.destroy();
    }
  });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const role = url.searchParams.get("role");
    if (role !== "publisher" && role !== "watcher") {
      ws.close(1008, "Missing/invalid role");
      return;
    }

    if (role === "watcher") {
      const token = url.searchParams.get("token");
      if (!token || !store.shareTokenToContact.has(token)) {
        ws.close(1008, "Invalid token");
        return;
      }
      let set = watchersByToken.get(token);
      if (!set) {
        set = new Set();
        watchersByToken.set(token, set);
      }
      set.add(ws);

      const { userId } = store.shareTokenToContact.get(token)!;
      ensureUserSubscribed(userId).catch(() => {});

      ws.on("close", () => {
        set?.delete(ws);
        if (set && set.size === 0) watchersByToken.delete(token);
        releaseUserSubscribed(userId).catch(() => {});
      });

      const session = store.sosByUserId.get(userId);
      if (session?.active && session.lastLocation) {
        ws.send(JSON.stringify({ type: "location", ...session.lastLocation }));
      } else {
        sosBroker
          .getLastLocation(userId)
          .then((last) => {
            if (last) ws.send(JSON.stringify({ type: "location", ...last.location }));
            else ws.send(JSON.stringify({ type: "status", active: Boolean(session?.active) }));
          })
          .catch(() => ws.send(JSON.stringify({ type: "status", active: Boolean(session?.active) })));
      }

      return;
    }

    const sessionId = url.searchParams.get("sessionId");
    if (!sessionId) {
      ws.close(1008, "Missing sessionId");
      return;
    }

    const userId = req.headers["x-user-id"];
    if (typeof userId !== "string" || !userId) {
      ws.close(1008, "Missing X-User-Id");
      return;
    }

    const session = store.sosByUserId.get(userId);
    if (!session || !session.active || session.sessionId !== sessionId) {
      ws.close(1008, "SOS not active");
      return;
    }

    const existingPublisher = publisherBySessionId.get(sessionId);
    if (existingPublisher && existingPublisher !== ws) {
      existingPublisher.close(1012, "Replaced by new publisher");
    }
    publisherBySessionId.set(sessionId, ws);
    ensureUserSubscribed(userId).catch(() => {});

    ws.on("message", (data: RawData) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(data.toString("utf8"));
      } catch {
        ws.send(JSON.stringify({ type: "error", error: "Invalid JSON" }));
        return;
      }

      const loc = parseLocation(parsed);
      if (!loc) {
        ws.send(JSON.stringify({ type: "error", error: "Invalid location payload" }));
        return;
      }

      const active = store.sosByUserId.get(userId);
      if (!active?.active) {
        ws.send(JSON.stringify({ type: "error", error: "SOS stopped" }));
        return;
      }

      store.sosByUserId.set(userId, { ...active, lastLocation: loc });
      (store as any).markDirty?.();
      const event: SosEvent = { type: "location", userId, sessionId, location: loc };
      sosBroker.publish(event).catch(() => {});
    });

    ws.on("close", () => {
      const cur = publisherBySessionId.get(sessionId);
      if (cur === ws) publisherBySessionId.delete(sessionId);
      releaseUserSubscribed(userId).catch(() => {});
    });

    ws.send(JSON.stringify({ type: "status", role: "publisher", sessionId }));
  });
}

function parseLocation(v: unknown): LocationMsg | null {
  if (typeof v !== "object" || v === null) return null;
  const o = v as Record<string, unknown>;
  if (typeof o.lat !== "number" || typeof o.lng !== "number" || typeof o.ts !== "number") return null;
  const accuracy = typeof o.accuracy === "number" ? o.accuracy : undefined;
  return { lat: o.lat, lng: o.lng, ts: o.ts, accuracy };
}