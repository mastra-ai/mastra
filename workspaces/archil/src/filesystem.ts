/**
 * Archil Filesystem Provider
 *
 * A filesystem implementation backed by Archil — elastic, serverless
 * filesystems for AI agents. Uses the `disk` SDK's S3-compatible object
 * API for fast reads/writes and `exec` for POSIX operations.
 */

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
  FilesystemIcon,
  ProviderStatus,
  MastraFilesystemOptions,
} from '@mastra/core/workspace';
import { MastraFilesystem, FileNotFoundError, FileExistsError } from '@mastra/core/workspace';
import { Archil } from 'disk';
import type {
  Disk,
  CreateDiskRequest,
  ExecResult,
  GrepOptions,
  GrepResult,
  ArchilOptions,
  ListObjectsOptions,
  ListObjectsResult,
  ObjectMetadata,
  ShareUrlOptions,
  ShareUrlResult,
} from 'disk';

// =============================================================================
// Configuration
// =============================================================================

export interface ArchilFilesystemOptions extends MastraFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;

  /** Human-friendly display name for the UI */
  displayName?: string;

  /** Icon identifier for the UI (defaults to 'cloud') */
  icon?: FilesystemIcon;

  /** Description shown in tooltips */
  description?: string;

  /** Mount as read-only (blocks write operations) */
  readOnly?: boolean;

  /**
   * Existing disk ID to attach to (e.g. "dsk-0123456789abcdef").
   * Mutually exclusive with `createDiskOptions`.
   */
  diskId?: string;

  /**
   * Options for creating a new disk on init.
   * Mutually exclusive with `diskId`.
   */
  createDiskOptions?: CreateDiskRequest;

  /**
   * Archil API key. Falls back to ARCHIL_API_KEY env var.
   */
  apiKey?: string;

  /**
   * Archil region (e.g. "aws-us-east-1"). Falls back to ARCHIL_REGION env var.
   */
  region?: string;

  /**
   * Override the Archil control-plane base URL (for testing/self-hosted).
   */
  baseUrl?: string;

  /**
   * Override the S3-compatible API base URL.
   * Falls back to ARCHIL_S3_BASE_URL env var.
   */
  s3BaseUrl?: string;
}

// =============================================================================
// MIME type detection
// =============================================================================

const MIME_TYPES: Record<string, string> = {
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.html': 'text/html',
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
  '.sh': 'text/x-shellscript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.pdf': 'application/pdf',
  '.zip': 'application/zip',
  '.gz': 'application/gzip',
  '.tar': 'application/x-tar',
};

function getMimeType(path: string): string {
  const ext = path.toLowerCase().match(/\.[^.]+$/)?.[0];
  return ext ? (MIME_TYPES[ext] ?? 'application/octet-stream') : 'application/octet-stream';
}

/** Trim leading and trailing slashes. */
function trimSlashes(s: string): string {
  let start = 0;
  let end = s.length;
  while (start < end && s[start] === '/') start++;
  while (end > start && s[end - 1] === '/') end--;
  return s.slice(start, end);
}

/** Normalize a workspace path to a key (no leading slash). */
function toKey(path: string): string {
  return trimSlashes(path) || '';
}

/** Get the basename from a path. */
function basename(path: string): string {
  const key = toKey(path);
  const idx = key.lastIndexOf('/');
  return idx === -1 ? key : key.slice(idx + 1);
}

/** Get the parent directory key (empty = root). */
function dirname(path: string): string {
  const key = toKey(path);
  const idx = key.lastIndexOf('/');
  return idx === -1 ? '' : key.slice(0, idx);
}

/** Shell-escape a string for use in exec commands. */
function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

// =============================================================================
// Implementation
// =============================================================================

