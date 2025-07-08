import http from 'node:http';
import path from 'path';
import type { ServerType } from '@hono/node-server';
import { serve } from '@hono/node-server';
import { Agent } from '@mastra/core/agent';
import type { ToolsInput } from '@mastra/core/agent';
import type { MCPServerConfig, Repository, PackageInfo, RemoteInfo, ConvertedTool } from '@mastra/core/mcp';
import { createStep, Workflow } from '@mastra/core/workflows';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type {
  Resource,
  ResourceTemplate,
  ListResourcesResult,
  ReadResourceResult,
  ListResourceTemplatesResult,
  GetPromptResult,
  Prompt,
} from '@modelcontextprotocol/sdk/types.js';
import { MockLanguageModelV1 } from 'ai/test';
import { Hono } from 'hono';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { weatherTool } from '../__fixtures__/tools';
import { InternalMastraMCPClient } from '../client/client';
import { MCPClient } from '../client/configuration';
import { MCPServer } from './server';
import type { MCPServerResources, MCPServerResourceContent, MCPRequestHandlerExtra } from './types';

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

const createMockWorkflow = (
  id: string,
  description?: string,
  inputSchema?: z.ZodTypeAny,
  outputSchema?: z.ZodTypeAny,
) => {
  return new Workflow({
    id,
    description: description || '',
    inputSchema: inputSchema as z.ZodType<any>,
    outputSchema: outputSchema as z.ZodType<any>,
    steps: [],
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

  describe('Prompts', () => {
    let promptServer: MCPServer;
    let promptInternalClient: InternalMastraMCPClient;
    let promptHttpServer: http.Server;
    const PROMPT_PORT = 9500 + Math.floor(Math.random() * 1000);

    let currentPrompts: Prompt[] = [
      {
        name: 'explain-code',
        version: 'v1',
        description: 'Explain code v1',
        arguments: [{ name: 'code', required: true }],
        getMessages: async (args: any) => [
          { role: 'user', content: { type: 'text', text: `Explain this code (v1):\n${args.code}` } },
        ],
      },
      {
        name: 'explain-code',
        version: 'v2',
        description: 'Explain code v2',
        arguments: [{ name: 'code', required: true }],
        getMessages: async (args: any) => [
          { role: 'user', content: { type: 'text', text: `Explain this code (v2):\n${args.code}` } },
        ],
      },
      {
        name: 'summarize',
        version: 'v1',
        description: 'Summarize text',
        arguments: [{ name: 'text', required: true }],
        getMessages: async (args: any) => [
          { role: 'user', content: { type: 'text', text: `Summarize this:\n${args.text}` } },
        ],
      },
    ];

    beforeAll(async () => {
      // Register multiple versions of the same prompt

      promptServer = new MCPServer({
        name: 'PromptTestServer',
        version: '1.0.0',
        tools: {},
        prompts: {
          listPrompts: async () => currentPrompts,
          getPromptMessages: async (params: { name: string; version?: string; args?: any }) => {
            let prompt;
            if (params.version) {
              prompt = currentPrompts.find(p => p.name === params.name && p.version === params.version);
            } else {
              // Select the first matching name if no version is provided.
              prompt = currentPrompts.find(p => p.name === params.name);
            }
            if (!prompt)
              throw new Error(
                `Prompt "${params.name}"${params.version ? ` (version ${params.version})` : ''} not found`,
              );
            return (prompt as any).getMessages(params.args);
          },
        },
      });

      promptHttpServer = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
        const url = new URL(req.url || '', `http://localhost:${PROMPT_PORT}`);
        await promptServer.startSSE({
          url,
          ssePath: '/sse',
          messagePath: '/messages',
          req,
          res,
        });
      });
      await new Promise<void>(resolve => promptHttpServer.listen(PROMPT_PORT, () => resolve()));
      promptInternalClient = new InternalMastraMCPClient({
        name: 'prompt-test-internal-client',
        server: { url: new URL(`http://localhost:${PROMPT_PORT}/sse`) },
      });
      await promptInternalClient.connect();
    });

    afterAll(async () => {
      await promptInternalClient.disconnect();
      if (promptHttpServer) {
        promptHttpServer.closeAllConnections?.();
        await new Promise<void>((resolve, reject) => {
          promptHttpServer.close(err => {
            if (err) return reject(err);
            resolve();
          });
        });
      }
      if (promptServer) {
        await promptServer.close();
      }
    });

    it('should send prompt list changed notification when prompts change', async () => {
      const listChangedPromise = new Promise<void>(resolve => {
        promptInternalClient.setPromptListChangedNotificationHandler(() => {
          resolve();
        });
      });
      await promptServer.prompts.notifyListChanged();

      await expect(listChangedPromise).resolves.toBeUndefined(); // Wait for the notification
    });

    it('should list all prompts with version field', async () => {
      const result = await promptInternalClient.listPrompts();
      expect(result).toBeDefined();
      expect(result.prompts).toBeInstanceOf(Array);
      // Should contain both explain-code v1 and v2 and summarize v1
      const explainV1 = result.prompts.find((p: Prompt) => p.name === 'explain-code' && p.version === 'v1');
      const explainV2 = result.prompts.find((p: Prompt) => p.name === 'explain-code' && p.version === 'v2');
      const summarizeV1 = result.prompts.find((p: Prompt) => p.name === 'summarize' && p.version === 'v1');
      expect(explainV1).toBeDefined();
      expect(explainV2).toBeDefined();
      expect(summarizeV1).toBeDefined();
    });

    it('should retrieve prompt by name and version', async () => {
      const result = await promptInternalClient.getPrompt({
        name: 'explain-code',
        args: { code: 'let x = 1;' },
        version: 'v2',
      });
      const prompt = result.prompt as GetPromptResult;
      expect(prompt).toBeDefined();
      expect(prompt.name).toBe('explain-code');
      expect(prompt.version).toBe('v2');

      const messages = result.messages;
      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].content.text).toContain('(v2)');
    });

    it('should retrieve prompt by name and default to first version if not specified', async () => {
      const result = await promptInternalClient.getPrompt({ name: 'explain-code', args: { code: 'let y = 2;' } });
      expect(result.prompt).toBeDefined();
      const prompt = result.prompt as GetPromptResult;
      expect(prompt.name).toBe('explain-code');
      // Should default to first version (v1)
      expect(prompt.version).toBe('v1');

      const messages = result.messages;
      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].content.text).toContain('(v1)');
    });

    it('should return error if prompt name/version does not exist', async () => {
      await expect(
        promptInternalClient.getPrompt({ name: 'explain-code', args: { code: 'foo' }, version: 'v999' }),
      ).rejects.toThrow();
    });
    it('should throw error if required argument is missing', async () => {
      await expect(
        promptInternalClient.getPrompt({ name: 'explain-code', args: {} }), // missing 'code'
      ).rejects.toThrow(/Missing required argument/);
    });

    it('should succeed if all required arguments are provided', async () => {
      const result = await promptInternalClient.getPrompt({ name: 'explain-code', args: { code: 'let z = 3;' } });
      expect(result.prompt).toBeDefined();
      expect(result.messages[0].content.text).toContain('let z = 3;');
    });
    it('should allow prompts with optional arguments', async () => {
      // Register a prompt with an optional argument
      currentPrompts = [
        {
          name: 'optional-arg-prompt',
          version: 'v1',
          description: 'Prompt with optional argument',
          arguments: [{ name: 'foo', required: false }],
          getMessages: async (args: any) => [
            { role: 'user', content: { type: 'text', text: `foo is: ${args.foo ?? 'none'}` } },
          ],
        },
      ];
      await promptServer.prompts.notifyListChanged();
      const result = await promptInternalClient.getPrompt({ name: 'optional-arg-prompt', args: {} });
      expect(result.prompt).toBeDefined();
      expect(result.messages[0].content.text).toContain('foo is: none');
    });
    it('should retrieve prompt with no version field by name only', async () => {
      currentPrompts = [
        {
          name: 'no-version',
          description: 'Prompt without version',
          arguments: [],
          getMessages: async () => [{ role: 'user', content: { type: 'text', text: 'no version' } }],
        },
      ];
      await promptServer.prompts.notifyListChanged();
      const result = await promptInternalClient.getPrompt({ name: 'no-version', args: {} });
      const prompt = result.prompt as GetPromptResult;
      expect(prompt).toBeDefined();
      expect(prompt.version).toBeUndefined();
      const messages = result.messages;
      expect(messages).toBeDefined();
      expect(messages.length).toBeGreaterThan(0);
      expect(messages[0].content.text).toContain('no version');
    });
    it('should list prompts with required fields', async () => {
      const result = await promptInternalClient.listPrompts();
      result.prompts.forEach((p: Prompt) => {
        expect(p.name).toBeDefined();
        expect(p.description).toBeDefined();
        expect(p.arguments).toBeDefined();
      });
    });
    it('should return empty list if no prompts are registered', async () => {
      currentPrompts = [];
      await promptServer.prompts.notifyListChanged();
      const result = await promptInternalClient.listPrompts();
      expect(result.prompts).toBeInstanceOf(Array);
      expect(result.prompts.length).toBe(0);
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
    const TOKEN = `<random-token>`;

    beforeAll(async () => {
      server = new MCPServer({
        name: 'Test MCP Server',
        version: '0.1.0',
        tools: {
          weatherTool,
          testAuthTool: {
            description: 'Test tool to validate auth information from extra params',
            parameters: z.object({
              message: z.string().describe('Message to show to user'),
            }),
            execute: async (context, options) => {
              const extra = options.extra as MCPRequestHandlerExtra;

              return {
                message: context.message,
                sessionId: extra?.sessionId || null,
                authInfo: extra?.authInfo || null,
                requestId: extra?.requestId || null,
                hasExtra: !!extra,
              };
            },
          },
        },
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
            requestInit: {
              headers: { Authorization: `Bearer ${TOKEN}` },
            },
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

    it('should pass auth information through extra parameter', async () => {
      const mockExtra: MCPRequestHandlerExtra = {
        signal: new AbortController().signal,
        sessionId: 'test-session-id',
        authInfo: {
          token: TOKEN,
          clientId: 'test-client-id',
          scopes: ['read'],
        },
        requestId: 'test-request-id',
        sendNotification: vi.fn(),
        sendRequest: vi.fn(),
      };

      const mockRequest = {
        jsonrpc: '2.0' as const,
        id: 'test-request-1',
        method: 'tools/call' as const,
        params: {
          name: 'testAuthTool',
          arguments: {
            message: 'test auth',
          },
        },
      };

      const serverInstance = server.getServer();

      // @ts-ignore - this is a private property, but we need to access it to test the request handler
      const requestHandlers = serverInstance._requestHandlers;
      const callToolHandler = requestHandlers.get('tools/call');

      expect(callToolHandler).toBeDefined();

      const result = await callToolHandler(mockRequest, mockExtra);

      expect(result).toBeDefined();
      expect(result.isError).toBe(false);
      expect(result.content).toBeInstanceOf(Array);
      expect(result.content.length).toBeGreaterThan(0);

      const toolOutput = result.content[0];
      expect(toolOutput.type).toBe('text');
      const toolResult = JSON.parse(toolOutput.text);

      expect(toolResult.message).toBe('test auth');
      expect(toolResult.hasExtra).toBe(true);
      expect(toolResult.sessionId).toBe('test-session-id');
      expect(toolResult.authInfo).toBeDefined();
      expect(toolResult.authInfo.token).toBe(TOKEN);
      expect(toolResult.authInfo.clientId).toBe('test-client-id');
      expect(toolResult.requestId).toBe('test-request-id');
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

describe('MCPServer - Workflow to Tool Conversion', () => {
  let server: MCPServer;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should convert a provided workflow to an MCP tool', () => {
    const testWorkflow = createMockWorkflow('MyTestWorkflow', 'A test workflow.');
    server = new MCPServer({
      name: 'WorkflowToolServer',
      version: '1.0.0',
      tools: {},
      workflows: { testWorkflowKey: testWorkflow },
    });

    const tools = server.tools();
    const workflowToolName = 'run_testWorkflowKey';
    expect(tools[workflowToolName]).toBeDefined();
    expect(tools[workflowToolName].description).toBe(
      "Run workflow 'testWorkflowKey'. Workflow description: A test workflow.",
    );
    expect(tools[workflowToolName].parameters.jsonSchema).toBeDefined();
    expect(tools[workflowToolName].parameters.jsonSchema.type).toBe('object');
  });

  it('should throw an error if workflow.description is undefined or empty', () => {
    const testWorkflowNoDesc = createMockWorkflow('MyWorkflowNoDesc', undefined);
    expect(
      () =>
        new MCPServer({
          name: 'WorkflowNoDescServer',
          version: '1.0.0',
          tools: {},
          workflows: { testKeyNoDesc: testWorkflowNoDesc },
        }),
    ).toThrow('must have a non-empty description');

    const testWorkflowEmptyDesc = createMockWorkflow('MyWorkflowEmptyDesc', '');
    expect(
      () =>
        new MCPServer({
          name: 'WorkflowEmptyDescServer',
          version: '1.0.0',
          tools: {},
          workflows: { testKeyEmptyDesc: testWorkflowEmptyDesc },
        }),
    ).toThrow('must have a non-empty description');
  });

  it('should call workflow.createRun().start() when the derived tool is executed', async () => {
    const testWorkflow = createMockWorkflow('MyExecWorkflow', 'Executable workflow');
    const step = createStep({
      id: 'my-step',
      description: 'My step description',
      inputSchema: z.object({
        data: z.string(),
      }),
      outputSchema: z.object({
        result: z.string(),
      }),
      execute: async ({ inputData }) => {
        return {
          result: inputData.data,
        };
      },
    });
    testWorkflow.then(step).commit();
    server = new MCPServer({
      name: 'WorkflowExecServer',
      version: '1.0.0',
      tools: {},
      workflows: { execWorkflowKey: testWorkflow },
    });

    const workflowTool = server.tools()['run_execWorkflowKey'] as ConvertedTool;
    expect(workflowTool).toBeDefined();

    const inputData = { data: 'Hello Workflow' };
    if (workflowTool && workflowTool.execute) {
      const result = await workflowTool.execute(inputData, { toolCallId: 'mcp-wf-call-123', messages: [] });
      expect(result).toMatchObject({
        status: 'success',
        steps: {
          input: { data: 'Hello Workflow' },
          'my-step': { status: 'success', output: { result: 'Hello Workflow' } },
        },
        result: { result: 'Hello Workflow' },
      });
    } else {
      throw new Error('Workflow tool or its execute function is undefined');
    }
  });

  it('should handle name collision: explicit tool wins over workflow-derived tool', () => {
    const explicitToolName = 'run_collidingWorkflowKey';
    const explicitToolExecute = vi.fn(async () => 'explicit tool response');
    const collidingWorkflow = createMockWorkflow('CollidingWorkflow', 'Colliding workflow description');

    server = new MCPServer({
      name: 'WFCollisionServer',
      version: '1.0.0',
      tools: {
        [explicitToolName]: {
          description: 'An explicit tool that collides with a workflow.',
          parameters: z.object({ query: z.string() }),
          execute: explicitToolExecute,
        },
      },
      workflows: { collidingWorkflowKey: collidingWorkflow },
    });

    const tools = server.tools();
    expect(tools[explicitToolName]).toBeDefined();
    expect(tools[explicitToolName].description).toBe('An explicit tool that collides with a workflow.');
  });

  it('should use workflowKey for tool name run_<workflowKey>', () => {
    const uniqueKeyWorkflow = createMockWorkflow('WorkflowNameDoesNotMatter', 'WF description');
    server = new MCPServer({
      name: 'UniqueWFKeyServer',
      version: '1.0.0',
      tools: {},
      workflows: { unique_workflow_key_789: uniqueKeyWorkflow },
    });
    expect(server.tools()['run_unique_workflow_key_789']).toBeDefined();
  });
});

describe('MCPServer - Elicitation', () => {
  let elicitationServer: MCPServer;
  let elicitationClient: InternalMastraMCPClient;
  let elicitationHttpServer: http.Server;
  const ELICITATION_PORT = 9600 + Math.floor(Math.random() * 1000);

  beforeAll(async () => {
    elicitationServer = new MCPServer({
      name: 'ElicitationTestServer',
      version: '1.0.0',
      tools: {
        testElicitationTool: {
          description: 'A tool that uses elicitation to collect user input',
          parameters: z.object({
            message: z.string().describe('Message to show to user'),
          }),
          execute: async (context, options) => {
            // Use the session-aware elicitation functionality
            try {
              const elicitation = options.elicitation;
              const result = await elicitation.sendRequest({
                message: context.message,
                requestedSchema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', title: 'Name' },
                    email: { type: 'string', title: 'Email', format: 'email' },
                  },
                  required: ['name'],
                },
              });
              return result;
            } catch (error) {
              console.error('Error sending elicitation request:', error);
              return {
                content: [
                  {
                    type: 'text',
                    text: `Error collecting information: ${error}`,
                  },
                ],
                isError: true,
              };
            }
          },
        },
      },
    });

    beforeEach(async () => {
      try {
        await elicitationClient?.disconnect();
      } catch (error) {
        console.error('Error disconnecting elicitation client:', error);
      }
    });

    elicitationHttpServer = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(req.url || '', `http://localhost:${ELICITATION_PORT}`);
      await elicitationServer.startHTTP({
        url,
        httpPath: '/http',
        req,
        res,
      });
    });

    await new Promise<void>(resolve => elicitationHttpServer.listen(ELICITATION_PORT, () => resolve()));
  });

  afterAll(async () => {
    await elicitationClient?.disconnect();
    if (elicitationHttpServer) {
      elicitationHttpServer.closeAllConnections?.();
      await new Promise<void>((resolve, reject) => {
        elicitationHttpServer.close(err => {
          if (err) return reject(err);
          resolve();
        });
      });
    }
    if (elicitationServer) {
      await elicitationServer.close();
    }
  });

  it('should have elicitation capability enabled', () => {
    // Test that the server has elicitation functionality available
    expect(elicitationServer.elicitation).toBeDefined();
    expect(elicitationServer.elicitation.sendRequest).toBeDefined();
  });

  it('should handle elicitation request with accept response', async () => {
    const mockElicitationHandler = vi.fn(async request => {
      expect(request.message).toBe('Please provide your information');
      expect(request.requestedSchema).toBeDefined();
      expect(request.requestedSchema.properties.name).toBeDefined();

      return {
        action: 'accept' as const,
        content: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };
    });

    elicitationClient = new InternalMastraMCPClient({
      name: 'elicitation-test-client',
      server: {
        url: new URL(`http://localhost:${ELICITATION_PORT}/http`),
      },
    });
    elicitationClient.elicitation.onRequest(mockElicitationHandler);
    await elicitationClient.connect();

    const tools = await elicitationClient.tools();
    const tool = tools['testElicitationTool'];
    expect(tool).toBeDefined();

    const result = await tool.execute({
      context: {
        message: 'Please provide your information',
      },
    });

    expect(mockElicitationHandler).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.content[0].text)).toEqual({
      action: 'accept',
      content: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    });
  });

  it('should handle elicitation request with reject response', async () => {
    const mockElicitationHandler = vi.fn(async request => {
      expect(request.message).toBe('Please provide sensitive data');
      return { action: 'reject' as const };
    });

    elicitationClient = new InternalMastraMCPClient({
      name: 'elicitation-reject-client',
      server: {
        url: new URL(`http://localhost:${ELICITATION_PORT}/http`),
      },
    });
    elicitationClient.elicitation.onRequest(mockElicitationHandler);
    await elicitationClient.connect();

    const tools = await elicitationClient.tools();
    const tool = tools['testElicitationTool'];

    const result = await tool.execute({
      context: {
        message: 'Please provide sensitive data',
      },
    });

    expect(mockElicitationHandler).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.content[0].text)).toEqual({ action: 'reject' });
  });

  it('should handle elicitation request with cancel response', async () => {
    const mockElicitationHandler = vi.fn(async () => {
      return { action: 'cancel' as const };
    });

    elicitationClient = new InternalMastraMCPClient({
      name: 'elicitation-cancel-client',
      server: {
        url: new URL(`http://localhost:${ELICITATION_PORT}/http`),
      },
    });
    elicitationClient.elicitation.onRequest(mockElicitationHandler);
    await elicitationClient.connect();

    const tools = await elicitationClient.tools();
    const tool = tools['testElicitationTool'];

    const result = await tool.execute({
      context: {
        message: 'Please provide optional data',
      },
    });

    expect(mockElicitationHandler).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.content[0].text)).toEqual({ action: 'cancel' });
  });

  it('should error when elicitation handler throws error', async () => {
    const mockElicitationHandler = vi.fn(async () => {
      throw new Error('Handler error');
    });

    elicitationClient = new InternalMastraMCPClient({
      name: 'elicitation-error-client',
      server: {
        url: new URL(`http://localhost:${ELICITATION_PORT}/http`),
      },
    });
    elicitationClient.elicitation.onRequest(mockElicitationHandler);
    await elicitationClient.connect();

    const tools = await elicitationClient.tools();
    const tool = tools['testElicitationTool'];

    const result = await tool.execute({
      context: {
        message: 'This will cause an error',
      },
    });

    expect(mockElicitationHandler).toHaveBeenCalledTimes(1);
    expect(result.content[0].text).toContain('Handler error');
  });

  it('should error when client has no elicitation handler', async () => {
    elicitationClient = new InternalMastraMCPClient({
      name: 'no-elicitation-handler-client',
      server: {
        url: new URL(`http://localhost:${ELICITATION_PORT}/http`),
        // No elicitationHandler provided
      },
    });
    await elicitationClient.connect();

    const tools = await elicitationClient.tools();
    const tool = tools['testElicitationTool'];

    const result = await tool.execute({
      context: {
        message: 'This should fail gracefully',
      },
    });

    // When no elicitation handler is provided, the server's elicitInput should fail
    // and the tool should return a reject response
    expect(result.content[0].text).toContain('Method not found');
  });

  it('should validate elicitation request schema structure', async () => {
    const mockElicitationHandler = vi.fn(async request => {
      expect(request.message).toBe('Please provide your information');
      expect(request.requestedSchema).toBeDefined();
      expect(request.requestedSchema.properties.name).toBeDefined();

      return {
        action: 'accept' as const,
        content: {
          validated: true,
        },
      };
    });

    elicitationClient = new InternalMastraMCPClient({
      name: 'elicitation-test-client',
      server: {
        url: new URL(`http://localhost:${ELICITATION_PORT}/http`),
      },
    });
    elicitationClient.elicitation.onRequest(mockElicitationHandler);
    await elicitationClient.connect();

    const tools = await elicitationClient.tools();
    const tool = tools['testElicitationTool'];
    expect(tool).toBeDefined();

    const result = await tool.execute({
      context: {
        message: 'Please provide your information',
      },
    });

    expect(mockElicitationHandler).toHaveBeenCalledTimes(1);
    expect(result.content[0].text).toContain('Elicitation response content does not match requested schema');
  });

  it('should isolate elicitation handlers between different client connections', async () => {
    const client1Handler = vi.fn(async request => {
      expect(request.message).toBe('Please provide your information');
      expect(request.requestedSchema).toBeDefined();
      expect(request.requestedSchema.properties.name).toBeDefined();

      return {
        action: 'accept' as const,
        content: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };
    });
    const client2Handler = vi.fn(async request => {
      expect(request.message).toBe('Please provide your information');
      expect(request.requestedSchema).toBeDefined();
      expect(request.requestedSchema.properties.name).toBeDefined();

      return {
        action: 'accept' as const,
        content: {
          name: 'John Doe',
          email: 'john@example.com',
        },
      };
    });

    // Create two independent client instances
    const elicitationClient1 = new MCPClient({
      id: 'elicitation-isolation-client-1',
      servers: {
        elicitation1: {
          url: new URL(`http://localhost:${ELICITATION_PORT}/http`),
        },
      },
    });

    const elicitationClient2 = new MCPClient({
      id: 'elicitation-isolation-client-2',
      servers: {
        elicitation2: {
          url: new URL(`http://localhost:${ELICITATION_PORT}/http`),
        },
      },
    });

    // Each client registers its own independent handler
    elicitationClient1.elicitation.onRequest('elicitation1', client1Handler);
    elicitationClient2.elicitation.onRequest('elicitation2', client2Handler);

    const tools = await elicitationClient1.getTools();
    const tool = tools['elicitation1_testElicitationTool'];
    expect(tool).toBeDefined();
    await tool.execute({
      context: {
        message: 'Please provide your information',
      },
    });

    const tools2 = await elicitationClient2.getTools();
    const tool2 = tools2['elicitation2_testElicitationTool'];
    expect(tool2).toBeDefined();

    // Verify handlers are isolated - they should not interfere with each other
    expect(client1Handler).toHaveBeenCalled();
    expect(client2Handler).not.toHaveBeenCalled();
  }, 10000);
});

