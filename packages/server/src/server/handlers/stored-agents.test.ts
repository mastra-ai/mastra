import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MASTRA_RESOURCE_ID_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { createStoredAgentBodySchema, updateStoredAgentBodySchema } from '../schemas/stored-agents';
import type { ServerContext } from '../server-adapter';
import {
  LIST_STORED_AGENTS_ROUTE,
  GET_STORED_AGENT_ROUTE,
  CREATE_STORED_AGENT_ROUTE,
  UPDATE_STORED_AGENT_ROUTE,
  DELETE_STORED_AGENT_ROUTE,
  PREVIEW_INSTRUCTIONS_ROUTE,
} from './stored-agents';

// Mock handleAutoVersioning to prevent version creation in tests
vi.mock('./agent-versions', () => ({
  handleAutoVersioning: vi.fn().mockImplementation(async (_store: any, _id: any, _existing: any, updatedAgent: any) => {
    return { agent: updatedAgent, versionCreated: false };
  }),
}));

// =============================================================================
// Mock Factories
// =============================================================================

// Define the shape of our mock stored agent
interface MockStoredAgent {
  id: string;
  name: string;
  description?: string;
  instructions?: string;
  model: {
    name: string;
    provider: string;
  };
  tools?: unknown[];
  defaultOptions?: Record<string, unknown>;
  workflows?: unknown[];
  agents?: unknown[];
  integrationTools?: unknown[];
  inputProcessors?: string[];
  outputProcessors?: string[];
  memory?: unknown;
  scorers?: unknown[];
  authorId?: string;
  metadata?: Record<string, unknown>;
  activeVersionId?: string;
}

// Define the mock agents store interface
interface MockAgentsStore {
  create: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
  getByIdResolved: ReturnType<typeof vi.fn>;
  listResolved: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  getLatestVersion: ReturnType<typeof vi.fn>;
  getVersion: ReturnType<typeof vi.fn>;
  createVersion: ReturnType<typeof vi.fn>;
  listVersions: ReturnType<typeof vi.fn>;
}

