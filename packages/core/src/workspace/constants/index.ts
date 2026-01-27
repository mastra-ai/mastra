/**
 * Workspace Constants
 *
 * BROWSER-SAFE EXPORTS ONLY
 *
 * This folder contains only constants with no Node.js dependencies,
 * making it safe to import in browser environments.
 * Do not add any imports that rely on Node.js APIs (fs, path, crypto, etc).
 */

export const WORKSPACE_TOOLS_PREFIX = 'mastra_workspace' as const;
const TOOLS_NAMESPACE = WORKSPACE_TOOLS_PREFIX;

/**
 * Workspace tool name constants.
 * Use these to reference workspace tools by name.
 *
 * @example
 * ```typescript
 * import { WORKSPACE_TOOLS } from '@mastra/core/workspace/constants';
 *
 * if (toolName === WORKSPACE_TOOLS.SANDBOX.EXECUTE_COMMAND) {
 *   // Handle sandbox execution
 * }
 * ```
 */
export const WORKSPACE_TOOLS = {
  FILESYSTEM: {
    READ_FILE: `${TOOLS_NAMESPACE}_read_file` as const,
    WRITE_FILE: `${TOOLS_NAMESPACE}_write_file` as const,
    EDIT_FILE: `${TOOLS_NAMESPACE}_edit_file` as const,
    LIST_FILES: `${TOOLS_NAMESPACE}_list_files` as const,
    DELETE_FILE: `${TOOLS_NAMESPACE}_delete_file` as const,
    FILE_EXISTS: `${TOOLS_NAMESPACE}_file_exists` as const,
    MKDIR: `${TOOLS_NAMESPACE}_mkdir` as const,
  },
  SANDBOX: {
    EXECUTE_COMMAND: `${TOOLS_NAMESPACE}_execute_command` as const,
  },
  SEARCH: {
    SEARCH: `${TOOLS_NAMESPACE}_search` as const,
    INDEX: `${TOOLS_NAMESPACE}_index` as const,
  },
} as const;

/**
 * Type representing any workspace tool name.
 */
export type WorkspaceToolName =
  | (typeof WORKSPACE_TOOLS.FILESYSTEM)[keyof typeof WORKSPACE_TOOLS.FILESYSTEM]
  | (typeof WORKSPACE_TOOLS.SEARCH)[keyof typeof WORKSPACE_TOOLS.SEARCH]
  | (typeof WORKSPACE_TOOLS.SANDBOX)[keyof typeof WORKSPACE_TOOLS.SANDBOX];

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
}

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
 *     mastra_workspace_delete_file: {
 *       enabled: false,
 *     },
 *     mastra_workspace_execute_command: {
 *       requireApproval: true,
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
} & Partial<Record<WorkspaceToolName, WorkspaceToolConfig>>;
