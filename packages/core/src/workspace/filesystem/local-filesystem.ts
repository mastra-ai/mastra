/**
 * Local Filesystem Provider
 *
 * A filesystem implementation backed by a folder on the local disk.
 * This is the default filesystem for development and local agents.
 */

import { constants as fsConstants, realpathSync } from 'node:fs';
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
  StaleFileError,
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
import { expandTilde, fsExists, fsStat, isEnoentError, isEexistError, resolveToBasePath } from './fs-utils';
import { MastraFilesystem } from './mastra-filesystem';
import type { MastraFilesystemOptions } from './mastra-filesystem';
import type { FilesystemMountConfig } from './mount';

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
   * - `contained: true` (default) — File access is restricted to basePath
   *   (and any allowedPaths). Paths that escape these boundaries throw a
   *   PermissionError.
   * - `contained: false` — No access restrictions. Any path on the host
   *   filesystem is accessible.
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
   * Additional directories the agent can access outside of `basePath`.
   *
   * Relative paths resolve against `basePath`.
   * Absolute and tilde paths are used as-is.
   *
   * @example
   * ```typescript
   * new LocalFilesystem({
   *   basePath: './workspace',
   *   contained: true,
   *   allowedPaths: ['../skills', '~/.claude/skills'],
   * })
   * ```
   */
  allowedPaths?: string[];
  /**
   * Directories within `basePath` that are walled off — file ops on a path
   * inside (or equal to) a disallowed root throw `PermissionError`. Useful
   * for treating nested git worktrees, submodules, vendored repositories,
   * or other trust boundaries inside the workspace as separate sandboxes.
   *
   * Disallowed paths are ignored when the same path is also covered by
   * `allowedPaths`, so a per-call grant always wins over a static block.
   *
   * Relative paths resolve against `basePath`. Absolute and tilde paths are
   * used as-is.
   *
   * @example
   * ```typescript
   * new LocalFilesystem({
   *   basePath: '/work/proj',
   *   disallowedPaths: ['vendor/sub-repo', 'wt-feat'],
   * })
   * ```
   *
   * @default []
   */
  disallowedPaths?: string[];
  /**
   * Optional message included in the `PermissionError` thrown when a path
   * is blocked by `disallowedPaths`. Use this to point the agent at whatever
   * recovery flow the surrounding workspace exposes (e.g. an "ask for
   * access" tool) — `LocalFilesystem` itself stays unaware of those
   * conventions.
   *
   * Two forms are supported:
   * - `string` — used verbatim as the message hint.
   * - `(absolutePath) => string` — receives the resolved absolute path so
   *   the hint can mention the offending location.
   *
   * When omitted, a generic "path is in a restricted location within the
   * workspace" hint is used.
   */
  disallowedPathHint?: string | ((absolutePath: string) => string);
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
 * Mount configuration for local filesystems.
 *
 * When a `LocalFilesystem` is used as a mount in a Workspace with `LocalSandbox`,
 * the sandbox creates a symlink from `<workingDir>/<mountPath>` → `basePath`.
 * No FUSE tools are needed for local mounts.
 *
 * **Note:** When mounted with `contained: false`, the agent can access any
 * path on the host filesystem through this mount. Workspace logs a warning
 * at construction time if this combination is detected.
 */
export interface LocalMountConfig extends FilesystemMountConfig {
  type: 'local';
  basePath: string;
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
 * await workspace.writeFile('hello.txt', 'Hello World!');
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
  private _disallowedPaths: string[];
  private readonly _disallowedPathHint?: string | ((absolutePath: string) => string);
  private readonly _instructionsOverride?: InstructionsOption;

  /**
   * The absolute base path on disk where files are stored.
   * Useful for understanding how workspace paths map to disk paths.
   */
  get basePath(): string {
    return this._basePath;
  }

  /**
   * Whether file operations are restricted to stay within basePath.
   *
   * When `true` (default), relative paths resolve against basePath and
   * absolute paths are kept as-is. Any resolved path that falls outside
   * basePath (and allowedPaths) throws a PermissionError. When `false`,
   * no containment check is applied.
   *
   * **Note:** When used as a CompositeFilesystem mount with `contained: false`,
   * the agent can access any path on the host filesystem through this mount.
   */
  get contained(): boolean {
    return this._contained;
  }

  /**
   * Current set of resolved allowed paths.
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
   * fs.setAllowedPaths(['../shared-data']);
   *
   * // Update with callback
   * fs.setAllowedPaths(prev => [...prev, '~/.claude/skills']);
   * ```
   */
  setAllowedPaths(pathsOrUpdater: string[] | ((current: readonly string[]) => string[])): void {
    const newPaths = typeof pathsOrUpdater === 'function' ? pathsOrUpdater(this._allowedPaths) : pathsOrUpdater;
    this._allowedPaths = newPaths.map(p => resolveToBasePath(this._basePath, p));
  }

  /**
   * Current set of resolved disallowed paths.
   * File operations on a path equal to or inside one of these throw
   * `PermissionError` unless the path is also covered by `allowedPaths`.
   */
  get disallowedPaths(): readonly string[] {
    return this._disallowedPaths;
  }

