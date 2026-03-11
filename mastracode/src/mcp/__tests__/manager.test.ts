import { MCPClient, MCPOAuthClientProvider } from '@mastra/mcp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadMcpConfig } from '../config.js';
import { createMcpManager } from '../manager.js';
import type { McpConfig, McpHttpServerConfig, McpStdioServerConfig } from '../types.js';

vi.mock('@mastra/mcp', () => {
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
    it('builds stdio server def correctly', async () => {
      const stdioConfig: McpStdioServerConfig = { command: 'npx', args: ['-y', 'mcp-fs'], env: { HOME: '/tmp' } };
      setupConfig({ mcpServers: { fs: stdioConfig } });

      const mockListTools = vi.fn().mockResolvedValue({ fs_read: {} });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(MockedMCPClient).toHaveBeenCalledWith({
        id: 'mastra-code-mcp',
        servers: {
          fs: { command: 'npx', args: ['-y', 'mcp-fs'], env: { HOME: '/tmp' } },
        },
      });
    });

    it('builds http server def with URL object and requestInit', async () => {
      const httpConfig: McpHttpServerConfig = {
        url: 'https://mcp.example.com/sse',
        headers: { Authorization: 'Bearer tok' },
      };
      setupConfig({ mcpServers: { remote: httpConfig } });

      const mockListTools = vi.fn().mockResolvedValue({ remote_weather: {} });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn();
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

      const mockListTools = vi.fn().mockResolvedValue({});
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      const serverDef = call.servers['remote'] as any;
      expect(serverDef.url).toBeInstanceOf(URL);
      expect(serverDef.requestInit).toBeUndefined();
    });
  });

  describe('OAuth auth wiring', () => {
    it('passes authProvider when auth is "oauth"', async () => {
      setupConfig({
        mcpServers: {
          remote: { url: 'https://mcp.example.com/mcp', auth: 'oauth' },
        },
      });

      const mockListTools = vi.fn().mockResolvedValue({ remote_tool: {} });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
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

      const mockListTools = vi.fn().mockResolvedValue({});
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
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

      const mockListTools = vi.fn().mockResolvedValue({});
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
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

      const mockListTools = vi.fn().mockResolvedValue({});
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(MockedMCPOAuthClientProvider).toHaveBeenCalledTimes(2);
    });

    it('configures OAuth provider with correct client metadata', async () => {
      setupConfig({
        mcpServers: {
          myserver: { url: 'https://mcp.example.com/mcp', auth: 'oauth' },
        },
      });

      const mockListTools = vi.fn().mockResolvedValue({});
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
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

      const mockListTools = vi.fn().mockResolvedValue({});
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const providerCall = MockedMCPOAuthClientProvider.mock.calls[0]![0]! as any;
      expect(providerCall.redirectUrl).toMatch(/^http:\/\/localhost:\d+\/oauth\/callback$/);
      expect(providerCall.clientMetadata.redirect_uris[0]).toBe(providerCall.redirectUrl);
    });

    it('does not start callback server for non-oauth servers', async () => {
      setupConfig({
        mcpServers: {
          remote: { url: 'https://mcp.example.com/mcp' },
        },
      });

      const mockListTools = vi.fn().mockResolvedValue({});
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(MockedMCPOAuthClientProvider).not.toHaveBeenCalled();
    });
  });

  describe('server statuses include transport', () => {
    it('sets transport to stdio for command-based servers', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = vi.fn().mockResolvedValue({ fs_tool: {} });
        this.disconnect = vi.fn();
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
        this.listTools = vi.fn().mockResolvedValue({ remote_tool: {} });
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const statuses = manager.getServerStatuses();
      expect(statuses).toHaveLength(1);
      expect(statuses[0]!.transport).toBe('http');
    });

    it('sets transport correctly on connection error', async () => {
      setupConfig({
        mcpServers: {
          local: { command: 'npx' },
          remote: { url: 'https://example.com/mcp' },
        },
      });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = vi.fn().mockRejectedValue(new Error('Connection failed'));
        this.disconnect = vi.fn();
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const statuses = manager.getServerStatuses();
      const local = statuses.find(s => s.name === 'local')!;
      const remote = statuses.find(s => s.name === 'remote')!;
      expect(local.transport).toBe('stdio');
      expect(remote.transport).toBe('http');
      expect(local.connected).toBe(false);
      expect(remote.connected).toBe(false);
    });
  });
});
