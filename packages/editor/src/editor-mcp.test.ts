import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { Agent, Mastra } from '@mastra/core';
import { MCPServerBase } from '@mastra/core/mcp';
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
  async startHonoSSE() { return undefined; }
  async startHTTP() {}
  async close() {}
  getServerInfo() { return {} as any; }
  getServerDetail() { return {} as any; }
  getToolListInfo() { return { tools: [] }; }
  getToolInfo() { return undefined; }
  async executeTool() { return {}; }
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
      // Create via editor namespace
      await editor.mcp.create({
        id: 'mcp-update',
        name: 'Original Name',
        servers: {
          srv: { type: 'http', url: 'https://example.com/mcp' },
        },
      });

      const updated = await editor.mcp.update({
        id: 'mcp-update',
        name: 'Updated Name',
      });

      expect(updated.name).toBe('Updated Name');

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
      await mcpStore?.create({
        mcpClient: {
          id: 'mcp-b',
          name: 'Client B',
          servers: { srv: { type: 'http', url: 'https://b.example.com' } },
        },
      });

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
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('nonexistent-mcp'),
    );
  });

  it('should include all tools when tools config is omitted (empty object)', async () => {
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
          'all-tools-mcp': {},  // no tools key → include everything
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

  it('should resolve tools from code-defined MCP server with all tools (empty config)', async () => {
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
          'all-server': {},  // include all tools
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
          'code-srv': {},  // all tools from code server
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

    // Update the MCP client via editor namespace
    await editor.mcp.update({
      id: 'updatable-mcp',
      name: 'Updated MCP',
      servers: {
        srv: { type: 'http', url: 'https://updated.example.com' },
      },
    });

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

    // Update to create v2
    await mcpStore?.update({
      id: 'versioned-mcp',
      name: 'Version 2',
      servers: {
        srv: { type: 'http', url: 'https://v2.example.com' },
      },
    });

    // Update to create v3
    await mcpStore?.update({
      id: 'versioned-mcp',
      name: 'Version 3',
      servers: {
        'srv-a': { type: 'http', url: 'https://v3a.example.com' },
        'srv-b': { type: 'stdio', command: 'node', args: ['server.js'] },
      },
    });

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
});


