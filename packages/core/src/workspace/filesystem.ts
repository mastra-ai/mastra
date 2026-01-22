/**
 * Workspace Filesystem Interface
 *
 * Defines the contract for filesystem providers that can be used with Workspace.
 * Users pass filesystem provider instances to the Workspace constructor.
 *
 * Built-in providers:
 * - LocalFilesystem: A folder on the user's machine
 * - AgentFS: Turso-backed filesystem with audit trail
 *
 * @example
 * ```typescript
 * import { Workspace } from '@mastra/core';
 * import { LocalFilesystem } from '@mastra/workspace-fs-local';
 *
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './my-workspace' }),
 * });
 * ```
 */

// =============================================================================
// Core Types
// =============================================================================

export type FileContent = string | Buffer | Uint8Array;

/**
 * Known filesystem icon identifiers for UI rendering.
 * Allows any string but provides autocomplete for common providers.
 */
export type FilesystemIcon =
  | 'aws-s3'
  | 'google-cloud'
  | 'cloudflare'
  | 'azure-blob'
  | 'folder'
  | 'folder-open'
  | 'database'
  | 'hard-drive'
  | 'cloud'
  | (string & {});

// =============================================================================
// Mount Configuration Types
// =============================================================================

/**
 * Base configuration for mounting a filesystem into a sandbox.
 *
 * Each filesystem provider defines its own specific config type that extends this.
 * Sandboxes interpret the config based on the `type` field.
 *
 * Examples:
 * - LocalFilesystem returns { type: 'local', basePath: '/path/on/disk' }
 * - S3Filesystem returns { type: 's3', bucket: '...', credentials: {...} }
 *
 * The specific config types are owned by their respective filesystem packages,
 * not defined centrally. This base interface just ensures a `type` discriminator.
 */
export interface FilesystemMountConfig {
  /** Discriminator for the mount config type (e.g., 'local', 's3', 'gcs') */
  type: string;
  /** Provider-specific configuration */
  [key: string]: unknown;
}

export interface FileStat {
  /** File or directory name */
  name: string;
  /** Absolute path */
  path: string;
  /** 'file' or 'directory' */
  type: 'file' | 'directory';
  /** Size in bytes (0 for directories) */
  size: number;
  /** Creation time */
  createdAt: Date;
  /** Last modification time */
  modifiedAt: Date;
  /** MIME type (for files) */
  mimeType?: string;
}

/**
 * Mount point metadata for UI display.
 * Included in FileEntry when the entry represents a mount point.
 */
export interface MountInfo {
  /** Filesystem provider type (e.g., 's3', 'local', 'gcs') */
  provider: string;
  /** Icon identifier for the UI */
  icon?: FilesystemIcon;
  /** Human-friendly display name */
  displayName?: string;
  /** Description for tooltips */
  description?: string;
}

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
  /** If this directory is a mount point, contains mount metadata */
  mount?: MountInfo;
}

export interface ReadOptions {
  /** Encoding for text files. If not specified, returns Buffer */
  encoding?: BufferEncoding;
}

export interface WriteOptions {
  /** Create parent directories if they don't exist */
  recursive?: boolean;
  /** Overwrite existing file (default: true) */
  overwrite?: boolean;
  /** MIME type hint */
  mimeType?: string;
}

export interface ListOptions {
  /** Include files in subdirectories */
  recursive?: boolean;
  /** Filter by file extension (e.g., '.ts', '.py') */
  extension?: string | string[];
  /** Maximum depth for recursive listing */
  maxDepth?: number;
}

export interface RemoveOptions {
  /** Remove directories and their contents */
  recursive?: boolean;
  /** Don't throw if path doesn't exist */
  force?: boolean;
}

export interface CopyOptions {
  /** Overwrite existing files */
  overwrite?: boolean;
  /** Copy directories recursively */
  recursive?: boolean;
}

export interface WatchEvent {
  type: 'create' | 'modify' | 'delete';
  path: string;
  stat?: FileStat;
}

export type WatchCallback = (event: WatchEvent) => void | Promise<void>;

export interface WatchOptions {
  /** Watch subdirectories */
  recursive?: boolean;
  /** Debounce time in milliseconds */
  debounce?: number;
}

export interface WatchHandle {
  /** Stop watching */
  unsubscribe(): void;
}

// =============================================================================
// Filesystem Interface
// =============================================================================

/**
 * Abstract filesystem interface for workspace storage.
 *
 * Providers implement this interface to provide file storage capabilities.
 * Users instantiate providers and pass them to the Workspace constructor.
 *
 * All paths are absolute within the filesystem's namespace.
 * Implementations handle path normalization.
 */
export interface WorkspaceFilesystem {
  /** Unique identifier for this filesystem instance */
  readonly id: string;