function createMockAgentsStore(agentsData: Map<string, MockStoredAgent> = new Map()): MockAgentsStore {
  return {
    create: vi.fn().mockImplementation(async ({ agent }: { agent: MockStoredAgent }) => {
      if (agentsData.has(agent.id)) {
        throw new Error('Agent already exists');
      }
      agentsData.set(agent.id, agent);
      return agent;
    }),
    getById: vi.fn().mockImplementation(async (id: string) => {
      return agentsData.get(id) || null;
    }),
    getByIdResolved: vi.fn().mockImplementation(async (id: string) => {
      return agentsData.get(id) || null;
    }),
    listResolved: vi.fn().mockImplementation(
      async ({
        page = 1,
        perPage = 20,
        authorId,
        metadata,
      }: {
        page?: number;
        perPage?: number;
        authorId?: string;
        metadata?: Record<string, unknown>;
      } = {}) => {
        let agents = Array.from(agentsData.values());

        // Filter by authorId if provided
        if (authorId) {
          agents = agents.filter(a => a.authorId === authorId);
        }

        // Filter by metadata if provided
        if (metadata) {
          agents = agents.filter(a => {
            if (!a.metadata) return false;
            return Object.entries(metadata).every(([key, value]) => a.metadata?.[key] === value);
          });
        }

        const start = (page - 1) * perPage;
        const end = start + perPage;
        const paginatedAgents = agents.slice(start, end);

        return {
          agents: paginatedAgents,
          total: agents.length,
          page,
          perPage,
          hasMore: end < agents.length,
        };
      },
    ),
    update: vi.fn().mockImplementation(async (updates: Partial<MockStoredAgent> & { id: string }) => {
      const existing = agentsData.get(updates.id);
      if (!existing) return null;

      // Merge updates with existing agent
      const updated = { ...existing };
      Object.keys(updates).forEach(key => {
        if (updates[key as keyof MockStoredAgent] !== undefined && key !== 'id') {
          (updated as any)[key] = updates[key as keyof MockStoredAgent];
        }
      });

      agentsData.set(updates.id, updated);
      return updated;
    }),
    delete: vi.fn().mockImplementation(async (id: string) => {
      return agentsData.delete(id);
    }),
    getLatestVersion: vi.fn().mockImplementation(async (agentId: string) => {
      const agent = agentsData.get(agentId);
      if (!agent) return null;
      // Mock version data
      return {
        id: `v-${agentId}-1`,
        agentId,
        versionNumber: 1,
        name: agent.name,
        description: agent.description,
        instructions: agent.instructions,
        model: agent.model,
        tools: agent.tools,
        defaultOptions: agent.defaultOptions,
        workflows: agent.workflows,
        agents: agent.agents,
        integrationTools: agent.integrationTools,
        inputProcessors: agent.inputProcessors,
        outputProcessors: agent.outputProcessors,
        memory: agent.memory,
        scorers: agent.scorers,
      };
    }),
    getVersion: vi.fn().mockImplementation(async (versionId: string) => {
      // Extract agentId from version ID (format: v-{agentId}-{number})
      const match = versionId.match(/^v-(.*)-\d+$/);
      if (!match) return null;
      const agentId = match[1];
      const agent = agentsData.get(agentId);
      if (!agent) return null;

      return {
        id: versionId,
        agentId,
        versionNumber: 1,
        name: agent.name,
        description: agent.description,
        instructions: agent.instructions,
        model: agent.model,
        tools: agent.tools,
        defaultOptions: agent.defaultOptions,
        workflows: agent.workflows,
        agents: agent.agents,
        integrationTools: agent.integrationTools,
        inputProcessors: agent.inputProcessors,
        outputProcessors: agent.outputProcessors,
        memory: agent.memory,
        scorers: agent.scorers,
      };
    }),
    createVersion: vi.fn().mockImplementation(async (params: any) => {
      return { id: params.id, versionNumber: params.versionNumber };
    }),
    listVersions: vi.fn().mockImplementation(async () => {
      return { versions: [], total: 0 };
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
    create: ReturnType<typeof vi.fn>;
  };
  prompt: {
    preview: ReturnType<typeof vi.fn>;
  };
}

function createMockEditor(agentsStore?: MockAgentsStore): MockEditor {
  return {
    agent: {
      clearCache: vi.fn(),
      // Delegate to storage so existing assertions work
      create: vi.fn().mockImplementation(async (input: unknown) => {
        if (agentsStore) {
          await agentsStore.create({ agent: input });
        }
        return {} as unknown;
      }),
    },
    prompt: {
      preview: vi.fn().mockResolvedValue('resolved instructions'),
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

describe('Stored Agents Handlers', () => {
  let mockAgentsData: Map<string, MockStoredAgent>;
  let mockAgentsStore: MockAgentsStore;
  let mockStorage: MockStorage;
  let mockEditor: MockEditor;
  let mockMastra: MockMastra;

  beforeEach(() => {
    // Reset mocks for each test
    mockAgentsData = new Map();
    mockAgentsStore = createMockAgentsStore(mockAgentsData);
    mockStorage = createMockStorage(mockAgentsStore);
    mockEditor = createMockEditor(mockAgentsStore);
    mockMastra = createMockMastra({ storage: mockStorage, editor: mockEditor });
  });

  describe('LIST_STORED_AGENTS_ROUTE', () => {
    it('should return empty list when no agents exist', async () => {
      const result = await LIST_STORED_AGENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
      });

      expect(result).toEqual({
        agents: [],
        total: 0,
        page: 1,
        perPage: 20,
        hasMore: false,
      });
    });

    it('should return list of stored agents', async () => {
      // Add test agents to mock data
      mockAgentsData.set('agent1', {
        id: 'agent1',
        name: 'Test Agent 1',
        description: 'First test agent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'author1',
      });

      mockAgentsData.set('agent2', {
        id: 'agent2',
        name: 'Test Agent 2',
        description: 'Second test agent',
        model: { name: 'gpt-3.5-turbo', provider: 'openai' },
        authorId: 'author2',
      });

      const result = await LIST_STORED_AGENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
      });

      expect(result.agents).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.agents[0]).toMatchObject({
        id: 'agent1',
        name: 'Test Agent 1',
        description: 'First test agent',
      });
    });

    it('should support pagination', async () => {
      // Create 5 test agents
      for (let i = 1; i <= 5; i++) {
        mockAgentsData.set(`agent${i}`, {
          id: `agent${i}`,
          name: `Test Agent ${i}`,
          model: { name: 'gpt-4', provider: 'openai' },
        });
      }

      // Test page 1 with perPage 2
      const page1 = await LIST_STORED_AGENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
        perPage: 2,
      });

      expect(page1.agents).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);
      expect(page1.page).toBe(1);

      // Test page 2
      const page2 = await LIST_STORED_AGENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 2,
        perPage: 2,
      });

      expect(page2.agents).toHaveLength(2);
      expect(page2.page).toBe(2);
    });

    it('should filter by authorId', async () => {
      mockAgentsData.set('agent1', {
        id: 'agent1',
        name: 'Agent 1',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'author1',
      });

      mockAgentsData.set('agent2', {
        id: 'agent2',
        name: 'Agent 2',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'author2',
      });

      const result = await LIST_STORED_AGENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
        authorId: 'author1',
      });

      expect(result.agents).toHaveLength(1);
      expect(result.agents[0].id).toBe('agent1');
    });

    it('should throw error when storage is not configured', async () => {
      const mastraNoStorage = createMockMastra({});

      try {
        await LIST_STORED_AGENTS_ROUTE.handler({
          ...createTestContext(mastraNoStorage),
          page: 1,
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not configured');
      }
    });
  });

  describe('GET_STORED_AGENT_ROUTE', () => {
    it('should get a specific stored agent', async () => {
      mockAgentsData.set('test-agent', {
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        instructions: 'Be helpful',
        model: { name: 'gpt-4', provider: 'openai' },
        tools: ['tool1'],
        metadata: { version: '1.0' },
      });

      const result = await GET_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'test-agent',
      });

      expect(result).toMatchObject({
        id: 'test-agent',
        name: 'Test Agent',
        description: 'A test agent',
        instructions: 'Be helpful',
        model: { name: 'gpt-4', provider: 'openai' },
        tools: ['tool1'],
        metadata: { version: '1.0' },
      });
    });

    it('should throw 404 when agent does not exist', async () => {
      try {
        await GET_STORED_AGENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedAgentId: 'non-existent',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe('Stored agent with id non-existent not found');
      }
    });
  });

  describe('CREATE_STORED_AGENT_ROUTE', () => {
    it('should create a new stored agent', async () => {
      const agentData = {
        id: 'new-agent',
        name: 'New Agent',
        description: 'A newly created agent',
        instructions: 'Be creative',
        model: { name: 'gpt-4', provider: 'openai' },
        metadata: { created: 'test' },
        tools: ['tool1'],
        defaultOptions: {
          temperature: 0.7,
          maxTokens: 1000,
        },
      };

      const result = await CREATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        ...agentData,
      });

      expect(result).toMatchObject(agentData);
      // No auth context → no authorId → defaults to public (unowned resources are public)
      expect(mockAgentsStore.create).toHaveBeenCalledWith({
        agent: expect.objectContaining({
          id: 'new-agent',
          name: 'New Agent',
          visibility: 'public',
        }),
      });
    });

    it('should derive id from name via slugify when id is not provided', async () => {
      const result = await CREATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        id: undefined,
        name: 'My Cool Agent',
        instructions: 'Be helpful',
        model: { name: 'gpt-4', provider: 'openai' },
      });

      expect(result).toMatchObject({
        id: 'my-cool-agent',
        name: 'My Cool Agent',
      });
      expect(mockAgentsStore.create).toHaveBeenCalledWith({
        agent: expect.objectContaining({
          id: 'my-cool-agent',
          name: 'My Cool Agent',
        }),
      });
    });

    it('should use provided id when explicitly set', async () => {
      const result = await CREATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        id: 'custom-id-123',
        name: 'My Agent',
        instructions: 'Be helpful',
        model: { name: 'gpt-4', provider: 'openai' },
      });

      expect(result).toMatchObject({
        id: 'custom-id-123',
        name: 'My Agent',
      });
    });

    it('should throw 409 when agent with same ID already exists', async () => {
      mockAgentsData.set('existing-agent', {
        id: 'existing-agent',
        name: 'Existing Agent',
        model: { name: 'gpt-4', provider: 'openai' },
      });

      try {
        await CREATE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          id: 'existing-agent',
          name: 'Duplicate Agent',
          instructions: 'Test instructions',
          model: { name: 'gpt-4', provider: 'openai' },
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(409);
        expect((error as HTTPException).message).toBe('Agent with id existing-agent already exists');
      }
    });

    it('should accept metadata with a small avatarUrl', async () => {
      const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const avatarUrl = `data:image/png;base64,${tinyPng}`;

      const result = await CREATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        id: 'avatar-agent',
        name: 'Avatar Agent',
        instructions: 'Test',
        model: { name: 'gpt-4', provider: 'openai' },
        metadata: { avatarUrl },
      });

      expect(result).toMatchObject({ id: 'avatar-agent' });
      expect(mockAgentsStore.create).toHaveBeenCalledWith({
        agent: expect.objectContaining({
          metadata: { avatarUrl },
        }),
      });
    });

    it('should reject metadata with an oversized avatarUrl (413)', async () => {
      const big = Buffer.alloc(600 * 1024, 0).toString('base64');
      const avatarUrl = `data:image/png;base64,${big}`;

      try {
        await CREATE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          id: 'big-avatar-agent',
          name: 'Big Avatar Agent',
          instructions: 'Test',
          model: { name: 'gpt-4', provider: 'openai' },
          metadata: { avatarUrl },
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(413);
      }
    });
  });

  describe('UPDATE_STORED_AGENT_ROUTE', () => {
    it.skip('should update an existing stored agent', async () => {
      mockAgentsData.set('update-test', {
        id: 'update-test',
        name: 'Original Name',
        description: 'Original description',
        model: { name: 'gpt-3.5-turbo', provider: 'openai' },
        authorId: 'original-author',
        activeVersionId: 'v-update-test-1',
      });

      const result = await UPDATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'update-test',
        name: 'Updated Name',
        description: 'Updated description',
        model: { name: 'gpt-4', provider: 'openai' },
        instructions: 'New instructions',
      });

      expect(result).toMatchObject({
        id: 'update-test',
        name: 'Updated Name',
        description: 'Updated description',
        model: { name: 'gpt-4', provider: 'openai' },
        instructions: 'New instructions',
        authorId: 'original-author', // Should remain unchanged
      });

      expect(mockEditor.agent.clearCache).toHaveBeenCalledWith('update-test');
    });

    it('should throw 404 when agent does not exist', async () => {
      try {
        await UPDATE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedAgentId: 'non-existent',
          name: 'Updated Name',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe('Stored agent with id non-existent not found');
      }
    });

    it('should allow updating memory to null to disable memory', async () => {
      // Set up an agent with memory configured
      mockAgentsData.set('memory-test', {
        id: 'memory-test',
        name: 'Memory Agent',
        instructions: 'Be helpful',
        model: { name: 'gpt-4', provider: 'openai' },
        memory: {
          options: {
            lastMessages: 10,
            semanticRecall: false,
          },
        },
        activeVersionId: 'v-memory-test-1',
      });

      // Update memory to null (disable it)
      const result = await UPDATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'memory-test',
        memory: null,
      });

      expect(result).toMatchObject({
        id: 'memory-test',
        name: 'Memory Agent',
      });

      // Verify the storage update was called with null memory
      expect(mockAgentsStore.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'memory-test',
          memory: null,
        }),
      );
    });

    it('should not modify memory when memory is not provided in update', async () => {
      mockAgentsData.set('memory-keep-test', {
        id: 'memory-keep-test',
        name: 'Memory Keep Agent',
        instructions: 'Be helpful',
        model: { name: 'gpt-4', provider: 'openai' },
        memory: {
          options: {
            lastMessages: 10,
            semanticRecall: false,
          },
        },
        activeVersionId: 'v-memory-keep-test-1',
      });

      // Update only the name, not memory
      const result = await UPDATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'memory-keep-test',
        name: 'Updated Name',
      });

      expect(result).toMatchObject({
        id: 'memory-keep-test',
        name: 'Updated Name',
      });

      // Verify the stored agent still has memory
      const stored = mockAgentsData.get('memory-keep-test');
      expect(stored?.memory).toEqual({
        options: {
          lastMessages: 10,
          semanticRecall: false,
        },
      });
    });

    it('should accept metadata with a small avatarUrl on update', async () => {
      mockAgentsData.set('avatar-update-test', {
        id: 'avatar-update-test',
        name: 'Avatar Update Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        activeVersionId: 'v-avatar-update-1',
      });

      const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
      const avatarUrl = `data:image/png;base64,${tinyPng}`;

      const result = await UPDATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'avatar-update-test',
        metadata: { avatarUrl },
      });

      expect(result).toMatchObject({ id: 'avatar-update-test' });
      expect(mockAgentsStore.update).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { avatarUrl },
        }),
      );
    });

    it('should reject metadata with an oversized avatarUrl on update (413)', async () => {
      mockAgentsData.set('avatar-update-big', {
        id: 'avatar-update-big',
        name: 'Big Avatar Update Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        activeVersionId: 'v-avatar-update-big-1',
      });

      const big = Buffer.alloc(600 * 1024, 0).toString('base64');
      const avatarUrl = `data:image/png;base64,${big}`;

      try {
        await UPDATE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedAgentId: 'avatar-update-big',
          metadata: { avatarUrl },
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(413);
      }
    });

    it('should reject metadata with a malformed avatarUrl on update (400)', async () => {
      mockAgentsData.set('avatar-update-bad', {
        id: 'avatar-update-bad',
        name: 'Bad Avatar Update Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        activeVersionId: 'v-avatar-update-bad-1',
      });

      try {
        await UPDATE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedAgentId: 'avatar-update-bad',
          metadata: { avatarUrl: 'not-a-data-url' },
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(400);
      }
    });
  });

  describe('DELETE_STORED_AGENT_ROUTE', () => {
    it('should delete an existing stored agent', async () => {
      mockAgentsData.set('delete-test', {
        id: 'delete-test',
        name: 'To Be Deleted',
        model: { name: 'gpt-4', provider: 'openai' },
      });

      const result = await DELETE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'delete-test',
      });

      expect(result).toEqual({ success: true, message: 'Agent delete-test deleted successfully' });
      expect(mockAgentsStore.delete).toHaveBeenCalledWith('delete-test');
      expect(mockAgentsData.has('delete-test')).toBe(false);
      expect(mockEditor.agent.clearCache).toHaveBeenCalledWith('delete-test');
    });

    it('should throw 404 when agent does not exist', async () => {
      try {
        await DELETE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedAgentId: 'non-existent',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe('Stored agent with id non-existent not found');
      }
    });
  });

  describe('PREVIEW_INSTRUCTIONS_ROUTE', () => {
    it('should resolve instruction blocks and return result', async () => {
      const blocks = [
        { type: 'text' as const, content: 'Hello {{name}}' },
        { type: 'prompt_block_ref' as const, id: 'block-1' },
      ];
      const context = { name: 'World' };

      mockEditor.prompt.preview.mockResolvedValue('Hello World\n\nResolved block content');

      const result = await PREVIEW_INSTRUCTIONS_ROUTE.handler({
        ...createTestContext(mockMastra),
        blocks,
        context,
      });

      expect(result).toEqual({ result: 'Hello World\n\nResolved block content' });
      expect(mockEditor.prompt.preview).toHaveBeenCalledWith(blocks, context);
    });

    it('should pass empty context when none provided', async () => {
      const blocks = [{ type: 'text' as const, content: 'Static content' }];

      mockEditor.prompt.preview.mockResolvedValue('Static content');

      const result = await PREVIEW_INSTRUCTIONS_ROUTE.handler({
        ...createTestContext(mockMastra),
        blocks,
        context: {},
      });

      expect(result).toEqual({ result: 'Static content' });
      expect(mockEditor.prompt.preview).toHaveBeenCalledWith(blocks, {});
    });

    it('should throw 500 when editor is not configured', async () => {
      const mastraNoEditor = createMockMastra({ storage: mockStorage });
      const blocks = [{ type: 'text' as const, content: 'Hello' }];

      try {
        await PREVIEW_INSTRUCTIONS_ROUTE.handler({
          ...createTestContext(mastraNoEditor),
          blocks,
          context: {},
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Editor is not configured');
      }
    });

    it('should handle inline prompt_block with rules', async () => {
      const blocks = [
        {
          type: 'prompt_block' as const,
          content: 'You are an admin assistant',
          rules: {
            operator: 'AND' as const,
            conditions: [{ field: 'user.role', operator: 'equals' as const, value: 'admin' }],
          },
        },
      ];
      const context = { user: { role: 'admin' } };

      mockEditor.prompt.preview.mockResolvedValue('You are an admin assistant');

      const result = await PREVIEW_INSTRUCTIONS_ROUTE.handler({
        ...createTestContext(mockMastra),
        blocks,
        context,
      });

      expect(result).toEqual({ result: 'You are an admin assistant' });
      expect(mockEditor.prompt.preview).toHaveBeenCalledWith(blocks, context);
    });

    it('should handle editor errors gracefully', async () => {
      const blocks = [{ type: 'text' as const, content: 'Hello' }];
      mockEditor.prompt.preview.mockRejectedValue(new Error('Block resolution failed'));

      try {
        await PREVIEW_INSTRUCTIONS_ROUTE.handler({
          ...createTestContext(mockMastra),
          blocks,
          context: {},
        });
        expect.fail('Should have thrown');
      } catch (error) {
        // handleError wraps it - the error propagates
        expect(error).toBeDefined();
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Authorship & Visibility
  // ---------------------------------------------------------------------------

  describe('LIST visibility filtering', () => {
    beforeEach(() => {
      mockAgentsData.set('my-private', {
        id: 'my-private',
        name: 'My Private',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'user-a',
        visibility: 'private',
      });
      mockAgentsData.set('my-public', {
        id: 'my-public',
        name: 'My Public',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'user-a',
        visibility: 'public',
      });
      mockAgentsData.set('other-public', {
        id: 'other-public',
        name: 'Other Public',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'user-b',
        visibility: 'public',
      });
      mockAgentsData.set('other-private', {
        id: 'other-private',
        name: 'Other Private',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'user-b',
        visibility: 'private',
      });
      mockAgentsData.set('unowned', {
        id: 'unowned',
        name: 'Unowned Agent',
        model: { name: 'gpt-4', provider: 'openai' },
      });
    });

    it('should filter to owned + public for authenticated non-admin', async () => {
      const result = await LIST_STORED_AGENTS_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        page: 1,
        status: 'published' as const,
      });

      const ids = result.agents.map((a: any) => a.id);
      expect(ids).toContain('my-private');
      expect(ids).toContain('my-public');
      expect(ids).toContain('other-public');
      expect(ids).toContain('unowned');
      expect(ids).not.toContain('other-private');
    });

    it('should return all agents for admin', async () => {
      const result = await LIST_STORED_AGENTS_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'admin', ['*']),
        page: 1,
        status: 'published' as const,
      });

      expect(result.agents).toHaveLength(5);
    });

    it('should filter by visibility=public', async () => {
      const result = await LIST_STORED_AGENTS_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'user-a'),
        page: 1,
        status: 'published' as const,
        visibility: 'public' as const,
      });

      const ids = result.agents.map((a: any) => a.id);
      expect(ids).toContain('my-public');
      expect(ids).toContain('other-public');
      expect(ids).toContain('unowned');
      expect(ids).not.toContain('my-private');
      expect(ids).not.toContain('other-private');
    });
  });

  describe('UPDATE write-access enforcement', () => {
    it('should throw when non-owner tries to update', async () => {
      mockAgentsData.set('other-agent', {
        id: 'other-agent',
        name: 'Other Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'user-a',
        visibility: 'public',
        activeVersionId: 'v-other-1',
      });

      await expect(
        UPDATE_STORED_AGENT_ROUTE.handler({
          ...createAuthenticatedContext(mockMastra, 'user-b'),
          storedAgentId: 'other-agent',
          name: 'Hacked',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should allow admin to update any agent', async () => {
      mockAgentsData.set('other-agent', {
        id: 'other-agent',
        name: 'Other Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'user-a',
        visibility: 'private',
        activeVersionId: 'v-other-1',
      });

      const result = await UPDATE_STORED_AGENT_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'admin', ['*']),
        storedAgentId: 'other-agent',
        name: 'Admin Updated',
      });

      expect(result).toMatchObject({
        id: 'other-agent',
        name: 'Admin Updated',
      });
    });

    it('should throw when non-owner tries to update avatar via metadata', async () => {
      mockAgentsData.set('other-agent', {
        id: 'other-agent',
        name: 'Other Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'user-a',
        visibility: 'public',
        activeVersionId: 'v-other-1',
      });

      const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

      await expect(
        UPDATE_STORED_AGENT_ROUTE.handler({
          ...createAuthenticatedContext(mockMastra, 'user-b'),
          storedAgentId: 'other-agent',
          metadata: { avatarUrl: `data:image/png;base64,${tinyPng}` },
        }),
      ).rejects.toThrow(HTTPException);
    });
  });

  describe('DELETE write-access enforcement', () => {
    it('should throw when non-owner tries to delete', async () => {
      mockAgentsData.set('other-agent', {
        id: 'other-agent',
        name: 'Other Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'user-a',
        visibility: 'public',
      });

      await expect(
        DELETE_STORED_AGENT_ROUTE.handler({
          ...createAuthenticatedContext(mockMastra, 'user-b'),
          storedAgentId: 'other-agent',
        }),
      ).rejects.toThrow(HTTPException);
    });

    it('should allow admin to delete any agent', async () => {
      mockAgentsData.set('other-agent', {
        id: 'other-agent',
        name: 'Other Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'user-a',
        visibility: 'private',
      });

      const result = await DELETE_STORED_AGENT_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'admin', ['*']),
        storedAgentId: 'other-agent',
      });

      expect(result).toMatchObject({ success: true });
    });
  });
});

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe('updateStoredAgentBodySchema', () => {
  it('should accept memory as null to disable memory', () => {
    const result = updateStoredAgentBodySchema.safeParse({
      memory: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memory).toBeNull();
    }
  });

  it('should accept memory as undefined (omitted)', () => {
    const result = updateStoredAgentBodySchema.safeParse({
      name: 'Updated Name',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memory).toBeUndefined();
    }
  });

  it('should accept a valid memory config object', () => {
    const result = updateStoredAgentBodySchema.safeParse({
      memory: {
        options: {
          lastMessages: 10,
          semanticRecall: false,
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.memory).toEqual({
        options: {
          lastMessages: 10,
          semanticRecall: false,
        },
      });
    }
  });

  it('should reject invalid memory config (non-object, non-null)', () => {
    const result = updateStoredAgentBodySchema.safeParse({
      memory: 'invalid',
    });

    expect(result.success).toBe(false);
  });

  it('should accept update with only memory set to null', () => {
    const result = updateStoredAgentBodySchema.safeParse({
      memory: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual({ memory: null });
    }
  });

  it('should accept update with memory null alongside other fields', () => {
    const result = updateStoredAgentBodySchema.safeParse({
      name: 'New Name',
      memory: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('New Name');
      expect(result.data.memory).toBeNull();
    }
  });
});

describe('createStoredAgentBodySchema', () => {
  const baseAgent = {
    name: 'Test Agent',
    instructions: 'Be helpful',
    model: { name: 'gpt-4', provider: 'openai' },
  };

  it('should accept a create body without id', () => {
    const result = createStoredAgentBodySchema.safeParse(baseAgent);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBeUndefined();
      expect(result.data.name).toBe('Test Agent');
    }
  });

  it('should accept a create body with an explicit id', () => {
    const result = createStoredAgentBodySchema.safeParse({
      ...baseAgent,
      id: 'custom-id',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('custom-id');
    }
  });

  it('should require name', () => {
    const result = createStoredAgentBodySchema.safeParse({
      instructions: 'Be helpful',
      model: { name: 'gpt-4', provider: 'openai' },
    });

    expect(result.success).toBe(false);
  });
});

describe('Phase 6: UPDATE_STORED_AGENT_ROUTE allowlist enforcement', () => {
  function makeBuilderEditor(opts: { allowed?: Array<{ provider: string; modelId?: string }> }) {
    const allowed = opts.allowed?.map(a => ({
      kind: 'known' as const,
      provider: a.provider,
      ...(a.modelId !== undefined ? { modelId: a.modelId } : {}),
    }));
    return {
      hasEnabledBuilderConfig: () => true,
      resolveBuilder: async () => ({
        enabled: true,
        getFeatures: () => ({ agent: { model: true } }),
        getConfiguration: () => ({
          agent: {
            models: {
              allowed,
            },
          },
        }),
      }),
      agent: {
        clearCache: vi.fn(),
        create: vi.fn(),
      },
      prompt: { preview: vi.fn() },
    };
  }

  it('rejects updates whose model is outside the allowlist with HTTP 422', async () => {
    const data = new Map<string, MockStoredAgent>();
    data.set('a1', {
      id: 'a1',
      name: 'A1',
      model: { provider: 'openai', name: 'gpt-5.5' },
    });
    const agentsStore = createMockAgentsStore(data);
    const storage = createMockStorage(agentsStore);
    const editor = makeBuilderEditor({
      allowed: [{ provider: 'openai', modelId: 'gpt-5.5' }],
    });
    const mastra = {
      getStorage: vi.fn().mockReturnValue(storage),
      getEditor: vi.fn().mockReturnValue(editor),
    };

    let caught: HTTPException | undefined;
    try {
      await UPDATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mastra as unknown as MockMastra),
        storedAgentId: 'a1',
        model: { provider: 'anthropic', name: 'claude-opus-4-7' },
      });
    } catch (e) {
      caught = e as HTTPException;
    }

    expect(caught).toBeInstanceOf(HTTPException);
    expect(caught?.status).toBe(422);

    const body = await caught!.getResponse().json();
    expect(body.error.code).toBe('MODEL_NOT_ALLOWED');
    expect(body.error.attempted).toMatchObject({ provider: 'anthropic', modelId: 'claude-opus-4-7' });
  });

  it('passes update when model matches the allowlist', async () => {
    const data = new Map<string, MockStoredAgent>();
    data.set('a1', {
      id: 'a1',
      name: 'A1',
      model: { provider: 'openai', name: 'gpt-5.5' },
    });
    const agentsStore = createMockAgentsStore(data);
    const storage = createMockStorage(agentsStore);
    const editor = makeBuilderEditor({
      allowed: [{ provider: 'openai' }],
    });
    const mastra = {
      getStorage: vi.fn().mockReturnValue(storage),
      getEditor: vi.fn().mockReturnValue(editor),
    };

    const result = await UPDATE_STORED_AGENT_ROUTE.handler({
      ...createTestContext(mastra as unknown as MockMastra),
      storedAgentId: 'a1',
      model: { provider: 'openai', name: 'gpt-4o-mini' },
    });
    expect(result).toMatchObject({ id: 'a1' });
  });

  it('skips enforcement when no builder is configured', async () => {
    const data = new Map<string, MockStoredAgent>();
    data.set('a1', {
      id: 'a1',
      name: 'A1',
      model: { provider: 'openai', name: 'gpt-5.5' },
    });
    const agentsStore = createMockAgentsStore(data);
    const storage = createMockStorage(agentsStore);
    const mastra = {
      getStorage: vi.fn().mockReturnValue(storage),
      getEditor: vi.fn().mockReturnValue(undefined),
    };

    const result = await UPDATE_STORED_AGENT_ROUTE.handler({
      ...createTestContext(mastra as unknown as MockMastra),
      storedAgentId: 'a1',
      model: { provider: 'anthropic', name: 'claude-opus-4-7' },
    });
    expect(result).toMatchObject({ id: 'a1' });
  });
});
