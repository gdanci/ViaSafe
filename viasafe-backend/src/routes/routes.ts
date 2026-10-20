import express from "express";
import type { Config } from "../lib/config.js";
import { GoogleAuth } from "google-auth-library";
import { getFirestore } from "../lib/firebase.js";
import { inCluj } from "../lib/cluj.js";
import { rateLimit } from "../middleware/rateLimit.js";

const routeLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 40, name: "route" });
const googleAuth = new GoogleAuth();

export function routesRouter({ config }: { config: Config }) {
  const router = express.Router();
  const db = getFirestore(config);
  const pinTtlMs = 2 * 60 * 60 * 1000; // 2 hours

  router.post("/safe", routeLimit, async (req, res, next) => {
    try {
      const { startLat, startLng, endLat, endLng } = req.body || {};
      if (startLat == null || startLng == null || endLat == null || endLng == null) {
        return res.status(400).json({ error: "Missing start/end coordinates" });
      }

      const coords = [startLat, startLng, endLat, endLng].map(Number);
      if (!coords.every(Number.isFinite)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }
      if (config.clujOnly && (!inCluj(startLat, startLng) || !inCluj(endLat, endLng))) {
        return res.status(400).json({ error: "ViaSafe only covers Cluj-Napoca" });
      }

      if (!config.valhallaUrl) {
        return res.json({
          warning: "VALHALLA_URL not configured",
          message: "Set VALHALLA_URL in .env to enable safe routing.",
          locations: [
            { lat: startLat, lon: startLng },
            { lat: endLat, lon: endLng }
          ]
        });
      }

      const avoidLocations = await getActivePinpoints(db, pinTtlMs);

      const payload: any = {
        locations: [
          { lat: startLat, lon: startLng },
          { lat: endLat, lon: endLng }
        ],
        costing: "pedestrian",
        directions_options: { units: "kilometers" },
        shape_format: "polyline6"
      };

      if (avoidLocations.length > 0) {
        payload.avoid_locations = avoidLocations;
      }

      const url = config.valhallaUrl.replace(/\/$/, "") + "/route";
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (config.valhallaAudience) {
        // Valhalla runs as a private Cloud Run service: prove who we are with an ID token.
        const client = await googleAuth.getIdTokenClient(config.valhallaAudience);
        Object.assign(headers, await client.getRequestHeaders());
      }
      const resp = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25_000)
      });
      const data = await resp.json();
      res.json(data);
    } catch (e) {
      next(e);
    }
  });

  return router;
}

async function getActivePinpoints(db: FirebaseFirestore.Firestore, ttlMs: number) {
  const now = Date.now();
  const snap = await db.collection("reports").get();
  const avoid: Array<{ lat: number; lon: number }> = [];

  for (const doc of snap.docs) {
    const data = doc.data() as any;
    const category = String(data?.category || "");
    if (!isPinType(category)) continue;
    const createdAt = data?.createdAt ? Date.parse(String(data.createdAt)) : NaN;
    if (!Number.isNaN(createdAt) && now - createdAt > ttlMs) continue;
    const lat = Number(data?.latitude);
    const lon = Number(data?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    avoid.push({ lat, lon });
  }

  return avoid.slice(0, 25);
}

function isPinType(category: string) {
  const c = category.toLowerCase();
  return c.includes("suspicious") || c.includes("harassment") || c.includes("danger") || c.includes("lighting") || c.includes("isolated");
}
