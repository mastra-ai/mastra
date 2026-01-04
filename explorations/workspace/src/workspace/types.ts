/**
 * Workspace Interface
 *
 * A Workspace combines a Filesystem and an Executor to provide agents
 * with a complete environment for storing files and executing code.
 *
 * Workspaces can be scoped at different levels:
 * - Agent-level: Shared across all threads for an agent
 * - Thread-level: Isolated per conversation thread
 * - Global: Shared across all agents
 */

import type {
  WorkspaceFilesystem,
  WorkspaceState,
  WorkspaceFilesystemAudit,
  FilesystemConfig,
  FileEntry,
  FileStat,
  FileContent,
  ReadOptions,
  WriteOptions,
  ListOptions,
} from '../filesystem/types';
import type {
  WorkspaceExecutor,
  ExecutorConfig,
  ExecuteCodeOptions,
  ExecuteCommandOptions,
  CodeResult,
  CommandResult,
  Runtime,
  ExecutorStatus,
} from '../executor/types';

// =============================================================================
// Workspace Scope
// =============================================================================

/**
 * Determines how the workspace is scoped and shared.
 */
export type WorkspaceScope =
  | 'global' // Shared across all agents
  | 'agent' // Shared across all threads for a single agent
  | 'thread'; // Isolated per conversation thread

/**
 * Identifies the owner of a workspace.
 */
export interface WorkspaceOwner {
  /** Scope of the workspace */
  scope: WorkspaceScope;
  /** Agent ID (for agent and thread scopes) */
  agentId?: string;
  /** Thread ID (for thread scope only) */
  threadId?: string;
}

// =============================================================================
// Workspace Interface
// =============================================================================

/**
 * A Workspace provides agents with filesystem and execution capabilities.
 *
 * At minimum, a workspace has either a filesystem or an executor (or both).
 */
export interface Workspace {
  /** Unique identifier for this workspace instance */
  readonly id: string;

  /** Human-readable name */
  readonly name: string;

  /** Scope of this workspace */
  readonly scope: WorkspaceScope;

  /** Owner information */
  readonly owner: WorkspaceOwner;

  /** Current status */
  readonly status: WorkspaceStatus;

  /** When this workspace was created */
  readonly createdAt: Date;

  /** When this workspace was last accessed */
  readonly lastAccessedAt: Date;

  // ---------------------------------------------------------------------------
  // Components
  // ---------------------------------------------------------------------------

  /**
   * Filesystem for persistent storage.
   * May be undefined if workspace only has an executor.
   */
  readonly fs?: WorkspaceFilesystem;

  /**
   * Key-value state storage (convenience layer over fs).
   * Available when fs is present.
   */
  readonly state?: WorkspaceState;

  /**
   * Executor for code and command execution.
   * May be undefined if workspace only has a filesystem.
   */
  readonly executor?: WorkspaceExecutor;

  /**
   * Audit trail for operations.
   * Available for providers that support it (e.g., AgentFS).
   */
  readonly audit?: WorkspaceAudit;

  // ---------------------------------------------------------------------------
  // Convenience Methods (delegate to fs/executor)
  // ---------------------------------------------------------------------------

  /**
   * Read a file from the workspace filesystem.
   * @throws {Error} if filesystem is not available
   */
  readFile(path: string, options?: ReadOptions): Promise<string | Buffer>;

  /**
   * Write a file to the workspace filesystem.
   * @throws {Error} if filesystem is not available
   */
  writeFile(path: string, content: FileContent, options?: WriteOptions): Promise<void>;

  /**
   * List directory contents.
   * @throws {Error} if filesystem is not available
   */
  readdir(path: string, options?: ListOptions): Promise<FileEntry[]>;

  /**
   * Check if a path exists.
   * @throws {Error} if filesystem is not available
   */
  exists(path: string): Promise<boolean>;

  /**
   * Execute code in the sandbox.
   * @throws {Error} if executor is not available
   */
  executeCode(code: string, options?: ExecuteCodeOptions): Promise<CodeResult>;

