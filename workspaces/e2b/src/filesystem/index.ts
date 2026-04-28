/**
 * E2B Filesystem Provider
 *
 * Provides a WorkspaceFilesystem implementation backed by an E2B sandbox.
 * Delegates all file operations to the E2B SDK's `sandbox.files` API.
 *
 * @example
 * ```typescript
 * import { E2BSandbox, E2BFilesystem } from '@mastra/e2b';
 *
 * const sandbox = new E2BSandbox({ template: 'my-template' });
 * await sandbox._init();
 *
 * const fs = new E2BFilesystem({ sandbox });
 * await fs._init();
 *
 * const content = await fs.readFile('/tmp/test.txt', { encoding: 'utf-8' });
 * ```
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

import type { E2BSandbox } from '../sandbox';

/**
 * Configuration options for E2BFilesystem.
 */
export interface E2BFilesystemOptions extends MastraFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** The E2B sandbox instance to use for file operations */
  sandbox: E2BSandbox;
  /** Human-friendly display name for the UI */
  displayName?: string;
  /** Icon identifier for the UI */
  icon?: FilesystemIcon;
  /** Description shown in tooltips */
  description?: string;
  /** Mount as read-only (blocks write operations) */
  readOnly?: boolean;
  /** Base path prefix for all operations within the sandbox */
  basePath?: string;
}

/**
 * E2B sandbox filesystem implementation.
 *
 * Stores files in an E2B cloud sandbox, delegating all operations
 * to the E2B SDK's `sandbox.files` API.
 */
