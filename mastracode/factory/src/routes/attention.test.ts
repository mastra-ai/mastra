/**
 * Attention over HTTP with every provider live: the per-kind receipt currency,
 * read-all across kinds, the merged cursor, and the kind filter beside the
 * per-kind summary.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { FactoryTransitionService } from '../rules/transition-service.js';
import type { ParkedRun } from '../session/live-sessions.js';
import type { FactoryDeferredDecisionRecord, WorkItemRow } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { FACTORY_ROUTE_CONTRACTS } from './contracts.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import { WorkItemRoutes } from './work-items.js';

const orgUser = { workosId: 'u1', organizationId: 'org1' };

let seed: FactoryStorageTestSeed;
let PROJECT_ID = '';

const parkedBySession = new Map<string, ParkedRun>();

function buildApp(user: typeof orgUser | null = orgUser) {
  const app = new Hono();
  app.use('*', async (c, next) => {
    if (user) c.set('factoryAuthUser' as never, user as never);
    await next();
  });
  mountApiRoutes(
    app as never,
    new WorkItemRoutes({
      auth: fakeRouteAuth(),
      audit: { emit: async () => {} },
      projects: seed.projects,
      workItems: seed.workItems,
      queueHealth: seed.queueHealth,
      transitionService: new FactoryTransitionService({ configVersion: 'factory-config-v1', storage: seed.workItems }),
      liveSessions: {
        isRunning: () => false,
        parked: sessionId => parkedBySession.get(sessionId),
        parkedIn: () => [...parkedBySession].map(([sessionId, run]) => ({ sessionId, run })),
      },
    }).routes(),
  );
  return app;
}

function request(method: string, path: string, user: typeof orgUser | null = orgUser) {
  return buildApp(user).request(path, { method });
}

async function seedWorkItem(title = 'Fix login'): Promise<WorkItemRow> {
  const { item } = await seed.workItems.upsert({
    orgId: 'org1',
    userId: 'u1',
    factoryProjectId: PROJECT_ID,
    input: { title, stages: ['intake'], sessions: {}, metadata: {} },
  });
  return item;
}

async function seedFailure(workItem: WorkItemRow, now: Date): Promise<FactoryDeferredDecisionRecord> {
  await seed.workItems.commitRuleEvaluation({
    orgId: 'org1',
    factoryProjectId: PROJECT_ID,
    workItemId: workItem.id,
    ingress: { identity: `attention-failure-${now.getTime()}`, triggerType: 'test' },
    configVersion: 'rules-v1',
    expectedRevision: (await seed.workItems.get({ orgId: 'org1', id: workItem.id }))?.revision ?? workItem.revision,
    actor: { type: 'system', id: 'rules' },
    outcome: { status: 'accepted' },
    decisions: [
      {
        type: 'sendMessage',
        role: 'work',
        message: 'Notify the session.',
        idempotencyKey: `attention-failure-${now.getTime()}`,
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
}

beforeEach(async () => {
  seed = await createFactoryStorageForTests();
  const project = await seed.projects.create({ orgId: 'org1', userId: 'u1', input: { name: 'org1 project' } });
  PROJECT_ID = project.id;
});

describe('receipts of retired attention kinds', () => {
  it('keeps listing, counting and read-all working when stored receipts name a kind that no longer exists', async () => {
    const item = await seedWorkItem('Fix the loader');
    const failure = await seedFailure(item, new Date('2030-01-01T00:00:00.000Z'));
    // Rows written before a kind was removed stay in the table; nothing deletes them.
    // Sharing the failure's source id leaves the kind as the only thing telling them apart.
    const now = new Date('2030-01-01T00:01:00.000Z');
    await seed.storage.ops.insertOne('factory_attention_receipts', {
      org_id: 'org1',
      factory_project_id: PROJECT_ID,
      user_id: 'u1',
      kind: 'retired-finding',
      source_id: failure.id,
      occurrence: 1,
      state: 'read',
      read_at: now,
      archived_at: null,
      created_at: now,
      updated_at: now,
    });

    const open = await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`);
    expect(open.status).toBe(200);
    const body = await open.json();
    expect(body.items).toMatchObject([{ kind: 'automation-failed', decisionId: failure.id, read: false }]);
    expect(Object.keys(body.kinds)).not.toContain('retired-finding');
    expect(FACTORY_ROUTE_CONTRACTS.attentionList.responseSchema.safeParse(body).success).toBe(true);

    expect((await request('POST', `/web/factory/projects/${PROJECT_ID}/attention/read-all`)).status).toBe(200);
    const unread = await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?view=unread`);
    expect(unread.status).toBe(200);
    await expect(unread.json()).resolves.toMatchObject({
      items: [],
      kinds: { 'automation-failed': { open: 1, unread: 0 } },
    });
  });
});

describe('agent waiting attention items', () => {
  const sessionId = '6f1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7';
  const suspendedAt = new Date('2030-01-01T00:00:00.000Z').getTime();

  beforeEach(() => parkedBySession.clear());

  it('lists a parked session in the badge, opens its thread, and leaves once it is answered', async () => {
    const item = await seedWorkItem('Ship the login fix');
    await seed.workItems.update({
      orgId: 'org1',
      userId: 'u1',
      id: item.id,
      patch: { sessions: { work: { sessionId, branch: 'factory/login', threadId: 'thread-1' } } },
    });
    parkedBySession.set(sessionId, { toolName: 'submit_plan', suspendedAt });

    const open = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json();
    expect(open).toMatchObject({
      items: [
        {
          kind: 'agent-waiting',
          sessionId,
          threadId: 'thread-1',
          role: 'work',
          toolName: 'submit_plan',
          occurrence: suspendedAt,
          workItemId: item.id,
          title: 'Ship the login fix',
          detail: 'Plan waiting for review',
          occurredAt: '2030-01-01T00:00:00.000Z',
          read: false,
          target: { kind: 'thread', sessionId, threadId: 'thread-1' },
        },
      ],
      kinds: { 'agent-waiting': { open: 1, unread: 1, latest: { unread: true } } },
    });

    const receiptPath = `/web/factory/projects/${PROJECT_ID}/attention/agent-waiting/${sessionId}/${suspendedAt}`;
    expect((await request('POST', `${receiptPath}/read`)).status).toBe(200);
    await expect(
      (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?view=unread`)).json(),
    ).resolves.toMatchObject({ items: [], kinds: { 'agent-waiting': { open: 1, unread: 0 } } });

    parkedBySession.delete(sessionId);
    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { items: [], kinds: { 'agent-waiting': { open: 0, unread: 0 } } },
    );
    expect((await request('POST', `${receiptPath}/archive`)).status).toBe(409);
  });

  it('pages two sessions parked in the same millisecond without repeating or losing one', async () => {
    const otherSessionId = '7a1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7';
    for (const [title, id] of [
      ['First card', sessionId],
      ['Second card', otherSessionId],
    ] as const) {
      const item = await seedWorkItem(title);
      await seed.workItems.update({
        orgId: 'org1',
        userId: 'u1',
        id: item.id,
        patch: { sessions: { work: { sessionId: id, branch: `factory/${id}`, threadId: 'thread-1' } } },
      });
      parkedBySession.set(id, { toolName: 'ask_user', suspendedAt });
    }

    const first = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=1`)).json();
    expect(first.items.map((entry: any) => entry.sessionId)).toEqual([sessionId]);
    expect(first.hasMore).toBe(true);
    const second = await (
      await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=1&before=${first.nextCursor}`)
    ).json();
    expect(second.items.map((entry: any) => entry.sessionId)).toEqual([otherSessionId]);
    expect(second.hasMore).toBe(false);
  });

  it('read-all with a cursor leaves the parks newer than the cursor unread', async () => {
    const newerSessionId = '7a1a2b3c-4d5e-4f60-8a71-92b3c4d5e6f7';
    for (const [title, id, at] of [
      ['Older park', sessionId, suspendedAt],
      ['Newer park', newerSessionId, suspendedAt + 1_000],
    ] as const) {
      const item = await seedWorkItem(title);
      await seed.workItems.update({
        orgId: 'org1',
        userId: 'u1',
        id: item.id,
        patch: { sessions: { work: { sessionId: id, branch: `factory/${id}`, threadId: 'thread-1' } } },
      });
      parkedBySession.set(id, { toolName: 'ask_user', suspendedAt: at });
    }

    const first = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=1`)).json();
    expect(first.items.map((entry: any) => entry.sessionId)).toEqual([newerSessionId]);
    const readAll = await request(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/attention/read-all?before=${first.nextCursor}`,
    );
    expect(readAll.status).toBe(200);
    const unread = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?view=unread`)).json();
    expect(unread.items.map((entry: any) => entry.sessionId)).toEqual([newerSessionId]);
  });

  it('409s a receipt for a park that has since been answered and re-parked', async () => {
    const item = await seedWorkItem('Answer me');
    await seed.workItems.update({
      orgId: 'org1',
      userId: 'u1',
      id: item.id,
      patch: { sessions: { work: { sessionId, branch: 'factory/answer', threadId: 'thread-1' } } },
    });
    parkedBySession.set(sessionId, { toolName: 'ask_user', suspendedAt: suspendedAt + 1_000 });

    const stale = `/web/factory/projects/${PROJECT_ID}/attention/agent-waiting/${sessionId}/${suspendedAt}/read`;
    expect((await request('POST', stale)).status).toBe(409);
    const open = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?view=unread`)).json();
    expect(open).toMatchObject({
      items: [{ detail: 'Agent is waiting for an answer' }],
      kinds: { 'agent-waiting': { unread: 1 } },
    });
  });
});

describe('attention across kinds', () => {
  it('reports the newest item of each kind with its own read state', async () => {
    const item = await seedWorkItem();
    await seedProposal(item, new Date('2030-01-01T00:00:05.000Z'));
    const failure = await seedFailure(item, new Date('2030-01-01T00:00:10.000Z'));

    expect(
      (await request('POST', `/web/factory/projects/${PROJECT_ID}/attention/automation-failed/${failure.id}/1/read`))
        .status,
    ).toBe(200);

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      {
        kinds: {
          'automation-proposed': { open: 1, unread: 1, latest: { at: '2030-01-01T00:00:05.000Z', unread: true } },
          'automation-failed': { open: 1, unread: 0, latest: { at: '2030-01-01T00:00:10.000Z', unread: false } },
        },
      },
    );
  });

  it('counts every kind apart', async () => {
    const item = await seedWorkItem();
    await seedFailure(item, new Date('2030-01-01T00:00:10.000Z'));
    await seedProposal(item, new Date('2030-01-01T00:00:05.000Z'));
    await seedProposal(item, new Date('2030-01-01T00:00:15.000Z'));

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      {
        kinds: {
          'automation-failed': { open: 1, unread: 1 },
          'automation-proposed': { open: 2, unread: 2, latest: { at: '2030-01-01T00:00:15.000Z' } },
          'agent-waiting': { open: 0, unread: 0, latest: null },
        },
      },
    );
  });

  it('merges kinds newest-first and resumes both streams through the cursor', async () => {
    const item = await seedWorkItem();
    const failure = await seedFailure(item, new Date('2030-01-01T00:00:10.000Z'));
    const p1 = await seedProposal(item, new Date('2030-01-01T00:00:05.000Z'));
    const p2 = await seedProposal(item, new Date('2030-01-01T00:00:15.000Z'));
    const p3 = await seedProposal(item, new Date('2030-01-01T00:00:20.000Z'));

    const first = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=2`)).json();
    expect(first.items.map((entry: any) => entry.decisionId)).toEqual([p3.id, p2.id]);
    expect(first.hasMore).toBe(true);
    expect(typeof first.nextCursor).toBe('string');

    const second = await (
      await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=2&before=${first.nextCursor}`)
    ).json();
    expect(second.items.map((entry: any) => entry.decisionId)).toEqual([failure.id, p1.id]);
    expect(second.hasMore).toBe(false);
  });

  it('resumes a cursor minted before the inbox merged kinds instead of rejecting it', async () => {
    const item = await seedWorkItem();
    const older = await seedFailure(item, new Date('2030-01-01T00:00:05.000Z'));
    const newer = await seedFailure(item, new Date('2030-01-01T00:00:10.000Z'));
    await seedProposal(item, new Date('2030-01-01T00:00:20.000Z'));

    // The shape #22021 minted: a bare [occurredAt, id] over the only stream there was.
    const legacy = Buffer.from(JSON.stringify(['2030-01-01T00:00:10.000Z', newer.id]), 'utf8').toString('base64url');
    const response = await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?before=${legacy}`);

    expect(response.status).toBe(200);
    const page = await response.json();
    expect(page.items.map((entry: any) => entry.decisionId)).toEqual([older.id]);
  });

  it('read-all marks both kinds read', async () => {
    const item = await seedWorkItem();
    await seedFailure(item, new Date('2030-01-01T00:00:10.000Z'));
    const proposal = await seedProposal(item, new Date('2030-01-01T00:00:20.000Z'));

    const readAll = await request('POST', `/web/factory/projects/${PROJECT_ID}/attention/read-all`);
    expect(readAll.status).toBe(200);
    await expect(readAll.json()).resolves.toEqual({ ok: true, hasMore: false });

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { kinds: { 'automation-failed': { open: 1, unread: 0 }, 'automation-proposed': { open: 1, unread: 0 } } },
    );
    await expect(
      seed.workItems.listAttentionReceipts({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u1',
        identities: [{ kind: 'automation-proposed', sourceId: proposal.id, occurrence: 0 }],
      }),
    ).resolves.toMatchObject([{ kind: 'automation-proposed', state: 'read' }]);
  });

  it('lists only the requested kinds so a preview keeps its page budget', async () => {
    const failure = await seedFailure(await seedWorkItem('Failed item'), new Date('2030-01-01T00:00:00.000Z'));
    await seedProposal(await seedWorkItem('Busy A'), new Date('2030-01-02T00:00:00.000Z'));
    await seedProposal(await seedWorkItem('Busy B'), new Date('2030-01-03T00:00:00.000Z'));

    const merged = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=2`)).json();
    expect(merged.items.map((entry: { kind: string }) => entry.kind)).toEqual([
      'automation-proposed',
      'automation-proposed',
    ]);

    const requested = await (
      await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=2&kind=automation-failed`)
    ).json();
    expect(requested.items).toMatchObject([{ kind: 'automation-failed', decisionId: failure.id }]);
    expect(requested.kinds).toMatchObject({ 'automation-failed': { unread: 1 }, 'automation-proposed': { unread: 2 } });
  });

  it('rejects an invalid cursor', async () => {
    const response = await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?before=not-a-cursor`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_cursor' });
  });

  it('rejects an unknown kind', async () => {
    const response = await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?kind=bogus`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_attention_kind' });
  });
});

const PROPOSED_TRIAGE = { type: 'invokeSkill', role: 'triage', skillName: 'factory-triage' } as const;

async function seedProposal(
  workItem: WorkItemRow,
  now: Date,
  decision: Record<string, unknown> = PROPOSED_TRIAGE,
): Promise<FactoryDeferredDecisionRecord> {
  await seed.workItems.commitRuleEvaluation({
    orgId: 'org1',
    factoryProjectId: PROJECT_ID,
    workItemId: workItem.id,
    ingress: { identity: `attention-proposal-${now.getTime()}`, triggerType: 'test' },
    configVersion: 'rules-v1',
    expectedRevision: (await seed.workItems.get({ orgId: 'org1', id: workItem.id }))?.revision ?? workItem.revision,
    actor: { type: 'system', id: 'rules' },
    outcome: { status: 'accepted' },
    decisions: [{ ...decision, idempotencyKey: `attention-proposal-${now.getTime()}` }],
    causalChain: [],
    now,
  });
  const [claimed] = await seed.workItems.claimDeferredDecisions({
    ownerId: 'worker-1',
    now,
    leaseExpiresAt: new Date(now.getTime() + 60_000),
    limit: 1,
  });
  if (!claimed) throw new Error('Expected a claimable decision');
  const proposed = await seed.workItems.proposeDeferredDecision(
    { id: claimed.id, orgId: claimed.orgId, factoryProjectId: claimed.factoryProjectId, ownerId: 'worker-1' },
    now,
  );
  if (!proposed) throw new Error('Expected a proposed decision');
  return proposed;
}

describe('proposed attention items', () => {
  it('lists a parked run and leaves the inbox once it is approved', async () => {
    const item = await seedWorkItem('Fix the login flow');
    const proposal = await seedProposal(item, new Date('2030-01-01T00:00:00.000Z'));

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      {
        items: [
          {
            kind: 'automation-proposed',
            decisionId: proposal.id,
            occurrence: 0,
            workItemId: item.id,
            title: 'Fix the login flow',
            detail: 'Waiting for approval to run triage',
            decisionType: 'invokeSkill',
            read: false,
            archived: false,
          },
        ],
        kinds: { 'automation-proposed': { open: 1, unread: 1 } },
      },
    );

    const receiptPath = `/web/factory/projects/${PROJECT_ID}/attention/automation-proposed/${proposal.id}/0`;
    expect((await request('POST', `${receiptPath}/read`)).status).toBe(200);
    expect((await request('POST', `/web/factory/projects/${PROJECT_ID}/decisions/${proposal.id}/approve`)).status).toBe(
      200,
    );

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { items: [], kinds: { 'automation-proposed': { open: 0, unread: 0 } } },
    );
    await expect(
      seed.workItems.listAttentionReceipts({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u1',
        identities: [{ kind: 'automation-proposed', sourceId: proposal.id, occurrence: 0 }],
      }),
    ).resolves.toEqual([]);
  });

  it('says where a parked move goes instead of which role it runs', async () => {
    const item = await seedWorkItem('Fix the login flow');
    await seedProposal(item, new Date('2030-01-01T00:00:00.000Z'), {
      type: 'transition',
      board: 'work',
      stage: 'planning',
    });

    const page = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?search=planning`)).json();
    expect(page.items).toMatchObject([
      { kind: 'automation-proposed', detail: 'Waiting for approval to move to planning', decisionType: 'transition' },
    ]);
  });

  it('counts each kind exactly as it lists it', async () => {
    const item = await seedWorkItem();
    await seedProposal(item, new Date('2030-01-01T00:00:00.000Z'));
    await seedFailure(item, new Date('2030-01-01T00:01:00.000Z'));

    const page = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json();
    expect(page.items).toHaveLength(2);
    expect(page.kinds).toMatchObject({
      'automation-proposed': { open: 1, unread: 1 },
      'automation-failed': { open: 1, unread: 1 },
    });
  });

  it('read-all reads the proposal and leaves the run parked', async () => {
    const item = await seedWorkItem();
    await seedProposal(item, new Date('2030-01-01T00:00:00.000Z'));

    expect((await request('POST', `/web/factory/projects/${PROJECT_ID}/attention/read-all`)).status).toBe(200);

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      {
        items: [{ kind: 'automation-proposed', read: true }],
        kinds: { 'automation-proposed': { open: 1, unread: 0 } },
      },
    );
  });
});

describe('attention links open the board the card is on', () => {
  async function seedCard(input: Pick<WorkItemRow, 'board' | 'externalSource'>): Promise<WorkItemRow> {
    const { item } = await seed.workItems.upsert({
      orgId: 'org1',
      userId: 'u1',
      factoryProjectId: PROJECT_ID,
      input: {
        title: 'Ship it',
        stages: ['intake'],
        sessions: {},
        metadata: {},
        ...(input.board ? { board: input.board } : {}),
        externalSource: input.externalSource,
      },
    });
    return item;
  }

  /** One item of every work-item-targeted kind on `item`, keyed by kind to the board its link opens. */
  async function targetBoards(item: WorkItemRow): Promise<Record<string, unknown>> {
    await seedProposal(item, new Date('2030-01-01T00:00:00.000Z'));
    await seedFailure(item, new Date('2030-01-01T00:01:00.000Z'));

    const page = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json();
    return Object.fromEntries(
      (page.items as { kind: string; target: { kind: string; board?: string } }[]).map(entry => {
        expect(entry.target.kind).toBe('work-item');
        return [entry.kind, entry.target.board];
      }),
    );
  }

  const everyKind = (board: string) => ({
    'automation-proposed': board,
    'automation-failed': board,
  });

  it('links to a custom board the card was placed on', async () => {
    const item = await seedCard({ board: 'release', externalSource: null });
    expect(await targetBoards(item)).toEqual(everyKind('release'));
  });

  it('links a pull request on the Review board to Review', async () => {
    const item = await seedCard({
      board: 'review',
      externalSource: { integrationId: 'github', type: 'pull-request', externalId: 'github-pr:12' },
    });
    expect(await targetBoards(item)).toEqual(everyKind('review'));
  });

  it('links a GitLab merge request with no stored board to Review', async () => {
    const item = await seedCard({
      board: null,
      externalSource: { integrationId: 'gitlab', type: 'pull-request', externalId: 'gitlab-mr:17' },
    });
    expect(await targetBoards(item)).toEqual(everyKind('review'));
  });

  it('links a plain card with no stored board to Work', async () => {
    const item = await seedCard({ board: null, externalSource: null });
    expect(item.board).toBeNull();
    expect(await targetBoards(item)).toEqual(everyKind('work'));
  });
});