  /**
   * Execute a command in the sandbox.
   * @throws {Error} if executor is not available
   */
  executeCommand(command: string, args?: string[], options?: ExecuteCommandOptions): Promise<CommandResult>;

  // ---------------------------------------------------------------------------
  // Sync Operations (when both fs and executor are present)
  // ---------------------------------------------------------------------------

  /**
   * Sync files from the workspace filesystem to the executor.
   * Useful for making persisted files available for execution.
   *
   * @param paths - Paths to sync (default: all files)
   * @throws {Error} if either fs or executor is not available
   */
  syncToExecutor?(paths?: string[]): Promise<SyncResult>;

  /**
   * Sync files from the executor back to the workspace filesystem.
   * Useful for persisting execution outputs.
   *
   * @param paths - Paths to sync (default: all modified files)
   * @throws {Error} if either fs or executor is not available
   */
  syncFromExecutor?(paths?: string[]): Promise<SyncResult>;

  // ---------------------------------------------------------------------------
  // Snapshots
  // ---------------------------------------------------------------------------

  /**
   * Create a snapshot of the current workspace state.
   * Captures filesystem contents (and optionally executor state).
   */
  snapshot?(options?: SnapshotOptions): Promise<WorkspaceSnapshot>;

  /**
   * Restore workspace from a snapshot.
   */
  restore?(snapshot: WorkspaceSnapshot, options?: RestoreOptions): Promise<void>;

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Initialize the workspace (start executor, init fs, etc.)
   */
  init(): Promise<void>;

  /**
   * Pause the workspace (stop executor but keep state).
   */
  pause?(): Promise<void>;

  /**
   * Resume a paused workspace.
   */
  resume?(): Promise<void>;

  /**
   * Destroy the workspace and clean up all resources.
   * For thread workspaces, this is called when the thread ends.
   */
  destroy(): Promise<void>;

  /**
   * Extend the workspace timeout (for providers that have timeouts).
   */
  keepAlive?(): Promise<void>;

  /**
   * Get workspace information.
   */
  getInfo(): Promise<WorkspaceInfo>;
}

// =============================================================================
// Workspace Status & Info
// =============================================================================

export type WorkspaceStatus = 'pending' | 'initializing' | 'ready' | 'paused' | 'error' | 'destroying' | 'destroyed';

export interface WorkspaceInfo {
  id: string;
  name: string;
  scope: WorkspaceScope;
  owner: WorkspaceOwner;
  status: WorkspaceStatus;
  createdAt: Date;
  lastAccessedAt: Date;

  /** Filesystem info (if available) */
  filesystem?: {
    provider: string;
    totalFiles?: number;
    totalSize?: number;
  };

  /** Executor info (if available) */
  executor?: {
    provider: string;
    status: ExecutorStatus;
    supportedRuntimes: readonly Runtime[];
    resources?: {
      memoryUsedMb?: number;
      memoryLimitMb?: number;
    };
  };

  /** Time until workspace auto-destroys (if applicable) */
  expiresAt?: Date;
}

// =============================================================================
// Sync Types
// =============================================================================

export interface SyncResult {
  /** Files that were synced */
  synced: string[];
  /** Files that failed to sync */
  failed: Array<{ path: string; error: string }>;
  /** Total bytes transferred */
  bytesTransferred: number;
  /** Duration in milliseconds */
  duration: number;
}

// =============================================================================
// Snapshot Types
// =============================================================================

