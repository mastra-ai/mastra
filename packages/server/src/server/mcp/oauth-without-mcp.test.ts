import { Mastra } from '@mastra/core/mastra';
import { RequestContext } from '@mastra/core/request-context';
import { MastraAuthProvider } from '@mastra/core/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

class IssuerAuth extends MastraAuthProvider {
  async authenticateToken() {
    return null;
  }
  async authorizeUser() {
    return true;
  }
  getOAuthMetadata() {
    return { authorizationServers: ['https://issuer.example'] };
  }
}

/** `@mastra/mcp` is an optional peer: OAuth discovery must not need it, so 401s never turn into 500s. */
describe('MCP OAuth discovery without @mastra/mcp installed', () => {
  afterEach(() => {
    vi.doUnmock('@mastra/mcp');
  });

  async function loadWithoutMCP() {
    vi.resetModules();
    vi.doMock('@mastra/mcp', () => {
      throw Object.assign(new Error("Cannot find package '@mastra/mcp' imported from /app/.mastra/output/index.mjs"), {
        code: 'ERR_MODULE_NOT_FOUND',
      });
    });
    return import('./oauth');
  }

  const mastra = () => new Mastra({ logger: false, server: { auth: new IssuerAuth({ name: 'jwt' }) } });

  it('still builds the 401 challenge', async () => {
    const { mcpWWWAuthenticate } = await loadWithoutMCP();
    const m = mastra();
    expect(await mcpWWWAuthenticate(m, '/api', 'http://localhost:4111/api/mcp')).toBe(
      'Bearer resource_metadata="http://localhost:4111/.well-known/oauth-protected-resource/api/mcp"',
    );
    expect(
      await mcpWWWAuthenticate(m, '/api', 'http://localhost:4111/api/mcp', {
        error: 'invalid_token',
        error_description: 'say "hi"',
      }),
    ).toBe(
      'Bearer resource_metadata="http://localhost:4111/.well-known/oauth-protected-resource/api/mcp", ' +
        'error="invalid_token", error_description="say \\"hi\\""',
    );
  });

  it('still serves the protected-resource metadata', async () => {
    const { createMCPOAuthMetadataRoutes } = await loadWithoutMCP();
    const m = mastra();
    for (const route of createMCPOAuthMetadataRoutes(m, '/api')) {
      const response = (await route.handler({
        mastra: m,
        requestContext: new RequestContext(),
        request: new Request(`http://localhost:4111${route.path}`),
      } as any)) as Response;
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(await response.json()).toEqual({
        resource: 'http://localhost:4111/api/mcp',
        authorization_servers: ['https://issuer.example'],
        bearer_methods_supported: ['header'],
      });
    }
  });
});
