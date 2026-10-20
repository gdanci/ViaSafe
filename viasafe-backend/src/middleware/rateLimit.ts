import type { Request, Response, NextFunction } from "express";

// Small in-memory limiter: at most `max` requests per `windowMs` per client IP.
// (Each Cloud Run instance counts on its own, which is enough to stop casual spam.)
export function rateLimit({ windowMs, max, name }: { windowMs: number; max: number; name: string }) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) if (v.resetAt <= now) hits.delete(key);
  }, windowMs).unref();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || "unknown";
    const cur = hits.get(key);
    if (!cur || cur.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    cur.count += 1;
    if (cur.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((cur.resetAt - now) / 1000)));
      return res.status(429).json({ error: `Too many ${name} requests. Please wait a bit and try again.` });
    }
    next();
  };
}
