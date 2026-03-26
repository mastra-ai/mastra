/**
 * Workspace tool constants and utilities.
 *
 * Inlined from @mastra/core/workspace to avoid import compatibility
 * issues with older core versions that don't have the workspace module.
 */

export const WORKSPACE_TOOLS_PREFIX = 'mastra_workspace' as const;

export const WORKSPACE_TOOLS = {
  FILESYSTEM: {
    READ_FILE: `${WORKSPACE_TOOLS_PREFIX}_read_file` as const,
    WRITE_FILE: `${WORKSPACE_TOOLS_PREFIX}_write_file` as const,
    EDIT_FILE: `${WORKSPACE_TOOLS_PREFIX}_edit_file` as const,
    LIST_FILES: `${WORKSPACE_TOOLS_PREFIX}_list_files` as const,
    DELETE: `${WORKSPACE_TOOLS_PREFIX}_delete` as const,
    FILE_STAT: `${WORKSPACE_TOOLS_PREFIX}_file_stat` as const,
    MKDIR: `${WORKSPACE_TOOLS_PREFIX}_mkdir` as const,
    GREP: `${WORKSPACE_TOOLS_PREFIX}_grep` as const,
  },
  SANDBOX: {
    EXECUTE_COMMAND: `${WORKSPACE_TOOLS_PREFIX}_execute_command` as const,
  },
  SEARCH: {
    SEARCH: `${WORKSPACE_TOOLS_PREFIX}_search` as const,
    INDEX: `${WORKSPACE_TOOLS_PREFIX}_index` as const,
  },
} as const;

export type WorkspaceToolName =
  | (typeof WORKSPACE_TOOLS.FILESYSTEM)[keyof typeof WORKSPACE_TOOLS.FILESYSTEM]
  | (typeof WORKSPACE_TOOLS.SEARCH)[keyof typeof WORKSPACE_TOOLS.SEARCH]
  | (typeof WORKSPACE_TOOLS.SANDBOX)[keyof typeof WORKSPACE_TOOLS.SANDBOX];

/**
 * A tool config value that may be a static boolean or a dynamic function.
 * Inlined from @mastra/core/workspace for compatibility.
 *
 * Uses `(...args: any[]) => any` for the function branch so it stays
 * assignable from all core context variants (ToolConfigContext,
 * ToolConfigWithArgsContext) without importing them. resolveToolConfig
 * never calls these functions — it uses safe boolean defaults instead.
 */

type DynamicToolConfigValue = boolean | ((...args: any[]) => any);

/**
 * Configuration for a single workspace tool.
 */
export interface WorkspaceToolConfig {
  enabled?: DynamicToolConfigValue;
  requireApproval?: DynamicToolConfigValue;
  requireReadBeforeWrite?: DynamicToolConfigValue;
}

/**
 * Configuration for workspace tools.
 */
export type WorkspaceToolsConfig = {
  enabled?: DynamicToolConfigValue;
  requireApproval?: DynamicToolConfigValue;
} & Partial<Record<WorkspaceToolName, WorkspaceToolConfig>>;

/**
 * Resolve the effective configuration for a workspace tool.
 * Inlined from @mastra/core/workspace for compatibility.
 *
 * Dynamic function values are resolved to safe defaults (enabled=true,
 * requireApproval=true) since this synchronous fallback path only runs
 * on older core versions that won't produce function values.
 */
export function resolveToolConfig(
  toolsConfig: WorkspaceToolsConfig | undefined,
  toolName: WorkspaceToolName,
): { enabled: boolean; requireApproval: boolean; requireReadBeforeWrite?: boolean } {
  let enabled = false;
  let requireApproval = true;
  let requireReadBeforeWrite: boolean | undefined;

  if (toolsConfig) {
    if (toolsConfig.enabled !== undefined) {
      enabled = typeof toolsConfig.enabled === 'function' ? true : toolsConfig.enabled;
    }
    if (toolsConfig.requireApproval !== undefined) {
      requireApproval = typeof toolsConfig.requireApproval === 'function' ? true : toolsConfig.requireApproval;
    }

    const perToolConfig = toolsConfig[toolName];
    if (perToolConfig) {
      if (perToolConfig.enabled !== undefined) {
        enabled = typeof perToolConfig.enabled === 'function' ? true : perToolConfig.enabled;
      }
      if (perToolConfig.requireApproval !== undefined) {
        requireApproval = typeof perToolConfig.requireApproval === 'function' ? true : perToolConfig.requireApproval;
      }
      if (perToolConfig.requireReadBeforeWrite !== undefined) {
        requireReadBeforeWrite =
          typeof perToolConfig.requireReadBeforeWrite === 'function' ? true : perToolConfig.requireReadBeforeWrite;
      }
    }
  }

  return { enabled, requireApproval, requireReadBeforeWrite };
}
