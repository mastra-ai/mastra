import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { randomUUID } from 'crypto';
import { Mastra } from '@mastra/core';
import { MCPServerBase } from '@mastra/core/mcp';
import { createTool } from '@mastra/core/tools';
import { MCPServer } from '@mastra/mcp';
import { LibSQLStore } from '@mastra/libsql';
import { z } from 'zod';
import { MastraEditor } from './index';

const createTestStorage = () => {
  return new LibSQLStore({
    id: `test-${randomUUID()}`,
    url: ':memory:',
  });
};

const weatherTool = createTool({
  id: 'getWeather',
  description: 'Gets the current weather for a location',
  inputSchema: z.object({
    location: z.string(),
  }),
  execute: async ({ location }) => ({
    temperature: 72,
    condition: `Sunny in ${location}`,
  }),
});

const calculatorTool = createTool({
  id: 'calculate',
  description: 'Performs basic calculations',
  inputSchema: z.object({
    operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
    a: z.number(),
    b: z.number(),
  }),
  execute: async ({ operation, a, b }) => {
    let result = 0;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        result = a / b;
        break;
    }
    return { result };
  },
});

describe('EditorMCPServerNamespace', () => {
  let storage: LibSQLStore;
  let editor: MastraEditor;
  let mastra: Mastra;

  beforeEach(async () => {
    storage = createTestStorage();
    editor = new MastraEditor();
    mastra = new Mastra({
      storage,
      editor,
      tools: {
        getWeather: weatherTool,
        calculate: calculatorTool,
      },
    });
    await mastra.getStorage()?.init();
  });

  afterEach(async () => {
    const mcpServerStore = await storage.getStore('mcpServers');
    await mcpServerStore?.dangerouslyClearAll();
  });

  describe('CRUD operations', () => {
    it('should create and retrieve an MCP server config', async () => {
      const server = await editor.mcpServer.create({
        id: 'my-server',
        name: 'My Server',
        version: '1.0.0',
        description: 'A test MCP server',
        tools: {
          getWeather: {},
          calculate: {},
        },
      });

      expect(server).toBeDefined();
      expect(server).toBeInstanceOf(MCPServerBase);
      expect(server.id).toBe('my-server');
      expect(server.name).toBe('My Server');
    });

    it('should retrieve an MCP server by ID', async () => {
      await editor.mcpServer.create({
        id: 'retrieve-test',
        name: 'Retrieve Test',
        version: '1.0.0',
        tools: { getWeather: {} },
      });

      const server = await editor.mcpServer.getById('retrieve-test');
      expect(server).toBeDefined();
      expect(server!.id).toBe('retrieve-test');
      expect(server!.name).toBe('Retrieve Test');
    });

    it('should delete an MCP server', async () => {
      await editor.mcpServer.create({
        id: 'delete-test',
        name: 'Delete Test',
        version: '1.0.0',
        tools: { getWeather: {} },
      });

      await editor.mcpServer.delete('delete-test');
      const server = await editor.mcpServer.getById('delete-test');
      expect(server).toBeNull();
    });

    it('should list MCP servers', async () => {
      await editor.mcpServer.create({
        id: 'list-test-1',
        name: 'Server 1',
        version: '1.0.0',
        tools: { getWeather: {} },
      });
      await editor.mcpServer.update({
        id: 'list-test-1',
        status: 'published',
      });

      await editor.mcpServer.create({
        id: 'list-test-2',
        name: 'Server 2',
        version: '2.0.0',
        tools: { calculate: {} },
      });
      await editor.mcpServer.update({
        id: 'list-test-2',
        status: 'published',
      });

      const result = await editor.mcpServer.list({});
      expect(result.mcpServers.length).toBe(2);
    });
  });

  describe('hydration – resolving tools from Mastra registry', () => {
    it('should hydrate with tools resolved from Mastra', async () => {
      const server = await editor.mcpServer.create({
        id: 'hydrate-tools',
        name: 'Hydrated Server',
        version: '1.0.0',
        tools: {
          getWeather: {},
          calculate: {},
        },
      });

      const tools = server.tools();
      expect(Object.keys(tools)).toContain('getWeather');
      expect(Object.keys(tools)).toContain('calculate');
    });

    it('should hydrate with a subset of tools', async () => {
      const server = await editor.mcpServer.create({
        id: 'subset-tools',
        name: 'Subset Server',
        version: '1.0.0',
        tools: {
          getWeather: {},
        },
      });

      const tools = server.tools();
      expect(Object.keys(tools)).toContain('getWeather');
      expect(Object.keys(tools)).not.toContain('calculate');
    });

    it('should apply description overrides from stored config', async () => {
      const server = await editor.mcpServer.create({
        id: 'desc-override',
        name: 'Override Server',
        version: '1.0.0',
        tools: {
          getWeather: { description: 'Custom weather description' },
        },
      });

      const tools = server.tools();
      expect(tools['getWeather']).toBeDefined();
      expect(tools['getWeather'].description).toBe('Custom weather description');
    });

    it('should warn when a referenced tool is not registered', async () => {
      const warnSpy = vi.fn();
      const freshStorage = createTestStorage();
      const freshEditor = new MastraEditor({
        logger: {
          warn: warnSpy,
          info: vi.fn(),
          debug: vi.fn(),
          error: vi.fn(),
          child: vi.fn().mockReturnThis(),
          trackException: vi.fn(),
        } as any,
      });
      const _mastra = new Mastra({
        storage: freshStorage,
        editor: freshEditor,
        tools: { getWeather: weatherTool },
      });
      await freshStorage.init();

      const server = await freshEditor.mcpServer.create({
        id: 'missing-tool',
        name: 'Missing Tool Server',
        version: '1.0.0',
        tools: {
          getWeather: {},
          nonExistentTool: {},
        },
      });

      const tools = server.tools();
      expect(Object.keys(tools)).toContain('getWeather');
      expect(Object.keys(tools)).not.toContain('nonExistentTool');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('nonExistentTool'));
    });

    it('should hydrate with no tools when none are referenced', async () => {
      const server = await editor.mcpServer.create({
        id: 'no-tools',
        name: 'Empty Server',
        version: '1.0.0',
        tools: {},
      });

      const tools = server.tools();
      expect(Object.keys(tools).length).toBe(0);
    });

    it('should register the hydrated server with Mastra', async () => {
      await editor.mcpServer.create({
        id: 'registered-server',
        name: 'Registered Server',
        version: '1.0.0',
        tools: { getWeather: {} },
      });

      const registeredServer = mastra.getMCPServer('registered-server');
      expect(registeredServer).toBeDefined();
      expect(registeredServer!.name).toBe('Registered Server');
    });

    it('should return the same cached instance on subsequent getById calls', async () => {
      await editor.mcpServer.create({
        id: 'cached-server',
        name: 'Cached Server',
        version: '1.0.0',
        tools: { getWeather: {} },
      });

      const first = await editor.mcpServer.getById('cached-server');
      const second = await editor.mcpServer.getById('cached-server');
      expect(first).toBe(second);
    });

    it('should return a fresh instance after clearCache', async () => {
      await editor.mcpServer.create({
        id: 'cache-clear',
        name: 'Cache Clear Server',
        version: '1.0.0',
        tools: { getWeather: {} },
      });

      const first = await editor.mcpServer.getById('cache-clear');
      await editor.mcpServer.clearCache();
      const second = await editor.mcpServer.getById('cache-clear');

      expect(first).not.toBe(second);
      expect(first!.name).toBe(second!.name);
    });
  });

  describe('tool execution on hydrated server', () => {
    it('should execute the weather tool and return results', async () => {
      const server = await editor.mcpServer.create({
        id: 'exec-weather',
        name: 'Exec Weather Server',
        version: '1.0.0',
        tools: { getWeather: {} },
      });

      const tools = server.tools();
      expect(tools['getWeather']).toBeDefined();
      expect(tools['getWeather'].execute).toBeTypeOf('function');

      const result = await tools['getWeather'].execute!({ location: 'Austin' }, {} as any);
      expect(result).toEqual({
        temperature: 72,
        condition: 'Sunny in Austin',
      });
    });

    it('should execute the calculator tool and return results', async () => {
      const server = await editor.mcpServer.create({
        id: 'exec-calc',
        name: 'Exec Calc Server',
        version: '1.0.0',
        tools: { calculate: {} },
      });

      const tools = server.tools();
      expect(tools['calculate']).toBeDefined();
      expect(tools['calculate'].execute).toBeTypeOf('function');

      const result = await tools['calculate'].execute!({ operation: 'multiply', a: 6, b: 7 }, {} as any);
      expect(result).toEqual({ result: 42 });
    });

    it('should execute tools with description overrides', async () => {
      const server = await editor.mcpServer.create({
        id: 'exec-override',
        name: 'Override Exec Server',
        version: '1.0.0',
        tools: {
          getWeather: { description: 'Overridden weather' },
        },
      });

      const tools = server.tools();
      // The description is overridden but the execute function still works
      expect(tools['getWeather'].description).toBe('Overridden weather');

      const result = await tools['getWeather'].execute!({ location: 'NYC' }, {} as any);
      expect(result).toEqual({
        temperature: 72,
        condition: 'Sunny in NYC',
      });
    });

    it('should execute multiple tools on the same server', async () => {
      const server = await editor.mcpServer.create({
        id: 'exec-multi',
        name: 'Multi Tool Server',
        version: '1.0.0',
        tools: {
          getWeather: {},
          calculate: {},
        },
      });

      const tools = server.tools();

      const weatherResult = await tools['getWeather'].execute!({ location: 'London' }, {} as any);
      expect(weatherResult).toEqual({
        temperature: 72,
        condition: 'Sunny in London',
      });

      const calcResult = await tools['calculate'].execute!({ operation: 'add', a: 10, b: 20 }, {} as any);
      expect(calcResult).toEqual({ result: 30 });
    });

    it('should produce a real MCPServer instance (not just MCPServerBase)', async () => {
      const server = await editor.mcpServer.create({
        id: 'real-instance',
        name: 'Real MCPServer',
        version: '1.0.0',
        tools: { getWeather: {} },
      });

      // The hydrated server is a real MCPServer, not just MCPServerBase
      expect(server).toBeInstanceOf(MCPServer);
      expect(server).toBeInstanceOf(MCPServerBase);
    });
  });

  describe('update and re-hydrate', () => {
    it('should update server config and re-hydrate with new tools', async () => {
      // Create initial server with only getWeather
      const initial = await editor.mcpServer.create({
        id: 'update-test',
        name: 'Initial Server',
        version: '1.0.0',
        tools: { getWeather: {} },
      });

      const initialTools = initial.tools();
      expect(Object.keys(initialTools)).toEqual(['getWeather']);

      // Create a new version with both tools
      const mcpServerStore = await storage.getStore('mcpServers');
      const newVersion = await mcpServerStore!.createVersion({
        id: randomUUID(),
        versionNumber: 2,
        mcpServerId: 'update-test',
        name: 'Updated Server',
        version: '2.0.0',
        tools: {
          getWeather: {},
          calculate: {},
        },
      });

      // Update to the new version
      const updated = await editor.mcpServer.update({
        id: 'update-test',
        activeVersionId: newVersion.id,
      });

      expect(updated!.name).toBe('Updated Server');
      const updatedTools = updated!.tools();
      expect(Object.keys(updatedTools)).toContain('getWeather');
      expect(Object.keys(updatedTools)).toContain('calculate');

      // Both tools should be executable
      const weatherResult = await updatedTools['getWeather'].execute!({ location: 'Tokyo' }, {} as any);
      expect(weatherResult).toEqual({ temperature: 72, condition: 'Sunny in Tokyo' });

      const calcResult = await updatedTools['calculate'].execute!({ operation: 'divide', a: 100, b: 4 }, {} as any);
      expect(calcResult).toEqual({ result: 25 });
    });
  });
});
