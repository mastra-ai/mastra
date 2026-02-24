/**
 * Local Filesystem Provider
 *
 * A filesystem implementation backed by a folder on the local disk.
 * This is the default filesystem for development and local agents.
 */

import { constants as fsConstants } from 'node:fs';
import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
import type { RequestContext } from '../../request-context';
import {
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
  WorkspaceReadOnlyError,
} from '../errors';
import type { ProviderStatus } from '../lifecycle';
import type { InstructionsOption } from '../types';
import { resolveInstructions } from '../utils';
import type {
  FilesystemInfo,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from './filesystem';
import { fsExists, fsStat, isEnoentError, isEexistError, resolveWorkspacePath } from './fs-utils';
import { MastraFilesystem } from './mastra-filesystem';
import type { MastraFilesystemOptions } from './mastra-filesystem';

/**
 * Local filesystem provider configuration.
 */
export interface LocalFilesystemOptions extends MastraFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** Base directory path on disk */
  basePath: string;
  /**
   * When true, all file operations are restricted to stay within basePath.
   * Prevents path traversal attacks and symlink escapes.
   *
   * Path resolution depends on this setting:
   * - `contained: true` (default) — Absolute paths that fall within basePath are
   *   used as-is; all other absolute paths are treated as virtual (resolved
   *   relative to basePath, e.g. `/file.txt` → `basePath/file.txt`). Any
   *   resolved path that escapes basePath throws a PermissionError.
   * - `contained: false` — Absolute paths are always treated as real filesystem
   *   paths. No containment check is applied.
   *
   * Set to `false` when the filesystem needs to access paths outside basePath,
   * such as global skills directories or user home directories.
   *
   * @default true
   */
  contained?: boolean;
  /**
   * When true, all write operations to this filesystem are blocked.
   * Read operations are still allowed.
   * @default false
   */
  readOnly?: boolean;
  /**
   * Additional paths (absolute) that are allowed beyond basePath.
   * Useful with `contained: true` to grant access to specific directories
   * outside the basePath without disabling containment entirely.
   *
   * Paths are resolved to absolute paths using `path.resolve()`.
   *
   * @example
   * ```typescript
   * new LocalFilesystem({
   *   basePath: '/project',
   *   contained: true,
   *   allowedPaths: ['/home/user/.config'],
   * })
   * ```
   */
  allowedPaths?: string[];
  /**
   * Custom instructions that override the default instructions
   * returned by `getInstructions()`.
   *
   * - `string` — Fully replaces the default instructions.
   *   Pass an empty string to suppress instructions entirely.
   * - `(opts) => string` — Receives the default instructions and
   *   optional request context so you can extend or customise per-request.
   */
  instructions?: InstructionsOption;
}

/**
 * Local filesystem implementation.
 *
 * Stores files in a folder on the user's machine.
 * This is the recommended filesystem for development and persistent local storage.
 *
 * @example
 * ```typescript
 * import { Workspace, LocalFilesystem } from '@mastra/core';
 *
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 * });
 *
 * await workspace.init();
 * await workspace.writeFile('/hello.txt', 'Hello World!');
 * ```
 */
export class LocalFilesystem extends MastraFilesystem {
  readonly id: string;
  readonly name = 'LocalFilesystem';
  readonly provider = 'local';
  readonly readOnly?: boolean;

  status: ProviderStatus = 'pending';

  private readonly _basePath: string;
  private readonly _contained: boolean;
  private _allowedPaths: string[];
  private readonly _instructionsOverride?: InstructionsOption;

  /**
   * The absolute base path on disk where files are stored.
   * Useful for understanding how workspace paths map to disk paths.
   */
  get basePath(): string {
    return this._basePath;
  }

  /**
   * Current set of additional allowed paths (absolute, resolved).
   * These paths are permitted beyond basePath when containment is enabled.
   */
  get allowedPaths(): readonly string[] {
    return this._allowedPaths;
  }

  /**
   * Update allowed paths. Accepts a direct array or an updater callback
   * receiving the current paths (React setState pattern).
   *
   * @example
   * ```typescript
   * // Set directly
   * fs.setAllowedPaths(['/home/user/.config']);
   *
   * // Update with callback
   * fs.setAllowedPaths(prev => [...prev, '/home/user/.ssh']);
   * ```
   */
  setAllowedPaths(pathsOrUpdater: string[] | ((current: readonly string[]) => string[])): void {
    const newPaths = typeof pathsOrUpdater === 'function' ? pathsOrUpdater(this._allowedPaths) : pathsOrUpdater;
    this._allowedPaths = newPaths.map(p => nodePath.resolve(p));
  }

