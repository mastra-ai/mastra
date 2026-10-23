import type { StorageWorkspaceToolConfig, StorageWorkspaceToolsConfig } from '@mastra/core/storage';
import type { WorkspaceToolsConfig } from '@mastra/core/workspace';

export function toRuntimeWorkspaceToolsConfig(stored: StorageWorkspaceToolsConfig): WorkspaceToolsConfig {
  const config: WorkspaceToolsConfig = {};
  if (stored.enabled !== undefined) config.enabled = stored.enabled;
  if (stored.requireApproval !== undefined) config.requireApproval = stored.requireApproval;
  return { ...config, ...stored.tools };
}

export function toStorageWorkspaceToolsConfig(config: WorkspaceToolsConfig): StorageWorkspaceToolsConfig | undefined {
  const stored: StorageWorkspaceToolsConfig = {};
  if (typeof config.enabled === 'boolean') stored.enabled = config.enabled;
  if (typeof config.requireApproval === 'boolean') stored.requireApproval = config.requireApproval;

  const tools: Record<string, StorageWorkspaceToolConfig> = {};
  for (const [name, value] of Object.entries(config)) {
    if (!name.startsWith('mastra_workspace_') || !value || typeof value !== 'object') continue;
    const tool: StorageWorkspaceToolConfig = {};
    if ('enabled' in value && typeof value.enabled === 'boolean') tool.enabled = value.enabled;
    if ('requireApproval' in value && typeof value.requireApproval === 'boolean') {
      tool.requireApproval = value.requireApproval;
    }
    if ('requireReadBeforeWrite' in value && typeof value.requireReadBeforeWrite === 'boolean') {
      tool.requireReadBeforeWrite = value.requireReadBeforeWrite;
    }
    if (Object.keys(tool).length > 0) tools[name] = tool;
  }
  if (Object.keys(tools).length > 0) stored.tools = tools;
  return Object.keys(stored).length > 0 ? stored : undefined;
}
