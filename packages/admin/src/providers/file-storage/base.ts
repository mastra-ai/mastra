import type { FileInfo } from '../../types';

/**
 * Abstract interface for file storage operations.
 * Used for observability data persistence.
 *
 * Implementations:
 * - LocalFileStorage (observability/file-local/)
 * - S3FileStorage (observability/file-s3/)
 * - GCSFileStorage (observability/file-gcs/)
 */
export interface FileStorageProvider {
  /** Storage type identifier */
  readonly type: 'local' | 's3' | 'gcs' | string;

  /**
   * Write content to a file.
   * Creates parent directories if they don't exist.
   */
  write(path: string, content: Buffer | string): Promise<void>;

  /**
   * Read a file's content.
   * @throws Error if file doesn't exist
   */
  read(path: string): Promise<Buffer>;

  /**
   * List files matching a prefix.
   * Results are sorted by lastModified ascending (oldest first).
   */
  list(prefix: string): Promise<FileInfo[]>;

  /**
   * Delete a file.
   * No-op if file doesn't exist.
   */
  delete(path: string): Promise<void>;

  /**
   * Move/rename a file.
   * Used for marking files as processed.
   */
  move(from: string, to: string): Promise<void>;

  /**
   * Check if a file exists.
   */
  exists(path: string): Promise<boolean>;
}
