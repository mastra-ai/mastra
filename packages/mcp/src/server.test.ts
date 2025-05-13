import http from 'node:http';
import path from 'path';
import type { ServerType } from '@hono/node-server';
import { serve } from '@hono/node-server';
import type { ToolsInput } from '@mastra/core/agent';
import type { MCPServerConfig, Repository, PackageInfo, RemoteInfo } from '@mastra/core/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { Hono } from 'hono';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { weatherTool } from './__fixtures__/tools';
import { MCPClient } from './configuration';
import { MCPServer } from './server';

const PORT = 9100 + Math.floor(Math.random() * 1000);
let server: MCPServer;
let httpServer: http.Server;

vi.setConfig({ testTimeout: 20000, hookTimeout: 20000 });

// Mock Date constructor for predictable release dates
const mockDateISO = '2024-01-01T00:00:00.000Z';
const mockDate = new Date(mockDateISO);
const OriginalDate = global.Date; // Store original Date

// Mock a simple tool
const mockToolExecute = vi.fn(async (args: any) => ({ result: 'tool executed', args }));
const mockTools: ToolsInput = {
  testTool: {
    description: 'A test tool',
    parameters: z.object({ input: z.string().optional() }),
    execute: mockToolExecute,
  },
};

const minimalConfig: MCPServerConfig = {
  name: 'TestServer',
  version: '1.0.0',
  tools: mockTools,
};

