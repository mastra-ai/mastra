/**
 * Workspace Tool Types
 *
 * BROWSER-SAFE EXPORTS ONLY
 *
 * Types for workspace tool configuration. These are browser-safe
 * and do not import any Node.js dependencies.
 */

import type { WorkspaceToolName, WORKSPACE_TOOLS } from '../constants';

// =============================================================================
// Tool Configuration Types
// =============================================================================

/**
 * Configuration for a single workspace tool.
 * All fields are optional; unspecified fields inherit from top-level defaults.
 */
export interface WorkspaceToolConfig {
  /** Whether the tool is enabled (default: true) */
  enabled?: boolean;

  /** Whether the tool requires user approval before execution (default: false) */
  requireApproval?: boolean;

  /**
   * For write tools only: require reading a file before writing to it.
   * Prevents accidental overwrites when the agent hasn't seen the current content.
   */
  requireReadBeforeWrite?: boolean;

  /**
   * Maximum tokens for tool output (default: 3000).
   * Output exceeding this limit is truncated. Uses tiktoken for accurate counting.
   */
  maxOutputTokens?: number;
}

// =============================================================================
// Background Process Callback Types
// =============================================================================

/** Metadata passed to background process callbacks. */
export interface BackgroundProcessMeta {
  pid: number;
  toolCallId?: string;
}

/** Metadata passed to the onExit callback. */
export interface BackgroundProcessExitMeta extends BackgroundProcessMeta {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Configuration for background process lifecycle callbacks.
 * Used by execute_command when `background: true`.
 */
export interface BackgroundProcessConfig {
  /** Callback for stdout chunks from the background process. */
  onStdout?: (data: string, meta: BackgroundProcessMeta) => void;
  /** Callback for stderr chunks from the background process. */
  onStderr?: (data: string, meta: BackgroundProcessMeta) => void;
  /** Callback when the background process exits. */
  onExit?: (meta: BackgroundProcessExitMeta) => void;
  /**
   * Abort signal for background processes.
   * - `undefined` (default): uses the agent's abort signal from context (processes are killed when the signal fires)
   * - `AbortSignal`: uses the provided signal
   * - `null` or `false`: disables abort signal (processes persist after disconnect).
   *   Use this for cloud sandboxes (e.g. E2B) where processes should survive agent shutdown.
   */
  abortSignal?: AbortSignal | null | false;
}

// =============================================================================
// Per-Tool Config Extensions
// =============================================================================

/**
 * Extended configuration for the execute_command tool.
 * Adds background process lifecycle callbacks on top of the base config.
 */
export interface ExecuteCommandToolConfig extends WorkspaceToolConfig {
  /** Configuration for background process callbacks and abort behavior. */
  backgroundProcesses?: BackgroundProcessConfig;
}

// =============================================================================
// Top-Level Tools Config
// =============================================================================

/**
 * Configuration for workspace tools.
 *
 * Supports top-level defaults that apply to all tools, plus per-tool overrides.
 * Per-tool settings take precedence over top-level defaults.
 *
 * Default behavior (when no config provided):
 * - All tools are enabled
 * - No approval required
 *
 * @example Top-level defaults with per-tool overrides
 * ```typescript
 * const workspace = new Workspace({
 *   filesystem: new LocalFilesystem({ basePath: './data' }),
 *   tools: {
 *     // Top-level defaults apply to all tools
 *     enabled: true,
 *     requireApproval: false,
 *
 *     // Per-tool overrides
 *     mastra_workspace_write_file: {
 *       requireApproval: true,
 *       requireReadBeforeWrite: true,
 *     },
 *     mastra_workspace_delete: {
 *       enabled: false,
 *     },
 *     mastra_workspace_execute_command: {
 *       requireApproval: true,
 *       backgroundProcesses: {
 *         onStdout: (data, { pid }) => console.log(`[PID ${pid}]`, data),
 *         onExit: ({ pid, exitCode }) => console.log(`Process ${pid} exited: ${exitCode}`),
 *       },
 *     },
 *   },
 * });
 * ```
 */
export type WorkspaceToolsConfig = {
  /** Default: whether all tools are enabled (default: true if not specified) */
  enabled?: boolean;

  /** Default: whether all tools require user approval (default: false if not specified) */
  requireApproval?: boolean;
} & {
  [K in typeof WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]?: ExecuteCommandToolConfig;
} & Partial<Record<Exclude<WorkspaceToolName, typeof WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND>, WorkspaceToolConfig>>;
