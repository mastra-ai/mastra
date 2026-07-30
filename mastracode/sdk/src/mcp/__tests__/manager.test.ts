import { promises as fs } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadMcpConfig } from '../config.js';
import { createMcpManager } from '../manager.js';
import type { McpConfig, McpHttpServerConfig, McpStdioServerConfig } from '../types.js';

const mcpMocks = vi.hoisted(() => {
  const MCPClient = vi.fn(function (this: any) {
    // individual tests override listToolsets/disconnect via mockImplementation
  });
  const MCPOAuthClientProvider = vi.fn(function (this: any, options: any) {
    this.options = options;
  });
  return { MCPClient, MCPOAuthClientProvider };
});

// Mock @mastra/mcp before importing manager
vi.mock('@mastra/mcp', () => {
  return mcpMocks;
});

// Mock config module to control what loadMcpConfig returns
vi.mock('../config.js', async importOriginal => {
  const original = (await importOriginal()) as Record<string, unknown>;
  return {
    ...original,
    loadMcpConfig: vi.fn(() => ({})),
  };
});

const mockedLoadMcpConfig = vi.mocked(loadMcpConfig);
const MockedMCPClient = vi.mocked(mcpMocks.MCPClient);
const MockedMCPOAuthClientProvider = vi.mocked(mcpMocks.MCPOAuthClientProvider);

function setupConfig(config: McpConfig) {
  mockedLoadMcpConfig.mockReturnValue(config);
}

