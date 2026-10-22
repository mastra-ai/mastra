import { Agent } from '@mastra/core/agent';
import { AgentController } from '@mastra/core/agent-controller';
import { MASTRA_RESOURCE_ID_KEY, RequestContext } from '@mastra/core/request-context';
import { InMemoryStore } from '@mastra/core/storage';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { describe, expect, it, vi } from 'vitest';

import { observeSessionThreadStamp } from '../session/thread-session-stamp.js';
import type { SourceControlSession } from '../storage/domains/source-control/base.js';
import { canViewSourceControlSession, createSessionAccessGuard } from './session-access.js';
import type { SessionResourceLookup } from './session-access.js';
import { fakeRouteAuth } from './test-utils.js';

const PRIVATE_ID = '00000000-0000-4000-8000-0000000000a1';
const SHARED_ID = '00000000-0000-4000-8000-0000000000a2';
/** Shared before resources followed visibility, so it still runs on its owner's resource. */
const UNMOVED_SHARED_ID = '00000000-0000-4000-8000-0000000000a3';
/** From before resources were shared: runs on its own id. */
const LEGACY_PRIVATE_ID = '00000000-0000-4000-8000-0000000000a4';
/** From before resources were shared, and visible to the org: runs on its own id. */
const LEGACY_SHARED_ID = '00000000-0000-4000-8000-0000000000a5';
const FACTORY_ID = 'factory-1';
const OTHER_FACTORY_ID = 'factory-2';

function row(sessionId: string, visibility: SourceControlSession['visibility']): SourceControlSession {
  return { sessionId, orgId: 'org-1', userId: 'owner', visibility } as SourceControlSession;
}

const rows = new Map([
  [PRIVATE_ID, row(PRIVATE_ID, 'private')],
  [SHARED_ID, row(SHARED_ID, 'org')],
  [UNMOVED_SHARED_ID, row(UNMOVED_SHARED_ID, 'org')],
  [LEGACY_PRIVATE_ID, row(LEGACY_PRIVATE_ID, 'private')],
  [LEGACY_SHARED_ID, row(LEGACY_SHARED_ID, 'org')],
]);

// Each session's own thread (thread id === session id) and the resource it sits on.
const threadResources = new Map([
  [PRIVATE_ID, 'owner'],
  [SHARED_ID, FACTORY_ID],
  [UNMOVED_SHARED_ID, 'owner'],
  [LEGACY_PRIVATE_ID, LEGACY_PRIVATE_ID],
  // A thread the owner opened from a session, addressed directly as if it were a session.
  ['owner-side-thread', 'owner'],
]);

const controller: SessionResourceLookup = {
  getSession: async () => undefined,
  queryThreadById: async ({ threadId }) => {
    const resourceId = threadResources.get(threadId);
    return resourceId ? { resourceId } : null;
  },
};

const projects = new Map([
  [FACTORY_ID, 'org-1'],
  [OTHER_FACTORY_ID, 'org-2'],
]);

function buildApp(
  user?: { workosId: string; organizationId: string },
  options: { authEnabled?: boolean; controller?: SessionResourceLookup } = {},
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    c.set('requestContext' as never, new RequestContext() as never);
    await next();
  });
  app.use(
    '*',
    createSessionAccessGuard({
      auth: fakeRouteAuth({ enabled: options.authEnabled }),
      sessions: { getBySessionId: async id => rows.get(id) ?? null },
      projects: {
        get: async ({ orgId, id }) => (projects.get(id) === orgId ? ({ id, orgId } as never) : null),
      },
      controller: () => options.controller ?? controller,
    }),
  );
  // Downstream handlers echo the body the way the Mastra server adapter reads
  // it (`request.raw.clone()` in getParams), proving the guard left it unread.
  const adapterBody = async (c: Context) => {
    const request = c.req.raw.clone();
    if (c.req.header('content-type')?.includes('multipart/form-data')) {
      return Object.fromEntries(await request.formData());
    }
    return JSON.parse(await request.text());
  };
  app.post('/api/agent-controller/:controllerId/sessions', async c =>
    c.json({ reached: true, body: await adapterBody(c) }),
  );
  app.post('/api/agent-controller/:controllerId/sessions/:sessionId/resource', async c =>
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
        { runId: 'run-owner', resourceId: 'owner', threadId: PRIVATE_ID },
        { runId: 'run-factory', resourceId: FACTORY_ID, threadId: SHARED_ID },
        { runId: 'run-legacy', resourceId: LEGACY_PRIVATE_ID, threadId: LEGACY_PRIVATE_ID },
        { runId: 'run-teammate', resourceId: 'teammate', threadId: 'thread-teammate' },
      ],
    }),
  );
  app.get('/web/config/om', c => c.json({ reached: true }));
  app.post('/web/config/om/:role/model', async c => c.json({ reached: true, body: await adapterBody(c) }));
  return app;
}

