import type { IncomingMessage } from 'node:http';
import { RequestContext } from '@mastra/core/request-context';
import { describe, expect, it, vi } from 'vitest';

import { MASTRA_AUTH_TOKEN_KEY, MASTRA_USER_KEY } from '../constants';
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

  it('treats a hook that sets nothing as an explicit opt-out', async () => {
    const req = makeReq();

    await applyMcpRequestAuth({
      req,
      requestContext: makeContext({ [MASTRA_USER_KEY]: { id: 'user-1' } }),
      setRequestAuth: () => {},
    });

    expect(req.auth).toBeUndefined();
  });
});
