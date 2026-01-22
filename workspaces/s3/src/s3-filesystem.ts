/**
 * S3 Filesystem Provider
 *
 * A filesystem implementation backed by Amazon S3 or S3-compatible storage.
 * Works with AWS S3, Cloudflare R2, MinIO, DigitalOcean Spaces, etc.
 */

import type { S3Client } from '@aws-sdk/client-s3';

import type {
  WorkspaceFilesystem,
  FilesystemMountConfig,
  FilesystemIcon,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from '@mastra/core/workspace';
import { FileNotFoundError } from '@mastra/core/workspace';

/**
 * Common MIME types by file extension.
 */
const MIME_TYPES: Record<string, string> = {
  // Text
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.xml': 'text/xml',
  // Code
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.ts': 'text/typescript',
  '.tsx': 'text/typescript',
  '.jsx': 'text/javascript',
  '.json': 'application/json',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.py': 'text/x-python',
  '.rb': 'text/x-ruby',
  '.sh': 'text/x-shellscript',
  '.bash': 'text/x-shellscript',
  // Images
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  // Documents
  '.pdf': 'application/pdf',
  // Archives
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
};

/**
 * Get MIME type from file path extension.
 */
function getMimeType(path: string): string {
  const ext = path.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? (MIME_TYPES[ext] ?? 'application/octet-stream') : 'application/octet-stream';
}

/**
 * S3 mount configuration.
 * Used when mounting S3 into sandboxes that support s3fs-fuse.
 */
export interface S3MountConfig extends FilesystemMountConfig {
  type: 's3';
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Optional endpoint for S3-compatible storage (MinIO, R2, etc.) */
  endpoint?: string;
}

/**
 * S3 filesystem provider configuration.
 */
export interface S3FilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** S3 bucket name */
  bucket: string;
  /** Human-friendly display name for the UI */
  displayName?: string;
  /** Icon identifier for the UI (defaults to 'aws-s3') */
  icon?: FilesystemIcon;
  /** Description shown in tooltips */
  description?: string;
  /** AWS region (use 'auto' for R2) */
  region: string;
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /**
   * Custom endpoint URL for S3-compatible storage.
   * Examples:
   * - Cloudflare R2: 'https://{accountId}.r2.cloudflarestorage.com'
   * - MinIO: 'http://localhost:9000'
   * - DigitalOcean Spaces: 'https://{region}.digitaloceanspaces.com'
   */
  endpoint?: string;
  /** Force path-style URLs (required for some S3-compatible services) */
  forcePathStyle?: boolean;
  /** Optional prefix for all keys (acts like a subdirectory) */
  prefix?: string;
}

/**
 * S3 filesystem implementation.
 *
 * Stores files in an S3 bucket or S3-compatible storage service.
 * Supports mounting into E2B sandboxes via s3fs-fuse.
 *
 * @example AWS S3
 * ```typescript
 * import { S3Filesystem } from '@mastra/s3';
 *
 * const fs = new S3Filesystem({
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 *   accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
 *   secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
 * });
 * ```
 *
 * @example Cloudflare R2
 * ```typescript
 * import { S3Filesystem } from '@mastra/s3';
 *
 * const fs = new S3Filesystem({
 *   bucket: 'my-bucket',
 *   region: 'auto',
 *   accessKeyId: process.env.R2_ACCESS_KEY_ID!,
 *   secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
 *   endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
 * });
 * ```
 *
 * @example MinIO (local)
 * ```typescript
 * import { S3Filesystem } from '@mastra/s3';
 *
 * const fs = new S3Filesystem({
 *   bucket: 'my-bucket',
 *   region: 'us-east-1',
 *   accessKeyId: 'minioadmin',
 *   secretAccessKey: 'minioadmin',
 *   endpoint: 'http://localhost:9000',
 *   forcePathStyle: true,
 * });
 * ```
 */
