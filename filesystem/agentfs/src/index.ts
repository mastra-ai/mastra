/**
 * AgentFS Filesystem Provider
 *
 * A filesystem implementation backed by SQLite/Turso via the agentfs-sdk.
 * Provides persistent, auditable file storage for agent workspaces.
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { AgentFilesystem } from '@mastra/filesystem-agentfs';
 *
 * const workspace = new Workspace({
 *   filesystem: new AgentFilesystem({ id: 'my-agent' }),
 * });
 *
 * await workspace.init();
 * await workspace.writeFile('/data.json', JSON.stringify({ key: 'value' }));
 * ```
 */

import { AgentFS } from 'agentfs-sdk';
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
} from '@mastra/core';
import {
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
} from '@mastra/core';

/**
 * Configuration options for AgentFilesystem.
 */
export interface AgentFilesystemOptions {
  /**
   * Unique identifier for the agent.
   * If provided without `path`, creates storage at `.agentfs/{id}.db`
   */
  id?: string;

  /**
   * Explicit path to the database file.
   * If provided, uses this path directly.
   */
  path?: string;

  /**
   * Human-readable name for this filesystem instance.
   */
  name?: string;
}

/**
 * AgentFS filesystem implementation.
 *
 * Uses Turso's agentfs-sdk to provide SQLite-backed persistent file storage.
 * Files are stored in a SQLite database, making them portable and easy to backup.
 *
 * Features:
 * - Persistent storage in SQLite database
 * - Works with local SQLite or Turso cloud
 * - POSIX-like filesystem semantics
 * - Atomic operations
 *
 * @example
 * ```typescript
 * import { AgentFilesystem } from '@mastra/filesystem-agentfs';
 *
 * // Using agent ID (creates .agentfs/my-agent.db)
 * const fs = new AgentFilesystem({ id: 'my-agent' });
 *
 * // Using explicit path
 * const fs = new AgentFilesystem({ path: './data/agent.db' });
 *
 * await fs.init();
 * await fs.writeFile('/hello.txt', 'Hello World!');
 * const content = await fs.readFile('/hello.txt', { encoding: 'utf-8' });
 * ```
 */
export class AgentFilesystem implements WorkspaceFilesystem {
  readonly id: string;
  readonly name: string;
  readonly provider = 'agentfs';

  private agentFs: AgentFS | null = null;
  private readonly options: AgentFilesystemOptions;

  constructor(options: AgentFilesystemOptions) {
    if (!options.id && !options.path) {
      throw new Error('AgentFilesystem requires either id or path');
    }

    this.options = options;
    this.id = options.id ?? `agentfs-${Date.now().toString(36)}`;
    this.name = options.name ?? 'AgentFilesystem';
  }

  /**
   * Initialize the filesystem (opens the database connection).
   */
  async init(): Promise<void> {
    if (this.agentFs) {
      return; // Already initialized
    }

    this.agentFs = await AgentFS.open({
      id: this.options.id,
      path: this.options.path,
    });
  }

  /**
   * Close the database connection and clean up resources.
   */
  async destroy(): Promise<void> {
    if (this.agentFs) {
      await this.agentFs.close();
      this.agentFs = null;
    }
  }

  private ensureInitialized(): AgentFS {
    if (!this.agentFs) {
      throw new Error('AgentFilesystem not initialized. Call init() first.');
    }
    return this.agentFs;
  }

