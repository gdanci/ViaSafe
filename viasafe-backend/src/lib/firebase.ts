import fs from "node:fs";
import admin from "firebase-admin";
import type { Config } from "./config.js";

let initialized = false;

function resolveServiceAccountJson(config: Config): string | null {
  if (config.firebaseServiceAccountJson) return config.firebaseServiceAccountJson;
  if (config.firebaseServiceAccountPath && fs.existsSync(config.firebaseServiceAccountPath)) {
    return fs.readFileSync(config.firebaseServiceAccountPath, "utf8");
  }
  return null;
}

export function initFirebase(config: Config) {
  if (initialized) return;
  const json = resolveServiceAccountJson(config);
  if (json) {
    const creds = JSON.parse(json) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(creds) });
  } else {
    // On Cloud Run, prefer ADC from the attached service account.
    admin.initializeApp({ credential: admin.credential.applicationDefault() });
  }
  initialized = true;
}

export function getFirestore(config: Config) {
  initFirebase(config);
  return admin.firestore();
}
