import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MASTRA_RESOURCE_ID_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import type { ServerContext } from '../server-adapter';
import {
  LIST_STORED_WORKSPACES_ROUTE,
  GET_STORED_WORKSPACE_ROUTE,
  CREATE_STORED_WORKSPACE_ROUTE,
  UPDATE_STORED_WORKSPACE_ROUTE,
  DELETE_STORED_WORKSPACE_ROUTE,
} from './stored-workspaces';

// =============================================================================
// Mock Factories
// =============================================================================

interface MockStoredWorkspace {
  id: string;
  name: string;
  description?: string;
  authorId?: string;
  metadata?: Record<string, unknown>;
  status?: string;
  activeVersionId?: string;
}

interface MockWorkspacesStore {
  create: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
  getByIdResolved: ReturnType<typeof vi.fn>;
  listResolved: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
}

function createMockWorkspacesStore(data: Map<string, MockStoredWorkspace> = new Map()): MockWorkspacesStore {
  return {
    create: vi.fn().mockImplementation(async ({ workspace }: { workspace: MockStoredWorkspace }) => {
      if (data.has(workspace.id)) {
        throw new Error('Workspace already exists');
      }
      data.set(workspace.id, workspace);
      return workspace;
    }),
    getById: vi.fn().mockImplementation(async (id: string) => data.get(id) ?? null),
    getByIdResolved: vi.fn().mockImplementation(async (id: string) => data.get(id) ?? null),
    listResolved: vi.fn().mockImplementation(
      async ({
        page = 1,
        perPage = 20,
        authorId,
      }: {
        page?: number;
        perPage?: number;
        authorId?: string;
      } = {}) => {
        let workspaces = Array.from(data.values());

        if (authorId) {
          workspaces = workspaces.filter(w => w.authorId === authorId);
        }

        const start = (page - 1) * perPage;
        const end = start + perPage;
        const paginatedWorkspaces = workspaces.slice(start, end);

        return {
          workspaces: paginatedWorkspaces,
          total: workspaces.length,
          page,
          perPage,
          hasMore: end < workspaces.length,
        };
      },
    ),
    update: vi.fn().mockImplementation(async (updates: Partial<MockStoredWorkspace> & { id: string }) => {
      const existing = data.get(updates.id);
      if (!existing) return null;

      const updated = { ...existing };
      for (const key of Object.keys(updates)) {
        if (updates[key as keyof MockStoredWorkspace] !== undefined && key !== 'id') {
          (updated as any)[key] = updates[key as keyof MockStoredWorkspace];
        }
      }

      data.set(updates.id, updated);
      return updated;
    }),
    delete: vi.fn().mockImplementation(async (id: string) => data.delete(id)),
  };
}

interface MockStorage {
  getStore: ReturnType<typeof vi.fn>;
}

function createMockStorage(workspacesStore?: MockWorkspacesStore): MockStorage {
  return {
    getStore: vi.fn().mockImplementation(async (storeName: string) => {
      if (storeName === 'workspaces' && workspacesStore) {
        return workspacesStore;
      }
      return null;
    }),
  };
}

interface MockMastra {
  getStorage: ReturnType<typeof vi.fn>;
  getEditor: ReturnType<typeof vi.fn>;
  listWorkspaces: ReturnType<typeof vi.fn>;
}

function createMockMastra(options: { storage?: MockStorage } = {}): MockMastra {
  return {
    getStorage: vi.fn().mockReturnValue(options.storage),
    getEditor: vi.fn().mockReturnValue(undefined),
    listWorkspaces: vi.fn().mockReturnValue({}),
  };
}

function createTestContext(mastra: MockMastra): ServerContext {
  return {
    mastra: mastra as unknown as Mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  };
}

function createAuthenticatedContext(mastra: MockMastra, userId: string, permissions: string[] = []): ServerContext {
  const ctx = createTestContext(mastra);
  ctx.requestContext.set(MASTRA_RESOURCE_ID_KEY, userId);
  if (permissions.length > 0) {
    ctx.requestContext.set(MASTRA_USER_PERMISSIONS_KEY, permissions);
  }
  return ctx;
}

// =============================================================================
// Tests
// =============================================================================

