/**
 * LocalFilesystem - A filesystem provider that uses the local disk.
 *
 * Operations are sandboxed to a base directory for security.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { existsSync, statSync } from 'node:fs';
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
  LocalFSProviderConfig,
} from './types';
import {
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
} from './types';

export class LocalFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name = 'LocalFilesystem';
  readonly provider = 'local';

  private readonly basePath: string;
  private readonly sandbox: boolean;

  constructor(config: LocalFSProviderConfig) {
    this.id = config.id;
    this.basePath = path.resolve(config.basePath);
    this.sandbox = config.sandbox ?? true;
  }

  // ---------------------------------------------------------------------------
  // Path Utilities
  // ---------------------------------------------------------------------------

  /**
   * Resolve a path relative to the base path.
   * If sandboxed, ensures the path doesn't escape the base directory.
   *
   * Paths like "/test.txt" are treated as relative to the base path,
   * not as absolute system paths. This provides a virtual root.
   */
  private resolvePath(inputPath: string): string {
    // Remove leading slashes to treat all paths as relative to basePath
    // This creates a "virtual root" within the basePath
    const cleanedPath = inputPath.replace(/^\/+/, '');

    // Normalize the path to handle .. and .
    const normalizedInput = path.normalize(cleanedPath);

    // Join with base path
    const absolutePath = path.resolve(this.basePath, normalizedInput);

    // Sandbox check: ensure path is within basePath
    if (this.sandbox) {
      const relative = path.relative(this.basePath, absolutePath);
      // Check if path escapes basePath (goes up with ..) or is absolute
      if (relative.startsWith('..') || path.isAbsolute(relative)) {
        throw new PermissionError(inputPath, 'access');
      }
    }

    return absolutePath;
  }

  /**
   * Convert absolute path back to workspace-relative path.
   */
  private toRelativePath(absolutePath: string): string {
    return '/' + path.relative(this.basePath, absolutePath).replace(/\\/g, '/');
  }

  /**
   * Get MIME type from file extension.
   */
  private getMimeType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.txt': 'text/plain',
      '.md': 'text/markdown',
      '.json': 'application/json',
      '.js': 'application/javascript',
      '.ts': 'application/typescript',
      '.py': 'text/x-python',
      '.html': 'text/html',
      '.css': 'text/css',
      '.xml': 'application/xml',
      '.yaml': 'application/x-yaml',
      '.yml': 'application/x-yaml',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
      '.pdf': 'application/pdf',
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

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
    } catch (error: any) {
      if (error instanceof IsDirectoryError) throw error;
      if (error.code === 'ENOENT') {
        throw new FileNotFoundError(inputPath);
      }
      throw error;
    }
  }

  async writeFile(inputPath: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const absolutePath = this.resolvePath(inputPath);

    // Check if file exists and overwrite is false
    if (options?.overwrite === false) {
      try {
        await fs.access(absolutePath);
        throw new FileExistsError(inputPath);
      } catch (error: any) {
        if (error instanceof FileExistsError) throw error;
        // File doesn't exist, continue
      }
    }

    // Create parent directories if needed
    if (options?.recursive !== false) {
      const dir = path.dirname(absolutePath);
      await fs.mkdir(dir, { recursive: true });
    }

    // Convert content to buffer if needed
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    await fs.writeFile(absolutePath, buffer);
  }

  async appendFile(inputPath: string, content: FileContent): Promise<void> {
    const absolutePath = this.resolvePath(inputPath);

    // Create parent directories if needed
    const dir = path.dirname(absolutePath);
    await fs.mkdir(dir, { recursive: true });

    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;
    await fs.appendFile(absolutePath, buffer);
  }

  async deleteFile(inputPath: string, options?: RemoveOptions): Promise<void> {
    const absolutePath = this.resolvePath(inputPath);

    try {
      const stats = await fs.stat(absolutePath);
      if (stats.isDirectory()) {
        throw new IsDirectoryError(inputPath);
      }
      await fs.unlink(absolutePath);
    } catch (error: any) {
      if (error instanceof IsDirectoryError) throw error;
      if (error.code === 'ENOENT') {
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
        // Copy directory recursively
        await this.copyDirectory(srcPath, destPath, options);
      } else {
        // Check if dest exists
        if (options?.overwrite === false) {
          try {
            await fs.access(destPath);
            throw new FileExistsError(dest);
          } catch (error: any) {
            if (error instanceof FileExistsError) throw error;
          }
        }
        // Create parent directories
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.copyFile(srcPath, destPath);
      }
    } catch (error: any) {
      if (error instanceof IsDirectoryError || error instanceof FileExistsError) throw error;
      if (error.code === 'ENOENT') {
        throw new FileNotFoundError(src);
      }
      throw error;
    }
  }

  private async copyDirectory(src: string, dest: string, options?: CopyOptions): Promise<void> {
    await fs.mkdir(dest, { recursive: true });
    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
      const srcEntry = path.join(src, entry.name);
      const destEntry = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await this.copyDirectory(srcEntry, destEntry, options);
      } else {
        if (options?.overwrite === false) {
          try {
            await fs.access(destEntry);
            continue; // Skip existing files
          } catch {
            // File doesn't exist, continue
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
      // Check if dest exists
      if (options?.overwrite === false) {
        try {
          await fs.access(destPath);
          throw new FileExistsError(dest);
        } catch (error: any) {
          if (error instanceof FileExistsError) throw error;
        }
      }

      // Create parent directories
      await fs.mkdir(path.dirname(destPath), { recursive: true });

      // Try rename first (fast, same filesystem)
      try {
        await fs.rename(srcPath, destPath);
      } catch {
        // Fall back to copy + delete (cross filesystem)
        await this.copyFile(src, dest, { ...options, overwrite: true });
        await fs.rm(srcPath, { recursive: true, force: true });
      }
    } catch (error: any) {
      if (error instanceof FileExistsError) throw error;
      if (error.code === 'ENOENT') {
        throw new FileNotFoundError(src);
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  async mkdir(inputPath: string, options?: { recursive?: boolean }): Promise<void> {
    const absolutePath = this.resolvePath(inputPath);

    try {
      await fs.mkdir(absolutePath, { recursive: options?.recursive ?? true });
    } catch (error: any) {
      if (error.code === 'EEXIST') {
        // Check if it's a file
        const stats = await fs.stat(absolutePath);
        if (!stats.isDirectory()) {
          throw new FileExistsError(inputPath);
        }
        // Directory already exists, that's fine
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
    } catch (error: any) {
      if (
        error instanceof NotDirectoryError ||
        error instanceof DirectoryNotEmptyError
      ) {
        throw error;
      }
      if (error.code === 'ENOENT') {
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
      let result: FileEntry[] = [];

      for (const entry of entries) {
        const entryPath = path.join(absolutePath, entry.name);

        // Filter by extension if specified
        if (options?.extension) {
          const extensions = Array.isArray(options.extension)
            ? options.extension
            : [options.extension];
          if (entry.isFile()) {
            const ext = path.extname(entry.name);
            if (!extensions.some((e) => e === ext || e === ext.slice(1))) {
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
            // Ignore stat errors
          }
        }

        result.push(fileEntry);

        // Recurse into directories if requested
        if (options?.recursive && entry.isDirectory()) {
          const depth = options.maxDepth ?? Infinity;
          if (depth > 0) {
            const subEntries = await this.readdir(
              this.toRelativePath(entryPath),
              { ...options, maxDepth: depth - 1 },
            );
            // Prefix subentries with parent directory name
            result.push(
              ...subEntries.map((e) => ({
                ...e,
                name: `${entry.name}/${e.name}`,
              })),
            );
          }
        }
      }

      return result;
    } catch (error: any) {
      if (error instanceof NotDirectoryError) throw error;
      if (error.code === 'ENOENT') {
        throw new DirectoryNotFoundError(inputPath);
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

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
        name: path.basename(absolutePath),
        path: this.toRelativePath(absolutePath),
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        createdAt: stats.birthtime,
        modifiedAt: stats.mtime,
        mimeType: stats.isFile() ? this.getMimeType(absolutePath) : undefined,
      };
    } catch (error: any) {
      if (error.code === 'ENOENT') {
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

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    // Ensure base directory exists
    await fs.mkdir(this.basePath, { recursive: true });
  }

  async destroy(): Promise<void> {
    // Nothing to clean up for local filesystem
    // We don't delete the base directory as that could be destructive
  }
}

/**
 * Create a local filesystem provider.
 */
export function createLocalFilesystem(config: LocalFSProviderConfig): LocalFilesystem {
  return new LocalFilesystem(config);
}
