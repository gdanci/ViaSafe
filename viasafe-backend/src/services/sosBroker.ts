import type { Config } from "../lib/config.js";
import { createClient, type RedisClientType } from "redis";

export type SosLocation = { lat: number; lng: number; ts: number; accuracy?: number };
export type SosEvent = { type: "location"; userId: string; sessionId: string; location: SosLocation };

export interface SosBroker {
  publish(event: SosEvent): Promise<void>;
  getLastLocation(userId: string): Promise<{ sessionId: string; location: SosLocation } | null>;
  subscribeUser(userId: string, onEvent: (event: SosEvent) => void): Promise<() => Promise<void>>;
}

export function createSosBroker(config: Config): SosBroker {
  if (config.sosBroker === "redis") {
    if (!config.redisUrl) throw new Error("Missing REDIS_URL for SOS_BROKER=redis");
    return new RedisSosBroker(config.redisUrl);
  }
  return new MemorySosBroker();
}

class MemorySosBroker implements SosBroker {
  private lastByUserId = new Map<string, { sessionId: string; location: SosLocation }>();
  private handlersByUserId = new Map<string, Set<(event: SosEvent) => void>>();

  async publish(event: SosEvent): Promise<void> {
    if (event.type === "location") {
      this.lastByUserId.set(event.userId, { sessionId: event.sessionId, location: event.location });
    }
    const handlers = this.handlersByUserId.get(event.userId);
    if (!handlers) return;
    for (const h of handlers) h(event);
  }

  async getLastLocation(userId: string) {
    return this.lastByUserId.get(userId) ?? null;
  }

  async subscribeUser(userId: string, onEvent: (event: SosEvent) => void) {
    let set = this.handlersByUserId.get(userId);
    if (!set) {
      set = new Set();
      this.handlersByUserId.set(userId, set);
    }
    set.add(onEvent);
    return async () => {
      set?.delete(onEvent);
      if (set && set.size === 0) this.handlersByUserId.delete(userId);
    };
  }
}

class RedisSosBroker implements SosBroker {
  private pub: RedisClientType;
  private sub: RedisClientType;
  private handlersByUserId = new Map<string, Set<(event: SosEvent) => void>>();
  private subscribedUsers = new Set<string>();

  constructor(redisUrl: string) {
    this.pub = createClient({ url: redisUrl });
    this.sub = createClient({ url: redisUrl });
    this.pub.on("error", () => {});
    this.sub.on("error", () => {});
  }

  private async ensureConnected() {
    if (!this.pub.isOpen) await this.pub.connect();
    if (!this.sub.isOpen) await this.sub.connect();
  }

  async publish(event: SosEvent): Promise<void> {
    await this.ensureConnected();
    if (event.type === "location") {
      await this.pub.set(this.lastKey(event.userId), JSON.stringify({ sessionId: event.sessionId, location: event.location }), {
        EX: 60 * 60 * 24
      });
    }
    await this.pub.publish(this.channel(event.userId), JSON.stringify(event));
  }

  async getLastLocation(userId: string) {
    await this.ensureConnected();
    const v = await this.pub.get(this.lastKey(userId));
    if (!v) return null;
    try {
      const parsed = JSON.parse(v) as { sessionId: string; location: SosLocation };
      if (parsed && typeof parsed.sessionId === "string" && parsed.location && typeof parsed.location.lat === "number") return parsed;
    } catch {}
    return null;
  }

  async subscribeUser(userId: string, onEvent: (event: SosEvent) => void) {
    await this.ensureConnected();

    let set = this.handlersByUserId.get(userId);
    if (!set) {
      set = new Set();
      this.handlersByUserId.set(userId, set);
    }
    set.add(onEvent);

    if (!this.subscribedUsers.has(userId)) {
      this.subscribedUsers.add(userId);
      await this.sub.subscribe(this.channel(userId), (msg: string) => {
        let event: SosEvent | null = null;
        try {
          event = JSON.parse(msg) as SosEvent;
        } catch {}
        if (!event || event.userId !== userId) return;
        const handlers = this.handlersByUserId.get(userId);
        if (!handlers) return;
        for (const h of handlers) h(event);
      });
    }

    return async () => {
      const handlers = this.handlersByUserId.get(userId);
      handlers?.delete(onEvent);
      if (!handlers || handlers.size > 0) return;

      this.handlersByUserId.delete(userId);
      if (this.subscribedUsers.has(userId)) {
        this.subscribedUsers.delete(userId);
        await this.sub.unsubscribe(this.channel(userId));
      }
    };
  }

  private channel(userId: string) {
    return `sos:user:${userId}`;
  }

  private lastKey(userId: string) {
    return `sos:last:${userId}`;
  }
}