  constructor(options: LocalFilesystemOptions) {
    super({ ...options, name: 'LocalFilesystem' });
    this.id = options.id ?? this.generateId();
    this._basePath = nodePath.resolve(options.basePath);
    this._contained = options.contained ?? true;
    this.readOnly = options.readOnly;
    this._allowedPaths = (options.allowedPaths ?? []).map(p => nodePath.resolve(p));
    this._instructionsOverride = options.instructions;
  }

  private generateId(): string {
    return `local-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Check if an absolute path falls within basePath or any allowed path.
   */
  private _isWithinAnyRoot(absolutePath: string): boolean {
    const roots = [this._basePath, ...this._allowedPaths];
    return roots.some(root => {
      const relative = nodePath.relative(root, absolutePath);
      return !relative.startsWith('..') && !nodePath.isAbsolute(relative);
    });
  }

  private toBuffer(content: FileContent): Buffer {
    if (Buffer.isBuffer(content)) return content;
    if (content instanceof Uint8Array) return Buffer.from(content);
    return Buffer.from(content, 'utf-8');
  }

  private resolvePath(inputPath: string): string {
    let absolutePath: string;

    if (!this._contained && nodePath.isAbsolute(inputPath)) {
      // Containment disabled — absolute paths are real filesystem paths
      absolutePath = nodePath.normalize(inputPath);
    } else if (this._contained && nodePath.isAbsolute(inputPath)) {
      // Containment enabled — check if this is a real path within basePath
      // or an allowed path (e.g. "/Users/foo/project/src") vs the virtual-root
      // convention (e.g. "/file.txt" meaning "basePath/file.txt")
      const normalized = nodePath.normalize(inputPath);
      if (this._isWithinAnyRoot(normalized)) {
        absolutePath = normalized;
      } else {
        absolutePath = resolveWorkspacePath(this._basePath, inputPath);
      }
    } else {
      absolutePath = resolveWorkspacePath(this._basePath, inputPath);
    }

    if (this._contained) {
      if (!this._isWithinAnyRoot(absolutePath)) {
        throw new PermissionError(inputPath, 'access');
      }
    }

    return absolutePath;
  }

  /**
   * Resolve a workspace-relative path to an absolute disk path.
   * Uses the same resolution logic as internal file operations.
   * Returns `undefined` if the path violates containment.
   */
  resolveAbsolutePath(inputPath: string): string | undefined {
    try {
      return this.resolvePath(inputPath);
    } catch {
      // PermissionError from containment check — path is not resolvable
      return undefined;
    }
  }

  private toRelativePath(absolutePath: string): string {
    return '/' + nodePath.relative(this._basePath, absolutePath).replace(/\\/g, '/');
  }

  private assertWritable(operation: string): void {
    if (this.readOnly) {
      throw new WorkspaceReadOnlyError(operation);
    }
  }

  /**
   * Verify that the resolved path doesn't escape basePath via symlinks.
   * Uses realpath to resolve symlinks and check the actual target.
   */
  private async assertPathContained(absolutePath: string): Promise<void> {
    if (!this._contained) return;

    // Resolve real paths for all roots (basePath + allowedPaths)
    const rootReals: string[] = [];
    for (const root of [this._basePath, ...this._allowedPaths]) {
      try {
        rootReals.push(await fs.realpath(root));
      } catch (error: unknown) {
        if (isEnoentError(error)) {
          // Root doesn't exist yet — skip (operations will fail naturally)
          continue;
        }
        throw error;
      }
    }

    if (rootReals.length === 0) {
      throw new DirectoryNotFoundError(this._basePath);
    }

    let targetReal: string;
    try {
      targetReal = await fs.realpath(absolutePath);
    } catch (error: unknown) {
      // If path doesn't exist, walk up to find an existing parent
      if (isEnoentError(error)) {
        let parentPath = absolutePath;
        while (true) {
          const nextParent = nodePath.dirname(parentPath);
          if (nextParent === parentPath) {
            // Reached filesystem root without finding existing directory
            throw new DirectoryNotFoundError(absolutePath);
          }
          parentPath = nextParent;
          try {
            targetReal = await fs.realpath(parentPath);
            break;
          } catch (parentError: unknown) {
            if (!isEnoentError(parentError)) {
              throw parentError;
            }
            // Continue walking up
          }
        }
      } else {
        throw error;
      }
    }

    const isWithinRoot = rootReals.some(
      rootReal => targetReal === rootReal || targetReal.startsWith(rootReal + nodePath.sep),
    );

    if (!isWithinRoot) {
      throw new PermissionError(absolutePath, 'access');
    }
  }

  async readFile(inputPath: string, options?: ReadOptions): Promise<string | Buffer> {
    this.logger.debug('Reading file', { path: inputPath, encoding: options?.encoding });
    await this.ensureReady();
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);

    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isDirectory()) {
        throw new IsDirectoryError(inputPath);
      }

      if (options?.encoding) {
        return await fs.readFile(absolutePath, { encoding: options.encoding });
      }
      return await fs.readFile(absolutePath);
    } catch (error: unknown) {
      if (error instanceof IsDirectoryError) throw error;
      if (isEnoentError(error)) {
        throw new FileNotFoundError(inputPath);
      }
      throw error;
    }
  }

  async writeFile(inputPath: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const contentSize = Buffer.isBuffer(content) ? content.length : content.length;
    this.logger.debug('Writing file', { path: inputPath, size: contentSize, recursive: options?.recursive });
    await this.ensureReady();
    this.assertWritable('writeFile');
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);

    // When recursive is explicitly false, verify parent directory exists
    if (options?.recursive === false) {
      const dir = nodePath.dirname(absolutePath);
      const parentPath = nodePath.dirname(inputPath);
      try {
        const stat = await fs.stat(dir);
        if (!stat.isDirectory()) {
          throw new NotDirectoryError(parentPath);
        }
      } catch (error: unknown) {
        if (error instanceof NotDirectoryError) throw error;
        if (isEnoentError(error)) {
          throw new DirectoryNotFoundError(parentPath);
        }
        throw error;
      }
    }

    if (options?.recursive !== false) {
      const dir = nodePath.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Use 'wx' flag for atomic overwrite check (avoids TOCTOU race)
    const writeFlag = options?.overwrite === false ? 'wx' : 'w';
    try {
      await fs.writeFile(absolutePath, this.toBuffer(content), { flag: writeFlag });
    } catch (error: unknown) {
      if (options?.overwrite === false && isEexistError(error)) {
        throw new FileExistsError(inputPath);
      }
      throw error;
    }
  }

  async appendFile(inputPath: string, content: FileContent): Promise<void> {
    const contentSize = Buffer.isBuffer(content) ? content.length : content.length;
    this.logger.debug('Appending to file', { path: inputPath, size: contentSize });
    await this.ensureReady();
    this.assertWritable('appendFile');
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);
    const dir = nodePath.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(absolutePath, this.toBuffer(content));
  }

  async deleteFile(inputPath: string, options?: RemoveOptions): Promise<void> {
    this.logger.debug('Deleting file', { path: inputPath, force: options?.force });
    await this.ensureReady();
    this.assertWritable('deleteFile');
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);

    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isDirectory()) {
        throw new IsDirectoryError(inputPath);
      }
      await fs.unlink(absolutePath);
    } catch (error: unknown) {
      if (error instanceof IsDirectoryError) throw error;
      if (isEnoentError(error)) {
        if (!options?.force) {
          throw new FileNotFoundError(inputPath);
        }
      } else {
        throw error;
      }
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.logger.debug('Copying file', { src, dest, recursive: options?.recursive });
    await this.ensureReady();
    this.assertWritable('copyFile');
    const srcPath = this.resolvePath(src);
    const destPath = this.resolvePath(dest);
    await this.assertPathContained(srcPath);
    await this.assertPathContained(destPath);

    try {
      const stats = await fs.stat(srcPath);
      if (stats.isDirectory()) {
        if (!options?.recursive) {
          throw new IsDirectoryError(src);
        }
        await this.copyDirectory(srcPath, destPath, options);
      } else {
        await fs.mkdir(nodePath.dirname(destPath), { recursive: true });
        // Use COPYFILE_EXCL for atomic overwrite check (avoids TOCTOU race)
        const copyFlags = options?.overwrite === false ? fsConstants.COPYFILE_EXCL : 0;
        try {
          await fs.copyFile(srcPath, destPath, copyFlags);
        } catch (error: unknown) {
          if (options?.overwrite === false && isEexistError(error)) {
            throw new FileExistsError(dest);
          }
          throw error;
        }
      }
    } catch (error: unknown) {
      if (error instanceof IsDirectoryError || error instanceof FileExistsError) throw error;
      if (isEnoentError(error)) {
        throw new FileNotFoundError(src);
      }
      throw error;
    }
  }

  private async copyDirectory(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await this.ensureReady();
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcEntry = nodePath.join(src, entry.name);
      const destEntry = nodePath.join(dest, entry.name);

      // Verify entries don't escape sandbox via symlink
      await this.assertPathContained(srcEntry);
      await this.assertPathContained(destEntry);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcEntry, destEntry, options);
      } else {
        // Use COPYFILE_EXCL for atomic overwrite check (avoids TOCTOU race)
        const copyFlags = options?.overwrite === false ? fsConstants.COPYFILE_EXCL : 0;
        try {
          await fs.copyFile(srcEntry, destEntry, copyFlags);
        } catch (error: unknown) {
          if (options?.overwrite === false && isEexistError(error)) {
            // Skip existing files when overwrite is false
            continue;
          }
          throw error;
        }
      }
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.logger.debug('Moving file', { src, dest, overwrite: options?.overwrite });
    await this.ensureReady();
    this.assertWritable('moveFile');
    const srcPath = this.resolvePath(src);
    const destPath = this.resolvePath(dest);
    await this.assertPathContained(srcPath);
    await this.assertPathContained(destPath);

    try {
      await fs.mkdir(nodePath.dirname(destPath), { recursive: true });

      // When overwrite: false, use copy+delete to avoid TOCTOU race condition.
      // copyFile uses COPYFILE_EXCL which atomically checks and writes.
      if (options?.overwrite === false) {
        await this.copyFile(src, dest, { ...options, overwrite: false });
        await fs.rm(srcPath, { recursive: true, force: true });
        return;
      }

      try {
        await fs.rename(srcPath, destPath);
      } catch (error: unknown) {
        // Only fall back to copy+delete for cross-device moves (EXDEV)
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== 'EXDEV') {
          throw error;
        }
        await this.copyFile(src, dest, options);
        await fs.rm(srcPath, { recursive: true, force: true });
      }
    } catch (error: unknown) {
      if (error instanceof FileExistsError) throw error;
      if (isEnoentError(error)) {
        throw new FileNotFoundError(src);
      }
      throw error;
    }
  }

  async mkdir(inputPath: string, options?: { recursive?: boolean }): Promise<void> {
    this.logger.debug('Creating directory', { path: inputPath, recursive: options?.recursive });
    await this.ensureReady();
    this.assertWritable('mkdir');
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);

    try {
      await fs.mkdir(absolutePath, { recursive: options?.recursive ?? true });
    } catch (error: unknown) {
      if (isEexistError(error)) {
        const stats = await fs.stat(absolutePath);
        if (!stats.isDirectory()) {
          throw new FileExistsError(inputPath);
        }
      } else if (isEnoentError(error)) {
        // Parent directory doesn't exist (only happens when recursive: false)
        const parentPath = nodePath.dirname(inputPath);
        throw new DirectoryNotFoundError(parentPath);
      } else {
        throw error;
      }
    }
  }

  async rmdir(inputPath: string, options?: RemoveOptions): Promise<void> {
    this.logger.debug('Removing directory', { path: inputPath, recursive: options?.recursive, force: options?.force });
    await this.ensureReady();
    this.assertWritable('rmdir');
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);

    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new NotDirectoryError(inputPath);
      }

      if (options?.recursive) {
        await fs.rm(absolutePath, { recursive: true, force: options?.force ?? false });
      } else {
        const entries = await fs.readdir(absolutePath);
        if (entries.length > 0) {
          throw new DirectoryNotEmptyError(inputPath);
        }
        await fs.rmdir(absolutePath);
      }
    } catch (error: unknown) {
      if (error instanceof NotDirectoryError || error instanceof DirectoryNotEmptyError) {
        throw error;
      }
      if (isEnoentError(error)) {
        if (!options?.force) {
          throw new DirectoryNotFoundError(inputPath);
        }
      } else {
        throw error;
      }
    }
  }

  async readdir(inputPath: string, options?: ListOptions): Promise<FileEntry[]> {
    this.logger.debug('Reading directory', { path: inputPath, recursive: options?.recursive });
    await this.ensureReady();
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);

    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new NotDirectoryError(inputPath);
      }

      const entries = await fs.readdir(absolutePath, { withFileTypes: true });
      const result: FileEntry[] = [];

      for (const entry of entries) {
        const entryPath = nodePath.join(absolutePath, entry.name);

        if (options?.extension) {
          const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
          if (entry.isFile()) {
            const ext = nodePath.extname(entry.name);
            if (!extensions.some(e => e === ext || e === ext.slice(1))) {
              continue;
            }
          }
        }

        // Check if entry is a symlink
        const isSymlink = entry.isSymbolicLink();
        let symlinkTarget: string | undefined;
        let resolvedType: 'file' | 'directory' = 'file';

        if (isSymlink) {
          try {
            // Get the symlink target path
            symlinkTarget = await fs.readlink(entryPath);
            // Determine the type of the target (follow the symlink)
            const targetStat = await fs.stat(entryPath);
            resolvedType = targetStat.isDirectory() ? 'directory' : 'file';
          } catch {
            // If we can't read the symlink target or it's broken, treat as file
            resolvedType = 'file';
          }
        } else {
          resolvedType = entry.isDirectory() ? 'directory' : 'file';
        }

        const fileEntry: FileEntry = {
          name: entry.name,
          type: resolvedType,
          isSymlink: isSymlink || undefined,
          symlinkTarget,
        };

        if (resolvedType === 'file' && !isSymlink) {
          try {
            const stat = await fs.stat(entryPath);
            fileEntry.size = stat.size;
          } catch {
            // Ignore
          }
        }

        result.push(fileEntry);

        // Only recurse into directories (follow symlinks to directories)
        if (options?.recursive && resolvedType === 'directory') {
          // Default to 100 to prevent stack overflow on deeply nested structures
          const depth = options.maxDepth ?? 100;
          if (depth > 0) {
            const subEntries = await this.readdir(this.toRelativePath(entryPath), { ...options, maxDepth: depth - 1 });
            result.push(
              ...subEntries.map(e => ({
                ...e,
                name: `${entry.name}/${e.name}`,
              })),
            );
          }
        }
      }

      return result;
    } catch (error: unknown) {
      if (error instanceof NotDirectoryError) throw error;
      if (isEnoentError(error)) {
        throw new DirectoryNotFoundError(inputPath);
      }
      throw error;
    }
  }

  async exists(inputPath: string): Promise<boolean> {
    await this.ensureReady();
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);
    return fsExists(absolutePath);
  }

  async stat(inputPath: string): Promise<FileStat> {
    await this.ensureReady();
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);
    const result = await fsStat(absolutePath, inputPath);
    return {
      ...result,
      path: this.toRelativePath(absolutePath),
    };
  }

  /**
   * Initialize the local filesystem by creating the base directory.
   * Status management is handled by the base class.
   */
  async init(): Promise<void> {
    this.logger.debug('Initializing filesystem', { basePath: this._basePath });
    await fs.mkdir(this._basePath, { recursive: true });
    this.logger.debug('Filesystem initialized', { basePath: this._basePath });
  }

  /**
   * Clean up the local filesystem.
   * LocalFilesystem doesn't delete files on destroy by default.
   * Status management is handled by the base class.
   */
  async destroy(): Promise<void> {
    // LocalFilesystem doesn't clean up files on destroy by default
  }

  getInfo(): FilesystemInfo<{ basePath: string; contained: boolean; allowedPaths?: string[] }> {
    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      readOnly: this.readOnly,
      status: this.status,
      error: this.error,
      metadata: {
        basePath: this.basePath,
        contained: this._contained,
        ...(this._allowedPaths.length > 0 && { allowedPaths: [...this._allowedPaths] }),
      },
    };
  }

  getInstructions(opts?: { requestContext?: RequestContext }): string {
    return resolveInstructions(this._instructionsOverride, () => this._getDefaultInstructions(), opts?.requestContext);
  }

  private _getDefaultInstructions(): string {
    const allowedNote =
      this._allowedPaths.length > 0
        ? ` Additionally, the following paths outside basePath are accessible: ${this._allowedPaths.join(', ')}.`
        : '';
    if (this._contained) {
      return `Local filesystem at "${this.basePath}". Files at workspace path "/foo" are stored at "${this.basePath}/foo" on disk.${allowedNote}`;
    }
    return `Local filesystem rooted at "${this.basePath}". Containment is disabled so absolute paths access the real filesystem. Use paths relative to "${this.basePath}" (e.g. "foo/bar.txt") for workspace files. Avoid unnecessary listing "/" as it would traverse the entire host filesystem.${allowedNote}`;
  }
}
