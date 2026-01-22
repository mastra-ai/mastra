/**
 * VirtualFilesystem - Routes operations to mounted filesystems based on path.
 *
 * @example
 * ```typescript
 * const vfs = new VirtualFilesystem({
 *   mounts: {
 *     '/data': localFs,
 *     '/s3': s3Fs,
 *   }
 * });
 * // readdir('/') returns ['data', 's3']
 * // readFile('/data/file.txt') reads from localFs
 * ```
 */

import type {
  WorkspaceFilesystem,
  FileContent,
  FileEntry,
  FileStat,
  ReadOptions,
  WriteOptions,
  ListOptions,
  CopyOptions,
  RemoveOptions,
} from './filesystem';

export interface VirtualFilesystemConfig {
  mounts: Record<string, WorkspaceFilesystem>;
}

interface ResolvedMount {
  fs: WorkspaceFilesystem;
  fsPath: string;
  mountPath: string;
}

export class VirtualFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'VirtualFilesystem';
  readonly provider = 'virtual';
  readonly supportsMounting = false;

  private readonly _mounts: Map<string, WorkspaceFilesystem>;

  constructor(config: VirtualFilesystemConfig) {
    this.id = `vfs-${Date.now().toString(36)}`;
    this._mounts = new Map();

    for (const [path, fs] of Object.entries(config.mounts)) {
      const normalized = this.normalizeMountPath(path);
      this._mounts.set(normalized, fs);
    }

    if (this._mounts.size === 0) {
      throw new Error('VirtualFilesystem requires at least one mount');
    }
  }

  get mountPaths(): string[] {
    return Array.from(this._mounts.keys());
  }

  get mounts(): ReadonlyMap<string, WorkspaceFilesystem> {
    return this._mounts;
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

  private normalizeMountPath(path: string): string {
    let n = path.startsWith('/') ? path : `/${path}`;
    if (n.length > 1 && n.endsWith('/')) n = n.slice(0, -1);
    return n;
  }

  private normalizePath(path: string): string {
    if (!path || path === '/') return '/';
    let n = path.startsWith('/') ? path : `/${path}`;
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

  // ===========================================================================
  // WorkspaceFilesystem Implementation
  // ===========================================================================

  async init(): Promise<void> {
    for (const fs of this._mounts.values()) {
      if (fs.init) await fs.init();
    }
  }

  async destroy(): Promise<void> {
    for (const fs of this._mounts.values()) {
      if (fs.destroy) await fs.destroy();
    }
  }

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    return r.fs.readFile(r.fsPath, options);
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    return r.fs.writeFile(r.fsPath, content, options);
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    return r.fs.appendFile(r.fsPath, content);
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    return r.fs.deleteFile(r.fsPath, options);
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcR = this.resolveMount(src);
    const destR = this.resolveMount(dest);
    if (!srcR) throw new Error(`No mount for source: ${src}`);
    if (!destR) throw new Error(`No mount for dest: ${dest}`);

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
    return r.fs.mkdir(r.fsPath, options);
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const r = this.resolveMount(path);
    if (!r) throw new Error(`No mount for path: ${path}`);
    return r.fs.rmdir(r.fsPath, options);
  }

  async exists(path: string): Promise<boolean> {
    if (this.isVirtualPath(path)) return true;
    const r = this.resolveMount(path);
    if (!r) return false;
    return r.fs.exists(r.fsPath);
  }

  async stat(path: string): Promise<FileStat> {
    if (this.isVirtualPath(path)) {
      const normalized = this.normalizePath(path);
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
    return r.fs.stat(r.fsPath);
  }

  async isFile(path: string): Promise<boolean> {
    if (this.isVirtualPath(path)) return false;
    const r = this.resolveMount(path);
    if (!r) return false;
    return r.fs.isFile(r.fsPath);
  }

  async isDirectory(path: string): Promise<boolean> {
    if (this.isVirtualPath(path)) return true;
    const r = this.resolveMount(path);
    if (!r) return false;
    return r.fs.isDirectory(r.fsPath);
  }
}
