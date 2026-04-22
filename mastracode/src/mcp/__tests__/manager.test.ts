import { exec } from 'node:child_process';
import http from 'node:http';
import { MCPClient, MCPOAuthClientProvider, auth } from '@mastra/mcp';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { loadMcpConfig } from '../config.js';
import { createMcpManager } from '../manager.js';
import type { McpManager } from '../manager.js';
import type { McpConfig, McpHttpServerConfig, McpStdioServerConfig } from '../types.js';

vi.mock('node:child_process', () => {
  return {
    exec: vi.fn(),
  };
});

vi.mock('@mastra/mcp', () => {
  // individual tests override listToolsets/disconnect via mockImplementation
  const MCPClient = vi.fn(function (this: any) {});
  const MCPOAuthClientProvider = vi.fn();
  const auth = vi.fn().mockResolvedValue('AUTHORIZED');
  return { MCPClient, MCPOAuthClientProvider, auth };
});

vi.mock('../config.js', async importOriginal => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    loadMcpConfig: vi.fn(() => ({})),
  };
});

vi.mock('../mcp-oauth-storage.js', () => {
  return {
    McpOAuthFileStorage: vi.fn(),
  };
});

const mockedLoadMcpConfig = vi.mocked(loadMcpConfig);
const MockedMCPClient = vi.mocked(MCPClient);
const MockedMCPOAuthClientProvider = vi.mocked(MCPOAuthClientProvider);
const mockedAuth = vi.mocked(auth);
const mockedExec = vi.mocked(exec);
const cleanupManagers: McpManager[] = [];

function setupConfig(config: McpConfig) {
  mockedLoadMcpConfig.mockReturnValue(config);
}

function trackManager(manager: McpManager): McpManager {
  cleanupManagers.push(manager);
  return manager;
}

async function sendCallback(
  redirectUrl: string,
  params: Record<string, string>,
): Promise<{ statusCode: number; body: string }> {
  const url = new URL(redirectUrl);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return await new Promise((resolve, reject) => {
    const request = http.get(url, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode ?? 0,
          body,
        });
      });
    });

    request.on('error', reject);
  });
}

