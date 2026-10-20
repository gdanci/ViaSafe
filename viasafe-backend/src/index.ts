import "dotenv/config";
import express from "express";
import http from "node:http";
import path from "node:path";
import cors from "cors";
import morgan from "morgan";
import { WebSocketServer } from "ws";
import { loadConfig } from "./lib/config.js";
import { createStore } from "./store.js";
import { contactsRouter } from "./routes/contacts.js";
import { fakeCallRouter } from "./routes/fakeCall.js";
import { sosRouter } from "./routes/sos.js";
import { attachSosWebSocket } from "./routes/sosStream.js";
import { reportsRouter } from "./routes/reports.js";
import { riskMapRouter } from "./routes/riskMap.js";
import { routesRouter } from "./routes/routes.js";
import { createSosBroker } from "./services/sosBroker.js";
import { authMiddleware } from "./middleware/auth.js";
import { errorHandler } from "./middleware/error.js";

const config = loadConfig();
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });

const store = await createStore(config);
const sosBroker = createSosBroker(config);

// Behind Cloud Run's proxy: use the real client IP (for rate limiting).
app.set("trust proxy", 1);
app.disable("x-powered-by");
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

app.use(cors());
app.use(morgan("dev"));
// The ViaSafe website (public/) is served from the same server as the API.
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.json({ limit: config.enablePrivateApi ? "2mb" : "50kb" }));
app.use(authMiddleware);

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

// Contacts, SOS and fake call identify people only by an x-user-id header that anyone can forge,
// so a public server turns them off (ENABLE_PRIVATE_API=false) until real sign-in exists.
if (config.enablePrivateApi) {
  app.use("/api/contacts", contactsRouter({ config, store }));
  app.use("/api/sos", sosRouter({ config, store }));
  app.use("/api/call", fakeCallRouter({ config, store }));
}
app.use("/api/reports", reportsRouter({ config }));
app.use("/api/risk-map", riskMapRouter({ config }));
app.use("/api/routes", routesRouter({ config }));

app.get("/watch/:token", (req, res) => {
  if (!config.enablePrivateApi) {
    res.status(404).send("Not found");
    return;
  }
  const token = String(req.params.token);
  if (!store.shareTokenToContact.has(token)) {
    res.status(404).send("Invalid link");
    return;
  }
  const wsUrl = `${config.publicBaseUrl.replace(/^http/, "ws")}/sos/stream?role=watcher&token=${encodeURIComponent(token)}`;
  res.setHeader("content-type", "text/html");
  res.send(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ViaSafe Live Location</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; }
    .box { padding: 16px; border: 1px solid #ddd; border-radius: 8px; }
  </style>
</head>
<body>
  <h2>ViaSafe Live Location</h2>
  <div class="box" id="status">Connecting...</div>
  <script>
    const status = document.getElementById('status');
    const ws = new WebSocket('${wsUrl}');
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'location') {
        status.textContent = 'Lat: ' + data.lat + ', Lng: ' + data.lng + ' (ts: ' + data.ts + ')';
      } else if (data.type === 'status') {
        status.textContent = data.active ? 'Live location active' : 'No active SOS session';
      }
    };
    ws.onerror = () => { status.textContent = 'Connection error'; };
  </script>
</body>
</html>`);
});

app.use(errorHandler);

if (config.enablePrivateApi) attachSosWebSocket({ server, wss, config, store, sosBroker });

const host = process.env.HOST ?? "0.0.0.0";
server.listen(config.port, host, () => {
  console.log(`ViaSafe backend running on ${config.publicBaseUrl}`);
});
