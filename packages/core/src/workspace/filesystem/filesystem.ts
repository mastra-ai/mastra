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

import type { RequestContext } from '../../request-context';
import type { FilesystemLifecycle, ProviderStatus } from '../lifecycle';
import type { FilesystemMountConfig, FilesystemIcon } from './mount';

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
  /** Whether this entry is a symbolic link */
  isSymlink?: boolean;
  /** Target path of the symlink (only set if isSymlink is true) */
  symlinkTarget?: string;
  /** Mount point metadata (only set for CompositeFilesystem mount points) */
  mount?: {
    provider: string;
    icon?: FilesystemIcon;
    displayName?: string;
    description?: string;
    status?: ProviderStatus;
    error?: string;
  };
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

// =============================================================================
// Filesystem Info
// =============================================================================

/**
 * Information about a filesystem provider's current state.
 */
export interface FilesystemInfo<TMetadata extends Record<string, unknown> = Record<string, unknown>> {
  /** Unique identifier */
  id: string;
  /** Human-readable name */
  name: string;
  /** Provider type */
  provider: string;
  /** Current status (for stateful providers) */
  status?: ProviderStatus;
  /** Error message when status is 'error' */
  error?: string;
  /** Whether filesystem is read-only */
  readOnly?: boolean;
  /** Icon identifier for UI display */
  icon?: FilesystemIcon;
  /** Provider-specific metadata */
  metadata?: TMetadata;
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
 *
 * Lifecycle methods (from FilesystemLifecycle interface) are all optional:
 * - init(): One-time setup (create directories, tables)
 * - destroy(): Clean up resources
 * - isReady(): Check if ready for operations
 * - getInfo(): Get status and metadata
 */
export interface WorkspaceFilesystem extends FilesystemLifecycle<FilesystemInfo> {
  /** Unique identifier for this filesystem instance */
  readonly id: string;

  /** Human-readable name (e.g., 'LocalFilesystem', 'AgentFS') */
  readonly name: string;

  /** Provider type identifier */
  readonly provider: string;

  /**
   * When true, all write operations to this filesystem are blocked.
   * Read operations are still allowed.
   *
   * @default false
   */
  readonly readOnly?: boolean;

  /**
   * Base path on disk where files are stored (if applicable).
   * Not all filesystem implementations have a base path (e.g., in-memory filesystems).
   */
  readonly basePath?: string;

  /**
   * Icon identifier for UI display.
   * Used by CompositeFilesystem to show different icons for mount points.
   */
  readonly icon?: FilesystemIcon;

  /**
   * Human-friendly display name for the UI.
   * Shown instead of provider name when available.
   */
  readonly displayName?: string;

  /**
   * Description shown in tooltips or help text.
   */
  readonly description?: string;

  /**
   * Get instructions describing how this filesystem works.
   * Used in tool descriptions to help agents understand path semantics.
   *
   * @param opts - Optional options including request context for per-request customisation
   * @returns A string describing how to use this filesystem
   */
  getInstructions?(opts?: { requestContext?: RequestContext }): string;

  /**
   * Get mount configuration for this filesystem.
   * Used by sandboxes that support FUSE mounting (e.g., E2B with s3fs).
   *
   * @returns Mount configuration for the filesystem
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
   * Resolve a workspace-relative path to an absolute disk path.
   *
   * Used by LSP and other features that need the real filesystem location
   * of a file. The resolution depends on the filesystem's containment mode:
   * - `contained: true` — `/file.ts` resolves to `basePath/file.ts`
   * - `contained: false` — `/file.ts` stays as `/file.ts` (real host path)
   *
   * Returns `undefined` if the filesystem doesn't support disk-path resolution
   * (e.g., remote/in-memory filesystems).
   */
  resolveAbsolutePath?(path: string): string | undefined;

  /**
   * Check if a path exists.
   */
  exists(path: string): Promise<boolean>;

  /**
   * Get file/directory metadata.
   * @throws {FileNotFoundError} if path doesn't exist
   */
  stat(path: string): Promise<FileStat>;
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
