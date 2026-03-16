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

  describe('extraServers parameter', () => {
    it('merges programmatic servers with file-based config', async () => {
      setupConfig({ mcpServers: { fs: { command: 'npx', args: ['-y', 'mcp-fs'] } } });

      const mockListTools = vi.fn().mockResolvedValue({ fs_read: {}, remote_weather: {} });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
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

      const mockListTools = vi.fn().mockResolvedValue({});
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
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

      const mockListTools = vi.fn().mockResolvedValue({ fs_tool: {}, extra_tool: {} });
      MockedMCPClient.mockImplementation(function (this: any) {
        this.listTools = mockListTools;
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
