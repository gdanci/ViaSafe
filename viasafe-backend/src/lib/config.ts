export type Config = {
  port: number;
  publicBaseUrl: string;
  dataFile: string;
  storageDriver: "local" | "s3" | "gcs";
  localStorageDir: string;
  sosBroker: "memory" | "redis";
  redisUrl?: string;
  firebaseServiceAccountJson?: string;
  firebaseServiceAccountPath?: string;
  valhallaUrl?: string;
  awsRegion?: string;
  s3Bucket?: string;
  gcsBucket?: string;
  // Hosting safety switches (all default to the old local behaviour)
  enablePrivateApi: boolean;
  allowReset: boolean;
  seedDemoData: boolean;
  clujOnly: boolean;
  valhallaAudience?: string;
};

export function loadConfig(): Config {
  const port = Number(process.env.PORT || 3000);
  const publicBaseUrl = process.env.PUBLIC_BASE_URL || `http://localhost:${port}`;

  return {
    port,
    publicBaseUrl,
    dataFile: process.env.DATA_FILE || "data/store.json",
    storageDriver: (process.env.STORAGE_DRIVER || "local") as "local" | "s3" | "gcs",
    localStorageDir: process.env.LOCAL_STORAGE_DIR || "uploads",
    sosBroker: (process.env.SOS_BROKER || "memory") as "memory" | "redis",
    redisUrl: process.env.REDIS_URL,
    firebaseServiceAccountJson: process.env.FIREBASE_SERVICE_ACCOUNT_JSON,
    firebaseServiceAccountPath: process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "secrets/firebase-service-account.json",
    valhallaUrl: process.env.VALHALLA_URL,
    awsRegion: process.env.AWS_REGION,
    s3Bucket: process.env.S3_BUCKET,
    gcsBucket: process.env.GCS_BUCKET,
    // contacts / SOS / fake call / live-location: need real sign-in before they can be public
    enablePrivateApi: process.env.ENABLE_PRIVATE_API !== "false",
    // ?reset=1 wipes and re-seeds the demo data. Never allow that on a public server.
    allowReset: process.env.ALLOW_RESET === "true",
    // fill an empty/small database with the demo data
    seedDemoData: process.env.SEED_DEMO_DATA !== "false",
    // refuse reports and routes outside Cluj-Napoca
    clujOnly: process.env.CLUJ_ONLY === "true",
    // set on Cloud Run when Valhalla is a private service: the backend signs its calls to it
    valhallaAudience: process.env.VALHALLA_AUDIENCE
  };
}
