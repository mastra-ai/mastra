/**
 * Workspace Tool Types
 *
 * BROWSER-SAFE EXPORTS ONLY
 *
 * Types for workspace tool configuration. These are browser-safe
 * and do not import any Node.js dependencies.
 */

import type { WorkspaceToolName } from '../constants';

// =============================================================================
// Tool Configuration Types
// =============================================================================

/**
 * Configuration for a single workspace tool.
 * All fields are optional; unspecified fields inherit from top-level defaults.
 *
 * @deprecated Configure workspace tools by importing `createWorkspaceTools` from `@mastra/core/workspace`
 * and passing the tools directly to your agent instead.
 */
export interface WorkspaceToolConfig {
  /** Whether the tool is enabled (default: false) */
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
 * - All tools are disabled
 * - No approval required
 *
 * @deprecated Configure workspace tools by importing `createWorkspaceTools` from `@mastra/core/workspace`
 * and passing the tools directly to your agent instead.
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
 *     },
 *   },
 * });
 * ```
 */
export type WorkspaceToolsConfig = {
  /** Default: whether all tools are enabled (default: false if not specified) */
  enabled?: boolean;

  /** Default: whether all tools require user approval (default: false if not specified) */
  requireApproval?: boolean;
} & Partial<Record<WorkspaceToolName, WorkspaceToolConfig>>;