  /**
   * Update disallowed paths. Accepts a direct array or an updater callback
   * receiving the current paths (React setState pattern). Useful when the
   * workspace owner needs to refresh the list after detecting new sub-trees
   * (e.g. a newly-created git worktree inside the project root).
   */
  setDisallowedPaths(pathsOrUpdater: string[] | ((current: readonly string[]) => string[])): void {
    const newPaths = typeof pathsOrUpdater === 'function' ? pathsOrUpdater(this._disallowedPaths) : pathsOrUpdater;
    this._disallowedPaths = newPaths.map(p => resolveToBasePath(this._basePath, p));
  }

  constructor(options: LocalFilesystemOptions) {
    super({ ...options, name: 'LocalFilesystem' });
    this.id = options.id ?? this.generateId();
    this._basePath = nodePath.resolve(expandTilde(options.basePath));
    this._contained = options.contained ?? true;
    this.readOnly = options.readOnly;
    this._allowedPaths = (options.allowedPaths ?? []).map(p => resolveToBasePath(this._basePath, p));
    this._disallowedPaths = (options.disallowedPaths ?? []).map(p => resolveToBasePath(this._basePath, p));
    this._disallowedPathHint = options.disallowedPathHint;
    this._instructionsOverride = options.instructions;
  }

  /**
   * Return mount config for sandbox integration.
   * LocalSandbox uses this to create a symlink from the mount path to basePath.
   */
  getMountConfig(): LocalMountConfig {
    return { type: 'local', basePath: this._basePath };
  }

