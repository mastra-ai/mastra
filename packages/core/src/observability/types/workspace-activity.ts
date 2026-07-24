import type { CorrelationContext } from './core';

// ============================================================================
// Workspace Activity — Sandbox Output
// ============================================================================

/**
 * Which sandbox surface produced this output chunk.
 * - `exec`: from a `sandbox.executeCommand()` call (emitted after resolve).
 * - `spawn`: from a streaming `sandbox.processes.spawn()` process.
 */
export type SandboxOutputSource = 'exec' | 'spawn';

/** Which standard stream this chunk came from. */
export type SandboxOutputStream = 'stdout' | 'stderr';

/**
 * Sandbox stdout/stderr chunk transported via the event bus.
 * Must be JSON-serializable.
 *
 * Chunks are truncated at the wrapper (16 KB default) and carry `truncated: true`
 * when the source chunk exceeded the limit. The observability channel never
 * carries stdin — agents cannot drive interactive shells today.
 */
export interface ExportedSandboxOutput {
  /** Unique identifier for this activity event, generated at emission time */
  eventId: string;

  /** When the chunk was captured */
  timestamp: Date;

  /** Trace associated with this activity event */
  traceId?: string;

  /** Specific span associated with this activity event */
  spanId?: string;

  /** Workspace id that owns the sandbox */
  workspaceId: string;

  /** Workspace human-readable name (if set) */
  workspaceName?: string;

  /** Provider-assigned sandbox id (when the sandbox has one) */
  sandboxId?: string;

  /** Which sandbox surface produced this chunk */
  source: SandboxOutputSource;

  /**
   * Provider-assigned process id, when available for `source: 'spawn'`.
   * May be absent on early chunks emitted before the provider has assigned
   * one; `source: 'exec'` events never carry a process id.
   */
  processId?: string;

  /** Which stream this chunk came from */
  stream: SandboxOutputStream;

  /** The chunk contents (already truncated to fit the limit) */
  chunk: string;

  /** True when the source chunk exceeded the truncation limit */
  truncated: boolean;

  /** Canonical correlation context for this activity event */
  correlationContext?: CorrelationContext;
}

/** Sandbox output event emitted to the ObservabilityBus */
export interface SandboxOutputEvent {
  type: 'sandbox_output';
  output: ExportedSandboxOutput;
}

// ============================================================================
// Workspace Activity — Filesystem Change
// ============================================================================

/**
 * Which mutating filesystem operation produced this event.
 * Read-only operations (`readFile`, `readdir`, `stat`, `realpath`) never emit
 * a filesystem_change event — only mutations do.
 */
export type FilesystemChangeOperation =
  | 'write'
  | 'append'
  | 'delete'
  | 'copy'
  | 'move'
  | 'mkdir'
  | 'rmdir';

/**
 * Filesystem change metadata transported via the event bus.
 * Must be JSON-serializable.
 *
 * The observability channel never carries file contents — only the path,
 * operation, and byte count when known.
 */
export interface ExportedFilesystemChange {
  /** Unique identifier for this activity event, generated at emission time */
  eventId: string;

  /** When the change was captured */
  timestamp: Date;

  /** Trace associated with this activity event */
  traceId?: string;

  /** Specific span associated with this activity event */
  spanId?: string;

  /** Workspace id that owns the filesystem */
  workspaceId: string;

  /** Workspace human-readable name (if set) */
  workspaceName?: string;

  /** Underlying bucket name (when the provider is bucket-backed) */
  bucketName?: string;

  /**
   * The path supplied to the mutating operation, as-is. Providers may normalize
   * or resolve this relative to their own root; consumers should treat it as
   * caller/provider-relative rather than a guaranteed absolute filesystem path.
   * For `copy` and `move`, this is the destination path.
   */
  path: string;

  /** Which mutating operation ran */
  operation: FilesystemChangeOperation;

  /** Bytes written or removed, when the provider reports it */
  bytes?: number;

  /** Canonical correlation context for this activity event */
  correlationContext?: CorrelationContext;
}

/** Filesystem change event emitted to the ObservabilityBus */
export interface FilesystemChangeEvent {
  type: 'filesystem_change';
  change: ExportedFilesystemChange;
}

// ============================================================================
// Workspace Activity Union
// ============================================================================

/**
 * Union of all workspace activity events routed through the
 * `onWorkspaceActivityEvent` hook on `ObservabilityEvents`.
 */
export type WorkspaceActivityEvent = SandboxOutputEvent | FilesystemChangeEvent;
