import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { MASTRA_RESOURCE_ID_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { HTTPException } from '../http-exception';
import { createStoredAgentBodySchema, updateStoredAgentBodySchema } from '../schemas/stored-agents';
import type { ServerContext } from '../server-adapter';
import { ACTIVATE_AGENT_VERSION_ROUTE, GET_AGENT_VERSION_ROUTE } from './agent-versions';
import {
  LIST_STORED_AGENTS_ROUTE,
  GET_STORED_AGENT_ROUTE,
  GET_STORED_AGENT_DEPENDENTS_ROUTE,
  CREATE_STORED_AGENT_ROUTE,
  UPDATE_STORED_AGENT_ROUTE,
  DELETE_STORED_AGENT_ROUTE,
  PREVIEW_INSTRUCTIONS_ROUTE,
  EXPORT_STORED_AGENT_ROUTE,
  OPEN_STORED_AGENT_CHANGE_REQUEST_ROUTE,
} from './stored-agents';

// Mock handleAutoVersioning to prevent version creation in tests
import { handleAutoVersioning } from './version-helpers';
import type * as VersionHelpers from './version-helpers';

vi.mock('./version-helpers', async importOriginal => {
  const actual = await importOriginal<typeof VersionHelpers>();
  return {
    ...actual,
    handleAutoVersioning: vi
      .fn()
      .mockImplementation(async (_store: any, _id: any, _existing: any, updatedAgent: any) => {
        return { agent: updatedAgent, versionCreated: false };
      }),
  };
});

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
  agents?: unknown;
  integrationTools?: unknown[];
  inputProcessors?: string[];
  outputProcessors?: string[];
  memory?: unknown;
  scorers?: unknown[];
  authorId?: string;
  visibility?: 'public' | 'private';
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
  useProviderRef: ReturnType<typeof vi.fn>;
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
        perPage?: number | false;
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

        const paginatedAgents =
          perPage === false ? agents : agents.slice((page - 1) * perPage, (page - 1) * perPage + perPage);

        return {
          agents: paginatedAgents,
          total: agents.length,
          page,
          perPage,
          hasMore: perPage === false ? false : (page - 1) * perPage + perPage < agents.length,
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
    useProviderRef: vi.fn(),
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
  getSource?: ReturnType<typeof vi.fn>;
  getSourceControlProvider?: ReturnType<typeof vi.fn>;
}

function createMockEditor(agentsStore?: MockAgentsStore, sourceControlProvider?: unknown): MockEditor {
  return {
    getSourceControlProvider: sourceControlProvider ? vi.fn().mockReturnValue(sourceControlProvider) : undefined,
    agent: {
      clearCache: vi.fn(),
      // Delegate to storage so existing assertions work
      create: vi.fn().mockImplementation(async (input: unknown) => {
        if (agentsStore) {
          await (agentsStore.create as any)({ agent: input });
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
  getServer: ReturnType<typeof vi.fn>;
  getAgentById: ReturnType<typeof vi.fn>;
}

function createMockMastra(
  options: {
    storage?: MockStorage;
    editor?: MockEditor;
    server?: Record<string, unknown>;
    agents?: Record<string, unknown>;
  } = {},
): MockMastra {
  return {
    getStorage: vi.fn().mockReturnValue(options.storage),
    getEditor: vi.fn().mockReturnValue(options.editor),
    getServer: vi.fn().mockReturnValue(options.server ?? {}),
    getAgentById: vi.fn().mockImplementation((agentId: string) => {
      const agent = options.agents?.[agentId];
      if (!agent) {
        throw new Error(`Agent ${agentId} not found`);
      }
      return agent;
    }),
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

async function useRealAutoVersioningOnce() {
  const actual = await vi.importActual<typeof VersionHelpers>('./version-helpers');
  vi.mocked(handleAutoVersioning).mockImplementationOnce(actual.handleAutoVersioning);
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

    it('should scope stored agent lists by request resource metadata when configured', async () => {
      mockMastra = createMockMastra({
        storage: mockStorage,
        editor: mockEditor,
        server: { storedResources: { scope: true } },
      });
      mockAgentsData.set('agent1', {
        id: 'agent1',
        name: 'Team Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        metadata: { 'mastra.resourceId': 'team-a' },
      });
      mockAgentsData.set('agent2', {
        id: 'agent2',
        name: 'Other Team Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        metadata: { 'mastra.resourceId': 'team-b' },
      });
      const context = createTestContext(mockMastra);
      context.requestContext.set('mastra__resourceId', 'team-a');

      const result = await LIST_STORED_AGENTS_ROUTE.handler({
        ...context,
        page: 1,
      });

      expect(result.agents.map(agent => agent.id)).toEqual(['agent1']);
      expect(mockAgentsStore.listResolved).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { 'mastra.resourceId': 'team-a' } }),
      );
    });

    it('should not scope stored agent lists when auth is configured without stored resource scope', async () => {
      mockMastra = createMockMastra({
        storage: mockStorage,
        editor: mockEditor,
        server: { auth: {} },
      });
      mockAgentsData.set('agent1', {
        id: 'agent1',
        name: 'Team Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        metadata: { 'mastra.resourceId': 'team-a' },
      });
      mockAgentsData.set('agent2', {
        id: 'agent2',
        name: 'Other Team Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        metadata: { 'mastra.resourceId': 'team-b' },
      });
      const context = createTestContext(mockMastra);
      context.requestContext.set('mastra__resourceId', 'team-a');

      const result = await LIST_STORED_AGENTS_ROUTE.handler({
        ...context,
        page: 1,
      });

      expect(result.agents.map(agent => agent.id)).toEqual(['agent1', 'agent2']);
      expect(mockAgentsStore.listResolved).toHaveBeenCalledWith(expect.objectContaining({ metadata: undefined }));
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

  describe('EXPORT_STORED_AGENT_ROUTE', () => {
    it('should export deterministic JSON for a code agent override', async () => {
      mockMastra = createMockMastra({
        storage: mockStorage,
        editor: mockEditor,
        agents: {
          'code-agent': {
            source: 'code',
            __getEditorConfig: () => ({ instructions: true, tools: { description: true } }),
          },
        },
      });

      const result = await EXPORT_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'code-agent',
        instructions: 'Stored instructions',
        tools: { weatherTool: { description: 'Check weather' } },
        integrationTools: { composio: { type: 'composio' } },
        mcpClients: { local: { type: 'mcp' } },
        model: { provider: 'openai', name: 'gpt-4o' },
        name: 'Code Agent',
      });

      expect(result).toEqual({
        agentId: 'code-agent',
        fileName: 'agents/code-agent.json',
        config: {
          integrationTools: { composio: { type: 'composio' } },
          instructions: 'Stored instructions',
          mcpClients: { local: { type: 'mcp' } },
          tools: { weatherTool: { description: 'Check weather' } },
        },
        content:
          '{\n  "instructions": "Stored instructions",\n  "integrationTools": {\n    "composio": {\n      "type": "composio"\n    }\n  },\n  "mcpClients": {\n    "local": {\n      "type": "mcp"\n    }\n  },\n  "tools": {\n    "weatherTool": {\n      "description": "Check weather"\n    }\n  }\n}\n',
      });
    });

    it('should omit fields not owned by the editor config', async () => {
      mockMastra = createMockMastra({
        storage: mockStorage,
        editor: mockEditor,
        agents: {
          'locked-agent': {
            source: 'code',
            __getEditorConfig: () => ({ instructions: false, tools: false }),
          },
        },
      });

      const result = await EXPORT_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'locked-agent',
        instructions: 'Ignored instructions',
        tools: { weatherTool: { description: 'Ignored tool' } },
        integrationTools: { composio: { type: 'composio' } },
        mcpClients: { local: { type: 'mcp' } },
        requestContextSchema: { type: 'object' },
      });

      expect(result).toMatchObject({
        agentId: 'locked-agent',
        fileName: 'agents/locked-agent.json',
        config: {
          requestContextSchema: { type: 'object' },
        },
        content: '{\n  "requestContextSchema": {\n    "type": "object"\n  }\n}\n',
      });
    });

    it('should export supported storage-only agent config fields', async () => {
      mockAgentsData.set('storage-only-agent', {
        id: 'storage-only-agent',
        name: 'Storage Only Agent',
      });

      const result = await EXPORT_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'storage-only-agent',
        name: 'Storage Only Agent',
        instructions: 'Stored instructions',
        model: { provider: 'openai', name: 'gpt-4o' },
        scorers: { quality: { description: 'Quality scorer' } },
        skills: { coding: { description: 'Coding skill' } },
        tools: { weatherTool: { description: 'Check weather' } },
      });

      expect(result).toEqual({
        agentId: 'storage-only-agent',
        fileName: 'agents/storage-only-agent.json',
        config: {
          instructions: 'Stored instructions',
          model: { name: 'gpt-4o', provider: 'openai' },
          name: 'Storage Only Agent',
          scorers: { quality: { description: 'Quality scorer' } },
          skills: { coding: { description: 'Coding skill' } },
          tools: { weatherTool: { description: 'Check weather' } },
        },
        content:
          '{\n  "instructions": "Stored instructions",\n  "model": {\n    "name": "gpt-4o",\n    "provider": "openai"\n  },\n  "name": "Storage Only Agent",\n  "scorers": {\n    "quality": {\n      "description": "Quality scorer"\n    }\n  },\n  "skills": {\n    "coding": {\n      "description": "Coding skill"\n    }\n  },\n  "tools": {\n    "weatherTool": {\n      "description": "Check weather"\n    }\n  }\n}\n',
      });
    });
  });

  describe('OPEN_STORED_AGENT_CHANGE_REQUEST_ROUTE', () => {
    it('should open a source-provider change request for exported agent JSON', async () => {
      const openChangeRequest = vi.fn().mockResolvedValue({
        id: '123',
        url: 'https://github.com/acme/repo/pull/123',
        ref: 'mastra/source-storage/test',
      });
      mockAgentsData.set('test-agent-1', {
        id: 'test-agent-1',
        name: 'Test Agent',
        model: { provider: 'openai', name: 'gpt-4o' },
      });
      const editor = createMockEditor(mockAgentsStore, { openChangeRequest });
      mockMastra = createMockMastra({ storage: mockStorage, editor });

      const result = await OPEN_STORED_AGENT_CHANGE_REQUEST_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'test-agent-1',
        instructions: 'Updated instructions',
        model: { provider: 'openai', name: 'gpt-4o' },
        name: 'Test Agent',
        changeMessage: 'Tune weather instructions',
        userName: 'Ada Lovelace',
      });

      expect(openChangeRequest).toHaveBeenCalledWith({
        title: 'Update test-agent-1 agent override',
        body: 'Updates agents/test-agent-1.json from Mastra Studio.',
        headRef: 'mastra/test-agent-1',
        files: [
          {
            path: 'agents/test-agent-1.json',
            content:
              '{\n  "instructions": "Updated instructions",\n  "model": {\n    "name": "gpt-4o",\n    "provider": "openai"\n  },\n  "name": "Test Agent"\n}\n',
            message: 'Tune weather instructions by Ada Lovelace',
          },
        ],
      });
      expect(mockAgentsStore.useProviderRef).toHaveBeenCalledWith('test-agent-1', 'mastra/source-storage/test');
      expect(editor.agent.clearCache).toHaveBeenCalledWith('test-agent-1');
      expect(result).toEqual({
        id: '123',
        url: 'https://github.com/acme/repo/pull/123',
        ref: 'mastra/source-storage/test',
      });
    });

    it('should inspect an existing source-provider change request without exporting agent JSON', async () => {
      const openChangeRequest = vi.fn().mockResolvedValue({
        id: '123',
        url: 'https://github.com/acme/repo/pull/123',
        ref: 'mastra/source-storage/test',
      });
      const editor = createMockEditor(mockAgentsStore, { openChangeRequest });
      mockMastra = createMockMastra({ storage: mockStorage, editor });

      const result = await OPEN_STORED_AGENT_CHANGE_REQUEST_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'test-agent-1',
        inspectOnly: true,
      });

      expect(openChangeRequest).toHaveBeenCalledWith({
        title: 'Update test-agent-1 agent override',
        headRef: 'mastra/test-agent-1',
        files: [],
      });
      expect(mockAgentsStore.useProviderRef).toHaveBeenCalledWith('test-agent-1', 'mastra/source-storage/test');
      expect(editor.agent.clearCache).toHaveBeenCalledWith('test-agent-1');
      expect(result).toEqual({
        id: '123',
        url: 'https://github.com/acme/repo/pull/123',
        ref: 'mastra/source-storage/test',
      });
    });

    it('should reject change requests when provider is unavailable', async () => {
      try {
        await OPEN_STORED_AGENT_CHANGE_REQUEST_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedAgentId: 'test-agent-1',
          instructions: 'Updated instructions',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(400);
        expect((error as HTTPException).message).toBe('Source control provider cannot open change requests');
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

    it('should reject empty instructions when creating an override for a code agent that owns instructions', async () => {
      const mastra = createMockMastra({
        storage: mockStorage,
        editor: mockEditor,
        agents: {
          'code-agent': {
            source: 'code',
            __getEditorConfig: () => ({ instructions: true, tools: true }),
          },
        },
      });

      try {
        await CREATE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(mastra),
          id: 'code-agent',
          name: 'Code Agent',
          instructions: [],
          model: { name: 'gpt-4', provider: 'openai' },
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(400);
        expect((error as HTTPException).message).toBe('Instructions are required');
      }
    });

    it('should strip empty instructions when creating an override for a code agent that does not own instructions', async () => {
      const mastra = createMockMastra({
        storage: mockStorage,
        editor: mockEditor,
        agents: {
          'description-only-agent': {
            source: 'code',
            __getEditorConfig: () => ({ tools: { description: true } }),
          },
        },
      });

      await CREATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mastra),
        id: 'description-only-agent',
        name: 'Description Only Agent',
        instructions: [],
        model: { name: 'gpt-4', provider: 'openai' },
      });

      expect(mockAgentsStore.create).toHaveBeenCalledWith({
        agent: expect.objectContaining({
          id: 'description-only-agent',
          instructions: undefined,
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

    it('should reject empty instructions when updating a code agent that owns instructions', async () => {
      mockAgentsData.set('code-agent', {
        id: 'code-agent',
        name: 'Code Agent',
        instructions: 'Existing instructions',
        model: { name: 'gpt-4', provider: 'openai' },
        activeVersionId: 'v-code-agent-1',
      });
      const mastra = createMockMastra({
        storage: mockStorage,
        editor: mockEditor,
        agents: {
          'code-agent': {
            source: 'code',
            __getEditorConfig: () => ({ instructions: true, tools: true }),
          },
        },
      });

      try {
        await UPDATE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(mastra),
          storedAgentId: 'code-agent',
          instructions: [{ type: 'prompt_block', content: '   ' }],
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(400);
        expect((error as HTTPException).message).toBe('Instructions are required');
      }
    });

    it('should allow non-instruction updates for a code agent that owns instructions', async () => {
      mockAgentsData.set('code-agent', {
        id: 'code-agent',
        name: 'Code Agent',
        instructions: 'Existing instructions',
        model: { name: 'gpt-4', provider: 'openai' },
        activeVersionId: 'v-code-agent-1',
      });
      const mastra = createMockMastra({
        storage: mockStorage,
        editor: mockEditor,
        agents: {
          'code-agent': {
            source: 'code',
            __getEditorConfig: () => ({ instructions: true, tools: true }),
          },
        },
      });

      await UPDATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mastra),
        storedAgentId: 'code-agent',
        name: 'Renamed Code Agent',
      });

      expect(mockAgentsStore.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'code-agent',
          name: 'Renamed Code Agent',
          instructions: undefined,
        }),
      );
    });

    it('should allow empty instructions when updating a code agent that does not own instructions', async () => {
      mockAgentsData.set('description-only-agent', {
        id: 'description-only-agent',
        name: 'Description Only Agent',
        instructions: 'Existing instructions',
        model: { name: 'gpt-4', provider: 'openai' },
        activeVersionId: 'v-description-only-agent-1',
      });
      const mastra = createMockMastra({
        storage: mockStorage,
        editor: mockEditor,
        agents: {
          'description-only-agent': {
            source: 'code',
            __getEditorConfig: () => ({ tools: { description: true } }),
          },
        },
      });

      await UPDATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mastra),
        storedAgentId: 'description-only-agent',
        instructions: [],
      });

      expect(mockAgentsStore.update).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'description-only-agent',
          instructions: undefined,
        }),
      );
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

    describe('version publication lifecycle', () => {
      const setupPublishedAgent = async (agentId: string, source?: 'code') => {
        const storage = new InMemoryStore();
        const editor = createMockEditor();
        if (source) {
          editor.getSource = vi.fn().mockReturnValue(source);
        }
        const lifecycleMastra = createMockMastra({
          storage: storage as unknown as MockStorage,
          editor,
        });
        const agentsStore = await storage.getStore('agents');
        await agentsStore.create({
          agent: {
            id: agentId,
            name: 'Lifecycle Agent',
            instructions: 'Published instructions',
            model: { name: 'gpt-4', provider: 'openai' },
          },
        });
        const publishedVersion = await agentsStore.getLatestVersion(agentId);
        if (!publishedVersion) {
          throw new Error('Expected initial agent version');
        }
        await agentsStore.update({
          id: agentId,
          activeVersionId: publishedVersion.id,
          status: 'published',
        });

        return { agentsStore, lifecycleMastra, publishedVersion };
      };

      it('keeps a PATCH-created version as a draft until it is activated', async () => {
        const agentId = 'draft-lifecycle-test';
        const { agentsStore, lifecycleMastra, publishedVersion } = await setupPublishedAgent(agentId);
        await useRealAutoVersioningOnce();

        const updated = await UPDATE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(lifecycleMastra),
          storedAgentId: agentId,
          instructions: 'Draft instructions',
        });
        const draftVersion = await agentsStore.getLatestVersion(agentId);
        if (!draftVersion) {
          throw new Error('Expected draft agent version');
        }

        expect(updated.instructions).toBe('Draft instructions');
        expect(draftVersion.id).not.toBe(publishedVersion.id);
        expect((await agentsStore.getById(agentId))?.activeVersionId).toBe(publishedVersion.id);

        const published = await GET_STORED_AGENT_ROUTE.handler({
          ...createTestContext(lifecycleMastra),
          storedAgentId: agentId,
        });
        const draft = await GET_STORED_AGENT_ROUTE.handler({
          ...createTestContext(lifecycleMastra),
          storedAgentId: agentId,
          status: 'draft',
        });
        const specificDraft = await GET_AGENT_VERSION_ROUTE.handler({
          ...createTestContext(lifecycleMastra),
          agentId,
          versionId: draftVersion.id,
        });

        expect(published.instructions).toBe('Published instructions');
        expect(draft.instructions).toBe('Draft instructions');
        expect(specificDraft.instructions).toBe('Draft instructions');

        await ACTIVATE_AGENT_VERSION_ROUTE.handler({
          ...createTestContext(lifecycleMastra),
          agentId,
          versionId: draftVersion.id,
        });
        const publishedAfterActivation = await GET_STORED_AGENT_ROUTE.handler({
          ...createTestContext(lifecycleMastra),
          storedAgentId: agentId,
        });

        expect(publishedAfterActivation.instructions).toBe('Draft instructions');
      });

      it('auto-publishes a PATCH-created version when requested', async () => {
        const agentId = 'auto-publish-lifecycle-test';
        const { agentsStore, lifecycleMastra, publishedVersion } = await setupPublishedAgent(agentId);
        await useRealAutoVersioningOnce();
        const updateInput = {
          ...createTestContext(lifecycleMastra),
          storedAgentId: agentId,
          instructions: 'Auto-published instructions',
          autoPublish: true,
        };

        await UPDATE_STORED_AGENT_ROUTE.handler(updateInput);
        const latestVersion = await agentsStore.getLatestVersion(agentId);
        if (!latestVersion) {
          throw new Error('Expected updated agent version');
        }
        const published = await GET_STORED_AGENT_ROUTE.handler({
          ...createTestContext(lifecycleMastra),
          storedAgentId: agentId,
        });

        expect(latestVersion.id).not.toBe(publishedVersion.id);
        expect((await agentsStore.getById(agentId))?.activeVersionId).toBe(latestVersion.id);
        expect(published.instructions).toBe('Auto-published instructions');
      });

      it('preserves the active code-source version while replacing an unpublished rolling draft', async () => {
        const agentId = 'code-source-draft-test';
        const { agentsStore, lifecycleMastra, publishedVersion } = await setupPublishedAgent(agentId, 'code');
        await useRealAutoVersioningOnce();

        await UPDATE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(lifecycleMastra),
          storedAgentId: agentId,
          instructions: 'First rolling draft',
        });
        const firstDraft = await agentsStore.getLatestVersion(agentId);
        if (!firstDraft) {
          throw new Error('Expected first rolling draft');
        }

        expect(await agentsStore.getVersion(publishedVersion.id)).not.toBeNull();
        expect((await agentsStore.getById(agentId))?.activeVersionId).toBe(publishedVersion.id);

        await useRealAutoVersioningOnce();
        await UPDATE_STORED_AGENT_ROUTE.handler({
          ...createTestContext(lifecycleMastra),
          storedAgentId: agentId,
          instructions: 'Second rolling draft',
        });
        const secondDraft = await agentsStore.getLatestVersion(agentId);
        if (!secondDraft) {
          throw new Error('Expected second rolling draft');
        }

        expect(secondDraft.id).not.toBe(firstDraft.id);
        expect(await agentsStore.getVersion(firstDraft.id)).toBeNull();
        expect(await agentsStore.getVersion(publishedVersion.id)).not.toBeNull();
        expect((await agentsStore.getById(agentId))?.activeVersionId).toBe(publishedVersion.id);
      });
    });

    it('threads toolProviders into the auto-versioning snapshot config', async () => {
      mockAgentsData.set('tp-snapshot-test', {
        id: 'tp-snapshot-test',
        name: 'TP Agent',
        instructions: 'Be helpful',
        model: { name: 'gpt-4', provider: 'openai' },
        activeVersionId: 'v-tp-1',
      });

      const { handleAutoVersioning } = await import('./version-helpers');
      vi.mocked(handleAutoVersioning).mockClear();

      const toolProviders = {
        composio: {
          tools: { GMAIL_FETCH_EMAILS: { toolkit: 'gmail' } },
          connections: {},
        },
      };

      await UPDATE_STORED_AGENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'tp-snapshot-test',
        toolProviders,
      });

      // 7th positional arg (index 6) is `providedConfigFields` — the snapshot
      // config passed to the version writer. Without `toolProviders` here, the
      // new version row drops the field on disk and reload shows nothing.
      const call = vi.mocked(handleAutoVersioning).mock.calls.at(-1);
      expect(call).toBeDefined();
      const providedConfigFields = call?.[6] as Record<string, unknown> | undefined;
      expect(providedConfigFields).toBeDefined();
      expect(providedConfigFields?.toolProviders).toEqual(toolProviders);
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

  describe('GET_STORED_AGENT_DEPENDENTS_ROUTE', () => {
    it('returns visible dependents that reference the target as a sub-agent (static map)', async () => {
      mockAgentsData.set('target', {
        id: 'target',
        name: 'Target',
        model: { name: 'gpt-4', provider: 'openai' },
      });
      mockAgentsData.set('parent', {
        id: 'parent',
        name: 'Parent Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        visibility: 'public',
        agents: { target: { id: 'target' } },
      });
      mockAgentsData.set('unrelated', {
        id: 'unrelated',
        name: 'Unrelated',
        model: { name: 'gpt-4', provider: 'openai' },
      });

      const result = await GET_STORED_AGENT_DEPENDENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'target',
      });

      expect(result.dependents).toEqual([{ id: 'parent', name: 'Parent Agent' }]);
      expect(result.hiddenCount).toBe(0);
    });

    it('detects conditional-variant agents fields', async () => {
      mockAgentsData.set('target', {
        id: 'target',
        name: 'Target',
        model: { name: 'gpt-4', provider: 'openai' },
      });
      mockAgentsData.set('parent', {
        id: 'parent',
        name: 'Conditional Parent',
        model: { name: 'gpt-4', provider: 'openai' },
        visibility: 'public',
        agents: [{ value: { target: { id: 'target' } }, rules: [] }],
      });

      const result = await GET_STORED_AGENT_DEPENDENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'target',
      });

      expect(result.dependents).toEqual([{ id: 'parent', name: 'Conditional Parent' }]);
    });

    it('returns an empty list when no dependents', async () => {
      mockAgentsData.set('target', {
        id: 'target',
        name: 'Target',
        model: { name: 'gpt-4', provider: 'openai' },
      });
      mockAgentsData.set('other', {
        id: 'other',
        name: 'Other',
        model: { name: 'gpt-4', provider: 'openai' },
      });

      const result = await GET_STORED_AGENT_DEPENDENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'target',
      });

      expect(result.dependents).toEqual([]);
      expect(result.hiddenCount).toBe(0);
    });

    it('excludes the target agent itself from the dependents list', async () => {
      mockAgentsData.set('target', {
        id: 'target',
        name: 'Target',
        model: { name: 'gpt-4', provider: 'openai' },
        agents: { target: { id: 'target' } },
      });

      const result = await GET_STORED_AGENT_DEPENDENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'target',
      });

      expect(result.dependents).toEqual([]);
    });

    it('does not treat prototype keys like "constructor" as references', async () => {
      mockAgentsData.set('constructor', {
        id: 'constructor',
        name: 'Target',
        model: { name: 'gpt-4', provider: 'openai' },
      });
      mockAgentsData.set('parent', {
        id: 'parent',
        name: 'Parent with a real sub-agent',
        model: { name: 'gpt-4', provider: 'openai' },
        agents: { 'some-child': { id: 'some-child', name: 'Child', model: { name: 'gpt-4', provider: 'openai' } } },
      });

      const result = await GET_STORED_AGENT_DEPENDENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedAgentId: 'constructor',
      });

      expect(result.dependents).toEqual([]);
    });

    it('throws 404 when the target does not exist', async () => {
      try {
        await GET_STORED_AGENT_DEPENDENTS_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedAgentId: 'missing',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
      }
    });

    it('counts cross-workspace private dependents in hiddenCount when the target is public', async () => {
      mockAgentsData.set('target', {
        id: 'target',
        name: 'Public Target',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'owner',
        visibility: 'public',
      });
      mockAgentsData.set('hidden-parent', {
        id: 'hidden-parent',
        name: 'Hidden Parent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'someone-else',
        visibility: 'private',
        agents: { target: { id: 'target' } },
      });
      mockAgentsData.set('my-public-parent', {
        id: 'my-public-parent',
        name: 'My Public Parent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'caller',
        visibility: 'public',
        agents: { target: { id: 'target' } },
      });
      mockAgentsData.set('my-private-parent', {
        id: 'my-private-parent',
        name: 'My Private Parent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'caller',
        visibility: 'private',
        agents: { target: { id: 'target' } },
      });

      const result = await GET_STORED_AGENT_DEPENDENTS_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'caller'),
        storedAgentId: 'target',
      });

      expect(result.dependents).toEqual([
        { id: 'my-public-parent', name: 'My Public Parent' },
        { id: 'my-private-parent', name: 'My Private Parent' },
      ]);
      expect(result.hiddenCount).toBe(1);
    });

    it('does not surface hiddenCount for a private target', async () => {
      mockAgentsData.set('target', {
        id: 'target',
        name: 'Private Target',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'caller',
        visibility: 'private',
      });
      mockAgentsData.set('hidden-parent', {
        id: 'hidden-parent',
        name: 'Hidden Parent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'someone-else',
        visibility: 'private',
        agents: { target: { id: 'target' } },
      });

      const result = await GET_STORED_AGENT_DEPENDENTS_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'caller'),
        storedAgentId: 'target',
      });

      expect(result.dependents).toEqual([]);
      expect(result.hiddenCount).toBe(0);
    });

    it('throws 404 when the caller cannot read a private target', async () => {
      mockAgentsData.set('target', {
        id: 'target',
        name: 'Private Target',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'someone-else',
        visibility: 'private',
      });

      try {
        await GET_STORED_AGENT_DEPENDENTS_ROUTE.handler({
          ...createAuthenticatedContext(mockMastra, 'caller'),
          storedAgentId: 'target',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
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

    it('should allow stored-agents:* admin to update any agent (resource-scoped wildcard)', async () => {
      // Regression: the handler's authorship layer must use the same resource
      // string (`stored-agents`) as the RBAC permissions, otherwise an admin
      // granted `stored-agents:*` passes route auth but is treated as a
      // non-admin by the handler and can't edit private records of others.
      mockAgentsData.set('other-agent', {
        id: 'other-agent',
        name: 'Other Agent',
        model: { name: 'gpt-4', provider: 'openai' },
        authorId: 'user-a',
        visibility: 'private',
        activeVersionId: 'v-other-1',
      });

      const result = await UPDATE_STORED_AGENT_ROUTE.handler({
        ...createAuthenticatedContext(mockMastra, 'admin', ['stored-agents:*']),
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

describe('UPDATE_STORED_AGENT_ROUTE — model policy is surface-scoped, not enforced on save', () => {
  // Per MODEL-POLICY-SURFACE-SCOPING-PLAN: save-path enforcement was removed
  // because the policy is now surface-scoped (builder vs editor). The single
  // server-side check would either over-enforce on the editor surface or
  // under-enforce on the builder surface until per-surface enforcement lands.
  //
  // UI gating via ModelPolicyProvider is now the only enforcement layer.
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

  it('accepts updates whose model is outside the allowlist (UI gating enforces this)', async () => {
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

    const result = await UPDATE_STORED_AGENT_ROUTE.handler({
      ...createTestContext(mastra as unknown as MockMastra),
      storedAgentId: 'a1',
      model: { provider: 'anthropic', name: 'claude-opus-4-6' },
    });
    expect(result).toMatchObject({ id: 'a1' });
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

  it('still works when no builder is configured', async () => {
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
      model: { provider: 'anthropic', name: 'claude-opus-4-6' },
    });
    expect(result).toMatchObject({ id: 'a1' });
  });

  // Note: a CREATE-side counterpart test was removed alongside save-path
  // enforcement. CREATE behavior is covered by the broader create tests above;
  // the UPDATE assertion in this describe block is enough to lock in the
  // surface-scoped policy direction.
});

// =============================================================================
// Author Enrichment
// =============================================================================
describe('Stored Agents author enrichment', () => {
  type FakeAuthor = { id: string; name?: string; email?: string; avatarUrl?: string };

  function makeAuthProvider(users: Record<string, FakeAuthor | Error>, opts: { batch?: boolean } = {}) {
    const getUser = vi.fn(async (id: string): Promise<FakeAuthor | null> => {
      const v = users[id];
      if (v instanceof Error) throw v;
      return v ?? null;
    });
    const provider: any = {
      authenticateToken: vi.fn(),
      getCurrentUser: vi.fn(),
      getUser,
    };
    if (opts.batch) {
      provider.getUsers = vi.fn(async (ids: string[]): Promise<Array<FakeAuthor | null>> => {
        const out: Array<FakeAuthor | null> = [];
        for (const id of ids) {
          const v = users[id];
          if (v instanceof Error) throw v;
          out.push(v ?? null);
        }
        return out;
      });
    }
    return provider;
  }

  function setup(users: Record<string, FakeAuthor | Error>, opts: { batch?: boolean; auth?: unknown } = {}) {
    const data = new Map<string, MockStoredAgent>();
    const store = createMockAgentsStore(data);
    const storage = createMockStorage(store);
    const editor = createMockEditor(store);
    const auth = opts.auth !== undefined ? opts.auth : makeAuthProvider(users, { batch: opts.batch });
    const mastra = createMockMastra({ storage, editor, server: auth === null ? {} : { auth } });
    return { data, store, mastra, auth };
  }

  it('returns rows with resolved `author` for the list endpoint', async () => {
    const { data, mastra } = setup({
      'author-1': { id: 'author-1', name: 'Alice', email: 'alice@example.com' },
      'author-2': { id: 'author-2', name: 'Bob' },
    });
    data.set('agent1', {
      id: 'agent1',
      name: 'Agent 1',
      model: { name: 'gpt-4', provider: 'openai' },
      authorId: 'author-1',
    });
    data.set('agent2', {
      id: 'agent2',
      name: 'Agent 2',
      model: { name: 'gpt-4', provider: 'openai' },
      authorId: 'author-2',
    });

    const result = await LIST_STORED_AGENTS_ROUTE.handler({
      ...createTestContext(mastra),
      page: 1,
    });

    const byId = new Map(result.agents.map(a => [a.id, a]));
    expect(byId.get('agent1')).toMatchObject({
      authorId: 'author-1',
      author: { id: 'author-1', name: 'Alice', email: 'alice@example.com' },
    });
    expect(byId.get('agent2')).toMatchObject({
      authorId: 'author-2',
      author: { id: 'author-2', name: 'Bob' },
    });
  });

  it('deduplicates author ids before calling the provider', async () => {
    const { data, mastra, auth } = setup(
      {
        'author-1': { id: 'author-1', name: 'Alice' },
      },
      { batch: true },
    );
    data.set('agent1', {
      id: 'agent1',
      name: 'Agent 1',
      model: { name: 'gpt-4', provider: 'openai' },
      authorId: 'author-1',
    });
    data.set('agent2', {
      id: 'agent2',
      name: 'Agent 2',
      model: { name: 'gpt-4', provider: 'openai' },
      authorId: 'author-1',
    });

    await LIST_STORED_AGENTS_ROUTE.handler({
      ...createTestContext(mastra),
      page: 1,
    });

    expect((auth as any).getUsers).toHaveBeenCalledTimes(1);
    expect((auth as any).getUsers.mock.calls[0][0]).toEqual(['author-1']);
  });

  it('omits `author` when no auth provider is configured', async () => {
    const { data, mastra } = setup({}, { auth: null });
    data.set('agent1', {
      id: 'agent1',
      name: 'Agent 1',
      model: { name: 'gpt-4', provider: 'openai' },
      authorId: 'author-1',
    });

    const result = await LIST_STORED_AGENTS_ROUTE.handler({
      ...createTestContext(mastra),
      page: 1,
    });

    expect(result.agents[0]).toMatchObject({ id: 'agent1', authorId: 'author-1' });
    expect((result.agents[0] as any).author).toBeUndefined();
  });

  it('omits `author` for ids the provider cannot resolve, without failing the list', async () => {
    const { data, mastra } = setup({
      'author-1': { id: 'author-1', name: 'Alice' },
      bad: new Error('boom'),
    });
    data.set('agent1', {
      id: 'agent1',
      name: 'Agent 1',
      model: { name: 'gpt-4', provider: 'openai' },
      authorId: 'author-1',
    });
    data.set('agent2', {
      id: 'agent2',
      name: 'Agent 2',
      model: { name: 'gpt-4', provider: 'openai' },
      authorId: 'bad',
    });

    const result = await LIST_STORED_AGENTS_ROUTE.handler({
      ...createTestContext(mastra),
      page: 1,
    });

    const byId = new Map(result.agents.map(a => [a.id, a]));
    expect((byId.get('agent1') as any).author).toMatchObject({ id: 'author-1', name: 'Alice' });
    expect((byId.get('agent2') as any).author).toBeUndefined();
  });

  it('returns `author` from the GET single agent endpoint', async () => {
    const { data, mastra } = setup({
      'author-1': { id: 'author-1', name: 'Alice', avatarUrl: 'https://x/y.png' },
    });
    data.set('agent1', {
      id: 'agent1',
      name: 'Agent 1',
      model: { name: 'gpt-4', provider: 'openai' },
      authorId: 'author-1',
    });

    const result = await GET_STORED_AGENT_ROUTE.handler({
      ...createTestContext(mastra),
      storedAgentId: 'agent1',
      status: 'published',
    });

    expect((result as any).author).toEqual({
      id: 'author-1',
      name: 'Alice',
      avatarUrl: 'https://x/y.png',
    });
  });

  it('omits `author` from GET single agent when the id cannot be resolved', async () => {
    const { data, mastra } = setup({
      // 'author-1' is intentionally not in the user map
    });
    data.set('agent1', {
      id: 'agent1',
      name: 'Agent 1',
      model: { name: 'gpt-4', provider: 'openai' },
      authorId: 'author-1',
    });

    const result = await GET_STORED_AGENT_ROUTE.handler({
      ...createTestContext(mastra),
      storedAgentId: 'agent1',
      status: 'published',
    });

    expect((result as any).author).toBeUndefined();
  });
});
