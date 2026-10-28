import { Mastra } from '@mastra/core/mastra';
import type { ServerConfig } from '@mastra/core/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SERVER_ROUTES } from '../server-adapter/routes';

import {
  getBuiltinMCPTransportOptions,
  isBuiltinMCPEnabled,
  resolveBuiltinMCPConfig,
  resolveBuiltinMCPPath,
} from './config';
import { BUILTIN_MCP_HTTP_ROUTE, resolveServerRoute } from './route';

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

describe('resolveBuiltinMCPConfig isSelected', () => {
  it('matches include/exclude against every name of a primitive (id and registration key)', () => {
    const { isSelected } = resolveBuiltinMCPConfig(
      mastraWith({ mcp: { include: { agents: ['billingAgent', 'support'] }, exclude: { agents: ['support-agent'] } } }),
    );
    expect(isSelected('agents', ['billing-agent', 'billingAgent'])).toBe(true);
    expect(isSelected('agents', ['billing-agent'])).toBe(false);
    // Exclude wins when any name is excluded.
    expect(isSelected('agents', ['support-agent', 'support'])).toBe(false);
    expect(isSelected('workflows', 'anything')).toBe(true);
  });
});

describe('resolveServerRoute', () => {
  it('falls back to /mcp when server.mcp.path collides with an existing route, logging an error', () => {
    for (const path of ['/agents', '/agents/some-agent', '/workflows/w/runs/r']) {
      const mastra = mastraWith({ mcp: { path } });
      const error = vi.spyOn(mastra.getLogger(), 'error');
      expect(resolveServerRoute(BUILTIN_MCP_HTTP_ROUTE, mastra, SERVER_ROUTES).path).toBe('/mcp');
      expect(error).toHaveBeenCalledWith(expect.stringContaining('collides with'));
    }
    const custom = mastraWith({ mcp: { path: '/assistant/mcp' } });
    expect(resolveServerRoute(BUILTIN_MCP_HTTP_ROUTE, custom, SERVER_ROUTES).path).toBe('/assistant/mcp');
  });

  it('warns about a user MCP server with the reserved id when routes are registered', () => {
    const mastra = mastraWith({});
    vi.spyOn(mastra, 'getMCPServerById').mockReturnValue({} as any);
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    resolveServerRoute(BUILTIN_MCP_HTTP_ROUTE, mastra, SERVER_ROUTES);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('reserved for the built-in Mastra MCP server'));
  });
});
