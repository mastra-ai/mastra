import { registerApiRoute } from '@mastra/core/server';
import { createDefaultTestContext } from '@mastra/server-adapters-test-suite';
import type { AdapterTestContext } from '@mastra/server-adapters-test-suite';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Application } from 'express';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { MastraModule } from '../index';
import { executeExpressRequest } from './test-helpers';

const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: ['*'],
  viewer: ['agents:read'],
};

const roleAuth = {
  authenticateToken: async (token: string) => (ROLE_PERMISSIONS[token] ? { id: `user_${token}`, role: token } : null),
  authorize: async () => true,
};

const roleRbac = {
  getPermissions: async (user: { role: string }) => ROLE_PERMISSIONS[user.role] ?? [],
  getRoles: async (user: { role: string }) => [user.role],
};

/**
 * NestJS serves Mastra routes through its own controller/guard pipeline, so it must run
 * the same per-route RBAC and FGA checks (and studio/server auth selection) as the
 * other adapters.
 */
describe('NestJS Adapter - per-route RBAC, FGA, and studio auth', () => {
  let context: AdapterTestContext;
  let app: INestApplication | undefined;
  let expressApp: Application;

  beforeEach(async () => {
    context = await createDefaultTestContext();
  });

  afterEach(async () => {
    await app?.close();
    app = undefined;
    vi.restoreAllMocks();
  });

  async function start({
    server,
    studio,
    auth,
  }: {
    server?: Record<string, unknown>;
    studio?: Record<string, unknown>;
    auth?: { enabled?: boolean };
  }) {
    vi.spyOn(context.mastra, 'getServer').mockReturnValue((server ?? {}) as any);
    if (studio) {
      vi.spyOn(context.mastra, 'getStudio').mockReturnValue(studio as any);
    }
    const moduleRef = await Test.createTestingModule({
      imports: [MastraModule.register({ mastra: context.mastra, auth, rateLimitOptions: { enabled: false } })],
    }).compile();
    app = moduleRef.createNestApplication();
    expressApp = app.getHttpAdapter().getInstance() as Application;
    await app.init();
  }

  const get = (path: string, headers?: Record<string, string>) =>
    executeExpressRequest(expressApp, { method: 'GET', path, headers });

  it('returns 403 when the user lacks the route-derived permission', async () => {
    await start({ server: { auth: roleAuth, rbac: roleRbac } });

    const denied = await get('/api/tools', { authorization: 'Bearer viewer' });
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ error: 'Missing required permission: tools:read' });

    expect((await get('/api/agents', { authorization: 'Bearer viewer' })).status).toBe(200);
    expect((await get('/api/tools', { authorization: 'Bearer admin' })).status).toBe(200);
  });

  it('returns 403 when the FGA provider denies the resource', async () => {
    const check = vi.fn(async () => false);
    await start({ server: { auth: roleAuth, rbac: roleRbac, fga: { check } } });

    const denied = await get('/api/agents/test-agent', { authorization: 'Bearer admin' });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('FGA authorization denied: cannot agents:read on agent:test-agent');
    expect(check).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user_admin' }),
      expect.objectContaining({ resource: { type: 'agent', id: 'test-agent' } }),
    );
  });

  it('skips RBAC and FGA when Mastra auth is explicitly disabled', async () => {
    const check = vi.fn(async () => false);
    await start({ server: { auth: roleAuth, rbac: roleRbac, fga: { check } }, auth: { enabled: false } });

    expect((await get('/api/tools')).status).toBe(200);
    expect((await get('/api/agents/test-agent')).status).toBe(200);
    expect(check).not.toHaveBeenCalled();
  });

  it('enforces requiresPermission on custom API routes', async () => {
    const apiRoutes = [
      registerApiRoute('/secret', {
        method: 'GET',
        requiresPermission: 'secrets:read',
        handler: async c => c.json({ ok: true }),
      }),
    ];
    await start({ server: { auth: roleAuth, rbac: roleRbac, apiRoutes } });

    const denied = await get('/secret', { authorization: 'Bearer viewer' });
    expect(denied.status).toBe(403);
    expect(denied.body).toMatchObject({ error: 'Missing required permission: secrets:read' });
    expect((await get('/secret', { authorization: 'Bearer admin' })).status).toBe(200);
  });

  it('enforces fga on custom API routes', async () => {
    const check = vi.fn(async (_user: unknown, { resource }: { resource: { id: string } }) => resource.id === 'open');
    const apiRoutes = [
      registerApiRoute('/docs/:docId', {
        method: 'GET',
        fga: { resourceType: 'doc', resourceIdParam: 'docId', permission: 'docs:read' },
        handler: async c => c.json({ ok: true }),
      }),
    ];
    await start({ server: { auth: roleAuth, rbac: roleRbac, fga: { check }, apiRoutes } });

    const denied = await get('/docs/locked', { authorization: 'Bearer admin' });
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('FGA authorization denied: cannot docs:read on doc:locked');
    expect((await get('/docs/open', { authorization: 'Bearer admin' })).status).toBe(200);
    // A query value must not replace the matched path param the handler actually reads.
    expect((await get('/docs/locked?docId=open', { authorization: 'Bearer admin' })).status).toBe(403);
    expect(check).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'user_admin' }),
      expect.objectContaining({ resource: { type: 'doc', id: 'locked' } }),
    );
  });

  it('allows the request when the FGA provider grants the resource', async () => {
    await start({ server: { auth: roleAuth, rbac: roleRbac, fga: { check: async () => true } } });

    expect((await get('/api/agents/test-agent', { authorization: 'Bearer admin' })).status).toBe(200);
  });

  it('enforces studio.auth for Studio requests when only studio auth is configured', async () => {
    await start({ studio: { auth: roleAuth, rbac: roleRbac } });

    expect((await get('/api/agents', { 'x-mastra-client-type': 'studio' })).status).toBe(401);
    expect((await get('/api/agents', { 'x-mastra-client-type': 'studio', authorization: 'Bearer nope' })).status).toBe(
      401,
    );
    expect((await get('/api/tools', { 'x-mastra-client-type': 'studio', authorization: 'Bearer viewer' })).status).toBe(
      403,
    );
    expect(
      (await get('/api/agents', { 'x-mastra-client-type': 'studio', authorization: 'Bearer viewer' })).status,
    ).toBe(200);
    // Non-Studio requests keep the server config, which has no auth here.
    expect((await get('/api/agents')).status).toBe(200);
  });

  it('uses studio.auth instead of server.auth for Studio requests', async () => {
    const serverAuth = { authenticateToken: async (token: string) => (token === 'api-key' ? { id: 'api' } : null) };
    await start({ server: { auth: serverAuth }, studio: { auth: roleAuth } });

    expect((await get('/api/agents', { authorization: 'Bearer api-key' })).status).toBe(200);
    expect(
      (await get('/api/agents', { 'x-mastra-client-type': 'studio', authorization: 'Bearer api-key' })).status,
    ).toBe(401);
    expect(
      (await get('/api/agents', { 'x-mastra-client-type': 'studio', authorization: 'Bearer viewer' })).status,
    ).toBe(200);
  });

  it('warns that server.middleware cannot run on NestJS', async () => {
    const warn = vi.fn();
    vi.spyOn(context.mastra, 'getLogger').mockReturnValue({
      warn,
      error: vi.fn(),
      info: vi.fn(),
      debug: vi.fn(),
    } as any);
    const middleware = vi.fn(async (_c: unknown, next: () => Promise<void>) => next());
    await start({ server: { middleware: [middleware] } });

    expect((await get('/api/agents')).status).toBe(200);
    expect(middleware).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('cannot run Hono middleware handlers'));
  });
});
