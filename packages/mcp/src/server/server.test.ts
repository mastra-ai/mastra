import http from 'node:http';
import path from 'path';
import type { ServerType } from '@hono/node-server';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';
import type { MCPServerConfig, Repository, PackageInfo, RemoteInfo } from '@mastra/core/mcp';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type {
  Resource,
  ResourceTemplate,
  ListResourcesResult,
  ReadResourceResult,
  ListResourceTemplatesResult,
} from '@modelcontextprotocol/sdk/types.js';
import { MockLanguageModelV1 } from 'ai/test';
import { Hono } from 'hono';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { weatherTool } from '../__fixtures__/tools';
import { InternalMastraMCPClient } from '../client/client';
import { MCPClient } from '../client/configuration';
import { MCPServer } from './server';
import type { MCPServerResources, MCPServerResourceContent } from './server';

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

const minimalTestTool: ToolsInput = {
  minTool: {
    description: 'A minimal tool',
    parameters: z.object({}),
    execute: async () => ({ result: 'ok' }),
  },
};

const mockAgentGenerate = vi.fn(async (query: string) => {
  return {
    rawCall: { rawPrompt: null, rawSettings: {} },
    finishReason: 'stop',
    usage: { promptTokens: 10, completionTokens: 20 },
    text: `{"content":"Agent response to: "${JSON.stringify(query)}"}`,
  };
});

const mockAgentGetInstructions = vi.fn(() => 'This is a mock agent for testing.');

