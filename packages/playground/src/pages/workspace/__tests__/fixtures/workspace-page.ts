import type {
  GetWorkspacesWorkspaceIdSkillsShPopular_Response,
  ListSkillsResponse,
  ListWorkspacesResponse,
  WorkspaceFsListResponse,
  WorkspaceInfoResponse,
  WorkspaceSearchResponse,
  WorkspaceFsReadResponse,
} from '@mastra/client-js';

export const workspaceId = 'ws-1';

const capabilities = {
  hasFilesystem: true,
  hasSandbox: false,
  canBM25: true,
  canVector: false,
  canHybrid: false,
  hasSkills: true,
};

export const workspacesList: ListWorkspacesResponse = {
  workspaces: [
    {
      id: workspaceId,
      name: 'Main workspace',
      status: 'ready',
      source: 'mastra',
      capabilities,
      safety: { readOnly: false },
    },
  ],
};

export const workspaceInfo: WorkspaceInfoResponse = {
  isWorkspaceConfigured: true,
  id: workspaceId,
  name: 'Main workspace',
  status: 'ready',
  capabilities,
  safety: { readOnly: false },
};

export const workspaceInfoWithoutSkills: WorkspaceInfoResponse = {
  ...workspaceInfo,
  capabilities: { ...capabilities, hasSkills: false },
};

export const rootListing: WorkspaceFsListResponse = {
  path: '.',
  entries: [{ name: 'notes', type: 'directory' }],
};

export const skillsList: ListSkillsResponse = {
  skills: [],
  isSkillsConfigured: true,
};

export const popularSkills: GetWorkspacesWorkspaceIdSkillsShPopular_Response = {
  skills: [],
  count: 0,
  limit: 10,
  offset: 0,
};

export const installedSkills: ListSkillsResponse = {
  isSkillsConfigured: true,
  skills: [{ name: 'review', description: 'Review code changes', path: 'review' }],
};
export const searchResults: WorkspaceSearchResponse = {
  query: 'guide',
  mode: 'bm25',
  results: [{ id: 'guide.md#chunk-0', content: '# Workspace guide', score: 1 }],
};
export const searchedFile: WorkspaceFsReadResponse = {
  path: 'guide.md',
  type: 'file',
  content: '# Workspace guide',
  mimeType: 'text/markdown',
};
