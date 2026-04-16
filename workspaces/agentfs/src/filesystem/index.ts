/**
 * AgentFS Filesystem Provider
 *
 * Implements WorkspaceFilesystem backed by AgentFS (Turso/SQLite).
 * Follows the same pattern as S3Filesystem.
 */

import { mkdirSync } from 'node:fs';
import os from 'node:os';
import nodePath from 'node:path';
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
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotFoundError,
  DirectoryNotEmptyError,
  PermissionError,
  WorkspaceReadOnlyError,
} from '@mastra/core/workspace';
import { AgentFS } from 'agentfs-sdk';

// ---------------------------------------------------------------------------
// Database path resolution
// ---------------------------------------------------------------------------

/**
 * Expand a leading `~` to the user's home directory.
 * Node.js path APIs don't handle tilde — only the shell does.
 */
function expandTilde(p: string): string {
  if (p === '~') return os.homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return nodePath.join(os.homedir(), p.slice(2));
  }
  return p;
}

/**
 * Resolve a database path to an absolute path.
 * Expands tilde and resolves relative paths against cwd (at construction time).
 */
function resolveDbPath(p: string): string {
  return nodePath.resolve(expandTilde(p));
}

// ---------------------------------------------------------------------------
// Path utilities (POSIX-style with leading slash)
// ---------------------------------------------------------------------------

function normalizePath(input: string): string {
  // Treat "." and "" as root — consistent with how CompositeFilesystem
  // and the Studio UI use "." to mean "filesystem root".
  if (input === '' || input === '.') return '/';

  let path = input.startsWith('/') ? input : '/' + input;

  let result = '';
  let prevSlash = false;
  for (let i = 0; i < path.length; i++) {
    const ch = path[i];
    if (ch === '/') {
      if (!prevSlash) {
        result += ch;
      }
      prevSlash = true;
    } else {
      result += ch;
      prevSlash = false;
    }
  }

  if (result.length > 1 && result.endsWith('/')) {
    result = result.slice(0, -1);
  }

  return result;
}

function getParentPath(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '/';
  const lastSlash = normalized.lastIndexOf('/');
  return lastSlash <= 0 ? '/' : normalized.slice(0, lastSlash);
}

function joinPath(base: string, name: string): string {
  if (base === '/') return normalizePath('/' + name);
  return normalizePath(base + '/' + name);
}

function getBaseName(path: string): string {
  const normalized = normalizePath(path);
  if (normalized === '/') return '';
  const lastSlash = normalized.lastIndexOf('/');
  return normalized.slice(lastSlash + 1);
}

// ---------------------------------------------------------------------------
// Error mapping (AgentFS errno → Mastra workspace errors)
// ---------------------------------------------------------------------------

interface ErrnoError {
  code?: string;
  message?: string;
}

function isErrnoError(error: unknown): error is ErrnoError {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function mapError(error: unknown, path: string, context: 'file' | 'directory' = 'file'): Error {
  if (!isErrnoError(error)) {
    return error instanceof Error ? error : new Error(String(error));
  }

  switch (error.code) {
    case 'ENOENT':
      return context === 'directory' ? new DirectoryNotFoundError(path) : new FileNotFoundError(path);
    case 'EEXIST':
      return new FileExistsError(path);
    case 'EISDIR':
      return new IsDirectoryError(path);
    case 'ENOTDIR':
      return new NotDirectoryError(path);
    case 'ENOTEMPTY':
      return new DirectoryNotEmptyError(path);
    case 'EPERM':
    case 'EACCES':
      return new PermissionError(path, 'access');
    default:
      return error instanceof Error ? error : new Error(String(error));
  }
}

function hasCode(error: unknown, code: string): boolean {
  return isErrnoError(error) && error.code === code;
}

// ---------------------------------------------------------------------------
// AgentFS Filesystem
// ---------------------------------------------------------------------------

/**
 * AgentFS filesystem provider configuration.
 */
export interface AgentFSFilesystemOptions extends MastraFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** Agent ID — creates database at `.agentfs/<agentId>.db` */
  agentId?: string;
  /** Explicit database file path */
  path?: string;
  /** Pre-opened AgentFS instance (skips open/close — caller manages lifecycle) */
  agent?: AgentFS;
  /** Block write operations (default: false) */
  readOnly?: boolean;
  /** Human-friendly display name for the UI */
  displayName?: string;
  /** Icon identifier for the UI (default: 'database') */
  icon?: FilesystemIcon;
  /** Description shown in tooltips */
  description?: string;
}