describe('createMcpManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

      expect(MockedMCPClient).toHaveBeenCalledWith({
        id: 'mastra-code-mcp',
        servers: {
          fs: { command: 'npx', args: ['-y', 'mcp-fs'], env: { HOME: '/tmp' }, stderr: 'pipe' },
        },
        timeout: 7 * 24 * 60 * 60 * 1000,
      });
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

    it('builds http server def with OAuth authProvider', async () => {
      const httpConfig: McpHttpServerConfig = {
        url: 'https://mcp.example.com/mcp',
        oauth: {
          redirectUrl: 'http://localhost:3000/oauth/callback',
          clientName: 'Remote MCP',
          scopes: ['mcp:read', 'mcp:write'],
          clientId: 'client-id',
          clientSecret: 'client-secret',
        },
      };
      setupConfig({ mcpServers: { remote: httpConfig } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { remote: {} }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      const serverDef = call.servers['remote'] as any;
      expect(serverDef.authProvider).toBeInstanceOf(mcpMocks.MCPOAuthClientProvider);
      expect(MockedMCPOAuthClientProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUrl: 'http://localhost:3000/oauth/callback',
          clientMetadata: {
            redirect_uris: ['http://localhost:3000/oauth/callback'],
            client_name: 'Remote MCP',
            grant_types: ['authorization_code', 'refresh_token'],
            response_types: ['code'],
            scope: 'mcp:read mcp:write',
          },
          clientInformation: {
            client_id: 'client-id',
            client_secret: 'client-secret',
          },
          storage: expect.anything(),
        }),
      );
    });

    it('honors oauth.callbackPort for programmatically registered servers that bypass config parsing', async () => {
      // extraServers skip validateConfig/parseOAuthConfig entirely, so the
      // manager itself must resolve the callbackPort shorthand — otherwise a
      // compiling `{ callbackPort }` config would silently authenticate
      // against the default redirect URL.
      setupConfig({ mcpServers: {} });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { slack: {} }, errors: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test', undefined, {
        slack: {
          url: 'https://mcp.slack.com/mcp',
          oauth: { clientId: 'slack-client-id', callbackPort: 3118 },
        },
      });
      await manager.init();

      expect(MockedMCPOAuthClientProvider).toHaveBeenCalledWith(
        expect.objectContaining({
          redirectUrl: 'http://localhost:3118/callback',
          clientMetadata: expect.objectContaining({
            redirect_uris: ['http://localhost:3118/callback'],
          }),
        }),
      );

      // callbackPort must also feed the token-storage fingerprint: the same
      // server without callbackPort resolves a different redirect URL and must
      // not collide with (and thus reuse/overwrite) the pinned-port tokens.
      const managerWithoutPort = createMcpManager('/tmp/test', undefined, {
        slack: {
          url: 'https://mcp.slack.com/mcp',
          oauth: { clientId: 'slack-client-id' },
        },
      });
      await managerWithoutPort.init();

      const pinnedStoragePath = MockedMCPOAuthClientProvider.mock.calls[0]?.[0]?.storage?.filePath;
      const defaultStoragePath = MockedMCPOAuthClientProvider.mock.calls[1]?.[0]?.storage?.filePath;
      expect(pinnedStoragePath).toEqual(expect.stringMatching(/mcp-oauth\/[a-f0-9]{16}\.json$/));
      expect(defaultStoragePath).toEqual(expect.stringMatching(/mcp-oauth\/[a-f0-9]{16}\.json$/));
      expect(pinnedStoragePath).not.toBe(defaultStoragePath);
    });

    it('uses separate OAuth token storage for the same server name in different projects', async () => {
      const dataDir = await fs.mkdtemp(join(tmpdir(), 'mc-oauth-test-'));
      const prevDataDir = process.env.MASTRA_APP_DATA_DIR;
      process.env.MASTRA_APP_DATA_DIR = dataDir;
      try {
        const httpConfig: McpHttpServerConfig = {
          url: 'https://mcp.example.com/mcp',
          oauth: {
            redirectUrl: 'http://localhost:3000/oauth/callback',
            clientName: 'Remote MCP',
            scopes: ['mcp:read'],
            clientId: 'client-id',
          },
        };
        setupConfig({ mcpServers: { remote: httpConfig } });

        MockedMCPClient.mockImplementation(function (this: any) {
          this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { remote: {} }, errors: {} });
          this.disconnect = vi.fn().mockResolvedValue(undefined);
        } as any);

        await createMcpManager('/tmp/project-a').init();
        await createMcpManager('/tmp/project-b').init();

        const firstStoragePath = MockedMCPOAuthClientProvider.mock.calls[0]?.[0]?.storage?.filePath;
        const secondStoragePath = MockedMCPOAuthClientProvider.mock.calls[1]?.[0]?.storage?.filePath;
        expect(firstStoragePath).toEqual(expect.stringMatching(/mcp-oauth\/[a-f0-9]{16}\.json$/));
        expect(secondStoragePath).toEqual(expect.stringMatching(/mcp-oauth\/[a-f0-9]{16}\.json$/));
        expect(firstStoragePath).not.toBe(secondStoragePath);
      } finally {
        if (prevDataDir === undefined) {
          delete process.env.MASTRA_APP_DATA_DIR;
        } else {
          process.env.MASTRA_APP_DATA_DIR = prevDataDir;
        }
        await fs.rm(dataDir, { recursive: true, force: true });
      }
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

      const manager = createMcpManager('/tmp/test', undefined, {
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

      const manager = createMcpManager('/tmp/test', undefined, {
        myserver: { command: 'new-cmd', args: ['--flag'] },
      });
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      expect((call.servers['myserver'] as any).command).toBe('new-cmd');
      expect((call.servers['myserver'] as any).args).toEqual(['--flag']);
    });

    it('hasServers returns true when only extraServers provided and config is empty', () => {
      setupConfig({});
      const manager = createMcpManager('/tmp/test', undefined, {
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

      const manager = createMcpManager('/tmp/test', undefined, {
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

  describe('needs-auth status', () => {
    it('surfaces needsAuth from the client auth state for OAuth-configured servers', async () => {
      setupConfig({
        mcpServers: {
          api: {
            url: 'https://api.example.com/mcp',
            oauth: { redirectUrl: 'http://127.0.0.1:1458/oauth/callback' },
          },
        },
      });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: {}, errors: { api: 'Unauthorized' } });
        this.getServerAuthState = vi.fn().mockReturnValue('needs-auth');
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const statuses = manager.getServerStatuses();
      expect(statuses[0]!.needsAuth).toBe(true);
      expect(statuses[0]!.connected).toBe(false);
    });

    it('flags a bare url server whose connect error is a 401 as needing auth', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: {},
          errors: { api: 'Streamable HTTP error: Error POSTing to endpoint (HTTP 401): invalid_token' },
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(manager.getServerStatuses()[0]!.needsAuth).toBe(true);
    });

    it('flags a bare url server whose connect error carries only the bearer error code', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: {},
          // The SDK flattens 401 bodies without the status code — only the
          // RFC 6750 bearer error code survives in the message
          errors: { api: 'Streamable HTTP error: Error POSTing to endpoint: {"error":"invalid_token"}' },
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(manager.getServerStatuses()[0]!.needsAuth).toBe(true);
    });

    it('does not flag non-auth connect failures', async () => {
      setupConfig({
        mcpServers: {
          api: { url: 'https://api.example.com/mcp' },
          fs: { command: 'npx' },
        },
      });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({
          toolsets: {},
          // The stdio error mentions 401 to prove the heuristic only applies to HTTP servers
          errors: { api: 'fetch failed: ECONNREFUSED', fs: 'spawn npx ENOENT after HTTP 401 from registry' },
        });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      for (const status of manager.getServerStatuses()) {
        expect(status.needsAuth).toBeUndefined();
      }
    });
  });

  describe('authenticateServer', () => {
    function setupAuthenticatingClient(overrides: Record<string, any> = {}) {
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { api: { fetch: {} } }, errors: {} });
        this.authenticate = vi.fn().mockResolvedValue(undefined);
        this.disconnect = vi.fn().mockResolvedValue(undefined);
        Object.assign(this, overrides);
      } as any);
    }

    it('returns error status for unknown server name', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      setupAuthenticatingClient();

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const result = await manager.authenticateServer('nonexistent');
      expect(result.connected).toBe(false);
      expect(result.error).toContain('not found in config');
    });

    it('returns error status for stdio servers', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      setupAuthenticatingClient();

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const result = await manager.authenticateServer('fs');
      expect(result.connected).toBe(false);
      expect(result.error).toContain('does not support OAuth');
    });

    it('provisions a zero-config OAuth provider for bare url entries and authenticates', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      setupAuthenticatingClient();

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      // Bare entries get no eager provider — provisioning happens on authenticate
      expect(MockedMCPOAuthClientProvider).not.toHaveBeenCalled();

      const result = await manager.authenticateServer('api');

      expect(MockedMCPOAuthClientProvider).toHaveBeenCalledTimes(1);
      const options = MockedMCPOAuthClientProvider.mock.calls[0]![0]!;
      expect(options.redirectUrl).toBe('http://127.0.0.1:1458/oauth/callback');
      expect(options.clientMetadata.redirect_uris).toEqual(['http://127.0.0.1:1458/oauth/callback']);
      expect(options.clientInformation).toBeUndefined();

      // The provider is attached to the live server def so the client sees it
      const serverDef = (MockedMCPClient.mock.calls[0]![0]! as any).servers['api'];
      expect(serverDef.authProvider).toBeInstanceOf(mcpMocks.MCPOAuthClientProvider);

      const mockInstance = MockedMCPClient.mock.instances[0] as any;
      expect(mockInstance.authenticate).toHaveBeenCalledWith('api', undefined);
      expect(result.connected).toBe(true);
      expect(result.toolNames).toEqual(['api_fetch']);
    });

    it('keeps the configured provider for servers with an explicit oauth block', async () => {
      setupConfig({
        mcpServers: {
          api: {
            url: 'https://api.example.com/mcp',
            oauth: { redirectUrl: 'http://localhost:3000/oauth/callback' },
          },
        },
      });
      setupAuthenticatingClient();

      const manager = createMcpManager('/tmp/test');
      await manager.init();
      expect(MockedMCPOAuthClientProvider).toHaveBeenCalledTimes(1);

      await manager.authenticateServer('api');

      // No second provider — the configured one wins
      expect(MockedMCPOAuthClientProvider).toHaveBeenCalledTimes(1);
      expect(MockedMCPOAuthClientProvider.mock.calls[0]![0]!.redirectUrl).toBe('http://localhost:3000/oauth/callback');
    });

    it('passes timeoutMs through to the client', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      setupAuthenticatingClient();

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      await manager.authenticateServer('api', { timeoutMs: 1000 });

      const mockInstance = MockedMCPClient.mock.instances[0] as any;
      expect(mockInstance.authenticate).toHaveBeenCalledWith('api', { timeoutMs: 1000 });
    });

    it('surfaces the authorization URL through onAuthorizationUrl', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      setupAuthenticatingClient({
        authenticate: vi.fn().mockImplementation(async () => {
          // Simulate the SDK delivering the authorization URL through the provider
          const providerOptions = MockedMCPOAuthClientProvider.mock.calls[0]![0]!;
          providerOptions.onRedirectToAuthorization(new URL('https://auth.example.com/authorize?state=abc'));
        }),
      });

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const seenUrls: string[] = [];
      await manager.authenticateServer('api', { onAuthorizationUrl: url => seenUrls.push(url) });

      expect(seenUrls).toEqual(['https://auth.example.com/authorize?state=abc']);
    });

    it('returns a needs-auth error status when authentication fails', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      setupAuthenticatingClient({
        authenticate: vi.fn().mockRejectedValue(new Error('Timed out waiting for the OAuth callback')),
        getServerAuthState: vi.fn().mockReturnValue('needs-auth'),
      });

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const result = await manager.authenticateServer('api');
      expect(result.connected).toBe(false);
      expect(result.error).toContain('Timed out');
      expect(result.needsAuth).toBe(true);
    });

    it('rejects a concurrent second attempt even without an onAuthorizationUrl handler', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      let releaseAuth: () => void = () => {};
      const authGate = new Promise<void>(resolve => {
        releaseAuth = resolve;
      });
      const authenticate = vi.fn().mockImplementation(async () => {
        await authGate;
      });
      setupAuthenticatingClient({ authenticate });

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      // Neither call passes onAuthorizationUrl, so the guard must key on the
      // manager's authenticating set rather than the authUrlHandlers slot.
      const first = manager.authenticateServer('api');
      const second = await manager.authenticateServer('api');

      expect(second.error).toContain('already in progress');

      releaseAuth();
      await first;

      // The in-flight flow ran once; the duplicate never reached the client.
      expect(authenticate).toHaveBeenCalledTimes(1);
    });

    it('marks the resolved status as cancelled when the flow was cancelled', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      let releaseAuth: () => void = () => {};
      const authGate = new Promise<void>(resolve => {
        releaseAuth = resolve;
      });
      setupAuthenticatingClient({
        // The flow parks until cancelled, then resolves with a failed auth state.
        authenticate: vi.fn().mockImplementation(async () => {
          await authGate;
          throw new Error('OAuth callback server closed before receiving an authorization code');
        }),
        getServerAuthState: vi.fn().mockReturnValue('needs-auth'),
        cancelAuthentication: vi.fn().mockImplementation(() => {
          releaseAuth();
          return true;
        }),
      });

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const authPromise = manager.authenticateServer('api');
      const cancelled = await manager.cancelServerAuthentication('api');
      const result = await authPromise;

      expect(cancelled).toBe(true);
      expect(result.connected).toBe(false);
      // The durable cancelled marker lets the UI suppress a "Failed" toast even
      // if the selector was closed and reopened during the flow.
      expect(result.cancelled).toBe(true);
      // It must survive on the manager's durable snapshot, not just the returned
      // value — a reopened selector reads getServerStatuses(), not the promise.
      expect(manager.getServerStatuses()[0]!.cancelled).toBe(true);
    });

    it('does not mark a genuine failure as cancelled', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      setupAuthenticatingClient({
        authenticate: vi.fn().mockRejectedValue(new Error('Timed out waiting for the OAuth callback')),
        getServerAuthState: vi.fn().mockReturnValue('needs-auth'),
      });

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const result = await manager.authenticateServer('api');
      expect(result.connected).toBe(false);
      expect(result.cancelled).toBeUndefined();
    });
  });

  describe('OAuth token storage fingerprint', () => {
    it('is stable across zero-config provisioning and manager instantiations', async () => {
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { api: { fetch: {} } }, errors: {} });
        this.authenticate = vi.fn().mockResolvedValue(undefined);
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      await createMcpManager('/tmp/project-a').init();
      const firstManager = createMcpManager('/tmp/project-a');
      await firstManager.init();
      await firstManager.authenticateServer('api');
      const firstStoragePath = MockedMCPOAuthClientProvider.mock.calls[0]?.[0]?.storage?.filePath;

      vi.clearAllMocks();
      setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { api: { fetch: {} } }, errors: {} });
        this.authenticate = vi.fn().mockResolvedValue(undefined);
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const secondManager = createMcpManager('/tmp/project-a');
      await secondManager.init();
      await secondManager.authenticateServer('api');
      const secondStoragePath = MockedMCPOAuthClientProvider.mock.calls[0]?.[0]?.storage?.filePath;

      expect(firstStoragePath).toEqual(expect.stringMatching(/mcp-oauth\/[a-f0-9]{16}\.json$/));
      expect(secondStoragePath).toBe(firstStoragePath);
    });

    it('eagerly attaches a provider on init when a previous session persisted OAuth state', async () => {
      const dataDir = await fs.mkdtemp(join(tmpdir(), 'mc-oauth-test-'));
      const prevDataDir = process.env.MASTRA_APP_DATA_DIR;
      process.env.MASTRA_APP_DATA_DIR = dataDir;
      try {
        setupConfig({ mcpServers: { api: { url: 'https://api.example.com/mcp' } } });
        MockedMCPClient.mockImplementation(function (this: any) {
          this.listToolsetsWithErrors = vi.fn().mockResolvedValue({ toolsets: { api: { fetch: {} } }, errors: {} });
          this.authenticate = vi.fn().mockResolvedValue(undefined);
          this.disconnect = vi.fn().mockResolvedValue(undefined);
        } as any);

        // Session 1: no persisted state — provider only appears on authenticate
        const firstManager = createMcpManager('/tmp/project-a');
        await firstManager.init();
        expect(MockedMCPOAuthClientProvider).not.toHaveBeenCalled();
        await firstManager.authenticateServer('api');
        const storagePath = MockedMCPOAuthClientProvider.mock.calls[0]![0]!.storage.filePath as string;

        // Simulate the provider having persisted tokens to disk
        await fs.mkdir(dirname(storagePath), { recursive: true });
        await fs.writeFile(storagePath, JSON.stringify({ tokens: { access_token: 'stored' } }));

        // Session 2: persisted state — provider attaches eagerly so tokens are used
        MockedMCPOAuthClientProvider.mockClear();
        const secondManager = createMcpManager('/tmp/project-a');
        await secondManager.init();
        expect(MockedMCPOAuthClientProvider).toHaveBeenCalledTimes(1);
        expect(MockedMCPOAuthClientProvider.mock.calls[0]![0]!.storage.filePath).toBe(storagePath);
      } finally {
        if (prevDataDir === undefined) {
          delete process.env.MASTRA_APP_DATA_DIR;
        } else {
          process.env.MASTRA_APP_DATA_DIR = prevDataDir;
        }
        await fs.rm(dataDir, { recursive: true, force: true });
      }
    });
  });
});
