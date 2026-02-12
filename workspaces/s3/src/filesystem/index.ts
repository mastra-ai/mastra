import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  HeadObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';

import type {
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  FilesystemMountConfig,
  FilesystemIcon,
  FilesystemInfo,
  ProviderStatus,
  MastraFilesystemOptions,
} from '@mastra/core/workspace';
import { MastraFilesystem, FileNotFoundError, FileExistsError } from '@mastra/core/workspace';

/**
 * S3 mount configuration.
 * Returned by S3Filesystem.getMountConfig() for FUSE mounting in sandboxes.
 */
export interface S3MountConfig extends FilesystemMountConfig {
  type: 's3';
  /** S3 bucket name */
  bucket: string;
  /** AWS region (use 'auto' for R2) */
  region?: string;
  /** Optional endpoint for S3-compatible storage (MinIO, R2, etc.) */
  endpoint?: string;
  /** AWS access key ID */
  accessKeyId?: string;
  /** AWS secret access key */
  secretAccessKey?: string;
  /** Mount as read-only */
  readOnly?: boolean;
}

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

/** Check if an error is a "not found" error from the S3 SDK. */
function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object' || !('name' in error)) return false;
  const name = (error as { name: string }).name;
  return name === 'NotFound' || name === 'NoSuchKey' || name === '404';
}

/** Check if an error is an access denied error from the S3 SDK. */
function isAccessDeniedError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const err = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return err.name === 'AccessDenied' || err.$metadata?.httpStatusCode === 403;
}

/**
 * S3 filesystem provider configuration.
 */
export interface S3FilesystemOptions extends MastraFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** S3 bucket name */
  bucket: string;
  /** Human-friendly display name for the UI */
  displayName?: string;
  /** Icon identifier for the UI (defaults to 's3') */
  icon?: FilesystemIcon;
  /** Description shown in tooltips */
  description?: string;
  /** AWS region (use 'auto' for R2) */
  region: string;
  /**
   * AWS access key ID.
   * Optional - omit for public buckets (read-only access).
   */
  accessKeyId?: string;
  /**
   * AWS secret access key.
   * Optional - omit for public buckets (read-only access).
   */
  secretAccessKey?: string;
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
  /** Mount as read-only (blocks write operations, mounts read-only in sandboxes) */
  readOnly?: boolean;
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

/** Trim leading and trailing slashes without regex (avoids polynomial regex on user input). */
function trimSlashes(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === '/') start++;
  while (end > start && s[end - 1] === '/') end--;
  return s.slice(start, end);
}