export class S3Filesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'S3Filesystem';
  readonly provider = 's3';

  // Display metadata for UI
  readonly displayName?: string;
  readonly icon: FilesystemIcon = 'aws-s3';
  readonly description?: string;

  /**
   * S3Filesystem supports mounting into sandboxes that support s3fs-fuse.
   */
  readonly supportsMounting = true;

  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;
  private readonly endpoint?: string;
  private readonly forcePathStyle: boolean;
  private readonly prefix: string;

  private _client: S3Client | null = null;

  constructor(options: S3FilesystemOptions) {
    this.id = options.id ?? `s3-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.bucket = options.bucket;
    this.region = options.region;
    this.accessKeyId = options.accessKeyId;
    this.secretAccessKey = options.secretAccessKey;
    this.endpoint = options.endpoint;
    this.forcePathStyle = options.forcePathStyle ?? !!options.endpoint; // Default true for custom endpoints
    this.prefix = options.prefix ? options.prefix.replace(/^\/+|\/+$/g, '') + '/' : '';

    // Display metadata
    this.displayName = options.displayName;
    this.icon = options.icon ?? 'aws-s3';
    this.description = options.description;
  }

  /**
   * Get mount configuration for E2B sandbox.
   * Returns S3-compatible config that works with s3fs-fuse.
   */
  getMountConfig(): S3MountConfig {
    return {
      type: 's3',
      bucket: this.bucket,
      region: this.region,
      accessKeyId: this.accessKeyId,
      secretAccessKey: this.secretAccessKey,
      endpoint: this.endpoint,
    };
  }

  private async getClient(): Promise<S3Client> {
    if (this._client) return this._client;

    const { S3Client: S3ClientClass } = await import('@aws-sdk/client-s3');

    this._client = new S3ClientClass({
      region: this.region,
      credentials: {
        accessKeyId: this.accessKeyId,
        secretAccessKey: this.secretAccessKey,
      },
      endpoint: this.endpoint,
      forcePathStyle: this.forcePathStyle,
    });

    return this._client;
  }

  private toKey(path: string): string {
    // Remove leading slash and add prefix
    const cleanPath = path.replace(/^\/+/, '');
    return this.prefix + cleanPath;
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const client = await this.getClient();
    const { GetObjectCommand } = await import('@aws-sdk/client-s3');

    try {
      const response = await client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(path),
        }),
      );

      const body = await response.Body?.transformToByteArray();
      if (!body) throw new FileNotFoundError(path);

      const buffer = Buffer.from(body);
      if (options?.encoding) {
        return buffer.toString(options.encoding);
      }
      return buffer;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'name' in error && error.name === 'NoSuchKey') {
        throw new FileNotFoundError(path);
      }
      throw error;
    }
  }

  async writeFile(path: string, content: FileContent, _options?: WriteOptions): Promise<void> {
    const client = await this.getClient();
    const { PutObjectCommand } = await import('@aws-sdk/client-s3');

    const body = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);
    const contentType = getMimeType(path);

    await client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.toKey(path),
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    // S3 doesn't support append, so read + write
    let existing = '';
    try {
      existing = (await this.readFile(path, { encoding: 'utf-8' })) as string;
    } catch {
      // File doesn't exist, start fresh
    }

    const appendContent = typeof content === 'string' ? content : Buffer.from(content).toString('utf-8');
    await this.writeFile(path, existing + appendContent);
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    // Check if this is a directory - if so, use rmdir instead
    const isDir = await this.isDirectory(path);
    if (isDir) {
      await this.rmdir(path, { recursive: true, force: options?.force });
      return;
    }

    const client = await this.getClient();
    const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(path),
        }),
      );
    } catch (error: unknown) {
      if (!options?.force) {
        throw new FileNotFoundError(path);
      }
    }
  }

  async copyFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    const client = await this.getClient();
    const { CopyObjectCommand } = await import('@aws-sdk/client-s3');

    try {
      await client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${this.toKey(src)}`,
          Key: this.toKey(dest),
        }),
      );
    } catch {
      throw new FileNotFoundError(src);
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.copyFile(src, dest, options);
    await this.deleteFile(src, { force: true });
  }

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
    // S3 doesn't have real directories - they're just key prefixes
    // No-op, directories are created implicitly when files are written
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    if (!options?.recursive) {
      // Check if directory is empty
      const entries = await this.readdir(path);
      if (entries.length > 0) {
        throw new Error(`Directory not empty: ${path}`);
      }
      return;
    }

    // Delete all objects with this prefix
    const client = await this.getClient();
    const { ListObjectsV2Command, DeleteObjectsCommand } = await import('@aws-sdk/client-s3');

    const prefix = this.toKey(path).replace(/\/$/, '') + '/';

    let continuationToken: string | undefined;
    do {
      const listResponse = await client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: prefix,
          ContinuationToken: continuationToken,
        }),
      );

      if (listResponse.Contents && listResponse.Contents.length > 0) {
        await client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: listResponse.Contents.filter((obj): obj is { Key: string } => !!obj.Key).map(obj => ({
                Key: obj.Key,
              })),
            },
          }),
        );
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const client = await this.getClient();
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    const prefix = this.toKey(path).replace(/\/$/, '');
    const searchPrefix = prefix ? prefix + '/' : '';

    const entries: FileEntry[] = [];
    const seenDirs = new Set<string>();

    let continuationToken: string | undefined;
    do {
      const response = await client.send(
        new ListObjectsV2Command({
          Bucket: this.bucket,
          Prefix: searchPrefix,
          Delimiter: options?.recursive ? undefined : '/',
          ContinuationToken: continuationToken,
        }),
      );

      // Add files
      if (response.Contents) {
        for (const obj of response.Contents) {
          const key = obj.Key;
          if (!key || key === searchPrefix) continue;

          const relativePath = key.slice(searchPrefix.length);
          if (!relativePath) continue;

          // Skip if this looks like a directory marker
          if (relativePath.endsWith('/')) {
            const dirName = relativePath.slice(0, -1);
            if (!seenDirs.has(dirName)) {
              seenDirs.add(dirName);
              entries.push({ name: dirName, type: 'directory' });
            }
            continue;
          }

          const name = options?.recursive ? relativePath : relativePath.split('/')[0];

          // Skip if name is undefined or empty
          if (!name) continue;

          // Filter by extension if specified
          if (options?.extension) {
            const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
            if (!extensions.some(ext => name.endsWith(ext))) {
              continue;
            }
          }

          entries.push({
            name,
            type: 'file',
            size: obj.Size,
          });
        }
      }

      // Add directories (common prefixes)
      if (response.CommonPrefixes) {
        for (const prefixObj of response.CommonPrefixes) {
          if (!prefixObj.Prefix) continue;
          const dirName = prefixObj.Prefix.slice(searchPrefix.length).replace(/\/$/, '');
          if (dirName && !seenDirs.has(dirName)) {
            seenDirs.add(dirName);
            entries.push({ name: dirName, type: 'directory' });
          }
        }
      }

      continuationToken = response.NextContinuationToken;
    } while (continuationToken);

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    const client = await this.getClient();
    const { HeadObjectCommand, ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    // Check if it's a file
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(path),
        }),
      );
      return true;
    } catch {
      // Not a file, check if it's a "directory" (has objects with this prefix)
    }

    // Check if it's a directory prefix
    const response: { Contents?: unknown[] } = await client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.toKey(path).replace(/\/$/, '') + '/',
        MaxKeys: 1,
      }),
    );

    return (response.Contents?.length ?? 0) > 0;
  }

  async stat(path: string): Promise<FileStat> {
    const client = await this.getClient();
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

    try {
      const response: { ContentLength?: number; LastModified?: Date } = await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(path),
        }),
      );

      const name = path.split('/').pop() ?? '';
      return {
        name,
        path,
        type: 'file',
        size: response.ContentLength ?? 0,
        createdAt: response.LastModified ?? new Date(),
        modifiedAt: response.LastModified ?? new Date(),
      };
    } catch {
      // Check if it's a directory
      const isDir = await this.isDirectory(path);
      if (isDir) {
        const name = path.split('/').filter(Boolean).pop() ?? '';
        return {
          name,
          path,
          type: 'directory',
          size: 0,
          createdAt: new Date(),
          modifiedAt: new Date(),
        };
      }
      throw new FileNotFoundError(path);
    }
  }

  async isFile(path: string): Promise<boolean> {
    const client = await this.getClient();
    const { HeadObjectCommand } = await import('@aws-sdk/client-s3');

    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(path),
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    const client = await this.getClient();
    const { ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    const response: { Contents?: unknown[] } = await client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: this.toKey(path).replace(/\/$/, '') + '/',
        MaxKeys: 1,
      }),
    );

    return (response.Contents?.length ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // Verify we can access the bucket
    await this.getClient();
  }

  async destroy(): Promise<void> {
    this._client = null;
  }
}