describe('Stored Workspaces Handlers', () => {
  let mockData: Map<string, MockStoredWorkspace>;
  let mockStore: MockWorkspacesStore;
  let mockStorage: MockStorage;
  let mockMastra: MockMastra;

  beforeEach(() => {
    mockData = new Map();
    mockStore = createMockWorkspacesStore(mockData);
    mockStorage = createMockStorage(mockStore);
    mockMastra = createMockMastra({ storage: mockStorage });
  });

  // ---------------------------------------------------------------------------
  // LIST
  // ---------------------------------------------------------------------------

  describe('LIST_STORED_WORKSPACES_ROUTE', () => {
    it('returns an empty list when no workspaces exist', async () => {
      const result = await LIST_STORED_WORKSPACES_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
      });

      expect(result).toMatchObject({
        workspaces: [],
        total: 0,
        page: 1,
      });
    });

    it('filters list to owned + unowned for an authenticated non-admin caller', async () => {
      mockData.set('mine', { id: 'mine', name: 'Mine', authorId: 'user-a' });
      mockData.set('other-private', { id: 'other-private', name: 'Other', authorId: 'user-b' });
      mockData.set('unowned', { id: 'unowned', name: 'Legacy' });

      const result = await LIST_STORED_WORKSPACES_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        page: 1,
      });

      const ids = result.workspaces.map(w => w.id);
      expect(ids).toContain('mine');
      expect(ids).toContain('unowned');
      expect(ids).not.toContain('other-private');
    });

    it('returns all workspaces for an admin caller', async () => {
      mockData.set('mine', { id: 'mine', name: 'Mine', authorId: 'user-a' });
      mockData.set('other', { id: 'other', name: 'Other', authorId: 'user-b' });

      const result = await LIST_STORED_WORKSPACES_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a', ['*']),
        page: 1,
      });

      const ids = result.workspaces.map(w => w.id);
      expect(ids).toContain('mine');
      expect(ids).toContain('other');
    });

    it('returns nothing when a non-admin queries for another author', async () => {
      mockData.set('other', { id: 'other', name: 'Other', authorId: 'user-b' });

      const result = await LIST_STORED_WORKSPACES_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        page: 1,
        authorId: 'user-b',
      });

      expect(result.workspaces).toEqual([]);
    });

    it('throws when storage is not configured', async () => {
      const mastraNoStorage = createMockMastra({});

      await expect(
        LIST_STORED_WORKSPACES_ROUTE.handler({
          ...createTestContext(mastraNoStorage),
          page: 1,
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  // ---------------------------------------------------------------------------
  // GET
  // ---------------------------------------------------------------------------

  describe('GET_STORED_WORKSPACE_ROUTE', () => {
    it('allows owner to read their workspace', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      const result = await GET_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        storedWorkspaceId: 'w1',
      });

      expect(result).toMatchObject({ id: 'w1' });
    });

    it('throws 404 when a non-owner reads another user’s workspace', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      await expect(
        GET_STORED_WORKSPACE_ROUTE.handler({
          ...createAuthenticatedContext(mockMastra, 'user-b'),
          storedWorkspaceId: 'w1',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('allows admin to read any workspace', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      const result = await GET_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-b', ['*']),
        storedWorkspaceId: 'w1',
      });

      expect(result).toMatchObject({ id: 'w1' });
    });

    it('allows unowned workspaces to be read by any authenticated caller', async () => {
      mockData.set('legacy', { id: 'legacy', name: 'Legacy' });

      const result = await GET_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-b'),
        storedWorkspaceId: 'legacy',
      });

      expect(result).toMatchObject({ id: 'legacy' });
    });

    it('throws 404 when workspace does not exist', async () => {
      await expect(
        GET_STORED_WORKSPACE_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedWorkspaceId: 'nonexistent',
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  // ---------------------------------------------------------------------------
  // CREATE
  // ---------------------------------------------------------------------------

  describe('CREATE_STORED_WORKSPACE_ROUTE', () => {
    it('stamps authorId from the authenticated caller', async () => {
      await CREATE_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        name: 'Owned Workspace',
      });

      expect(mockStore.create).toHaveBeenCalledWith({
        workspace: expect.objectContaining({
          authorId: 'user-a',
        }),
      });
    });

    it('ignores body-provided authorId in favour of the caller', async () => {
      await CREATE_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        name: 'Owned Workspace',
        authorId: 'user-b',
      } as Parameters<typeof CREATE_STORED_WORKSPACE_ROUTE.handler>[0]);

      expect(mockStore.create).toHaveBeenCalledWith({
        workspace: expect.objectContaining({
          authorId: 'user-a',
        }),
      });
    });

    it('leaves authorId undefined when no caller is authenticated', async () => {
      await CREATE_STORED_WORKSPACE_ROUTE.handler({
        ...createTestContext(mockMastra),
        name: 'Legacy Workspace',
      });

      const call = mockStore.create.mock.calls[0]?.[0] as { workspace: MockStoredWorkspace };
      expect(call?.workspace?.authorId).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // UPDATE
  // ---------------------------------------------------------------------------

  describe('UPDATE_STORED_WORKSPACE_ROUTE', () => {
    it('allows owner to update their workspace', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      const result = await UPDATE_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        storedWorkspaceId: 'w1',
        name: 'Renamed',
      });

      expect(result).toMatchObject({ id: 'w1', name: 'Renamed' });
    });

    it('throws 404 when a non-owner tries to update', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      await expect(
        UPDATE_STORED_WORKSPACE_ROUTE.handler({
          ...createAuthenticatedContext(mockMastra, 'user-b'),
          storedWorkspaceId: 'w1',
          name: 'Hijacked',
        }),
      ).rejects.toThrow(HTTPException);

      expect(mockStore.update).not.toHaveBeenCalled();
    });

    it('allows admin to update any workspace', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      const result = await UPDATE_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-b', ['*']),
        storedWorkspaceId: 'w1',
        name: 'Renamed by admin',
      });

      expect(result).toMatchObject({ id: 'w1', name: 'Renamed by admin' });
    });

    it('allows scoped stored-workspaces:edit:<id> to update', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      const result = await UPDATE_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-b', ['stored-workspaces:edit:w1']),
        storedWorkspaceId: 'w1',
        name: 'Edited via scoped grant',
      });

      expect(result).toMatchObject({ id: 'w1', name: 'Edited via scoped grant' });
    });

    it('allows any authenticated caller to update unowned workspaces', async () => {
      mockData.set('legacy', { id: 'legacy', name: 'Legacy' });

      const result = await UPDATE_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-b'),
        storedWorkspaceId: 'legacy',
        name: 'Updated',
      });

      expect(result).toMatchObject({ id: 'legacy', name: 'Updated' });
    });

    it('does not allow changing authorId via PATCH', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      await UPDATE_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        storedWorkspaceId: 'w1',
        // Owner attempts to transfer ownership to another user.
        authorId: 'user-b',
        name: 'Renamed',
      } as Parameters<typeof UPDATE_STORED_WORKSPACE_ROUTE.handler>[0]);

      // Ownership must remain unchanged.
      expect(mockData.get('w1')?.authorId).toBe('user-a');
      // The update call (if any) must not carry an authorId field.
      const updateCall = mockStore.update.mock.calls[0]?.[0];
      expect(updateCall).toBeDefined();
      expect(updateCall).not.toHaveProperty('authorId');
    });
  });

  // ---------------------------------------------------------------------------
  // DELETE
  // ---------------------------------------------------------------------------

  describe('DELETE_STORED_WORKSPACE_ROUTE', () => {
    it('allows owner to delete their workspace', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      const result = await DELETE_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        storedWorkspaceId: 'w1',
      });

      expect(result).toMatchObject({ success: true });
      expect(mockData.has('w1')).toBe(false);
    });

    it('throws 404 when a non-owner tries to delete', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      await expect(
        DELETE_STORED_WORKSPACE_ROUTE.handler({
          ...createAuthenticatedContext(mockMastra, 'user-b'),
          storedWorkspaceId: 'w1',
        }),
      ).rejects.toThrow(HTTPException);

      expect(mockStore.delete).not.toHaveBeenCalled();
      expect(mockData.has('w1')).toBe(true);
    });

    it('allows admin to delete any workspace', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      await DELETE_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-b', ['*']),
        storedWorkspaceId: 'w1',
      });

      expect(mockData.has('w1')).toBe(false);
    });

    it('allows scoped stored-workspaces:delete:<id> to delete', async () => {
      mockData.set('w1', { id: 'w1', name: 'W1', authorId: 'user-a' });

      await DELETE_STORED_WORKSPACE_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-b', ['stored-workspaces:delete:w1']),
        storedWorkspaceId: 'w1',
      });

      expect(mockData.has('w1')).toBe(false);
    });
  });
});