/**
 * AgentFS filesystem implementation.
 *
 * Stores files in a Turso/SQLite database via the AgentFS SDK.
 *
 * @example Using agentId
 * ```typescript
 * import { AgentFSFilesystem } from '@mastra/agentfs';
 *
 * const fs = new AgentFSFilesystem({ agentId: 'my-agent' });
 * ```
 *
 * @example Using a pre-opened instance
 * ```typescript
 * import { AgentFS } from 'agentfs-sdk';
 * import { AgentFSFilesystem } from '@mastra/agentfs';
 *
 * const agent = await AgentFS.open({ id: 'my-agent' });
 * const fs = new AgentFSFilesystem({ agent });
 * ```
 */
export class AgentFSFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'AgentFSFilesystem';
  readonly provider = 'agentfs';
  readonly readOnly?: boolean;

  status: ProviderStatus = 'pending';

  // Display metadata
  readonly displayName?: string;
  readonly icon: FilesystemIcon;
  readonly description?: string;

  private _agent: AgentFS | null = null;
  private readonly _ownsAgent: boolean;
  private readonly _agentId?: string;
  private readonly _path?: string;

  constructor(options: AgentFSFilesystemOptions) {
    if (!options.agentId && !options.path && !options.agent) {
      throw new Error("AgentFSFilesystem requires at least one of 'agentId', 'path', or 'agent'.");
    }

    super({ ...options, name: 'AgentFSFilesystem' });
    this.id = options.id ?? `agentfs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this._agentId = options.agentId;
    this._path = options.path ? resolveDbPath(options.path) : undefined;
    this.readOnly = options.readOnly;

    if (options.agent) {
      this._agent = options.agent;
      this._ownsAgent = false;
    } else {
      this._ownsAgent = true;
    }

    this.icon = options.icon ?? 'database';
    this.displayName = options.displayName ?? 'AgentFS';
    this.description = options.description;
  }

  /** The underlying AgentFS instance, or null if not yet initialized. */
  get agent(): AgentFS | null {
    return this._agent;
  }

  // ---------------------------------------------------------------------------
  // Info
  // ---------------------------------------------------------------------------

  getInfo(): FilesystemInfo<{
    agentId?: string;
    dbPath?: string;
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
        ...(this._agentId && { agentId: this._agentId }),
        ...(this._path && { dbPath: this._path }),
      },
    };
  }

  getInstructions(): string {
    const label = this._agentId ? `agent "${this._agentId}"` : 'database';
    const access = this.readOnly ? 'Read-only' : 'Persistent';
    return `AgentFS storage for ${label}. ${access} SQLite-backed filesystem — files are retained across sessions.`;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    if (this._agent) return; // Pre-opened instance

    const openOptions: { id?: string; path?: string } = {};
    if (this._agentId) openOptions.id = this._agentId;
    if (this._path) {
      openOptions.path = this._path;
      // Ensure parent directory exists — the SDK only auto-creates `.agentfs/`
      // for the agentId-only case, not for explicit paths.
      mkdirSync(nodePath.dirname(this._path), { recursive: true });
    }

    this._agent = await AgentFS.open(openOptions);
  }

  async destroy(): Promise<void> {
    if (this._agent && this._ownsAgent) {
      await this._agent.close();
    }
    this._agent = null;
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  private async getAgent(): Promise<AgentFS> {
    await this.ensureReady();
    return this._agent!;
  }

  private assertWritable(operation: string): void {
    if (this.readOnly) {
      throw new WorkspaceReadOnlyError(operation);
    }
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const agent = await this.getAgent();
    const normalized = normalizePath(path);

    try {
      if (options?.encoding) {
        return await agent.fs.readFile(normalized, options.encoding);
      }
      return await agent.fs.readFile(normalized);
    } catch (error: unknown) {
      throw mapError(error, normalized, 'file');
    }
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    this.assertWritable('writeFile');
    const agent = await this.getAgent();
    const normalized = normalizePath(path);

    // Create parent directories (default behavior)
    if (options?.recursive !== false) {
      await this.mkdirRecursive(agent, getParentPath(normalized));
    }

    // Check overwrite
    if (options?.overwrite === false) {
      try {
        await agent.fs.access(normalized);
        throw new FileExistsError(normalized);
      } catch (error: unknown) {
        if (error instanceof FileExistsError) throw error;
        if (!hasCode(error, 'ENOENT')) throw mapError(error, normalized, 'file');
      }
    }

    try {
      const data = typeof content === 'string' ? content : Buffer.from(content);
      await agent.fs.writeFile(normalized, data);
    } catch (error: unknown) {
      throw mapError(error, normalized, 'file');
    }
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    this.assertWritable('appendFile');
    // AgentFS doesn't have native append — read + write (same pattern as S3Filesystem)
    let existing: Buffer = Buffer.alloc(0);
    try {
      const current = await this.readFile(path);
      existing = Buffer.isBuffer(current) ? Buffer.from(current) : Buffer.from(current);
    } catch (error) {
      if (error instanceof FileNotFoundError) {
        // File doesn't exist — start fresh
      } else {
        throw error;
      }
    }

    const appendBuffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : Buffer.from(content);
    await this.writeFile(path, Buffer.concat([existing, appendBuffer]));
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    this.assertWritable('deleteFile');
    const agent = await this.getAgent();
    const normalized = normalizePath(path);

    // Check if it's a directory
    try {
      const st = await agent.fs.stat(normalized);
      if (st.isDirectory()) {
        throw new IsDirectoryError(normalized);
      }
    } catch (error: unknown) {
      if (error instanceof IsDirectoryError) throw error;
      if (hasCode(error, 'ENOENT')) {
        if (options?.force) return;
        throw new FileNotFoundError(normalized);
      }
      throw mapError(error, normalized, 'file');
    }

    try {
      await agent.fs.unlink(normalized);
    } catch (error: unknown) {
      if (options?.force && hasCode(error, 'ENOENT')) return;
      throw mapError(error, normalized, 'file');
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.assertWritable('copyFile');
    const agent = await this.getAgent();
    const normalizedSrc = normalizePath(src);
    const normalizedDest = normalizePath(dest);

    if (options?.overwrite === false) {
      try {
        await agent.fs.access(normalizedDest);
        throw new FileExistsError(normalizedDest);
      } catch (error: unknown) {
        if (error instanceof FileExistsError) throw error;
        if (!hasCode(error, 'ENOENT')) throw mapError(error, normalizedDest, 'file');
      }
    }

    try {
      // Check if source is a directory
      const st = await agent.fs.stat(normalizedSrc);
      if (st.isDirectory()) {
        if (!options?.recursive) {
          throw new IsDirectoryError(normalizedSrc);
        }
        await this.copyDirRecursive(agent, normalizedSrc, normalizedDest, options);
        return;
      }

      // Ensure parent directory of dest exists
      await this.mkdirRecursive(agent, getParentPath(normalizedDest));
      await agent.fs.copyFile(normalizedSrc, normalizedDest);
    } catch (error: unknown) {
      if (error instanceof IsDirectoryError || error instanceof FileExistsError) throw error;
      throw mapError(error, normalizedSrc, 'file');
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.assertWritable('moveFile');
    const agent = await this.getAgent();
    const normalizedSrc = normalizePath(src);
    const normalizedDest = normalizePath(dest);

    if (options?.overwrite === false) {
      try {
        await agent.fs.access(normalizedDest);
        throw new FileExistsError(normalizedDest);
      } catch (error: unknown) {
        if (error instanceof FileExistsError) throw error;
        if (!hasCode(error, 'ENOENT')) throw mapError(error, normalizedDest, 'file');
      }
    }

    // Ensure parent directory of dest exists
    await this.mkdirRecursive(agent, getParentPath(normalizedDest));

    try {
      await agent.fs.rename(normalizedSrc, normalizedDest);
    } catch (error: unknown) {
      throw mapError(error, normalizedSrc, 'file');
    }
  }

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    this.assertWritable('mkdir');
    const agent = await this.getAgent();
    const normalized = normalizePath(path);

    // Default to recursive (matches LocalFilesystem behavior)
    if (options?.recursive !== false) {
      await this.mkdirRecursive(agent, normalized);
      return;
    }

    try {
      await agent.fs.mkdir(normalized);
    } catch (error: unknown) {
      throw mapError(error, normalized, 'directory');
    }
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    this.assertWritable('rmdir');
    const agent = await this.getAgent();
    const normalized = normalizePath(path);

    if (options?.recursive) {
      try {
        await agent.fs.rm(normalized, { recursive: true });
      } catch (error: unknown) {
        if (options?.force && hasCode(error, 'ENOENT')) return;
        throw mapError(error, normalized, 'directory');
      }
      return;
    }

    // Non-recursive: check if empty first
    try {
      const entries = await agent.fs.readdir(normalized);
      if (entries.length > 0) {
        throw new DirectoryNotEmptyError(normalized);
      }
      await agent.fs.rmdir(normalized);
    } catch (error: unknown) {
      if (error instanceof DirectoryNotEmptyError) throw error;
      if (options?.force && hasCode(error, 'ENOENT')) return;
      throw mapError(error, normalized, 'directory');
    }
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const agent = await this.getAgent();
    const normalized = normalizePath(path);

    try {
      // Verify it's a directory
      const st = await agent.fs.stat(normalized);
      if (!st.isDirectory()) {
        throw new NotDirectoryError(normalized);
      }

      const dirEntries = await agent.fs.readdirPlus(normalized);
      let entries: FileEntry[] = dirEntries.map(entry => ({
        name: entry.name,
        type: entry.stats.isDirectory() ? ('directory' as const) : ('file' as const),
        size: entry.stats.size,
      }));

      // Apply extension filter
      if (options?.extension) {
        const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
        entries = entries.filter(entry => {
          if (entry.type === 'directory') return true;
          return extensions.some(ext => entry.name.endsWith(ext));
        });
      }

      // Recurse if requested
      if (options?.recursive) {
        const maxDepth = options.maxDepth ?? Infinity;
        const subdirs = entries.filter(e => e.type === 'directory');
        for (const dir of subdirs) {
          if (maxDepth > 1) {
            const subEntries = await this.readdir(joinPath(normalized, dir.name), {
              ...options,
              maxDepth: maxDepth - 1,
            });
            for (const sub of subEntries) {
              entries.push({
                ...sub,
                name: dir.name + '/' + sub.name,
              });
            }
          }
        }
      }

      return entries;
    } catch (error: unknown) {
      if (error instanceof NotDirectoryError || error instanceof DirectoryNotFoundError) {
        throw error;
      }
      throw mapError(error, normalized, 'directory');
    }
  }

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    const agent = await this.getAgent();
    const normalized = normalizePath(path);

    try {
      await agent.fs.access(normalized);
      return true;
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<FileStat> {
    const agent = await this.getAgent();
    const normalized = normalizePath(path);

    try {
      const st = await agent.fs.stat(normalized);
      return {
        name: getBaseName(normalized) || '',
        path: normalized,
        type: st.isDirectory() ? 'directory' : 'file',
        size: st.size,
        createdAt: new Date(st.ctime * 1000),
        modifiedAt: new Date(st.mtime * 1000),
      };
    } catch (error: unknown) {
      throw mapError(error, normalized, 'file');
    }
  }

  // ---------------------------------------------------------------------------
  // Type checks
  // ---------------------------------------------------------------------------

  /**
   * Check if the path points to a file.
   * Returns `false` if the path doesn't exist.
   */
  async isFile(path: string): Promise<boolean> {
    try {
      const st = await this.stat(path);
      return st.type === 'file';
    } catch (error) {
      if (error instanceof FileNotFoundError) return false;
      throw error;
    }
  }

  /**
   * Check if the path points to a directory.
   * Returns `false` if the path doesn't exist.
   */
  async isDirectory(path: string): Promise<boolean> {
    try {
      const st = await this.stat(path);
      return st.type === 'directory';
    } catch (error) {
      if (error instanceof FileNotFoundError) return false;
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * Recursively create directories, ignoring EEXIST errors.
   */
  private async mkdirRecursive(agent: AgentFS, path: string): Promise<void> {
    if (path === '/') return;

    const segments = path.split('/').filter(Boolean);
    let current = '';
    for (const segment of segments) {
      current += '/' + segment;
      try {
        await agent.fs.mkdir(current);
      } catch (error: unknown) {
        if (!hasCode(error, 'EEXIST')) {
          throw mapError(error, current, 'directory');
        }
      }
    }
  }

  /**
   * Recursively copy a directory tree.
   */
  private async copyDirRecursive(agent: AgentFS, src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.mkdirRecursive(agent, dest);

    const entries = await agent.fs.readdirPlus(src);
    for (const entry of entries) {
      const srcChild = joinPath(src, entry.name);
      const destChild = joinPath(dest, entry.name);

      if (entry.stats.isDirectory()) {
        await this.copyDirRecursive(agent, srcChild, destChild, options);
      } else {
        if (options?.overwrite === false) {
          try {
            await agent.fs.access(destChild);
            throw new FileExistsError(destChild);
          } catch (error: unknown) {
            if (error instanceof FileExistsError) throw error;
            if (!hasCode(error, 'ENOENT')) throw mapError(error, destChild, 'file');
          }
        }
        await agent.fs.copyFile(srcChild, destChild);
      }
    }
  }
}
