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
// Dynamic Tool Config Types
// =============================================================================

/**
 * Context available to dynamic tool config functions evaluated at tool-listing time.
 * Does not include `args` since the tool hasn't been called yet.
 */
export interface ToolConfigContext {
  requestContext: Record<string, unknown>;
  /** The Workspace instance. Typed loosely here for browser safety — at runtime this is a full Workspace object. */
  workspace: object;
}

/**
 * Context available to dynamic tool config functions evaluated at execution time.
 * Includes `args` since the tool is being called with specific arguments.
 */
export interface ToolConfigWithArgsContext extends ToolConfigContext {
  args: Record<string, unknown>;
}

/**
 * A config value that can be a static boolean or a dynamic async function.
 * Functions receive context and return a boolean to enable context-aware behavior.
 *
 * @example
 * ```typescript
 * // Static
 * requireApproval: true,
 *
 * // Dynamic - based on request context
 * requireApproval: async ({ requestContext }) => {
 *   return requestContext['userTier'] !== 'admin';
 * },
 *
 * // Dynamic - based on args (execution-time only)
 * requireReadBeforeWrite: async ({ args }) => {
 *   return (args.path as string).startsWith('/protected');
 * },
 * ```
 */
export type DynamicToolConfigValue<TContext = ToolConfigContext> =
  boolean | ((context: TContext) => boolean | Promise<boolean>);

export interface WorkspaceToolHookContext {
  /** The name exposed to the model after any per-tool `name` remap. */
  toolName: string;
  /** The built-in workspace tool name before any `name` remap. */
  workspaceToolName: WorkspaceToolName;
  /** Input passed to the tool. */
  input: unknown;
  /** Execution context passed to the tool. */
  context: unknown;
}

export interface WorkspaceToolBeforeHookResult {
  /** Set to false to skip the tool execution and return `output` instead. */
  proceed: false;
  output: unknown;
}

export interface WorkspaceToolAfterHookContext extends WorkspaceToolHookContext {
  /** Tool output when execution completed. Undefined when execution failed before producing output. */
  output?: unknown;
  /** Error thrown by the tool, if execution failed. */
  error?: unknown;
}

export interface WorkspaceToolHooks {
  beforeToolCall?: (
    context: WorkspaceToolHookContext,
  ) => void | WorkspaceToolBeforeHookResult | Promise<void | WorkspaceToolBeforeHookResult>;
  afterToolCall?: (context: WorkspaceToolAfterHookContext) => void | Promise<void>;
}

// =============================================================================
// Tool Configuration Types
// =============================================================================

/**
 * Configuration for a single workspace tool.
 * All fields are optional; unspecified fields inherit from top-level defaults.
 */
export interface WorkspaceToolConfig {
  /**
   * Whether the tool is enabled (default: true).
   * When a function, evaluated at tool-listing time with requestContext and workspace.
   */
  enabled?: DynamicToolConfigValue;

  /**
   * Whether the tool requires user approval before execution (default: false).
   * When a function, evaluated at execution time with requestContext, workspace, and args.
   */
  requireApproval?: DynamicToolConfigValue<ToolConfigWithArgsContext>;

  /**
   * Custom name to expose this tool as to the LLM.
   * When set, the tool is registered under this name instead of the default
   * `mastra_workspace_*` name. The config key must still be the original
   * WorkspaceToolName constant — only the exposed name changes.
   *
   * @example
   * ```typescript
   * tools: {
   *   mastra_workspace_read_file: { name: 'view' },
   *   mastra_workspace_grep: { name: 'search_content' },
   * }
   * ```
   */
  name?: string;

  /**
   * For write tools only: require reading a file before writing to it.
   * Prevents accidental overwrites when the agent hasn't seen the current content.
   * When a function, evaluated at execution time with requestContext, workspace, and args.
   */
  requireReadBeforeWrite?: DynamicToolConfigValue<ToolConfigWithArgsContext>;

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
  pid: string;
  toolCallId?: string;
}

/** Metadata passed to the onExit callback. */
export interface BackgroundProcessExitMeta extends BackgroundProcessMeta {
  exitCode: number;
  stdout: string;
  stderr: string;
  stdoutTruncated?: boolean;
  stderrTruncated?: boolean;
  stdoutDroppedBytes?: number;
  stderrDroppedBytes?: number;
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

/**
 * Extended configuration for the read_file tool.
 *
 * Controls which mime types are surfaced to the model as media parts (image
 * or file parts the model can natively consume). Text-like files are still
 * read as text; non-text binaries that don't match fall back to a
 * metadata-only result (path, size, mime type) so the agent knows about
 * the file without dumping useless base64 into context.
 *
 * - **Array of globs** — e.g. `['image/*']`, `['image/*', 'application/pdf']`
 * - **Function** — `(mimeType: string) => boolean`
 * - **`false`** — disable media parts; non-text binaries fall back to
 *   metadata-only output unless an explicit `encoding` is provided
 *
 * Only applies when the caller doesn't pass an explicit `encoding` (since an
 * explicit encoding is a clear request for raw bytes/text).
 *
 * The default is the cross-provider-safe intersection of image formats
 * (`image/png`, `image/jpeg`, `image/webp`) plus
 * `application/pdf`. Use `['image/*']` (or a function) if you want to
 * surface exotic subtypes like SVG/BMP/HEIC.
 *
 * @example
 * ```ts
 * // Surface any image (including SVG, BMP, HEIC) — may fail on some providers
 * mastra_workspace_read_file: { mediaTypes: ['image/*'] }
 *
 * // Disable media parts entirely
 * mastra_workspace_read_file: { mediaTypes: false }
 *
 * // Custom predicate
 * mastra_workspace_read_file: { mediaTypes: (mime) => mime.startsWith('image/') }
 *
 * // Raise the inline-media size cap to 25 MiB
 * mastra_workspace_read_file: { maxMediaBytes: 25 * 1024 * 1024 }
 * ```
 */
export interface ReadFileToolConfig extends WorkspaceToolConfig {
  /**
   * Which mime types to surface to the model as media parts (file/image
   * parts) rather than as text. Defaults to the cross-provider-safe set
   * `['image/png', 'image/jpeg', 'image/webp', 'application/pdf']`.
   * Pass `false` to disable media detection; non-text binaries then fall
   * back to metadata-only output unless an explicit `encoding` is provided.
   */
  mediaTypes?: string[] | ((mimeType: string) => boolean) | false;
  /**
   * Maximum file size (in bytes) to read inline as a media part. Files
   * larger than this fall back to metadata-only output rather than being
   * fully base64-encoded into the model context and persisted in storage.
   * Defaults to 10 MiB (10 * 1024 * 1024).
   */
  maxMediaBytes?: number;
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
  enabled?: DynamicToolConfigValue;

  /** Default: whether all tools require user approval (default: false if not specified) */
  requireApproval?: DynamicToolConfigValue<ToolConfigWithArgsContext>;

  /**
   * Optional hooks run around every enabled workspace tool after name remapping.
   * If the owning agent also defines hooks, workspace hooks run inside the agent hook wrapper.
   */
  hooks?: WorkspaceToolHooks;
} & {
  [K in typeof WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND]?: ExecuteCommandToolConfig;
} & {
  [K in typeof WORKSPACE_TOOLS.FILESYSTEM.READ_FILE]?: ReadFileToolConfig;
} & Partial<
    Record<
      Exclude<
        WorkspaceToolName,
        typeof WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND | typeof WORKSPACE_TOOLS.FILESYSTEM.READ_FILE
      >,
      WorkspaceToolConfig
    >
  >;
