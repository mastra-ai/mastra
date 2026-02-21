import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3';

import { BlobStore } from '@mastra/core/storage';
import type { StorageBlobEntry } from '@mastra/core/storage';

/**
 * Configuration for S3BlobStore.
 *
 * Compatible with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, etc.
 */
export interface S3BlobStoreOptions {
  /** S3 bucket name */
  bucket: string;
  /** AWS region (use 'auto' for R2) */
  region: string;
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /**
   * AWS session token for temporary credentials (STS).
   * Required when using AWS STS, IAM role assumption, or federated access.
   */
  sessionToken?: string;
  /**
   * Custom endpoint URL for S3-compatible storage.
   * Examples:
   * - Cloudflare R2: 'https://{accountId}.r2.cloudflarestorage.com'
   * - MinIO: 'http://localhost:9000'
   */
  endpoint?: string;
  /** Force path-style URLs (required for some S3-compatible services like MinIO) */
  forcePathStyle?: boolean;
  /**
   * Key prefix for all blob objects.
   * Defaults to 'mastra_skill_blobs/'.
   */
  prefix?: string;
}

/** Trim leading and trailing slashes. */
function trimSlashes(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === '/') start++;
  while (end > start && s[end - 1] === '/') end--;
  return s.slice(start, end);
}

/**
 * S3-backed content-addressable blob store for skill versioning.
 *
 * Each blob is stored as an S3 object keyed by its SHA-256 hash.
 * Metadata (size, mimeType, createdAt) is stored in S3 object user metadata.
 *
 * Since blobs are content-addressable, writes are idempotent — the same hash
 * always maps to the same content, so overwrites are safe and equivalent to
 * a no-op.
 *
 * @example AWS S3
 * ```typescript
 * import { S3BlobStore } from '@mastra/s3';
 *
 * const blobs = new S3BlobStore({
 *   bucket: 'my-skill-blobs',
 *   region: 'us-east-1',
 *   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 * });
 * ```
 *
 * @example MinIO (local)
 * ```typescript
 * import { S3BlobStore } from '@mastra/s3';
 *
 * const blobs = new S3BlobStore({
 *   bucket: 'skill-blobs',
 *   region: 'us-east-1',
 *   accessKeyId: 'minioadmin',
 *   secretAccessKey: 'minioadmin',
 *   endpoint: 'http://localhost:9000',
 *   forcePathStyle: true,
 * });
 * ```
 */
export class S3BlobStore extends BlobStore {
  private readonly bucket: string;
  private readonly prefix: string;
  private _client: S3Client | null = null;

  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly sessionToken?: string;
  private readonly endpoint?: string;
  private readonly forcePathStyle: boolean;

  constructor(options: S3BlobStoreOptions) {
    super();
    this.bucket = options.bucket;
    this.region = options.region;
    this.accessKeyId = options.accessKeyId;
    this.secretAccessKey = options.secretAccessKey;
    this.sessionToken = options.sessionToken;
    this.endpoint = options.endpoint;
    this.forcePathStyle = options.forcePathStyle ?? !!options.endpoint;
    this.prefix = options.prefix ? trimSlashes(options.prefix) + '/' : 'mastra_skill_blobs/';
  }

  private getClient(): S3Client {
    if (this._client) return this._client;
    this._client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
        ...(this.sessionToken ? { sessionToken: this.sessionToken } : {}),
      },
      endpoint: this.endpoint,
      forcePathStyle: this.forcePathStyle,
    });
    return this._client;
  }

  private toKey(hash: string): string {
    return this.prefix + hash;
  }

  async init(): Promise<void> {
    // S3 doesn't require table creation — the bucket is expected to exist.
  }

  async put(entry: StorageBlobEntry): Promise<void> {
    const client = this.getClient();
    const now = entry.createdAt ?? new Date();

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(entry.hash),
        Body: entry.content,
        ContentType: entry.mimeType ?? 'application/octet-stream',
        Metadata: {
          size: String(entry.size),
          createdat: now.toISOString(),
          ...(entry.mimeType ? { mimetype: entry.mimeType } : {}),
        },
      }),
    );
  }

  async get(hash: string): Promise<StorageBlobEntry | null> {
    const client = this.getClient();

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(hash),
        }),
      );

      const body = await response.Body?.transformToString('utf-8');
      if (body === undefined || body === null) return null;

      const metadata = response.Metadata ?? {};
      return {
        hash,
        content: body,
        size: metadata.size != null ? Number(metadata.size) : Buffer.byteLength(body, 'utf-8'),
        mimeType: metadata.mimetype || response.ContentType || undefined,
        createdAt: metadata.createdat ? new Date(metadata.createdat) : new Date(),
      };
    } catch (error: unknown) {
      if (isNotFoundError(error)) return null;
      throw error;
    }
  }

  async has(hash: string): Promise<boolean> {
    const client = this.getClient();

    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(hash),
        }),
      );
      return true;
    } catch (error: unknown) {
      if (isNotFoundError(error)) return false;
      throw error;
    }
  }

  async delete(hash: string): Promise<boolean> {
    // Pre-check is intentional: S3 DeleteObject returns 204 regardless of
    // whether the object existed, so we check first for an accurate return.
    // The TOCTOU gap is acceptable for content-addressable blobs.
    const existed = await this.has(hash);
    if (!existed) return false;

    const client = this.getClient();
    await client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(hash),
      }),
    );
    return true;
  }

  async putMany(entries: StorageBlobEntry[]): Promise<void> {
    if (entries.length === 0) return;
    // S3 doesn't have a batch PUT, so we parallelize individual puts.
    // Content-addressable means duplicate writes are idempotent.
    await Promise.all(entries.map(entry => this.put(entry)));
  }

  async getMany(hashes: string[]): Promise<Map<string, StorageBlobEntry>> {
    const result = new Map<string, StorageBlobEntry>();
    if (hashes.length === 0) return result;

    // Parallelize individual gets
    const entries = await Promise.all(hashes.map(hash => this.get(hash)));
    for (const entry of entries) {
      if (entry) {
        result.set(entry.hash, entry);
      }
    }
    return result;
  }

  async dangerouslyClearAll(): Promise<void> {
    const client = this.getClient();

    let continuationToken: string | undefined;
    do {
      const listResponse = await client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: this.prefix,
          ContinuationToken: continuationToken,
        }),
      );

      const objects = listResponse.Contents;
      if (objects && objects.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: objects.filter(obj => obj.Key != null).map(obj => ({ Key: obj.Key! })),
              Quiet: true,
            },
          }),
        );
      }

      continuationToken = listResponse.IsTruncated ? listResponse.NextContinuationToken : undefined;
    } while (continuationToken);
  }
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('name' in error)) return false;
  const name = (error as { name: string }).name;
  return name === 'NotFound' || name === 'NoSuchKey' || name === '404';
}
