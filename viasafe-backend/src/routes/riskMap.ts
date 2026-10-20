import express from "express";
import type { Config } from "../lib/config.js";
import { getFirestore } from "../lib/firebase.js";
import { getClujRiskAreas } from "../lib/clujSeed.js";

const MIN_SEED_COUNT = 20;

export function riskMapRouter({ config }: { config: Config }) {
  const router = express.Router();
  const db = getFirestore(config);

  router.get("/", async (req, res, next) => {
    try {
      const snap = await db.collection("riskAreas").get();
      const wantsReset = config.allowReset && req.query.reset === "1";
      const shouldReseed = wantsReset || (config.seedDemoData && (snap.empty || snap.size < MIN_SEED_COUNT));

      if (shouldReseed) {
        if (!snap.empty) {
          const clearBatch = db.batch();
          snap.docs.forEach((doc) => clearBatch.delete(doc.ref));
          await clearBatch.commit();
        }

        const areas = getClujRiskAreas();
        const batch = db.batch();
        areas.forEach((area, idx) => {
          batch.set(db.collection("riskAreas").doc(`seed-${idx}`), area);
        });
        await batch.commit();
        return res.json(areas);
      }

      const areas = snap.docs.map((d) => d.data());
      res.json(areas);
    } catch (e) {
      next(e);
    }
  });

  return router;
}
