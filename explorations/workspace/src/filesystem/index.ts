/**
 * Filesystem Module
 *
 * Exports the filesystem interface, factory functions, and types.
 * Consumers should use factory functions which return interface types.
 */

// ============================================================================
// Interface & Types (primary exports for consumers)
// ============================================================================

export type {
  // Core interface
  WorkspaceFilesystem,
  WorkspaceState,
  WorkspaceFilesystemAudit,

  // Core types
  FileContent,
  FileStat,
  FileEntry,
  ReadOptions,
  WriteOptions,
  ListOptions,
  RemoveOptions,
  CopyOptions,
  WatchEvent,
  WatchCallback,
  WatchOptions,
  WatchHandle,

  // Audit types
  AuditEntry,
  AuditOptions,

  // Configuration types
  FilesystemConfig,
  FilesystemProviderConfig,
  AgentFSProviderConfig,
  LocalFSProviderConfig,
  MemoryFSProviderConfig,
  S3FSProviderConfig,
} from './types';

// Errors
export {
  FilesystemError,
  FileNotFoundError,
  DirectoryNotFoundError,
  FileExistsError,
  IsDirectoryError,
  NotDirectoryError,
  DirectoryNotEmptyError,
  PermissionError,
} from './types';

// ============================================================================
// Factory Functions (recommended way to create instances)
// ============================================================================

export { createFilesystem, createMemoryFilesystem, createLocalFilesystem } from './factory';

// ============================================================================
// Base Class (for implementers creating new providers)
// ============================================================================

export { BaseFilesystem } from './base';

// ============================================================================
// Provider Implementations (for advanced use cases)
// ============================================================================

// Export concrete implementations for cases where direct instantiation is needed
export { MemoryFilesystem, type MemoryFilesystemOptions } from './providers/memory';
export { LocalFilesystem, type LocalFilesystemOptions } from './providers/local';
