/**
 * CompositeFilesystem - Routes operations to mounted filesystems based on path.
 *
 * Creates a unified filesystem view by combining multiple filesystems at different
 * mount points. Useful for composing local storage, S3, and other backends.
 *
 * @example
 * ```typescript
 * const cfs = new CompositeFilesystem({
 *   mounts: {
 *     '/local': new LocalFilesystem({ basePath: './data' }),
 *     '/s3': new S3Filesystem({ bucket: 'my-bucket', ... }),
 *   }
 * });
 *
 * // readdir('/') returns ['local', 's3']
 * // readFile('/local/file.txt') reads from LocalFilesystem
 * // readFile('/s3/data.json') reads from S3Filesystem
 * ```
 */

import posixPath from 'node:path/posix';

import type { RequestContext } from '../../request-context';
import { PermissionError } from '../errors';
import { callLifecycle } from '../lifecycle';
import type { ProviderStatus } from '../lifecycle';
import type {
  WorkspaceFilesystem,
  FileContent,
  FileEntry,
  FileStat,
  FilesystemInfo,
  ReadOptions,
  WriteOptions,
  ListOptions,
  CopyOptions,
  RemoveOptions,
} from './filesystem';

/**
 * Configuration for CompositeFilesystem.
 */
export interface CompositeFilesystemConfig<
  TMounts extends Record<string, WorkspaceFilesystem> = Record<string, WorkspaceFilesystem>,
> {
  /** Map of mount paths to filesystem instances */
  mounts: TMounts;
}

interface ResolvedMount {
  fs: WorkspaceFilesystem;
  fsPath: string;
  mountPath: string;
}

/**
 * CompositeFilesystem implementation.
 *
 * Routes file operations to the appropriate underlying filesystem based on path.
 * Supports cross-mount operations (copy/move between different filesystems).
 *
 * The generic parameter preserves the concrete types of mounted filesystems,
 * enabling typed access via `mounts.get()`.
 *
 * @example
 * ```typescript
 * const cfs = new CompositeFilesystem({
 *   mounts: {
 *     '/local': new LocalFilesystem({ basePath: './data' }),
 *     '/s3': new S3Filesystem({ bucket: 'my-bucket' }),
 *   },
 * });
 *
 * cfs.mounts.get('/local') // LocalFilesystem
 * cfs.mounts.get('/s3')    // S3Filesystem
 * ```
 */
export class CompositeFilesystem<
  TMounts extends Record<string, WorkspaceFilesystem> = Record<string, WorkspaceFilesystem>,
> implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'CompositeFilesystem';
  readonly provider = 'composite';

  readonly readOnly?: boolean;
  status: ProviderStatus = 'ready';

  private readonly _mounts: Map<string, WorkspaceFilesystem>;

  constructor(config: CompositeFilesystemConfig<TMounts>) {
    this.id = `cfs-${Date.now().toString(36)}`;
    this._mounts = new Map();

    for (const [path, fs] of Object.entries(config.mounts)) {
      const normalized = this.normalizePath(path);
      this._mounts.set(normalized, fs);
    }

    if (this._mounts.size === 0) {
      throw new Error('CompositeFilesystem requires at least one mount');
    }

    // Composite is read-only when every mount is read-only
    this.readOnly = [...this._mounts.values()].every(fs => fs.readOnly) || undefined;

    // Validate no nested mount paths (e.g., /data and /data/sub)
    const mountPaths = [...this._mounts.keys()];
    for (const a of mountPaths) {
      for (const b of mountPaths) {
        if (a !== b && b.startsWith(a + '/')) {
          throw new Error(`Nested mount paths are not supported: "${b}" is nested under "${a}"`);
        }
      }
    }
  }

  /**
   * Get all mount paths.
   */
  get mountPaths(): string[] {
    return Array.from(this._mounts.keys());
  }

  /**
   * Get the mounts map.
   * Returns a typed map where `get()` preserves the concrete filesystem type per mount path.
   */
  get mounts(): ReadonlyMountMap<TMounts> {
    return this._mounts as unknown as ReadonlyMountMap<TMounts>;
  }

  /**
   * Get status and metadata for this composite filesystem.
   * Includes info from each mounted filesystem in `metadata.mounts`.
   */
  async getInfo(): Promise<FilesystemInfo> {
    const mounts: Record<string, FilesystemInfo | null> = {};
    for (const [mountPath, fs] of this._mounts) {
      mounts[mountPath] = (await fs.getInfo?.()) ?? null;
    }

    return {
      id: this.id,
      name: this.name,
      provider: this.provider,
      status: this.status,
      readOnly: this.readOnly,
      metadata: { mounts },
    };
  }

  /**
   * Get the underlying filesystem for a given path.
   * Returns undefined if the path doesn't resolve to any mount.
   */
  getFilesystemForPath(path: string): WorkspaceFilesystem | undefined {
    const resolved = this.resolveMount(path);
    return resolved?.fs;
  }

  /**
   * Get the mount path for a given path.
   * Returns undefined if the path doesn't resolve to any mount.
   */
  getMountPathForPath(path: string): string | undefined {
    const resolved = this.resolveMount(path);
    return resolved?.mountPath;
  }

  /**
   * Resolve a workspace-relative path to an absolute disk path.
   * Strips the mount prefix and delegates to the underlying filesystem.
   */
  resolveAbsolutePath(path: string): string | undefined {
    const r = this.resolveMount(path);
    if (!r) return undefined;
    return r.fs.resolveAbsolutePath?.(r.fsPath);
  }

  private normalizePath(path: string): string {
    if (!path || path === '/') return '/';
    // posix.normalize resolves dot segments (./foo → foo, a/../b → b)
    let n = posixPath.normalize(path);
    if (!n.startsWith('/')) n = `/${n}`;
    if (n.length > 1 && n.endsWith('/')) n = n.slice(0, -1);
    return n;
  }

  private resolveMount(path: string): ResolvedMount | null {
    const normalized = this.normalizePath(path);
    let best: { mountPath: string; fs: WorkspaceFilesystem } | null = null;

    for (const [mountPath, fs] of this._mounts) {
      if (normalized === mountPath || normalized.startsWith(mountPath + '/')) {
        if (!best || mountPath.length > best.mountPath.length) {
          best = { mountPath, fs };
        }
      }
    }

    if (!best) return null;

    let fsPath = normalized.slice(best.mountPath.length);
    if (!fsPath) fsPath = '/';
    if (!fsPath.startsWith('/')) fsPath = '/' + fsPath;

    return { fs: best.fs, fsPath, mountPath: best.mountPath };
  }

  private getVirtualEntries(path: string): FileEntry[] | null {
    const normalized = this.normalizePath(path);
    if (this.resolveMount(normalized)) return null;

    const entriesMap = new Map<string, FileEntry>();
    for (const [mountPath, fs] of this._mounts.entries()) {
      const isUnder = normalized === '/' ? mountPath.startsWith('/') : mountPath.startsWith(normalized + '/');

      if (isUnder) {
        const remaining = normalized === '/' ? mountPath.slice(1) : mountPath.slice(normalized.length + 1);
        const next = remaining.split('/')[0];
        if (next && !entriesMap.has(next)) {
          // Check if this is a direct mount point (e.g., listing '/' and mount is '/s3')
          const isDirectMount = remaining === next;
          const entry: FileEntry = { name: next, type: 'directory' as const };

          // If it's a direct mount point, include filesystem metadata
          if (isDirectMount) {
            entry.mount = {
              provider: fs.provider,
              icon: fs.icon,
              displayName: fs.displayName,
              description: fs.description,
              status: fs.status,
              error: fs.error,
            };
          }

          entriesMap.set(next, entry);
        }
      }
    }

    return entriesMap.size > 0 ? Array.from(entriesMap.values()) : null;
  }

  private isVirtualPath(path: string): boolean {
    const normalized = this.normalizePath(path);
    if (normalized === '/' && !this._mounts.has('/')) return true;
    for (const mountPath of this._mounts.keys()) {
      if (mountPath.startsWith(normalized + '/')) return true;
    }
    return false;
  }

  /**
   * Assert that a filesystem is writable (not read-only).
   * @throws {PermissionError} if the filesystem is read-only
   */
  private assertWritable(fs: WorkspaceFilesystem, path: string, operation: string): void {
    if (fs.readOnly) {
      throw new PermissionError(path, `${operation} (filesystem is read-only)`);
    }
  }

  // ===========================================================================
  // WorkspaceFilesystem Implementation
  // ===========================================================================

  async init(): Promise<void> {
    this.status = 'initializing';
    for (const [mountPath, fs] of this._mounts.entries()) {
      try {
        await callLifecycle(fs, 'init');
      } catch (e) {
        // Individual mount failed - it will have status='error'
        // Log but continue with other mounts
        const message = e instanceof Error ? e.message : String(e);
        console.warn(`[CompositeFilesystem] Mount "${mountPath}" failed to initialize: ${message}`);
      }
    }
    // CompositeFilesystem is ready even if some mounts failed
    // Operations on errored mounts will be handled by the underlying filesystem
    this.status = 'ready';
  }

  async destroy(): Promise<void> {
    this.status = 'destroying';
    const errors: Error[] = [];
    for (const fs of this._mounts.values()) {
      try {
        await callLifecycle(fs, 'destroy');
      } catch (e) {
        errors.push(e instanceof Error ? e : new Error(String(e)));
      }
    }
    if (errors.length > 0) {
      this.status = 'error';
      throw new AggregateError(errors, 'Some filesystems failed to destroy');
    }
    this.status = 'destroyed';
  }

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    return r.fs.readFile(r.fsPath, options);
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    this.assertWritable(r.fs, path, 'writeFile');
    return r.fs.writeFile(r.fsPath, content, options);
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    this.assertWritable(r.fs, path, 'appendFile');
    return r.fs.appendFile(r.fsPath, content);
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    this.assertWritable(r.fs, path, 'deleteFile');
    return r.fs.deleteFile(r.fsPath, options);
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcR = this.resolveMount(src);
    const destR = this.resolveMount(dest);
    if (!srcR) throw new Error(`No mount for source: ${src}`);
    if (!destR) throw new Error(`No mount for dest: ${dest}`);
    this.assertWritable(destR.fs, dest, 'copyFile');

    // Same mount - delegate
    if (srcR.mountPath === destR.mountPath) {
      return srcR.fs.copyFile(srcR.fsPath, destR.fsPath, options);
    }

    // Cross-mount copy - read then write
    const content = await srcR.fs.readFile(srcR.fsPath);
    await destR.fs.writeFile(destR.fsPath, content, { overwrite: options?.overwrite });
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcR = this.resolveMount(src);
    const destR = this.resolveMount(dest);
    if (!srcR) throw new Error(`No mount for source: ${src}`);
    if (!destR) throw new Error(`No mount for dest: ${dest}`);
    this.assertWritable(destR.fs, dest, 'moveFile');
    this.assertWritable(srcR.fs, src, 'moveFile'); // Source must be writable for delete

    // Same mount - delegate
    if (srcR.mountPath === destR.mountPath) {
      return srcR.fs.moveFile(srcR.fsPath, destR.fsPath, options);
    }

    // Cross-mount move - copy then delete
    await this.copyFile(src, dest, options);
    await srcR.fs.deleteFile(srcR.fsPath);
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const virtual = this.getVirtualEntries(path);
    if (virtual) return virtual;

    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    return r.fs.readdir(r.fsPath, options);
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    this.assertWritable(r.fs, path, 'mkdir');
    return r.fs.mkdir(r.fsPath, options);
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    this.assertWritable(r.fs, path, 'rmdir');
    return r.fs.rmdir(r.fsPath, options);
  }

  async exists(path: string): Promise<boolean> {
    if (this.isVirtualPath(path)) return true;
    const r = this.resolveMount(path);
    if (!r) return false;
    // Mount point root always exists (even if errored)
    if (r.fsPath === '/') return true;
    return r.fs.exists(r.fsPath);
  }

  async stat(path: string): Promise<FileStat> {
    const normalized = this.normalizePath(path);

    if (this.isVirtualPath(path)) {
      const parts = normalized.split('/').filter(Boolean);
      const now = new Date();
      return {
        name: parts[parts.length - 1] || '',
        path: normalized,
        type: 'directory',
        size: 0,
        createdAt: now,
        modifiedAt: now,
      };
    }

    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);

    // Mount point root always returns directory stat (even if errored)
    if (r.fsPath === '/') {
      const parts = normalized.split('/').filter(Boolean);
      const now = new Date();
      return {
        name: parts[parts.length - 1] || '',
        path: normalized,
        type: 'directory',
        size: 0,
        createdAt: now,
        modifiedAt: now,
      };
    }

    return r.fs.stat(r.fsPath);
  }

  async isFile(path: string): Promise<boolean> {
    if (this.isVirtualPath(path)) return false;
    const r = this.resolveMount(path);
    if (!r) return false;
    try {
      const stat = await r.fs.stat(r.fsPath);
      return stat.type === 'file';
    } catch {
      return false;
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    if (this.isVirtualPath(path)) return true;
    const r = this.resolveMount(path);
    if (!r) return false;
    // Mount point root is always a directory (even if errored)
    if (r.fsPath === '/') return true;
    try {
      const stat = await r.fs.stat(r.fsPath);
      return stat.type === 'directory';
    } catch {
      return false;
    }
  }

  /**
   * Get instructions describing the mounted filesystems.
   * Used by agents to understand available storage locations.
   */
  getInstructions(_opts?: { requestContext?: RequestContext }): string {
    const mountDescriptions = Array.from(this._mounts.entries())
      .map(([mountPath, fs]) => {
        const name = fs.displayName || fs.provider;
        const access = fs.readOnly ? '(read-only)' : '(read-write)';
        return `- ${mountPath}: ${name} ${access}`;
      })
      .join('\n');

    return `Filesystem mount points:\n${mountDescriptions}`;
  }
}

