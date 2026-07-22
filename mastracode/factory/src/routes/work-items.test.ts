import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

import { builtInFactoryRules } from '../rules/defaults.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';

let auditRecorded: Array<Record<string, any>> = [];
let auditFailure: Error | undefined;

const audit: AuditEmitter = {
  async emit({ context, input }) {
    try {
      if (auditFailure) throw auditFailure;
      const user = context.get('factoryAuthUser' as never) as { workosId: string; organizationId?: string } | undefined;
      if (!user?.organizationId) return;
      auditRecorded.push({
        orgId: user.organizationId,
        actorId: user.workosId,
        actorType: 'human',
        action: input.action,
        factoryProjectId: input.factoryProjectId,
        targets: input.targets,
        metadata: input.metadata,
      });
    } catch (error) {
      console.warn('[Audit] Failed to emit audit event', {
        action: input.action,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  },
};
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import { parseCreateWorkItem, parseUpdateWorkItem, WorkItemRoutes } from './work-items.js';

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(
  user: { workosId: string; organizationId?: string } | null,
  startCoordinator?: { prepare: (input: any) => Promise<any> },
  requestContext?: RequestContext,
) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    if (requestContext) c.set('requestContext' as never, requestContext as never);
    await next();
  });
  mountApiRoutes(
    app as any,
    new WorkItemRoutes({
      auth: fakeRouteAuth(),
      audit,
      projects: seed.projects,
      workItems: seed.workItems,
      queueHealth: seed.queueHealth,
      transitionService: new FactoryTransitionService({ rules: builtInFactoryRules(), storage: seed.workItems }),
      startCoordinator,
    }).routes(),
  );
  return app;
}

const orgUser = { workosId: 'u1', organizationId: 'org1' };
let PROJECT_ID = '';

async function seedProject(orgId = 'org1') {
  const project = await seed.projects.create({
    orgId,
    userId: 'u1',
    input: { name: `${orgId} project` },
  });
  PROJECT_ID = project.id;
}

const listItems = () => seed.workItems.list({ orgId: 'org1', factoryProjectId: PROJECT_ID });

function json(method: string, path: string, body?: unknown, user: typeof orgUser | null = orgUser) {
  return buildApp(user).request(path, {
    method,
    ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  });
}

const createBody = (overrides: Record<string, unknown> = {}) => ({
  externalSource: {
    integrationId: 'github',
    type: 'issue',
    externalId: '42',
    url: 'https://github.com/acme/app/issues/42',
  },
  title: 'Fix the login flow',
  stages: ['intake'],
  metadata: { number: 42 },
  ...overrides,
});

let seed: FactoryStorageTestSeed;

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  auditRecorded = [];
  auditFailure = undefined;
  await seedProject();
});

afterEach(() => {
  vi.clearAllMocks();
});

// ── Auth / scoping ───────────────────────────────────────────────────────
describe('auth and scoping', () => {
  it('401s without a user', async () => {
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/work-items`, undefined, null);
    expect(res.status).toBe(401);
  });

  it('403s without an organization', async () => {
    const res = await buildApp({ workosId: 'u1' }).request(`/web/factory/projects/${PROJECT_ID}/work-items`);
    expect(res.status).toBe(403);
  });

  it('404s when the project belongs to another org', async () => {
    await seedProject('other-org');
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/work-items`);
    expect(res.status).toBe(404);
  });

  it('404s on a non-uuid project id', async () => {
    const res = await json('GET', `/web/factory/projects/not-a-uuid/work-items`);
    expect(res.status).toBe(404);
  });

  it('is org-wide: another member of the same org sees the item', async () => {
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const res = await buildApp({ workosId: 'u2', organizationId: 'org1' }).request(
      `/web/factory/projects/${PROJECT_ID}/work-items`,
    );
    const body = await res.json();
    expect(body.workItems).toHaveLength(1);
    expect(body.workItems[0].createdBy).toBe('u1');
  });
});

