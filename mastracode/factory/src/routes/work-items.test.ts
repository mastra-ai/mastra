import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

import type { AuditEmitter } from '../storage/domains/audit/domain';

let auditRecorded: Array<Record<string, any>> = [];
let auditFailure: Error | undefined;

const audit: AuditEmitter = {
  async emit({ context, input }) {
    try {
      if (auditFailure) throw auditFailure;
      const user = context.get('webAuthUser' as never) as { workosId: string; organizationId?: string } | undefined;
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
import { createFactoryStorageForTests } from '../storage/test-utils';
import type { FactoryStorageTestSeed } from '../storage/test-utils';
import { fakeRouteAuth, mountApiRoutes } from './test-utils';
import { parseCreateWorkItem, parseUpdateWorkItem, WorkItemRoutes } from './work-items';

// ── Test harness ─────────────────────────────────────────────────────────
function buildApp(user: { workosId: string; organizationId?: string } | null) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('webAuthUser' as never, user as never);
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

  it('upserts on the external source identity instead of duplicating', async () => {
    await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const res = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({
        stages: ['execute'],
        sessions: { work: { projectPath: '/sb/wt/issue-42', branch: 'factory/issue-42', threadId: 't-1' } },
      }),
    );
    const { workItem } = await res.json();
    expect(await listItems()).toHaveLength(1);
    expect(workItem.stages).toEqual(['execute']);
    // History: intake entered+exited, execute entered.
    expect(workItem.stageHistory.map((e: any) => [e.stage, e.exitedAt !== undefined])).toEqual([
      ['intake', true],
      ['execute', false],
    ]);
    // Session got the acting user stamped server-side.
    expect(workItem.sessions.work).toMatchObject({
      projectPath: '/sb/wt/issue-42',
      branch: 'factory/issue-42',
      threadId: 't-1',
      startedBy: 'u1',
    });
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

  it('moves stages and appends history with the acting user', async () => {
    const item = await createItem();
    const res = await buildApp({ workosId: 'u2', organizationId: 'org1' }).request(
      `/web/factory/work-items/${item.id}`,
      {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ stages: ['execute'] }),
      },
    );
    const { workItem } = await res.json();
    expect(workItem.stages).toEqual(['execute']);
    expect(workItem.stageHistory).toHaveLength(2);
    expect(workItem.stageHistory[0]).toMatchObject({ stage: 'intake', by: 'u1' });
    expect(workItem.stageHistory[0].exitedAt).toBeTruthy();
    expect(workItem.stageHistory[1]).toMatchObject({ stage: 'execute', by: 'u2' });
  });

  it('keeps concurrent stages untouched when moving one of them', async () => {
    const item = await createItem({ stages: ['execute', 'review'] });
    const res = await json('PATCH', `/web/factory/work-items/${item.id}`, { stages: ['done'] });
    const { workItem } = await res.json();
    expect(workItem.stages).toEqual(['done']);
    const open = workItem.stageHistory.filter((e: any) => e.exitedAt === undefined);
    expect(open.map((e: any) => e.stage)).toEqual(['done']);
  });

  it('merges sessions and metadata instead of replacing', async () => {
    const item = await createItem({
      sessions: { work: { projectPath: '/sb/wt/a', branch: 'b-a', threadId: 't-a' } },
      metadata: { number: 42, labels: ['bug'] },
    });
    const res = await json('PATCH', `/web/factory/work-items/${item.id}`, {
      sessions: { review: { projectPath: '/sb/wt/r', branch: 'b-r', threadId: 't-r' } },
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
        sessions: { work: { projectPath: '/sb/wt/a', branch: 'b-a', threadId: 't-a' } },
      }),
      json('PATCH', `/web/factory/work-items/${item.id}`, {
        sessions: { review: { projectPath: '/sb/wt/r', branch: 'b-r', threadId: 't-r' } },
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
        body: JSON.stringify({ stages: ['done'] }),
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
    await json('PATCH', `/web/factory/work-items/${workItem.id}`, { stages: ['done'] });
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

  it('records updated (not created) when a POST reuses an existing sourceKey', async () => {
    const item = await createItem();
    auditRecorded = [];

    const session = { projectPath: '/sb/wt/issue-42', branch: 'factory/issue-42', threadId: 't-1' };
    await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({ stages: ['execute'], sessions: { work: session } }),
    );
    expect(auditRecorded.map(e => e.action)).toEqual([
      'factory.work_item.updated',
      'factory.work_item.stage_moved',
      'factory.run.started',
    ]);
    expect(auditRecorded[1]).toMatchObject({
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the login flow' }],
      metadata: { from: ['intake'], to: ['execute'] },
    });
    expect(auditRecorded[2].metadata).toMatchObject({ role: 'work', branch: 'factory/issue-42' });
  });

  it('records updated + stage_moved with the server-diffed from/to on a stage PATCH', async () => {
    const item = await createItem();
    auditRecorded = [];

    await json('PATCH', `/web/factory/work-items/${item.id}`, { stages: ['execute'] });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated', 'factory.work_item.stage_moved']);
    expect(auditRecorded[0].metadata).toEqual({ fields: ['stages'] });
    expect(auditRecorded[1]).toMatchObject({
      factoryProjectId: PROJECT_ID,
      targets: [{ type: 'work_item', id: item.id, name: 'Fix the login flow' }],
      metadata: { from: ['intake'], to: ['execute'] },
    });
  });

  it('records run.started when a PATCH introduces a new session role, but not on re-file', async () => {
    const item = await createItem();
    auditRecorded = [];

    const session = { projectPath: '/sb/wt/issue-42', branch: 'factory/issue-42', threadId: 't-1' };
    await json('PATCH', `/web/factory/work-items/${item.id}`, { sessions: { work: session } });
    expect(auditRecorded.map(e => e.action)).toEqual(['factory.work_item.updated', 'factory.run.started']);
    expect(auditRecorded[1].metadata).toEqual({
      role: 'work',
      branch: 'factory/issue-42',
      threadId: 't-1',
      projectPath: '/sb/wt/issue-42',
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

    const patched = await json('PATCH', `/web/factory/work-items/${workItem.id}`, { stages: ['done'] });
    expect(patched.status).toBe(200);

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
    expect(parseCreateWorkItem(createBody({ sessions: { work: { projectPath: '/p' } } }))).toBeNull();
    expect(
      parseCreateWorkItem(createBody({ sessions: { '': { projectPath: '/p', branch: 'b', threadId: 't' } } })),
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
