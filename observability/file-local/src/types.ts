/**
 * Configuration for LocalFileStorage provider.
 */
export interface LocalFileStorageConfig {
  /**
   * Base directory for all file operations.
   * All paths will be relative to this directory.
   * Must be an absolute path.
   */
  baseDir: string;

  /**
   * File permissions for created files (octal).
   * @default 0o644
   */
  fileMode?: number;

  /**
   * Directory permissions for created directories (octal).
   * @default 0o755
   */
  dirMode?: number;

  /**
   * Use atomic writes (write to temp file, then rename).
   * Prevents partial writes on crashes.
   * @default true
   */
  atomicWrites?: boolean;

  /**
   * Custom temp directory for atomic writes.
   * @default `${baseDir}/.tmp`
   */
  tempDir?: string;
}
