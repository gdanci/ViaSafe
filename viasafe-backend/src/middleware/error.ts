import type { Request, Response, NextFunction } from "express";

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  // Errors from body-parser (too large, bad JSON) carry their own 4xx status.
  const status = Number((err as { status?: number } | null)?.status);
  if (status >= 400 && status < 500) {
    res.status(status).json({ error: status === 413 ? "Request too large" : "Bad request" });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
