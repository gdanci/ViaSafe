import type { Config } from "../lib/config.js";
import { GcsStorageProvider, LocalStorageProvider, S3StorageProvider, StorageProvider } from "./storageProviders.js";

let cached: StorageProvider | null = null;

export function getStorageProvider(config: Config): StorageProvider {
  if (cached) return cached;
  cached =
    config.storageDriver === "s3"
      ? new S3StorageProvider({ region: must(config.awsRegion, "AWS_REGION"), bucket: must(config.s3Bucket, "S3_BUCKET") })
      : config.storageDriver === "gcs"
        ? new GcsStorageProvider({ bucket: must(config.gcsBucket, "GCS_BUCKET") })
        : new LocalStorageProvider({ dir: config.localStorageDir });
  return cached;
}

function must<T>(v: T | null | undefined, name: string): T {
  if (v == null) throw new Error(`Missing ${name}`);
  return v;
}