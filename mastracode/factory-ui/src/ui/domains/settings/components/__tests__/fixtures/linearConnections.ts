import type { LinearStatus } from '../../../../factory/services/linear';

export const linearWorkspaceStatus = {
  enabled: true,
  connected: true,
  workspace: { name: 'Mastra Labs', urlKey: 'mastra-labs' },
  reason: 'ready',
  mode: 'platform',
  workspaces: [
    { id: 'labs', name: 'Mastra Labs', urlKey: 'mastra-labs', connected: true },
    { id: 'mastra', name: 'Mastra', urlKey: 'mastra', connected: false },
  ],
} satisfies LinearStatus;