export interface SnapshotOptions {
  /** Include executor state (if supported) */
  includeExecutor?: boolean;
  /** Only snapshot specific paths */
  paths?: string[];
  /** Snapshot name/description */
  name?: string;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

export interface WorkspaceSnapshot {
  id: string;
  workspaceId: string;
  name?: string;
  createdAt: Date;
  /** Size in bytes */
  size: number;
  /** Provider-specific snapshot data */
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface RestoreOptions {
  /** Merge with existing state instead of replacing */
  merge?: boolean;
  /** Only restore specific paths */
  paths?: string[];
}

// =============================================================================
// Audit Types (Extended for Workspace)
// =============================================================================

export interface WorkspaceAuditEntry {
  id: string;
  timestamp: Date;
  category: 'filesystem' | 'executor' | 'state' | 'lifecycle';
  operation: string;
  path?: string;
  details?: Record<string, unknown>;
  duration?: number;
  success: boolean;
  error?: string;
}

export interface WorkspaceAuditOptions {
  category?: WorkspaceAuditEntry['category'][];
  operations?: string[];
  since?: Date;
  until?: Date;
  limit?: number;
  offset?: number;
}

export interface WorkspaceAudit {
  getHistory(options?: WorkspaceAuditOptions): Promise<WorkspaceAuditEntry[]>;
  count(options?: Omit<WorkspaceAuditOptions, 'limit' | 'offset'>): Promise<number>;
}

// =============================================================================
// Workspace Configuration
// =============================================================================

export interface WorkspaceConfig {
  /** Unique identifier (auto-generated if not provided) */
  id?: string;

  /** Human-readable name */
  name?: string;

  /** Scope of the workspace */
  scope: WorkspaceScope;

  /** Filesystem configuration (optional) */
  filesystem?: FilesystemConfig;

  /** Executor configuration (optional) */
  executor?: ExecutorConfig;

  /** Auto-initialize on creation (default: true) */
  autoInit?: boolean;

  /** Auto-sync between fs and executor (default: false) */
  autoSync?: boolean;

  /** Timeout before auto-destroy in milliseconds (for thread workspaces) */
  timeout?: number;

  /** Timeout for individual operations */
  operationTimeout?: number;
}

// =============================================================================
// Thread Workspace Configuration
// =============================================================================

/**
 * Configuration for thread-level workspace behavior.
 * This is used in Agent configuration to define how thread workspaces are created.
 */
export interface ThreadWorkspaceConfig {
  /** Enable thread-level workspaces */
  enabled: true;

  /** Filesystem configuration for each thread workspace */
  filesystem?: FilesystemConfig | ThreadFilesystemConfig;

  /** Executor configuration for each thread workspace */
  executor?: ExecutorConfig | ThreadExecutorConfig;

  /** Auto-destroy workspace when thread is inactive for this duration (ms) */
  inactivityTimeout?: number;

  /** Maximum number of concurrent thread workspaces per agent */
  maxConcurrent?: number;

  /** Template files to copy into each new thread workspace */
  template?: {
    /** Source workspace or directory to copy from */
    source: string | Workspace;
    /** Paths to copy (default: all) */
    paths?: string[];
  };

  /** Called when a new thread workspace is created */
  onCreate?: (workspace: Workspace, threadId: string) => Promise<void>;

