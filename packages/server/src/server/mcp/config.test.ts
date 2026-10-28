import { Mastra } from '@mastra/core/mastra';
import type { ServerConfig } from '@mastra/core/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { getBuiltinMCPTransportOptions, isBuiltinMCPEnabled, resolveBuiltinMCPPath } from './config';

const auth = { authenticateToken: async () => null } as unknown as ServerConfig['auth'];
const mastraWith = (server: ServerConfig) => new Mastra({ logger: false, server });

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('isBuiltinMCPEnabled', () => {
  it('serves under mastra dev, and in production only with server.auth', () => {
    vi.stubEnv('MASTRA_DEV', '');
    expect(isBuiltinMCPEnabled(mastraWith({}))).toBe(false);
    expect(isBuiltinMCPEnabled(mastraWith({ auth }))).toBe(true);
    vi.stubEnv('MASTRA_DEV', 'true');
    expect(isBuiltinMCPEnabled(mastraWith({}))).toBe(true);
    expect(isBuiltinMCPEnabled(mastraWith({ mcp: { enabled: false }, auth }))).toBe(false);
  });

  it('serves without auth when enabled explicitly, warning once', () => {
    vi.stubEnv('MASTRA_DEV', '');
    const mastra = mastraWith({ mcp: { enabled: true } });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    expect(isBuiltinMCPEnabled(mastra)).toBe(true);
    expect(isBuiltinMCPEnabled(mastra)).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('resolveBuiltinMCPPath', () => {
  it('uses server.mcp.path and rejects paths that would shadow the MCP server registry', () => {
    expect(resolveBuiltinMCPPath(mastraWith({}))).toBe('/mcp');
    expect(resolveBuiltinMCPPath(mastraWith({ mcp: { path: '/assistant/mcp/' } }))).toBe('/assistant/mcp');
    expect(resolveBuiltinMCPPath(mastraWith({ mcp: { path: '/mcp/v0/servers' } }))).toBe('/mcp');
    expect(resolveBuiltinMCPPath(mastraWith({ mcp: { path: '/mcp/:serverId/mcp' } }))).toBe('/mcp');
    expect(resolveBuiltinMCPPath(mastraWith({ mcp: { path: 'relative' } }))).toBe('/mcp');
  });
});

describe('getBuiltinMCPTransportOptions', () => {
  it('validates Origin/Host only under mastra dev', () => {
    vi.stubEnv('MASTRA_DEV', '');
    expect(getBuiltinMCPTransportOptions(mastraWith({}))).toBeUndefined();
    vi.stubEnv('MASTRA_DEV', 'true');
    expect(getBuiltinMCPTransportOptions(mastraWith({ host: 'devbox.local' }))).toMatchObject({
      enableDnsRebindingProtection: true,
      allowedHosts: ['localhost', '127.0.0.1', '[::1]', 'devbox.local'],
    });
  });
});
