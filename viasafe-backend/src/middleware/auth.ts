import type { Request, Response, NextFunction } from "express";

export function authMiddleware(req: Request, _res: Response, next: NextFunction) {
  const userId = req.header("x-user-id") || "demo-user";
  req.userId = userId;
  next();
}