import type { ListStoredWorkspacesResponse, StoredWorkspaceResponse } from '@mastra/client-js';

export const makeStoredWorkspace = (overrides: Partial<StoredWorkspaceResponse> = {}): StoredWorkspaceResponse => ({
  id: 'ws-1',
  status: 'active',
  name: 'Workspace One',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const storedWorkspacesPage = (
  workspaces: StoredWorkspaceResponse[],
  overrides: Partial<Omit<ListStoredWorkspacesResponse, 'workspaces'>> = {},
): ListStoredWorkspacesResponse => ({
  workspaces,
  total: workspaces.length,
  page: 1,
  perPage: 50,
  hasMore: false,
  ...overrides,
});
