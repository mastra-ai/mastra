import type { Mastra } from '@mastra/core';
import { RequestContext } from '@mastra/core/request-context';
import { describe, it, expect, beforeEach, vi } from 'vitest';

import { HTTPException } from '../http-exception';
import {
  createStoredMCPClientBodySchema,
  updateStoredMCPClientBodySchema,
  listStoredMCPClientsQuerySchema,
} from '../schemas/stored-mcp-clients';
import type { ServerContext } from '../server-adapter';
import {
  LIST_STORED_MCP_CLIENTS_ROUTE,
  GET_STORED_MCP_CLIENT_ROUTE,
  CREATE_STORED_MCP_CLIENT_ROUTE,
  UPDATE_STORED_MCP_CLIENT_ROUTE,
  DELETE_STORED_MCP_CLIENT_ROUTE,
} from './stored-mcp-clients';

// =============================================================================
// Mock Factories
// =============================================================================

interface MockStoredMCPClient {
  id: string;
  name: string;
  description?: string;
  servers: Record<
    string,
    {
      type: 'stdio' | 'http';
      command?: string;
      args?: string[];
      env?: Record<string, string>;
      url?: string;
      timeout?: number;
    }
  >;
  authorId?: string;
  metadata?: Record<string, unknown>;
  activeVersionId?: string;
  status?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface MockMCPClientsStore {
  create: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
  getByIdResolved: ReturnType<typeof vi.fn>;
  listResolved: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  getLatestVersion: ReturnType<typeof vi.fn>;
  createVersion: ReturnType<typeof vi.fn>;
  listVersions: ReturnType<typeof vi.fn>;
  getVersion: ReturnType<typeof vi.fn>;
  getVersionByNumber: ReturnType<typeof vi.fn>;
  deleteVersion: ReturnType<typeof vi.fn>;
  deleteVersionsByParentId: ReturnType<typeof vi.fn>;
  countVersions: ReturnType<typeof vi.fn>;
  dangerouslyClearAll: ReturnType<typeof vi.fn>;
  init: ReturnType<typeof vi.fn>;
}

function createMockMCPClientsStore(data: Map<string, MockStoredMCPClient> = new Map()): MockMCPClientsStore {
  return {
    create: vi.fn().mockImplementation(async ({ mcpClient }: { mcpClient: MockStoredMCPClient }) => {
      if (data.has(mcpClient.id)) {
        throw new Error('MCP client already exists');
      }
      data.set(mcpClient.id, mcpClient);
      return mcpClient;
    }),
    getById: vi.fn().mockImplementation(async (id: string) => {
      return data.get(id) || null;
    }),
    getByIdResolved: vi.fn().mockImplementation(async (id: string) => {
      return data.get(id) || null;
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
        let clients = Array.from(data.values());

        if (authorId) {
          clients = clients.filter(c => c.authorId === authorId);
        }

        if (metadata) {
          clients = clients.filter(c => {
            if (!c.metadata) return false;
            return Object.entries(metadata).every(([key, value]) => c.metadata?.[key] === value);
          });
        }

        const start = (page - 1) * perPage;
        const end = start + perPage;
        const paginated = clients.slice(start, end);

        return {
          mcpClients: paginated,
          total: clients.length,
          page,
          perPage,
          hasMore: end < clients.length,
        };
      },
    ),
    update: vi.fn().mockImplementation(async (updates: Partial<MockStoredMCPClient> & { id: string }) => {
      const existing = data.get(updates.id);
      if (!existing) return null;

      const updated = { ...existing };
      Object.keys(updates).forEach(key => {
        if (updates[key as keyof MockStoredMCPClient] !== undefined && key !== 'id') {
          (updated as any)[key] = updates[key as keyof MockStoredMCPClient];
        }
      });

      data.set(updates.id, updated);
      return updated;
    }),
    delete: vi.fn().mockImplementation(async (id: string) => {
      data.delete(id);
    }),
    list: vi.fn().mockImplementation(async () => {
      return {
        mcpClients: Array.from(data.values()),
        total: data.size,
        page: 1,
        perPage: 20,
        hasMore: false,
      };
    }),
    getLatestVersion: vi.fn().mockResolvedValue(null),
    createVersion: vi.fn().mockResolvedValue({}),
    listVersions: vi.fn().mockResolvedValue({ versions: [], total: 0, page: 0, perPage: 20, hasMore: false }),
    getVersion: vi.fn().mockResolvedValue(null),
    getVersionByNumber: vi.fn().mockResolvedValue(null),
    deleteVersion: vi.fn().mockResolvedValue(undefined),
    deleteVersionsByParentId: vi.fn().mockResolvedValue(undefined),
    countVersions: vi.fn().mockResolvedValue(0),
    dangerouslyClearAll: vi.fn().mockImplementation(async () => {
      data.clear();
    }),
    init: vi.fn().mockResolvedValue(undefined),
  };
}

interface MockStorage {
  getStore: ReturnType<typeof vi.fn>;
}

function createMockStorage(mcpClientsStore?: MockMCPClientsStore): MockStorage {
  return {
    getStore: vi.fn().mockImplementation(async (storeName: string) => {
      if (storeName === 'mcpClients' && mcpClientsStore) {
        return mcpClientsStore;
      }
      return null;
    }),
  };
}

interface MockMastra {
  getStorage: ReturnType<typeof vi.fn>;
  getEditor: ReturnType<typeof vi.fn>;
}

function createMockMastra(options: { storage?: MockStorage } = {}): MockMastra {
  return {
    getStorage: vi.fn().mockReturnValue(options.storage),
    getEditor: vi.fn().mockReturnValue(null),
  };
}

function createTestContext(mastra: MockMastra): ServerContext {
  return {
    mastra: mastra as unknown as Mastra,
    requestContext: new RequestContext(),
    abortSignal: new AbortController().signal,
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Stored MCP Clients Handlers', () => {
  let mockData: Map<string, MockStoredMCPClient>;
  let mockStore: MockMCPClientsStore;
  let mockStorage: MockStorage;
  let mockMastra: MockMastra;

  beforeEach(() => {
    mockData = new Map();
    mockStore = createMockMCPClientsStore(mockData);
    mockStorage = createMockStorage(mockStore);
    mockMastra = createMockMastra({ storage: mockStorage });
  });

  describe('LIST_STORED_MCP_CLIENTS_ROUTE', () => {
    it('should return empty list when no MCP clients exist', async () => {
      const result = await LIST_STORED_MCP_CLIENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
      });

      expect(result).toEqual({
        mcpClients: [],
        total: 0,
        page: 1,
        perPage: 20,
        hasMore: false,
      });
    });

    it('should return list of stored MCP clients', async () => {
      mockData.set('client1', {
        id: 'client1',
        name: 'GitHub MCP',
        description: 'GitHub tools',
        servers: {
          github: { type: 'stdio', command: 'npx', args: ['@github/mcp-server'] },
        },
        authorId: 'author1',
      });

      mockData.set('client2', {
        id: 'client2',
        name: 'Slack MCP',
        servers: {
          slack: { type: 'http', url: 'https://slack-mcp.example.com' },
        },
        authorId: 'author2',
      });

      const result = await LIST_STORED_MCP_CLIENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
      });

      expect(result.mcpClients).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.mcpClients[0]).toMatchObject({
        id: 'client1',
        name: 'GitHub MCP',
      });
    });

    it('should support pagination', async () => {
      for (let i = 1; i <= 5; i++) {
        mockData.set(`client${i}`, {
          id: `client${i}`,
          name: `MCP Client ${i}`,
          servers: { default: { type: 'stdio', command: `cmd${i}` } },
        });
      }

      const page1 = await LIST_STORED_MCP_CLIENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
        perPage: 2,
      });

      expect(page1.mcpClients).toHaveLength(2);
      expect(page1.total).toBe(5);
      expect(page1.hasMore).toBe(true);
      expect(page1.page).toBe(1);

      const page2 = await LIST_STORED_MCP_CLIENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 2,
        perPage: 2,
      });

      expect(page2.mcpClients).toHaveLength(2);
      expect(page2.page).toBe(2);
    });

    it('should filter by authorId', async () => {
      mockData.set('client1', {
        id: 'client1',
        name: 'Client 1',
        servers: { s: { type: 'stdio', command: 'cmd' } },
        authorId: 'author1',
      });

      mockData.set('client2', {
        id: 'client2',
        name: 'Client 2',
        servers: { s: { type: 'stdio', command: 'cmd' } },
        authorId: 'author2',
      });

      const result = await LIST_STORED_MCP_CLIENTS_ROUTE.handler({
        ...createTestContext(mockMastra),
        page: 1,
        authorId: 'author1',
      });

      expect(result.mcpClients).toHaveLength(1);
      expect(result.mcpClients[0].id).toBe('client1');
    });

    it('should throw error when storage is not configured', async () => {
      const mastraNoStorage = createMockMastra({});

      try {
        await LIST_STORED_MCP_CLIENTS_ROUTE.handler({
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

    it('should throw error when mcpClients domain is not available', async () => {
      const emptyStorage: MockStorage = {
        getStore: vi.fn().mockResolvedValue(null),
      };
      const mastra = createMockMastra({ storage: emptyStorage });

      try {
        await LIST_STORED_MCP_CLIENTS_ROUTE.handler({
          ...createTestContext(mastra),
          page: 1,
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('MCP clients storage domain is not available');
      }
    });
  });

  describe('GET_STORED_MCP_CLIENT_ROUTE', () => {
    it('should get a specific stored MCP client', async () => {
      mockData.set('test-client', {
        id: 'test-client',
        name: 'Test MCP Client',
        description: 'A test MCP client',
        servers: {
          main: { type: 'http', url: 'https://mcp.example.com', timeout: 5000 },
        },
        metadata: { env: 'test' },
      });

      const result = await GET_STORED_MCP_CLIENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedMCPClientId: 'test-client',
      });

      expect(result).toMatchObject({
        id: 'test-client',
        name: 'Test MCP Client',
        description: 'A test MCP client',
        servers: {
          main: { type: 'http', url: 'https://mcp.example.com', timeout: 5000 },
        },
        metadata: { env: 'test' },
      });
    });

    it('should throw 404 when MCP client does not exist', async () => {
      try {
        await GET_STORED_MCP_CLIENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedMCPClientId: 'non-existent',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe('Stored MCP client with id non-existent not found');
      }
    });

    it('should throw error when storage is not configured', async () => {
      const mastraNoStorage = createMockMastra({});

      try {
        await GET_STORED_MCP_CLIENT_ROUTE.handler({
          ...createTestContext(mastraNoStorage),
          storedMCPClientId: 'some-id',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not configured');
      }
    });
  });

  describe('CREATE_STORED_MCP_CLIENT_ROUTE', () => {
    it('should create a new stored MCP client', async () => {
      const clientData = {
        id: 'new-client',
        name: 'New MCP Client',
        description: 'A newly created client',
        servers: {
          github: { type: 'stdio' as const, command: 'npx', args: ['@github/mcp-server'] },
        },
        authorId: 'user123',
        metadata: { created: 'test' },
      };

      const result = await CREATE_STORED_MCP_CLIENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        ...clientData,
      });

      expect(result).toMatchObject(clientData);
      expect(mockStore.create).toHaveBeenCalledWith({
        mcpClient: expect.objectContaining({
          id: 'new-client',
          name: 'New MCP Client',
        }),
      });
    });

    it('should derive id from name via slugify when id is not provided', async () => {
      const result = await CREATE_STORED_MCP_CLIENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        id: undefined,
        name: 'My Cool MCP Client',
        servers: {
          default: { type: 'http' as const, url: 'https://mcp.example.com' },
        },
      });

      expect(result).toMatchObject({
        id: 'my-cool-mcp-client',
        name: 'My Cool MCP Client',
      });
      expect(mockStore.create).toHaveBeenCalledWith({
        mcpClient: expect.objectContaining({
          id: 'my-cool-mcp-client',
          name: 'My Cool MCP Client',
        }),
      });
    });

    it('should use provided id when explicitly set', async () => {
      const result = await CREATE_STORED_MCP_CLIENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        id: 'custom-id-123',
        name: 'My Client',
        servers: {
          s: { type: 'stdio' as const, command: 'cmd' },
        },
      });

      expect(result).toMatchObject({
        id: 'custom-id-123',
        name: 'My Client',
      });
    });

    it('should throw 409 when MCP client with same ID already exists', async () => {
      mockData.set('existing-client', {
        id: 'existing-client',
        name: 'Existing Client',
        servers: { s: { type: 'stdio', command: 'cmd' } },
      });

      try {
        await CREATE_STORED_MCP_CLIENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          id: 'existing-client',
          name: 'Duplicate Client',
          servers: {
            s: { type: 'stdio' as const, command: 'cmd' },
          },
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(409);
        expect((error as HTTPException).message).toBe('MCP client with id existing-client already exists');
      }
    });

    it('should throw error when storage is not configured', async () => {
      const mastraNoStorage = createMockMastra({});

      try {
        await CREATE_STORED_MCP_CLIENT_ROUTE.handler({
          ...createTestContext(mastraNoStorage),
          name: 'Test',
          servers: { s: { type: 'stdio' as const, command: 'cmd' } },
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not configured');
      }
    });

    it('should create MCP client with multiple servers', async () => {
      const result = await CREATE_STORED_MCP_CLIENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        id: 'multi-server',
        name: 'Multi Server Client',
        servers: {
          github: { type: 'stdio' as const, command: 'npx', args: ['@github/mcp'] },
          remote: { type: 'http' as const, url: 'https://api.example.com/mcp', timeout: 10000 },
        },
      });

      expect(result).toMatchObject({
        id: 'multi-server',
        servers: {
          github: { type: 'stdio', command: 'npx', args: ['@github/mcp'] },
          remote: { type: 'http', url: 'https://api.example.com/mcp', timeout: 10000 },
        },
      });
    });
  });

  describe('UPDATE_STORED_MCP_CLIENT_ROUTE', () => {
    it('should update an existing stored MCP client', async () => {
      mockData.set('update-test', {
        id: 'update-test',
        name: 'Original Name',
        description: 'Original description',
        servers: {
          s: { type: 'stdio', command: 'old-cmd' },
        },
        authorId: 'original-author',
      });

      const result = await UPDATE_STORED_MCP_CLIENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedMCPClientId: 'update-test',
        name: 'Updated Name',
        description: 'Updated description',
        servers: {
          s: { type: 'stdio' as const, command: 'new-cmd' },
        },
      });

      expect(result).toMatchObject({
        id: 'update-test',
        name: 'Updated Name',
        description: 'Updated description',
        servers: {
          s: { type: 'stdio', command: 'new-cmd' },
        },
        authorId: 'original-author',
      });
    });

    it('should throw 404 when MCP client does not exist', async () => {
      try {
        await UPDATE_STORED_MCP_CLIENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedMCPClientId: 'non-existent',
          name: 'Updated Name',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe('Stored MCP client with id non-existent not found');
      }
    });

    it('should allow partial updates', async () => {
      mockData.set('partial-test', {
        id: 'partial-test',
        name: 'Original Name',
        description: 'Original description',
        servers: {
          s: { type: 'http', url: 'https://original.example.com' },
        },
      });

      const result = await UPDATE_STORED_MCP_CLIENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedMCPClientId: 'partial-test',
        description: 'Only description changed',
      });

      expect(result).toMatchObject({
        id: 'partial-test',
        name: 'Original Name',
        description: 'Only description changed',
      });
    });

    it('should throw error when storage is not configured', async () => {
      const mastraNoStorage = createMockMastra({});

      try {
        await UPDATE_STORED_MCP_CLIENT_ROUTE.handler({
          ...createTestContext(mastraNoStorage),
          storedMCPClientId: 'some-id',
          name: 'Updated',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not configured');
      }
    });
  });

  describe('DELETE_STORED_MCP_CLIENT_ROUTE', () => {
    it('should delete an existing stored MCP client', async () => {
      mockData.set('delete-test', {
        id: 'delete-test',
        name: 'To Be Deleted',
        servers: { s: { type: 'stdio', command: 'cmd' } },
      });

      const result = await DELETE_STORED_MCP_CLIENT_ROUTE.handler({
        ...createTestContext(mockMastra),
        storedMCPClientId: 'delete-test',
      });

      expect(result).toEqual({ success: true, message: 'MCP client delete-test deleted successfully' });
      expect(mockStore.delete).toHaveBeenCalledWith('delete-test');
      expect(mockData.has('delete-test')).toBe(false);
    });

    it('should throw 404 when MCP client does not exist', async () => {
      try {
        await DELETE_STORED_MCP_CLIENT_ROUTE.handler({
          ...createTestContext(mockMastra),
          storedMCPClientId: 'non-existent',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(404);
        expect((error as HTTPException).message).toBe('Stored MCP client with id non-existent not found');
      }
    });

    it('should throw error when storage is not configured', async () => {
      const mastraNoStorage = createMockMastra({});

      try {
        await DELETE_STORED_MCP_CLIENT_ROUTE.handler({
          ...createTestContext(mastraNoStorage),
          storedMCPClientId: 'some-id',
        });
        expect.fail('Should have thrown HTTPException');
      } catch (error) {
        expect(error).toBeInstanceOf(HTTPException);
        expect((error as HTTPException).status).toBe(500);
        expect((error as HTTPException).message).toBe('Storage is not configured');
      }
    });
  });
});