// ── Create / upsert ──────────────────────────────────────────────────────
describe('POST /web/factory/projects/:id/work-items', () => {
  it('creates a work item with server-stamped history', async () => {
    const res = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    expect(res.status).toBe(200);
    const { workItem } = await res.json();
    expect(workItem).toMatchObject({
      orgId: 'org1',
      createdBy: 'u1',
      factoryProjectId: PROJECT_ID,
      externalSource: {
        integrationId: 'github',
        type: 'issue',
        externalId: '42',
        url: 'https://github.com/acme/app/issues/42',
      },
      title: 'Fix the login flow',
      stages: ['intake'],
      metadata: { number: 42 },
    });
    expect(workItem.stageHistory).toHaveLength(1);
    expect(workItem.stageHistory[0]).toMatchObject({ stage: 'intake', by: 'u1' });
    expect(workItem.stageHistory[0].enteredAt).toBeTruthy();
    expect(workItem.stageHistory[0].exitedAt).toBeUndefined();
  });

  it('rejects an external-source upsert that tries to bypass governed stage transition', async () => {
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const res = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({
        stages: ['execute'],
        sessions: { work: { sessionId: '/sb/wt/issue-42', branch: 'factory/issue-42', threadId: 't-1' } },
      }),
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'governed_transition_required' });
    const [workItem] = await listItems();
    expect(workItem?.stages).toEqual(['intake']);
    expect(workItem?.stageHistory).toHaveLength(1);
    expect(workItem?.sessions).toEqual({});
  });

  it('never dedupes manual cards without an external source', async () => {
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody({ externalSource: null }));
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody({ externalSource: null }));
    expect(await listItems()).toHaveLength(2);
  });

  it('400s on an invalid body', async () => {
    const res = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody({ stages: [] }));
    expect(res.status).toBe(400);
    const bad = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({ externalSource: { integrationId: 'jira' } }),
    );
    expect(bad.status).toBe(400);
  });
});

// ── Patch ────────────────────────────────────────────────────────────────
describe('PATCH /web/factory/work-items/:id', () => {
  async function createItem(overrides: Record<string, unknown> = {}) {
    const res = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody(overrides));
    return (await res.json()).workItem;
  }

  it('rejects direct stage mutation and leaves the canonical item unchanged', async () => {
    const item = await createItem();
    const res = await buildApp({ workosId: 'u2', organizationId: 'org1' }).request(
      `/web/factory/work-items/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stages: ['execute'] }),
      },
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: 'governed_transition_required' });
    const [canonical] = await listItems();
    expect(canonical?.stages).toEqual(['intake']);
    expect(canonical?.stageHistory).toHaveLength(1);
  });

  it('rejects creation outside exclusive intake', async () => {
    const res = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({ stages: ['intake', 'execute'] }),
    );
    expect(res.status).toBe(409);
    expect(await listItems()).toHaveLength(0);
  });

  it('merges sessions and metadata instead of replacing', async () => {
    const item = await createItem({
      sessions: { work: { sessionId: '/sb/wt/a', branch: 'b-a', threadId: 't-a' } },
      metadata: { number: 42, labels: ['bug'] },
    });
    const res = await json('PATCH', `/web/factory/work-items/${item.id}`, {
      sessions: { review: { sessionId: '/sb/wt/r', branch: 'b-r', threadId: 't-r' } },
      metadata: { prNumber: 7 },
    });
    const { workItem } = await res.json();
    expect(Object.keys(workItem.sessions).sort()).toEqual(['review', 'work']);
    expect(workItem.metadata).toEqual({ number: 42, labels: ['bug'], prNumber: 7 });
  });

  it('serializes concurrent patches so neither session merge is dropped', async () => {
    const item = await createItem();
    // Two runs file their session refs on the same card at once (e.g. a work
    // run and a review run finishing kickoff together). Each merge reads the
    // current `sessions` and writes it back — without the row lock the last
    // write would silently drop the other role.
    const [workRes, reviewRes] = await Promise.all([
      json('PATCH', `/web/factory/work-items/${item.id}`, {
        sessions: { work: { sessionId: '/sb/wt/a', branch: 'b-a', threadId: 't-a' } },
      }),
      json('PATCH', `/web/factory/work-items/${item.id}`, {
        sessions: { review: { sessionId: '/sb/wt/r', branch: 'b-r', threadId: 't-r' } },
      }),
    ]);
    expect(workRes.status).toBe(200);
    expect(reviewRes.status).toBe(200);

    const list = await json('GET', `/web/factory/projects/${PROJECT_ID}/work-items`);
    const [workItem] = (await list.json()).workItems;
    expect(Object.keys(workItem.sessions).sort()).toEqual(['review', 'work']);
  });

  it('404s for items in another org', async () => {
    const item = await createItem();
    const res = await buildApp({ workosId: 'u9', organizationId: 'org2' }).request(
      `/web/factory/work-items/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title: 'Cross-tenant mutation' }),
      },
    );
    expect(res.status).toBe(404);
  });

  it('400s on an empty or invalid patch', async () => {
    const item = await createItem();
    expect((await json('PATCH', `/web/factory/work-items/${item.id}`, {})).status).toBe(400);
    expect((await json('PATCH', `/web/factory/work-items/${item.id}`, { title: '' })).status).toBe(400);
  });
});

