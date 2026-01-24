import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { FileStorageProvider, FileInfo } from '@mastra/admin';
import fg from 'fast-glob';
import type { LocalFileStorageConfig } from './types';

/**
 * Default configuration values.
 */
const DEFAULT_CONFIG = {
  fileMode: 0o644,
  dirMode: 0o755,
  atomicWrites: true,
} as const;

/**
 * Local filesystem storage provider for observability data.
 *
 * Stores files on the local filesystem with support for:
 * - Atomic writes (write to temp, then rename) for crash safety
 * - Automatic directory creation
 * - Prefix-based listing (for finding pending files)
 * - Move operations (for marking files as processed)
 *
 * @example
 * ```typescript
 * const storage = new LocalFileStorage({
 *   baseDir: '/var/mastra/observability',
 * });
 *
 * // Write observability data
 * await storage.write('pending/traces-2024-01-23-001.jsonl', jsonlContent);
 *
 * // List pending files
 * const pending = await storage.list('pending/');
 *
 * // After processing, move to processed
 * await storage.move(
 *   'pending/traces-2024-01-23-001.jsonl',
 *   'processed/traces-2024-01-23-001.jsonl'
 * );
 * ```
 */
export class LocalFileStorage implements FileStorageProvider {
  readonly type = 'local' as const;

  private readonly config: Required<LocalFileStorageConfig>;
  private initialized = false;

  constructor(config: LocalFileStorageConfig) {
    // Validate baseDir is absolute
    if (!path.isAbsolute(config.baseDir)) {
      throw new Error(`baseDir must be an absolute path: ${config.baseDir}`);
    }

    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      tempDir: config.tempDir ?? path.join(config.baseDir, '.tmp'),
    };
  }

  /**
   * Ensure base and temp directories exist.
   */
  private async ensureInitialized(): Promise<void> {
    if (this.initialized) return;

    await fs.mkdir(this.config.baseDir, { recursive: true, mode: this.config.dirMode });
    if (this.config.atomicWrites) {
      await fs.mkdir(this.config.tempDir, { recursive: true, mode: this.config.dirMode });
    }

    this.initialized = true;
  }

  /**
   * Resolve a relative path to an absolute path within baseDir.
   * Validates the path doesn't escape baseDir (security).
   */
  private resolvePath(relativePath: string): string {
    // Normalize and join with baseDir
    const normalized = path.normalize(relativePath);
    const fullPath = path.join(this.config.baseDir, normalized);

    // Security: Ensure the resolved path is within baseDir
    const resolvedBase = path.resolve(this.config.baseDir);
    const resolvedFull = path.resolve(fullPath);

    if (!resolvedFull.startsWith(resolvedBase + path.sep) && resolvedFull !== resolvedBase) {
      throw new Error(`Path escapes base directory: ${relativePath}`);
    }

    return fullPath;
  }

  /**
   * Write content to a file.
   * Creates parent directories if they don't exist.
   * Uses atomic writes by default (write to temp, then rename).
   */
  async write(filePath: string, content: Buffer | string): Promise<void> {
    await this.ensureInitialized();

    const fullPath = this.resolvePath(filePath);
    const dir = path.dirname(fullPath);

    // Ensure parent directory exists
    await fs.mkdir(dir, { recursive: true, mode: this.config.dirMode });

    // Convert string to Buffer for consistent handling
    const buffer = typeof content === 'string' ? Buffer.from(content, 'utf-8') : content;

    if (this.config.atomicWrites) {
      // Atomic write: write to temp file, then rename
      const tempPath = path.join(this.config.tempDir, `${crypto.randomUUID()}.tmp`);

      try {
        await fs.writeFile(tempPath, buffer, { mode: this.config.fileMode });
        await fs.rename(tempPath, fullPath);
      } catch (error) {
        // Clean up temp file on failure
        try {
          await fs.unlink(tempPath);
        } catch {
          // Ignore cleanup errors
        }
        throw error;
      }
    } else {
      // Direct write (not atomic, but slightly faster)
      await fs.writeFile(fullPath, buffer, { mode: this.config.fileMode });
    }
  }

  /**
   * Read a file's content.
   * @throws Error if file doesn't exist
   */
  async read(filePath: string): Promise<Buffer> {
    await this.ensureInitialized();

    const fullPath = this.resolvePath(filePath);

    try {
      return await fs.readFile(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new Error(`File not found: ${filePath}`);
      }
      throw error;
    }
  }

  /**
   * List files matching a prefix.
   * Results are sorted by lastModified ascending (oldest first).
   */
  async list(prefix: string): Promise<FileInfo[]> {
    await this.ensureInitialized();

    const searchPath = this.resolvePath(prefix);
    const baseDir = this.config.baseDir;

    // Use fast-glob to find files
    // Create patterns that match both files with the prefix and files within a directory with that name
    const hasTrailingSlash = searchPath.endsWith(path.sep) || searchPath.endsWith('/');
    const patterns = hasTrailingSlash
      ? [`${searchPath}**/*`]
      : [`${searchPath}*`, `${searchPath}/**/*`];

    const files = await fg(patterns, {
      onlyFiles: true,
      stats: true,
      absolute: true,
    });

    // Map to FileInfo and sort by lastModified
    const fileInfos: FileInfo[] = files.map(file => {
      const stats = file.stats!;
      // Convert absolute path back to relative
      const relativePath = path.relative(baseDir, file.path);

      return {
        path: relativePath,
        size: stats.size,
        lastModified: stats.mtime,
      };
    });

    // Sort by lastModified ascending (oldest first - for FIFO processing)
    fileInfos.sort((a, b) => a.lastModified.getTime() - b.lastModified.getTime());

    return fileInfos;
  }

  /**
   * Delete a file.
   * No-op if file doesn't exist.
   */
  async delete(filePath: string): Promise<void> {
    await this.ensureInitialized();

    const fullPath = this.resolvePath(filePath);

    try {
      await fs.unlink(fullPath);
    } catch (error) {
      // Ignore ENOENT (file doesn't exist)
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Move/rename a file.
   * Creates destination directory if it doesn't exist.
   * Used for marking files as processed.
   */
  async move(from: string, to: string): Promise<void> {
    await this.ensureInitialized();

    const fromPath = this.resolvePath(from);
    const toPath = this.resolvePath(to);

    // Ensure destination directory exists
    const toDir = path.dirname(toPath);
    await fs.mkdir(toDir, { recursive: true, mode: this.config.dirMode });

    await fs.rename(fromPath, toPath);
  }

  /**
   * Check if a file exists.
   */
  async exists(filePath: string): Promise<boolean> {
    await this.ensureInitialized();

    const fullPath = this.resolvePath(filePath);

    try {
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the base directory.
   */
  getBaseDir(): string {
    return this.config.baseDir;
  }

  /**
   * Get the current configuration.
   */
  getConfig(): Readonly<Required<LocalFileStorageConfig>> {
    return { ...this.config };
  }
}
