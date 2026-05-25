import type { Files, StoredFile as SDKStoredFile } from 'files-sdk';

import type {
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  FilesystemIcon,
  FilesystemInfo,
  ProviderStatus,
  MastraFilesystemOptions,
} from '@mastra/core/workspace';
import {
  MastraFilesystem,
  FileNotFoundError,
  FileExistsError,
  DirectoryNotEmptyError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

export interface FilesSDKFilesystemOptions extends MastraFilesystemOptions {
  /** Pre-configured FilesSDK `Files` instance. */
  files: Files;
  /** Unique filesystem ID (auto-generated if not provided). */
  id?: string;
  /** Human-friendly display name for UI. */
  displayName?: string;
  /** Icon identifier for UI. */
  icon?: FilesystemIcon;
  /** Description shown in UI / instructions. */
  description?: string;
  /** Mount as read-only — all write operations will throw. */
  readOnly?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a POSIX-style path to an object-storage key.
 * Strips leading slashes, resolves `.`/`./` to empty string.
 */
function toKey(path: string): string {
  let key = path.replace(/^\/+/, '');
  if (key === '.' || key === './') return '';
  // Remove trailing slash (keys don't end with /)
  key = key.replace(/\/+$/, '');
  return key;
}

/**
 * Extract the basename (last path segment) from a key.
 */
function basename(key: string): string {
  const idx = key.lastIndexOf('/');
  return idx === -1 ? key : key.slice(idx + 1);
}

function isNotFoundError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code === 'NotFound';
  }
  return false;
}

function isUnauthorizedError(err: unknown): boolean {
  if (err && typeof err === 'object' && 'code' in err) {
    return (err as { code: string }).code === 'Unauthorized';
  }
  return false;
}

