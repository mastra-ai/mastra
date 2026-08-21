import { RequestContext } from '@mastra/core/request-context';
import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ────────────────────────────────────────────────────────────────

import { builtInFactoryRules } from '../rules/defaults.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryRuleActor } from '../rules/types.js';
import type { AuditEmitter } from '../storage/domains/audit/domain.js';
import {
  FACTORY_PULL_REQUEST_RECONCILIATION_KEY,
  FACTORY_RULE_MATERIALIZATION_KEY,
} from '../storage/domains/work-items/base.js';
import type { FactoryDeferredDecisionRecord } from '../storage/domains/work-items/base.js';

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
  running: ReadonlySet<string> = new Set(),
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
      liveSessions: { isRunning: sessionId => running.has(sessionId) },
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

/** Session of a started run — what makes a card the Factory's own work. */
const run = { execute: { sessionId: 'session-1', branch: 'factory/1', threadId: 'thread-1' } };

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
  vi.useRealTimers();
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

// ── Read wire ────────────────────────────────────────────────────────────
describe('work item read wire', () => {
  it('keeps internal tokens in storage and out of every read', async () => {
    const { item } = await seed.workItems.upsert({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: PROJECT_ID,
      input: {
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: '42',
          url: 'https://github.com/acme/app/issues/42',
        },
        title: 'Fix the login flow',
        stages: ['intake'],
        sessions: {},
        metadata: {
          number: 42,
          [FACTORY_RULE_MATERIALIZATION_KEY]: 'rule-7:issue-42',
          [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'merged',
        },
      },
    });

    const listed = await json('GET', `/web/factory/projects/${PROJECT_ID}/work-items`);
    expect((await listed.json()).workItems[0].metadata).toEqual({ number: 42 });

    const patched = await json('PATCH', `/web/factory/work-items/${item.id}`, { metadata: { prNumber: 7 } });
    expect((await patched.json()).workItem.metadata).toEqual({ number: 42, prNumber: 7 });

    const [stored] = await listItems();
    expect(stored?.metadata[FACTORY_RULE_MATERIALIZATION_KEY]).toBe('rule-7:issue-42');
    expect(stored?.metadata[FACTORY_PULL_REQUEST_RECONCILIATION_KEY]).toBe('merged');
  });

  it('drops internal tokens from browser writes', async () => {
    const created = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({
        metadata: {
          number: 42,
          [FACTORY_RULE_MATERIALIZATION_KEY]: 'caller-materialization',
          [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'merged',
        },
      }),
    );
    const { workItem } = await created.json();
    expect(workItem.metadata).toEqual({ number: 42 });

    const patched = await json('PATCH', `/web/factory/work-items/${workItem.id}`, {
      metadata: {
        prNumber: 7,
        [FACTORY_RULE_MATERIALIZATION_KEY]: 'replacement-materialization',
        [FACTORY_PULL_REQUEST_RECONCILIATION_KEY]: 'closed',
      },
    });
    expect((await patched.json()).workItem.metadata).toEqual({ number: 42, prNumber: 7 });

    const [stored] = await listItems();
    expect(stored?.metadata).toEqual({ number: 42, prNumber: 7 });
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

  it('accepts a human cancel over HTTP', async () => {
    const item = await createItem();
    const res = await transition(item, { stage: 'canceled' });
    expect(res.status).toBe(200);
    expect((await res.json()).result).toMatchObject({ status: 'accepted', stage: 'canceled' });
    expect((await listItems())[0]?.stages).toEqual(['canceled']);
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

  it('passes authenticated tenant identity and the Factory default model to the coordinator', async () => {
    await seed.projects.update({
      orgId: 'org1',
      id: PROJECT_ID,
      input: { defaultModelId: 'anthropic/claude-fable-5' },
    });
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
        defaultModelId: 'anthropic/claude-fable-5',
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

  it('arms the item so the runs that follow a person’s start need no further consent', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const { workItem } = await created.json();
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
    const app = buildApp(orgUser, { prepare });

    const res = await app.request(`/web/factory/projects/${PROJECT_ID}/runs/start`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(startBody(workItem.id)),
    });

    expect(res.status).toBe(202);
    // Arming rides inside prepareRunStart's transaction; the route's contract
    // is passing the flag through to the coordinator.
    expect(prepare).toHaveBeenCalledWith(expect.objectContaining({ armAutonomy: true }));
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

describe('GET /web/factory/projects/:id/attention', () => {
  it('tracks read and archived failure occurrences across retries', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const createdBody = await created.json();
    const workItem = createdBody.workItem;
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      ingress: { identity: 'attention-failure', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: workItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Notify the session.',
          idempotencyKey: 'attention-failure',
        },
      ],
      causalChain: [],
      now,
    });

    const failNextAttempt = async () => {
      const [claimed] = await seed.workItems.claimDeferredDecisions({
        ownerId: 'worker-1',
        now,
        leaseExpiresAt: new Date(now.getTime() + 60_000),
        limit: 1,
      });
      if (!claimed) throw new Error('Expected a deferred decision');
      const failed = await seed.workItems.failDeferredDecision({
        id: claimed.id,
        orgId: claimed.orgId,
        factoryProjectId: claimed.factoryProjectId,
        ownerId: 'worker-1',
        now,
        availableAt: now,
        lastError: 'No active Factory binding for role work.',
        failureCode: 'source_control_missing',
        terminal: true,
      });
      if (!failed) throw new Error('Expected a failed deferred decision');
      return failed;
    };

    const firstFailure = await failNextAttempt();
    const firstKey = `factory:${PROJECT_ID}:attention:automation-failed:${firstFailure.id}:1`;
    const findMany = vi.spyOn(seed.storage.ops, 'findMany');
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [
        {
          key: firstKey,
          kind: 'automation-failed',
          decisionId: firstFailure.id,
          occurrence: 1,
          workItemId: workItem.id,
          title: 'Fix the login flow',
          detail: 'No active Factory binding for role work.',
          decisionType: 'sendMessage',
          failureCode: 'source_control_missing',
          canRetry: true,
          occurredAt: now.toISOString(),
          read: false,
          archived: false,
          target: { kind: 'work-item', workItemId: workItem.id, board: 'work' },
        },
      ],
      openCount: 1,
      approvalCount: 0,
      badgeCount: 1,
      unreadCount: 1,
      latestOccurrenceKey: firstKey,
      latestOccurrenceAt: now.toISOString(),
      latestOccurrenceUnread: true,
      hasMore: false,
    });
    const receiptRead = findMany.mock.calls.find(([collection]) => collection === 'factory_attention_receipts');
    expect(receiptRead?.[1]).toMatchObject({ source_id: { in: [firstFailure.id] } });
    const decisionReads = findMany.mock.calls.filter(([collection]) => collection === 'factory_deferred_decisions');
    expect(decisionReads.every(([, , options]) => options?.limit !== undefined)).toBe(true);

    expect(
      (
        await json('PATCH', `/web/factory/work-items/${workItem.id}`, {
          sessions: {
            triage: { sessionId: 'session-triage', branch: 'factory/triage', threadId: 'thread-triage' },
          },
        })
      ).status,
    ).toBe(200);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [{ decisionId: firstFailure.id, target: { kind: 'work-item', workItemId: workItem.id, board: 'work' } }],
    });

    expect(
      (
        await json('PATCH', `/web/factory/work-items/${workItem.id}`, {
          sessions: {
            work: { sessionId: 'session-attention', branch: 'factory/attention', threadId: 'thread-attention' },
          },
        })
      ).status,
    ).toBe(200);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [
        {
          decisionId: firstFailure.id,
          target: { kind: 'thread', sessionId: 'session-attention', threadId: 'thread-attention' },
        },
      ],
    });
    const receiptPath = `/web/factory/projects/${PROJECT_ID}/attention/automation-failed/${firstFailure.id}/1`;
    expect((await json('POST', `${receiptPath}/read`)).status).toBe(200);
    await expect(
      (await json('GET', `/web/factory/projects/${PROJECT_ID}/attention?view=unread`)).json(),
    ).resolves.toMatchObject({ items: [], openCount: 1, unreadCount: 0 });

    expect((await json('POST', `${receiptPath}/archive`)).status).toBe(200);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [],
      openCount: 0,
      unreadCount: 0,
    });
    expect((await json('POST', `${receiptPath}/read`)).status).toBe(200);
    await expect(
      (await json('GET', `/web/factory/projects/${PROJECT_ID}/attention?view=archived`)).json(),
    ).resolves.toMatchObject({
      items: [{ key: firstKey, read: true, archived: true }],
    });

    expect((await json('POST', `${receiptPath}/restore`)).status).toBe(200);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [{ key: firstKey, read: true, archived: false }],
      openCount: 1,
      unreadCount: 0,
    });
    await seed.workItems.setAttentionReceipt({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      userId: 'u2',
      decisionId: firstFailure.id,
      failureOccurrence: firstFailure.failureOccurrence,
      action: 'archive',
      now,
    });

    expect((await json('POST', `/web/factory/projects/${PROJECT_ID}/decisions/${firstFailure.id}/retry`)).status).toBe(
      200,
    );
    const receiptsAfterRetry = await Promise.all(
      ['u1', 'u2'].map(userId =>
        seed.workItems.listAttentionReceipts({
          orgId: 'org1',
          factoryProjectId: PROJECT_ID,
          userId,
          identities: [
            {
              kind: 'automation-failed',
              sourceId: firstFailure.id,
              occurrence: firstFailure.failureOccurrence,
            },
          ],
        }),
      ),
    );
    expect(receiptsAfterRetry).toEqual([[], []]);
    const secondFailure = await failNextAttempt();
    expect(secondFailure.failureOccurrence).toBe(2);
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [
        {
          key: `factory:${PROJECT_ID}:attention:automation-failed:${secondFailure.id}:2`,
          read: false,
          archived: false,
        },
      ],
      openCount: 1,
      unreadCount: 1,
    });

    const readAll = await json('POST', `/web/factory/projects/${PROJECT_ID}/attention/read-all`);
    expect(readAll.status).toBe(200);
    await expect(readAll.json()).resolves.toEqual({ ok: true, hasMore: false });
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [{ occurrence: 2, read: true, archived: false }],
      openCount: 1,
      unreadCount: 0,
    });

    const [retried, staleReceipt] = await Promise.all([
      seed.workItems.retryDeferredDecision('org1', PROJECT_ID, secondFailure.id, now),
      seed.workItems.setAttentionReceipt({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u3',
        decisionId: secondFailure.id,
        failureOccurrence: secondFailure.failureOccurrence,
        action: 'archive',
        now,
      }),
    ]);
    expect(retried).toMatchObject({ status: 'retry' });
    expect(staleReceipt).toBeNull();
    await expect(
      seed.workItems.listAttentionReceipts({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u3',
        identities: [
          {
            kind: 'automation-failed',
            sourceId: secondFailure.id,
            occurrence: secondFailure.failureOccurrence,
          },
        ],
      }),
    ).resolves.toEqual([]);
  });

  it('reports proposed work as one project approval queue', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const workItem = (await created.json()).workItem;
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      ingress: { identity: 'approval-queue', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: workItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'invokeSkill',
          role: 'triage',
          skillName: 'factory-triage',
          idempotencyKey: 'approval-queue-triage',
        },
      ],
      causalChain: [],
      now,
    });
    const [claimed] = await seed.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 60_000),
      limit: 1,
    });
    if (!claimed) throw new Error('Expected a proposed decision');
    await seed.workItems.proposeDeferredDecision(
      { id: claimed.id, orgId: claimed.orgId, factoryProjectId: claimed.factoryProjectId, ownerId: 'worker-1' },
      now,
    );

    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [],
      approvalCount: 1,
      badgeCount: 1,
      openCount: 1,
      unreadCount: 0,
    });

    await seed.workItems.supersedeTerminalDecisionsForWorkItem({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      supersededAt: now,
    });
    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      approvalCount: 0,
      badgeCount: 0,
      openCount: 0,
    });
  });

  it('orders a re-failed old decision by its latest failure occurrence', async () => {
    const createdAt = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: null,
      ingress: { identity: 'attention-refailure-order', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: null,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Older decision.',
          idempotencyKey: 'attention-refailure-older',
        },
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Newer decision.',
          idempotencyKey: 'attention-refailure-newer',
        },
      ],
      causalChain: [],
      now: createdAt,
    });
    const claimed = await seed.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now: createdAt,
      leaseExpiresAt: new Date(createdAt.getTime() + 60_000),
      limit: 2,
    });
    const [older, newer] = [...claimed].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (!older || !newer) throw new Error('Expected two deferred decisions');
    const fail = (decision: FactoryDeferredDecisionRecord, now: Date) =>
      seed.workItems.failDeferredDecision({
        id: decision.id,
        orgId: decision.orgId,
        factoryProjectId: decision.factoryProjectId,
        ownerId: 'worker-1',
        now,
        availableAt: now,
        lastError: `Failure ${decision.id}`,
        failureCode: 'unknown',
        terminal: true,
      });
    const firstFailureAt = new Date(createdAt.getTime() + 60_000);
    const newerFailureAt = new Date(createdAt.getTime() + 120_000);
    await fail(older, firstFailureAt);
    await fail(newer, newerFailureAt);

    const refailureAt = new Date(createdAt.getTime() + 180_000);
    await seed.workItems.retryDeferredDecision('org1', PROJECT_ID, older.id, refailureAt);
    const [reclaimed] = await seed.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now: refailureAt,
      leaseExpiresAt: new Date(refailureAt.getTime() + 60_000),
      limit: 1,
    });
    if (!reclaimed) throw new Error('Expected the retried decision');
    await fail(reclaimed, refailureAt);

    const firstPage = await (await json('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=1`)).json();
    expect(firstPage).toMatchObject({
      items: [{ decisionId: older.id, occurrence: 2, occurredAt: refailureAt.toISOString() }],
      hasMore: true,
    });
    if (typeof firstPage.nextCursor !== 'string') throw new Error('Expected an attention cursor');
    await expect(
      (
        await json(
          'GET',
          `/web/factory/projects/${PROJECT_ID}/attention?limit=1&before=${encodeURIComponent(firstPage.nextCursor)}`,
        )
      ).json(),
    ).resolves.toMatchObject({
      items: [{ decisionId: newer.id, occurredAt: newerFailureAt.toISOString() }],
      hasMore: false,
    });
  });

  it('repairs only legacy decisions whose canonical work is finished', async () => {
    const terminalResponse = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({ title: 'Terminal repair target' }),
    );
    const terminalItem = (await terminalResponse.json()).workItem;
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: terminalItem.id,
      ingress: { identity: 'legacy-repair-terminal', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: terminalItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'transition',
          board: 'work',
          stage: 'done',
          idempotencyKey: 'legacy-transition-accepted',
        },
        {
          type: 'invokeSkill',
          role: 'work',
          skillName: 'factory-plan',
          idempotencyKey: 'legacy-terminal-skill',
        },
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Obsolete message.',
          idempotencyKey: 'legacy-terminal-message',
        },
        {
          type: 'invokeSkill',
          role: 'review',
          skillName: 'factory-review',
          idempotencyKey: 'legacy-terminal-proposal',
        },
      ],
      causalChain: [],
      now,
    });
    const terminalDecisions = await seed.workItems.listDeferredDecisions('org1', PROJECT_ID);
    const byKey = new Map(terminalDecisions.map(decision => [decision.idempotencyKey, decision]));
    const transition = byKey.get('legacy-transition-accepted');
    const failedSkill = byKey.get('legacy-terminal-skill');
    const failedMessage = byKey.get('legacy-terminal-message');
    const proposal = byKey.get('legacy-terminal-proposal');
    if (!transition || !failedSkill || !failedMessage || !proposal) {
      throw new Error('Expected legacy repair decisions');
    }
    await seed.storage.ops.updateMany(
      'factory_deferred_decisions',
      { id: { in: [transition.id, failedSkill.id, failedMessage.id] } },
      { status: 'failed', last_error: 'Legacy failure.', completed_at: now, updated_at: now },
    );
    await seed.storage.ops.updateMany(
      'factory_deferred_decisions',
      { id: proposal.id },
      { status: 'proposed', updated_at: now },
    );
    await seed.workItems.setAttentionReceipt({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      userId: 'u1',
      decisionId: failedSkill.id,
      failureOccurrence: 0,
      action: 'archive',
      now,
    });
    await seed.storage.ops.insertOne('factory_rule_ingress', {
      org_id: 'org1',
      factory_project_id: PROJECT_ID,
      identity: 'decision:legacy-transition-accepted',
      trigger_type: 'rule',
      transition_id: crypto.randomUUID(),
      result: { status: 'accepted', stage: 'done' },
      created_at: now,
    });
    await seed.workItems.update({
      orgId: 'org1',
      id: terminalItem.id,
      userId: 'user-1',
      patch: { stages: ['done'] },
    });

    const activeResponse = await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({
        title: 'Active repair target',
        externalSource: {
          integrationId: 'github',
          type: 'issue',
          externalId: '43',
          url: 'https://github.com/acme/app/issues/43',
        },
        metadata: { number: 43 },
      }),
    );
    const activeItem = (await activeResponse.json()).workItem;
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: activeItem.id,
      ingress: { identity: 'legacy-repair-active', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: activeItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'invokeSkill',
          role: 'work',
          skillName: 'factory-plan',
          idempotencyKey: 'legacy-active-skill',
        },
        {
          type: 'invokeSkill',
          role: 'review',
          skillName: 'factory-review',
          idempotencyKey: 'legacy-multistage-proposal',
        },
      ],
      causalChain: [],
      now,
    });
    const activeDecisions = await seed.workItems.listDeferredDecisions('org1', PROJECT_ID);
    const activeDecision = activeDecisions.find(decision => decision.idempotencyKey === 'legacy-active-skill');
    const multistageProposal = activeDecisions.find(
      decision => decision.idempotencyKey === 'legacy-multistage-proposal',
    );
    if (!activeDecision || !multistageProposal) throw new Error('Expected active legacy decisions');
    await seed.storage.ops.updateMany(
      'factory_deferred_decisions',
      { id: activeDecision.id },
      { status: 'failed', last_error: 'Still unresolved.', completed_at: now, updated_at: now },
    );
    await seed.storage.ops.updateMany(
      'factory_deferred_decisions',
      { id: multistageProposal.id },
      { status: 'proposed', updated_at: now },
    );
    await seed.workItems.update({
      orgId: 'org1',
      id: activeItem.id,
      userId: 'user-1',
      patch: { stages: ['review', 'done'] },
    });

    await seed.workItems.repairLegacyAttentionState();

    const repaired = await seed.workItems.listDeferredDecisions('org1', PROJECT_ID);
    expect(repaired.find(decision => decision.id === transition.id)?.status).toBe('succeeded');
    expect(repaired.find(decision => decision.id === failedSkill.id)?.status).toBe('superseded');
    expect(repaired.find(decision => decision.id === proposal.id)?.status).toBe('superseded');
    expect(repaired.find(decision => decision.id === failedMessage.id)?.status).toBe('superseded');
    expect(repaired.find(decision => decision.id === activeDecision.id)?.status).toBe('failed');
    expect(repaired.find(decision => decision.id === multistageProposal.id)?.status).toBe('proposed');
    await expect(
      seed.workItems.listAttentionReceipts({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u1',
        identities: [
          {
            kind: 'automation-failed',
            sourceId: failedSkill.id,
            occurrence: 0,
          },
        ],
      }),
    ).resolves.toEqual([]);
  });

  it('rejects malformed structured receipt rows', async () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.storage.ops.insertOne('factory_attention_receipts', {
      org_id: 'org1',
      factory_project_id: PROJECT_ID,
      user_id: 'u1',
      kind: 'automation-failed',
      source_id: 'bad-state',
      occurrence: 0,
      state: 'corrupt',
      read_at: now,
      archived_at: null,
      created_at: now,
      updated_at: now,
    });
    await seed.storage.ops.insertOne('factory_attention_receipts', {
      org_id: 'org1',
      factory_project_id: PROJECT_ID,
      user_id: 'u1',
      kind: 'corrupt',
      source_id: 'bad-kind',
      occurrence: 0,
      state: 'read',
      read_at: now,
      archived_at: null,
      created_at: now,
      updated_at: now,
    });

    await expect(
      seed.workItems.listAttentionReceipts({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u1',
        identities: [{ kind: 'automation-failed', sourceId: 'bad-state', occurrence: 0 }],
      }),
    ).rejects.toThrow("Unsupported attention receipt state 'corrupt'.");
    const invalidIdentity = JSON.parse('{"kind":"corrupt","sourceId":"bad-kind","occurrence":0}');
    await expect(
      seed.workItems.listAttentionReceipts({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u1',
        identities: [invalidIdentity],
      }),
    ).rejects.toThrow("Unsupported attention receipt kind 'corrupt'.");
  });
  it('accepts receipts for legacy failed decisions at occurrence zero', async () => {
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: null,
      ingress: { identity: 'legacy-attention-failure', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: null,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: [
        {
          type: 'sendMessage',
          role: 'work',
          message: 'Legacy failure.',
          idempotencyKey: 'legacy-attention-failure',
        },
      ],
      causalChain: [],
      now,
    });
    const [legacy] = await seed.workItems.listDeferredDecisions('org1', PROJECT_ID);
    if (!legacy) throw new Error('Expected a legacy deferred decision');
    await seed.storage.ops.updateMany(
      'factory_deferred_decisions',
      { id: legacy.id, org_id: 'org1', factory_project_id: PROJECT_ID },
      {
        status: 'failed',
        last_error: 'Legacy terminal failure.',
        failure_code: 'unsupported_provider_item',
        completed_at: now,
        updated_at: now,
      },
    );

    await expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject({
      items: [
        {
          key: `factory:${PROJECT_ID}:attention:automation-failed:${legacy.id}:0`,
          occurrence: 0,
          failureCode: 'unsupported_provider_item',
          canRetry: false,
          read: false,
        },
      ],
    });
    expect((await json('POST', `/web/factory/projects/${PROJECT_ID}/decisions/${legacy.id}/retry`)).status).toBe(409);
    expect(
      (await json('POST', `/web/factory/projects/${PROJECT_ID}/attention/automation-failed/${legacy.id}/0junk/read`))
        .status,
    ).toBe(422);
    expect(
      (await json('POST', `/web/factory/projects/${PROJECT_ID}/attention/automation-failed/${legacy.id}/0/read`))
        .status,
    ).toBe(200);
  });

  it('scans past a fully archived raw decision page', async () => {
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody());
    const workItem = (await created.json()).workItem;
    const now = new Date('2030-01-01T00:00:00.000Z');
    await seed.workItems.commitRuleEvaluation({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId: workItem.id,
      ingress: { identity: 'attention-pagination', triggerType: 'test' },
      ruleSetVersion: 'rules-v1',
      expectedRevision: workItem.revision,
      actor: { type: 'system', id: 'rules' },
      outcome: { status: 'accepted' },
      decisions: Array.from({ length: 51 }, (_, index) => ({
        type: 'sendMessage',
        role: 'work',
        message: `Message ${index}`,
        idempotencyKey: `attention-pagination-${index}`,
      })),
      causalChain: [],
      now,
    });
    const claimed = await seed.workItems.claimDeferredDecisions({
      ownerId: 'worker-1',
      now,
      leaseExpiresAt: new Date(now.getTime() + 60_000),
      limit: 51,
    });
    const failed: FactoryDeferredDecisionRecord[] = [];
    for (const decision of claimed) {
      const record = await seed.workItems.failDeferredDecision({
        id: decision.id,
        orgId: decision.orgId,
        factoryProjectId: decision.factoryProjectId,
        ownerId: 'worker-1',
        now,
        availableAt: now,
        lastError: `Terminal failure ${decision.id}.`,
        failureCode: 'unknown',
        terminal: true,
      });
      if (record) failed.push(record);
    }
    const newestFirst = [...failed].sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
    );
    for (const decision of newestFirst.slice(0, 50)) {
      await seed.workItems.setAttentionReceipt({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u1',
        decisionId: decision.id,
        failureOccurrence: decision.failureOccurrence,
        action: 'archive',
        now,
      });
    }
    const target = newestFirst[50];
    if (!target) throw new Error('Expected an unarchived attention item');

    await expect(
      (await json('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=1`)).json(),
    ).resolves.toMatchObject({
      items: [{ decisionId: target.id }],
      openCount: 1,
      unreadCount: 1,
      hasMore: false,
    });
    await expect(
      (
        await json(
          'GET',
          `/web/factory/projects/${PROJECT_ID}/attention?limit=1&search=${encodeURIComponent(target.id)}`,
        )
      ).json(),
    ).resolves.toMatchObject({
      items: [{ decisionId: target.id }],
      hasMore: false,
    });

    const listPage = seed.workItems.listFailedDecisionPage.bind(seed.workItems);
    let scannedPages = 0;
    let lastScanned: FactoryDeferredDecisionRecord | undefined;
    const pageSpy = vi.spyOn(seed.workItems, 'listFailedDecisionPage').mockImplementation(async input => {
      if (input.limit === 1) return listPage(input);
      scannedPages += 1;
      const decisions = Array.from({ length: 50 }, (_, index) => {
        const ordinal = scannedPages * 50 + index;
        const occurredAt = new Date(now.getTime() - ordinal * 1_000);
        return {
          ...target,
          id: `00000000-0000-4000-8000-${String(ordinal).padStart(12, '0')}`,
          workItemId: null,
          lastError: 'Unrelated terminal failure.',
          completedAt: occurredAt,
          updatedAt: occurredAt,
        };
      });
      lastScanned = decisions.at(-1);
      return { decisions, hasMore: true };
    });
    const bounded = await (
      await json('GET', `/web/factory/projects/${PROJECT_ID}/attention?search=never-matches`)
    ).json();
    pageSpy.mockRestore();

    expect(scannedPages).toBe(4);
    expect(bounded).toMatchObject({ items: [], hasMore: true });
    expect(typeof bounded.nextCursor).toBe('string');
    expect(JSON.parse(Buffer.from(bounded.nextCursor, 'base64url').toString('utf8'))).toEqual([
      lastScanned?.completedAt?.toISOString(),
      lastScanned?.id,
    ]);
  });
});

