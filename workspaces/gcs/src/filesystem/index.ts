/**
 * GCS Filesystem Provider
 *
 * A filesystem implementation backed by Google Cloud Storage.
 */

import { Storage } from '@google-cloud/storage';
import type { Bucket } from '@google-cloud/storage';

import type {
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  FilesystemInfo,
  FilesystemMountConfig,
  FilesystemIcon,
  ProviderStatus,
  MastraFilesystemOptions,
} from '@mastra/core/workspace';
import { MastraFilesystem, FileNotFoundError, FileExistsError } from '@mastra/core/workspace';

/**
 * GCS mount configuration.
 * Returned by GCSFilesystem.getMountConfig() for FUSE mounting in sandboxes.
 */
export interface GCSMountConfig extends FilesystemMountConfig {
  type: 'gcs';
  /** GCS bucket name */
  bucket: string;
  /** Service account key JSON (optional - omit for public buckets or ADC) */
  serviceAccountKey?: string;
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

/**
 * GCS filesystem provider configuration.
 */
export interface GCSFilesystemOptions extends MastraFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** GCS bucket name */
  bucket: string;
  /** Human-friendly display name for the UI */
  displayName?: string;
  /** Icon identifier for the UI (defaults to 'gcs') */
  icon?: FilesystemIcon;
  /** Description shown in tooltips */
  description?: string;
  /**
   * GCS project ID.
   * Required when using service account credentials.
   */
  projectId?: string;
  /**
   * Service account key JSON object or path to key file.
   * If not provided, uses Application Default Credentials (ADC).
   */
  credentials?: object | string;
  /** Optional prefix for all keys (acts like a subdirectory) */
  prefix?: string;
  /** Mount as read-only (blocks write operations, mounts read-only in sandboxes) */
  readOnly?: boolean;
  /**
   * Custom API endpoint URL.
   * Used for local development with emulators like fake-gcs-server.
   */
  endpoint?: string;
}