const owner = buildApp({ workosId: 'owner', organizationId: 'org-1' });
const teammate = buildApp({ workosId: 'teammate', organizationId: 'org-1' });
const outsider = buildApp({ workosId: 'outsider', organizationId: 'org-2' });

const post = (app: Hono, path: string, body: unknown) =>
  app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
const put = (app: Hono, path: string, body: unknown) =>
  app.request(path, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
/** A form body: the server adapter JSON-parses each field that parses, so structured values travel as JSON text. */
const multipart = (app: Hono, method: 'POST' | 'PUT', path: string, fields: Record<string, unknown>) => {
  const form = new FormData();
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, typeof value === 'string' ? value : JSON.stringify(value));
  }
  return app.request(path, { method, body: form });
};

async function liveController() {
  const live = new AgentController({
    id: 'code',
    storage: new InMemoryStore({ id: 'session-access' }),
    stateSchema: undefined,
    modes: [
      {
        id: 'build',
        name: 'Build',
        default: true,
        defaultModelId: 'openai/gpt-5.5',
        agent: new Agent({ id: 'test-agent', name: 'test-agent', instructions: 'Test.', model: 'openai/gpt-5.5' }),
      },
    ],
  });
  await live.init();
  live.onSessionCreated(session => observeSessionThreadStamp(session));
  return live;
}

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
  const sessionPath = (id: string, suffix = '') =>
    `/api/agent-controller/code/sessions/${id}${suffix ? `/${suffix}` : ''}`;

  it.each(sessionRoutes)("404s a teammate's %s /%s on a private session", async (method, suffix) => {
    const res = await teammate.request(sessionPath(PRIVATE_ID, suffix), { method });
    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: 'Session not found' });
  });

  it.each(sessionRoutes)('lets the owner reach %s /%s on their private session', async (method, suffix) => {
    expect((await owner.request(sessionPath(PRIVATE_ID, suffix), { method })).status).toBe(200);
  });

  it('lets teammates reach a shared session on its Factory, but not across organizations', async () => {
    expect((await teammate.request(sessionPath(SHARED_ID, 'threads'))).status).toBe(200);
    expect((await outsider.request(sessionPath(SHARED_ID, 'threads'))).status).toBe(404);
  });

  it("404s a teammate on a shared session still on its owner's resource, whose threads list every owner session", async () => {
    expect((await teammate.request(sessionPath(UNMOVED_SHARED_ID, 'threads'))).status).toBe(404);
    expect((await owner.request(sessionPath(UNMOVED_SHARED_ID, 'threads'))).status).toBe(200);
  });

  it("404s a teammate addressing one of the owner's threads as a session", async () => {
    expect((await teammate.request(sessionPath('owner-side-thread', 'threads'))).status).toBe(404);
    expect((await owner.request(sessionPath('owner-side-thread', 'threads'))).status).toBe(200);
  });

  it("403s a teammate changing a shared session's model or thinking level, while they still steer it", async () => {
    const switchModel = { modelId: 'openai/gpt-5-mini' };
    expect((await post(teammate, sessionPath(SHARED_ID, 'model'), switchModel)).status).toBe(403);
    const refused = await put(teammate, sessionPath(SHARED_ID, 'state'), { state: { thinkingLevel: 'high' } });
    expect(refused.status).toBe(403);
    await expect(refused.json()).resolves.toEqual({ error: 'Only the session’s owner can change its model' });
    expect((await put(teammate, sessionPath(SHARED_ID, 'state'), { state: { thinkingLevel: null } })).status).toBe(403);

    expect(
      (await put(teammate, sessionPath(SHARED_ID, 'state'), { state: { factoryProjectId: FACTORY_ID } })).status,
    ).toBe(200);
    expect((await post(teammate, sessionPath(SHARED_ID, 'messages'), { content: 'Ship it' })).status).toBe(200);
    expect((await post(owner, sessionPath(SHARED_ID, 'model'), switchModel)).status).toBe(200);
    expect((await put(owner, sessionPath(SHARED_ID, 'state'), { state: { thinkingLevel: 'high' } })).status).toBe(200);
    expect((await post(teammate, sessionPath('teammate-scratch', 'model'), switchModel)).status).toBe(200);
  });

  it('passes through a session on its own id that no Factory session row claims', async () => {
    expect((await teammate.request(sessionPath('teammate-scratch', 'stream'))).status).toBe(200);
  });

  it("403s a teammate's own session bound to the owner's thread, so a second session id can't switch its model", async () => {
    const live = await liveController();
    const shared = await live.createSession({ id: SHARED_ID, resourceId: FACTORY_ID, threadId: SHARED_ID });
    const alias = await live.createSession({ id: 'teammate-alias', resourceId: FACTORY_ID, threadId: SHARED_ID });
    const app = buildApp({ workosId: 'teammate', organizationId: 'org-1' }, { controller: live });
    const switchModel = { modelId: 'openai/gpt-5-mini' };
    const aliasPath = (suffix: string) => sessionPath('teammate-alias', suffix);

    expect((await post(app, aliasPath('model'), switchModel)).status).toBe(403);
    expect((await put(app, aliasPath('state'), { state: { thinkingLevel: 'high' } })).status).toBe(403);

    const opened = await shared.thread.create();
    await vi.waitFor(async () =>
      expect((await live.queryThreadById({ threadId: opened.id }))?.metadata?.factorySessionId).toBe(SHARED_ID),
    );
    await alias.thread.switch({ threadId: opened.id });
    expect((await post(app, aliasPath('model'), switchModel)).status).toBe(403);

    await alias.thread.create();
    expect((await post(app, aliasPath('model'), switchModel)).status).toBe(200);
  });

  it("403s a second session on an owner's thread that carries no stamp, while the owner still switches", async () => {
    const live = await liveController();
    await live.createSession({ id: LEGACY_SHARED_ID, resourceId: LEGACY_SHARED_ID, threadId: 'legacy-side-thread' });
    await live.createSession({ id: 'legacy-alias', resourceId: LEGACY_SHARED_ID, threadId: 'legacy-side-thread' });
    await live.createSession({ id: SHARED_ID, resourceId: FACTORY_ID, threadId: 'factory-side-thread' });
    await live.createSession({ id: 'factory-alias', resourceId: FACTORY_ID, threadId: 'factory-side-thread' });
    const asTeammate = buildApp({ workosId: 'teammate', organizationId: 'org-1' }, { controller: live });
    const asOwner = buildApp({ workosId: 'owner', organizationId: 'org-1' }, { controller: live });
    const switchModel = { modelId: 'openai/gpt-5-mini' };

    expect((await post(asTeammate, sessionPath('legacy-alias', 'model'), switchModel)).status).toBe(403);
    expect((await post(asTeammate, sessionPath('factory-alias', 'model'), switchModel)).status).toBe(403);
    expect((await post(asOwner, sessionPath(LEGACY_SHARED_ID, 'model'), switchModel)).status).toBe(200);
  });

  it('reads a multipart body the way the server adapter does, so form fields cannot slip past the checks', async () => {
    const state = sessionPath(SHARED_ID, 'state');
    expect((await multipart(teammate, 'PUT', state, { state: { thinkingLevel: 'high' } })).status).toBe(403);
    expect((await multipart(owner, 'PUT', state, { state: { thinkingLevel: 'high' } })).status).toBe(200);

    const create = '/api/agent-controller/code/sessions';
    expect((await multipart(teammate, 'POST', create, { sessionId: 'new-session', resourceId: 'owner' })).status).toBe(
      404,
    );
    const rekey = sessionPath('teammate-scratch', 'resource');
    expect((await multipart(teammate, 'POST', rekey, { newResourceId: 'owner' })).status).toBe(404);
    const allowed = await multipart(teammate, 'POST', rekey, { newResourceId: FACTORY_ID });
    await expect(allowed.json()).resolves.toEqual({ reached: true, body: { newResourceId: FACTORY_ID } });
  });

  it('guards get-or-create by the session and resource it names, leaving the body readable', async () => {
    const create = '/api/agent-controller/code/sessions';
    expect((await post(teammate, create, { sessionId: PRIVATE_ID, resourceId: 'teammate' })).status).toBe(404);
    expect((await post(teammate, create, { resourceId: PRIVATE_ID })).status).toBe(404);
    expect((await post(teammate, create, { sessionId: 'new-session', resourceId: 'owner' })).status).toBe(404);
    expect((await post(teammate, create, { sessionId: 'new-session', resourceId: FACTORY_ID })).status).toBe(200);
    expect((await post(outsider, create, { sessionId: 'new-session', resourceId: FACTORY_ID })).status).toBe(404);

    const allowed = await post(owner, create, { sessionId: PRIVATE_ID, resourceId: 'owner' });
    expect(allowed.status).toBe(200);
    await expect(allowed.json()).resolves.toEqual({
      reached: true,
      body: { sessionId: PRIVATE_ID, resourceId: 'owner' },
    });
  });

  it('guards memory-settings routes by the session they name', async () => {
    expect((await teammate.request(`/web/config/om?sessionId=${PRIVATE_ID}`)).status).toBe(404);
    expect((await owner.request(`/web/config/om?sessionId=${PRIVATE_ID}`)).status).toBe(200);
    expect((await teammate.request('/web/config/om')).status).toBe(200);
    expect(
      (await post(teammate, '/web/config/om/observer/model', { sessionId: PRIVATE_ID, modelId: 'x' })).status,
    ).toBe(404);
    const allowed = await post(owner, '/web/config/om/observer/model', { sessionId: PRIVATE_ID, modelId: 'x' });
    expect(allowed.status).toBe(200);
    await expect(allowed.json()).resolves.toMatchObject({ body: { modelId: 'x' } });
  });

  it('denies a signed-out caller addressing a session', async () => {
    expect((await buildApp().request(sessionPath(PRIVATE_ID, 'stream'))).status).toBe(404);
  });

  it('passes everything through when auth is disabled', async () => {
    const open = buildApp(undefined, { authEnabled: false });
    expect((await open.request(sessionPath(PRIVATE_ID, 'stream'))).status).toBe(200);
    expect((await open.request('/api/memory/threads?resourceId=owner')).status).toBe(200);
  });

  it("refuses to re-key a session onto another person's resource", async () => {
    const path = sessionPath('teammate-scratch', 'resource');
    expect((await post(teammate, path, { newResourceId: 'owner' })).status).toBe(404);
    expect((await post(teammate, path, { newResourceId: LEGACY_PRIVATE_ID })).status).toBe(404);
    expect((await post(outsider, path, { newResourceId: FACTORY_ID })).status).toBe(404);

    const shared = await post(teammate, path, { newResourceId: FACTORY_ID });
    await expect(shared.json()).resolves.toEqual({ reached: true, body: { newResourceId: FACTORY_ID } });
    expect((await post(teammate, path, { newResourceId: 'teammate' })).status).toBe(200);
  });

  it("404s memory routes naming another person's resource or a private session's own id", async () => {
    expect((await teammate.request('/api/memory/threads?resourceId=owner')).status).toBe(404);
    expect((await teammate.request(`/api/memory/threads/t-1?resourceId=${LEGACY_PRIVATE_ID}`)).status).toBe(404);
    expect((await post(teammate, '/api/memory/threads', { resourceId: 'owner' })).status).toBe(404);
    expect((await outsider.request(`/api/memory/threads?resourceId=${FACTORY_ID}`)).status).toBe(404);

    const own = await owner.request('/api/memory/threads?resourceId=owner');
    await expect(own.json()).resolves.toEqual({ reached: true, bound: 'owner' });
    const factory = await teammate.request(`/api/memory/threads?resourceId=${FACTORY_ID}`);
    await expect(factory.json()).resolves.toEqual({ reached: true, bound: FACTORY_ID });
  });

  it('binds memory requests without a resourceId to the caller, so a bare threadId cannot reach another resource', async () => {
    const res = await teammate.request('/api/memory/threads/t-1');
    await expect(res.json()).resolves.toEqual({ reached: true, bound: 'teammate' });
  });

  it('rejects a query and body naming different sessions or resources, since handlers may read either', async () => {
    const om = `/web/config/om/observer/model?sessionId=${SHARED_ID}`;
    expect((await post(teammate, om, { sessionId: PRIVATE_ID, modelId: 'x' })).status).toBe(400);
    const memory = `/api/memory/threads?resourceId=${FACTORY_ID}`;
    expect((await post(teammate, memory, { resourceId: 'owner' })).status).toBe(400);
    // Both resources reachable by the caller still conflict: the bound resource must be unambiguous.
    expect((await post(owner, memory, { resourceId: 'owner' })).status).toBe(400);

    const same = await post(owner, '/api/memory/threads?resourceId=owner', { resourceId: 'owner' });
    await expect(same.json()).resolves.toEqual({ reached: true, bound: 'owner' });
  });

  it('hides runs on resources the caller cannot reach from the active-runs list', async () => {
    const runIds = async (app: Hono) =>
      (
        (await (await app.request('/api/agent-controller/code/active-runs')).json()) as { runs: { runId: string }[] }
      ).runs.map(run => run.runId);

    expect(await runIds(teammate)).toEqual(['run-factory', 'run-teammate']);
    expect(await runIds(owner)).toEqual(['run-owner', 'run-factory', 'run-legacy']);
    expect(await runIds(outsider)).toEqual([]);
  });
});
