import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';

import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { canViewSourceControlSession, createSessionAccessGuard } from './session-access.js';
import { fakeRouteAuth } from './test-utils.js';

const PRIVATE_ID = '00000000-0000-4000-8000-0000000000a1';
const SHARED_ID = '00000000-0000-4000-8000-0000000000a2';

function row(sessionId: string, visibility: SourceControlSession['visibility']): SourceControlSession {
  return { sessionId, orgId: 'org-1', userId: 'owner', visibility } as SourceControlSession;
}

const rows = new Map([
  [PRIVATE_ID, row(PRIVATE_ID, 'private')],
  [SHARED_ID, row(SHARED_ID, 'org')],
]);

function buildApp(user?: { workosId: string; organizationId: string }) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    c.set('requestContext' as never, new RequestContext() as never);
    await next();
  });
  app.use(
    '*',
    createSessionAccessGuard({
      auth: fakeRouteAuth(),
      sessions: { getBySessionId: async id => rows.get(id) ?? null },
    }),
  );
  // Downstream handlers echo the body the way the Mastra server adapter reads
  // it (`request.raw.clone()` in getParams), proving the guard left it unread.
  const adapterBody = async (c: Context) => JSON.parse(await c.req.raw.clone().text());
  app.post('/api/agent-controller/:controllerId/sessions', async c =>
    c.json({ reached: true, body: await adapterBody(c) }),
  );
  app.post('/api/agent-controller/:controllerId/sessions/:resourceId/resource', async c =>
    c.json({ reached: true, body: await adapterBody(c) }),
  );
  app.all('/api/agent-controller/:controllerId/sessions/*', c => c.json({ reached: true }));
  // Memory handlers check thread ownership against the bound resource; echo it.
  app.all('/api/memory/*', c =>
    c.json({ reached: true, bound: (c.get('requestContext' as never) as RequestContext).get(MASTRA_RESOURCE_ID_KEY) }),
  );
  app.get('/api/agent-controller/:controllerId/active-runs', c =>
    c.json({
      runs: [
        { runId: 'run-private', resourceId: PRIVATE_ID, threadId: 'thread-private' },
        { runId: 'run-shared', resourceId: SHARED_ID, threadId: 'thread-shared' },
        { runId: 'run-personal', resourceId: 'teammate-own', threadId: 'thread-personal' },
      ],
    }),
  );
  app.get('/web/config/om', c => c.json({ reached: true }));
  app.post('/web/config/om/:role/model', async c => c.json({ reached: true, body: await adapterBody(c) }));
  return app;
}

const owner = buildApp({ workosId: 'owner', organizationId: 'org-1' });
const teammate = buildApp({ workosId: 'teammate', organizationId: 'org-1' });
const outsider = buildApp({ workosId: 'owner', organizationId: 'org-2' });

const post = (app: Hono, path: string, body: unknown) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

describe('canViewSourceControlSession', () => {
  it('lets the owner and same-org teammates see org sessions, and only the owner see private ones', () => {
    expect(canViewSourceControlSession(row(SHARED_ID, 'org'), { orgId: 'org-1', userId: 'teammate' })).toBe(true);
    expect(canViewSourceControlSession(row(PRIVATE_ID, 'private'), { orgId: 'org-1', userId: 'owner' })).toBe(true);
    expect(canViewSourceControlSession(row(PRIVATE_ID, 'private'), { orgId: 'org-1', userId: 'teammate' })).toBe(false);
    expect(canViewSourceControlSession(row(SHARED_ID, 'org'), { orgId: 'org-2', userId: 'owner' })).toBe(false);
  });
});