  private normalizePath(path: string): string {
    // Ensure path starts with /
    if (!path.startsWith('/')) {
      path = '/' + path;
    }
    // Remove trailing slash (except for root)
    if (path.length > 1 && path.endsWith('/')) {
      path = path.slice(0, -1);
    }
    return path;
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

  async readFile(path: string, options?: ReadOptions): Promise<string | Buffer> {
    const agentFs = this.ensureInitialized();
    const normalizedPath = this.normalizePath(path);

    try {
      // Check if it's a directory first
      const stats = await agentFs.fs.stat(normalizedPath);
      if (stats.isDirectory()) {
        throw new IsDirectoryError(path);
      }

      if (options?.encoding) {
        return await agentFs.fs.readFile(normalizedPath, options.encoding);
      }
      return await agentFs.fs.readFile(normalizedPath);
    } catch (error: unknown) {
      if (error instanceof IsDirectoryError) throw error;
      if (this.isEnoent(error)) {
        throw new FileNotFoundError(path);
      }
      throw error;
    }
  }

  async writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void> {
    const agentFs = this.ensureInitialized();
    const normalizedPath = this.normalizePath(path);

    try {
      // Check if file exists when overwrite is false
      if (options?.overwrite === false) {
        try {
          await agentFs.fs.access(normalizedPath);
          throw new FileExistsError(path);
        } catch (error: unknown) {
          if (error instanceof FileExistsError) throw error;
          // File doesn't exist, continue
        }
      }

      // AgentFS automatically creates parent directories
      const data = this.toBuffer(content);
      await agentFs.fs.writeFile(normalizedPath, data);
    } catch (error: unknown) {
      if (error instanceof FileExistsError) throw error;
      throw error;
    }
  }

  async appendFile(path: string, content: FileContent): Promise<void> {
    const agentFs = this.ensureInitialized();
    const normalizedPath = this.normalizePath(path);

    try {
      // Read existing content
      let existing: Buffer;
      try {
        existing = await agentFs.fs.readFile(normalizedPath);
      } catch {
        existing = Buffer.alloc(0);
      }

      // Append new content
      const newContent = Buffer.concat([existing, this.toBuffer(content)]);
      await agentFs.fs.writeFile(normalizedPath, newContent);
    } catch (error: unknown) {
      throw error;
    }
  }

  async deleteFile(path: string, options?: RemoveOptions): Promise<void> {
    const agentFs = this.ensureInitialized();
    const normalizedPath = this.normalizePath(path);

    try {
      const stats = await agentFs.fs.stat(normalizedPath);
      if (stats.isDirectory()) {
        throw new IsDirectoryError(path);
      }
      await agentFs.fs.unlink(normalizedPath);
    } catch (error: unknown) {
      if (error instanceof IsDirectoryError) throw error;
      if (this.isEnoent(error)) {
        if (!options?.force) {
          throw new FileNotFoundError(path);
        }
        return;
      }
      throw error;
    }
  }

  async copyFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const agentFs = this.ensureInitialized();
    const srcPath = this.normalizePath(src);
    const destPath = this.normalizePath(dest);

    try {
      const stats = await agentFs.fs.stat(srcPath);

      if (stats.isDirectory()) {
        if (!options?.recursive) {
          throw new IsDirectoryError(src);
        }
        await this.copyDirectory(srcPath, destPath, options);
      } else {
        if (options?.overwrite === false) {
          try {
            await agentFs.fs.access(destPath);
            throw new FileExistsError(dest);
          } catch (error: unknown) {
            if (error instanceof FileExistsError) throw error;
          }
        }
        await agentFs.fs.copyFile(srcPath, destPath);
      }
    } catch (error: unknown) {
      if (error instanceof IsDirectoryError || error instanceof FileExistsError) throw error;
      if (this.isEnoent(error)) {
        throw new FileNotFoundError(src);
      }
      throw error;
    }
  }

  private async copyDirectory(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const agentFs = this.ensureInitialized();

    // Create destination directory
    try {
      await agentFs.fs.mkdir(dest);
    } catch {
      // May already exist
    }

    // Copy contents
    const entries = await agentFs.fs.readdirPlus(src);
    for (const entry of entries) {
      const srcEntry = `${src}/${entry.name}`;
      const destEntry = `${dest}/${entry.name}`;

      if (entry.stats.isDirectory()) {
        await this.copyDirectory(srcEntry, destEntry, options);
      } else {
        await agentFs.fs.copyFile(srcEntry, destEntry);
      }
    }
  }

  async moveFile(src: string, dest: string, options?: CopyOptions): Promise<void> {
    const agentFs = this.ensureInitialized();
    const srcPath = this.normalizePath(src);
    const destPath = this.normalizePath(dest);

    try {
      if (options?.overwrite === false) {
        try {
          await agentFs.fs.access(destPath);
          throw new FileExistsError(dest);
        } catch (error: unknown) {
          if (error instanceof FileExistsError) throw error;
        }
      }

      await agentFs.fs.rename(srcPath, destPath);
    } catch (error: unknown) {
      if (error instanceof FileExistsError) throw error;
      if (this.isEnoent(error)) {
        throw new FileNotFoundError(src);
      }
      throw error;
    }
  }

  async mkdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    const agentFs = this.ensureInitialized();
    const normalizedPath = this.normalizePath(path);