describe('POST /web/factory/projects/:id/work-items/:workItemId/transition', () => {
  async function createItem(overrides: Record<string, unknown> = {}) {
    const res = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody(overrides));
    return (await res.json()).workItem;
  }

  const transition = (item: { id: string; revision: number }, overrides: Record<string, unknown> = {}) =>
    json('POST', `/web/factory/projects/${PROJECT_ID}/work-items/${item.id}/transition`, {
      board: 'work',
      stage: 'execute',
      expectedRevision: item.revision,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
      cause: 'board_drag',
      ...overrides,
    });

  it('moves through the rule authority and preserves storage-owned history', async () => {
    const item = await createItem();
    auditRecorded = [];
    const res = await transition(item);
    expect(res.status).toBe(200);
    const { result } = await res.json();
    expect(result).toMatchObject({ status: 'accepted', itemId: item.id, revision: 2, stage: 'execute' });
    const [canonical] = await listItems();
    expect(canonical?.stages).toEqual(['execute']);
    expect(canonical?.stageHistory.map(entry => [entry.stage, entry.exitedAt !== undefined])).toEqual([
      ['intake', true],
      ['execute', false],
    ]);
    expect(auditRecorded).toContainEqual(
      expect.objectContaining({
        action: 'factory.work_item.stage_moved',
        metadata: expect.objectContaining({ ingressType: 'human', ruleSetVersion: 'factory-default-v1' }),
      }),
    );
  });

  it('returns typed stale without overwriting the winner', async () => {
    const item = await createItem();
    expect((await transition(item)).status).toBe(200);
    const stale = await transition(item, { requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2', stage: 'planning' });
    expect(stale.status).toBe(409);
    expect(await stale.json()).toMatchObject({ result: { status: 'rejected', code: 'stale' } });
    expect((await listItems())[0]?.stages).toEqual(['execute']);
  });

  it('replays immutable ingress without evaluating a second destination', async () => {
    const item = await createItem();
    const first = await transition(item);
    const replay = await transition(item, { stage: 'planning' });
    expect(await replay.json()).toEqual(await first.json());
    expect((await listItems())[0]?.stages).toEqual(['execute']);
  });

  it('rejects non-UUID human request identities before they can collide across work items', async () => {
    const item = await createItem();
    const res = await transition(item, { requestId: 'reused-human-request' });
    expect(res.status).toBe(400);
  });

  it('rejects a work item addressed through the Review board', async () => {
    const item = await createItem();
    const res = await transition(item, { board: 'review' });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ result: { status: 'rejected', code: 'invalid_transition' } });
  });
});