function generateId(): string {
  return `files-sdk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Convert FileContent (string | Buffer | Uint8Array) to a body acceptable by files-sdk.
 */
function toBody(content: FileContent): string | Uint8Array {
  if (typeof content === 'string') return content;
  if (Buffer.isBuffer(content)) return new Uint8Array(content);
  return content;
}

/**
 * Infer MIME type from a file path extension.
 */
const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.markdown': 'text/markdown',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.xml': 'text/xml',
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
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
};

function getMimeType(path: string): string {
  const dot = path.lastIndexOf('.');
  if (dot === -1) return 'application/octet-stream';
  return MIME_TYPES[path.slice(dot).toLowerCase()] ?? 'application/octet-stream';
}

// ---------------------------------------------------------------------------
// FilesSDKFilesystem
// ---------------------------------------------------------------------------

/**
 * Workspace filesystem adapter backed by [FilesSDK](https://files-sdk.dev).
 *
 * Accepts a pre-configured `Files` instance so users choose their own adapter
 * (S3, R2, GCS, Azure, local fs, etc.) and this class bridges it to the
 * Mastra `WorkspaceFilesystem` interface.
 *
 * Object-storage semantics are bridged to the POSIX-like interface:
 * - `mkdir` is a no-op (directories don't exist in object storage)
 * - `readdir` uses `list()` with prefix filtering to synthesize directory entries
 * - `rmdir` lists all keys under a prefix and batch-deletes them
 */
export class FilesSDKFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'FilesSDKFilesystem';
  readonly provider = 'files-sdk';
  status: ProviderStatus = 'pending';

  readonly readOnly?: boolean;
  readonly icon?: FilesystemIcon;
  readonly displayName?: string;
  readonly description?: string;

  private readonly _files: Files;

  constructor(options: FilesSDKFilesystemOptions) {
    super({ name: 'FilesSDKFilesystem', ...options });

    this._files = options.files;
    this.id = options.id ?? generateId();
    this.readOnly = options.readOnly;
    this.icon = options.icon;
    this.displayName = options.displayName;
    this.description = options.description;
  }

  /** The underlying FilesSDK instance, for escape-hatch access. */
  get files(): Files {
    return this._files;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  override async init(): Promise<void> {
    // Verify connectivity by listing at most 1 key
    try {
      await this._files.list({ limit: 1 });
    } catch (err) {
      if (isUnauthorizedError(err)) {
        throw new Error('Access denied — check credentials and storage permissions');
      }
      throw err;
    }
  }

  // destroy() — default no-op is fine; FilesSDK has no explicit teardown.

  getInfo(): FilesystemInfo {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      error: this.error,
      readOnly: this.readOnly,
      icon: this.icon,
      metadata: {
        adapter: this._files.adapter?.name ?? 'unknown',
      },
    };
  }

  getInstructions(): string {
    const adapterName = this._files.adapter?.name ?? 'unknown';
    const parts = [`Unified storage via FilesSDK (${adapterName} adapter).`];
    if (this.readOnly) parts.push('Mounted read-only.');
    parts.push('Persistent storage — files are retained across sessions.');
    return parts.join(' ');
  }

  // ---------------------------------------------------------------------------
  // File operations
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    await this.ensureReady();
    const key = toKey(path);

    try {
      const file = await this._files.download(key);
      const buf = Buffer.from(await file.arrayBuffer());
      if (options?.encoding) return buf.toString(options.encoding);
      return buf;
    } catch (err) {
      if (isNotFoundError(err)) throw new FileNotFoundError(path);
      throw err;
    }
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('writeFile');
    const key = toKey(path);

    // Respect overwrite option (default: true)
    if (options?.overwrite === false) {
      const fileExists = await this._files.exists(key);
      if (fileExists) throw new FileExistsError(path);
    }

    const body = toBody(content);
    await this._files.upload(key, body, {
      contentType: options?.mimeType ?? getMimeType(path),
    });
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    await this.ensureReady();
    this.assertWritable('appendFile');
    const key = toKey(path);

    // Read-modify-write (object storage has no native append)
    let existing = Buffer.alloc(0);
    try {
      const file = await this._files.download(key);
      existing = Buffer.from(await file.arrayBuffer());
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
      // File doesn't exist yet — start fresh
    }

    const append = typeof content === 'string' ? Buffer.from(content) : toBody(content);
    const merged = Buffer.concat([existing, Buffer.isBuffer(append) ? append : Buffer.from(append as Uint8Array)]);

    await this._files.upload(key, new Uint8Array(merged), {
      contentType: getMimeType(path),
    });
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('deleteFile');
    const key = toKey(path);

    // Check if path is a directory (has children)
    if (await this.isDirectory(key)) {
      await this.rmdir(path, options);
      return;
    }

    try {
      await this._files.delete(key);
    } catch (err) {
      if (options?.force) return;
      throw err;
    }
  }

  async copyFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('copyFile');
    const fromKey = toKey(src);
    const toKey_ = toKey(dest);

    try {
      await this._files.copy(fromKey, toKey_);
    } catch (err) {
      if (isNotFoundError(err)) throw new FileNotFoundError(src);
      throw err;
    }
  }

  async moveFile(src: string, dest: string, _options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('moveFile');
    const fromKey = toKey(src);
    const toKey_ = toKey(dest);

    try {
      await this._files.copy(fromKey, toKey_);
      await this._files.delete(fromKey);
    } catch (err) {
      if (isNotFoundError(err)) throw new FileNotFoundError(src);
      throw err;
    }
  }

  // ---------------------------------------------------------------------------
  // Directory operations
  // ---------------------------------------------------------------------------

  async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
    await this.ensureReady();
    // No-op: object storage creates "directories" implicitly on file write.
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('rmdir');
    const key = toKey(path);
    const prefix = key ? `${key}/` : '';

    // List all keys under the prefix
    const allKeys: string[] = [];
    let cursor: string | undefined;

    do {
      const result = await this._files.list({ prefix, cursor, limit: 1000 });
      for (const item of result.items) {
        allKeys.push(item.key);
      }
      cursor = result.cursor;
    } while (cursor);

    if (allKeys.length === 0) return;

    // Non-recursive: fail if directory is not empty
    if (!options?.recursive) {
      throw new DirectoryNotEmptyError(path);
    }

    // Batch delete all keys
    await this._files.delete(allKeys);
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    await this.ensureReady();
    const key = toKey(path);
    const prefix = key ? `${key}/` : '';

    const entries: FileEntry[] = [];
    const seenDirs = new Set<string>();

    let cursor: string | undefined;
    const maxDepth = options?.maxDepth;
    const recursive = options?.recursive ?? false;
    const extensions = options?.extension
      ? Array.isArray(options.extension)
        ? options.extension
        : [options.extension]
      : undefined;

    do {
      const result = await this._files.list({ prefix, cursor, limit: 1000 });

      for (const item of result.items) {
        // item.key is relative to the Files instance's prefix.
        // We need to get the portion after our directory prefix.
        const relativePath = prefix ? item.key.slice(prefix.length) : item.key;
        if (!relativePath) continue;

        const segments = relativePath.split('/');

        if (segments.length === 1) {
          // Direct child (file)
          const name = segments[0]!;

          // Extension filter
          if (extensions) {
            const ext = name.lastIndexOf('.') !== -1 ? name.slice(name.lastIndexOf('.')) : '';
            if (!extensions.includes(ext)) continue;
          }

          entries.push({
            name,
            type: 'file',
            size: item.size,
          });
        } else {
          // Nested item — synthesize a directory entry for the first segment
          const dirName = segments[0]!;
          if (!seenDirs.has(dirName)) {
            seenDirs.add(dirName);
            entries.push({
              name: dirName,
              type: 'directory',
            });
          }

          // If recursive, also include this file
          if (recursive) {
            // Check depth
            if (maxDepth !== undefined && segments.length > maxDepth) continue;

            const name = relativePath;

            if (extensions) {
              const ext = name.lastIndexOf('.') !== -1 ? name.slice(name.lastIndexOf('.')) : '';
              if (!extensions.includes(ext)) continue;
            }

            entries.push({
              name,
              type: 'file',
              size: item.size,
            });
          }
        }
      }

      cursor = result.cursor;
    } while (cursor);

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Path operations
  // ---------------------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    await this.ensureReady();
    const key = toKey(path);

    // Root always exists
    if (!key) return true;

    // Check as file
    const fileExists = await this._files.exists(key);
    if (fileExists) return true;

    // Check as directory (any key with this prefix)
    return this.isDirectory(key);
  }

  async stat(path: string): Promise<FileStat> {
    await this.ensureReady();
    const key = toKey(path);

    // Root is a directory
    if (!key) {
      const now = new Date();
      return {
        name: '/',
        path: '/',
        type: 'directory',
        size: 0,
        createdAt: now,
        modifiedAt: now,
      };
    }

    // Try as file first
    try {
      const file = await this._files.head(key);
      return this.storedFileToStat(file, path);
    } catch (err) {
      if (!isNotFoundError(err)) throw err;
    }

    // Try as directory
    if (await this.isDirectory(key)) {
      const now = new Date();
      return {
        name: basename(key),
        path,
        type: 'directory',
        size: 0,
        createdAt: now,
        modifiedAt: now,
      };
    }

    throw new FileNotFoundError(path);
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private assertWritable(operation: string): void {
    if (this.readOnly) {
      throw new WorkspaceReadOnlyError(operation);
    }
  }

  /** Check if a key prefix has any children (i.e. acts like a directory). */
  private async isDirectory(key: string): Promise<boolean> {
    if (!key) return true; // root
    const prefix = `${key}/`;
    const result = await this._files.list({ prefix, limit: 1 });
    return result.items.length > 0;
  }

  /** Convert a FilesSDK StoredFile to a Mastra FileStat. */
  private storedFileToStat(file: SDKStoredFile, path: string): FileStat {
    return {
      name: basename(file.key ?? path),
      path,
      type: 'file',
      size: file.size ?? 0,
      createdAt: file.lastModified ? new Date(file.lastModified) : new Date(),
      modifiedAt: file.lastModified ? new Date(file.lastModified) : new Date(),
      mimeType: file.type || undefined,
    };
  }
}
