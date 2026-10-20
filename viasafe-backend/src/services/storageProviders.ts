import fs from "node:fs/promises";
import path from "node:path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { Storage } from "@google-cloud/storage";

export type PutObjectInput = {
  objectKey: string;
  contentType: string;
  bytes: Buffer;
};

export interface StorageProvider {
  putObject(input: PutObjectInput): Promise<void>;
}

export class LocalStorageProvider implements StorageProvider {
  private dir: string;
  constructor({ dir }: { dir: string }) {
    this.dir = dir;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    const outPath = path.join(this.dir, input.objectKey);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, input.bytes);
  }
}

export class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;

  constructor({ region, bucket }: { region: string; bucket: string }) {
    this.client = new S3Client({ region });
    this.bucket = bucket;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        Body: input.bytes,
        ContentType: input.contentType
      })
    );
  }
}

export class GcsStorageProvider implements StorageProvider {
  private storage: Storage;
  private bucket: string;

  constructor({ bucket }: { bucket: string }) {
    this.storage = new Storage();
    this.bucket = bucket;
  }

  async putObject(input: PutObjectInput): Promise<void> {
    const file = this.storage.bucket(this.bucket).file(input.objectKey);
    await file.save(input.bytes, { contentType: input.contentType, resumable: false });
  }
}