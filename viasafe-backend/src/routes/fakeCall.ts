import express from "express";
import multer from "multer";
import type { Config } from "../lib/config.js";
import { newId, Store } from "../store.js";
import { getStorageProvider } from "../services/storage.js";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export function fakeCallRouter({ config, store }: { config: Config; store: Store }) {
  const router = express.Router();

  router.post("/fake", (req, res) => {
    const userId = req.userId!;
    const callId = newId("call");
    store.fakeCallsById.set(callId, { callId, userId, createdAt: new Date().toISOString() });
    (store as any).markDirty?.();

    res.status(201).json({
      callId,
      uploadUrl: `${config.publicBaseUrl}/call/fake/${callId}/upload`
    });
  });

  router.post("/fake/:callId/upload", upload.single("audio"), async (req, res, next) => {
    try {
      const userId = req.userId!;
      const callId = String(req.params.callId);

      const call = store.fakeCallsById.get(callId);
      if (!call || call.userId !== userId) return res.status(404).json({ error: "Call not found" });

      if (!req.file) return res.status(400).json({ error: "Missing audio file field 'audio'" });

      const storage = getStorageProvider(config);
      const ext = contentTypeToExt(req.file.mimetype);
      const objectKey = `fake-calls/${userId}/${callId}${ext}`;

      await storage.putObject({
        objectKey,
        contentType: req.file.mimetype || "application/octet-stream",
        bytes: req.file.buffer
      });

      store.fakeCallsById.set(callId, { ...call, objectKey });
      (store as any).markDirty?.();

      res.json({ ok: true, callId, objectKey });
    } catch (e) {
      next(e);
    }
  });

  return router;
}

function contentTypeToExt(contentType: string | undefined) {
  if (!contentType) return "";
  if (contentType.includes("webm")) return ".webm";
  if (contentType.includes("mpeg")) return ".mp3";
  if (contentType.includes("mp4")) return ".m4a";
  if (contentType.includes("wav")) return ".wav";
  if (contentType.includes("ogg")) return ".ogg";
  return "";
}