    try {
      if (options?.recursive) {
        // Create all parent directories
        const parts = normalizedPath.split('/').filter(Boolean);
        let currentPath = '';
        for (const part of parts) {
          currentPath += '/' + part;
          try {
            await agentFs.fs.mkdir(currentPath);
          } catch (error: unknown) {
            // Ignore if already exists
            if (!this.isEexist(error)) {
              throw error;
            }
          }
        }
      } else {
        await agentFs.fs.mkdir(normalizedPath);
      }
    } catch (error: unknown) {
      if (this.isEexist(error)) {
        // Check if it's actually a file
        try {
          const stats = await agentFs.fs.stat(normalizedPath);
          if (!stats.isDirectory()) {
            throw new FileExistsError(path);
          }
        } catch {
          // Ignore stat errors
        }
      } else {
        throw error;
      }
    }
  }

  async rmdir(path: string, options?: RemoveOptions): Promise<void> {
    const agentFs = this.ensureInitialized();
    const normalizedPath = this.normalizePath(path);

    try {
      const stats = await agentFs.fs.stat(normalizedPath);
      if (!stats.isDirectory()) {
        throw new NotDirectoryError(path);
      }

      if (options?.recursive) {
        await agentFs.fs.rm(normalizedPath, { recursive: true, force: options?.force });
      } else {
        // Check if directory is empty
        const entries = await agentFs.fs.readdir(normalizedPath);
        if (entries.length > 0) {
          throw new DirectoryNotEmptyError(path);
        }
        await agentFs.fs.rmdir(normalizedPath);
      }
    } catch (error: unknown) {
      if (error instanceof NotDirectoryError || error instanceof DirectoryNotEmptyError) {
        throw error;
      }
      if (this.isEnoent(error)) {
        if (!options?.force) {
          throw new DirectoryNotFoundError(path);
        }
        return;
      }
      throw error;
    }
  }

  async readdir(path: string, options?: ListOptions): Promise<FileEntry[]> {
    const agentFs = this.ensureInitialized();
    const normalizedPath = this.normalizePath(path);

    try {
      const stats = await agentFs.fs.stat(normalizedPath);
      if (!stats.isDirectory()) {
        throw new NotDirectoryError(path);
      }

      const entries = await agentFs.fs.readdirPlus(normalizedPath);
      const result: FileEntry[] = [];

      for (const entry of entries) {
        // Filter by extension if specified
        if (options?.extension) {
          const extensions = Array.isArray(options.extension) ? options.extension : [options.extension];
          if (!entry.stats.isDirectory()) {
            const ext = '.' + entry.name.split('.').pop();
            if (!extensions.some((e: string) => e === ext || e === ext.slice(1))) {
              continue;
            }
          }
        }

        const fileEntry: FileEntry = {
          name: entry.name,
          type: entry.stats.isDirectory() ? 'directory' : 'file',
          size: entry.stats.isDirectory() ? undefined : entry.stats.size,
        };

        result.push(fileEntry);

        // Handle recursive listing
        if (options?.recursive && entry.stats.isDirectory()) {
          const depth = options.maxDepth ?? Infinity;
          if (depth > 0) {
            const subPath = `${normalizedPath}/${entry.name}`;
            const subEntries = await this.readdir(subPath, { ...options, maxDepth: depth - 1 });
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
    } catch (error: unknown) {
      if (error instanceof NotDirectoryError) throw error;
      if (this.isEnoent(error)) {
        throw new DirectoryNotFoundError(path);
      }
      throw error;
    }
  }

  async exists(path: string): Promise<boolean> {
    const agentFs = this.ensureInitialized();
    const normalizedPath = this.normalizePath(path);

    try {
      await agentFs.fs.access(normalizedPath);
      return true;
    } catch {
      return false;
    }
  }

  async stat(path: string): Promise<FileStat> {
    const agentFs = this.ensureInitialized();
    const normalizedPath = this.normalizePath(path);

    try {
      const stats = await agentFs.fs.stat(normalizedPath);
      const name = normalizedPath.split('/').pop() || '';

      return {
        name,
        path: normalizedPath,
        type: stats.isDirectory() ? 'directory' : 'file',
        size: stats.size,
        createdAt: new Date(stats.ctime * 1000),
        modifiedAt: new Date(stats.mtime * 1000),
        mimeType: stats.isFile() ? this.getMimeType(name) : undefined,
      };
    } catch (error: unknown) {
      if (this.isEnoent(error)) {
        throw new FileNotFoundError(path);
      }
      throw error;
    }
  }

  async isFile(path: string): Promise<boolean> {
    try {
      const stats = await this.stat(path);
      return stats.type === 'file';
    } catch {
      return false;
    }
  }

  async isDirectory(path: string): Promise<boolean> {
    try {
      const stats = await this.stat(path);
      return stats.type === 'directory';
    } catch {
      return false;
    }
  }

  // Helper methods

  private toBuffer(content: FileContent): Buffer {
    if (Buffer.isBuffer(content)) return content;
    if (content instanceof Uint8Array) return Buffer.from(content);
    return Buffer.from(content, 'utf-8');
  }

  private isEnoent(error: unknown): boolean {
    return (
      error instanceof Error &&
      ('code' in error ? (error as { code?: string }).code === 'ENOENT' : error.message.includes('ENOENT'))
    );
  }

  private isEexist(error: unknown): boolean {
    return (
      error instanceof Error &&
      ('code' in error ? (error as { code?: string }).code === 'EEXIST' : error.message.includes('EEXIST'))
    );
  }
}

// Re-export for convenience
export type {
  WorkspaceFilesystem,
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
} from '@mastra/core';