  /** Called before a thread workspace is destroyed */
  onDestroy?: (workspace: Workspace, threadId: string) => Promise<void>;
}

/**
 * Thread-specific filesystem config (dynamically generates paths per thread)
 */
export interface ThreadFilesystemConfig {
  provider: 'agentfs' | 'local' | 'memory';
  /** Path pattern with {threadId} placeholder */
  pathPattern?: string;
  /** Use in-memory fs for each thread (fast, ephemeral) */
  ephemeral?: boolean;
}

/**
 * Thread-specific executor config
 */
export interface ThreadExecutorConfig {
  provider: ExecutorConfig['provider'];
  /** Pool executors across threads (reuse instead of create new) */
  pooled?: boolean;
  /** Maximum pool size */
  poolSize?: number;
}

// =============================================================================
// Agent Workspace Configuration (for AgentConfig)
// =============================================================================

/**
 * Workspace configuration at the agent level.
 * Supports both agent-scoped and thread-scoped workspaces.
 */
export type AgentWorkspaceConfig =
  | AgentLevelWorkspaceConfig
  | ThreadLevelWorkspaceConfig
  | HybridWorkspaceConfig;

/**
 * Single workspace shared across all threads for the agent.
 */
export interface AgentLevelWorkspaceConfig extends Omit<WorkspaceConfig, 'scope'> {
  scope: 'agent';
}

/**
 * Each thread gets its own isolated workspace.
 */
export interface ThreadLevelWorkspaceConfig {
  scope: 'thread';
  /** Configuration for thread workspaces */
  thread: ThreadWorkspaceConfig;
}

/**
 * Both agent-level and thread-level workspaces.
 * Agent workspace is shared; thread workspace is isolated.
 */
export interface HybridWorkspaceConfig {
  scope: 'hybrid';
  /** Shared agent-level workspace */
  agent: Omit<WorkspaceConfig, 'scope'>;
  /** Per-thread workspace configuration */
  thread: ThreadWorkspaceConfig;
}

// =============================================================================
// Workspace Factory
// =============================================================================

/**
 * Factory for creating workspaces.
 * Used by Mastra to manage workspace lifecycle.
 */
export interface WorkspaceFactory {
  /**
   * Create a new workspace with the given configuration.
   */
  create(config: WorkspaceConfig, owner: WorkspaceOwner): Promise<Workspace>;

  /**
   * Get an existing workspace by ID.
   */
  get(workspaceId: string): Promise<Workspace | null>;

  /**
   * Get workspace for an agent (creates if doesn't exist).
   */
  getAgentWorkspace(agentId: string, config: AgentLevelWorkspaceConfig): Promise<Workspace>;

  /**
   * Get workspace for a thread (creates if doesn't exist).
   */
  getThreadWorkspace(
    agentId: string,
    threadId: string,
    config: ThreadWorkspaceConfig,
  ): Promise<Workspace>;

  /**
   * List all workspaces, optionally filtered.
   */
  list(filter?: { scope?: WorkspaceScope; agentId?: string; status?: WorkspaceStatus }): Promise<WorkspaceInfo[]>;

  /**
   * Destroy a workspace by ID.
   */
  destroy(workspaceId: string): Promise<void>;

  /**
   * Destroy all workspaces for an agent.
   */
  destroyAgentWorkspaces(agentId: string): Promise<void>;

  /**
   * Destroy all workspaces for a thread.
   */
  destroyThreadWorkspace(agentId: string, threadId: string): Promise<void>;

  /**
   * Clean up expired/inactive workspaces.
   */
  cleanup(options?: { maxAge?: number; maxInactive?: number }): Promise<number>;
}

// =============================================================================
// Errors
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

export class WorkspaceNotFoundError extends WorkspaceError {
  constructor(workspaceId: string) {
    super(`Workspace not found: ${workspaceId}`, 'NOT_FOUND', workspaceId);
    this.name = 'WorkspaceNotFoundError';
  }
}

export class WorkspaceNotReadyError extends WorkspaceError {
  constructor(workspaceId: string, status: WorkspaceStatus) {
    super(`Workspace is not ready (status: ${status})`, 'NOT_READY', workspaceId);
    this.name = 'WorkspaceNotReadyError';
  }
}

export class FilesystemNotAvailableError extends WorkspaceError {
  constructor(workspaceId: string) {
    super('Workspace does not have a filesystem configured', 'NO_FILESYSTEM', workspaceId);
    this.name = 'FilesystemNotAvailableError';
  }
}

export class ExecutorNotAvailableError extends WorkspaceError {
  constructor(workspaceId: string) {
    super('Workspace does not have an executor configured', 'NO_EXECUTOR', workspaceId);
    this.name = 'ExecutorNotAvailableError';
  }
}

export class WorkspaceLimitError extends WorkspaceError {
  constructor(agentId: string, limit: number) {
    super(`Maximum concurrent workspaces (${limit}) reached for agent: ${agentId}`, 'LIMIT_EXCEEDED');
    this.name = 'WorkspaceLimitError';
  }
}
