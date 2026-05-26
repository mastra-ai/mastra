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
import type { Files, StoredFile as SDKStoredFile } from 'files-sdk';

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
  // Strip leading slashes (avoid regex backtracking concerns flagged by CodeQL
  // — these are character-class loops that are linear, but explicit indexing
  // sidesteps any analyzer false positives).
  let start = 0;
  while (start < path.length && path.charCodeAt(start) === 47 /* "/" */) start++;
  let end = path.length;
  while (end > start && path.charCodeAt(end - 1) === 47) end--;
  const key = path.slice(start, end);
  if (key === '.' || key === './') return '';
  return key;
}

/**
 * Extract the basename (last path segment) from a key.
 */
function basename(key: string): string {
  const idx = key.lastIndexOf('/');
  return idx === -1 ? key : key.slice(idx + 1);
}

/**
 * Walk the FilesSDK error code chain.
 *
 * FilesSDK frequently wraps an inner `NotFound` / `Unauthorized` error in an
 * outer `Provider` error (`error.cause` carries the original). Some adapters
 * may wrap multiple levels deep, so we walk the cause chain and return any
 * matching code found along the way.
 */
function hasFilesSDKCode(err: unknown, code: string, depth = 0): boolean {
  if (depth > 5 || !err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; cause?: unknown };
  if (e.code === code) return true;
  if (e.cause) return hasFilesSDKCode(e.cause, code, depth + 1);
  return false;
}

function isNotFoundError(err: unknown): boolean {
  return hasFilesSDKCode(err, 'NotFound');
}

function isUnauthorizedError(err: unknown): boolean {
  return hasFilesSDKCode(err, 'Unauthorized');
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

    // Respect overwrite option (default: true). Use isFile() rather than
    // _files.exists() so leftover empty directories (some adapters) don't
    // incorrectly trigger FileExistsError.
    if (options?.overwrite === false && (await this.isFile(key))) {
      throw new FileExistsError(path);
    }

    const body = toBody(content);
    await this._files.upload(key, body, {
      contentType: options?.mimeType ?? getMimeType(path),
    });
  }

  /**
   * Append content to a file.
   *
   * **Not atomic.** Object storage has no native append, so this is implemented
   * as a read-modify-write: the existing object is downloaded, the new content
   * is concatenated, and the result is uploaded as a new object. Concurrent
   * appends to the same key may overwrite each other. This limitation is
   * inherent to object storage, not specific to FilesSDK, and matches the
   * behavior of the sibling S3, GCS, and Azure workspace providers.
   */
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

    // If the path is a directory, recursively delete (matches sibling
    // filesystems like S3/GCS). Object storage has no first-class directories,
    // so callers calling deleteFile on a prefix expect it to clean up.
    if (await this.isDirectory(key)) {
      await this.rmdir(path, { recursive: true, force: options?.force });
      return;
    }

    // Some FilesSDK adapters (notably the local `fs` adapter) silently succeed
    // when deleting a non-existent key instead of raising `NotFound`. Match the
    // shared filesystem contract (and S3/GCS behavior) by checking existence
    // first when `force` is not set.
    if (!options?.force && !(await this.isFile(key))) {
      throw new FileNotFoundError(path);
    }

    try {
      await this._files.delete(key);
    } catch (err) {
      if (options?.force) return;
      if (isNotFoundError(err)) throw new FileNotFoundError(path);
      throw err;
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('copyFile');
    const fromKey = toKey(src);
    const toKey_ = toKey(dest);

    if (options?.overwrite === false && (await this.isFile(toKey_))) {
      throw new FileExistsError(dest);
    }

    try {
      await this._files.copy(fromKey, toKey_);
    } catch (err) {
      if (isNotFoundError(err)) throw new FileNotFoundError(src);
      throw err;
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    // Object storage has no atomic rename. Mirrors the S3/GCS pattern:
    // copy first; if that succeeds, force-delete the source.
    await this.copyFile(src, dest, options);
    await this.deleteFile(src, { force: true });
  }

  // ---------------------------------------------------------------------------
  // Directory operations
  // ---------------------------------------------------------------------------

  async mkdir(_path: string, _options?: { recursive?: boolean }): Promise<void> {
    await this.ensureReady();
    this.assertWritable('mkdir');
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
        } else if (!recursive) {
          // Non-recursive: synthesize a directory entry for the first segment only.
          const dirName = segments[0]!;
          if (!seenDirs.has(dirName)) {
            seenDirs.add(dirName);
            entries.push({
              name: dirName,
              type: 'directory',
            });
          }
        } else {
          // Recursive: emit every intermediate directory along the path, then the file.
          // For "a/b/c/file.txt": emit "a", "a/b", "a/b/c" as directories, then the file.
          for (let i = 1; i < segments.length; i++) {
            const dirPath = segments.slice(0, i).join('/');
            const dirDepth = i; // number of segments in dirPath
            if (maxDepth !== undefined && dirDepth > maxDepth) continue;
            if (!seenDirs.has(dirPath)) {
              seenDirs.add(dirPath);
              entries.push({
                name: dirPath,
                type: 'directory',
              });
            }
          }

          // Depth check for the file itself
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

    // Check as directory first (any key under this prefix). Doing the prefix
    // list before the per-key check matters for adapters like FilesSDK's `fs`
    // that leave empty parent directories on disk after their contents are
    // deleted — those would otherwise report true via `_files.exists` even
    // though no objects exist there. Object-store semantics: a "directory"
    // exists iff it has children.
    if (await this.isDirectory(key)) return true;

    // Check as a real stored file. We deliberately avoid `_files.exists(key)`
    // here because some adapters (e.g. the local `fs` adapter) consider an
    // empty leftover directory to exist as a key, which would break
    // object-store semantics. A prefix list constrained to the exact key only
    // matches actually-stored files.
    return this.isFile(key);
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

  /**
   * Check whether `key` refers to a real stored file (not an empty leftover
   * directory). Uses prefix listing constrained to the exact key, which only
   * matches actually-stored objects across all adapters.
   */
  private async isFile(key: string): Promise<boolean> {
    if (!key) return false;
    const result = await this._files.list({ prefix: key, limit: 10 });
    return result.items.some(item => item.key === key);
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