describe('MCPServer with Tool Output Schema', () => {
  let serverWithOutputSchema: MCPServer;
  let clientWithOutputSchema: MCPClient;
  const PORT = 9600 + Math.floor(Math.random() * 1000);
  let httpServerWithOutputSchema: http.Server;

  const structuredTool: ToolsInput = {
    structuredTool: {
      description: 'A test tool with structured output',
      parameters: z.object({ input: z.string() }),
      outputSchema: z.object({
        processedInput: z.string(),
        timestamp: z.string(),
      }),
      execute: async ({ input }: { input: string }) => ({
        structuredContent: {
          processedInput: `processed: ${input}`,
          timestamp: mockDateISO,
        },
      }),
    },
  };

  beforeAll(async () => {
    serverWithOutputSchema = new MCPServer({
      name: 'Test MCP Server with OutputSchema',
      version: '0.1.0',
      tools: structuredTool,
    });

    httpServerWithOutputSchema = http.createServer(async (req: http.IncomingMessage, res: http.ServerResponse) => {
      const url = new URL(req.url || '', `http://localhost:${PORT}`);
      await serverWithOutputSchema.startHTTP({
        url,
        httpPath: '/http',
        req,
        res,
      });
    });

    await new Promise<void>(resolve => httpServerWithOutputSchema.listen(PORT, () => resolve()));

    clientWithOutputSchema = new MCPClient({
      servers: {
        local: {
          url: new URL(`http://localhost:${PORT}/http`),
        },
      },
    });
  });

  afterAll(async () => {
    httpServerWithOutputSchema.closeAllConnections?.();
    await new Promise<void>(resolve =>
      httpServerWithOutputSchema.close(() => {
        resolve();
      }),
    );
    await serverWithOutputSchema.close();
  });

  it('should list tool with outputSchema', async () => {
    const tools = await clientWithOutputSchema.getTools();
    const tool = tools['local_structuredTool'];
    expect(tool).toBeDefined();
    expect(tool.outputSchema).toBeDefined();
  });

  it('should call tool and receive structuredContent', async () => {
    const tools = await clientWithOutputSchema.getTools();
    const tool = tools['local_structuredTool'];
    const result = await tool.execute({ context: { input: 'hello' } });

    expect(result).toBeDefined();
    expect(result.structuredContent).toBeDefined();
    expect(result.structuredContent.processedInput).toBe('processed: hello');
    expect(result.structuredContent.timestamp).toBe(mockDateISO);

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
    expect(JSON.parse(result.content[0].text)).toEqual(result.structuredContent);
  });
});
