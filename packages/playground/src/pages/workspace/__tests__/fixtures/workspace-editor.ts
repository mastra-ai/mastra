import type { ListSkillsResponse, ListWorkspacesResponse, WorkspaceInfoResponse } from '@mastra/client-js';

export const workspacesList: ListWorkspacesResponse = {
  workspaces: [
    {
      id: 'global-ws',
      name: 'Global Workspace',
      status: 'active',
      source: 'mastra',
      capabilities: {
        hasFilesystem: false,
        hasSandbox: false,
        canBM25: false,
        canVector: false,
        canHybrid: false,
        hasSkills: false,
      },
      safety: {
        readOnly: false,
      },
    },
  ],
};

// Configured workspace with no capabilities so the editor renders the main
// layout without firing filesystem/skill UI requests.
export const configuredWorkspaceInfo: WorkspaceInfoResponse = {
  isWorkspaceConfigured: true,
  id: 'global-ws',
  name: 'Global Workspace',
  status: 'ready',
  capabilities: {
    hasFilesystem: false,
    hasSandbox: false,
    canBM25: false,
    canVector: false,
    canHybrid: false,
    hasSkills: false,
  },
};

export const emptySkills: ListSkillsResponse = {
  skills: [],
  isSkillsConfigured: false,
};
