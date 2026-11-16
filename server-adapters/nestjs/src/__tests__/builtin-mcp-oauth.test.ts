import { CompositeAuth, MastraAuthProvider, SimpleAuth } from '@mastra/core/server';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

const RESOURCE = 'https://mcp.example.com/api/mcp';

/** Bearer tokens are `<aud>` strings; the authenticated principal carries that audience. */
class AudienceAuth extends MastraAuthProvider<{ id: string; aud: string }> {
  async authenticateToken(token: string) {
    return token.startsWith('aud=') ? { id: 'user-1', aud: token.slice(4) } : null;
  }
  async authorizeUser() {
    return true;
  }
  verifyAudience(user: { aud: string }, audience: string) {
    return user.aud === audience;
  }
}

/** The NestJS bearer-only path must match the other adapters' MCP OAuth behavior. */
describe('NestJS built-in MCP OAuth challenge and audience', () => {
  let context: AdapterTestContext;
  let app: INestApplication;
  let expressApp: Application;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  afterEach(async () => {
    await app?.close();
    vi.restoreAllMocks();
  });

  async function start(server: Record<string, unknown>) {
    vi.spyOn(context.mastra, 'getServer').mockReturnValue(server as any);
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra: context.mastra })],
    }).compile();
    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();
  }

  const postMCP = (token?: string) =>
    executeExpressRequest(expressApp, {
      method: 'POST',
      path: '/api/mcp',
      headers: {
        host: 'localhost:4111',
        'content-type': 'application/json',
        accept: 'application/json, text/event-stream',
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    });

  it('challenges MCP 401s with resource_metadata, adding invalid_token when a token was sent', async () => {
    await start({ auth: new AudienceAuth() });

    const anonymous = await postMCP();
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers['www-authenticate']).toBe(
      'Bearer resource_metadata="http://localhost:4111/.well-known/oauth-protected-resource/api/mcp"',
    );

    const invalid = await postMCP('garbage');
    expect(invalid.status).toBe(401);
    expect(invalid.headers['www-authenticate']).toContain('error="invalid_token"');

    const otherRoute = await executeExpressRequest(expressApp, { method: 'GET', path: '/api/agents' });
    expect(otherRoute.status).toBe(401);
    expect(otherRoute.headers['www-authenticate']).toBeUndefined();
  });

  it('serves the metadata document at the URL the challenge advertises, and at the root well-known path', async () => {
    await start({ auth: new AudienceAuth(), mcp: { oauth: { authorizationServers: ['https://as.example.com'] } } });

    const challenge = (await postMCP()).headers['www-authenticate'] as string;
    const advertised = new URL(/resource_metadata="([^"]+)"/.exec(challenge)![1]!);

    for (const path of [advertised.pathname, '/.well-known/oauth-protected-resource']) {
      const res = await executeExpressRequest(expressApp, { method: 'GET', path, headers: { host: 'localhost:4111' } });
      expect(res.status, path).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body).toEqual({
        resource: 'http://localhost:4111/api/mcp',
        authorization_servers: ['https://as.example.com'],
        bearer_methods_supported: ['header'],
      });
    }
  });

  it('does not serve the metadata while the built-in MCP server is disabled', async () => {
    await start({ auth: new AudienceAuth(), mcp: { enabled: false } });
    const res = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/.well-known/oauth-protected-resource/api/mcp',
    });
    expect(res.status).toBe(404);
  });

  it('enforces the token audience only when server.mcp.oauth.resource is set', async () => {
    await start({ auth: new AudienceAuth(), mcp: { oauth: { resource: RESOURCE } } });

    const wrongAudience = await postMCP('aud=https://other.example.com');
    expect(wrongAudience.status).toBe(401);
    expect(wrongAudience.headers['www-authenticate']).toContain('error="invalid_token"');
    expect(wrongAudience.headers['www-authenticate']).toContain(
      'resource_metadata="https://mcp.example.com/.well-known/oauth-protected-resource/api/mcp"',
    );

    expect((await postMCP(`aud=${RESOURCE}`)).status).toBe(200);
    // Ordinary routes ignore the MCP audience.
    const agents = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents',
      headers: { authorization: 'Bearer aud=https://other.example.com' },
    });
    expect(agents.status).toBe(200);
  });

  it('accepts any audience while server.mcp.oauth.resource is unset', async () => {
    await start({ auth: new AudienceAuth() });
    expect((await postMCP('aud=https://other.example.com')).status).toBe(200);
  });

  it('sends no challenge while the built-in MCP server is disabled', async () => {
    await start({ auth: new AudienceAuth(), mcp: { enabled: false } });
    expect((await postMCP()).headers['www-authenticate']).toBeUndefined();
  });

  it('keeps enforcing the audience for an invalid resource, without advertising metadata', async () => {
    const resource = 'http://mcp.example.com/api/mcp';
    await start({ auth: new AudienceAuth(), mcp: { oauth: { resource } } });
    const anonymous = await postMCP();
    expect(anonymous.status).toBe(401);
    expect(anonymous.headers['www-authenticate']).toBeUndefined();
    const wrongAudience = await postMCP('aud=https://other.example.com');
    expect(wrongAudience.status).toBe(401);
    expect(wrongAudience.headers['www-authenticate']).toContain('error="invalid_token"');
    expect(wrongAudience.headers['www-authenticate']).not.toContain('resource_metadata');
    expect((await postMCP(`aud=${resource}`)).status).toBe(200);
  });
  it('serves a provider that cannot check the audience by default, and rejects it with requireAudience', async () => {
    const apiKeyAuth = () => new SimpleAuth({ tokens: { 'api-key': { id: 'key-user' } } });
    await start({ auth: apiKeyAuth(), mcp: { oauth: { resource: RESOURCE } } });
    expect((await postMCP('api-key')).status).toBe(200);
    await app.close();

    await start({ auth: apiKeyAuth(), mcp: { oauth: { resource: RESOURCE, requireAudience: true } } });
    const rejected = await postMCP('api-key');
    expect(rejected.status).toBe(401);
    expect(rejected.headers['www-authenticate']).toContain('error="invalid_token"');
  });

  it('with requireAudience, rejects only the CompositeAuth providers that cannot check the audience', async () => {
    await start({
      auth: new CompositeAuth([new AudienceAuth(), new SimpleAuth({ tokens: { 'api-key': { id: 'key-user' } } })]),
      mcp: { oauth: { resource: RESOURCE, requireAudience: true } },
    });
    expect((await postMCP(`aud=${RESOURCE}`)).status).toBe(200);
    expect((await postMCP('api-key')).status).toBe(401);
  });
});
