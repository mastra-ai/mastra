/**
 * Workspace Filesystem Interface
 *
 * Provides a unified interface for filesystem operations.
 * Implementations can be backed by AgentFS, local disk, S3, memory, etc.
 */

// =============================================================================
// Core Types
// =============================================================================

export type FileContent = string | Buffer | Uint8Array;

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

export interface FileEntry {
  name: string;
  type: 'file' | 'directory';
  size?: number;
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
 * All paths are absolute within the filesystem's namespace.
 * Implementations handle path normalization.
 */
export interface WorkspaceFilesystem {
  /** Unique identifier for this filesystem instance */
  readonly id: string;

  /** Human-readable name (e.g., 'AgentFS', 'LocalFS') */
  readonly name: string;

  /** Provider type identifier */
  readonly provider: string;

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
// State Storage Interface (Optional KV layer on top of FS)
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
// Audit Interface (Optional)
// =============================================================================

export interface AuditEntry {
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

export interface AuditOptions {
  /** Filter by operation type */
  operations?: AuditEntry['operation'][];
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
  getHistory(options?: AuditOptions): Promise<AuditEntry[]>;

  /**
   * Get the total count of audit entries matching the filter.
   */
  count(options?: Omit<AuditOptions, 'limit' | 'offset'>): Promise<number>;
}

// =============================================================================
// Provider Configuration
// =============================================================================

export interface FilesystemProviderConfig {
  /** Unique ID for this filesystem instance */
  id: string;
}

export interface AgentFSProviderConfig extends FilesystemProviderConfig {
  provider: 'agentfs';
  /** Path to the AgentFS database file */
  path: string;
  /** Optional: Create if doesn't exist (default: true) */
  create?: boolean;
}

export interface LocalFSProviderConfig extends FilesystemProviderConfig {
  provider: 'local';
  /** Base directory path */
  basePath: string;
  /** Restrict operations to basePath (default: true) */
  sandbox?: boolean;
}

export interface MemoryFSProviderConfig extends FilesystemProviderConfig {
  provider: 'memory';
  /** Optional: Initial files to populate */
  initialFiles?: Record<string, FileContent>;
}

export interface S3FSProviderConfig extends FilesystemProviderConfig {
  provider: 's3';
  bucket: string;
  region?: string;
  prefix?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
}

export type FilesystemConfig =
  | AgentFSProviderConfig
  | LocalFSProviderConfig
  | MemoryFSProviderConfig
  | S3FSProviderConfig;

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
