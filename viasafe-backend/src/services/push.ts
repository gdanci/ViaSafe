import fs from "node:fs";
import type { Config } from "../lib/config.js";
import { FirebasePushProvider, NoopPushProvider, PushProvider } from "./pushProviders.js";

let cached: PushProvider | null = null;

export function getPushProvider(config: Config): PushProvider {
  if (cached) return cached;
  let json = config.firebaseServiceAccountJson || null;
  if (!json && config.firebaseServiceAccountPath && fs.existsSync(config.firebaseServiceAccountPath)) {
    json = fs.readFileSync(config.firebaseServiceAccountPath, "utf8");
  }
  cached = json ? new FirebasePushProvider(json) : new NoopPushProvider();
  return cached;
}