  /** Human-readable name (e.g., 'LocalFilesystem', 'AgentFS') */
  readonly name: string;

  /** Provider type identifier (e.g., 'local', 's3', 'gcs') */
  readonly provider: string;

  // ---------------------------------------------------------------------------
  // Display Metadata (optional - for UI rendering)
  // ---------------------------------------------------------------------------

  /**
   * Human-friendly display name for the UI.
   * If not provided, UI can fall back to `name`.
   * @example "My Data Bucket", "Production Assets"
   */
  readonly displayName?: string;

  /**
   * Icon identifier for the UI.
   * Can be a provider name (e.g., 'aws-s3', 'google-cloud'), emoji, or icon library name.
   * If not provided, UI can derive from `provider`.
   * @example "aws-s3", "folder", "🪣"
   */
  readonly icon?: FilesystemIcon;

  /**
   * Description shown in tooltips or info panels.
   * @example "S3 bucket for storing agent outputs"
   */
  readonly description?: string;

  // ---------------------------------------------------------------------------
  // Mount Support (optional capability)
  // ---------------------------------------------------------------------------

  /**
   * Whether this filesystem can be mounted into a sandbox.
   * When true, sandboxes can use getMountConfig() to get mount configuration.
   *
   * Mountable filesystems (e.g., LocalFilesystem, S3Filesystem) can be
   * directly accessed from sandbox code at the mount path.
   *
   * Non-mountable filesystems (e.g., DatabaseFilesystem) require sync mode
   * where files are copied between the filesystem and sandbox.
   */
  readonly supportsMounting?: boolean;

  /**
   * Get configuration for mounting this filesystem.
   * Only available when supportsMounting is true.
   *
   * Sandboxes use this config to mount the filesystem in their own way:
   * - LocalSandbox: Uses the basePath directly (same directory)
   * - E2BSandbox: Uses s3fs/gcsfuse for cloud storage
   * - DockerSandbox: Uses volume mounts
   *
   * @returns Mount configuration for sandboxes to use
   */
  getMountConfig?(): FilesystemMountConfig;

  // ---------------------------------------------------------------------------
  // File Operations
  // ---------------------------------------------------------------------------

  /**
   * Read a file's contents.
   * @throws {FileNotFoundError} if file doesn't exist
   * @throws {IsDirectoryError} if path is a directory
   */
  readFile(path: string, options?: ReadOptions): Promise<string | Buffer>;

  /**
   * Write content to a file.
   * Creates the file if it doesn't exist.
   * @throws {DirectoryNotFoundError} if parent directory doesn't exist and recursive is false
   * @throws {FileExistsError} if file exists and overwrite is false
   */
  writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void>;

  /**
   * Append content to a file.
   * Creates the file if it doesn't exist.
   */
  appendFile(path: string, content: FileContent): Promise<void>;

  /**
   * Delete a file.
   * @throws {FileNotFoundError} if file doesn't exist and force is false
   * @throws {IsDirectoryError} if path is a directory
   */
  deleteFile(path: string, options?: RemoveOptions): Promise<void>;

  /**
   * Copy a file to a new location.
   * @throws {FileNotFoundError} if source doesn't exist
   * @throws {FileExistsError} if destination exists and overwrite is false
   */
  copyFile(src: string, dest: string, options?: CopyOptions): Promise<void>;

  /**
   * Move/rename a file.
   * @throws {FileNotFoundError} if source doesn't exist
   * @throws {FileExistsError} if destination exists and overwrite is false
   */
  moveFile(src: string, dest: string, options?: CopyOptions): Promise<void>;

  // ---------------------------------------------------------------------------
  // Directory Operations
  // ---------------------------------------------------------------------------

  /**
   * Create a directory.
   * @throws {FileExistsError} if path already exists as a file
   */
  mkdir(path: string, options?: { recursive?: boolean }): Promise<void>;

  /**
   * Remove a directory.
   * @throws {DirectoryNotFoundError} if directory doesn't exist and force is false
   * @throws {DirectoryNotEmptyError} if directory is not empty and recursive is false
   */
  rmdir(path: string, options?: RemoveOptions): Promise<void>;

  /**
   * List directory contents.
   * @throws {DirectoryNotFoundError} if directory doesn't exist
   * @throws {NotDirectoryError} if path is a file
   */
  readdir(path: string, options?: ListOptions): Promise<FileEntry[]>;

  // ---------------------------------------------------------------------------
  // Path Operations
  // ---------------------------------------------------------------------------

  /**
   * Check if a path exists.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file/directory metadata.
   * @throws {FileNotFoundError} if path doesn't exist
   */
  stat(path: string): Promise<FileStat>;