  private generateId(): string {
    return `local-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * Check if an absolute path falls within basePath or any allowed path.
   */
  private _isWithinRoot(absolutePath: string, root: string): boolean {
    const relative = nodePath.relative(root, absolutePath);
    return !relative.startsWith('..') && !nodePath.isAbsolute(relative);
  }

  private _resolvePathForContainment(absolutePath: string): string | undefined {
    let currentPath = absolutePath;

    while (true) {
      try {
        const realPath = realpathSync(currentPath);
        if (currentPath === absolutePath) {
          return realPath;
        }

        const remainder = nodePath.relative(currentPath, absolutePath);
        return nodePath.join(realPath, remainder);
      } catch (error: unknown) {
        if (!isEnoentError(error)) return undefined;
      }

      const parentPath = nodePath.dirname(currentPath);
      if (parentPath === currentPath) {
        return undefined;
      }
      currentPath = parentPath;
    }
  }

  private _isWithinAnyRoot(absolutePath: string): boolean {
    // Allowed paths are explicit grants and bypass the disallowed-paths check
    // entirely — a per-call grant always wins over a static block.
    if (this._allowedPaths.some(root => this._isWithinRoot(absolutePath, root))) {
      return true;
    }

    if (this._isWithinRoot(absolutePath, this._basePath)) {
      return !this._isInDisallowedPath(absolutePath);
    }

    const resolvedPath = this._resolvePathForContainment(absolutePath);
    if (!resolvedPath) {
      return false;
    }

    if (
      this._allowedPaths.some(root => {
        const resolvedRoot = this._resolvePathForContainment(root);
        return resolvedRoot ? this._isWithinRoot(resolvedPath, resolvedRoot) : false;
      })
    ) {
      return true;
    }

    const resolvedBase = this._resolvePathForContainment(this._basePath);
    if (resolvedBase && this._isWithinRoot(resolvedPath, resolvedBase)) {
      return !this._isInDisallowedPath(resolvedPath);
    }

    return false;
  }

  /**
   * Return true if `absolutePath` is equal to, or contained within, any of
   * the configured `disallowedPaths` roots. Pure containment check — never
   * touches the filesystem.
   */
  private _isInDisallowedPath(absolutePath: string): boolean {
    if (this._disallowedPaths.length === 0) return false;
    return this._disallowedPaths.some(root => this._isWithinRoot(absolutePath, root));
  }

  private _disallowedPathOperationHint(absolutePath: string): string {
    const hint = this._disallowedPathHint;
    if (typeof hint === 'function') return `access (${hint(absolutePath)})`;
    if (typeof hint === 'string' && hint.length > 0) return `access (${hint})`;
    return `access (path is in a restricted location within the workspace)`;
  }

  private toBuffer(content: FileContent): Buffer {
    if (Buffer.isBuffer(content)) return content;
    if (content instanceof Uint8Array) return Buffer.from(content);
    return Buffer.from(content, 'utf-8');
  }

  private resolvePath(inputPath: string): string {
    const absolutePath = resolveToBasePath(this._basePath, inputPath);

    if (this._contained) {
      if (!this._isWithinAnyRoot(absolutePath)) {
        // Differentiate "blocked by disallowedPaths" from "outside basePath"
        // so the workspace owner's hint can guide recovery (e.g. towards an
        // ask-for-access tool) instead of looking like an unreachable path.
        if (this._isWithinRoot(absolutePath, this._basePath) && this._isInDisallowedPath(absolutePath)) {
          throw new PermissionError(absolutePath, this._disallowedPathOperationHint(absolutePath));
        }
        throw new PermissionError(inputPath, this._accessOperationHint(inputPath));
      }
    }

    return absolutePath;
  }

  /**
   * Build the operation string for a containment-violation `PermissionError`.
   *
   * When the caller passed an absolute path, suggest a concrete relative form
   * only when that suffix names an existing entry under the workspace (e.g.
   * `/src/app.ts` → `src/app.ts` if `<basePath>/src` exists). Otherwise emit a
   * soft hint that doesn't lie about specific paths — agents that mistake `/`
   * for the workspace root learn the workspace is sandboxed without us
   * inventing a fictitious in-workspace location for `/etc/passwd`.
   */
  private _accessOperationHint(inputPath: string): string {
    if (!nodePath.isAbsolute(inputPath)) return 'access';

    const stripped = inputPath.replace(/^[/\\]+/, '');
    if (!stripped) return 'access';

    // If the first segment exists under basePath, the LLM almost certainly
    // meant a workspace-relative path. Suggest the exact form. Reject any
    // segment that would escape basePath (`.`, `..`) — suggesting those would
    // just produce another containment failure on the next turn.
    const firstSegment = stripped.split(/[/\\]/, 1)[0];
    if (firstSegment && firstSegment !== '.' && firstSegment !== '..') {
      try {
        if (realpathSync(nodePath.join(this._basePath, firstSegment))) {
          return `access (path is outside the workspace; use a relative path like "${stripped}")`;
        }
      } catch {
        // Fall through to the soft hint
      }
    }

    return 'access (path is outside the workspace; use a path relative to the workspace root, without a leading "/")';
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
    return nodePath.relative(this._basePath, absolutePath).replace(/\\/g, '/');
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

    // Allowed paths are explicit grants — bypass the disallowed-paths check.
    if (this._allowedPaths.some(root => this._isWithinRoot(absolutePath, root))) {
      return;
    }

    // Resolve symlinks for the target path. If it doesn't exist there are no
    // symlinks to escape through, but we still apply the disallowed-paths
    // check on the literal path so writes into a blocked subtree can't sneak
    // in via a not-yet-created file.
    let targetReal: string;
    try {
      targetReal = await fs.realpath(absolutePath);
    } catch (error: unknown) {
      if (isEnoentError(error)) {
        if (this._isWithinRoot(absolutePath, this._basePath) && this._isInDisallowedPath(absolutePath)) {
          throw new PermissionError(absolutePath, this._disallowedPathOperationHint(absolutePath));
        }
        return;
      }
      throw error;
    }

    // Re-check allowedPaths against the realpath-resolved target.
    for (const root of this._allowedPaths) {
      try {
        const rootReal = await fs.realpath(root);
        if (targetReal === rootReal || targetReal.startsWith(rootReal + nodePath.sep)) {
          return;
        }
      } catch (error: unknown) {
        if (isEnoentError(error)) continue;
        throw error;
      }
    }

    let baseReal: string;
    try {
      baseReal = await fs.realpath(this._basePath);
    } catch (error: unknown) {
      if (isEnoentError(error)) throw new PermissionError(absolutePath, 'access');
      throw error;
    }

    if (targetReal === baseReal || targetReal.startsWith(baseReal + nodePath.sep)) {
      if (this._isInDisallowedPath(targetReal)) {
        throw new PermissionError(absolutePath, this._disallowedPathOperationHint(absolutePath));
      }
      return;
    }

    throw new PermissionError(absolutePath, 'access');
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

    // Optimistic concurrency: reject if file was modified since caller last read it
    if (options?.expectedMtime) {
      try {
        const currentStat = await fs.stat(absolutePath);
        // Compare via Date objects — Node's stats.mtime applies internal
        // rounding that can diverge from Math.floor(stats.mtimeMs).
        if (currentStat.mtime.getTime() !== options.expectedMtime.getTime()) {
          throw new StaleFileError(inputPath, options.expectedMtime, currentStat.mtime);
        }
      } catch (error: unknown) {
        if (error instanceof StaleFileError) throw error;
        // File doesn't exist yet — no conflict possible, proceed with write
        if (!isEnoentError(error)) throw error;
      }
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

  async realpath(inputPath: string): Promise<string> {
    await this.ensureReady();
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);

    const canonicalPath = await fs.realpath(absolutePath);
    return this.toRelativePath(canonicalPath);
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
    // LocalFilesystem doesn't delete files on destroy
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

  getInstructions(opts?: { requestContext?: RequestContext<any> }): string {
    return resolveInstructions(this._instructionsOverride, () => this._getDefaultInstructions(), opts?.requestContext);
  }

  private _getDefaultInstructions(): string {
    const parts = [`Local filesystem at "${this.basePath}". Relative paths resolve from this directory.`];

    if (this._contained) {
      if (this._allowedPaths.length > 0) {
        parts.push(
          `File access is restricted to this directory and the following allowed paths: ${this._allowedPaths.join(', ')}.`,
        );
      } else {
        parts.push('File access is restricted to this directory.');
      }
    } else {
      parts.push('Containment is disabled, so any path on the host filesystem is accessible.');
    }

    return parts.join(' ');
  }
}
