import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { Mastra } from '@mastra/core';
import { Agent } from '@mastra/core/agent';
import { MCPServerBase } from '@mastra/core/mcp';
import { RequestContext } from '@mastra/core/request-context';
import { LibSQLStore } from '@mastra/libsql';
import { MastraEditor, EditorMCPNamespace } from './index';

class TestMCPServer extends MCPServerBase {
  convertTools(tools: any) {
    const converted: Record<string, any> = {};
    if (tools && typeof tools === 'object') {
      for (const [key, fn] of Object.entries(tools)) {
        converted[key] = { description: `Tool: ${key}`, execute: fn };
      }
    }
    return converted;
  }
  async startStdio() {}
  async startSSE() {}
  async startHonoSSE() {
    return undefined;
  }
  async startHTTP() {}
  async close() {}
  getServerInfo() {
    return {} as any;
  }
  getServerDetail() {
    return {} as any;
  }
  getToolListInfo() {
    return { tools: [] };
  }
  getToolInfo() {
    return undefined;
  }
  async executeTool() {
    return {};
  }
}

const createTestStorage = () => {
  return new LibSQLStore({
    id: `test-${randomUUID()}`,
    url: ':memory:',
  });
};

describe('EditorMCPNamespace', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;
  let mastra: Mastra;

  beforeEach(async () => {
    storage = createTestStorage();
    editor = new MastraEditor();
    mastra = new Mastra({ storage, editor });
    await storage.init();
  });

  afterEach(async () => {
    const mcpStore = await storage.getStore('mcpClients');
    await mcpStore?.dangerouslyClearAll();
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.dangerouslyClearAll();
  });

  describe('CRUD operations', () => {
    it('should create and retrieve an MCP client', async () => {
      const mcpStore = await storage.getStore('mcpClients');
      await mcpStore?.create({
        mcpClient: {
          id: 'mcp-1',
          name: 'Test MCP Client',
          servers: {
            'my-server': {
              type: 'http',
              url: 'https://api.example.com/mcp',
              timeout: 5000,
            },
          },
        },
      });

      const result = await editor.mcp.getById('mcp-1');

      expect(result).not.toBeNull();
      expect(result!.id).toBe('mcp-1');
      expect(result!.name).toBe('Test MCP Client');
      expect(result!.servers).toEqual({
        'my-server': {
          type: 'http',
          url: 'https://api.example.com/mcp',
          timeout: 5000,
        },
      });
      expect(result!.createdAt).toBeInstanceOf(Date);
      expect(result!.updatedAt).toBeInstanceOf(Date);
    });

    it('should update an MCP client', async () => {
      const mcpStore = await storage.getStore('mcpClients');

      // Create via editor namespace
      await editor.mcp.create({
        id: 'mcp-update',
        name: 'Original Name',
        servers: {
          srv: { type: 'http', url: 'https://example.com/mcp' },
        },
      });

      // Config changes require createVersion + update(activeVersionId)
      await mcpStore!.createVersion({
        id: randomUUID(),
        mcpClientId: 'mcp-update',
        versionNumber: 2,
        name: 'Updated Name',
        servers: { srv: { type: 'http', url: 'https://example.com/mcp' } },
        changedFields: ['name'],
      });

      const latestVersion = await mcpStore!.getLatestVersion('mcp-update');
      await mcpStore!.update({ id: 'mcp-update', activeVersionId: latestVersion!.id, status: 'published' });
      editor.mcp.clearCache('mcp-update');

      const updated = await editor.mcp.getById('mcp-update');
      expect(updated!.name).toBe('Updated Name');

      // Verify via getById
      const fetched = await editor.mcp.getById('mcp-update');
      expect(fetched!.name).toBe('Updated Name');
    });

    it('should delete an MCP client', async () => {
      await editor.mcp.create({
        id: 'mcp-delete',
        name: 'To Delete',
        servers: {
          srv: { type: 'stdio', command: 'echo', args: ['hello'] },
        },
      });

      // Verify it exists
      const before = await editor.mcp.getById('mcp-delete');
      expect(before).not.toBeNull();

      await editor.mcp.delete('mcp-delete');

      const after = await editor.mcp.getById('mcp-delete');
      expect(after).toBeNull();
    });

    it('should list MCP clients', async () => {
      const mcpStore = await storage.getStore('mcpClients');
      await mcpStore?.create({
        mcpClient: {
          id: 'mcp-a',
          name: 'Client A',
          servers: { srv: { type: 'http', url: 'https://a.example.com' } },
        },
      });
      await mcpStore?.update({ id: 'mcp-a', status: 'published' });
      await mcpStore?.create({
        mcpClient: {
          id: 'mcp-b',
          name: 'Client B',
          servers: { srv: { type: 'http', url: 'https://b.example.com' } },
        },
      });
      await mcpStore?.update({ id: 'mcp-b', status: 'published' });

      const result = await editor.mcp.list();

      expect(result.mcpClients).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should throw when storage is not configured', async () => {
      const editorNoStorage = new MastraEditor();
      const mastraNoStorage = new Mastra({ editor: editorNoStorage });

      await expect(editorNoStorage.mcp.getById('test-id')).rejects.toThrow('Storage is not configured');
    });
  });

  describe('toMCPServerDefinition', () => {
    it('should convert stdio server config', () => {
      const result = EditorMCPNamespace.toMCPServerDefinition({
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@example/mcp-tool'],
        env: { NODE_ENV: 'production' },
      });

      expect(result).toEqual({
        command: 'npx',
        args: ['-y', '@example/mcp-tool'],
        env: { NODE_ENV: 'production' },
        timeout: undefined,
      });
    });

    it('should convert http server config with URL object', () => {
      const result = EditorMCPNamespace.toMCPServerDefinition({
        type: 'http',
        url: 'https://api.example.com/mcp',
      });

      expect(result.url).toBeInstanceOf(URL);
      expect((result.url as URL).href).toBe('https://api.example.com/mcp');
      expect(result.timeout).toBeUndefined();
    });

    it('should include timeout when present', () => {
      const stdioResult = EditorMCPNamespace.toMCPServerDefinition({
        type: 'stdio',
        command: 'node',
        args: ['server.js'],
        timeout: 10000,
      });
      expect(stdioResult.timeout).toBe(10000);

      const httpResult = EditorMCPNamespace.toMCPServerDefinition({
        type: 'http',
        url: 'https://api.example.com/mcp',
        timeout: 5000,
      });
      expect(httpResult.timeout).toBe(5000);
    });
  });

  describe('toMCPClientOptions', () => {
    it('should convert resolved MCP client to MCPClientOptions shape', () => {
      const result = EditorMCPNamespace.toMCPClientOptions({
        id: 'mcp-1',
        name: 'Test Client',
        status: 'published' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        servers: {
          'my-server': {
            type: 'http',
            url: 'https://api.example.com/mcp',
            timeout: 5000,
          },
        },
      });

      expect(result.id).toBe('mcp-1');
      expect(result.servers['my-server']).toBeDefined();
      expect(result.servers['my-server']!.url).toBeInstanceOf(URL);
      expect((result.servers['my-server']!.url as URL).href).toBe('https://api.example.com/mcp');
      expect(result.servers['my-server']!.timeout).toBe(5000);
    });

    it('should handle multiple servers', () => {
      const result = EditorMCPNamespace.toMCPClientOptions({
        id: 'mcp-multi',
        name: 'Multi Server Client',
        status: 'published' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        servers: {
          'http-server': {
            type: 'http',
            url: 'https://api.example.com/mcp',
          },
          'stdio-server': {
            type: 'stdio',
            command: 'npx',
            args: ['-y', '@example/tool'],
            env: { KEY: 'value' },
          },
        },
      });

      expect(result.id).toBe('mcp-multi');
      expect(Object.keys(result.servers)).toHaveLength(2);

      // HTTP server
      expect(result.servers['http-server']!.url).toBeInstanceOf(URL);

      // Stdio server
      expect(result.servers['stdio-server']!.command).toBe('npx');
      expect(result.servers['stdio-server']!.args).toEqual(['-y', '@example/tool']);
      expect(result.servers['stdio-server']!.env).toEqual({ KEY: 'value' });
    });
  });
});

