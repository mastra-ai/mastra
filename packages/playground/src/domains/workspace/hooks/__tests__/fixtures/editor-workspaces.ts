import type {
  ListSkillsResponse,
  ListStoredWorkspacesResponse,
  StoredWorkspaceResponse,
  WorkspaceFsListResponse,
  WorkspaceInfoResponse,
} from '@mastra/client-js';

const now = '2026-01-01T00:00:00.000Z';

export const makeStoredWorkspace = (overrides: Partial<StoredWorkspaceResponse> = {}): StoredWorkspaceResponse => ({
  id: 'support-workspace',
  name: 'Support workspace',
  description: 'Workspace used by support agents',
  status: 'active',
  authorId: 'user-1',
  createdAt: now,
  updatedAt: now,
  skills: ['refund-policy'],
  runtimeRegistered: false,
  autoSync: true,
  ...overrides,
});

export const makeStoredWorkspacesList = (
  workspaces: StoredWorkspaceResponse[] = [makeStoredWorkspace()],
  overrides: Partial<ListStoredWorkspacesResponse> = {},
): ListStoredWorkspacesResponse => ({
  workspaces,
  total: workspaces.length,
  page: 1,
  perPage: 50,
  hasMore: false,
  ...overrides,
});

export const workspaceInfo: WorkspaceInfoResponse = {
  isWorkspaceConfigured: true,
  id: 'support-workspace',
  name: 'Support workspace',
  status: 'ready',
  capabilities: {
    hasFilesystem: true,
    hasSandbox: false,
    canBM25: true,
    canVector: false,
    canHybrid: false,
    hasSkills: true,
  },
  safety: { readOnly: false },
  filesystem: {
    id: 'local-fs',
    name: 'Local filesystem',
    provider: 'local',
    status: 'ready',
  },
};

export const workspaceFiles: WorkspaceFsListResponse = {
  path: '/skills',
  entries: [
    { name: 'refund-policy', type: 'directory' },
    { name: 'README.md', type: 'file', size: 128 },
  ],
};

export const workspaceSkills: ListSkillsResponse = {
  isSkillsConfigured: true,
  skills: [
    {
      name: 'refund-policy',
      description: 'Explains refund policy constraints',
      path: '/skills/refund-policy',
      metadata: { managedBy: 'editor' },
    },
  ],
};
