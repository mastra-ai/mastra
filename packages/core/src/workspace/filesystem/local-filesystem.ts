/**
 * Local Filesystem Provider
 *
 * A filesystem implementation backed by a folder on the local disk.
 * This is the default filesystem for development and local agents.
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
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
import type {
  WorkspaceFilesystem,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from './filesystem';
import { fsExists, fsStat, isEnoentError, isEexistError } from './fs-utils';

/**
 * Local filesystem provider configuration.
 */
export interface LocalFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** Base directory path on disk */
  basePath: string;
  /**
   * When true, all file operations are restricted to stay within basePath.
   * Prevents path traversal attacks and symlink escapes.
   * @default true
   */
  contained?: boolean;
  /**
   * When true, all write operations to this filesystem are blocked.
   * Read operations are still allowed.
   * @default false
   */
  readOnly?: boolean;
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
export class LocalFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'LocalFilesystem';
  readonly provider = 'local';
  readonly readOnly?: boolean;

  private readonly _basePath: string;
  private readonly _contained: boolean;

  /**
   * The absolute base path on disk where files are stored.
   * Useful for understanding how workspace paths map to disk paths.
   */
  get basePath(): string {
    return this._basePath;
  }

  constructor(options: LocalFilesystemOptions) {
    this.id = options.id ?? this.generateId();
    this._basePath = nodePath.resolve(options.basePath);
    this._contained = options.contained ?? true;
    this.readOnly = options.readOnly;
  }

  private generateId(): string {
    return `local-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private toBuffer(content: FileContent): Buffer {
    if (Buffer.isBuffer(content)) return content;
    if (content instanceof Uint8Array) return Buffer.from(content);
    return Buffer.from(content, 'utf-8');
  }

  private resolvePath(inputPath: string): string {
    const cleanedPath = inputPath.replace(/^\/+/, '');
    const normalizedInput = nodePath.normalize(cleanedPath);
    const absolutePath = nodePath.resolve(this._basePath, normalizedInput);

    if (this._contained) {
      const relative = nodePath.relative(this._basePath, absolutePath);
      if (relative.startsWith('..') || nodePath.isAbsolute(relative)) {
        throw new PermissionError(inputPath, 'access');
      }
    }

    return absolutePath;
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

    const baseReal = await fs.realpath(this._basePath);
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
            throw error;
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

    if (targetReal !== baseReal && !targetReal.startsWith(baseReal + nodePath.sep)) {
      throw new PermissionError(absolutePath, 'access');
    }
  }

  async readFile(inputPath: string, options?: ReadOptions): Promise<string | Buffer> {
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
    this.assertWritable('writeFile');
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);

    if (options?.overwrite === false) {
      try {
        await fs.access(absolutePath);
        throw new FileExistsError(inputPath);
      } catch (error: unknown) {
        if (error instanceof FileExistsError) throw error;
      }
    }

    if (options?.recursive !== false) {
      const dir = nodePath.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });
    }

    await fs.writeFile(absolutePath, this.toBuffer(content));
  }

  async appendFile(inputPath: string, content: FileContent): Promise<void> {
    this.assertWritable('appendFile');
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);
    const dir = nodePath.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(absolutePath, this.toBuffer(content));
  }

  async deleteFile(inputPath: string, options?: RemoveOptions): Promise<void> {
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
        if (options?.overwrite === false) {
          try {
            await fs.access(destPath);
            throw new FileExistsError(dest);
          } catch (error: unknown) {
            if (error instanceof FileExistsError) throw error;
          }
        }
        await fs.mkdir(nodePath.dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
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
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcEntry = nodePath.join(src, entry.name);
      const destEntry = nodePath.join(dest, entry.name);

      // Verify entry doesn't escape sandbox via symlink
      await this.assertPathContained(srcEntry);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcEntry, destEntry, options);
      } else {
        if (options?.overwrite === false) {
          try {
            await fs.access(destEntry);
            continue;
          } catch {
            // Continue
          }
        }
        await fs.copyFile(srcEntry, destEntry);
      }
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    this.assertWritable('moveFile');
    const srcPath = this.resolvePath(src);
    const destPath = this.resolvePath(dest);
    await this.assertPathContained(srcPath);
    await this.assertPathContained(destPath);

    try {
      if (options?.overwrite === false) {
        try {
          await fs.access(destPath);
          throw new FileExistsError(dest);
        } catch (error: unknown) {
          if (error instanceof FileExistsError) throw error;
        }
      }

      await fs.mkdir(nodePath.dirname(destPath), { recursive: true });

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
      } else {
        throw error;
      }
    }
  }

  async rmdir(inputPath: string, options?: RemoveOptions): Promise<void> {
    this.assertWritable('rmdir');
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);

    try {
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new NotDirectoryError(inputPath);
      }

      if (options?.recursive) {
        await fs.rm(absolutePath, { recursive: true, force: options?.force });
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
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);
    return fsExists(absolutePath);
  }

  async stat(inputPath: string): Promise<FileStat> {
    const absolutePath = this.resolvePath(inputPath);
    await this.assertPathContained(absolutePath);
    const result = await fsStat(absolutePath, inputPath);
    return {
      ...result,
      path: this.toRelativePath(absolutePath),
    };
  }

  async init(): Promise<void> {
    await fs.mkdir(this._basePath, { recursive: true });
  }

  async destroy(): Promise<void> {
    // LocalFilesystem doesn't clean up on destroy by default
  }
}
