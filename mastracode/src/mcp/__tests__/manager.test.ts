import { MCPClient } from '@mastra/mcp';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadMcpConfig } from '../config.js';
import { createMcpManager } from '../manager.js';
import type { McpConfig, McpHttpServerConfig, McpStdioServerConfig } from '../types.js';

// Mock @mastra/mcp before importing manager
vi.mock('@mastra/mcp', () => {
  const MCPClient = vi.fn(function (this: any) {
    // individual tests override listTools/disconnect via mockImplementation
  });
  return { MCPClient };
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
const MockedMCPClient = vi.mocked(MCPClient);

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
    it('builds stdio server def correctly with per-server MCPClient', async () => {
      const stdioConfig: McpStdioServerConfig = { command: 'npx', args: ['-y', 'mcp-fs'], env: { HOME: '/tmp' } };
      setupConfig({ mcpServers: { fs: stdioConfig } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = vi.fn().mockResolvedValue({ fs_read: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(MockedMCPClient).toHaveBeenCalledWith({
        id: 'mastra-code-mcp-fs',
        servers: {
          fs: { command: 'npx', args: ['-y', 'mcp-fs'], env: { HOME: '/tmp' }, stderr: 'pipe' },
        },
      });
    });

    it('builds http server def with URL object and requestInit', async () => {
      const httpConfig: McpHttpServerConfig = {
        url: 'https://mcp.example.com/sse',
        headers: { Authorization: 'Bearer tok' },
      };
      setupConfig({ mcpServers: { remote: httpConfig } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = vi.fn().mockResolvedValue({ remote_weather: {} });
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
        this.listTools = vi.fn().mockResolvedValue({});
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      const call = MockedMCPClient.mock.calls[0]![0]!;
      const serverDef = call.servers['remote'] as any;
      expect(serverDef.url).toBeInstanceOf(URL);
      expect(serverDef.requestInit).toBeUndefined();
    });

    it('creates one MCPClient per server', async () => {
      setupConfig({
        mcpServers: {
          fs: { command: 'npx' },
          remote: { url: 'https://example.com/mcp' },
        },
      });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = vi.fn().mockResolvedValue({});
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      expect(MockedMCPClient).toHaveBeenCalledTimes(2);
      expect(MockedMCPClient.mock.calls[0]![0]!.id).toBe('mastra-code-mcp-fs');
      expect(MockedMCPClient.mock.calls[1]![0]!.id).toBe('mastra-code-mcp-remote');
    });
  });

  describe('extraServers parameter', () => {
    it('merges programmatic servers with file-based config', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx', args: ['-y', 'mcp-fs'] } } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = vi.fn().mockResolvedValue({});
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test', {
        remote: { url: 'https://mcp.example.com/sse' },
      });
      await manager.init();

      // Two MCPClients created — one for fs, one for remote
      expect(MockedMCPClient).toHaveBeenCalledTimes(2);
      const ids = MockedMCPClient.mock.calls.map(c => c[0]!.id);
      expect(ids).toContain('mastra-code-mcp-fs');
      expect(ids).toContain('mastra-code-mcp-remote');
    });

    it('programmatic servers override file-based servers with the same name', async () => {
      setupConfig({ mcpServers: { myserver: { command: 'old-cmd' } } });

      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = vi.fn().mockResolvedValue({});
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test', {
        myserver: { command: 'new-cmd', args: ['--flag'] },
      });
      await manager.init();

      // Only one MCPClient since the name is the same
      expect(MockedMCPClient).toHaveBeenCalledTimes(1);
      const serverDef = MockedMCPClient.mock.calls[0]![0]!.servers['myserver'] as any;
      expect(serverDef.command).toBe('new-cmd');
      expect(serverDef.args).toEqual(['--flag']);
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
        this.listTools = vi.fn().mockResolvedValue({});
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test', {
        extra: { url: 'https://example.com/mcp' },
      });
      await manager.init();
      await manager.reload();

      // After reload, should still create clients for both servers
      // init creates 2, reload creates 2 more = 4 total
      const allIds = MockedMCPClient.mock.calls.map(c => c[0]!.id);
      // Check the last two calls (from reload) include both servers
      const reloadIds = allIds.slice(-2);
      expect(reloadIds).toContain('mastra-code-mcp-fs');
      expect(reloadIds).toContain('mastra-code-mcp-extra');
    });
  });

  describe('initInBackground', () => {
    it('returns init result with connected and failed servers', async () => {
      setupConfig({
        mcpServers: { fs: { command: 'npx' } },
        skippedServers: [{ name: 'bad', reason: 'Invalid entry' }],
      });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = vi.fn().mockResolvedValue({ fs_read: {}, fs_write: {} });
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
        this.listTools = vi.fn().mockRejectedValue(new Error('Connection failed'));
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      const result = await manager.initInBackground();

      expect(result.connected).toHaveLength(0);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]!.name).toBe('remote');
      expect(result.totalTools).toBe(0);
    });

    it('handles mixed success and failure independently', async () => {
      setupConfig({
        mcpServers: {
          good: { command: 'npx', args: ['good-server'] },
          bad: { url: 'https://broken.example.com/mcp' },
          alsogood: { command: 'npx', args: ['also-good'] },
        },
      });

      // Each MCPClient instance gets its own listTools mock based on server name
      MockedMCPClient.mockImplementation(function (this: any, opts: any) {
        const serverName = Object.keys(opts.servers)[0];
        if (serverName === 'bad') {
          this.listTools = vi.fn().mockRejectedValue(new Error('Connection refused'));
        } else if (serverName === 'good') {
          this.listTools = vi.fn().mockResolvedValue({ good_tool1: {}, good_tool2: {} });
        } else {
          this.listTools = vi.fn().mockResolvedValue({ alsogood_tool1: {} });
        }
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      const result = await manager.initInBackground();

      expect(result.connected).toHaveLength(2);
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0]!.name).toBe('bad');
      expect(result.failed[0]!.error).toBe('Connection refused');
      expect(result.totalTools).toBe(3);

      // Tools from successful servers should be available
      const tools = manager.getTools();
      expect(tools).toHaveProperty('good_tool1');
      expect(tools).toHaveProperty('good_tool2');
      expect(tools).toHaveProperty('alsogood_tool1');
    });

    it('returns cached result if already initialized', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      const mockListTools = vi.fn().mockResolvedValue({ fs_read: {} });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();
      const result = await manager.initInBackground();

      expect(result.connected).toHaveLength(1);
      expect(result.totalTools).toBe(1);
      // listTools should only have been called once (from init, not again from initInBackground)
      expect(mockListTools).toHaveBeenCalledTimes(1);
    });
  });

  describe('server statuses include transport', () => {
    it('sets transport to stdio for command-based servers', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = vi.fn().mockResolvedValue({ fs_tool: {} });
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
        this.listTools = vi.fn().mockResolvedValue({ remote_tool: {} });
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
    it('disconnects all per-server MCPClient instances', async () => {
      setupConfig({
        mcpServers: {
          fs: { command: 'npx' },
          remote: { url: 'https://example.com/mcp' },
        },
      });
      const disconnectFns: Array<ReturnType<typeof vi.fn>> = [];
      MockedMCPClient.mockImplementation(function (this: any) {
        const fn = vi.fn().mockResolvedValue(undefined);
        disconnectFns.push(fn);
        this.listTools = vi.fn().mockResolvedValue({});
        this.disconnect = fn;
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();
      await manager.disconnect();

      // Each MCPClient instance should have been disconnected
      expect(disconnectFns).toHaveLength(2);
      for (const fn of disconnectFns) {
        expect(fn).toHaveBeenCalledTimes(1);
      }
    });

    it('ignores disconnect errors gracefully', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx' } } });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = vi.fn().mockResolvedValue({ fs_tool: {} });
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
        this.listTools = vi.fn().mockResolvedValue({ fs_tool: {} });
        this.disconnect = vi.fn().mockResolvedValue(undefined);
      } as any);

      const manager = createMcpManager('/tmp/test');
      await manager.init();

      // Change config for reload
      setupConfig({ mcpServers: { newserver: { url: 'https://new.example.com/mcp' } } });
      await manager.reload();

      // Should have created clients for both init and reload
      expect(MockedMCPClient.mock.calls.length).toBeGreaterThanOrEqual(2);
      const lastCall = MockedMCPClient.mock.calls[MockedMCPClient.mock.calls.length - 1]![0]!;
      expect(lastCall.id).toBe('mastra-code-mcp-newserver');
    });
  });
});