const mockListTools = vi.fn();

vi.mock('@mastra/mcp', () => {
  return {
    MCPClient: class MockMCPClient {
      constructor(_opts: any) {}
      listTools() {
        return mockListTools();
      }
    },
  };
});

describe('Agent MCP tool resolution', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;
  let mastra: Mastra;

  beforeEach(async () => {
    storage = createTestStorage();
    // Create Mastra first so augmentWithInit runs init() before we insert data.
    // With :memory: LibSQL, calling init() after data insert wipes the data.
    editor = new MastraEditor();
    mastra = new Mastra({ storage, editor });
    // Force init via the proxy so tables exist
    await mastra.getStorage()?.init();
    mockListTools.mockReset();
  });

  afterEach(async () => {
    const mcpStore = await storage.getStore('mcpClients');
    await mcpStore?.dangerouslyClearAll();
    const agentsStore = await storage.getStore('agents');
    await agentsStore?.dangerouslyClearAll();
  });

  it('should resolve MCP tools from stored agent mcpClients field', async () => {
    const mcpStore = await storage.getStore('mcpClients');
    const agentsStore = await storage.getStore('agents');

    // Create MCP client in storage
    await mcpStore?.create({
      mcpClient: {
        id: 'my-mcp',
        name: 'Test MCP',
        servers: {
          'test-server': {
            type: 'http',
            url: 'https://mcp.example.com',
          },
        },
      },
    });

    // Create agent that references the MCP client
    await agentsStore?.create({
      agent: {
        id: 'agent-with-mcp',
        name: 'MCP Agent',
        instructions: 'You are a test agent with MCP tools',
        model: { provider: 'openai', name: 'gpt-4' },
        mcpClients: {
          'my-mcp': {
            tools: {
              'server_tool-a': {},
              'server_tool-b': {},
            },
          },
        },
      },
    });

    // Mock the tools returned by MCPClient.listTools()
    mockListTools.mockResolvedValue({
      'server_tool-a': { description: 'Original A', execute: vi.fn() },
      'server_tool-b': { description: 'Original B', execute: vi.fn() },
      'server_tool-c': { description: 'Not selected', execute: vi.fn() },
    });

    const agent = await editor.agent.getById('agent-with-mcp');

    expect(agent).toBeInstanceOf(Agent);

    const tools = await agent!.listTools();
    expect(tools['server_tool-a']).toBeDefined();
    expect(tools['server_tool-b']).toBeDefined();
    expect(tools['server_tool-c']).toBeUndefined();
  });

  it('should filter MCP tools to only allowed ones', async () => {
    const mcpStore = await storage.getStore('mcpClients');
    const agentsStore = await storage.getStore('agents');

    await mcpStore?.create({
      mcpClient: {
        id: 'filter-mcp',
        name: 'Filter MCP',
        servers: {
          srv: { type: 'http', url: 'https://mcp.example.com' },
        },
      },
    });

    await agentsStore?.create({
      agent: {
        id: 'agent-filter-mcp',
        name: 'Filter Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        mcpClients: {
          'filter-mcp': {
            tools: {
              'allowed-tool': {},
            },
          },
        },
      },
    });

    mockListTools.mockResolvedValue({
      'allowed-tool': { description: 'Allowed', execute: vi.fn() },
      'blocked-tool': { description: 'Blocked', execute: vi.fn() },
      'another-blocked': { description: 'Also blocked', execute: vi.fn() },
    });

    const agent = await editor.agent.getById('agent-filter-mcp');
    const tools = await agent!.listTools();

    expect(tools['allowed-tool']).toBeDefined();
    expect(tools['blocked-tool']).toBeUndefined();
    expect(tools['another-blocked']).toBeUndefined();
  });

  it('should apply tool description overrides from mcpClients config', async () => {
    const mcpStore = await storage.getStore('mcpClients');
    const agentsStore = await storage.getStore('agents');

    await mcpStore?.create({
      mcpClient: {
        id: 'override-mcp',
        name: 'Override MCP',
        servers: {
          srv: { type: 'http', url: 'https://mcp.example.com' },
        },
      },
    });

    await agentsStore?.create({
      agent: {
        id: 'agent-override-mcp',
        name: 'Override Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        mcpClients: {
          'override-mcp': {
            tools: {
              'tool-a': {},
              'tool-b': { description: 'Custom override description' },
            },
          },
        },
      },
    });

    mockListTools.mockResolvedValue({
      'tool-a': { description: 'Original A', execute: vi.fn() },
      'tool-b': { description: 'Original B', execute: vi.fn() },
    });

    const agent = await editor.agent.getById('agent-override-mcp');
    const tools = await agent!.listTools();

    expect(tools['tool-a']).toBeDefined();
    expect(tools['tool-a'].description).toBe('Original A');

    expect(tools['tool-b']).toBeDefined();
    expect(tools['tool-b'].description).toBe('Custom override description');
  });

  it('should warn when MCP client/server not found anywhere', async () => {
    // Use a separate storage/editor/mastra so we can attach a custom logger
    const warnSpy = vi.fn();
    const freshStorage = createTestStorage();
    const editorWithLogger = new MastraEditor({
      logger: {
        warn: warnSpy,
        info: vi.fn(),
        debug: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
        trackException: vi.fn(),
      } as any,
    });
    const _mastra = new Mastra({ storage: freshStorage, editor: editorWithLogger });
    await freshStorage.init();

    const agentsStore = await freshStorage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-missing-mcp',
        name: 'Missing MCP Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        mcpClients: {
          'nonexistent-mcp': {
            tools: {
              'some-tool': {},
            },
          },
        },
      },
    });

    const agent = await editorWithLogger.agent.getById('agent-missing-mcp');

    expect(agent).toBeInstanceOf(Agent);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonexistent-mcp'));
  });

  it('should include all tools when tools config is empty object (tools: {})', async () => {
    const mcpStore = await storage.getStore('mcpClients');
    const agentsStore = await storage.getStore('agents');

    await mcpStore?.create({
      mcpClient: {
        id: 'all-tools-mcp',
        name: 'All Tools MCP',
        servers: {
          srv: { type: 'http', url: 'https://mcp.example.com' },
        },
      },
    });

    await agentsStore?.create({
      agent: {
        id: 'agent-all-tools',
        name: 'All Tools Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        mcpClients: {
          'all-tools-mcp': { tools: {} }, // empty tools object → include everything
        },
      },
    });

    mockListTools.mockResolvedValue({
      'tool-x': { description: 'Tool X', execute: vi.fn() },
      'tool-y': { description: 'Tool Y', execute: vi.fn() },
      'tool-z': { description: 'Tool Z', execute: vi.fn() },
    });

    const agent = await editor.agent.getById('agent-all-tools');
    expect(agent).toBeInstanceOf(Agent);

    const tools = await agent!.listTools();
    expect(tools['tool-x']).toBeDefined();
    expect(tools['tool-y']).toBeDefined();
    expect(tools['tool-z']).toBeDefined();
  });

  it('should resolve tools from a code-defined MCP server on the Mastra instance', async () => {
    const codeServer = new TestMCPServer({
      id: 'code-server',
      name: 'Code Server',
      version: '1.0.0',
      tools: {
        'code-tool-a': vi.fn(),
        'code-tool-b': vi.fn(),
        'code-tool-c': vi.fn(),
      },
    });

    // Create fresh Mastra with the code-defined MCP server
    const freshStorage = createTestStorage();
    const freshEditor = new MastraEditor();
    const freshMastra = new Mastra({
      storage: freshStorage,
      editor: freshEditor,
      mcpServers: { 'code-server': codeServer },
    });
    await freshMastra.getStorage()?.init();

    const agentsStore = await freshStorage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-code-mcp',
        name: 'Code MCP Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        mcpClients: {
          // Reference the code-defined server by its ID
          'code-server': {
            tools: {
              'code-tool-a': {},
              'code-tool-b': { description: 'Custom B' },
            },
          },
        },
      },
    });

    const agent = await freshEditor.agent.getById('agent-code-mcp');
    expect(agent).toBeInstanceOf(Agent);

    const tools = await agent!.listTools();
    expect(tools['code-tool-a']).toBeDefined();
    expect(tools['code-tool-a'].description).toBe('Tool: code-tool-a');
    expect(tools['code-tool-b']).toBeDefined();
    expect(tools['code-tool-b'].description).toBe('Custom B'); // overridden
    expect(tools['code-tool-c']).toBeUndefined(); // not in allowed tools
  });

  it('should resolve tools from code-defined MCP server with all tools (tools: {})', async () => {
    const codeServer = new TestMCPServer({
      id: 'all-server',
      name: 'All Server',
      version: '1.0.0',
      tools: {
        'server-tool-1': vi.fn(),
        'server-tool-2': vi.fn(),
      } as any,
    });

    const freshStorage = createTestStorage();
    const freshEditor = new MastraEditor();
    const freshMastra = new Mastra({
      storage: freshStorage,
      editor: freshEditor,
      mcpServers: { 'all-server': codeServer },
    });
    await freshMastra.getStorage()?.init();

    const agentsStore = await freshStorage.getStore('agents');
    await agentsStore?.create({
      agent: {
        id: 'agent-all-server',
        name: 'All Server Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        mcpClients: {
          'all-server': { tools: {} }, // include all tools
        },
      },
    });

    const agent = await freshEditor.agent.getById('agent-all-server');
    expect(agent).toBeInstanceOf(Agent);

    const tools = await agent!.listTools();
    expect(tools['server-tool-1']).toBeDefined();
    expect(tools['server-tool-2']).toBeDefined();
  });

  it('should combine tools from stored MCP client, code-defined MCP server, and regular tools', async () => {
    const codeServer = new TestMCPServer({
      id: 'code-srv',
      name: 'Code Server',
      version: '1.0.0',
      tools: { 'code-tool': vi.fn() } as any,
    });

    const freshStorage = createTestStorage();
    const freshEditor = new MastraEditor();
    const freshMastra = new Mastra({
      storage: freshStorage,
      editor: freshEditor,
      mcpServers: { 'code-srv': codeServer },
    });
    await freshMastra.getStorage()?.init();

    const mcpStore = await freshStorage.getStore('mcpClients');
    const agentsStore = await freshStorage.getStore('agents');

    // Create a stored MCP client (remote)
    await mcpStore?.create({
      mcpClient: {
        id: 'remote-mcp',
        name: 'Remote MCP',
        servers: {
          srv: { type: 'http', url: 'https://remote.example.com' },
        },
      },
    });

    // Create agent referencing both sources
    await agentsStore?.create({
      agent: {
        id: 'agent-combined',
        name: 'Combined Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        mcpClients: {
          'remote-mcp': { tools: { 'remote-tool': {} } },
          'code-srv': { tools: {} }, // all tools from code server
        },
      },
    });

    // Mock remote MCP client tools
    mockListTools.mockResolvedValue({
      'remote-tool': { description: 'Remote tool', execute: vi.fn() },
      'remote-other': { description: 'Not selected', execute: vi.fn() },
    });

    const agent = await freshEditor.agent.getById('agent-combined');
    expect(agent).toBeInstanceOf(Agent);

    const tools = await agent!.listTools();

    // Remote MCP tool (filtered)
    expect(tools['remote-tool']).toBeDefined();
    expect(tools['remote-tool'].description).toBe('Remote tool');
    expect(tools['remote-other']).toBeUndefined();

    // Code-defined MCP server tool (all included)
    expect(tools['code-tool']).toBeDefined();
    expect(tools['code-tool'].description).toBe('Tool: code-tool');
  });

  it('should update an MCP client via editor namespace', async () => {
    const agentsStore = await storage.getStore('agents');

    // Create MCP client via editor
    await editor.mcp.create({
      id: 'updatable-mcp',
      name: 'Original MCP',
      servers: {
        srv: { type: 'http', url: 'https://original.example.com' },
      },
    });

    // Create agent referencing the MCP client
    await agentsStore?.create({
      agent: {
        id: 'agent-updatable',
        name: 'Updatable Agent',
        instructions: 'Test',
        model: { provider: 'openai', name: 'gpt-4' },
        mcpClients: {
          'updatable-mcp': { tools: { 'tool-a': {} } },
        },
      },
    });

    mockListTools.mockResolvedValue({
      'tool-a': { description: 'Original A', execute: vi.fn() },
    });

    const agentBefore = await editor.agent.getById('agent-updatable');
    expect(agentBefore).toBeInstanceOf(Agent);
    const toolsBefore = await agentBefore!.listTools();
    expect(toolsBefore['tool-a']).toBeDefined();

    // Update the MCP client config via createVersion + update(activeVersionId)
    const mcpStore = await storage.getStore('mcpClients');
    await mcpStore!.createVersion({
      id: randomUUID(),
      mcpClientId: 'updatable-mcp',
      versionNumber: 2,
      name: 'Updated MCP',
      servers: {
        srv: { type: 'http', url: 'https://updated.example.com' },
      },
      changedFields: ['name', 'servers'],
    });

    const latestVersion = await mcpStore!.getLatestVersion('updatable-mcp');
    await mcpStore!.update({ id: 'updatable-mcp', activeVersionId: latestVersion!.id, status: 'published' });
    editor.mcp.clearCache('updatable-mcp');

    // Verify MCP client was updated
    const updatedMcp = await editor.mcp.getById('updatable-mcp');
    expect(updatedMcp!.name).toBe('Updated MCP');
    expect(updatedMcp!.servers.srv.url).toBe('https://updated.example.com');
  });

  it('should handle MCP client version history through updates', async () => {
    const mcpStore = await storage.getStore('mcpClients');

    // Create initial MCP client
    await mcpStore?.create({
      mcpClient: {
        id: 'versioned-mcp',
        name: 'Version 1',
        servers: {
          srv: { type: 'http', url: 'https://v1.example.com' },
        },
      },
    });

    // Create v2 via createVersion + activate
    await mcpStore!.createVersion({
      id: randomUUID(),
      mcpClientId: 'versioned-mcp',
      versionNumber: 2,
      name: 'Version 2',
      servers: {
        srv: { type: 'http', url: 'https://v2.example.com' },
      },
      changedFields: ['name', 'servers'],
    });

    let latestVersion = await mcpStore!.getLatestVersion('versioned-mcp');
    await mcpStore!.update({ id: 'versioned-mcp', activeVersionId: latestVersion!.id, status: 'published' });

    // Create v3 via createVersion + activate
    await mcpStore!.createVersion({
      id: randomUUID(),
      mcpClientId: 'versioned-mcp',
      versionNumber: 3,
      name: 'Version 3',
      servers: {
        'srv-a': { type: 'http', url: 'https://v3a.example.com' },
        'srv-b': { type: 'stdio', command: 'node', args: ['server.js'] },
      },
      changedFields: ['name', 'servers'],
    });

    latestVersion = await mcpStore!.getLatestVersion('versioned-mcp');
    await mcpStore!.update({ id: 'versioned-mcp', activeVersionId: latestVersion!.id, status: 'published' });
    editor.mcp.clearCache('versioned-mcp');

    // Verify latest version
    const latest = await editor.mcp.getById('versioned-mcp');
    expect(latest!.name).toBe('Version 3');
    expect(Object.keys(latest!.servers)).toHaveLength(2);
    expect(latest!.servers['srv-a'].url).toBe('https://v3a.example.com');
    expect(latest!.servers['srv-b'].command).toBe('node');

    // Verify version count
    const versions = await mcpStore?.listVersions({
      mcpClientId: 'versioned-mcp',
    });
    expect(versions!.versions).toHaveLength(3);
  });

  describe('per-server tool filtering', () => {
    it('should apply server-level tool filtering from stored MCP client', async () => {
      const mcpStore = await storage.getStore('mcpClients');
      const agentsStore = await storage.getStore('agents');

      // Create MCP client with per-server tools filter
      await mcpStore?.create({
        mcpClient: {
          id: 'client-filter-mcp',
          name: 'Client Filtered MCP',
          servers: {
            srv: {
              type: 'http',
              url: 'https://mcp.example.com',
              tools: {
                'allowed-a': {},
                'allowed-b': {},
              },
            },
          },
        },
      });

      // Agent references the MCP client with no agent-level filter (all server-exposed tools)
      await agentsStore?.create({
        agent: {
          id: 'agent-client-filter',
          name: 'Client Filter Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          mcpClients: {
            'client-filter-mcp': { tools: {} },
          },
        },
      });

      // MCPClient.listTools() returns namespaced tool names: serverName_toolName
      mockListTools.mockResolvedValue({
        'srv_allowed-a': { description: 'Tool A', execute: vi.fn() },
        'srv_allowed-b': { description: 'Tool B', execute: vi.fn() },
        'srv_blocked-c': { description: 'Tool C', execute: vi.fn() },
      });

      const agent = await editor.agent.getById('agent-client-filter');
      expect(agent).toBeInstanceOf(Agent);

      const tools = await agent!.listTools();
      expect(tools['srv_allowed-a']).toBeDefined();
      expect(tools['srv_allowed-b']).toBeDefined();
      expect(tools['srv_blocked-c']).toBeUndefined();
    });

    it('should apply two-layer filtering: server-level then agent-level', async () => {
      const mcpStore = await storage.getStore('mcpClients');
      const agentsStore = await storage.getStore('agents');

      // Server exposes 3 tools via server-level filter
      await mcpStore?.create({
        mcpClient: {
          id: 'two-layer-mcp',
          name: 'Two Layer MCP',
          servers: {
            srv: {
              type: 'http',
              url: 'https://mcp.example.com',
              tools: {
                'tool-1': {},
                'tool-2': {},
                'tool-3': {},
              },
            },
          },
        },
      });

      // Agent further narrows to only tool-1 and tool-2 (using namespaced names)
      await agentsStore?.create({
        agent: {
          id: 'agent-two-layer',
          name: 'Two Layer Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          mcpClients: {
            'two-layer-mcp': {
              tools: {
                'srv_tool-1': {},
                'srv_tool-2': {},
              },
            },
          },
        },
      });

      mockListTools.mockResolvedValue({
        'srv_tool-1': { description: 'Tool 1', execute: vi.fn() },
        'srv_tool-2': { description: 'Tool 2', execute: vi.fn() },
        'srv_tool-3': { description: 'Tool 3', execute: vi.fn() },
        'srv_tool-4': { description: 'Tool 4', execute: vi.fn() },
      });

      const agent = await editor.agent.getById('agent-two-layer');
      expect(agent).toBeInstanceOf(Agent);

      const tools = await agent!.listTools();
      // tool-1 and tool-2: pass both server-level and agent-level filters
      expect(tools['srv_tool-1']).toBeDefined();
      expect(tools['srv_tool-2']).toBeDefined();
      // tool-3: passes server-level filter but blocked by agent-level filter
      expect(tools['srv_tool-3']).toBeUndefined();
      // tool-4: blocked at server-level already
      expect(tools['srv_tool-4']).toBeUndefined();
    });

    it('should let agent description override take precedence over server-level description', async () => {
      const mcpStore = await storage.getStore('mcpClients');
      const agentsStore = await storage.getStore('agents');

      // Server defines description overrides for its exposed tools
      await mcpStore?.create({
        mcpClient: {
          id: 'desc-layered-mcp',
          name: 'Description Layered MCP',
          servers: {
            srv: {
              type: 'http',
              url: 'https://mcp.example.com',
              tools: {
                'tool-a': { description: 'Server-level description for A' },
                'tool-b': { description: 'Server-level description for B' },
                'tool-c': {},
              },
            },
          },
        },
      });

      // Agent overrides tool-b description; tool-a keeps server-level description; tool-c keeps original
      await agentsStore?.create({
        agent: {
          id: 'agent-desc-layered',
          name: 'Desc Layered Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          mcpClients: {
            'desc-layered-mcp': {
              tools: {
                'srv_tool-a': {},
                'srv_tool-b': { description: 'Agent override for B' },
                'srv_tool-c': {},
              },
            },
          },
        },
      });

      mockListTools.mockResolvedValue({
        'srv_tool-a': { description: 'Original A', execute: vi.fn() },
        'srv_tool-b': { description: 'Original B', execute: vi.fn() },
        'srv_tool-c': { description: 'Original C', execute: vi.fn() },
      });

      const agent = await editor.agent.getById('agent-desc-layered');
      expect(agent).toBeInstanceOf(Agent);

      const tools = await agent!.listTools();
      // tool-a: agent has no description override → falls through to server-level description
      expect(tools['srv_tool-a'].description).toBe('Server-level description for A');
      // tool-b: agent has description override → takes precedence
      expect(tools['srv_tool-b'].description).toBe('Agent override for B');
      // tool-c: neither agent nor server-level has description override → keeps original
      expect(tools['srv_tool-c'].description).toBe('Original C');
    });

    it('should filter per-server independently for multi-server clients', async () => {
      const mcpStore = await storage.getStore('mcpClients');
      const agentsStore = await storage.getStore('agents');

      // MCP client with two servers, each with different tool filters
      await mcpStore?.create({
        mcpClient: {
          id: 'multi-srv-mcp',
          name: 'Multi Server MCP',
          servers: {
            alpha: {
              type: 'http',
              url: 'https://alpha.example.com',
              tools: { 'tool-x': {} }, // only expose tool-x from alpha
            },
            beta: {
              type: 'http',
              url: 'https://beta.example.com',
              // no tools filter → expose all from beta
            },
          },
        },
      });

      await agentsStore?.create({
        agent: {
          id: 'agent-multi-srv',
          name: 'Multi Server Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          mcpClients: {
            'multi-srv-mcp': { tools: {} }, // all tools (no agent-level filter)
          },
        },
      });

      mockListTools.mockResolvedValue({
        'alpha_tool-x': { description: 'Alpha X', execute: vi.fn() },
        'alpha_tool-y': { description: 'Alpha Y', execute: vi.fn() },
        'beta_tool-m': { description: 'Beta M', execute: vi.fn() },
        'beta_tool-n': { description: 'Beta N', execute: vi.fn() },
      });

      const agent = await editor.agent.getById('agent-multi-srv');
      expect(agent).toBeInstanceOf(Agent);

      const tools = await agent!.listTools();
      // alpha: only tool-x allowed by server-level filter
      expect(tools['alpha_tool-x']).toBeDefined();
      expect(tools['alpha_tool-y']).toBeUndefined();
      // beta: no server-level filter, all tools exposed
      expect(tools['beta_tool-m']).toBeDefined();
      expect(tools['beta_tool-n']).toBeDefined();
    });

    it('should not apply server-level filter for code-defined MCP servers', async () => {
      // Code-defined MCP servers don't have stored client records,
      // so server-level filtering doesn't apply — only agent-level filtering
      const codeServer = new TestMCPServer({
        id: 'code-no-client-filter',
        name: 'Code Server',
        version: '1.0.0',
        tools: {
          'code-tool-1': vi.fn(),
          'code-tool-2': vi.fn(),
          'code-tool-3': vi.fn(),
        },
      });

      const freshStorage = createTestStorage();
      const freshEditor = new MastraEditor();
      const freshMastra = new Mastra({
        storage: freshStorage,
        editor: freshEditor,
        mcpServers: { 'code-no-client-filter': codeServer },
      });
      await freshMastra.getStorage()?.init();

      const agentsStore = await freshStorage.getStore('agents');

      // Agent filters to only 2 tools from the code-defined server
      await agentsStore?.create({
        agent: {
          id: 'agent-code-no-client-filter',
          name: 'Code Filter Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          mcpClients: {
            'code-no-client-filter': {
              tools: {
                'code-tool-1': {},
                'code-tool-3': {},
              },
            },
          },
        },
      });

      const agent = await freshEditor.agent.getById('agent-code-no-client-filter');
      expect(agent).toBeInstanceOf(Agent);

      const tools = await agent!.listTools();
      expect(tools['code-tool-1']).toBeDefined();
      expect(tools['code-tool-3']).toBeDefined();
      expect(tools['code-tool-2']).toBeUndefined();
    });
  });

  describe('conditional mcpClients', () => {
    it('should resolve conditional mcpClients based on request context', async () => {
      const codeServer = new TestMCPServer({
        id: 'premium-server',
        name: 'Premium Server',
        version: '1.0.0',
        tools: {
          'premium-tool': vi.fn(),
        } as any,
      });

      const freshStorage = createTestStorage();
      const freshEditor = new MastraEditor();
      const freshMastra = new Mastra({
        storage: freshStorage,
        editor: freshEditor,
        mcpServers: { 'premium-server': codeServer },
      });
      await freshMastra.getStorage()?.init();

      const mcpStore = await freshStorage.getStore('mcpClients');
      const agentsStore = await freshStorage.getStore('agents');

      // Create a stored MCP client (always available)
      await mcpStore?.create({
        mcpClient: {
          id: 'base-mcp',
          name: 'Base MCP',
          servers: {
            srv: { type: 'http', url: 'https://base.example.com' },
          },
        },
      });

      // Create agent with conditional mcpClients
      await agentsStore?.create({
        agent: {
          id: 'conditional-mcp-agent',
          name: 'Conditional MCP Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          mcpClients: [
            {
              // Premium users get the premium server
              value: {
                'premium-server': { tools: { 'premium-tool': {} } },
              },
              rules: {
                operator: 'AND' as const,
                conditions: [{ field: 'tier', operator: 'equals' as const, value: 'premium' }],
              },
            },
            {
              // Everyone gets the base MCP client (no rules = unconditional)
              value: {
                'base-mcp': { tools: {} },
              },
            },
          ],
        },
      });

      // Mock the stored MCP client's tools
      mockListTools.mockResolvedValue({
        'base-tool-1': { description: 'Base Tool 1', execute: vi.fn() },
        'base-tool-2': { description: 'Base Tool 2', execute: vi.fn() },
      });

      const agent = await freshEditor.agent.getById('conditional-mcp-agent');
      expect(agent).toBeInstanceOf(Agent);

      // With premium tier → both premium-server and base-mcp tools
      const premiumCtx = new RequestContext([['tier', 'premium']]);
      const premiumTools = await agent!.listTools({ requestContext: premiumCtx });
      expect(premiumTools['premium-tool']).toBeDefined();
      expect(premiumTools['premium-tool'].description).toBe('Tool: premium-tool');
      expect(premiumTools['base-tool-1']).toBeDefined();
      expect(premiumTools['base-tool-2']).toBeDefined();

      // With no context → only base-mcp tools (premium rule doesn't match)
      const defaultCtx = new RequestContext();
      const defaultTools = await agent!.listTools({ requestContext: defaultCtx });
      expect(defaultTools['premium-tool']).toBeUndefined();
      expect(defaultTools['base-tool-1']).toBeDefined();
      expect(defaultTools['base-tool-2']).toBeDefined();
    });

    it('should combine conditional mcpClients with static tools', async () => {
      const codeServer = new TestMCPServer({
        id: 'conditional-server',
        name: 'Conditional Server',
        version: '1.0.0',
        tools: {
          'server-tool': vi.fn(),
        } as any,
      });

      const freshStorage = createTestStorage();
      const freshEditor = new MastraEditor();
      const freshMastra = new Mastra({
        storage: freshStorage,
        editor: freshEditor,
        mcpServers: { 'conditional-server': codeServer },
        tools: {
          'regular-tool': {
            id: 'regular-tool',
            description: 'A regular tool',
            inputSchema: {} as any,
            execute: vi.fn(),
          } as any,
        },
      });
      await freshMastra.getStorage()?.init();

      const agentsStore = await freshStorage.getStore('agents');

      await agentsStore?.create({
        agent: {
          id: 'mixed-conditional-agent',
          name: 'Mixed Agent',
          instructions: 'Test',
          model: { provider: 'openai', name: 'gpt-4' },
          // Static tools (non-conditional)
          tools: { 'regular-tool': {} },
          // Conditional mcpClients
          mcpClients: [
            {
              value: {
                'conditional-server': { tools: {} },
              },
              rules: {
                operator: 'AND' as const,
                conditions: [{ field: 'env', operator: 'equals' as const, value: 'production' }],
              },
            },
          ],
        },
      });

      const agent = await freshEditor.agent.getById('mixed-conditional-agent');
      expect(agent).toBeInstanceOf(Agent);

      // In production: regular tool + server tool
      const prodCtx = new RequestContext([['env', 'production']]);
      const prodTools = await agent!.listTools({ requestContext: prodCtx });
      expect(prodTools['regular-tool']).toBeDefined();
      expect(prodTools['server-tool']).toBeDefined();

      // In development: only regular tool (conditional mcpClients not matched)
      const devCtx = new RequestContext([['env', 'development']]);
      const devTools = await agent!.listTools({ requestContext: devCtx });
      expect(devTools['regular-tool']).toBeDefined();
      expect(devTools['server-tool']).toBeUndefined();
    });
  });
});