/**
 * GCS filesystem implementation.
 *
 * Stores files in a Google Cloud Storage bucket.
 * Supports mounting into E2B sandboxes via gcsfuse.
 *
 * @example Using Application Default Credentials
 * ```typescript
 * import { GCSFilesystem } from '@mastra/gcs';
 *
 * // Uses ADC (gcloud auth application-default login)
 * const fs = new GCSFilesystem({
 *   bucket: 'my-bucket',
 *   projectId: 'my-project',
 * });
 * ```
 *
 * @example Using Service Account Key
 * ```typescript
 * import { GCSFilesystem } from '@mastra/gcs';
 *
 * const fs = new GCSFilesystem({
 *   bucket: 'my-bucket',
 *   projectId: 'my-project',
 *   credentials: {
 *     type: 'service_account',
 *     project_id: 'my-project',
 *     private_key_id: '...',
 *     private_key: '-----BEGIN PRIVATE KEY-----\n...',
 *     client_email: '...@...iam.gserviceaccount.com',
 *     // ... rest of service account key
 *   },
 * });
 * ```
 *
 * @example Using Key File Path
 * ```typescript
 * import { GCSFilesystem } from '@mastra/gcs';
 *
 * const fs = new GCSFilesystem({
 *   bucket: 'my-bucket',
 *   projectId: 'my-project',
 *   credentials: '/path/to/service-account-key.json',
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

export class GCSFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'GCSFilesystem';
  readonly provider = 'gcs';
  readonly readOnly?: boolean;

  status: ProviderStatus = 'pending';

  // Display metadata for UI
  readonly displayName?: string;
  readonly icon: FilesystemIcon = 'gcs';
  readonly description?: string;

  private readonly bucketName: string;
  private readonly projectId?: string;
  private readonly credentials?: object | string;
  private readonly prefix: string;
  private readonly endpoint?: string;

  private _storage: Storage | null = null;
  private _bucket: Bucket | null = null;

  constructor(options: GCSFilesystemOptions) {
    super({ ...options, name: 'GCSFilesystem' });
    this.id = options.id ?? `gcs-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.bucketName = options.bucket;
    this.projectId = options.projectId;
    this.credentials = options.credentials;
    // Trim leading/trailing slashes from prefix using iterative approach (avoids polynomial regex)
    this.prefix = options.prefix ? trimSlashes(options.prefix) + '/' : '';
    this.endpoint = options.endpoint;

    // Display metadata
    this.displayName = options.displayName ?? 'Google Cloud Storage';
    this.icon = options.icon ?? 'gcs';
    this.description = options.description;
    this.readOnly = options.readOnly;
  }

  /**
   * Get mount configuration for E2B sandbox.
   * Returns GCS-compatible config that works with gcsfuse.
   */
  getMountConfig(): GCSMountConfig {
    const config: GCSMountConfig = {
      type: 'gcs',
      bucket: this.bucketName,
    };

    // Include service account key if credentials are an object
    if (this.credentials && typeof this.credentials === 'object') {
      config.serviceAccountKey = JSON.stringify(this.credentials);
    }

    return config;
  }

  /**
   * Get filesystem info for status reporting.
   */
  getInfo(): FilesystemInfo<{
    bucket: string;
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
        bucket: this.bucketName,
        ...(this.endpoint && { endpoint: this.endpoint }),
        ...(this.prefix && { prefix: this.prefix }),
      },
    };
  }

  /**
   * Get instructions describing this GCS filesystem.
   * Used by agents to understand storage semantics.
   */
  getInstructions(): string {
    const access = this.readOnly ? 'Read-only' : 'Persistent';
    return `Google Cloud Storage in bucket "${this.bucketName}". ${access} storage - files are retained across sessions.`;
  }

  private getStorage(): Storage {
    if (this._storage) return this._storage;

    const options: { projectId?: string; credentials?: object; keyFilename?: string; apiEndpoint?: string } = {};

    if (this.projectId) {
      options.projectId = this.projectId;
    }

    if (this.credentials) {
      if (typeof this.credentials === 'string') {
        // Path to key file
        options.keyFilename = this.credentials;
      } else {
        // Credentials object
        options.credentials = this.credentials;
      }
    }

    if (this.endpoint) {
      options.apiEndpoint = this.endpoint;
    }

    this._storage = new Storage(options);
    return this._storage;
  }

  private getBucket(): Bucket {
    if (this._bucket) return this._bucket;

    const storage = this.getStorage();
    this._bucket = storage.bucket(this.bucketName);
    return this._bucket;
  }

  /**
   * Ensure the filesystem is initialized and return the bucket.
   * Uses base class ensureReady() for status management, then returns bucket.
   */
  private async getReadyBucket(): Promise<Bucket> {
    await this.ensureReady();
    return this.getBucket();
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
    const bucket = await this.getReadyBucket();
    const file = bucket.file(this.toKey(path));

    try {
      const [content] = await file.download();

      if (options?.encoding) {
        return content.toString(options.encoding);
      }
      return content;
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
        throw new FileNotFoundError(path);
      }
      throw error;
    }
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const bucket = await this.getReadyBucket();
    const file = bucket.file(this.toKey(path));

    if (options?.overwrite === false && (await this.exists(path))) {
      throw new FileExistsError(path);
    }

    const body = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);
    const contentType = getMimeType(path);

    await file.save(body, {
      contentType,
      resumable: false,
    });
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    // GCS doesn't support append, so read + write
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

    const bucket = await this.getReadyBucket();
    const file = bucket.file(this.toKey(path));

    try {
      await file.delete();
    } catch (error: unknown) {
      if (!options?.force) {
        if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
          throw new FileNotFoundError(path);
        }
        throw error;
      }
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const bucket = await this.getReadyBucket();
    const srcFile = bucket.file(this.toKey(src));
    const destFile = bucket.file(this.toKey(dest));

    if (options?.overwrite === false && (await this.exists(dest))) {
      throw new FileExistsError(dest);
    }

    try {
      await srcFile.copy(destFile);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
        throw new FileNotFoundError(src);
      }
      throw error;
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
    // GCS doesn't have real directories - they're just key prefixes
    // No-op, directories are created implicitly when files are written
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    if (!options?.recursive) {
      // Quick emptiness check — only fetch one object instead of full readdir
      const bucket = await this.getReadyBucket();
      const prefix = this.toKey(path).replace(/\/$/, '') + '/';
      const [files] = await bucket.getFiles({ prefix, maxResults: 1 });
      if (files.length > 0) {
        throw new Error(`Directory not empty: ${path}`);
      }
      return;
    }

    // Delete all objects with this prefix
    const bucket = await this.getReadyBucket();
    const prefix = this.toKey(path).replace(/\/$/, '') + '/';

    await bucket.deleteFiles({ prefix });
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const bucket = await this.getReadyBucket();

    const prefix = this.toKey(path).replace(/\/$/, '');
    const searchPrefix = prefix ? prefix + '/' : '';

    const entries: FileEntry[] = [];
    const seenDirs = new Set<string>();

    const [files] = await bucket.getFiles({
      prefix: searchPrefix,
      autoPaginate: true,
    });

    for (const file of files) {
      const key = file.name;
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

      // For non-recursive listing, if there's a slash, it's a directory
      if (!options?.recursive && relativePath.includes('/')) {
        if (!seenDirs.has(name)) {
          seenDirs.add(name);
          entries.push({ name, type: 'directory' });
        }
        continue;
      }

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
        size: file.metadata.size != null ? Number(file.metadata.size) : undefined,
      });
    }

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    const key = this.toKey(path);

    // Root path always exists (it's the bucket itself)
    if (!key) return true;

    const bucket = await this.getReadyBucket();
    const file = bucket.file(key);

    // Check if it's a file
    const [exists] = await file.exists();
    if (exists) return true;

    // Check if it's a "directory" (has objects with this prefix)
    const [files] = await bucket.getFiles({
      prefix: key.replace(/\/$/, '') + '/',
      maxResults: 1,
    });

    return files.length > 0;
  }

  async stat(path: string): Promise<FileStat> {
    const key = this.toKey(path);

    // Root path is always a directory
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

    const bucket = await this.getReadyBucket();
    const file = bucket.file(key);

    const [exists] = await file.exists();
    if (exists) {
      const [metadata] = await file.getMetadata();
      const name = path.split('/').pop() ?? '';

      return {
        name,
        path,
        type: 'file',
        size: Number(metadata.size) || 0,
        createdAt: metadata.timeCreated ? new Date(metadata.timeCreated) : new Date(),
        modifiedAt: metadata.updated ? new Date(metadata.updated) : new Date(),
      };
    }

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

  async isFile(path: string): Promise<boolean> {
    const key = this.toKey(path);
    if (!key) return false; // Root is a directory, not a file

    const bucket = await this.getReadyBucket();
    const file = bucket.file(key);

    const [exists] = await file.exists();
    return exists;
  }

  async isDirectory(path: string): Promise<boolean> {
    const key = this.toKey(path);
    if (!key) return true; // Root is always a directory

    const bucket = await this.getReadyBucket();

    const [files] = await bucket.getFiles({
      prefix: key.replace(/\/$/, '') + '/',
      maxResults: 1,
    });

    return files.length > 0;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle (overrides base class protected methods)
  // ---------------------------------------------------------------------------

  /**
   * Initialize the GCS client.
   * Status management is handled by the base class.
   */
  async init(): Promise<void> {
    // Verify we can access the bucket
    const bucket = this.getBucket();
    try {
      const [exists] = await bucket.exists();
      if (!exists) {
        const err = new Error(`Bucket "${this.bucketName}" does not exist`) as Error & { status?: number };
        err.status = 404;
        throw err;
      }
    } catch (error) {
      // Check if error already has status (from our 404 throw above)
      if ((error as { status?: number }).status) {
        throw error;
      }
      // Extract status code from GCS errors and add to error for proper HTTP response
      const code = (error as { code?: number }).code;
      if (typeof code === 'number') {
        const message = error instanceof Error ? error.message : String(error);
        const err = new Error(
          message,
          // code === 403
          //   ? `Access denied to bucket "${this.bucketName}" - check credentials and permissions`
          //   : message,
        ) as Error & { status?: number };
        err.status = code;
        throw err;
      }
      throw error;
    }
  }

  /**
   * Clean up the GCS client.
   * Status management is handled by the base class.
   */
  async destroy(): Promise<void> {
    this._storage = null;
    this._bucket = null;
  }
}
