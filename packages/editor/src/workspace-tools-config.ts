import type { StorageWorkspaceToolConfig, StorageWorkspaceToolsConfig } from '@mastra/core/storage';
import type { WorkspaceToolsConfig } from '@mastra/core/workspace';

const WORKSPACE_TOOL_PREFIX = 'mastra_workspace_';

export function toRuntimeWorkspaceToolsConfig(config: StorageWorkspaceToolsConfig): WorkspaceToolsConfig {
  return {
    ...(config.enabled !== undefined ? { enabled: config.enabled } : {}),
    ...(config.requireApproval !== undefined ? { requireApproval: config.requireApproval } : {}),
    ...config.tools,
  } as WorkspaceToolsConfig;
}

export function toStorageWorkspaceToolsConfig(config: WorkspaceToolsConfig): StorageWorkspaceToolsConfig | undefined {
  const storageConfig: StorageWorkspaceToolsConfig = {};

  if (typeof config.enabled === 'boolean') storageConfig.enabled = config.enabled;
  if (typeof config.requireApproval === 'boolean') storageConfig.requireApproval = config.requireApproval;

  const tools: Record<string, StorageWorkspaceToolConfig> = {};
  for (const [toolName, toolConfig] of Object.entries(config)) {
    if (!toolName.startsWith(WORKSPACE_TOOL_PREFIX) || !toolConfig || typeof toolConfig !== 'object') continue;

    const runtimeTool = toolConfig as Record<string, unknown>;
    const storedTool: StorageWorkspaceToolConfig = {};
    if (typeof runtimeTool.enabled === 'boolean') storedTool.enabled = runtimeTool.enabled;
    if (typeof runtimeTool.requireApproval === 'boolean') storedTool.requireApproval = runtimeTool.requireApproval;
    if (typeof runtimeTool.requireReadBeforeWrite === 'boolean') {
      storedTool.requireReadBeforeWrite = runtimeTool.requireReadBeforeWrite;
    }
    if (Object.keys(storedTool).length > 0) tools[toolName] = storedTool;
  }

  if (Object.keys(tools).length > 0) storageConfig.tools = tools;
  return Object.keys(storageConfig).length > 0 ? storageConfig : undefined;
}
