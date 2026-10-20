import express from "express";
import type { Config } from "../lib/config.js";
import { getFirestore } from "../lib/firebase.js";
import { newId } from "../store.js";
import { getClujSeedReports } from "../lib/clujSeed.js";
import { inCluj } from "../lib/cluj.js";
import { rateLimit } from "../middleware/rateLimit.js";

const postLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 10, name: "report" });
const upvoteLimit = rateLimit({ windowMs: 10 * 60 * 1000, max: 60, name: "upvote" });

const MIN_SEED_COUNT = 10;

export function reportsRouter({ config: _config }: { config: Config }) {
  const router = express.Router();
  const db = getFirestore(_config);
  const pinTtlMs = 2 * 60 * 60 * 1000; // 2 hours

  router.get("/", async (req, res, next) => {
    try {
      const snap = await db.collection("reports").get();
      const wantsReset = _config.allowReset && req.query.reset === "1";
      const shouldReseed = wantsReset || (_config.seedDemoData && (snap.empty || snap.size < MIN_SEED_COUNT));

      if (shouldReseed) {
        if (!snap.empty) {
          const clearBatch = db.batch();
          snap.docs.forEach((doc) => clearBatch.delete(doc.ref));
          await clearBatch.commit();
        }

        const seedReports = getClujSeedReports();
        const batch = db.batch();
        seedReports.forEach((report, idx) => {
          batch.set(db.collection("reports").doc(`seed-${idx}`), report);
        });
        await batch.commit();

        return res.json(
          seedReports.map((report, idx) => ({
            id: `seed-${idx}`,
            ...report
          }))
        );
      }
      const now = Date.now();
      const deletes = db.batch();
      const reports = [];

      for (const doc of snap.docs) {
        const data = doc.data() as any;
        const category = String(data?.category || "");
        const createdAt = data?.createdAt ? Date.parse(String(data.createdAt)) : NaN;
        const isPin = isPinType(category);
        const isExpired = isPin && !Number.isNaN(createdAt) && now - createdAt > pinTtlMs;

        if (isExpired) {
          deletes.delete(doc.ref);
          continue;
        }

        reports.push({ id: doc.id, ...data });
      }

      if (!snap.empty) {
        await deletes.commit();
      }

      res.json(reports);
    } catch (e) {
      next(e);
    }
  });

  router.post("/", postLimit, async (req, res, next) => {
    try {
      const body = req.body || {};
      const {
        title,
        description,
        category,
        timeLabel,
        locationLabel,
        latitude,
        longitude,
        anonymous
      } = body;

      if (!title || latitude == null || longitude == null) {
        return res.status(400).json({ error: "Missing required fields" });
      }
      const text = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);
      if (typeof title !== "string" || !title.trim()) return res.status(400).json({ error: "Title is required" });
      if (!Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude))) {
        return res.status(400).json({ error: "Invalid location" });
      }
      if (_config.clujOnly && !inCluj(latitude, longitude)) {
        return res.status(400).json({ error: "ViaSafe only covers Cluj-Napoca" });
      }

      const locKey = `${text(category || "general", 60).toLowerCase()}-${Math.round(Number(latitude) * 1000)}-${Math.round(
        Number(longitude) * 1000
      )}`;
      const existing = await db.collection("reports").where("locationKey", "==", locKey).limit(1).get();
      const verificationStatus = existing.empty ? "SINGLE_REPORT" : "VERIFIED";

      const report = {
        title: text(title, 80),
        description: text(description, 400),
        category: text(category || "general", 60),
        timeLabel: text(timeLabel || "just now", 30),
        locationLabel: text(locationLabel || "unknown", 100),
        latitude: Number(latitude),
        longitude: Number(longitude),
        anonymous: Boolean(anonymous),
        upvotes: 0,
        verificationStatus,
        locationKey: locKey,
        createdAt: new Date().toISOString()
      };

      const id = newId("report");
      await db.collection("reports").doc(id).set(report);

      res.status(201).json({ id, ...report });
    } catch (e) {
      next(e);
    }
  });

  router.post("/:id/upvote", upvoteLimit, async (req, res, next) => {
    try {
      const id = String(req.params.id);
      const ref = db.collection("reports").doc(id);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists) throw new Error("Report not found");
        const cur = (snap.data()?.upvotes as number | undefined) || 0;
        tx.set(ref, { upvotes: cur + 1 }, { merge: true });
      });
      res.json({ ok: true });
    } catch (e) {
      res.status(404).json({ error: "Report not found" });
    }
  });

  return router;
}

function isPinType(category: string) {
  const c = category.toLowerCase();
  return c.includes("suspicious") || c.includes("harassment") || c.includes("danger") || c.includes("lighting") || c.includes("isolated");
}
