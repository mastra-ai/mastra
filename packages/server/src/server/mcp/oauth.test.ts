import { Mastra } from '@mastra/core/mastra';
import { CompositeAuth, MastraAuthProvider } from '@mastra/core/server';
import type { MastraAuthOAuthMetadata, ServerConfig } from '@mastra/core/server';
import { describe, expect, it, vi } from 'vitest';

import {
  checkMCPAudience,
  createMCPOAuthMetadataRoutes,
  isMCPOAuthDiscoveryEnabled,
  mcpResourceMetadataUrl,
  mcpWWWAuthenticate,
  resolveMCPResourceMetadata,
  warnOnUnenforcedMCPAudience,
} from './oauth';

class TestAuth extends MastraAuthProvider<{ aud?: string }> {
  constructor(name: string, hooks: { metadata?: MastraAuthOAuthMetadata; audience?: boolean } = {}) {
    super({ name });
    if (hooks.metadata) this.getOAuthMetadata = () => hooks.metadata;
    if (hooks.audience) this.verifyAudience = (user, audience) => user.aud === audience;
  }
  async authenticateToken() {
    return { aud: 'x' };
  }
  async authorizeUser() {
    return true;
  }
}

const mastraWith = (server: ServerConfig) => new Mastra({ logger: false, server });
const REQUEST_URL = 'http://localhost:4111/api/mcp';

describe('resolveMCPResourceMetadata', () => {
  it('derives the resource from the request, prefix, and mcp.path and uses provider hints', async () => {
    const mastra = mastraWith({
      mcp: { path: '/assistant' },
      auth: new TestAuth('jwt', { metadata: { authorizationServers: ['https://issuer.example'] } }),
    });
    expect(await resolveMCPResourceMetadata(mastra, '/v1', 'http://host:9000/.well-known/x')).toEqual({
      resource: 'http://host:9000/v1/assistant',
      authorization_servers: ['https://issuer.example'],
      bearer_methods_supported: ['header'],
    });
  });

  it('prefers server.mcp.oauth over provider hints', async () => {
    const mastra = mastraWith({
      mcp: {
        oauth: {
          resource: 'https://mcp.example.com/api/mcp',
          authorizationServers: ['https://configured.example'],
          scopesSupported: ['openid'],
        },
      },
      auth: new TestAuth('jwt', {
        metadata: { authorizationServers: ['https://hint.example'], scopesSupported: ['x'] },
      }),
    });
    expect(await resolveMCPResourceMetadata(mastra, '/api', REQUEST_URL)).toEqual({
      resource: 'https://mcp.example.com/api/mcp',
      authorization_servers: ['https://configured.example'],
      scopes_supported: ['openid'],
      bearer_methods_supported: ['header'],
    });
  });

  it('omits authorization servers and scopes when none are known', async () => {
    const mastra = mastraWith({ auth: new TestAuth('plain') });
    const metadata = await resolveMCPResourceMetadata(mastra, '/api', REQUEST_URL);
    expect(metadata).toEqual({ resource: 'http://localhost:4111/api/mcp', bearer_methods_supported: ['header'] });
  });
});

describe('metadata URL and challenge', () => {
  it('uses the configured resource origin, else the request origin', () => {
    expect(mcpResourceMetadataUrl(mastraWith({}), '/api', REQUEST_URL)).toBe(
      'http://localhost:4111/.well-known/oauth-protected-resource/api/mcp',
    );
    const proxied = mastraWith({ mcp: { oauth: { resource: 'https://public.example/api/mcp' } } });
    expect(mcpResourceMetadataUrl(proxied, '/api', REQUEST_URL)).toBe(
      'https://public.example/.well-known/oauth-protected-resource/api/mcp',
    );
  });

  it('builds a Bearer challenge with optional error parameters', async () => {
    const mastra = mastraWith({});
    expect(await mcpWWWAuthenticate(mastra, '/api', REQUEST_URL)).toBe(
      'Bearer resource_metadata="http://localhost:4111/.well-known/oauth-protected-resource/api/mcp"',
    );
    expect(await mcpWWWAuthenticate(mastra, '/api', REQUEST_URL, { error: 'invalid_token' })).toBe(
      'Bearer resource_metadata="http://localhost:4111/.well-known/oauth-protected-resource/api/mcp", error="invalid_token"',
    );
  });

  it('serves the root and path-suffixed well-known routes as public routes', () => {
    const routes = createMCPOAuthMetadataRoutes(mastraWith({ mcp: { path: '/assistant' } }), '/api');
    expect(routes.map(r => [r.method, r.path, r.requiresAuth])).toEqual([
      ['GET', '/.well-known/oauth-protected-resource', false],
      ['GET', '/.well-known/oauth-protected-resource/api/assistant', false],
    ]);
  });
});