  /**
   * Check if path is a file.
   */
  isFile(path: string): Promise<boolean>;

  /**
   * Check if path is a directory.
   */
  isDirectory(path: string): Promise<boolean>;

  // ---------------------------------------------------------------------------
  // Watch Operations (optional)
  // ---------------------------------------------------------------------------

  /**
   * Watch for changes to a path.
   * Returns undefined if watching is not supported.
   */
  watch?(path: string, callback: WatchCallback, options?: WatchOptions): Promise<WatchHandle | undefined>;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize the filesystem (create tables, connect, etc.)
   */
  init?(): Promise<void>;

  /**
   * Clean up resources.
   */
  destroy?(): Promise<void>;
}

// =============================================================================
// State Storage Interface (Optional KV layer)
// =============================================================================

/**
 * Key-value state storage, typically backed by the filesystem.
 * Provides structured data storage for agent state.
 */
export interface WorkspaceState {
  /**
   * Get a value by key.
   * @returns The value, or null if not found
   */
  get<T = unknown>(key: string): Promise<T | null>;

  /**
   * Set a value for a key.
   */
  set<T = unknown>(key: string, value: T): Promise<void>;

  /**
   * Delete a key.
   * @returns true if the key existed
   */
  delete(key: string): Promise<boolean>;

  /**
   * Check if a key exists.
   */
  has(key: string): Promise<boolean>;

  /**
   * List all keys, optionally filtered by prefix.
   */
  keys(prefix?: string): Promise<string[]>;

  /**
   * Clear all state.
   */
  clear(): Promise<void>;
}

// =============================================================================
// Audit Interface (Optional - for providers like AgentFS)
// =============================================================================

export interface FilesystemAuditEntry {
  /** Unique ID for this entry */
  id: string;
  /** Timestamp of the operation */
  timestamp: Date;
  /** Type of operation */
  operation: 'read' | 'write' | 'delete' | 'mkdir' | 'rmdir' | 'copy' | 'move';
  /** Path affected */
  path: string;
  /** Additional path (for copy/move) */
  targetPath?: string;
  /** Size of content (for write operations) */
  size?: number;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface FilesystemAuditOptions {
  /** Filter by operation type */
  operations?: FilesystemAuditEntry['operation'][];
  /** Filter by path prefix */
  pathPrefix?: string;
  /** Start time */
  since?: Date;
  /** End time */
  until?: Date;
  /** Maximum entries to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Audit trail for filesystem operations.
 * Implementations like AgentFS provide this; others may not.
 */
export interface WorkspaceFilesystemAudit {
  /**
   * Get audit history for filesystem operations.
   */
  getHistory(options?: FilesystemAuditOptions): Promise<FilesystemAuditEntry[]>;

  /**
   * Get the total count of audit entries matching the filter.
   */
  count(options?: Omit<FilesystemAuditOptions, 'limit' | 'offset'>): Promise<number>;
}

// =============================================================================
// Errors
// =============================================================================

export class FilesystemError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly path: string,
  ) {
    super(message);
    this.name = 'FilesystemError';
  }
}

export class FileNotFoundError extends FilesystemError {
  constructor(path: string) {
    super(`File not found: ${path}`, 'ENOENT', path);
    this.name = 'FileNotFoundError';
  }
}

export class DirectoryNotFoundError extends FilesystemError {
  constructor(path: string) {
    super(`Directory not found: ${path}`, 'ENOENT', path);
    this.name = 'DirectoryNotFoundError';
  }
}

export class FileExistsError extends FilesystemError {
  constructor(path: string) {
    super(`File already exists: ${path}`, 'EEXIST', path);
    this.name = 'FileExistsError';
  }
}

export class IsDirectoryError extends FilesystemError {
  constructor(path: string) {
    super(`Path is a directory: ${path}`, 'EISDIR', path);
    this.name = 'IsDirectoryError';
  }
}

export class NotDirectoryError extends FilesystemError {
  constructor(path: string) {
    super(`Path is not a directory: ${path}`, 'ENOTDIR', path);
    this.name = 'NotDirectoryError';
  }
}

export class DirectoryNotEmptyError extends FilesystemError {
  constructor(path: string) {
    super(`Directory not empty: ${path}`, 'ENOTEMPTY', path);
    this.name = 'DirectoryNotEmptyError';
  }
}

export class PermissionError extends FilesystemError {
  constructor(path: string, operation: string) {
    super(`Permission denied: ${operation} on ${path}`, 'EACCES', path);
    this.name = 'PermissionError';
  }
}

export class FileReadRequiredError extends FilesystemError {
  constructor(path: string, reason: string) {
    super(reason, 'EREAD_REQUIRED', path);
    this.name = 'FileReadRequiredError';
  }
}
