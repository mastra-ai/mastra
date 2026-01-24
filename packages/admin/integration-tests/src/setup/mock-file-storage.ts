import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileStorageProvider, FileInfo } from '@mastra/admin';

/**
 * Local file-based storage implementation for integration testing.
 *
 * This implementation writes to the local filesystem, providing
 * a real storage backend for testing observability data flows.
 */
export class LocalFileStorage implements FileStorageProvider {
  readonly type = 'local' as const;

  private baseDir: string;

  constructor(config: { baseDir: string }) {
    this.baseDir = config.baseDir;
  }

  /**
   * Write content to a file.
   * Creates parent directories if they don't exist.
   */
  async write(filePath: string, content: Buffer | string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content);
  }

  /**
   * Append content to a file.
   * Creates the file if it doesn't exist.
   */
  async append(filePath: string, content: Buffer | string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.appendFile(fullPath, content);
  }

  /**
   * Read a file's content.
   */
  async read(filePath: string): Promise<Buffer> {
    const fullPath = this.resolvePath(filePath);
    return fs.readFile(fullPath);
  }

  /**
   * List files matching a prefix.
   * Results are sorted by lastModified ascending (oldest first).
   */
  async list(prefix: string): Promise<FileInfo[]> {
    const fullPath = this.resolvePath(prefix);
    const files: FileInfo[] = [];

    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isFile()) {
          const entryPath = path.join(prefix, entry.name);
          const stat = await fs.stat(path.join(fullPath, entry.name));
          files.push({
            path: entryPath,
            size: stat.size,
            lastModified: stat.mtime,
          });
        } else if (entry.isDirectory()) {
          // Recursively list subdirectories
          const subFiles = await this.list(path.join(prefix, entry.name));
          files.push(...subFiles);
        }
      }
    } catch (error) {
      // Directory doesn't exist - return empty list
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw error;
    }

    // Sort by lastModified ascending
    files.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());

    return files;
  }

  /**
   * Delete a file.
   * No-op if file doesn't exist.
   */
  async delete(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath);
    try {
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Move/rename a file.
   * Used for marking files as processed.
   */
  async move(from: string, to: string): Promise<void> {
    const fromPath = this.resolvePath(from);
    const toPath = this.resolvePath(to);

    // Ensure target directory exists
    await fs.mkdir(path.dirname(toPath), { recursive: true });

    await fs.rename(fromPath, toPath);
  }

  /**
   * Check if a file exists.
   */
  async exists(filePath: string): Promise<boolean> {
    const fullPath = this.resolvePath(filePath);
    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Resolve a path relative to the base directory.
   */
  private resolvePath(filePath: string): string {
    return path.join(this.baseDir, filePath);
  }

  /**
   * Get the base directory (for testing).
   */
  getBaseDir(): string {
    return this.baseDir;
  }
}