describe('checkMCPAudience', () => {
  const resource = 'https://mcp.example.com/api/mcp';

  it('is not enforced unless server.mcp.oauth.resource is set', async () => {
    const mastra = mastraWith({ auth: new TestAuth('jwt', { audience: true }) });
    expect(await checkMCPAudience(mastra, { aud: 'other' })).toBe(true);
  });

  it('enforces the configured resource through the provider hook', async () => {
    const mastra = mastraWith({ mcp: { oauth: { resource } }, auth: new TestAuth('jwt', { audience: true }) });
    expect(await checkMCPAudience(mastra, { aud: resource })).toBe(true);
    expect(await checkMCPAudience(mastra, { aud: 'other' })).toBe(false);
  });

  it('accepts any audience for providers without the hook', async () => {
    const mastra = mastraWith({ mcp: { oauth: { resource } }, auth: new TestAuth('opaque') });
    expect(await checkMCPAudience(mastra, { aud: 'other' })).toBe(true);
  });
});

describe('warnOnUnenforcedMCPAudience', () => {
  const oauth = { resource: 'https://mcp.example.com/api/mcp' };

  it('warns once, naming composite members that cannot check the audience', () => {
    const mastra = mastraWith({
      mcp: { oauth },
      auth: new CompositeAuth([new TestAuth('jwt', { audience: true }), new TestAuth('opaque')]),
    });
    const warn = vi.spyOn(mastra.getLogger(), 'warn');
    warnOnUnenforcedMCPAudience(mastra);
    warnOnUnenforcedMCPAudience(mastra);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain('token audience is NOT enforced for opaque');
    expect(warn.mock.calls[0]![0]).not.toContain('jwt');
  });

  it('stays quiet when every provider checks the audience or no resource is set', () => {
    const enforced = mastraWith({ mcp: { oauth }, auth: new TestAuth('jwt', { audience: true }) });
    const unset = mastraWith({ auth: new TestAuth('opaque') });
    const warns = [vi.spyOn(enforced.getLogger(), 'warn'), vi.spyOn(unset.getLogger(), 'warn')];
    warnOnUnenforcedMCPAudience(enforced);
    warnOnUnenforcedMCPAudience(unset);
    for (const warn of warns) expect(warn).not.toHaveBeenCalled();
  });
});

describe('server.mcp.oauth.resource validation', () => {
  const withResource = (resource: string) =>
    mastraWith({ mcp: { oauth: { resource } }, auth: new TestAuth('jwt', { audience: true }) });

  it.each(['https://mcp.example.com/api/mcp', 'http://localhost:4111/api/mcp', 'http://127.0.0.1:4111/api/mcp'])(
    'accepts %s',
    resource => {
      expect(isMCPOAuthDiscoveryEnabled(withResource(resource))).toBe(true);
    },
  );

  it.each([
    'mcp.example.com/api/mcp',
    '/api/mcp',
    'http://mcp.example.com/api/mcp',
    'https://mcp.example.com/api/mcp#frag',
    'ftp://mcp.example.com/api/mcp',
  ])('rejects %s: logs one error and turns off discovery and audience checks', async resource => {
    const mastra = withResource(resource);
    const error = vi.spyOn(mastra.getLogger(), 'error');
    expect(isMCPOAuthDiscoveryEnabled(mastra)).toBe(false);
    expect(isMCPOAuthDiscoveryEnabled(mastra)).toBe(false);
    expect(await checkMCPAudience(mastra, { aud: 'other' })).toBe(true);
    expect(error).toHaveBeenCalledTimes(1);
    expect(error.mock.calls[0]![0]).toContain('server.mcp.oauth.resource');
  });
});
