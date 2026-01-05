/**
 * Workspace Module
 *
 * Exports the workspace interface, factory functions, and types.
 * Consumers should use factory functions which return interface types.
 */

// ============================================================================
// Interface & Types (primary exports for consumers)
// ============================================================================

export type {
  // Core interface
  Workspace,
  WorkspaceFactory,
  WorkspaceAudit,

  // Core types
  WorkspaceScope,
  WorkspaceOwner,
  WorkspaceStatus,
  WorkspaceInfo,
  SyncResult,
  SnapshotOptions,
  WorkspaceSnapshot,
  RestoreOptions,
  WorkspaceAuditEntry,
  WorkspaceAuditOptions,

  // Configuration types
  WorkspaceConfig,
  ThreadWorkspaceConfig,
  ThreadFilesystemConfig,
  ThreadExecutorConfig,
  AgentWorkspaceConfig,
  AgentLevelWorkspaceConfig,
  ThreadLevelWorkspaceConfig,
  HybridWorkspaceConfig,
} from './types';

// Errors
export {
  WorkspaceError,
  WorkspaceNotFoundError,
  WorkspaceNotReadyError,
  FilesystemNotAvailableError,
  ExecutorNotAvailableError,
  WorkspaceLimitError,
} from './types';

// ============================================================================
// Factory Functions (recommended way to create instances)
// ============================================================================

export {
  createWorkspace,
  createLocalWorkspace,
  createMemoryWorkspace,
} from './workspace';

// ============================================================================
// Base Class (for implementers creating custom workspaces)
// ============================================================================

export { BaseWorkspace } from './workspace';