export class ArchilFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'ArchilFilesystem';
  readonly provider = 'archil';
  readonly readOnly?: boolean;

  readonly displayName?: string;
  readonly icon: FilesystemIcon;
  readonly description?: string;

  status: ProviderStatus = 'pending';

  private _disk: Disk | null = null;
  private _archil: Archil | null = null;
  private readonly _diskId?: string;
  private readonly _createDiskOptions?: CreateDiskRequest;
  private readonly _archilOptions: ArchilOptions;

  constructor(options: ArchilFilesystemOptions) {
    super({ ...options, name: 'ArchilFilesystem' });

    this.id = options.id ?? `archil-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this.readOnly = options.readOnly;
    this.displayName = options.displayName ?? 'Archil';
    this.icon = options.icon ?? 'cloud';
    this.description = options.description ?? 'Elastic serverless filesystem powered by Archil';
    this._diskId = options.diskId;
    this._createDiskOptions = options.createDiskOptions;

    this._archilOptions = {
      apiKey: options.apiKey,
      region: options.region,
      baseUrl: options.baseUrl,
      s3BaseUrl: options.s3BaseUrl,
    };
  }

  // ---------------------------------------------------------------------------
  // Public accessors
  // ---------------------------------------------------------------------------

  /** The underlying Archil Disk instance (available after init). */
  get disk(): Disk {
    if (!this._disk) {
      throw new Error('ArchilFilesystem not initialized — call init() first');
    }
    return this._disk;
  }

  /** The Archil SDK client instance. */
  get archil(): Archil {
    if (!this._archil) {
      this._archil = new Archil(this._archilOptions);
    }
    return this._archil;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    try {
      if (this._diskId) {
        this._disk = await this.archil.disks.get(this._diskId);
      } else if (this._createDiskOptions) {
        const result = await this.archil.disks.create(this._createDiskOptions);
        this._disk = result.disk;
      } else {
        throw new Error('Either diskId or createDiskOptions must be provided');
      }
      this.status = 'ready';
    } catch (err) {
      this.status = 'error';
      this.error = err instanceof Error ? err.message : String(err);
      throw err;
    }
  }

  async destroy(): Promise<void> {
    this._disk = null;
    this._archil = null;
  }

  isReady(): boolean {
    return this.status === 'ready' && this._disk !== null;
  }

  getInfo(): FilesystemInfo<{ diskId: string; region: string; diskName: string }> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      error: this.error,
      readOnly: this.readOnly,
      icon: this.icon,
      metadata: {
        diskId: this._disk?.id ?? '',
        region: this._disk?.region ?? '',
        diskName: this._disk?.name ?? '',
      },
    };
  }

  getInstructions(): string {
    const access = this.readOnly ? 'Read-only' : 'Persistent';
    const diskName = this._disk?.name ?? 'Archil disk';
    return `Archil elastic filesystem "${diskName}". ${access} storage — files persist across sessions. Supports serverless execution via exec().`;
  }

  // ---------------------------------------------------------------------------
  // Archil-specific operations
  // ---------------------------------------------------------------------------

  /**
   * Execute a shell command on the disk's filesystem.
   * The disk is mounted as the working directory.
   */
  async exec(command: string): Promise<ExecResult> {
    await this.ensureReady();
    return this.disk.exec(command);
  }

  /**
   * Parallel grep across files on the disk.
   */
  async grep(opts: GrepOptions): Promise<GrepResult> {
    await this.ensureReady();
    return this.disk.grep(opts);
  }

  /**
   * Create a signed, time-limited download URL for a file.
   */
  async share(key: string, opts?: ShareUrlOptions): Promise<ShareUrlResult> {
    await this.ensureReady();
    return this.disk.share(key, opts);
  }

  /**
   * List objects using the S3-compatible API directly.
   */
  async listObjects(prefix?: string, opts?: ListObjectsOptions): Promise<ListObjectsResult> {
    await this.ensureReady();
    return this.disk.listObjects(prefix, opts);
  }

  /**
   * Get object metadata without downloading.
   */
  async headObject(key: string): Promise<ObjectMetadata | null> {
    await this.ensureReady();
    return this.disk.headObject(key);
  }

  // ---------------------------------------------------------------------------
  // File Operations (WorkspaceFilesystem interface)
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    await this.ensureReady();
    const key = toKey(path);
    if (!key) {
      throw new Error('Cannot read file at root path');
    }

    try {
      const data = await this.disk.getObject(key);
      if (options?.encoding) {
        return Buffer.from(data).toString(options.encoding);
      }
      return Buffer.from(data);
    } catch (err: unknown) {
      if (isNotFound(err)) {
        throw new FileNotFoundError(path);
      }
      throw err;
    }
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable();

    const key = toKey(path);
    if (!key) {
      throw new Error('Cannot write file at root path');
    }

    if (options?.overwrite === false) {
      const exists = await this.disk.objectExists(key);
      if (exists) {
        throw new FileExistsError(path);
      }
    }

    if (options?.recursive) {
      const dir = dirname(path);
      if (dir) {
        await this.disk.exec(`mkdir -p ${shellEscape(dir)}`);
      }
    }

    const body = typeof content === 'string' ? content : content instanceof Uint8Array ? content : new Uint8Array(content);
    const mimeType = options?.mimeType ?? getMimeType(path);
    await this.disk.putObject(key, body, mimeType);
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    await this.ensureReady();
    this.assertWritable();

    const key = toKey(path);
    if (!key) {
      throw new Error('Cannot append to root path');
    }

    // Use exec to append since S3 API doesn't support append
    const data = typeof content === 'string' ? content : Buffer.from(content).toString('base64');
    if (typeof content === 'string') {
      await this.disk.exec(`printf '%s' ${shellEscape(data)} >> ${shellEscape(key)}`);
    } else {
      await this.disk.exec(`printf '%s' ${shellEscape(data)} | base64 -d >> ${shellEscape(key)}`);
    }
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable();

    const key = toKey(path);
    if (!key) {
      throw new Error('Cannot delete root path');
    }

    if (!options?.force) {
      const exists = await this.disk.objectExists(key);
      if (!exists) {
        throw new FileNotFoundError(path);
      }
    }

    await this.disk.deleteObject(key);
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable();

    const srcKey = toKey(src);
    const destKey = toKey(dest);

    if (!options?.overwrite) {
      const exists = await this.disk.objectExists(destKey);
      if (exists) {
        throw new FileExistsError(dest);
      }
    }

    const flags = options?.recursive ? '-r' : '';
    const result = await this.disk.exec(`cp ${flags} ${shellEscape(srcKey)} ${shellEscape(destKey)}`);
    if (result.exitCode !== 0) {
      if (result.stderr.includes('No such file')) {
        throw new FileNotFoundError(src);
      }
      throw new Error(`cp failed: ${result.stderr}`);
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable();

    const srcKey = toKey(src);
    const destKey = toKey(dest);

    if (!options?.overwrite) {
      const exists = await this.disk.objectExists(destKey);
      if (exists) {
        throw new FileExistsError(dest);
      }
    }

    const result = await this.disk.exec(`mv ${shellEscape(srcKey)} ${shellEscape(destKey)}`);
    if (result.exitCode !== 0) {
      if (result.stderr.includes('No such file')) {
        throw new FileNotFoundError(src);
      }
      throw new Error(`mv failed: ${result.stderr}`);
    }
  }

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.ensureReady();
    this.assertWritable();

    const key = toKey(path);
    if (!key) return; // root always exists

    const flag = options?.recursive ? '-p' : '';
    const result = await this.disk.exec(`mkdir ${flag} ${shellEscape(key)}`);
    if (result.exitCode !== 0) {
      if (result.stderr.includes('File exists')) {
        throw new FileExistsError(path);
      }
      throw new Error(`mkdir failed: ${result.stderr}`);
    }
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable();

    const key = toKey(path);
    if (!key) {
      throw new Error('Cannot remove root directory');
    }

    const cmd = options?.recursive ? `rm -rf ${shellEscape(key)}` : `rmdir ${shellEscape(key)}`;
    const result = await this.disk.exec(options?.force ? `${cmd} 2>/dev/null; true` : cmd);
    if (result.exitCode !== 0 && !options?.force) {
      if (result.stderr.includes('No such file') || result.stderr.includes('not found')) {
        throw new FileNotFoundError(path);
      }
      throw new Error(`rmdir failed: ${result.stderr}`);
    }
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    await this.ensureReady();

    const key = toKey(path);
    const prefix = key ? key + '/' : '';

    if (options?.recursive) {
      return this.readdirRecursive(prefix, options);
    }

    // Use listObjects for efficient non-recursive listing
    const result = await this.disk.listObjects(prefix, { recursive: false });

    const entries: FileEntry[] = [];

    // Files (objects at this level)
    for (const obj of result.objects) {
      const name = obj.key.slice(prefix.length);
      if (!name || name.includes('/')) continue; // skip nested or empty

      if (options?.extension) {
        const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
        const ext = name.match(/\.[^.]+$/)?.[0] ?? '';
        if (!extensions.includes(ext)) continue;
      }

      entries.push({
        name,
        type: 'file',
        size: obj.size,
      });
    }

    // Directories (common prefixes)
    for (const cp of result.commonPrefixes) {
      const name = trimSlashes(cp.slice(prefix.length));
      if (!name) continue;
      entries.push({
        name,
        type: 'directory',
      });
    }

    return entries;
  }

  private async readdirRecursive(prefix: string, options?: ListOptions): Promise<FileEntry[]> {
    const result = await this.disk.listObjects(prefix, { recursive: true });
    const entries: FileEntry[] = [];

    for (const obj of result.objects) {
      const relativePath = obj.key.slice(prefix.length);
      if (!relativePath) continue;

      if (options?.maxDepth !== undefined) {
        const depth = relativePath.split('/').length - 1;
        if (depth > options.maxDepth) continue;
      }

      if (options?.extension) {
        const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
        const ext = relativePath.match(/\.[^.]+$/)?.[0] ?? '';
        if (!extensions.includes(ext)) continue;
      }

      entries.push({
        name: relativePath,
        type: 'file',
        size: obj.size,
      });
    }

    return entries;
  }

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    await this.ensureReady();
    const key = toKey(path);
    if (!key) return true; // root always exists

    // Check as file first (faster)
    const fileExists = await this.disk.objectExists(key);
    if (fileExists) return true;

    // Check as directory (list with prefix)
    const result = await this.disk.listObjects(key + '/', { singlePage: true, limit: 1 });
    return result.objects.length > 0 || result.commonPrefixes.length > 0;
  }

  async stat(path: string): Promise<FileStat> {
    await this.ensureReady();
    const key = toKey(path);

    if (!key) {
      // Root directory
      return {
        name: '',
        path: '/',
        type: 'directory',
        size: 0,
        createdAt: new Date(0),
        modifiedAt: new Date(0),
      };
    }

    // Try as file first
    const meta = await this.disk.headObject(key);
    if (meta) {
      return {
        name: basename(path),
        path: '/' + key,
        type: 'file',
        size: meta.size,
        createdAt: meta.lastModified ?? new Date(0),
        modifiedAt: meta.lastModified ?? new Date(0),
        mimeType: meta.contentType,
      };
    }

    // Try as directory
    const result = await this.disk.listObjects(key + '/', { singlePage: true, limit: 1 });
    if (result.objects.length > 0 || result.commonPrefixes.length > 0) {
      return {
        name: basename(path),
        path: '/' + key,
        type: 'directory',
        size: 0,
        createdAt: new Date(0),
        modifiedAt: new Date(0),
      };
    }

    throw new FileNotFoundError(path);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private assertWritable(): void {
    if (this.readOnly) {
      throw new Error('Filesystem is read-only');
    }
  }
}

function isNotFound(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { status?: number; code?: string };
  return e.status === 404 || e.code === 'NoSuchKey';
}