// =============================================================================
// Schema Validation Tests
// =============================================================================

describe('createStoredMCPClientBodySchema', () => {
  const baseClient = {
    name: 'Test MCP Client',
    servers: {
      default: { type: 'stdio', command: 'npx', args: ['@test/mcp-server'] },
    },
  };

  it('should accept a create body without id', () => {
    const result = createStoredMCPClientBodySchema.safeParse(baseClient);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBeUndefined();
      expect(result.data.name).toBe('Test MCP Client');
    }
  });

  it('should accept a create body with an explicit id', () => {
    const result = createStoredMCPClientBodySchema.safeParse({
      ...baseClient,
      id: 'custom-id',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.id).toBe('custom-id');
    }
  });

  it('should require name', () => {
    const result = createStoredMCPClientBodySchema.safeParse({
      servers: { s: { type: 'stdio', command: 'cmd' } },
    });

    expect(result.success).toBe(false);
  });

  it('should require servers', () => {
    const result = createStoredMCPClientBodySchema.safeParse({
      name: 'Test',
    });

    expect(result.success).toBe(false);
  });

  it('should accept stdio server config', () => {
    const result = createStoredMCPClientBodySchema.safeParse({
      name: 'Stdio Client',
      servers: {
        main: {
          type: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'production' },
          timeout: 5000,
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servers.main).toEqual({
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
        env: { NODE_ENV: 'production' },
        timeout: 5000,
      });
    }
  });

  it('should accept http server config', () => {
    const result = createStoredMCPClientBodySchema.safeParse({
      name: 'HTTP Client',
      servers: {
        remote: {
          type: 'http',
          url: 'https://api.example.com/mcp',
          timeout: 10000,
        },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servers.remote).toEqual({
        type: 'http',
        url: 'https://api.example.com/mcp',
        timeout: 10000,
      });
    }
  });

  it('should accept multiple servers', () => {
    const result = createStoredMCPClientBodySchema.safeParse({
      name: 'Multi Server',
      servers: {
        local: { type: 'stdio', command: 'cmd' },
        remote: { type: 'http', url: 'https://api.example.com' },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(Object.keys(result.data.servers)).toHaveLength(2);
    }
  });

  it('should reject invalid server type', () => {
    const result = createStoredMCPClientBodySchema.safeParse({
      name: 'Bad Client',
      servers: {
        main: { type: 'websocket', url: 'ws://example.com' },
      },
    });

    expect(result.success).toBe(false);
  });

  it('should accept authorId and metadata', () => {
    const result = createStoredMCPClientBodySchema.safeParse({
      ...baseClient,
      authorId: 'author-1',
      metadata: { env: 'staging', version: 2 },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authorId).toBe('author-1');
      expect(result.data.metadata).toEqual({ env: 'staging', version: 2 });
    }
  });
});

describe('updateStoredMCPClientBodySchema', () => {
  it('should accept partial updates with only name', () => {
    const result = updateStoredMCPClientBodySchema.safeParse({
      name: 'Updated Name',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Updated Name');
    }
  });

  it('should accept partial updates with only servers', () => {
    const result = updateStoredMCPClientBodySchema.safeParse({
      servers: {
        newServer: { type: 'http', url: 'https://new.example.com' },
      },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.servers).toEqual({
        newServer: { type: 'http', url: 'https://new.example.com' },
      });
    }
  });

  it('should accept empty update body', () => {
    const result = updateStoredMCPClientBodySchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('should accept metadata update', () => {
    const result = updateStoredMCPClientBodySchema.safeParse({
      metadata: { env: 'production' },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.metadata).toEqual({ env: 'production' });
    }
  });

  it('should accept combined updates', () => {
    const result = updateStoredMCPClientBodySchema.safeParse({
      name: 'Updated',
      description: 'New description',
      servers: {
        s: { type: 'stdio', command: 'new-cmd' },
      },
      authorId: 'new-author',
      metadata: { updated: true },
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Updated');
      expect(result.data.description).toBe('New description');
      expect(result.data.authorId).toBe('new-author');
    }
  });
});

describe('listStoredMCPClientsQuerySchema', () => {
  it('should accept default pagination', () => {
    const result = listStoredMCPClientsQuerySchema.safeParse({});

    expect(result.success).toBe(true);
  });

  it('should accept custom page and perPage', () => {
    const result = listStoredMCPClientsQuerySchema.safeParse({
      page: 2,
      perPage: 50,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.page).toBe(2);
      expect(result.data.perPage).toBe(50);
    }
  });

  it('should accept orderBy', () => {
    const result = listStoredMCPClientsQuerySchema.safeParse({
      orderBy: { field: 'createdAt', direction: 'DESC' },
    });

    expect(result.success).toBe(true);
  });

  it('should accept authorId filter', () => {
    const result = listStoredMCPClientsQuerySchema.safeParse({
      authorId: 'author-1',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.authorId).toBe('author-1');
    }
  });

  it('should reject invalid orderBy direction', () => {
    const result = listStoredMCPClientsQuerySchema.safeParse({
      orderBy: { field: 'createdAt', direction: 'INVALID' },
    });

    expect(result.success).toBe(false);
  });

  it('should reject invalid orderBy field', () => {
    const result = listStoredMCPClientsQuerySchema.safeParse({
      orderBy: { field: 'name', direction: 'ASC' },
    });

    expect(result.success).toBe(false);
  });
});
