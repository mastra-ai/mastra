import { registerApiRoute } from '@mastra/core/server';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

const RESOURCE_ID_KEY = 'mastra__resourceId';

/**
 * Regression tests for #24964: NestJS must run the same auth pipeline
 * (`coreAuthMiddleware`) and serve `server.apiRoutes` like the other adapters.
 */
describe('NestJS Adapter - auth parity with other adapters', () => {
  let context: AdapterTestContext;
  let app: INestApplication;
  let expressApp: Application;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  afterEach(async () => {
    if (app) {
      await app.close();
    }
    vi.restoreAllMocks();
  });

  async function start(server: Record<string, unknown>, beforeInit?: (app: INestApplication) => void) {
    vi.spyOn(context.mastra, 'getServer').mockReturnValue(server as any);
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra: context.mastra })],
    }).compile();
    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    beforeInit?.(app);
    await app.init();
  }

  const cookieAuth = {
    authenticateToken: async (token: string, request: { headers: Headers }) => {
      if (token === 'valid') return { id: 'bearer-user' };
      if (request.headers.get('cookie')?.includes('session=abc')) return { id: 'cookie-user' };
      return null;
    },
    mapUserToResourceId: (user: { id: string }) => `resource-${user.id}`,
  };

  it('authenticates cookie-only requests', async () => {
    await start({ auth: cookieAuth });

    const withCookie = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/api/agents',
      headers: { cookie: 'session=abc' },
    });
    expect(withCookie.status).toBe(200);

    const anonymous = await executeExpressRequest(expressApp, { method: 'GET', path: '/api/agents' });
    expect(anonymous.status).toBe(401);
  });

  it('serves registerApiRoute routes and honors requiresAuth', async () => {
    await start({
      auth: cookieAuth,
      apiRoutes: [
        registerApiRoute('/public-hello', {
          method: 'GET',
          requiresAuth: false,
          handler: async c => c.json({ hello: 'world' }),
        }),
        registerApiRoute('/private-hello', {
          method: 'GET',
          handler: async c => c.json({ resourceId: c.get('requestContext').get(RESOURCE_ID_KEY) }),
        }),
      ],
    });

    const publicRoute = await executeExpressRequest(expressApp, { method: 'GET', path: '/public-hello' });
    expect(publicRoute.status).toBe(200);
    expect(publicRoute.body).toEqual({ hello: 'world' });

    const privateAnonymous = await executeExpressRequest(expressApp, { method: 'GET', path: '/private-hello' });
    expect(privateAnonymous.status).toBe(401);

    const privateAuthed = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/private-hello',
      headers: { authorization: 'Bearer valid' },
    });
    expect(privateAuthed.status).toBe(200);
    expect(privateAuthed.body).toEqual({ resourceId: 'resource-bearer-user' });
  });

  it('forwards non-JSON request bodies to registerApiRoute handlers', async () => {
    await start({
      apiRoutes: [
        registerApiRoute('/echo-text', {
          method: 'POST',
          requiresAuth: false,
          handler: async c => c.json({ text: await c.req.text() }),
        }),
        registerApiRoute('/echo-form', {
          method: 'POST',
          requiresAuth: false,
          handler: async c => {
            const form = await c.req.formData();
            return c.json({ name: form.get('name'), file: await (form.get('file') as File).text() });
          },
        }),
        registerApiRoute('/echo-urlencoded', {
          method: 'POST',
          requiresAuth: false,
          handler: async c => c.json(await c.req.parseBody()),
        }),
      ],
    });
    await app.listen(0);
    const base = await app.getUrl();

    const text = await fetch(`${base}/echo-text`, {
      method: 'POST',
      headers: { 'content-type': 'text/plain' },
      body: 'plain body',
    });
    expect(await text.json()).toEqual({ text: 'plain body' });

    const formData = new FormData();
    formData.set('name', 'mastra');
    formData.set('file', new Blob(['file contents']), 'a.txt');
    const form = await fetch(`${base}/echo-form`, { method: 'POST', body: formData });
    expect(await form.json()).toEqual({ name: 'mastra', file: 'file contents' });

    const urlencoded = await fetch(`${base}/echo-urlencoded`, {
      method: 'POST',
      body: new URLSearchParams({ a: '1' }),
    });
    expect(await urlencoded.json()).toEqual({ a: '1' });
  });

  it('forwards unparsed bodies when a body-parser 1.x style parser sets req.body = {}', async () => {
    await start(
      {
        apiRoutes: [
          registerApiRoute('/echo-form', {
            method: 'POST',
            requiresAuth: false,
            handler: async c => {
              const form = await c.req.formData();
              return c.json({ name: form.get('name') });
            },
          }),
        ],
      },
      nestApp =>
        nestApp.use((req: { body?: unknown }, _res: unknown, next: () => void) => {
          req.body = req.body || {};
          next();
        }),
    );
    await app.listen(0);
    const base = await app.getUrl();

    const formData = new FormData();
    formData.set('name', 'mastra');
    const form = await fetch(`${base}/echo-form`, { method: 'POST', body: formData });
    expect(await form.json()).toEqual({ name: 'mastra' });
  });

  it('authenticates custom routes matched by Hono-only patterns', async () => {
    await start({
      auth: cookieAuth,
      apiRoutes: [
        registerApiRoute('/files/:name{.+\\.png}', {
          method: 'GET',
          handler: async c => c.json({ name: c.req.param('name') }),
        }),
      ],
    });

    const anonymous = await executeExpressRequest(expressApp, { method: 'GET', path: '/files/a/b.png' });
    expect(anonymous.status).toBe(401);

    const authed = await executeExpressRequest(expressApp, {
      method: 'GET',
      path: '/files/a/b.png',
      headers: { authorization: 'Bearer valid' },
    });
    expect(authed.status).toBe(200);
    expect(authed.body).toEqual({ name: 'a/b.png' });
  });

  it('still returns 404 for unknown non-Mastra paths', async () => {
    await start({ auth: cookieAuth, apiRoutes: [] });
    const response = await executeExpressRequest(expressApp, { method: 'GET', path: '/nope' });
    expect(response.status).toBe(404);
  });
});
