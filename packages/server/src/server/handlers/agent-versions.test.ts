import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/di';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import type { ServerContext } from '../server-adapter';

import { UNPUBLISH_AGENT_VERSION_ROUTE } from './agent-versions';

interface MockStoredAgent {
  id: string;
  name: string;
  authorId?: string;
  activeVersionId?: string | null;
  status?: string;
}

interface MockAgentsStore {
  getById: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
}

function createMockAgentsStore(agentsData: Map<string, MockStoredAgent> = new Map()): MockAgentsStore {
  return {
    getById: vi.fn().mockImplementation(async (id: string) => agentsData.get(id) ?? null),
    update: vi.fn().mockImplementation(async (updates: Partial<MockStoredAgent> & { id: string }) => {
      const existing = agentsData.get(updates.id);
      if (!existing) return null;

      const updated = { ...existing };
      for (const key of Object.keys(updates)) {
        if (updates[key as keyof MockStoredAgent] !== undefined && key !== 'id') {
          (updated as any)[key] = updates[key as keyof MockStoredAgent];
        }
      }

      agentsData.set(updates.id, updated);
      return updated;
    }),
  };
}

interface MockStorage {
  getStore: ReturnType<typeof vi.fn>;
}

function createMockStorage(agentsStore?: MockAgentsStore): MockStorage {
  return {
    getStore: vi.fn().mockImplementation(async (storeName: string) => {
      if (storeName === 'agents' && agentsStore) {
        return agentsStore;
      }
      return null;
    }),
  };
}

interface MockEditor {
  agent: {
    clearCache: ReturnType<typeof vi.fn>;
  };
}

function createMockEditor(): MockEditor {
  return {
    agent: {
      clearCache: vi.fn(),
    },
  };
}

interface MockMastra {
  getStorage: ReturnType<typeof vi.fn>;
  getEditor: ReturnType<typeof vi.fn>;
}

function createMockMastra(options: { storage?: MockStorage; editor?: MockEditor } = {}): MockMastra {
  return {
    getStorage: vi.fn().mockReturnValue(options.storage),
    getEditor: vi.fn().mockReturnValue(options.editor),
  };
}

function createTestContext(mastra: MockMastra): ServerContext {
  return {
    mastra: mastra as unknown as Mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  };
}

describe('Agent Version Handlers', () => {
  let mockAgentsData: Map<string, MockStoredAgent>;
  let mockAgentsStore: MockAgentsStore;
  let mockStorage: MockStorage;
  let mockEditor: MockEditor;
  let mockMastra: MockMastra;

  beforeEach(() => {
    mockAgentsData = new Map();
    mockAgentsStore = createMockAgentsStore(mockAgentsData);
    mockStorage = createMockStorage(mockAgentsStore);
    mockEditor = createMockEditor();
    mockMastra = createMockMastra({ storage: mockStorage, editor: mockEditor });
  });

  describe('UNPUBLISH_AGENT_VERSION_ROUTE', () => {
    it('clears the active published version and cache', async () => {
      mockAgentsData.set('agent-1', {
        id: 'agent-1',
        name: 'Agent 1',
        activeVersionId: 'version-1',
        status: 'published',
      });

      const result = await UNPUBLISH_AGENT_VERSION_ROUTE.handler({
        ...createTestContext(mockMastra),
        agentId: 'agent-1',
      });

      expect(mockAgentsStore.update).toHaveBeenCalledWith({
        id: 'agent-1',
        activeVersionId: null,
        status: 'draft',
      });
      expect(mockEditor.agent.clearCache).toHaveBeenCalledWith('agent-1');
      expect(result).toEqual({
        success: true,
        message: 'Published version cleared',
        activeVersionId: null,
      });
    });

    it('throws 404 when the stored agent does not exist', async () => {
      await expect(
        UNPUBLISH_AGENT_VERSION_ROUTE.handler({
          ...createTestContext(mockMastra),
          agentId: 'missing-agent',
        }),
      ).rejects.toMatchObject({
        status: 404,
        message: 'Agent with id missing-agent not found',
      });
    });

    it('throws 500 when storage is not configured', async () => {
      const mastraWithoutStorage = createMockMastra({ editor: mockEditor });

      await expect(
        UNPUBLISH_AGENT_VERSION_ROUTE.handler({
          ...createTestContext(mastraWithoutStorage),
          agentId: 'agent-1',
        }),
      ).rejects.toMatchObject({
        status: 500,
        message: 'Storage is not configured',
      });
    });
  });
});
