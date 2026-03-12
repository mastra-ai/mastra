/**
 * Workspace Errors
 *
 * Error classes for workspace operations.
 */

import type { WorkspaceStatus } from './types';

// =============================================================================
// Base Error
// =============================================================================

export class WorkspaceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly workspaceId?: string,
  ) {
    super(message);
    this.name = 'WorkspaceError';
  }
}

// =============================================================================
// Availability Errors
// =============================================================================

export class WorkspaceNotAvailableError extends WorkspaceError {
  constructor() {
    super('Workspace not available. Ensure the agent has a workspace configured.', 'NO_WORKSPACE');
    this.name = 'WorkspaceNotAvailableError';
  }
}

export class FilesystemNotAvailableError extends WorkspaceError {
  constructor() {
    super('Workspace does not have a filesystem configured', 'NO_FILESYSTEM');
    this.name = 'FilesystemNotAvailableError';
  }
}

export class SandboxNotAvailableError extends WorkspaceError {
  constructor(message?: string) {
    super(message ?? 'Workspace does not have a sandbox configured', 'NO_SANDBOX');
    this.name = 'SandboxNotAvailableError';
  }
}

export class SandboxFeatureNotSupportedError extends WorkspaceError {
  constructor(feature: 'executeCommand' | 'installPackage' | 'processes') {
    super(`Sandbox does not support ${feature}`, 'FEATURE_NOT_SUPPORTED');
    this.name = 'SandboxFeatureNotSupportedError';
  }
}

export class SearchNotAvailableError extends WorkspaceError {
  constructor() {
    super('Workspace does not have search configured (enable bm25 or provide vectorStore + embedder)', 'NO_SEARCH');
    this.name = 'SearchNotAvailableError';
  }
}

// =============================================================================
// State Errors
// =============================================================================

export class WorkspaceNotReadyError extends WorkspaceError {
  constructor(workspaceId: string, status: WorkspaceStatus) {
    super(`Workspace is not ready (status: ${status})`, 'NOT_READY', workspaceId);
    this.name = 'WorkspaceNotReadyError';
  }
}

export class WorkspaceReadOnlyError extends WorkspaceError {
  constructor(operation: string) {
    super(`Workspace is in read-only mode. Cannot perform: ${operation}`, 'READ_ONLY');
    this.name = 'WorkspaceReadOnlyError';
  }
}

// =============================================================================
// Filesystem Errors
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
  constructor(
    path: string,
    public readonly operation: string,
  ) {
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

/**
 * Error thrown when a filesystem operation is attempted before initialization.
 */
export class FilesystemNotReadyError extends FilesystemError {
  constructor(id: string) {
    super(`Filesystem "${id}" is not ready. Call init() first or use ensureReady().`, 'ENOTREADY', id);
    this.name = 'FilesystemNotReadyError';
  }
}
