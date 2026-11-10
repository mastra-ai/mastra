import type { IncomingMessage } from 'node:http';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { MASTRA_AUTH_TOKEN_KEY, MASTRA_USER_KEY, MASTRA_USER_PERMISSIONS_KEY } from '../constants';
import { applyMcpRequestAuth } from './mcp-auth';

function makeReq(): IncomingMessage & { auth?: any } {
  return {} as IncomingMessage & { auth?: any };
}

function makeContext(entries: Record<string, unknown>): RequestContext {
  const ctx = new RequestContext();
  for (const [key, value] of Object.entries(entries)) {
    ctx.set(key, value);
  }
  return ctx;
}

describe('applyMcpRequestAuth', () => {
  it('leaves an already-set req.auth untouched', async () => {
    const req = makeReq();
    req.auth = { token: 'existing', clientId: 'existing', scopes: [] };
    const setRequestAuth = vi.fn();

    await applyMcpRequestAuth({
      req,
      requestContext: makeContext({ [MASTRA_USER_KEY]: { id: 'user-1' } }),
      setRequestAuth,
    });

    expect(req.auth.token).toBe('existing');
    expect(setRequestAuth).not.toHaveBeenCalled();
  });

  it('bridges the request context user and token by default', async () => {
    const req = makeReq();

    await applyMcpRequestAuth({
      req,
      requestContext: makeContext({
        [MASTRA_USER_KEY]: { id: 'user-1', email: 'a@b.c', scopes: ['read', 'write'] },
        [MASTRA_AUTH_TOKEN_KEY]: 'tok-123',
      }),
    });

    expect(req.auth).toEqual({
      token: 'tok-123',
      clientId: 'user-1',
      scopes: ['read', 'write'],
      extra: { user: { id: 'user-1', email: 'a@b.c', scopes: ['read', 'write'] } },
    });
  });

  it('falls back through id/sub/userId/email for clientId', async () => {
    const req = makeReq();

    await applyMcpRequestAuth({
      req,
      requestContext: makeContext({ [MASTRA_USER_KEY]: { sub: 'sub-9' } }),
    });

    expect(req.auth.clientId).toBe('sub-9');
    expect(req.auth.token).toBe('');
  });

  it('normalizes space-delimited scope strings', async () => {
    const req = makeReq();

    await applyMcpRequestAuth({
      req,
      requestContext: makeContext({ [MASTRA_USER_KEY]: { id: 'u', scope: 'read write' } }),
    });

    expect(req.auth.scopes).toEqual(['read', 'write']);
  });

  it('bridges a token-only request context', async () => {
    const req = makeReq();

    await applyMcpRequestAuth({
      req,
      requestContext: makeContext({ [MASTRA_AUTH_TOKEN_KEY]: 'tok-only' }),
    });

    expect(req.auth).toEqual({ token: 'tok-only', clientId: '', scopes: [] });
  });

  it('leaves req.auth undefined when there is no identity', async () => {
    const req = makeReq();

    await applyMcpRequestAuth({ req, requestContext: makeContext({ foo: 'bar' }) });

    expect(req.auth).toBeUndefined();
  });

  it('awaits an async setRequestAuth hook and skips the auto-bridge', async () => {
    const req = makeReq();

    await applyMcpRequestAuth({
      req,
      requestContext: makeContext({ [MASTRA_USER_KEY]: { id: 'ignored' } }),
      setRequestAuth: async (r, ctx) => {
        await Promise.resolve();
        (r as any).auth = { token: 'custom', clientId: (ctx.get('custom') as string) ?? 'hook', scopes: ['admin'] };
      },
    });

    expect(req.auth).toEqual({ token: 'custom', clientId: 'hook', scopes: ['admin'] });
  });

  it("keeps a hook's auth info but still hands tools the caller Mastra server auth resolved", async () => {
    const req = makeReq();
    const trusted = Symbol.for('mastra.mcp.trustedRequestContext');

    await applyMcpRequestAuth({
      req,
      requestContext: makeContext({
        [MASTRA_USER_KEY]: { id: 'mastra-user' },
        [MASTRA_USER_PERMISSIONS_KEY]: ['observability:read'],
      }),
      setRequestAuth: r => {
        (r as any).auth = { token: 'custom', clientId: 'hook-principal', scopes: [] };
      },
    });

    expect(req.auth.clientId).toBe('hook-principal');
    expect(req.auth[trusted]).toEqual({
      [MASTRA_USER_KEY]: { id: 'mastra-user' },
      [MASTRA_USER_PERMISSIONS_KEY]: ['observability:read'],
    });
  });

  it('treats a hook that sets nothing as an explicit opt-out', async () => {
    const req = makeReq();

    await applyMcpRequestAuth({
      req,
      requestContext: makeContext({ [MASTRA_USER_KEY]: { id: 'user-1' } }),
      setRequestAuth: () => {},
    });

    expect(req.auth).toBeUndefined();
  });

  it('hands MCP tools the trusted request context without exposing it in the auth payload', async () => {
    const req = makeReq();
    const trusted = Symbol.for('mastra.mcp.trustedRequestContext');

    await applyMcpRequestAuth({
      req,
      requestContext: makeContext({
        [MASTRA_USER_KEY]: { id: 'user-1' },
        [MASTRA_AUTH_TOKEN_KEY]: 'tok-123',
        [MASTRA_USER_PERMISSIONS_KEY]: ['observability:read'],
        organizationId: 'org-1',
        notReserved: 'from the body',
      }),
    });

    expect(req.auth[trusted]).toEqual({
      [MASTRA_USER_KEY]: { id: 'user-1' },
      [MASTRA_USER_PERMISSIONS_KEY]: ['observability:read'],
      organizationId: 'org-1',
    });
    expect(JSON.parse(JSON.stringify(req.auth))).not.toHaveProperty('organizationId');
  });

  it('attaches the trusted request context to an identity set before Mastra', async () => {
    const req = makeReq();
    req.auth = { token: 'existing', clientId: 'existing', scopes: [] };

    await applyMcpRequestAuth({ req, requestContext: makeContext({ organizationId: 'org-1' }) });

    expect(req.auth[Symbol.for('mastra.mcp.trustedRequestContext')]).toEqual({ organizationId: 'org-1' });
  });
});
