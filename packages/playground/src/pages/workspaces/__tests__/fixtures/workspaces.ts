import type { ListWorkspacesResponse } from '@mastra/client-js';

export const emptyWorkspaces: ListWorkspacesResponse = {
  workspaces: [],
};

export const twoWorkspaces: ListWorkspacesResponse = {
  workspaces: [
    {
      id: 'global-ws',
      name: 'Global Workspace',
      status: 'active',
      source: 'mastra',
      capabilities: {
        hasFilesystem: true,
        hasSandbox: false,
        canBM25: true,
        canVector: false,
        canHybrid: false,
        hasSkills: true,
      },
      safety: {
        readOnly: false,
      },
    },
    {
      id: 'agent-ws',
      name: 'Agent Workspace',
      status: 'active',
      source: 'agent',
      agentId: 'weather-agent',
      agentName: 'Weather Agent',
      capabilities: {
        hasFilesystem: true,
        hasSandbox: true,
        canBM25: false,
        canVector: true,
        canHybrid: false,
        hasSkills: false,
      },
      safety: {
        readOnly: true,
      },
    },
  ],
};
