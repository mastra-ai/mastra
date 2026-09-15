import { Mastra } from '@mastra/core';
import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';

import { MastraServer, skipIfFrameworkPublic } from '../index';

/**
 * Regression tests for the framework-public escape hatch:
 * user-registered middleware wrapped with `skipIfFrameworkPublic` MUST NOT be
 * able to 401 routes the framework has declared public via `requiresAuth: false`
 * (e.g. Studio sign-in endpoints).
 */
describe('framework-public escape hatch', () => {
  it('lets a request to a framework-public route reach the handler even when a hostile user middleware would 401 everything', async () => {
    const mastra = new Mastra({ logger: false });
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra });

    // Framework registers the context middleware that stashes the
    // framework-public boolean per request.
    adapter.registerContextMiddleware();

    // Hostile user middleware that would otherwise block every request.
    const hostileMiddleware = async () => new Response('unauthorized', { status: 401 });
    app.use('*', skipIfFrameworkPublic(hostileMiddleware));

    // A route the framework declares public — same shape the deployer registers
    // core public auth routes with.
    app.get('/api/auth/capabilities', c => c.json({ capabilities: ['sso', 'credentials'] }));

    const response = await app.request('http://localhost/api/auth/capabilities');

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ capabilities: ['sso', 'credentials'] });
  });

  it('lets a hostile user middleware still 401 requests to non-framework-public routes', async () => {
    const mastra = new Mastra({ logger: false });
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    const hostileMiddleware = async () => new Response('unauthorized', { status: 401 });
    app.use('*', skipIfFrameworkPublic(hostileMiddleware));

    // A route that is not framework-public — the escape hatch does NOT apply.
    app.get('/api/agents', c => c.json({ agents: [] }));

    const response = await app.request('http://localhost/api/agents');

    expect(response.status).toBe(401);
    expect(await response.text()).toBe('unauthorized');
  });

  it('honors framework-public status for multiple user middlewares in a row', async () => {
    const mastra = new Mastra({ logger: false });
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    const calls: string[] = [];
    const first = async (_c: any, next: () => Promise<void>) => {
      calls.push('first');
      await next();
    };
    const second = async (_c: any, next: () => Promise<void>) => {
      calls.push('second');
      await next();
    };

    app.use('*', skipIfFrameworkPublic(first));
    app.use('*', skipIfFrameworkPublic(second));

    app.get('/api/auth/capabilities', c => {
      calls.push('handler');
      return c.json({ ok: true });
    });

    const response = await app.request('http://localhost/api/auth/capabilities');
    expect(response.status).toBe(200);

    // Both wrappers short-circuited via next(); the handler still ran.
    expect(calls).toEqual(['handler']);
  });

  it('applies the escape hatch to every public core auth route the SPA needs pre-session', async () => {
    const mastra = new Mastra({ logger: false });
    const app = new Hono();
    const adapter = new MastraServer({ app, mastra });

    adapter.registerContextMiddleware();

    const hostileMiddleware = async () => new Response('unauthorized', { status: 401 });
    app.use('*', skipIfFrameworkPublic(hostileMiddleware));

    // Stub handlers for every public core auth route.
    app.get('/api/auth/capabilities', c => c.text('ok'));
    app.get('/api/auth/me', c => c.text('ok'));
    app.get('/api/auth/sso/login', c => c.text('ok'));
    app.get('/api/auth/sso/callback', c => c.text('ok'));
    app.post('/api/auth/logout', c => c.text('ok'));
    app.post('/api/auth/refresh', c => c.text('ok'));
    app.post('/api/auth/credentials/sign-in', c => c.text('ok'));
    app.post('/api/auth/credentials/sign-up', c => c.text('ok'));

    const cases: Array<[string, string]> = [
      ['GET', '/api/auth/capabilities'],
      ['GET', '/api/auth/me'],
      ['GET', '/api/auth/sso/login'],
      ['GET', '/api/auth/sso/callback'],
      ['POST', '/api/auth/logout'],
      ['POST', '/api/auth/refresh'],
      ['POST', '/api/auth/credentials/sign-in'],
      ['POST', '/api/auth/credentials/sign-up'],
    ];

    for (const [method, path] of cases) {
      const res = await app.request(`http://localhost${path}`, { method });
      expect(res.status, `${method} ${path}`).toBe(200);
      expect(await res.text(), `${method} ${path}`).toBe('ok');
    }
  });
});