describe('createSessionAccessGuard', () => {
  const sessionRoutes = [
    ['GET', 'stream'],
    ['POST', 'messages'],
    ['GET', 'threads'],
    ['GET', 'threads/thread-1/messages'],
    ['PUT', 'state'],
    ['GET', ''],
  ] as const;

  it.each(sessionRoutes)("404s a teammate's %s /%s on a private session", async (method, suffix) => {
    const path = `/api/agent-controller/code/sessions/${PRIVATE_ID}${suffix ? `/${suffix}` : ''}`;
    const res = await teammate.request(path, { method });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Session not found' });
  });

  it.each(sessionRoutes)('lets the owner reach %s /%s on their private session', async (method, suffix) => {
    const path = `/api/agent-controller/code/sessions/${PRIVATE_ID}${suffix ? `/${suffix}` : ''}`;
    expect((await owner.request(path, { method })).status).toBe(200);
  });

  it('lets teammates reach org-visible sessions but not across organizations', async () => {
    expect((await teammate.request(`/api/agent-controller/code/sessions/${SHARED_ID}/stream`)).status).toBe(200);
    expect((await outsider.request(`/api/agent-controller/code/sessions/${SHARED_ID}/stream`)).status).toBe(404);
  });

  it('guards get-or-create by the body resourceId and leaves the body readable', async () => {
    const denied = await post(teammate, '/api/agent-controller/code/sessions', { resourceId: PRIVATE_ID });
    expect(denied.status).toBe(404);

    const allowed = await post(owner, '/api/agent-controller/code/sessions', { resourceId: PRIVATE_ID });
    expect(allowed.status).toBe(200);
    await expect(allowed.json()).resolves.toEqual({ reached: true, body: { resourceId: PRIVATE_ID } });
  });

  it('guards memory-settings routes that resolve a live session', async () => {
    expect((await teammate.request(`/web/config/om?resourceId=${PRIVATE_ID}`)).status).toBe(404);
    expect((await owner.request(`/web/config/om?resourceId=${PRIVATE_ID}`)).status).toBe(200);
    expect(
      (await post(teammate, '/web/config/om/observer/model', { resourceId: PRIVATE_ID, modelId: 'x' })).status,
    ).toBe(404);
    const allowed = await post(owner, '/web/config/om/observer/model', { resourceId: PRIVATE_ID, modelId: 'x' });
    expect(allowed.status).toBe(200);
    await expect(allowed.json()).resolves.toMatchObject({ body: { modelId: 'x' } });
  });

  it('passes through resources that are not source-control sessions', async () => {
    expect((await teammate.request('/api/agent-controller/code/sessions/teammate/stream')).status).toBe(200);
    expect((await teammate.request('/web/config/om')).status).toBe(200);
  });

  it('denies a signed-out caller addressing a private session', async () => {
    expect((await buildApp().request(`/api/agent-controller/code/sessions/${PRIVATE_ID}/stream`)).status).toBe(404);
  });

  it('refuses to re-key a session onto a private session the caller cannot see', async () => {
    const path = '/api/agent-controller/code/sessions/teammate-own/resource';
    expect((await post(teammate, path, { newResourceId: PRIVATE_ID })).status).toBe(404);

    const shared = await post(teammate, path, { newResourceId: SHARED_ID });
    await expect(shared.json()).resolves.toEqual({ reached: true, body: { newResourceId: SHARED_ID } });
    expect((await post(owner, path, { newResourceId: PRIVATE_ID })).status).toBe(200);
  });

  it('404s memory routes addressing a private session the caller cannot see', async () => {
    expect((await teammate.request(`/api/memory/threads?resourceId=${PRIVATE_ID}`)).status).toBe(404);
    expect((await teammate.request(`/api/memory/threads/t-1?resourceId=${PRIVATE_ID}`)).status).toBe(404);
    expect((await post(teammate, '/api/memory/threads', { resourceId: PRIVATE_ID })).status).toBe(404);

    const allowed = await owner.request(`/api/memory/threads?resourceId=${PRIVATE_ID}`);
    await expect(allowed.json()).resolves.toEqual({ reached: true, bound: PRIVATE_ID });
  });

  it('binds memory requests without a resourceId to the caller, so a bare threadId cannot reach another session', async () => {
    const res = await teammate.request('/api/memory/threads/t-1');
    await expect(res.json()).resolves.toEqual({ reached: true, bound: 'teammate' });
  });

  it('checks both the query and body resourceId, since handlers may read either', async () => {
    const path = `/web/config/om/observer/model?resourceId=${SHARED_ID}`;
    expect((await post(teammate, path, { resourceId: PRIVATE_ID, modelId: 'x' })).status).toBe(404);
    const memory = `/api/memory/threads?resourceId=${SHARED_ID}`;
    expect((await post(teammate, memory, { resourceId: PRIVATE_ID })).status).toBe(404);
  });

  it('hides runs on private sessions the caller cannot see from the active-runs list', async () => {
    const runIds = async (app: Hono) =>
      (
        (await (await app.request('/api/agent-controller/code/active-runs')).json()) as { runs: { runId: string }[] }
      ).runs.map(run => run.runId);

    expect(await runIds(teammate)).toEqual(['run-shared', 'run-personal']);
    expect(await runIds(owner)).toEqual(['run-private', 'run-shared', 'run-personal']);
    expect(await runIds(outsider)).toEqual(['run-personal']);
  });
});