export class E2BFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'E2BFilesystem';
  readonly provider = 'e2b';
  readonly readOnly?: boolean;

  status: ProviderStatus = 'pending';

  readonly displayName?: string;
  readonly icon: FilesystemIcon = 'e2b';
  readonly description?: string;
  readonly basePath?: string;

  private readonly _e2bSandbox: E2BSandbox;

  constructor(options: E2BFilesystemOptions) {
    super({ ...options, name: 'E2BFilesystem' });
    this.id = options.id ?? `e2b-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    this._e2bSandbox = options.sandbox;
    this.readOnly = options.readOnly;
    this.displayName = options.displayName;
    if (options.icon) this.icon = options.icon;
    this.description = options.description;
    this.basePath = options.basePath ? normalizePath(options.basePath) : undefined;
  }

  /**
   * Access the underlying E2B sandbox files API.
   */
  private get files() {
    return this._e2bSandbox.e2b.files;
  }

  /**
   * Resolve a path relative to basePath (if configured).
   */
  private resolvePath(path: string): string {
    const normalized = normalizePath(path);
    if (!this.basePath) return normalized;
    if (normalized === '/') return this.basePath;
    return this.basePath + normalized;
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // Verify the sandbox is accessible by checking if root exists
    const accessible = await this.files.exists(this.basePath ?? '/');
    if (!accessible) {
      throw new Error(`E2B sandbox base path "${this.basePath ?? '/'}" does not exist`);
    }
  }

  // ---------------------------------------------------------------------------
  // Info & Instructions
  // ---------------------------------------------------------------------------

  getInfo(): FilesystemInfo<{ sandboxId: string; basePath?: string }> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      error: this.error,
      readOnly: this.readOnly,
      icon: this.icon,
      metadata: {
        sandboxId: this._e2bSandbox.id,
        ...(this.basePath && { basePath: this.basePath }),
      },
    };
  }

  getInstructions(): string {
    const access = this.readOnly ? 'Read-only' : 'Full read/write';
    const base = this.basePath ? ` rooted at "${this.basePath}"` : '';
    return `E2B cloud sandbox filesystem${base}. ${access} access. Files are ephemeral and exist only for the sandbox lifetime.`;
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    await this.ensureReady();
    const resolved = this.resolvePath(path);

    try {
      if (options?.encoding) {
        const text = await this.files.read(resolved, { format: 'text' });
        return text;
      }
      const bytes = await this.files.read(resolved, { format: 'bytes' });
      return Buffer.from(bytes);
    } catch (error) {
      if (isE2BNotFound(error)) {
        throw new FileNotFoundError(path);
      }
      throw error;
    }
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('writeFile');
    const resolved = this.resolvePath(path);

    if (options?.overwrite === false && (await this.exists(path))) {
      throw new FileExistsError(path);
    }

    if (options?.recursive) {
      const parentDir = resolved.substring(0, resolved.lastIndexOf('/')) || '/';
      await this.files.makeDir(parentDir);
    }

    const data = typeof content === 'string' ? content : bufferToString(content);
    await this.files.write(resolved, data);
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    await this.ensureReady();
    this.assertWritable('appendFile');

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
    await this.ensureReady();
    this.assertWritable('deleteFile');
    const resolved = this.resolvePath(path);

    try {
      await this.files.remove(resolved);
    } catch (error) {
      if (options?.force) return;
      if (isE2BNotFound(error)) {
        throw new FileNotFoundError(path);
      }
      throw error;
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('copyFile');

    if (options?.overwrite === false && (await this.exists(dest))) {
      throw new FileExistsError(dest);
    }

    // E2B SDK doesn't have a native copy, so read + write
    const content = await this.readFile(src);
    await this.writeFile(dest, content, { overwrite: options?.overwrite ?? true });
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('moveFile');
    const resolvedSrc = this.resolvePath(src);
    const resolvedDest = this.resolvePath(dest);

    if (options?.overwrite === false && (await this.exists(dest))) {
      throw new FileExistsError(dest);
    }

    try {
      await this.files.rename(resolvedSrc, resolvedDest);
    } catch (error) {
      if (isE2BNotFound(error)) {
        throw new FileNotFoundError(src);
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  async mkdir(path: string, _options?: { recursive?: boolean }): Promise<void> {
    await this.ensureReady();
    this.assertWritable('mkdir');
    const resolved = this.resolvePath(path);
    // E2B's makeDir always creates parent directories
    await this.files.makeDir(resolved);
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    await this.ensureReady();
    this.assertWritable('rmdir');
    const resolved = this.resolvePath(path);

    try {
      if (options?.recursive) {
        await this.files.remove(resolved);
      } else {
        // Check if directory is empty first
        const entries = await this.files.list(resolved);
        if (entries.length > 0) {
          throw new Error(`Directory not empty: ${path}`);
        }
        await this.files.remove(resolved);
      }
    } catch (error) {
      if (options?.force) return;
      if (isE2BNotFound(error)) {
        throw new FileNotFoundError(path);
      }
      throw error;
    }
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    await this.ensureReady();
    const resolved = this.resolvePath(path);

    try {
      const depth = options?.recursive ? (options.maxDepth ?? 100) : 1;
      const entries = await this.files.list(resolved, { depth });

      let result: FileEntry[] = entries.map(entry => ({
        name: entry.name,
        type: entry.type === 'dir' ? ('directory' as const) : ('file' as const),
        size: entry.size,
        ...(entry.symlinkTarget && {
          isSymlink: true,
          symlinkTarget: entry.symlinkTarget,
        }),
      }));

      if (options?.extension) {
        const exts = Array.isArray(options.extension) ? options.extension : [options.extension];
        result = result.filter(
          entry => entry.type === 'directory' || exts.some(ext => entry.name.endsWith(ext)),
        );
      }

      return result;
    } catch (error) {
      if (isE2BNotFound(error)) {
        throw new FileNotFoundError(path);
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

  async exists(path: string): Promise<boolean> {
    await this.ensureReady();
    const resolved = this.resolvePath(path);
    return this.files.exists(resolved);
  }

  async stat(path: string): Promise<FileStat> {
    await this.ensureReady();
    const resolved = this.resolvePath(path);

    try {
      const info = await this.files.getInfo(resolved);
      return {
        name: info.name,
        path: path,
        type: info.type === 'dir' ? 'directory' : 'file',
        size: info.size,
        createdAt: info.modifiedTime ?? new Date(),
        modifiedAt: info.modifiedTime ?? new Date(),
      };
    } catch (error) {
      if (isE2BNotFound(error)) {
        throw new FileNotFoundError(path);
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private assertWritable(operation: string): void {
    if (this.readOnly) {
      throw new Error(`Cannot ${operation}: filesystem is read-only`);
    }
  }
}

// =============================================================================
// Utilities
// =============================================================================

/** Normalize a path to always start with / and never have trailing slashes (except root). */
function normalizePath(path: string): string {
  let p = path.replace(/\\/g, '/');
  if (!p.startsWith('/')) p = '/' + p;
  while (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

/** Convert Buffer or Uint8Array to a UTF-8 string for the E2B write API. */
function bufferToString(content: Buffer | Uint8Array): string {
  if (Buffer.isBuffer(content)) return content.toString('utf-8');
  return Buffer.from(content).toString('utf-8');
}

/** Check if an E2B SDK error is a "not found" type error. */
function isE2BNotFound(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const msg = (error as { message?: string }).message ?? '';
  return (
    msg.includes('not found') ||
    msg.includes('Not found') ||
    msg.includes('NOT_FOUND') ||
    msg.includes('no such file') ||
    msg.includes('No such file')
  );
}