const createMockAgent = (name: string, generateFn: any, instructionsFn?: any, description?: string) => {
  return new Agent({
    name: name,
    instructions: instructionsFn,
    description: description || '',
    model: new MockLanguageModelV1({
      defaultObjectGenerationMode: 'json',
      doGenerate: async options => {
        return generateFn((options.prompt.at(-1)?.content[0] as { text: string }).text);
      },
    }),
  });
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

  // Restore original Date after all tests in this describe block
  afterAll(() => {
    global.Date = OriginalDate;
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

  describe('MCPServer Resource Handling', () => {
    let resourceTestServerInstance: MCPServer;
    let localHttpServerForResources: http.Server;
    let resourceTestInternalClient: InternalMastraMCPClient;
    const RESOURCE_TEST_PORT = 9200 + Math.floor(Math.random() * 1000);

    const mockResourceContents: Record<string, MCPServerResourceContent> = {
      'weather://current': {
        text: JSON.stringify({
          location: 'Test City',
          temperature: 22,
          conditions: 'Sunny',
        }),
      },
      'weather://forecast': {
        text: JSON.stringify([
          { day: 1, high: 25, low: 15, conditions: 'Clear' },
          { day: 2, high: 26, low: 16, conditions: 'Cloudy' },
        ]),
      },
      'weather://historical': {
        text: JSON.stringify({ averageHigh: 20, averageLow: 10 }),
      },
    };

    const initialResourcesForTest: Resource[] = [
      {
        uri: 'weather://current',
        name: 'Current Weather Data',
        description: 'Real-time weather data',
        mimeType: 'application/json',
      },
      {
        uri: 'weather://forecast',
        name: 'Weather Forecast',
        description: '5-day weather forecast',
        mimeType: 'application/json',
      },
      {
        uri: 'weather://historical',
        name: 'Historical Weather Data',
        description: 'Past 30 days weather data',
        mimeType: 'application/json',
      },
    ];

    const mockAppResourcesFunctions: MCPServerResources = {
      listResources: async () => initialResourcesForTest,
      getResourceContent: async ({ uri }) => {
        if (mockResourceContents[uri]) {
          return mockResourceContents[uri];
        }
        throw new Error(`Mock resource content not found for ${uri}`);
      },
    };

    beforeAll(async () => {
      resourceTestServerInstance = new MCPServer({
        name: 'ResourceTestServer',
        version: '1.0.0',
        tools: minimalTestTool,
        resources: mockAppResourcesFunctions,
      });

      localHttpServerForResources = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
        const url = new URL(req.url || '', `http://localhost:${RESOURCE_TEST_PORT}`);
        await resourceTestServerInstance.startHTTP({
          url,
          httpPath: '/http',
          req,
          res,
          options: {
            sessionIdGenerator: undefined,
          },
        });
      });

      await new Promise<void>(resolve => localHttpServerForResources.listen(RESOURCE_TEST_PORT, () => resolve()));

      resourceTestInternalClient = new InternalMastraMCPClient({
        name: 'resource-test-internal-client',
        server: {
          url: new URL(`http://localhost:${RESOURCE_TEST_PORT}/http`),
        },
      });
      await resourceTestInternalClient.connect();
    });

    afterAll(async () => {
      await resourceTestInternalClient.disconnect();
      if (localHttpServerForResources) {
        localHttpServerForResources.closeAllConnections?.();
        await new Promise<void>((resolve, reject) => {
          localHttpServerForResources.close(err => {
            if (err) return reject(err);
            resolve();
          });
        });
      }
      if (resourceTestServerInstance) {
        await resourceTestServerInstance.close();
      }
    });

    it('should list available resources', async () => {
      const result = (await resourceTestInternalClient.listResources()) as ListResourcesResult;
      expect(result).toBeDefined();
      expect(result.resources.length).toBe(initialResourcesForTest.length);
      initialResourcesForTest.forEach(mockResource => {
        expect(result.resources).toContainEqual(expect.objectContaining(mockResource));
      });
    });

    it('should read content for weather://current', async () => {
      const uri = 'weather://current';
      const resourceContentResult = (await resourceTestInternalClient.readResource(uri)) as ReadResourceResult;

      expect(resourceContentResult).toBeDefined();
      expect(resourceContentResult.contents).toBeDefined();
      expect(resourceContentResult.contents.length).toBe(1);

      const content = resourceContentResult.contents[0];
      expect(content.uri).toBe(uri);
      expect(content.mimeType).toBe('application/json');
      expect(content.text).toBe((mockResourceContents[uri] as { text: string }).text);
    });

    it('should read content for weather://forecast', async () => {
      const uri = 'weather://forecast';
      const resourceContentResult = (await resourceTestInternalClient.readResource(uri)) as ReadResourceResult;
      expect(resourceContentResult.contents.length).toBe(1);
      const content = resourceContentResult.contents[0];
      expect(content.uri).toBe(uri);
      expect(content.mimeType).toBe('application/json');
      expect(content.text).toBe((mockResourceContents[uri] as { text: string }).text);
    });

    it('should read content for weather://historical', async () => {
      const uri = 'weather://historical';
      const resourceContentResult = (await resourceTestInternalClient.readResource(uri)) as ReadResourceResult;
      expect(resourceContentResult.contents.length).toBe(1);
      const content = resourceContentResult.contents[0];
      expect(content.uri).toBe(uri);
      expect(content.mimeType).toBe('application/json');
      expect(content.text).toBe((mockResourceContents[uri] as { text: string }).text);
    });

    it('should throw an error when reading a non-existent resource URI', async () => {
      const uri = 'weather://nonexistent';
      await expect(resourceTestInternalClient.readResource(uri)).rejects.toThrow(
        'Resource not found: weather://nonexistent',
      );
    });
  });

  describe('MCPServer Resource Handling with Notifications and Templates', () => {
    let notificationTestServer: MCPServer;
    let notificationTestInternalClient: InternalMastraMCPClient;
    let notificationHttpServer: http.Server;
    const NOTIFICATION_PORT = 9400 + Math.floor(Math.random() * 1000);

    const mockInitialResources: Resource[] = [
      {
        uri: 'test://resource/1',
        name: 'Resource 1',
        mimeType: 'text/plain',
      },
      {
        uri: 'test://resource/2',
        name: 'Resource 2',
        mimeType: 'application/json',
      },
    ];

    let mockCurrentResourceContents: Record<string, MCPServerResourceContent> = {
      'test://resource/1': { text: 'Initial content for R1' },
      'test://resource/2': { text: JSON.stringify({ data: 'Initial for R2' }) },
    };

    const mockResourceTemplates: ResourceTemplate[] = [
      {
        uriTemplate: 'test://template/{id}',
        name: 'Test Template',
        description: 'A template for test resources',
      },
    ];

    const getResourceContentCallback = vi.fn(async ({ uri }: { uri: string }) => {
      if (mockCurrentResourceContents[uri]) {
        return mockCurrentResourceContents[uri];
      }
      throw new Error(`Mock content not found for ${uri}`);
    });

    const listResourcesCallback = vi.fn(async () => mockInitialResources);
    const resourceTemplatesCallback = vi.fn(async () => mockResourceTemplates);

    beforeAll(async () => {
      const serverOptions: MCPServerConfig & { resources?: MCPServerResources } = {
        name: 'NotificationTestServer',
        version: '1.0.0',
        tools: minimalTestTool,
        resources: {
          listResources: listResourcesCallback,
          getResourceContent: getResourceContentCallback,
          resourceTemplates: resourceTemplatesCallback,
        },
      };
      notificationTestServer = new MCPServer(serverOptions);

      notificationHttpServer = http.createServer(async (req, res) => {
        const url = new URL(req.url || '', `http://localhost:${NOTIFICATION_PORT}`);
        await notificationTestServer.startSSE({
          url,
          ssePath: '/sse',
          messagePath: '/message',
          req,
          res,
        });
      });
      await new Promise<void>(resolve => notificationHttpServer.listen(NOTIFICATION_PORT, resolve));

      notificationTestInternalClient = new InternalMastraMCPClient({
        name: 'notification-internal-client',
        server: {
          url: new URL(`http://localhost:${NOTIFICATION_PORT}/sse`),
          logger: logMessage =>
            console.log(
              `[${logMessage.serverName} - ${logMessage.level.toUpperCase()}]: ${logMessage.message}`,
              logMessage.details || '',
            ),
        },
      });
      await notificationTestInternalClient.connect();
    });

    afterAll(async () => {
      await notificationTestInternalClient.disconnect();
      if (notificationHttpServer) {
        await new Promise<void>((resolve, reject) =>
          notificationHttpServer.close(err => {
            if (err) return reject(err);
            resolve();
          }),
        );
      }
      await notificationTestServer.close();
    });

    beforeEach(() => {
      vi.clearAllMocks();
      // Reset resource contents for isolation, though specific tests might override
      mockCurrentResourceContents = {
        'test://resource/1': { text: 'Initial content for R1' },
        'test://resource/2': { text: JSON.stringify({ data: 'Initial for R2' }) },
      };
    });

    it('should list initial resources', async () => {
      const result = (await notificationTestInternalClient.listResources()) as ListResourcesResult;
      expect(listResourcesCallback).toHaveBeenCalledTimes(1);
      expect(result.resources).toEqual(mockInitialResources);
    });

    it('should read resource content for an existing resource', async () => {
      const uri = 'test://resource/1';
      const result = (await notificationTestInternalClient.readResource(uri)) as ReadResourceResult;
      expect(getResourceContentCallback).toHaveBeenCalledWith({ uri });
      expect(result.contents).toEqual([
        {
          uri,
          mimeType: mockInitialResources.find(r => r.uri === uri)?.mimeType,
          text: (mockCurrentResourceContents[uri] as { text: string }).text,
        },
      ]);
    });

    it('should throw an error when reading a non-existent resource', async () => {
      const uri = 'test://resource/nonexistent';
      await expect(notificationTestInternalClient.readResource(uri)).rejects.toThrow(
        'Resource not found: test://resource/nonexistent',
      );
    });

    it('should list resource templates', async () => {
      const result = (await notificationTestInternalClient.listResourceTemplates()) as ListResourceTemplatesResult;
      expect(resourceTemplatesCallback).toHaveBeenCalledTimes(1);
      expect(result.resourceTemplates).toEqual(mockResourceTemplates);
    });

    it('should subscribe and unsubscribe from a resource', async () => {
      const uri = 'test://resource/1';
      const subscribeResult = await notificationTestInternalClient.subscribeResource(uri);
      expect(subscribeResult).toEqual({});

      const unsubscribeResult = await notificationTestInternalClient.unsubscribeResource(uri);
      expect(unsubscribeResult).toEqual({});
    });

    it('should receive resource updated notification when subscribed resource changes', async () => {
      const uriToSubscribe = 'test://resource/1';
      const newContent = 'Updated content for R1';
      const resourceUpdatedPromise = new Promise<void>(resolve => {
        notificationTestInternalClient.setResourceUpdatedNotificationHandler((params: { uri: string }) => {
          if (params.uri === uriToSubscribe) {
            resolve();
          }
        });
      });

      await notificationTestInternalClient.subscribeResource(uriToSubscribe);

      mockCurrentResourceContents[uriToSubscribe] = { text: newContent };

      await notificationTestServer.resources.notifyUpdated({ uri: uriToSubscribe });

      await expect(resourceUpdatedPromise).resolves.toBeUndefined(); // Wait for the notification
      await notificationTestInternalClient.unsubscribeResource(uriToSubscribe);
    });

    it('should receive resource list changed notification', async () => {
      const listChangedPromise = new Promise<void>(resolve => {
        notificationTestInternalClient.setResourceListChangedNotificationHandler(() => {
          resolve();
        });
      });

      await notificationTestServer.resources.notifyListChanged();

      await expect(listChangedPromise).resolves.toBeUndefined(); // Wait for the notification
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
      await new Promise<void>((resolve, reject) =>
        httpServer.close(err => {
          if (err) return reject(err);
          resolve();
        }),
      );
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
            args: ['-y', 'tsx', path.join(__dirname, '..', '__fixtures__/server-weather.ts')],
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

describe('MCPServer - Agent to Tool Conversion', () => {
  let server: MCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should convert a provided agent to an MCP tool with sync dynamic description', () => {
    const testAgent = createMockAgent(
      'MyTestAgent',
      mockAgentGenerate,
      mockAgentGetInstructions,
      'Simple mock description.',
    );
    server = new MCPServer({
      name: 'AgentToolServer',
      version: '1.0.0',
      tools: {},
      agents: { testAgentKey: testAgent },
    });

    const tools = server.tools();
    const agentToolName = 'ask_testAgentKey';
    expect(tools[agentToolName]).toBeDefined();
    expect(tools[agentToolName].description).toContain("Ask agent 'MyTestAgent' a question.");
    expect(tools[agentToolName].description).toContain('Agent description: Simple mock description.');

    const schema = tools[agentToolName].parameters.jsonSchema;
    expect(schema.type).toBe('object');
    if (schema.properties) {
      expect(schema.properties.message).toBeDefined();
      const querySchema = schema.properties.message as any;
      expect(querySchema.type).toBe('string');
    } else {
      throw new Error('Schema properties are undefined'); // Fail test if properties not found
    }
  });

  it('should call agent.generate when the derived tool is executed', async () => {
    const testAgent = createMockAgent(
      'MyExecAgent',
      mockAgentGenerate,
      mockAgentGetInstructions,
      'Executable mock agent',
    );
    server = new MCPServer({
      name: 'AgentExecServer',
      version: '1.0.0',
      tools: {},
      agents: { execAgentKey: testAgent },
    });

    const agentTool = server.tools()['ask_execAgentKey'];
    expect(agentTool).toBeDefined();

    const queryInput = { message: 'Hello Agent' };

    if (agentTool && agentTool.execute) {
      const result = await agentTool.execute(queryInput, { toolCallId: 'mcp-call-123', messages: [] });

      expect(mockAgentGenerate).toHaveBeenCalledTimes(1);
      expect(mockAgentGenerate).toHaveBeenCalledWith(queryInput.message);
      expect(result.text).toBe(`{"content":"Agent response to: ""Hello Agent""}`);
    } else {
      throw new Error('Agent tool or its execute function is undefined');
    }
  });

  it('should handle name collision: explicit tool wins over agent-derived tool', () => {
    const explicitToolName = 'ask_collidingAgentKey';
    const explicitToolExecute = vi.fn(async () => 'explicit tool response');
    const collidingAgent = createMockAgent(
      'CollidingAgent',
      mockAgentGenerate,
      undefined,
      'Colliding agent description',
    );

    server = new MCPServer({
      name: 'CollisionServer',
      version: '1.0.0',
      tools: {
        [explicitToolName]: {
          description: 'An explicit tool that collides.',
          parameters: z.object({ query: z.string() }),
          execute: explicitToolExecute,
        },
      },
      agents: { collidingAgentKey: collidingAgent },
    });

    const tools = server.tools();
    expect(tools[explicitToolName]).toBeDefined();
    expect(tools[explicitToolName].description).toBe('An explicit tool that collides.');
    expect(mockAgentGenerate).not.toHaveBeenCalled();
  });

  it('should use agentKey for tool name ask_<agentKey>', () => {
    const uniqueKeyAgent = createMockAgent(
      'AgentNameDoesNotMatterForToolKey',
      mockAgentGenerate,
      undefined,
      'Agent description',
    );
    server = new MCPServer({
      name: 'UniqueKeyServer',
      version: '1.0.0',
      tools: {},
      agents: { unique_agent_key_123: uniqueKeyAgent },
    });
    expect(server.tools()['ask_unique_agent_key_123']).toBeDefined();
  });

  it('should throw an error if description is undefined (not provided to mock)', () => {
    const agentWithNoDesc = createMockAgent('NoDescAgent', mockAgentGenerate, mockAgentGetInstructions, undefined); // getDescription will return ''

    expect(
      () =>
        new MCPServer({
          name: 'NoDescProvidedServer',
          version: '1.0.0',
          tools: {},
          agents: { noDescKey: agentWithNoDesc as unknown as Agent }, // Cast for test setup
        }),
    ).toThrow('must have a non-empty description');
  });
});