/**
 * Distributive mapped type that produces a union of correlated `[key, value]` tuples.
 *
 * For `{ '/local': LocalFilesystem, '/s3': S3Filesystem }` this yields:
 * `['/local', LocalFilesystem] | ['/s3', S3Filesystem]`
 *
 * This enables discriminated-union narrowing when iterating entries without destructuring:
 * ```typescript
 * for (const entry of mounts.entries()) {
 *   if (entry[0] === '/local') {
 *     entry[1] // LocalFilesystem
 *   }
 * }
 * ```
 */
export type MountMapEntry<TMounts extends Record<string, WorkspaceFilesystem>> = {
  [K in string & keyof TMounts]: [K, TMounts[K]];
}[string & keyof TMounts];

/**
 * A read-only view of mounted filesystems with typed per-key access.
 *
 * Unlike `ReadonlyMap<string, WorkspaceFilesystem>`, this preserves the
 * concrete filesystem type for each mount path via an overloaded `get()`.
 *
 * Iteration methods return correlated `[key, value]` tuples ({@link MountMapEntry})
 * so that checking `entry[0]` narrows `entry[1]` to the concrete filesystem type.
 *
 * @example
 * ```typescript
 * const mounts = cfs.mounts;
 * mounts.get('/local') // LocalFilesystem
 * mounts.get('/s3')    // S3Filesystem
 * ```
 */
export interface ReadonlyMountMap<TMounts extends Record<string, WorkspaceFilesystem>> {
  /** Get a mounted filesystem by path. Returns the concrete type for known mount paths. */
  get<K extends string & keyof TMounts>(key: K): TMounts[K];
  get(key: string): WorkspaceFilesystem | undefined;

  has(key: string): boolean;
  readonly size: number;

  keys(): IterableIterator<string & keyof TMounts>;
  values(): IterableIterator<TMounts[keyof TMounts & string]>;
  entries(): IterableIterator<MountMapEntry<TMounts>>;
  forEach(
    callbackfn: (
      value: TMounts[keyof TMounts & string],
      key: string & keyof TMounts,
      map: ReadonlyMountMap<TMounts>,
    ) => void,
  ): void;
  [Symbol.iterator](): IterableIterator<MountMapEntry<TMounts>>;
}
