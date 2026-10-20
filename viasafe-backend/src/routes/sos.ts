import express from "express";
import type { Config } from "../lib/config.js";
import { ensureUserContacts, newId, Store } from "../store.js";
import { getPushProvider } from "../services/push.js";

export function sosRouter({ config, store }: { config: Config; store: Store }) {
  const router = express.Router();

  router.post("/start", async (req, res, next) => {
    try {
      const userId = req.userId!;
      const { lat, lng } = (req.body ?? {}) as { lat?: number; lng?: number };
      const existing = store.sosByUserId.get(userId);
      if (existing?.active) {
        return res.status(409).json({ error: "SOS already active", sessionId: existing.sessionId });
      }

      const sessionId = newId("sos");
      store.sosByUserId.set(userId, {
        sessionId,
        userId,
        active: true,
        startedAt: new Date().toISOString()
      });
      (store as any).markDirty?.();

      const contacts = Array.from(ensureUserContacts(store, userId).values());
      const shareLinks = contacts.map((c) => ({
        contactId: c.id,
        label: c.label,
        token: c.shareToken,
        url: `${config.publicBaseUrl}/watch/${c.shareToken}`
      }));

      const push = getPushProvider(config);
      await Promise.all(
        contacts.map(async (c) => {
          if (!c.fcmToken) return;
          await push.send(c.fcmToken, {
            title: "SOS: live location shared",
            body:
              lat != null && lng != null
                ? `Tap to view live location (${lat.toFixed(5)}, ${lng.toFixed(5)}).`
                : "Tap to view the live location stream.",
            data: {
              watchUrl: `${config.publicBaseUrl}/watch/${c.shareToken}`,
              sessionId,
              ...(lat != null && lng != null ? { lat: String(lat), lng: String(lng) } : {})
            }
          });
        })
      );

      res.json({
        sessionId,
        shareLinks,
        wsPublisherUrl: `${config.publicBaseUrl.replace(/^http/, "ws")}/sos/stream?role=publisher&sessionId=${encodeURIComponent(sessionId)}`
      });
    } catch (e) {
      next(e);
    }
  });

  router.post("/stop", (req, res) => {
    const userId = req.userId!;
    const existing = store.sosByUserId.get(userId);
    if (!existing?.active) return res.status(409).json({ error: "SOS not active" });

    store.sosByUserId.set(userId, { ...existing, active: false, stoppedAt: new Date().toISOString() });
    (store as any).markDirty?.();
    res.json({ ok: true });
  });

  return router;
}