describe('createMcpManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    MockedMCPOAuthClientProvider.mockImplementation(function (this: any, options: any) {
      Object.assign(this, options);
    });
    mockedAuth.mockResolvedValue('AUTHORIZED');
    mockedExec.mockReturnValue({} as any);
  });

  afterEach(async () => {
    await Promise.allSettled(cleanupManagers.splice(0).map(manager => manager.disconnect()));
  });

  describe('hasServers', () => {
    it('returns false when no servers configured', () => {
      setupConfig({});
      const manager = createMcpManager('/tmp/test');
      expect(manager.hasServers()).toBe(false);
    });

    it('returns true when stdio servers configured', () => {
      setupConfig({ mcpServers: { fs: { command: 'npx', args: [] } } });
      const manager = createMcpManager('/tmp/test');
      expect(manager.hasServers()).toBe(true);
    });

    it('returns true when http servers configured', () => {
      setupConfig({ mcpServers: { remote: { url: 'https://example.com/mcp' } } });
      const manager = createMcpManager('/tmp/test');
      expect(manager.hasServers()).toBe(true);
    });

    it('returns true when only skipped servers exist', () => {
      setupConfig({ skippedServers: [{ name: 'bad', reason: 'Invalid entry' }] });
      const manager = createMcpManager('/tmp/test');
      expect(manager.hasServers()).toBe(true);
    });
  });

  describe('getSkippedServers', () => {
    it('returns empty array when no skipped servers', () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      const manager = createMcpManager('/tmp/test');
      expect(manager.getSkippedServers()).toEqual([]);
    });

    it('returns skipped servers from config', () => {
      const skipped = [
        { name: 'bad1', reason: 'Missing required field' },
        { name: 'bad2', reason: 'Invalid URL' },
      ];
      setupConfig({ skippedServers: skipped });
      const manager = createMcpManager('/tmp/test');
      expect(manager.getSkippedServers()).toEqual(skipped);
    });
  });

  describe('init with server defs', () => {
    it('builds stdio server def correctly with stderr piped', async () => {
      const stdioConfig: McpStdioServerConfig = { command: 'npx', args: ['-y', 'mcp-fs'], env: { HOME: '/tmp' } };
      setupConfig({ mcpServers: { fs: stdioConfig } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: { read: {} } }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(MockedMCPClient).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mastra-code-mcp',
          servers: {
            fs: { command: 'npx', args: ['-y', 'mcp-fs'], env: { HOME: '/tmp' }, stderr: 'pipe' },
          },
        }),
      );
    });

    it('builds http server def with URL object and requestInit', async () => {
      const httpConfig: McpHttpServerConfig = {
        url: 'https://mcp.example.com/sse',
        headers: { Authorization: 'Bearer tok' },
      };
      setupConfig({ mcpServers: { remote: httpConfig } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { remote: { weather: {} } }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      const serverDef = call.servers['remote'] as any;
      expect(serverDef.url).toBeInstanceOf(URL);
      expect(serverDef.url.href).toBe('https://mcp.example.com/sse');
      expect(serverDef.requestInit).toEqual({ headers: { Authorization: 'Bearer tok' } });
    });

    it('builds http server def without headers', async () => {
      const httpConfig: McpHttpServerConfig = { url: 'https://mcp.example.com/mcp' };
      setupConfig({ mcpServers: { remote: httpConfig } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { remote: {} }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      const serverDef = call.servers['remote'] as any;
      expect(serverDef.url).toBeInstanceOf(URL);
      expect(serverDef.requestInit).toBeUndefined();
    });

    it('creates one MCPClient with all servers', async () => {
      setupConfig({
        mcpServers: {
          fs: { command: 'npx' },
          remote: { url: 'https://example.com/mcp' },
        },
      });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: {}, remote: {} }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(MockedMCPClient).toHaveBeenCalledTimes(1);
      const call = MockedMCPClient.mock.calls[0]![0]!;
      expect(call.id).toBe('mastra-code-mcp');
      expect(call.servers).toHaveProperty('fs');
      expect(call.servers).toHaveProperty('remote');
    });
  });

  describe('extraServers parameter', () => {
    it('merges programmatic servers with file-based config', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx', args: ['-y', 'mcp-fs'] } } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi
          .fn()
          .mockResolvedValue({ toolsets: { fs: { read: {} }, remote: { weather: {} } }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test', {
        remote: { url: 'https://mcp.example.com/sse' },
      });
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      expect(call.servers).toHaveProperty('fs');
      expect(call.servers).toHaveProperty('remote');
    });

    it('programmatic servers override file-based servers with the same name', async () => {
      setupConfig({ mcpServers: { myserver: { command: 'old-cmd' } } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { myserver: {} }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test', {
        myserver: { command: 'new-cmd', args: ['--flag'] },
      });
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      expect((call.servers['myserver'] as any).command).toBe('new-cmd');
      expect((call.servers['myserver'] as any).args).toEqual(['--flag']);
    });

    it('hasServers returns true when only extraServers provided and config is empty', () => {
      setupConfig({});
      const manager = createMcpManager('/tmp/test', {
        extra: { url: 'https://example.com/mcp' },
      });
      expect(manager.hasServers()).toBe(true);
    });

    it('preserves extra servers after reload', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi
          .fn()
          .mockResolvedValue({ toolsets: { fs: { tool: {} }, extra: { tool: {} } }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test', {
        extra: { url: 'https://example.com/mcp' },
      });
      await manager.init();
      await manager.reload();

      // After reload, extra servers should still be included
      const lastCall = MockedMCPClient.mock.calls[MockedMCPClient.mock.calls.length - 1]![0]!;
      expect(lastCall.servers).toHaveProperty('extra');
      expect(lastCall.servers).toHaveProperty('fs');
    });
  });

  describe('initInBackground', () => {
    it('returns init result with connected and failed servers', async () => {
      setupConfig({
        mcpServers: { fs: { command: 'npx' } },
        skippedServers: [{ name: 'bad', reason: 'Invalid entry' }],
      });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi
          .fn()
          .mockResolvedValue({ toolsets: { fs: { read: {}, write: {} } }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      const result = await manager.initInBackground();

      expect(result.connected).toHaveLength(1);
      expect(result.connected[0]!.name).toBe('fs');
      expect(result.failed).toHaveLength(0);
      expect(result.totalTools).toBe(2);
      expect(result.skipped).toEqual([{ name: 'bad', reason: 'Invalid entry' }]);
    });

    it('returns failed servers on connection error', async () => {
      setupConfig({ mcpServers: { remote: { url: 'https://example.com/mcp' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockRejectedValue(new Error('Connection failed'));
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      const result = await manager.initInBackground();

      expect(result.connected).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]!.name).toBe('remote');
      expect(result.totalTools).toBe(0);
    });

    it('captures per-server errors from listToolsetsWithErrors', async () => {
      // listToolsetsWithErrors() returns both toolsets and per-server errors.
      // Failed servers appear in the errors record with their real error message.
      setupConfig({
        mcpServers: {
          good: { command: 'npx', args: ['good-server'] },
          bad: { url: 'https://broken.example.com/mcp' },
          alsogood: { command: 'npx', args: ['also-good'] },
        },
      });

      // listToolsetsWithErrors returns tools for "good" and "alsogood", error for "bad"
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: {
            good: { tool1: {}, tool2: {} },
            alsogood: { tool1: {} },
          },
          errors: {
            bad: 'Failed to connect to MCP server bad: spawn nonexistent ENOENT',
          },
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      const result = await manager.initInBackground();

      // good and alsogood connected; bad detected as failed with real error
      expect(result.connected).toHaveLength(2);
      expect(result.connected.map(s => s.name).sort()).toEqual(['alsogood', 'good']);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]!.name).toBe('bad');
      expect(result.failed[0]!.error).toBe('Failed to connect to MCP server bad: spawn nonexistent ENOENT');
      expect(result.totalTools).toBe(3);

      // Tools from successful servers should be available (namespaced)
      const tools = manager.getTools();
      expect(tools).toHaveProperty('good_tool1');
      expect(tools).toHaveProperty('good_tool2');
      expect(tools).toHaveProperty('alsogood_tool1');
    });

    it('returns cached result if already initialized', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      const mockListToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: { read: {} } }, errors: {} });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = mockListToolsetsWithErrors;
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();
      const result = await manager.initInBackground();

      expect(result.connected).toHaveLength(1);
      expect(result.totalTools).toBe(1);
      // listToolsetsWithErrors should only have been called once (from init, not again from initInBackground)
      expect(mockListToolsetsWithErrors).toHaveBeenCalledTimes(1);
    });
  });

  describe('OAuth auth wiring', () => {
    it('passes authProvider when auth is "oauth"', async () => {
      setupConfig({
        mcpServers: {
          remote: { url: 'https://mcp.example.com/mcp', auth: 'oauth' },
        },
      });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { remote: {} }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = trackManager(createMcpManager('/tmp/test'));
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      const serverDef = call.servers['remote'] as any;
      expect(serverDef.url).toBeInstanceOf(URL);
      expect(serverDef.authProvider).toBeDefined();
      expect(MockedMCPOAuthClientProvider).toHaveBeenCalledTimes(1);
    });

    it('does not pass authProvider when auth is absent', async () => {
      setupConfig({
        mcpServers: {
          remote: { url: 'https://mcp.example.com/mcp' },
        },
      });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { remote: {} }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = trackManager(createMcpManager('/tmp/test'));
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      const serverDef = call.servers['remote'] as any;
      expect(serverDef.authProvider).toBeUndefined();
      expect(MockedMCPOAuthClientProvider).not.toHaveBeenCalled();
    });

    it('preserves static headers alongside authProvider', async () => {
      setupConfig({
        mcpServers: {
          remote: {
            url: 'https://mcp.example.com/mcp',
            headers: { 'X-Custom': 'value' },
            auth: 'oauth',
          },
        },
      });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { remote: {} }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = trackManager(createMcpManager('/tmp/test'));
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      const serverDef = call.servers['remote'] as any;
      expect(serverDef.authProvider).toBeDefined();
      expect(serverDef.requestInit).toEqual({ headers: { 'X-Custom': 'value' } });
    });

    it('creates separate OAuth providers for each server', async () => {
      setupConfig({
        mcpServers: {
          server1: { url: 'https://one.example.com/mcp', auth: 'oauth' },
          server2: { url: 'https://two.example.com/mcp', auth: 'oauth' },
        },
      });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { server1: {}, server2: {} }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = trackManager(createMcpManager('/tmp/test'));
      await manager.init();

      expect(MockedMCPOAuthClientProvider).toHaveBeenCalledTimes(2);
    });

    it('configures OAuth provider with correct client metadata', async () => {
      setupConfig({
        mcpServers: {
          myserver: { url: 'https://mcp.example.com/mcp', auth: 'oauth' },
        },
      });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { myserver: {} }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = trackManager(createMcpManager('/tmp/test'));
      await manager.init();

      const providerCall = MockedMCPOAuthClientProvider.mock.calls[0]![0]! as any;
      expect(providerCall.clientMetadata.client_name).toBe('mastracode (myserver)');
      expect(providerCall.clientMetadata.grant_types).toEqual(['authorization_code', 'refresh_token']);
      expect(providerCall.clientMetadata.response_types).toEqual(['code']);
      expect(providerCall.storage).toBeDefined();
      expect(typeof providerCall.onRedirectToAuthorization).toBe('function');
    });

    it('uses a real callback port in redirect URL', async () => {
      setupConfig({
        mcpServers: {
          remote: { url: 'https://mcp.example.com/mcp', auth: 'oauth' },
        },
      });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { remote: {} }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = trackManager(createMcpManager('/tmp/test'));
      await manager.init();

      const providerCall = MockedMCPOAuthClientProvider.mock.calls[0]![0]! as any;
      expect(providerCall.redirectUrl).toMatch(/^http:\/\/localhost:\d+\/oauth\/callback$/);
      expect(providerCall.clientMetadata.redirect_uris[0]).toBe(providerCall.redirectUrl);
    });

    it('isolates OAuth callbacks per server and retries init after authorization', async () => {
      setupConfig({
        mcpServers: {
          server1: { url: 'https://one.example.com/mcp', auth: 'oauth' },
          server2: { url: 'https://two.example.com/mcp', auth: 'oauth' },
        },
      });

      let connectAttempt = 0;
      const redirectStates = new Map<string, string>();

      MockedMCPClient.mockImplementation(function (this: any, options: any) {
        this.listToolsetsWithErrors = vi.fn().mockImplementation(async () => {
          connectAttempt += 1;

          if (connectAttempt === 1) {
            for (const [name, definition] of Object.entries(options.servers)) {
              const provider = (definition as any).authProvider;
              const state = await provider.stateGenerator();
              redirectStates.set(name, state);
              await provider.onRedirectToAuthorization(new URL(`https://${name}.example.com/authorize?state=${state}`));
            }

            throw new Error('OAuth required');
          }

          return {
            toolsets: {
              server1: { list: {} },
              server2: { fetch: {} },
            },
            errors: {},
          };
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = trackManager(createMcpManager('/tmp/test'));
      const initPromise = manager.init();

      await vi.waitFor(() => {
        expect(mockedExec).toHaveBeenCalledTimes(2);
      });

      const provider1 = MockedMCPOAuthClientProvider.mock.instances[0] as any;
      const provider2 = MockedMCPOAuthClientProvider.mock.instances[1] as any;
      const server1State = redirectStates.get('server1');
      const server2State = redirectStates.get('server2');

      expect(server1State).toBeDefined();
      expect(server2State).toBeDefined();

      const mismatchResponse = await sendCallback(provider1.redirectUrl, {
        code: 'wrong-code',
        state: server2State!,
      });

      expect(mismatchResponse.statusCode).toBe(400);
      expect(mismatchResponse.body).toContain('State mismatch');
      expect(mockedAuth).not.toHaveBeenCalled();

      const [server1Response, server2Response] = await Promise.all([
        sendCallback(provider1.redirectUrl, {
          code: 'server1-code',
          state: server1State!,
        }),
        sendCallback(provider2.redirectUrl, {
          code: 'server2-code',
          state: server2State!,
        }),
      ]);

      expect(server1Response.statusCode).toBe(200);
      expect(server2Response.statusCode).toBe(200);

      await initPromise;

      expect(MockedMCPClient).toHaveBeenCalledTimes(2);
      expect(mockedAuth).toHaveBeenCalledTimes(2);
      expect(
        mockedAuth.mock.calls.map(([, options]) => ({
          authorizationCode: (options as any).authorizationCode,
          serverUrl: (options as any).serverUrl.toString(),
        })),
      ).toEqual([
        {
          authorizationCode: 'server1-code',
          serverUrl: 'https://one.example.com/mcp',
        },
        {
          authorizationCode: 'server2-code',
          serverUrl: 'https://two.example.com/mcp',
        },
      ]);

      expect(manager.getTools()).toHaveProperty('server1_list');
      expect(manager.getTools()).toHaveProperty('server2_fetch');
    });

    it('does not start callback server for non-oauth servers', async () => {
      setupConfig({
        mcpServers: {
          remote: { url: 'https://mcp.example.com/mcp' },
        },
      });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { remote: {} }, errors: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(MockedMCPOAuthClientProvider).not.toHaveBeenCalled();
    });

    it('reuses the same callback server when reconnecting an OAuth server', async () => {
      setupConfig({
        mcpServers: {
          remote: { url: 'https://mcp.example.com/mcp', auth: 'oauth' },
        },
      });

      let reconnectAttempt = 0;
      let redirectState: string | null = null;

      MockedMCPClient.mockImplementation(function (this: any, options: any) {
        this.reconnectServer = vi.fn().mockImplementation(async (serverName: string) => {
          reconnectAttempt += 1;

          if (reconnectAttempt === 1) {
            const provider = options.servers[serverName].authProvider as any;
            redirectState = await provider.stateGenerator();
            await provider.onRedirectToAuthorization(
              new URL(`https://mcp.example.com/authorize?state=${redirectState}`),
            );
          }
        });
        this.listToolsetsWithErrors = vi.fn().mockImplementation(async () => {
          if (reconnectAttempt === 0) {
            return {
              toolsets: {
                remote: { list: {} },
              },
              errors: {},
            };
          }

          if (reconnectAttempt === 1) {
            return {
              toolsets: {
                remote: {},
              },
              errors: {},
            };
          }

          return {
            toolsets: {
              remote: { list: {}, search: {} },
            },
            errors: {},
          };
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = trackManager(createMcpManager('/tmp/test'));
      await manager.init();

      const provider = MockedMCPOAuthClientProvider.mock.instances[0] as any;
      const reconnectPromise = manager.reconnectServer('remote');

      await vi.waitFor(() => {
        expect(mockedExec).toHaveBeenCalledTimes(1);
        expect(redirectState).toBeTruthy();
      });

      const response = await sendCallback(provider.redirectUrl, {
        code: 'reconnect-code',
        state: redirectState!,
      });

      expect(response.statusCode).toBe(200);

      const result = await reconnectPromise;

      expect(MockedMCPOAuthClientProvider).toHaveBeenCalledTimes(1);
      expect(reconnectAttempt).toBe(2);
      expect(mockedAuth).toHaveBeenCalledTimes(1);
      expect(
        mockedAuth.mock.calls.map(([, options]) => ({
          authorizationCode: (options as any).authorizationCode,
          serverUrl: (options as any).serverUrl.toString(),
        })),
      ).toEqual([
        {
          authorizationCode: 'reconnect-code',
          serverUrl: 'https://mcp.example.com/mcp',
        },
      ]);
      expect(result.connected).toBe(true);
      expect(result.toolNames).toEqual(['remote_list', 'remote_search']);
    });
  });

  describe('server statuses include transport', () => {
    it('sets transport to stdio for command-based servers', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: { tool: {} } }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const statuses = manager.getServerStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.transport).toBe('stdio');
    });

    it('sets transport to http for url-based servers', async () => {
      setupConfig({ mcpServers: { remote: { url: 'https://example.com/mcp' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { remote: { tool: {} } }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const statuses = manager.getServerStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.transport).toBe('http');
    });
  });

  describe('disconnect', () => {
    it('disconnects the MCPClient instance', async () => {
      setupConfig({
        mcpServers: {
          fs: { command: 'npx' },
          remote: { url: 'https://example.com/mcp' },
        },
      });
      const mockDisconnect = vi.fn().mockResolvedValue(undefined);
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: {}, remote: {} }, errors: {} });
        this.disconnect = mockDisconnect;
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();
      await manager.disconnect();

      expect(MockedMCPClient).toHaveBeenCalledTimes(1);
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('ignores disconnect errors gracefully', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: { tool: {} } }, errors: {} });
        this.disconnect = vi.fn().mockRejectedValue(new Error('Disconnect error'));
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();
      // Should not throw
      await expect(manager.disconnect()).resolves.not.toThrow();
    });
  });

  describe('reload', () => {
    it('disconnects old clients, reloads config, and reconnects', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: { tool: {} } }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      // Change config for reload
      setupConfig({ mcpServers: { newserver: { url: 'https://new.example.com/mcp' } } });
      await manager.reload();

      // Should have created MCPClient twice: once for init, once for reload
      expect(MockedMCPClient).toHaveBeenCalledTimes(2);
      const lastCall = MockedMCPClient.mock.calls[1]![0]!;
      expect(lastCall.id).toBe('mastra-code-mcp');
      expect(lastCall.servers).toHaveProperty('newserver');
    });

    it('clears old tools and statuses on reload', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi
          .fn()
          .mockResolvedValue({ toolsets: { fs: { read: {}, write: {} } }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(Object.keys(manager.getTools())).toHaveLength(2);

      // Reload with a different server
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { api: { fetch: {} } }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      await manager.reload();

      const tools = manager.getTools();
      expect(Object.keys(tools)).toHaveLength(1);
      expect(tools).toHaveProperty('api_fetch');
      expect(tools).not.toHaveProperty('fs_read');

      const statuses = manager.getServerStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.name).toBe('api');
    });
  });

  describe('getTools', () => {
    it('returns namespaced tools after init', async () => {
      setupConfig({
        mcpServers: {
          fs: { command: 'npx' },
          api: { url: 'https://api.example.com/mcp' },
        },
      });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: {
            fs: { read: { id: 'read' }, write: { id: 'write' } },
            api: { fetch: { id: 'fetch' } },
          },
          errors: {},
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const tools = manager.getTools();
      expect(tools).toHaveProperty('fs_read');
      expect(tools).toHaveProperty('fs_write');
      expect(tools).toHaveProperty('api_fetch');
      expect(Object.keys(tools)).toHaveLength(3);
    });

    it('returns empty object when no servers configured', async () => {
      setupConfig({});
      const manager = createMcpManager('/tmp/test');
      await manager.init();
      expect(manager.getTools()).toEqual({});
    });

    it('returns a copy so mutations do not affect internal state', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: { read: {} } }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const tools = manager.getTools();
      delete tools['fs_read'];

      // Internal state should be unaffected
      expect(manager.getTools()).toHaveProperty('fs_read');
    });
  });

  describe('connecting state', () => {
    it('pre-populates statuses as connecting before listToolsetsWithErrors resolves', async () => {
      setupConfig({
        mcpServers: {
          fs: { command: 'npx' },
          api: { url: 'https://api.example.com/mcp' },
        },
      });

      let statusesDuringConnect: any[] = [];

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockImplementation(async () => {
          // Capture statuses mid-connect, before listToolsetsWithErrors resolves
          statusesDuringConnect = manager.getServerStatuses();
          return { toolsets: { fs: { read: {} }, api: { fetch: {} } }, errors: {} };
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');

      // Before init, no statuses
      expect(manager.getServerStatuses()).toHaveLength(0);

      await manager.init();

      // During connect, statuses should have been in connecting state
      expect(statusesDuringConnect).toHaveLength(2);
      for (const s of statusesDuringConnect) {
        expect(s.connecting).toBe(true);
        expect(s.connected).toBe(false);
      }

      // After init, statuses should be finalized (no longer connecting)
      const statuses = manager.getServerStatuses();
      expect(statuses).toHaveLength(2);
      for (const s of statuses) {
        expect(s.connecting).toBeUndefined();
        expect(s.connected).toBe(true);
      }
    });
  });

  describe('zero-tool server handling', () => {
    it('marks a server with zero tools as failed on init', async () => {
      setupConfig({ mcpServers: { empty: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: { empty: {} },
          errors: {},
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const statuses = manager.getServerStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.connected).toBe(false);
      expect(statuses[0]!.error).toBe('Failed to connect');
    });

    it('marks a server with zero tools as failed on reconnect', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.reconnectServer = vi.fn().mockResolvedValue(undefined);
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: { fs: { read: {} } },
          errors: {},
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      // After reconnect, server has 0 tools
      const mockInstance = MockedMCPClient.mock.instances[0] as any;
      mockInstance.listToolsetsWithErrors.mockResolvedValue({
        toolsets: { fs: {} },
        errors: {},
      });

      const result = await manager.reconnectServer('fs');
      expect(result.connected).toBe(false);
      expect(result.error).toBe('Failed to connect');
    });
  });

  describe('reconnectServer', () => {
    it('returns error status for unknown server name', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: { read: {} } }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const result = await manager.reconnectServer('nonexistent');
      expect(result.connected).toBe(false);
      expect(result.error).toContain('not found in config');
    });

    it('returns error status when client not initialized', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      const manager = createMcpManager('/tmp/test');
      // Don't call init()

      const result = await manager.reconnectServer('fs');
      expect(result.connected).toBe(false);
      expect(result.error).toContain('not initialized');
    });

    it('reconnects a server successfully and updates tools', async () => {
      setupConfig({
        mcpServers: {
          fs: { command: 'npx' },
          api: { url: 'https://api.example.com/mcp' },
        },
      });

      const mockReconnectServer = vi.fn().mockResolvedValue(undefined);

      MockedMCPClient.mockImplementation(function (this: any) {
        this.reconnectServer = mockReconnectServer;
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: {
            fs: { read: {}, write: {} },
            api: { fetch: {} },
          },
          errors: {},
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      // Reconnect fs — mock returns updated tools
      const mockInstance = MockedMCPClient.mock.instances[0] as any;
      mockInstance.listToolsetsWithErrors.mockResolvedValue({
        toolsets: {
          fs: { read: {}, write: {}, list: {} },
          api: { fetch: {} },
        },
        errors: {},
      });

      const result = await manager.reconnectServer('fs');

      expect(mockReconnectServer).toHaveBeenCalledWith('fs');
      expect(result.connected).toBe(true);
      expect(result.toolCount).toBe(3);
      expect(result.toolNames).toEqual(['fs_read', 'fs_write', 'fs_list']);

      // Tools should be updated
      const tools = manager.getTools();
      expect(tools).toHaveProperty('fs_read');
      expect(tools).toHaveProperty('fs_write');
      expect(tools).toHaveProperty('fs_list');
      expect(tools).toHaveProperty('api_fetch');
    });

    it('removes old tools for the server before reconnecting', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.reconnectServer = vi.fn().mockResolvedValue(undefined);
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: { fs: { read: {}, write: {} } },
          errors: {},
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();
      expect(manager.getTools()).toHaveProperty('fs_write');

      // Reconnect — server now only has 'read' tool
      const mockInstance = MockedMCPClient.mock.instances[0] as any;
      mockInstance.listToolsetsWithErrors.mockResolvedValue({
        toolsets: { fs: { read: {} } },
        errors: {},
      });

      await manager.reconnectServer('fs');

      const tools = manager.getTools();
      expect(tools).toHaveProperty('fs_read');
      expect(tools).not.toHaveProperty('fs_write');
    });

    it('handles reconnect failure with error from reconnectServer', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.reconnectServer = vi.fn().mockRejectedValue(new Error('spawn ENOENT'));
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: { fs: { read: {} } },
          errors: {},
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const result = await manager.reconnectServer('fs');

      expect(result.connected).toBe(false);
      expect(result.error).toBe('spawn ENOENT');
      expect(result.toolCount).toBe(0);

      // Old tools should be removed
      expect(manager.getTools()).not.toHaveProperty('fs_read');
    });

    it('handles listToolsetsWithErrors returning error for server after reconnect', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.reconnectServer = vi.fn().mockResolvedValue(undefined);
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: { fs: { read: {} } },
          errors: {},
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      // After reconnect, listToolsetsWithErrors reports an error for fs
      const mockInstance = MockedMCPClient.mock.instances[0] as any;
      mockInstance.listToolsetsWithErrors.mockResolvedValue({
        toolsets: {},
        errors: { fs: 'Tool listing failed' },
      });

      const result = await manager.reconnectServer('fs');

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Tool listing failed');
    });

    it('handles server reconnecting with zero tools', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.reconnectServer = vi.fn().mockResolvedValue(undefined);
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: { fs: { read: {} } },
          errors: {},
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      // Reconnect returns empty toolset (no error, but no tools)
      const mockInstance = MockedMCPClient.mock.instances[0] as any;
      mockInstance.listToolsetsWithErrors.mockResolvedValue({
        toolsets: { fs: {} },
        errors: {},
      });

      const result = await manager.reconnectServer('fs');

      expect(result.connected).toBe(false);
      expect(result.error).toBe('Failed to connect');
    });

    it('sets connecting state during reconnect', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });

      let statusDuringReconnect: any = null;

      MockedMCPClient.mockImplementation(function (this: any) {
        this.reconnectServer = vi.fn().mockImplementation(async () => {
          // Capture status mid-reconnect
          statusDuringReconnect = manager.getServerStatuses().find(s => s.name === 'fs');
        });
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: { fs: { read: {} } },
          errors: {},
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      await manager.reconnectServer('fs');

      expect(statusDuringReconnect).not.toBeNull();
      expect(statusDuringReconnect.connecting).toBe(true);
      expect(statusDuringReconnect.connected).toBe(false);
    });

    it('detects correct transport type for reconnected server', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.reconnectServer = vi.fn().mockResolvedValue(undefined);
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: { api: { fetch: {} } },
          errors: {},
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const result = await manager.reconnectServer('api');
      expect(result.transport).toBe('http');
    });
  });

  describe('getServerLogs', () => {
    it('returns empty array when no logs captured', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: {} }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(manager.getServerLogs('fs')).toEqual([]);
    });

    it('returns empty array for unknown server', () => {
      setupConfig({});
      const manager = createMcpManager('/tmp/test');
      expect(manager.getServerLogs('nonexistent')).toEqual([]);
    });

    it('returns a copy so mutations do not affect internal state', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { fs: {} }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const logs = manager.getServerLogs('fs');
      logs.push('injected');

      expect(manager.getServerLogs('fs')).not.toContain('injected');
    });
  });
});