describe('POST /web/factory/projects/:id/runs/start', () => {
  const startBody = (workItemId?: string) => ({
    sessionId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    threadTitle: 'Investigate issue 42',
    threadTags: { role: 'plan' },
    kickoffKey: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1',
    invocation: { type: 'prompt' as const, prompt: 'Start' },
    destinationStage: 'planning',
    workItem: {
      id: workItemId,
      role: 'plan',
      input: createBody({ stages: ['intake'] }),
    },
  });

  it('passes authenticated tenant identity to the coordinator and audits the prepared binding', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const { workItem } = await created.json();
    auditRecorded = [];
    const prepare = vi.fn(async (input: any) => ({
      workItemId: input.workItem.id,
      bindingId: 'binding-1',
      threadId: input.sessionId,
      resourceId: input.sessionId,
      sessionId: input.sessionId,
      branch: 'factory/issue-42',
      revision: 2,
      kickoffStatus: 'pending',
      replayed: false,
    }));
    const requestContext = new RequestContext();
    requestContext.set('user', orgUser);
    const app = buildApp(orgUser, { prepare }, requestContext);

    const res = await app.request(`/web/factory/projects/${PROJECT_ID}/runs/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(startBody(workItem.id)),
    });

    expect(res.status).toBe(202);
    expect(prepare).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: 'org1',
        userId: 'u1',
        factoryProjectId: PROJECT_ID,
        requestContext,
      }),
    );
    expect(auditRecorded).toContainEqual(
      expect.objectContaining({
        action: 'factory.run.started',
        metadata: expect.objectContaining({ bindingId: 'binding-1', role: 'plan' }),
      }),
    );
  });

  it('rejects a non-UUID kickoff identity before coordination', async () => {
    const prepare = vi.fn();
    const app = buildApp(orgUser, { prepare });

    const res = await app.request(`/web/factory/projects/${PROJECT_ID}/runs/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...startBody(), kickoffKey: 'reused-kickoff' }),
    });

    expect(res.status).toBe(400);
    expect(prepare).not.toHaveBeenCalled();
  });

  it.each(['', 'not-a-uuid', 'x'.repeat(65), 42])(
    'rejects an explicitly supplied invalid work item identity: %o',
    async id => {
      const prepare = vi.fn();
      const app = buildApp(orgUser, { prepare });
      const body = startBody();

      const res = await app.request(`/web/factory/projects/${PROJECT_ID}/runs/start`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...body, workItem: { ...body.workItem, id } }),
      });

      expect(res.status).toBe(400);
      expect(prepare).not.toHaveBeenCalled();
    },
  );

  it('refuses non-Intake creation before the coordinator can bypass transition authority', async () => {
    const prepare = vi.fn();
    const app = buildApp(orgUser, { prepare });
    const body = startBody();
    body.workItem.input.stages = ['planning'];

    const res = await app.request(`/web/factory/projects/${PROJECT_ID}/runs/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });

    expect(res.status).toBe(409);
    expect(prepare).not.toHaveBeenCalled();
  });
});

// ── Delete ───────────────────────────────────────────────────────────────
describe('DELETE /web/factory/work-items/:id', () => {
  it('removes the item for the org', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const { workItem } = await created.json();
    const res = await json('DELETE', `/web/factory/work-items/${workItem.id}`);
    expect((await res.json()).ok).toBe(true);
    expect(await listItems()).toHaveLength(0);
  });

  it('404s for unknown or cross-org items', async () => {
    expect((await json('DELETE', `/web/factory/work-items/00000000-0000-4000-8000-000000000099`)).status).toBe(404);
  });
});

// ── Related Work / Review items ──────────────────────────────────────────
describe('work item relations', () => {
  const create = async (externalId: string, overrides: Record<string, unknown> = {}) => {
    const response = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({
        externalSource: { integrationId: 'github', type: 'issue', externalId },
        ...overrides,
      }),
    );
    return { response, body: await response.json() };
  };

  it('creates separate related items and preserves the relation on source-key reuse', async () => {
    const { body: parent } = await create('parent');
    const { body: child } = await create('child', {
      externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'child' },
      parentWorkItemId: parent.workItem.id,
    });

    expect(child.workItem.parentWorkItemId).toBe(parent.workItem.id);

    const { body: repeated } = await create('child', {
      externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'child' },
      parentWorkItemId: null,
      title: 'Updated review title',
    });
    expect(repeated.workItem).toMatchObject({
      id: child.workItem.id,
      parentWorkItemId: parent.workItem.id,
      title: 'Updated review title',
    });
  });

  it('attaches a parent when a repeated source-key upsert supplies one', async () => {
    const { body: parent } = await create('late-parent');
    const pullRequestSource = { integrationId: 'github', type: 'pull-request', externalId: 'late-child' };
    const { body: existing } = await create('late-child', { externalSource: pullRequestSource });
    const { body: related } = await create('late-child', {
      externalSource: pullRequestSource,
      parentWorkItemId: parent.workItem.id,
    });

    expect(related.workItem).toMatchObject({ id: existing.workItem.id, parentWorkItemId: parent.workItem.id });
  });

  it('rejects missing, cross-project, self, and cyclic relations', async () => {
    const missing = await create('missing', {
      parentWorkItemId: '00000000-0000-4000-8000-000000000099',
    });
    expect(missing.response.status).toBe(400);

    const otherProject = await seed.projects.create({
      orgId: 'org1',
      userId: 'u1',
      input: { name: 'Other project' },
    });
    const otherParentResponse = await json(
      'POST',
      `/web/factory/projects/${otherProject.id}/work-items`,
      createBody({
        externalSource: { integrationId: 'github', type: 'issue', externalId: 'other-project' },
      }),
    );
    const otherParent = (await otherParentResponse.json()).workItem;
    const crossProject = await create('cross-project', { parentWorkItemId: otherParent.id });
    expect(crossProject.response.status).toBe(400);

    const { body: first } = await create('first');
    const { body: second } = await create('second', { parentWorkItemId: first.workItem.id });
    expect(
      (
        await json('PATCH', `/web/factory/work-items/${first.workItem.id}`, {
          parentWorkItemId: first.workItem.id,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await json('PATCH', `/web/factory/work-items/${first.workItem.id}`, {
          parentWorkItemId: second.workItem.id,
        })
      ).status,
    ).toBe(400);
  });

  it('clears a relation explicitly and when the parent is deleted', async () => {
    const { body: parent } = await create('delete-parent');
    const { body: child } = await create('delete-child', { parentWorkItemId: parent.workItem.id });

    const cleared = await json('PATCH', `/web/factory/work-items/${child.workItem.id}`, { parentWorkItemId: null });
    expect((await cleared.json()).workItem.parentWorkItemId).toBeNull();

    await json('PATCH', `/web/factory/work-items/${child.workItem.id}`, { parentWorkItemId: parent.workItem.id });
    expect((await json('DELETE', `/web/factory/work-items/${parent.workItem.id}`)).status).toBe(200);
    expect((await listItems())[0]?.parentWorkItemId).toBeNull();
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────
describe('GET /web/factory/projects/:id/metrics', () => {
  it('401s without a user and 404s for projects outside the org', async () => {
    expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics`, undefined, null)).status).toBe(401);

    await seedProject('other-org');
    expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics`)).status).toBe(404);
  });

  it('clamps the days param to a supported window', async () => {
    const bodyFor = async (query: string) =>
      (await (await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics${query}`)).json()).metrics;

    expect((await bodyFor('')).windowDays).toBe(30);
    expect((await bodyFor('?days=7')).windowDays).toBe(7);
    expect((await bodyFor('?days=90')).windowDays).toBe(90);
    expect((await bodyFor('?days=17')).windowDays).toBe(30);
    expect((await bodyFor('?days=evil')).windowDays).toBe(30);
  });

  it('aggregates the project board: throughput, WIP, transitions, and source mix', async () => {
    // One card completed today (intake → done), one still in intake.
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const { workItem } = await created.json();
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items/${workItem.id}/transition`, {
      board: 'work',
      stage: 'done',
      expectedRevision: workItem.revision,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
      cause: 'board_drag',
    });
    await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({ externalSource: null, title: 'Manual card' }),
    );

    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics?days=7`);
    expect(res.status).toBe(200);
    const { metrics } = await res.json();

    expect(metrics.windowDays).toBe(7);
    expect(metrics.throughput).toHaveLength(7);
    expect(metrics.throughput.reduce((sum: number, p: any) => sum + p.count, 0)).toBe(1);
    expect(metrics.cycleTime.samples).toBe(1);
    expect(Object.fromEntries(metrics.wip.map((w: any) => [w.stage, w.count]))).toEqual({ done: 1, intake: 1 });
    expect(metrics.wipTotal).toBe(1);
    expect(metrics.agingWip).toHaveLength(1);
    expect(metrics.agingWip[0]).toMatchObject({ title: 'Manual card', stage: 'intake' });
    // intake entered (x2) + done entered = 3 stage moves, all by the test user.
    expect(metrics.transitions).toEqual({ human: 3, total: 3 });
    expect(metrics.sourceMix).toEqual(
      expect.arrayContaining([
        { source: 'github:issue', count: 1 },
        { source: 'manual', count: 1 },
      ]),
    );
  });

  it('returns zeroed metrics for an empty board', async () => {
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics`);
    const { metrics } = await res.json();
    expect(metrics.throughput).toHaveLength(30);
    expect(metrics.cycleTime).toEqual({ medianMs: null, p90Ms: null, samples: 0 });
    expect(metrics.wip).toEqual([]);
    expect(metrics.agingWip).toEqual([]);
  });
});

describe('GET /web/factory/projects/:id/health/thresholds', () => {
  it('401s without a user and 404s for projects outside the org', async () => {
    expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/health/thresholds`, undefined, null)).status).toBe(
      401,
    );

    await seedProject('other-org');
    expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/health/thresholds`)).status).toBe(404);
  });

  it('returns the default config when unset and the saved config after saveConfig', async () => {
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/health/thresholds`);
    expect(res.status).toBe(200);
    expect((await res.json()).thresholds).toEqual([14400, 86400, 259200]);

    await seed.queueHealth.saveConfig('org1', PROJECT_ID, { thresholdsSeconds: [60, 300, 3600] });
    const res2 = await json('GET', `/web/factory/projects/${PROJECT_ID}/health/thresholds`);
    expect((await res2.json()).thresholds).toEqual([60, 300, 3600]);
  });
});