export class S3Filesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'S3Filesystem';
  readonly provider = 's3';
  readonly readOnly?: boolean;

  status: ProviderStatus = 'pending';

  // Display metadata for UI
  readonly displayName?: string;
  readonly icon: FilesystemIcon = 's3';
  readonly description?: string;

  private readonly bucket: string;
  private readonly region: string;
  private readonly accessKeyId?: string;
  private readonly secretAccessKey?: string;
  private readonly endpoint?: string;
  private readonly forcePathStyle: boolean;
  private readonly prefix: string;

  private _client: S3Client | null = null;

  constructor(options: S3FilesystemOptions) {
    super({ ...options, name: 'S3Filesystem' });
    this.id = options.id ?? `s3-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.bucket = options.bucket;
    this.region = options.region;
    this.accessKeyId = options.accessKeyId;
    this.secretAccessKey = options.secretAccessKey;
    this.endpoint = options.endpoint;
    this.forcePathStyle = options.forcePathStyle ?? !!options.endpoint; // Default true for custom endpoints
    // Trim leading/trailing slashes from prefix using iterative approach (avoids polynomial regex)
    this.prefix = options.prefix ? trimSlashes(options.prefix) + '/' : '';

    // Display metadata - detect icon first, then derive displayName from it
    this.icon = options.icon ?? this.detectIconFromEndpoint(options.endpoint);
    this.displayName = options.displayName ?? this.getDefaultDisplayName(this.icon);
    this.description = options.description;
    this.readOnly = options.readOnly;
  }

  /**
   * Get mount configuration for E2B sandbox.
   * Returns S3-compatible config that works with s3fs-fuse.
   */
  getMountConfig(): S3MountConfig {
    const config: S3MountConfig = {
      type: 's3',
      bucket: this.bucket,
      region: this.region,
      endpoint: this.endpoint,
    };

    if (this.accessKeyId && this.secretAccessKey) {
      config.accessKeyId = this.accessKeyId;
      config.secretAccessKey = this.secretAccessKey;
    }

    if (this.readOnly) {
      config.readOnly = true;
    }

    return config;
  }

  /**
   * Get filesystem info for status reporting.
   */
  getInfo(): FilesystemInfo<{
    bucket: string;
    region: string;
    endpoint?: string;
    prefix?: string;
  }> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      error: this.error,
      readOnly: this.readOnly,
      icon: this.icon,
      metadata: {
        bucket: this.bucket,
        region: this.region,
        ...(this.endpoint && { endpoint: this.endpoint }),
        ...(this.prefix && { prefix: this.prefix }),
      },
    };
  }

  /**
   * Handle an error, checking for access denied and updating status accordingly.
   * Returns the error for re-throwing.
   */
  private handleError(error: unknown): unknown {
    if (isAccessDeniedError(error)) {
      this.status = 'error';
      this.error = 'Access denied - check credentials and bucket permissions';
    }
    return error;
  }

  /**
   * Get instructions describing this S3 filesystem.
   * Used by agents to understand storage semantics.
   */
  getInstructions(): string {
    const providerName = this.displayName || 'S3';
    const access = this.readOnly ? 'Read-only' : 'Persistent';
    return `${providerName} storage in bucket "${this.bucket}". ${access} storage - files are retained across sessions.`;
  }

  /**
   * Detect the appropriate icon based on the S3 endpoint.
   */
  private detectIconFromEndpoint(endpoint?: string): FilesystemIcon {
    if (!endpoint) {
      // No custom endpoint = AWS S3
      return 'aws-s3';
    }

    // Parse hostname from endpoint URL for secure matching
    let hostname: string;
    try {
      const url = new URL(endpoint);
      hostname = url.hostname.toLowerCase();
    } catch {
      // If URL parsing fails, use the endpoint as-is (lowercased)
      hostname = endpoint.toLowerCase();
    }

    // Check hostname suffix for known providers (use dot-prefix or exact match to prevent subdomain spoofing)
    if (
      hostname === 'r2.cloudflarestorage.com' ||
      hostname.endsWith('.r2.cloudflarestorage.com') ||
      hostname.endsWith('.cloudflare.com')
    ) {
      return 'r2';
    }

    if (
      hostname === 'storage.googleapis.com' ||
      hostname.endsWith('.storage.googleapis.com') ||
      hostname.endsWith('.googleapis.com')
    ) {
      return 'gcs';
    }

    if (
      hostname === 'blob.core.windows.net' ||
      hostname.endsWith('.blob.core.windows.net') ||
      hostname.endsWith('.azure.com')
    ) {
      return 'azure';
    }

    if (hostname.includes('minio')) {
      return 'minio';
    }

    // Generic S3-compatible (DigitalOcean Spaces, etc.)
    return 's3';
  }

  /**
   * Get a user-friendly display name based on the icon/provider.
   */
  private getDefaultDisplayName(icon: FilesystemIcon): string | undefined {
    switch (icon) {
      case 'aws-s3':
        return 'AWS S3';
      case 'r2':
      case 'cloudflare':
      case 'cloudflare-r2':
        return 'Cloudflare R2';
      case 'gcs':
      case 'google-cloud':
      case 'google-cloud-storage':
        return 'Google Cloud Storage';
      case 'azure':
      case 'azure-blob':
        return 'Azure Blob';
      case 'minio':
        return 'MinIO';
      case 's3':
        return 'S3';
      default:
        // Unknown icon - don't assume a display name
        return undefined;
    }
  }

  private getClient(): S3Client {
    if (this._client) return this._client;

    const hasCredentials = this.accessKeyId && this.secretAccessKey;

    this._client = new S3Client({
      region: this.region,
      credentials: hasCredentials
        ? {
            accessKeyId: this.accessKeyId!,
            secretAccessKey: this.secretAccessKey!,
          }
        : // Anonymous access for public buckets - use empty credentials
          // to prevent SDK from trying to find credentials elsewhere
          { accessKeyId: '', secretAccessKey: '' },
      endpoint: this.endpoint,
      forcePathStyle: this.forcePathStyle,
      // Skip signing for anonymous access (public buckets).
      // No-op signer passes the request through unsigned. Uses `any` because
      // the correct type (HttpRequest from @smithy/types) is not a direct dependency.

      ...(hasCredentials ? {} : { signer: { sign: async (request: any) => request } }),
    });

    return this._client;
  }

  /**
   * Ensure the filesystem is initialized and return the S3 client.
   * Uses base class ensureReady() for status management, then returns client.
   */
  private async getReadyClient(): Promise<S3Client> {
    await this.ensureReady();
    return this.getClient();
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
    const client = await this.getReadyClient();

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
      if (isNotFoundError(error)) {
        throw new FileNotFoundError(path);
      }
      throw this.handleError(error);
    }
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const client = await this.getReadyClient();

    if (options?.overwrite === false && (await this.exists(path))) {
      throw new FileExistsError(path);
    }

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
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        // File doesn't exist, start fresh
      } else {
        throw error;
      }
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

    const client = await this.getReadyClient();

    try {
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: this.toKey(path),
        }),
      );
    } catch (error: unknown) {
      if (options?.force) return;
      if (isNotFoundError(error)) {
        throw new FileNotFoundError(path);
      }
      throw this.handleError(error);
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const client = await this.getReadyClient();

    if (options?.overwrite === false && (await this.exists(dest))) {
      throw new FileExistsError(dest);
    }

    try {
      await client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          CopySource: `${this.bucket}/${encodeURIComponent(this.toKey(src)).replace(/%2F/g, '/')}`,
          Key: this.toKey(dest),
        }),
      );
    } catch (error: unknown) {
      if (isNotFoundError(error)) {
        throw new FileNotFoundError(src);
      }
      throw this.handleError(error);
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
    const client = await this.getReadyClient();

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
        const deleteResponse = await client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: listResponse.Contents.filter((obj): obj is { Key: string } => !!obj.Key).map(obj => ({
                Key: obj.Key,
              })),
            },
          }),
        );
        if (deleteResponse.Errors && deleteResponse.Errors.length > 0) {
          throw new Error(`Failed to delete ${deleteResponse.Errors.length} object(s) in ${path}`);
        }
      }

      continuationToken = listResponse.NextContinuationToken;
    } while (continuationToken);
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const client = await this.getReadyClient();

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
    const key = this.toKey(path);
    if (!key) return true; // Root always exists

    const client = await this.getReadyClient();

    // Check if it's a file
    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error: unknown) {
      if (!isNotFoundError(error)) throw this.handleError(error);
      // Not a file, check if it's a "directory" (has objects with this prefix)
    }

    // Check if it's a directory prefix
    const response: { Contents?: unknown[] } = await client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: key.replace(/\/$/, '') + '/',
        MaxKeys: 1,
      }),
    );

    return (response.Contents?.length ?? 0) > 0;
  }

  async stat(path: string): Promise<FileStat> {
    const key = this.toKey(path);

    // Root is always a directory
    if (!key) {
      return {
        name: '',
        path,
        type: 'directory',
        size: 0,
        createdAt: new Date(),
        modifiedAt: new Date(),
      };
    }

    const client = await this.getReadyClient();

    try {
      const response: { ContentLength?: number; LastModified?: Date } = await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
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
    } catch (error: unknown) {
      if (!isNotFoundError(error)) throw this.handleError(error);
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
    const key = this.toKey(path);
    if (!key) return false; // Root is a directory, not a file

    const client = await this.getReadyClient();

    try {
      await client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      return true;
    } catch (error: unknown) {
      if (!isNotFoundError(error)) throw this.handleError(error);
      return false;
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    const key = this.toKey(path);
    if (!key) return true; // Root is always a directory

    const client = await this.getReadyClient();

    const response: { Contents?: unknown[] } = await client.send(
      new ListObjectsV2Command({
        Bucket: this.bucket,
        Prefix: key.replace(/\/$/, '') + '/',
        MaxKeys: 1,
      }),
    );

    return (response.Contents?.length ?? 0) > 0;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle (overrides base class protected methods)
  // ---------------------------------------------------------------------------

  /**
   * Initialize the S3 client.
   * Status management is handled by the base class.
   */
  async init(): Promise<void> {
    // Verify we can access the bucket
    const client = this.getClient();
    try {
      await client.send(new HeadBucketCommand({ Bucket: this.bucket }));
    } catch (error) {
      // Extract httpStatusCode if available
      const statusCode = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;

      // Create error with status property for proper HTTP response codes
      const createError = (message: string) => {
        const err = new Error(message) as Error & { status?: number };
        if (statusCode) err.status = statusCode;
        return err;
      };

      // Provide better error messages for common S3 errors
      if (isAccessDeniedError(error)) {
        throw createError(`Access denied to bucket "${this.bucket}" - check credentials and permissions`);
      }
      if (isNotFoundError(error)) {
        throw createError(`Bucket "${this.bucket}" not found`);
      }
      const message = error instanceof Error ? error.message : String(error);
      if (statusCode) {
        throw createError(`Failed to access bucket "${this.bucket}" (HTTP ${statusCode}): ${message}`);
      }
      throw error;
    }
  }

  /**
   * Clean up the S3 client.
   * Status management is handled by the base class.
   */
  async destroy(): Promise<void> {
    this._client = null;
  }
}