describe('MCPServer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // @ts-ignore - Mocking Date completely
    global.Date = vi.fn((...args: any[]) => {
      if (args.length === 0) {
        // new Date()
        return mockDate;
      }
      // @ts-ignore
      return new OriginalDate(...args); // new Date('some-string') or new Date(timestamp)
    }) as any;

    // @ts-ignore
    global.Date.now = vi.fn(() => mockDate.getTime());
    // @ts-ignore
    global.Date.prototype.toISOString = vi.fn(() => mockDateISO);
    // @ts-ignore // Static Date.toISOString() might be used by some libraries
    global.Date.toISOString = vi.fn(() => mockDateISO);
  });

  describe('Constructor and Metadata Initialization', () => {
    it('should initialize with default metadata if not provided', () => {
      const server = new MCPServer(minimalConfig);
      expect(server.id).toBeDefined();
      expect(server.name).toBe('TestServer');
      expect(server.version).toBe('1.0.0');
      expect(server.description).toBeUndefined();
      expect(server.repository).toBeUndefined();
      // MCPServerBase stores releaseDate as string, compare directly or re-parse
      expect(server.releaseDate).toBe(mockDateISO);
      expect(server.isLatest).toBe(true);
      expect(server.packageCanonical).toBeUndefined();
      expect(server.packages).toBeUndefined();
      expect(server.remotes).toBeUndefined();
    });

    it('should initialize with custom metadata when provided', () => {
      const repository: Repository = { url: 'https://github.com/test/repo', source: 'github', id: 'repo-id' };
      const packages: PackageInfo[] = [{ registry_name: 'npm', name: 'test-package', version: '1.0.0' }];
      const remotes: RemoteInfo[] = [{ transport_type: 'sse', url: 'https://test.com/sse' }];
      const customReleaseDate = '2023-12-31T00:00:00.000Z';
      const customConfig: MCPServerConfig = {
        ...minimalConfig,
        id: 'custom-id-doesnt-need-uuid-format-if-set-explicitly',
        description: 'A custom server description',
        repository,
        releaseDate: customReleaseDate,
        isLatest: false,
        packageCanonical: 'npm',
        packages,
        remotes,
      };
      const server = new MCPServer(customConfig);

      expect(server.id).toBe('custom-id-doesnt-need-uuid-format-if-set-explicitly');
      expect(server.description).toBe('A custom server description');
      expect(server.repository).toEqual(repository);
      expect(server.releaseDate).toBe(customReleaseDate);
      expect(server.isLatest).toBe(false);
      expect(server.packageCanonical).toBe('npm');
      expect(server.packages).toEqual(packages);
      expect(server.remotes).toEqual(remotes);
    });
  });

  describe('getServerInfo()', () => {
    it('should return correct ServerInfo with default metadata', () => {
      const server = new MCPServer(minimalConfig);
      const serverInfo = server.getServerInfo();

      expect(serverInfo).toEqual({
        id: expect.any(String),
        name: 'TestServer',
        description: undefined,
        repository: undefined,
        version_detail: {
          version: '1.0.0',
          release_date: mockDateISO,
          is_latest: true,
        },
      });
    });

    it('should return correct ServerInfo with custom metadata', () => {
      const repository: Repository = { url: 'https://github.com/test/repo', source: 'github', id: 'repo-id' };
      const customReleaseDate = '2023-11-01T00:00:00.000Z';
      const customConfig: MCPServerConfig = {
        ...minimalConfig,
        id: 'custom-id-for-info',
        description: 'Custom description',
        repository,
        releaseDate: customReleaseDate,
        isLatest: false,
      };
      const server = new MCPServer(customConfig);
      const serverInfo = server.getServerInfo();

      expect(serverInfo).toEqual({
        id: 'custom-id-for-info',
        name: 'TestServer',
        description: 'Custom description',
        repository,
        version_detail: {
          version: '1.0.0',
          release_date: customReleaseDate,
          is_latest: false,
        },
      });
    });
  });

  describe('getServerDetail()', () => {
    it('should return correct ServerDetailInfo with default metadata', () => {
      const server = new MCPServer(minimalConfig);
      const serverDetail = server.getServerDetail();

      expect(serverDetail).toEqual({
        id: expect.any(String),
        name: 'TestServer',
        description: undefined,
        repository: undefined,
        version_detail: {
          version: '1.0.0',
          release_date: mockDateISO,
          is_latest: true,
        },
        package_canonical: undefined,
        packages: undefined,
        remotes: undefined,
      });
    });

    it('should return correct ServerDetailInfo with custom metadata', () => {
      const repository: Repository = { url: 'https://github.com/test/repo', source: 'github', id: 'repo-id' };
      const packages: PackageInfo[] = [{ registry_name: 'npm', name: 'test-package', version: '1.0.0' }];
      const remotes: RemoteInfo[] = [{ transport_type: 'sse', url: 'https://test.com/sse' }];
      const customReleaseDate = '2023-10-01T00:00:00.000Z';
      const customConfig: MCPServerConfig = {
        ...minimalConfig,
        id: 'custom-id-for-detail',
        description: 'Custom detail description',
        repository,
        releaseDate: customReleaseDate,
        isLatest: true,
        packageCanonical: 'docker',
        packages,
        remotes,
      };
      const server = new MCPServer(customConfig);
      const serverDetail = server.getServerDetail();

      expect(serverDetail).toEqual({
        id: 'custom-id-for-detail',
        name: 'TestServer',
        description: 'Custom detail description',
        repository,
        version_detail: {
          version: '1.0.0',
          release_date: customReleaseDate,
          is_latest: true,
        },
        package_canonical: 'docker',
        packages,
        remotes,
      });
    });
  });

  describe('MCPServer SSE transport', () => {
    let sseRes: Response | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;

    beforeAll(async () => {
      server = new MCPServer({
        name: 'Test MCP Server',
        version: '0.1.0',
        tools: { weatherTool },
      });

      httpServer = http.createServer(async (req, res) => {
        const url = new URL(req.url || '', `http://localhost:${PORT}`);
        await server.startSSE({
          url,
          ssePath: '/sse',
          messagePath: '/message',
          req,
          res,
        });
      });

      await new Promise<void>(resolve => httpServer.listen(PORT, () => resolve()));
    });

    afterAll(async () => {
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    });

    afterEach(async () => {
      if (reader) {
        try {
          await reader.cancel();
        } catch {}
        reader = undefined;
      }
      if (sseRes && 'body' in sseRes && sseRes.body) {
        try {
          await sseRes.body.cancel();
        } catch {}
        sseRes = undefined;
      }
    });

    it('should parse SSE stream and contain tool output', async () => {
      sseRes = await fetch(`http://localhost:${PORT}/sse`, {
        headers: { Accept: 'text/event-stream' },
      });
      expect(sseRes.status).toBe(200);
      reader = sseRes.body?.getReader();
      expect(reader).toBeDefined();
      await fetch(`http://localhost:${PORT}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'weatherTool', input: { location: 'Austin' } }),
      });
      if (reader) {
        const { value } = await reader.read();
        const text = value ? new TextDecoder().decode(value) : '';
        expect(text).toMatch(/data:/);
      }
    });

    it('should return 503 if message sent before SSE connection', async () => {
      (server as any).sseTransport = undefined;
      const res = await fetch(`http://localhost:${PORT}/message`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tool: 'weatherTool', input: { location: 'Austin' } }),
      });
      expect(res.status).toBe(503);
    });
  });

  describe('MCPServer stdio transport', () => {
    it('should connect and expose stdio transport', async () => {
      await server.startStdio();
      expect(server.getStdioTransport()).toBeInstanceOf(StdioServerTransport);
    });
    it('should use stdio transport to get tools', async () => {
      const existingConfig = new MCPClient({
        servers: {
          weather: {
            command: 'npx',
            args: ['-y', 'tsx', path.join(__dirname, '__fixtures__/server-weather.ts')],
            env: {
              FAKE_CREDS: 'test',
            },
          },
        },
      });

      const tools = await existingConfig.getTools();
      expect(Object.keys(tools).length).toBeGreaterThan(0);
      expect(Object.keys(tools)[0]).toBe('weather_weatherTool');
      await existingConfig.disconnect();
    });
  });
  describe('MCPServer HTTP Transport', () => {
    let server: MCPServer;
    let client: MCPClient;
    const PORT = 9200 + Math.floor(Math.random() * 1000);

    beforeAll(async () => {
      server = new MCPServer({
        name: 'Test MCP Server',
        version: '0.1.0',
        tools: { weatherTool },
      });

      httpServer = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
        const url = new URL(req.url || '', `http://localhost:${PORT}`);
        await server.startHTTP({
          url,
          httpPath: '/http',
          req,
          res,
          options: {
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
          },
        });
      });

      await new Promise<void>(resolve => httpServer.listen(PORT, () => resolve()));

      client = new MCPClient({
        servers: {
          local: {
            url: new URL(`http://localhost:${PORT}/http`),
          },
        },
      });
    });

    afterAll(async () => {
      httpServer.closeAllConnections?.();
      await new Promise<void>(resolve =>
        httpServer.close(() => {
          resolve();
        }),
      );
      await server.close();
    });

    it('should return 404 for wrong path', async () => {
      const res = await fetch(`http://localhost:${PORT}/wrong`);
      expect(res.status).toBe(404);
    });

    it('should respond to HTTP request using client', async () => {
      const tools = await client.getTools();
      const tool = tools['local_weatherTool'];
      expect(tool).toBeDefined();

      // Call the tool
      const result = await tool.execute({ context: { location: 'Austin' } });

      // Check the result
      expect(result).toBeDefined();
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content.length).toBeGreaterThan(0);

      const toolOutput = result.content[0];
      expect(toolOutput.type).toBe('text');
      const toolResult = JSON.parse(toolOutput.text);
      expect(toolResult.location).toEqual('Austin');
      expect(toolResult).toHaveProperty('temperature');
      expect(toolResult).toHaveProperty('feelsLike');
      expect(toolResult).toHaveProperty('humidity');
      expect(toolResult).toHaveProperty('conditions');
      expect(toolResult).toHaveProperty('windSpeed');
      expect(toolResult).toHaveProperty('windGust');
    });
  });

  describe('MCPServer Hono SSE Transport', () => {
    let server: MCPServer;
    let hono: Hono;
    let honoServer: ServerType;
    let client: MCPClient;
    const PORT = 9300 + Math.floor(Math.random() * 1000);

    beforeAll(async () => {
      server = new MCPServer({
        name: 'Test MCP Server',
        version: '0.1.0',
        tools: { weatherTool },
      });

      hono = new Hono();

      hono.get('/sse', async c => {
        const url = new URL(c.req.url, `http://localhost:${PORT}`);
        return await server.startHonoSSE({
          url,
          ssePath: '/sse',
          messagePath: '/message',
          context: c,
        });
      });

      hono.post('/message', async c => {
        // Use MCPServer's startHonoSSE to handle message endpoint
        const url = new URL(c.req.url, `http://localhost:${PORT}`);
        return await server.startHonoSSE({
          url,
          ssePath: '/sse',
          messagePath: '/message',
          context: c,
        });
      });

      honoServer = serve({ fetch: hono.fetch, port: PORT });

      // Initialize MCPClient with SSE endpoint
      client = new MCPClient({
        servers: {
          local: {
            url: new URL(`http://localhost:${PORT}/sse`),
          },
        },
      });
    });

    afterAll(async () => {
      honoServer.close();
      await server.close();
    });

    it('should respond to SSE connection and tool call', async () => {
      // Get tools from the client
      const tools = await client.getTools();
      const tool = tools['local_weatherTool'];
      expect(tool).toBeDefined();

      // Call the tool using the MCPClient (SSE transport)
      const result = await tool.execute({ context: { location: 'Austin' } });

      expect(result).toBeDefined();
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content.length).toBeGreaterThan(0);

      const toolOutput = result.content[0];
      expect(toolOutput.type).toBe('text');
      const toolResult = JSON.parse(toolOutput.text);
      expect(toolResult.location).toEqual('Austin');
      expect(toolResult).toHaveProperty('temperature');
      expect(toolResult).toHaveProperty('feelsLike');
      expect(toolResult).toHaveProperty('humidity');
      expect(toolResult).toHaveProperty('conditions');
      expect(toolResult).toHaveProperty('windSpeed');
      expect(toolResult).toHaveProperty('windGust');
    });
  });
});