// ── Audit events ─────────────────────────────────────────────────────────
describe('audit events', () => {
  async function createItem(overrides: Record<string, unknown> = {}) {
    const res = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody(overrides));
    return (await res.json()).workItem;
  }

  it('records work_item.created on POST with actor, project, and target', async () => {
    const item = await createItem();
    expect(auditRecorded).toHaveLength(1);
    expect(auditRecorded[0]).toMatchObject({
      orgId: 'org1',
      actorId: 'u1',
      action: 'factory.work_item.created',
      factoryProjectId: PROJECT_ID,
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the login flow' }],
      metadata: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: '42',
          url: 'https://github.com/acme/app/issues/42',
        },
        stages: ['intake'],
      },
    });
  });

  it('audits only the bounded non-stage refresh when a source-key POST reuses the canonical item', async () => {
    const item = await createItem();
    auditRecorded = [];

    const reused = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    expect(reused.status).toBe(200);
    expect((await reused.json()).workItem.id).toBe(item.id);
    expect(auditRecorded.map(event => event.action)).toEqual(['factory.work_item.updated']);
    expect(auditRecorded[0]?.metadata.fields).not.toContain('stages');
    expect(auditRecorded[0]?.metadata.fields).not.toContain('sessions');
  });

  it('does not audit a rejected legacy stage PATCH as a movement', async () => {
    const item = await createItem();
    auditRecorded = [];

    const rejected = await json('PATCH', `/web/factory/work-items/${item.id}`, { stages: ['execute'] });
    expect(rejected.status).toBe(409);
    expect(auditRecorded).toEqual([]);
  });

  it('records run.started when a PATCH introduces a new session role, but not on re-file', async () => {
    const item = await createItem();
    auditRecorded = [];

    const session = { sessionId: '/sb/wt/issue-42', branch: 'factory/issue-42', threadId: 't-1' };
    await json('PATCH', `/web/factory/work-items/${item.id}`, { sessions: { work: session } });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated', 'factory.run.started']);
    expect(auditRecorded[1].metadata).toEqual({
      role: 'work',
      branch: 'factory/issue-42',
      threadId: 't-1',
      sessionId: '/sb/wt/issue-42',
    });

    // Re-filing the same role is not a new run.
    auditRecorded = [];
    await json('PATCH', `/web/factory/work-items/${item.id}`, { sessions: { work: session } });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated']);
  });

  it('records only updated when the patch does not move stages', async () => {
    const item = await createItem();
    auditRecorded = [];

    await json('PATCH', `/web/factory/work-items/${item.id}`, { title: 'Renamed card' });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated']);
    expect(auditRecorded[0].metadata).toEqual({ fields: ['title'] });
  });

  it('records work_item.deleted on DELETE', async () => {
    const item = await createItem();
    auditRecorded = [];

    await json('DELETE', `/web/factory/work-items/${item.id}`);
    expect(auditRecorded).toHaveLength(1);
    expect(auditRecorded[0]).toMatchObject({
      action: 'factory.work_item.deleted',
      factoryProjectId: PROJECT_ID,
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the login flow' }],
    });
  });

  it('never blocks the mutation when the audit insert throws', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    auditFailure = new Error('audit db down');

    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    expect(created.status).toBe(200);
    const { workItem } = await created.json();

    const transitioned = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items/${workItem.id}/transition`,
      {
        board: 'work',
        stage: 'done',
        expectedRevision: workItem.revision,
        requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
        cause: 'board_drag',
      },
    );
    expect(transitioned.status).toBe(200);

    const deleted = await json('DELETE', `/web/factory/work-items/${workItem.id}`);
    expect(deleted.status).toBe(200);
    expect(await listItems()).toHaveLength(0);

    warn.mockRestore();
  });
});

// ── Validation units ─────────────────────────────────────────────────────
describe('parseCreateWorkItem', () => {
  it('accepts a minimal manual work item', () => {
    expect(parseCreateWorkItem({ title: ' Card ', stages: ['intake'] })).toEqual({
      title: 'Card',
      stages: ['intake'],
    });
  });

  it('accepts a normalized external source', () => {
    expect(parseCreateWorkItem(createBody())).toEqual(createBody());
  });

  it('rejects bad stages, malformed external sources, and oversized metadata', () => {
    expect(parseCreateWorkItem(createBody({ stages: ['in take'] }))).toBeNull();
    expect(parseCreateWorkItem(createBody({ stages: ['a', 'a'] }))).toBeNull();
    expect(parseCreateWorkItem(createBody({ externalSource: { integrationId: 'github' } }))).toBeNull();
    expect(parseCreateWorkItem(createBody({ metadata: { blob: 'x'.repeat(20_000) } }))).toBeNull();
  });

  it('rejects malformed sessions', () => {
    expect(parseCreateWorkItem(createBody({ sessions: { work: { sessionId: '/p' } } }))).toBeNull();
    expect(
      parseCreateWorkItem(createBody({ sessions: { '': { sessionId: '/p', branch: 'b', threadId: 't' } } })),
    ).toBeNull();
  });
});

describe('parseUpdateWorkItem', () => {
  it('rejects an empty or unknown-only patch and passes through valid fields', () => {
    expect(parseUpdateWorkItem({})).toBeNull();
    expect(parseUpdateWorkItem({ stages: ['done'] })).toEqual({ stages: ['done'] });
    expect(parseUpdateWorkItem({ url: null })).toBeNull();
  });
});
