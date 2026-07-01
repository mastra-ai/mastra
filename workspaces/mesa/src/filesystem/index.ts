import path from 'node:path/posix';

import type {
  CopyOptions,
  FileContent,
  FileEntry,
  FilesystemInfo,
  FileStat,
  ListOptions,
  MastraFilesystemOptions,
  ProviderStatus,
  ReadOptions,
  RemoveOptions,
  WriteOptions,
} from '@mastra/core/workspace';
import {
  DirectoryNotEmptyError,
  DirectoryNotFoundError,
  FileExistsError,
  FileNotFoundError,
  IsDirectoryError,
  MastraFilesystem,
  NotDirectoryError,
  StaleFileError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';
import { Mesa } from '@mesadev/sdk';
import type { Bash, MesaBashOptions, MesaFileSystem, MesaOptions, RepoConfig, TelemetryConfig } from '@mesadev/sdk';

type MesaFsStat = Awaited<ReturnType<MesaFileSystem['stat']>>;
type MesaDirent = Awaited<ReturnType<NonNullable<MesaFileSystem['readdirWithFileTypes']>>>[number];

export interface MesaFilesystemOptions extends MastraFilesystemOptions {
  /** Mesa API key. Falls back to MESA_API_KEY when omitted. */
  apiKey?: string;
  /** Block all write operations through the Mastra filesystem interface. */
  readOnly?: boolean;
  /** Mesa org slug. Falls back to Mesa SDK org inference when omitted. */
  org?: string;
  /** Mesa repos to mount. */
  repos: RepoConfig[];
  /** Mesa filesystem cache configuration. */
  cache?: {
    diskCache?: {
      path: string;
      maxSizeBytes?: number;
    };
  };
  /** Mesa mount token lifetime in seconds. */
  ttl?: number;
  /** Mesa filesystem telemetry configuration. */
  telemetry?: TelemetryConfig;
  /** Custom fetch implementation for Mesa API calls. */
  fetch?: MesaOptions['fetch'];
  /** User agent for Mesa API calls. */
  userAgent?: string;
}

function generateId(): string {
  return `mesa-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePath(inputPath: string): string {
  return path.normalize(inputPath.startsWith('/') ? inputPath : `/${inputPath}`);
}

function getExtension(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot === -1 ? '' : name.slice(dot);
}

function matchesExtension(name: string, extensions?: string[]): boolean {
  if (!extensions) return true;
  const ext = getExtension(name);
  return extensions.some(candidate => candidate === ext || candidate === ext.slice(1));
}

function toMesaContent(content: FileContent): string | Uint8Array {
  if (typeof content === 'string') return content;
  if (Buffer.isBuffer(content)) return new Uint8Array(content);
  return content;
}

type MesaErrorKind = 'notFound' | 'alreadyExists' | 'notDirectory' | 'isDirectory' | 'directoryNotEmpty';

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

function getMesaErrorKind(error: unknown): MesaErrorKind | undefined {
  const err =
    error && typeof error === 'object' ? (error as { code?: unknown; name?: unknown; message?: unknown }) : undefined;
  const code = typeof err?.code === 'string' ? err.code : undefined;
  const name = typeof err?.name === 'string' ? err.name : undefined;

  for (const value of [code, name]) {
    switch (value) {
      case 'ENOENT':
      case 'NotFound':
      case 'NoSuchFile':
      case 'NoSuchKey':
        return 'notFound';
      case 'EEXIST':
      case 'AlreadyExists':
        return 'alreadyExists';
      case 'ENOTDIR':
      case 'NotDirectory':
        return 'notDirectory';
      case 'EISDIR':
      case 'IsDirectory':
        return 'isDirectory';
      case 'ENOTEMPTY':
      case 'DirectoryNotEmpty':
        return 'directoryNotEmpty';
    }
  }

  const message =
    typeof err?.message === 'string' ? err.message : error instanceof Error ? error.message : String(error);
  if (/\b(no such file|not found|enoent)\b/i.test(message)) return 'notFound';
  if (/\b(already exists|eexist)\b/i.test(message)) return 'alreadyExists';
  if (/\b(not a directory|enotdir)\b/i.test(message)) return 'notDirectory';
  if (/\b(is a directory|eisdir)\b/i.test(message)) return 'isDirectory';
  if (/\b(directory not empty|enotempty)\b/i.test(message)) return 'directoryNotEmpty';

  return undefined;
}

function mapMesaError(error: unknown, inputPath: string, context: 'file' | 'directory' = 'file'): Error {
  switch (getMesaErrorKind(error)) {
    case 'notFound':
      return context === 'directory' ? new DirectoryNotFoundError(inputPath) : new FileNotFoundError(inputPath);
    case 'alreadyExists':
      return new FileExistsError(inputPath);
    case 'notDirectory':
      return new NotDirectoryError(inputPath);
    case 'isDirectory':
      return new IsDirectoryError(inputPath);
    case 'directoryNotEmpty':
      return new DirectoryNotEmptyError(inputPath);
    default:
      return toError(error);
  }
}

/**
 * Workspace filesystem adapter backed by Mesa.
 *
 * This provider runs in the Mastra process and implements the workspace file
 * API against Mesa repos. It does not mount Mesa into a sandbox.
 */
export class MesaFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'MesaFilesystem';
  readonly provider = 'mesa';
  readonly readOnly?: boolean;
  readonly icon = 'mesa';
  readonly displayName = 'Mesa';
  readonly description = 'Versioned Mesa filesystem for workspace files';

  status: ProviderStatus = 'pending';

  private readonly _apiKey?: string;
  private readonly _org?: string;
  private readonly _repos?: RepoConfig[];
  private readonly _cache?: {
    diskCache?: {
      path: string;
      maxSizeBytes?: number;
    };
  };
  private readonly _ttl?: number;
  private readonly _telemetry?: TelemetryConfig;
  private readonly _fetch?: MesaOptions['fetch'];
  private readonly _userAgent?: string;

  private _mesa?: Mesa;
  private _filesystem?: MesaFileSystem;

  constructor(options: MesaFilesystemOptions) {
    super({ name: 'MesaFilesystem', ...options });

    this.id = generateId();
    this.readOnly = options.readOnly;
    this._org = options.org;
    this._repos = options.repos;
    this._apiKey = options.apiKey;
    this._cache = options.cache;
    this._ttl = options.ttl;
    this._telemetry = options.telemetry;
    this._fetch = options.fetch;
    this._userAgent = options.userAgent;
  }

  /**
   * The active Mesa client, available after initialization when this instance
   * created the client itself.
   */
  get client(): Mesa | undefined {
    return this._mesa;
  }

  /**
   * The active Mesa filesystem. Accessing this before initialization throws.
   */
  get filesystem(): MesaFileSystem {
    if (!this._filesystem) {
      throw new Error('MesaFilesystem is not initialized. Call init() first or perform a filesystem operation.');
    }
    return this._filesystem;
  }

  override async init(): Promise<void> {
    if (!this._repos || this._repos.length === 0) {
      throw new Error('MesaFilesystem requires at least one repo.');
    }

    this._mesa = new Mesa({
      apiKey: this._apiKey,
      org: this._org,
      fetch: this._fetch,
      userAgent: this._userAgent,
    });

    const repos = this.readOnly ? this._repos.map(repo => ({ ...repo, readOnly: true })) : this._repos;
    this._filesystem = await this._mesa.fs.mount({
      repos,
      cache: this._cache,
      ttl: this._ttl,
      telemetry: this._telemetry,
    });
  }

  getInfo(): FilesystemInfo<{
    org?: string;
    repos?: string[];
    mode: 'mounted' | 'client';
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
        ...(this._org && { org: this._org }),
        ...(this._repos && { repos: this._repos.map(repo => repo.name) }),
        mode: 'client',
      },
    };
  }

  getInstructions(): string {
    const parts = ['Mesa filesystem. Paths are rooted at the Mesa mount. Include the org and repo name in paths.'];

    if (this._org) {
      parts.push(`Org: "${this._org}".`);
    } else {
      parts.push('Use the Mesa org resolved by the SDK as the first path segment.');
    }

    if (this._repos && this._repos.length > 0) {
      const repoNames = this._repos.map(repo => `"${repo.name}"`).join(', ');
      const firstRepo = this._repos[0]?.name ?? 'repo';
      const orgSegment = this._org ?? 'org';
      parts.push(`Mounted repos: ${repoNames}. For example "/${orgSegment}/${firstRepo}/file.txt".`);
    }

    parts.push('Files are versioned by Mesa.');

    if (this.readOnly) {
      parts.push('Mounted read-only.');
    }

    return parts.join(' ');
  }

  async readFile(inputPath: string, options?: ReadOptions): Promise<string | Buffer> {
    await this.ensureReady();
    const target = normalizePath(inputPath);

    try {
      const buffer = Buffer.from(await this.filesystem.readFileBuffer(target));
      if (options?.encoding) return buffer.toString(options.encoding);
      return buffer;
    } catch (error) {
      throw mapMesaError(error, inputPath);
    }
  }

  async writeFile(inputPath: string, content: FileContent, options?: WriteOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('writeFile');
    const target = normalizePath(inputPath);

    if (options?.overwrite === false && (await this.exists(target))) {
      throw new FileExistsError(inputPath);
    }

    if (options?.expectedMtime) {
      await this.assertExpectedMtime(inputPath, options.expectedMtime);
    }

    if (options?.recursive === false) {
      await this.assertParentDirectoryExists(target);
    } else {
      await this.ensureParentDirectory(target);
    }

    try {
      await this.filesystem.writeFile(target, toMesaContent(content));
    } catch (error) {
      const mapped = mapMesaError(error, inputPath);
      if (mapped instanceof NotDirectoryError) throw new NotDirectoryError(path.dirname(target));
      if (mapped instanceof FileNotFoundError) throw new DirectoryNotFoundError(path.dirname(target));
      throw mapped;
    }
  }

  async appendFile(inputPath: string, content: FileContent): Promise<void> {
    await this.ensureReady();
    this.assertWritable('appendFile');
    const target = normalizePath(inputPath);

    await this.ensureParentDirectory(target);

    try {
      await this.filesystem.appendFile(target, toMesaContent(content));
    } catch (error) {
      const mapped = mapMesaError(error, inputPath);
      if (mapped instanceof FileNotFoundError) throw new DirectoryNotFoundError(path.dirname(target));
      throw mapped;
    }
  }

  async deleteFile(inputPath: string, options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('deleteFile');
    const target = normalizePath(inputPath);

    try {
      const stats = await this.filesystem.stat(target);
      if (stats.isDirectory) throw new IsDirectoryError(inputPath);
      await this.filesystem.rm(target, { force: options?.force });
    } catch (error) {
      if (error instanceof IsDirectoryError) throw error;
      const mapped = mapMesaError(error, inputPath);
      if (mapped instanceof FileNotFoundError) {
        if (options?.force) return;
        throw mapped;
      }
      throw mapped;
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('copyFile');
    const source = normalizePath(src);
    const target = normalizePath(dest);

    if (options?.overwrite === false && (await this.exists(target))) {
      throw new FileExistsError(dest);
    }

    await this.ensureParentDirectory(target);

    try {
      await this.filesystem.cp(source, target, { recursive: options?.recursive });
    } catch (error) {
      const mapped = mapMesaError(error, src);
      if (mapped instanceof FileExistsError) throw new FileExistsError(dest);
      throw mapped;
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('moveFile');
    const source = normalizePath(src);
    const target = normalizePath(dest);

    if (options?.overwrite === false && (await this.exists(target))) {
      throw new FileExistsError(dest);
    }

    await this.ensureParentDirectory(target);

    try {
      await this.filesystem.mv(source, target);
    } catch (error) {
      const mapped = mapMesaError(error, src);
      if (mapped instanceof FileExistsError) throw new FileExistsError(dest);
      throw mapped;
    }
  }

  async mkdir(inputPath: string, options?: { recursive?: boolean }): Promise<void> {
    await this.ensureReady();
    this.assertWritable('mkdir');
    const target = normalizePath(inputPath);

    try {
      await this.filesystem.mkdir(target, { recursive: options?.recursive ?? true });
    } catch (error) {
      const mapped = mapMesaError(error, inputPath);
      if (mapped instanceof FileNotFoundError) throw new DirectoryNotFoundError(path.dirname(target));
      throw mapped;
    }
  }

  async rmdir(inputPath: string, options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('rmdir');
    const target = normalizePath(inputPath);

    try {
      const stats = await this.filesystem.stat(target);
      if (!stats.isDirectory) throw new NotDirectoryError(inputPath);

      if (!options?.recursive) {
        const entries = await this.filesystem.readdirWithFileTypes(target);
        if (entries.length > 0) throw new DirectoryNotEmptyError(inputPath);
      }

      await this.filesystem.rm(target, { recursive: options?.recursive ?? true, force: options?.force });
    } catch (error) {
      if (error instanceof NotDirectoryError) throw error;
      if (error instanceof DirectoryNotEmptyError) throw error;
      const mapped = mapMesaError(error, inputPath, 'directory');
      if (mapped instanceof DirectoryNotFoundError) {
        if (options?.force) return;
        throw mapped;
      }
      throw mapped;
    }
  }

  async readdir(inputPath: string, options?: ListOptions): Promise<FileEntry[]> {
    await this.ensureReady();
    const target = normalizePath(inputPath);

    try {
      return await this.readDirectory(target, options);
    } catch (error) {
      throw mapMesaError(error, inputPath, 'directory');
    }
  }

  async exists(inputPath: string): Promise<boolean> {
    await this.ensureReady();
    const target = normalizePath(inputPath);

    try {
      return await this.filesystem.exists(target);
    } catch (error) {
      if (getMesaErrorKind(error) === 'notFound') return false;
      throw mapMesaError(error, inputPath);
    }
  }

  async stat(inputPath: string): Promise<FileStat> {
    await this.ensureReady();
    const target = normalizePath(inputPath);

    try {
      const stats = await this.filesystem.stat(target);
      return this.toFileStat(target, stats);
    } catch (error) {
      throw mapMesaError(error, inputPath);
    }
  }

  async realpath(inputPath: string): Promise<string> {
    await this.ensureReady();
    try {
      return await this.filesystem.realpath(normalizePath(inputPath));
    } catch (error) {
      throw mapMesaError(error, inputPath);
    }
  }

  /**
   * Create a Mesa-backed Bash runtime for this filesystem.
   */
  async bash(options?: MesaBashOptions): Promise<Bash> {
    await this.ensureReady();
    return this.filesystem.bash(options);
  }

  /**
   * Mesa change management operations for the mounted filesystem.
   */
  get change(): MesaFileSystem['change'] {
    return this.filesystem.change;
  }

  /**
   * Mesa bookmark management operations for the mounted filesystem.
   */
  get bookmark(): MesaFileSystem['bookmark'] {
    return this.filesystem.bookmark;
  }

  private assertWritable(operation: string): void {
    if (this.readOnly) {
      throw new WorkspaceReadOnlyError(operation);
    }
  }

  private async assertExpectedMtime(inputPath: string, expectedMtime: Date): Promise<void> {
    try {
      const currentStat = await this.stat(inputPath);
      if (currentStat.modifiedAt.getTime() !== expectedMtime.getTime()) {
        throw new StaleFileError(inputPath, expectedMtime, currentStat.modifiedAt);
      }
    } catch (error) {
      if (error instanceof StaleFileError) throw error;
      if (error instanceof FileNotFoundError) return;
      throw error;
    }
  }

  private async ensureParentDirectory(inputPath: string): Promise<void> {
    const parent = path.dirname(inputPath);
    if (parent === '/' || parent === inputPath) return;

    try {
      await this.filesystem.mkdir(parent, { recursive: true });
    } catch (error) {
      const mapped = mapMesaError(error, parent, 'directory');
      if (!(mapped instanceof FileExistsError)) throw mapped;
    }
  }

  private async assertParentDirectoryExists(inputPath: string): Promise<void> {
    const parent = path.dirname(inputPath);
    if (parent === '/' || parent === inputPath) return;

    try {
      const stats = await this.filesystem.stat(parent);
      if (!stats.isDirectory) {
        throw new NotDirectoryError(parent);
      }
    } catch (error) {
      if (error instanceof NotDirectoryError) throw error;
      throw mapMesaError(error, parent, 'directory');
    }
  }

  private async readDirectory(inputPath: string, options?: ListOptions, depth = 0): Promise<FileEntry[]> {
    const entries = await this.filesystem.readdirWithFileTypes(inputPath);
    const extensions = options?.extension
      ? Array.isArray(options.extension)
        ? options.extension
        : [options.extension]
      : undefined;

    const result: FileEntry[] = [];
    for (const entry of entries) {
      const childPath = path.join(inputPath, entry.name);
      if (entry.isFile) {
        if (matchesExtension(entry.name, extensions)) {
          const stat = await this.safeStat(childPath);
          result.push({ name: entry.name, type: 'file', size: stat?.size });
        }
        continue;
      }

      if (entry.isDirectory) {
        result.push({ name: entry.name, type: 'directory' });

        if (options?.recursive && (options.maxDepth === undefined || depth < options.maxDepth)) {
          const childEntries = await this.readDirectory(childPath, options, depth + 1);
          result.push(...childEntries.map(child => ({ ...child, name: `${entry.name}/${child.name}` })));
        }
        continue;
      }

      result.push(this.toFileEntry(entry));
    }

    return result;
  }

  private async safeStat(inputPath: string): Promise<MesaFsStat | undefined> {
    try {
      return await this.filesystem.stat(inputPath);
    } catch {
      return undefined;
    }
  }

  private toFileEntry(entry: MesaDirent): FileEntry {
    return {
      name: entry.name,
      type: entry.isDirectory ? 'directory' : 'file',
      isSymlink: entry.isSymbolicLink || undefined,
    };
  }

  private toFileStat(inputPath: string, stats: MesaFsStat): FileStat {
    const target = normalizePath(inputPath);

    return {
      name: target === '/' ? '/' : path.basename(target),
      path: target,
      type: stats.isDirectory ? 'directory' : 'file',
      size: stats.isDirectory ? 0 : stats.size,
      createdAt: stats.mtime,
      modifiedAt: stats.mtime,
    };
  }
}
