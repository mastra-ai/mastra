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
  constructor(feature: 'executeCommand' | 'installPackage') {
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
