import type { WorkspaceChangesScope } from '@mastra/client-js';

export interface ModelCatalogKeyFilter {
  factoryProjectId?: string;
  scope?: 'org' | 'user';
  sessionId?: string;
  resourceId?: string;
  threadId?: string;
}

/**
 * Query keys of Factory's session config, voice and workspace reads. Hosts invalidate these after
 * runs and tool calls, so their shape is part of the hooks' contract.
 */
export const factoryWebKeys = {
  providers: () => ['providers'] as const,
  mastraGatewayCredits: () => ['mastra-gateway-credits'] as const,
  availableModels: (filter?: ModelCatalogKeyFilter) =>
    filter ? (['available-models', filter] as const) : (['available-models'] as const),
  defaultModel: () => ['default-model'] as const,
  voiceSettingsAll: () => ['voice-settings'] as const,
  voiceSettings: (factoryProjectId: string) => [...factoryWebKeys.voiceSettingsAll(), factoryProjectId] as const,
  fsList: (path: string | undefined) => ['fs-list', path ?? null] as const,
  artifactsList: (path: string | undefined) => ['artifacts-list', path ?? null] as const,
  workspaceRenderedList: (workspacePath: string | undefined, root: string | undefined) =>
    ['workspace-rendered-list', workspacePath ?? null, root ?? null] as const,
  workspaceTreeScope: (workspacePath: string | undefined) => ['workspace-tree', workspacePath ?? null] as const,
  workspaceTree: (workspacePath: string | undefined, path: string) =>
    ['workspace-tree', workspacePath ?? null, path] as const,
  // Under the tree's prefix so a tree refresh refreshes it; the object never equals a folder path.
  workspaceFileIndex: (workspacePath: string | undefined) =>
    ['workspace-tree', workspacePath ?? null, { index: 'files' }] as const,
  workspaceFileScope: (workspacePath: string | undefined) => ['workspace-file', workspacePath ?? null] as const,
  workspaceFile: (workspacePath: string | undefined, filePath: string | undefined) =>
    ['workspace-file', workspacePath ?? null, filePath ?? null] as const,
  workspaceChanges: (workspacePath: string | undefined) => ['workspace-changes', workspacePath ?? null] as const,
  workspacePatches: (workspacePath: string | undefined, scope: WorkspaceChangesScope) =>
    ['workspace-changes', workspacePath ?? null, 'patches', scope] as const,
};