// ── Metrics ──────────────────────────────────────────────────────────────
describe('GET /web/factory/projects/:id/metrics', () => {
  it('401s without a user and 404s for projects outside the org', async () => {
    expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics`, undefined, null)).status).toBe(401);

    await seedProject('other-org');
    expect((await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics`)).status).toBe(404);
  });

  it('resolves the from/to range window, defaulting when absent or malformed', async () => {
    const bodyFor = async (query: string) =>
      (await (await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics${query}`)).json()).metrics;

    // No params → default 30-day window.
    expect((await bodyFor('')).daysCovered).toBe(30);

    // Explicit inclusive 7-calendar-day window.
    const to = new Date().toISOString().slice(0, 10);
    const from = new Date(Date.parse(`${to}T00:00:00.000Z`) - 6 * 86_400_000).toISOString().slice(0, 10);
    expect((await bodyFor(`?from=${from}&to=${to}`)).daysCovered).toBe(7);

    // Malformed params fall back to the default.
    expect((await bodyFor('?from=evil&to=evil')).daysCovered).toBe(30);
  });

  it('aggregates the cards the Factory ran: throughput, WIP, and source mix', async () => {
    // Freeze the clock so the cards and the one-day window below share a date
    // even when the run straddles UTC midnight.
    vi.useFakeTimers({ now: new Date('2026-06-15T12:00:00.000Z'), toFake: ['Date'] });
    // One card completed today (intake → done), one still in intake.
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody({ sessions: run }));
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
      createBody({ externalSource: null, title: 'Manual card', sessions: run }),
    );
    // Synced from the repo, never run: not the Factory's work.
    await json(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/work-items`,
      createBody({ externalSource: { integrationId: 'github', type: 'issue', externalId: '43' }, title: 'Upstream' }),
    );

    // One-day window matching when the cards were filed; multi-day series and
    // board-lifetime clipping are covered by the range test above and the unit tests.
    const today = new Date().toISOString().slice(0, 10);
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics?from=${today}&to=${today}`);
    expect(res.status).toBe(200);
    const { metrics } = await res.json();

    expect(metrics.daysCovered).toBe(1);
    expect(metrics.throughput).toHaveLength(1);
    expect(metrics.throughput.reduce((sum: number, p: any) => sum + p.count, 0)).toBe(1);
    expect(metrics.leadTime.samples).toBe(1);
    // The manual card sits in intake — queued, not in flight — and the synced
    // card is out of the population entirely.
    expect(metrics.wipTotal).toBe(0);
    expect(metrics.sourceMix).toEqual(
      expect.arrayContaining([
        { source: 'github:issue', count: 1 },
        { source: 'manual', count: 1 },
      ]),
    );
    expect(metrics.sourceMix).toHaveLength(2);
  });

  it('returns zeroed metrics for an empty board', async () => {
    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics`);
    const { metrics } = await res.json();
    expect(metrics.throughput).toHaveLength(30);
    expect(metrics.leadTime).toEqual({ medianMs: null, p90Ms: null, samples: 0 });
    expect(metrics.wipTotal).toBe(0);
    expect(metrics.agentCoverage).toEqual([]);
  });

  it('serves per-stage coverage: agent-finished triage vs human-approved planning', async () => {
    // The rules engine queues triage (intake → triage), the bound agent run
    // finishes it (triage → planning), then a human approves planning into done.
    const created = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items`, createBody({ sessions: run }));
    const { workItem } = await created.json();
    const service = new FactoryTransitionService({ rules: builtInFactoryRules(), storage: seed.workItems });
    const move = (stage: 'triage' | 'planning', expectedRevision: number, identity: string, actor: FactoryRuleActor) =>
      service.transition({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        workItemId: workItem.id,
        board: 'work',
        stage,
        expectedRevision,
        actor,
        ingress: { type: 'rule', identity },
        cause: 'auto_triage',
      });
    const triaged = await move('triage', workItem.revision, 'auto-1', {
      type: 'system',
      id: 'factory-rule-dispatcher',
    });
    expect(triaged.status).toBe('accepted');
    const planned = await move('planning', (triaged as { revision: number }).revision, 'auto-2', {
      type: 'agent',
      bindingId: 'binding-1',
      role: 'triage',
    });
    expect(planned.status).toBe('accepted');
    const approved = await json('POST', `/web/factory/projects/${PROJECT_ID}/work-items/${workItem.id}/transition`, {
      board: 'work',
      stage: 'done',
      expectedRevision: (planned as { revision: number }).revision,
      requestId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa7',
      cause: 'board_drag',
    });
    expect(approved.status).toBe(200);

    const res = await json('GET', `/web/factory/projects/${PROJECT_ID}/metrics?days=7`);
    expect(res.status).toBe(200);
    const { metrics } = await res.json();

    expect(metrics.agentCoverage).toEqual([
      // Intake is the inbox — filing a card is not a pass through the pipeline.
      // Exited by the agent run, first visit → the agent's pass, item is done.
      { stage: 'triage', passes: 1, byAgent: 1, outcomes: { done: 1, canceled: 0, reworked: 0, inFlight: 0 } },
      // Agent-entered, human-exited → the human finished this one.
      { stage: 'planning', passes: 1, byAgent: 0, outcomes: { done: 0, canceled: 0, reworked: 0, inFlight: 0 } },
    ]);
  });
});

describe('run activity on the work-item listing', () => {
  async function startRun(sessionId: string) {
    await seed.workItems.prepareRunStart({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: PROJECT_ID,
      workItem: { input: { title: `Work for ${sessionId}`, stages: ['execute'] } },
      role: 'execute',
      session: { sessionId, branch: `factory/${sessionId}`, threadId: `thread-${sessionId}` },
      resourceId: sessionId,
      kickoffKey: `kickoff-${sessionId}`,
      kickoffMessage: null,
    });
  }

  it('reports the listed cards whose session has a run in flight', async () => {
    await startRun('session-running');
    await startRun('session-idle');

    const res = await buildApp(orgUser, undefined, undefined, new Set(['session-running'])).request(
      `/web/factory/projects/${PROJECT_ID}/work-items`,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.workItems).toHaveLength(2);
    expect(body.runningSessionIds).toEqual(['session-running']);
  });

  it('reports no activity for a session that belongs to no card in the project', async () => {
    await startRun('session-idle');

    const res = await buildApp(orgUser, undefined, undefined, new Set(['session-elsewhere'])).request(
      `/web/factory/projects/${PROJECT_ID}/work-items`,
    );

    expect((await res.json()).runningSessionIds).toEqual([]);
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
