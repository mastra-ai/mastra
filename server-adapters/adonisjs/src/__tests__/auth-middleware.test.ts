import { Mastra } from '@mastra/core/mastra';
import { afterEach, describe, expect, it } from 'vitest';
import { createAuthMiddleware } from '../index';
import { createAdonisRouter, listen } from './helpers';

const REFRESHED_COOKIE = 'session=valid; HttpOnly; Path=/';

function createMastra() {
  const mastra = new Mastra({ logger: false });
  const originalGetServer = mastra.getServer.bind(mastra);
  mastra.getServer = () =>
    ({
      ...originalGetServer(),
      auth: {
        authenticateToken: async (token: string, request: Request) =>
          token === 'valid-token' || request.headers.get('cookie')?.includes('session=valid') ? { id: 'user-1' } : null,
        authorize: async (path: string) => !path.startsWith('/custom/forbidden'),
        getSessionIdFromRequest: (request: Request) =>
          request.headers.get('cookie')?.includes('session=expired') ? 'session-1' : null,
        refreshSession: async () => ({ id: 'session-1' }),
        getSessionHeaders: () => ({ 'Set-Cookie': REFRESHED_COOKIE }),
      },
    }) as any;
  return mastra;
}

describe('AdonisJS createAuthMiddleware', () => {
  let close: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await close?.();
    close = undefined;
  });

  async function start(requiresAuth?: boolean) {
    const mastra = createMastra();
    const router = await createAdonisRouter();
    const auth = createAuthMiddleware({ mastra, requiresAuth });
    router.get('/custom/data', () => ({ ok: true })).use(auth);
    router.get('/custom/forbidden', () => ({ ok: true })).use(auth);
    router
      .get('/custom/cookie', () => ({ ok: true }))
      .use(async (ctx, next) => {
        ctx.response.append('set-cookie', 'theme=dark; Path=/');
        return next();
      })
      .use(auth);
    const server = await listen(router);
    close = server.close;
    return server.url;
  }

  it('protects application routes', async () => {
    const url = await start();
    expect((await fetch(`${url}/custom/data`)).status).toBe(401);
    const res = await fetch(`${url}/custom/data`, { headers: { Authorization: 'Bearer valid-token' } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it('accepts the apiKey query parameter', async () => {
    const url = await start();
    expect((await fetch(`${url}/custom/data?apiKey=valid-token`)).status).toBe(200);
  });

  it('can be opted out with requiresAuth: false', async () => {
    const url = await start(false);
    expect((await fetch(`${url}/custom/data`)).status).toBe(200);
  });

  it('returns 403 when authorize denies the request', async () => {
    const url = await start();
    const res = await fetch(`${url}/custom/forbidden`, { headers: { Authorization: 'Bearer valid-token' } });
    expect(res.status).toBe(403);
  });

  it('forwards refreshed session cookies, including on 403', async () => {
    const url = await start();
    const ok = await fetch(`${url}/custom/data`, { headers: { cookie: 'session=expired' } });
    expect(ok.status).toBe(200);
    expect(ok.headers.getSetCookie()).toContain(REFRESHED_COOKIE);
    const denied = await fetch(`${url}/custom/forbidden`, { headers: { cookie: 'session=expired' } });
    expect(denied.status).toBe(403);
    expect(denied.headers.getSetCookie()).toContain(REFRESHED_COOKIE);
  });

  it('keeps cookies set by earlier middleware', async () => {
    const url = await start();
    const res = await fetch(`${url}/custom/cookie`, { headers: { Authorization: 'Bearer valid-token' } });
    expect(res.status).toBe(200);
    expect(res.headers.getSetCookie()).toContain('theme=dark; Path=/');
  });
});
