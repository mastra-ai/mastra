/**
 * Constants inlined from @mastra/core to avoid import compatibility
 * issues with older core versions that don't export them yet.
 *
 * - Reserved RequestContext keys are inlined from @mastra/core/request-context.
 * - Workspace tool constants are inlined from @mastra/core/workspace.
 */

export const MASTRA_RESOURCE_ID_KEY = 'mastra__resourceId';

export const MASTRA_THREAD_ID_KEY = 'mastra__threadId';

export const MASTRA_AUTH_TOKEN_KEY = 'mastra__authToken';

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
 * ToolConfigWithArgsContext) without importing them.
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
 * Safely resolve a dynamic config value (boolean or async function) to a boolean.
 * Falls back to `safeDefault` when no context is available or the function throws.
 */
async function resolveDynamicValue(
  value: DynamicToolConfigValue | undefined,
  context: { workspace: object; requestContext: Record<string, unknown> } | undefined,
  safeDefault: boolean,
): Promise<boolean> {
  if (value === undefined) return safeDefault;
  if (typeof value === 'boolean') return value;
  if (!context) return safeDefault;
  try {
    return await value(context);
  } catch (error) {
    console.warn('[Workspace Tools] Dynamic config function threw, using safe default:', error);
    return safeDefault;
  }
}

/**
 * Resolve the effective configuration for a workspace tool.
 * Inlined from @mastra/core/workspace for compatibility.
 *
 * Dynamic function values are resolved by calling them with the provided
 * workspace and requestContext. If a function throws, safe defaults are used
 * (enabled → false, requireApproval → true, requireReadBeforeWrite → true).
 */
export async function resolveToolConfig(
  toolsConfig: WorkspaceToolsConfig | undefined,
  toolName: WorkspaceToolName,
  context?: { workspace: object; requestContext: Record<string, unknown> },
): Promise<{ enabled: boolean; requireApproval: boolean; requireReadBeforeWrite?: boolean }> {
  let enabled: DynamicToolConfigValue = true;
  let requireApproval: DynamicToolConfigValue = false;
  let requireReadBeforeWrite: DynamicToolConfigValue | undefined;

  if (toolsConfig) {
    if (toolsConfig.enabled !== undefined) {
      enabled = toolsConfig.enabled;
    }
    if (toolsConfig.requireApproval !== undefined) {
      requireApproval = toolsConfig.requireApproval;
    }

    const perToolConfig = toolsConfig[toolName];
    if (perToolConfig) {
      if (perToolConfig.enabled !== undefined) {
        enabled = perToolConfig.enabled;
      }
      if (perToolConfig.requireApproval !== undefined) {
        requireApproval = perToolConfig.requireApproval;
      }
      if (perToolConfig.requireReadBeforeWrite !== undefined) {
        requireReadBeforeWrite = perToolConfig.requireReadBeforeWrite;
      }
    }
  }

  return {
    enabled: await resolveDynamicValue(enabled, context, false),
    requireApproval: await resolveDynamicValue(requireApproval, context, true),
    requireReadBeforeWrite:
      requireReadBeforeWrite !== undefined
        ? await resolveDynamicValue(requireReadBeforeWrite, context, true)
        : undefined,
  };
}
