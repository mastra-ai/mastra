/**
 * Local Filesystem Provider
 *
 * A filesystem implementation backed by a folder on the local disk.
 * This is the default filesystem for development and local agents.
 */

import * as fs from 'node:fs/promises';
import * as nodePath from 'node:path';
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
import {
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
} from './filesystem';

/**
 * Local filesystem provider configuration.
 */
export interface LocalFilesystemOptions {
  /** Unique identifier for this filesystem instance */
  id?: string;
  /** Base directory path on disk */
  basePath: string;
  /** Restrict operations to basePath (default: true) */
  sandbox?: boolean;
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

  private readonly basePath: string;
  private readonly sandbox: boolean;

  constructor(options: LocalFilesystemOptions) {
    this.id = options.id ?? this.generateId();
    this.basePath = nodePath.resolve(options.basePath);
    this.sandbox = options.sandbox ?? true;
  }

  private generateId(): string {
    return `local-fs-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  }

  private toBuffer(content: FileContent): Buffer {
    if (Buffer.isBuffer(content)) return content;
    if (content instanceof Uint8Array) return Buffer.from(content);
    return Buffer.from(content, 'utf-8');
  }

  private getMimeType(filename: string): string {
    const ext = filename.split('.').pop()?.toLowerCase();
    const mimeTypes: Record<string, string> = {
      txt: 'text/plain',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      ts: 'application/typescript',
      json: 'application/json',
      xml: 'application/xml',
      md: 'text/markdown',
      py: 'text/x-python',
      rb: 'text/x-ruby',
      go: 'text/x-go',
      rs: 'text/x-rust',
      sh: 'text/x-sh',
    };
    return mimeTypes[ext ?? ''] ?? 'application/octet-stream';
  }

  private resolvePath(inputPath: string): string {
    const cleanedPath = inputPath.replace(/^\/+/, '');
    const normalizedInput = nodePath.normalize(cleanedPath);
    const absolutePath = nodePath.resolve(this.basePath, normalizedInput);

    if (this.sandbox) {
      const relative = nodePath.relative(this.basePath, absolutePath);
      if (relative.startsWith('..') || nodePath.isAbsolute(relative)) {
        throw new PermissionError(inputPath, 'access');
      }
    }

    return absolutePath;
  }

  private toRelativePath(absolutePath: string): string {
    return '/' + nodePath.relative(this.basePath, absolutePath).replace(/\\/g, '/');
  }

  async readFile(inputPath: string, options?: ReadOptions): Promise<string | Buffer> {
    const absolutePath = this.resolvePath(inputPath);

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
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new FileNotFoundError(inputPath);
      }
      throw error;
    }
  }

  async writeFile(inputPath: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const absolutePath = this.resolvePath(inputPath);

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
    const absolutePath = this.resolvePath(inputPath);
    const dir = nodePath.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.appendFile(absolutePath, this.toBuffer(content));
  }

  async deleteFile(inputPath: string, options?: RemoveOptions): Promise<void> {
    const absolutePath = this.resolvePath(inputPath);

    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isDirectory()) {
        throw new IsDirectoryError(inputPath);
      }
      await fs.unlink(absolutePath);
    } catch (error: unknown) {
      if (error instanceof IsDirectoryError) throw error;
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        if (!options?.force) {
          throw new FileNotFoundError(inputPath);
        }
      } else {
        throw error;
      }
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const srcPath = this.resolvePath(src);
    const destPath = this.resolvePath(dest);

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
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
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
    const srcPath = this.resolvePath(src);
    const destPath = this.resolvePath(dest);

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
      } catch {
        await this.copyFile(src, dest, { ...options, overwrite: true });
        await fs.rm(srcPath, { recursive: true, force: true });
      }
    } catch (error: unknown) {
      if (error instanceof FileExistsError) throw error;
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new FileNotFoundError(src);
      }
      throw error;
    }
  }

  async mkdir(inputPath: string, options?: { recursive?: boolean }): Promise<void> {
    const absolutePath = this.resolvePath(inputPath);

    try {
      await fs.mkdir(absolutePath, { recursive: options?.recursive ?? true });
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST') {
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
    const absolutePath = this.resolvePath(inputPath);

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
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
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

        const fileEntry: FileEntry = {
          name: entry.name,
          type: entry.isDirectory() ? 'directory' : 'file',
        };

        if (entry.isFile()) {
          try {
            const stat = await fs.stat(entryPath);
            fileEntry.size = stat.size;
          } catch {
            // Ignore
          }
        }

        result.push(fileEntry);

        if (options?.recursive && entry.isDirectory()) {
          const depth = options.maxDepth ?? Infinity;
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
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new DirectoryNotFoundError(inputPath);
      }
      throw error;
    }
  }

  async exists(inputPath: string): Promise<boolean> {
    const absolutePath = this.resolvePath(inputPath);
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  async stat(inputPath: string): Promise<FileStat> {
    const absolutePath = this.resolvePath(inputPath);

    try {
      const stats = await fs.stat(absolutePath);
      return {
        name: nodePath.basename(absolutePath),
        path: this.toRelativePath(absolutePath),
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        mimeType: stats.isFile() ? this.getMimeType(absolutePath) : undefined,
      };
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new FileNotFoundError(inputPath);
      }
      throw error;
    }
  }

  async isFile(inputPath: string): Promise<boolean> {
    try {
      const stats = await this.stat(inputPath);
      return stats.type === 'file';
    } catch {
      return false;
    }
  }

  async isDirectory(inputPath: string): Promise<boolean> {
    try {
      const stats = await this.stat(inputPath);
      return stats.type === 'directory';
    } catch {
      return false;
    }
  }

  async init(): Promise<void> {
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async destroy(): Promise<void> {
    // LocalFilesystem doesn't clean up on destroy by default
  }
}
