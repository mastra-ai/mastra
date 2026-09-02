/**
 * Attention over HTTP with every provider live: mention items and counts, the
 * per-kind receipt currency, read-all across kinds, the merged cursor, and the
 * activity tier that sits below the badge.
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { builtInFactoryRules } from '../rules/defaults.js';
import { FactoryTransitionService } from '../rules/transition-service.js';
import type { FactoryDeferredDecisionRecord, WorkItemRow } from '../storage/domains/work-items/base.js';
import { createFactoryStorageForTests } from '../storage/test-utils.js';
import type { FactoryStorageTestSeed } from '../storage/test-utils.js';
import { fakeRouteAuth, mountApiRoutes } from './test-utils.js';
import { WorkItemRoutes } from './work-items.js';

const orgUser = { workosId: 'u1', organizationId: 'org1' };

let seed: FactoryStorageTestSeed;
let PROJECT_ID = '';

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
      comments: seed.comments,
      queueHealth: seed.queueHealth,
      transitionService: new FactoryTransitionService({ rules: builtInFactoryRules(), storage: seed.workItems }),
      liveSessions: { isRunning: () => false },
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

async function seedMention({
  workItemId,
  body,
  occurredAt,
  mentionedId = 'u1',
  authorId = 'user-author',
}: {
  workItemId: string;
  body: string;
  occurredAt: Date;
  mentionedId?: string;
  authorId?: string;
}) {
  return seed.comments.create({
    orgId: 'org1',
    factoryProjectId: PROJECT_ID,
    workItemId,
    author: { kind: 'user', id: authorId, displayName: 'Author' },
    body,
    occurredAt,
    mentions: [{ kind: 'user', id: mentionedId }],
  });
}

async function seedFailure(workItem: WorkItemRow, now: Date): Promise<FactoryDeferredDecisionRecord> {
  await seed.workItems.commitRuleEvaluation({
    orgId: 'org1',
    factoryProjectId: PROJECT_ID,
    workItemId: workItem.id,
    ingress: { identity: `attention-failure-${now.getTime()}`, triggerType: 'test' },
    ruleSetVersion: 'rules-v1',
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

describe('mention attention items', () => {
  it('lists a mention in every view with per-kind read and archive receipts', async () => {
    const item = await seedWorkItem();
    const comment = await seedMention({
      workItemId: item.id,
      body: 'Hey @you, look at this',
      occurredAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    const open = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json();
    expect(open).toMatchObject({
      items: [
        {
          kind: 'mention',
          commentId: comment.id,
          workItemId: item.id,
          title: 'Fix login',
          detail: 'Hey @you, look at this',
          authorName: 'Author',
          read: false,
          target: { kind: 'work-item', workItemId: item.id, commentId: comment.id },
        },
      ],
      openCount: 1,
      unreadCount: 1,
      badgeCount: 1,
      latestOccurrenceUnread: true,
    });

    const receiptPath = `/web/factory/projects/${PROJECT_ID}/attention/mention/${comment.id}/0`;
    expect((await request('POST', `${receiptPath}/read`)).status).toBe(200);
    await expect(
      (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?view=unread`)).json(),
    ).resolves.toMatchObject({ items: [], unreadCount: 0, openCount: 1 });

    expect((await request('POST', `${receiptPath}/archive`)).status).toBe(200);
    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { items: [], openCount: 0 },
    );
    await expect(
      (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?view=archived`)).json(),
    ).resolves.toMatchObject({ items: [{ kind: 'mention', commentId: comment.id, archived: true }] });

    expect((await request('POST', `${receiptPath}/restore`)).status).toBe(200);
    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { items: [{ kind: 'mention', read: true, archived: false }], openCount: 1 },
    );
  });

  it('never surfaces self-mentions', async () => {
    const item = await seedWorkItem();
    await seedMention({
      workItemId: item.id,
      body: 'note to self',
      occurredAt: new Date('2030-01-01T00:00:00.000Z'),
      mentionedId: 'u1',
      authorId: 'u1',
    });

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { items: [], openCount: 0, unreadCount: 0 },
    );
  });

  it('rejects receipts for deleted comments with 409', async () => {
    const item = await seedWorkItem();
    const comment = await seedMention({
      workItemId: item.id,
      body: 'soon gone',
      occurredAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    await seed.comments.softDelete({ orgId: 'org1', commentId: comment.id, deletedBy: 'user-author' });

    const stale = await request('POST', `/web/factory/projects/${PROJECT_ID}/attention/mention/${comment.id}/0/read`);
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toEqual({ error: 'attention_item_not_current' });
  });

  it('409s a mention receipt when the caller was never mentioned or the occurrence is off', async () => {
    const item = await seedWorkItem();
    const comment = await seedMention({
      workItemId: item.id,
      body: 'for someone else',
      occurredAt: new Date('2030-01-01T00:00:00.000Z'),
      mentionedId: 'user-other',
    });

    const notMentioned = await request(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/attention/mention/${comment.id}/0/read`,
    );
    expect(notMentioned.status).toBe(409);
    await expect(notMentioned.json()).resolves.toEqual({ error: 'attention_item_not_current' });

    const mine = await seedMention({
      workItemId: item.id,
      body: 'for me',
      occurredAt: new Date('2030-01-01T00:00:01.000Z'),
    });
    const wrongOccurrence = await request(
      'POST',
      `/web/factory/projects/${PROJECT_ID}/attention/mention/${mine.id}/1/read`,
    );
    expect(wrongOccurrence.status).toBe(409);
  });

  it('ignores garbage mention receipts in the counts', async () => {
    const item = await seedWorkItem();
    await seedMention({ workItemId: item.id, body: 'real', occurredAt: new Date('2030-01-01T00:00:00.000Z') });
    const now = new Date('2030-01-01T00:00:05.000Z');
    for (const [sourceId, state, archivedAt] of [
      ['11111111-1111-4111-8111-111111111111', 'read', null],
      ['22222222-2222-4222-8222-222222222222', 'archived', now],
    ] as const) {
      await seed.storage.ops.insertOne('factory_attention_receipts', {
        org_id: 'org1',
        factory_project_id: PROJECT_ID,
        user_id: 'u1',
        kind: 'mention',
        source_id: sourceId,
        occurrence: 0,
        state,
        read_at: now,
        archived_at: archivedAt,
        created_at: now,
        updated_at: now,
      });
    }

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { items: [{ kind: 'mention', detail: 'real' }], openCount: 1, unreadCount: 1, badgeCount: 1 },
    );
  });

  it('keeps the latest pointer on an unread item even when a read one is newer', async () => {
    const item = await seedWorkItem();
    await seedMention({ workItemId: item.id, body: 'older unread', occurredAt: new Date('2030-01-01T00:00:05.000Z') });
    const failure = await seedFailure(item, new Date('2030-01-01T00:00:10.000Z'));

    expect(
      (await request('POST', `/web/factory/projects/${PROJECT_ID}/attention/automation-failed/${failure.id}/1/read`))
        .status,
    ).toBe(200);

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      {
        latestOccurrenceAt: '2030-01-01T00:00:05.000Z',
        latestOccurrenceUnread: true,
        unreadCount: 1,
        openCount: 2,
      },
    );
  });

  it('sums counts across kinds for badge math', async () => {
    const item = await seedWorkItem();
    await seedFailure(item, new Date('2030-01-01T00:00:10.000Z'));
    await seedMention({ workItemId: item.id, body: 'one', occurredAt: new Date('2030-01-01T00:00:05.000Z') });
    await seedMention({ workItemId: item.id, body: 'two', occurredAt: new Date('2030-01-01T00:00:15.000Z') });

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      {
        openCount: 3,
        unreadCount: 3,
        badgeCount: 3,
        latestOccurrenceAt: '2030-01-01T00:00:15.000Z',
      },
    );
  });

  it('merges kinds newest-first and resumes both streams through the cursor', async () => {
    const item = await seedWorkItem();
    const failure = await seedFailure(item, new Date('2030-01-01T00:00:10.000Z'));
    const m1 = await seedMention({
      workItemId: item.id,
      body: 'oldest',
      occurredAt: new Date('2030-01-01T00:00:05.000Z'),
    });
    const m2 = await seedMention({
      workItemId: item.id,
      body: 'middle',
      occurredAt: new Date('2030-01-01T00:00:15.000Z'),
    });
    const m3 = await seedMention({
      workItemId: item.id,
      body: 'newest',
      occurredAt: new Date('2030-01-01T00:00:20.000Z'),
    });

    const first = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=2`)).json();
    expect(first.items.map((entry: any) => entry.commentId ?? entry.decisionId)).toEqual([m3.id, m2.id]);
    expect(first.hasMore).toBe(true);
    expect(typeof first.nextCursor).toBe('string');

    const second = await (
      await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=2&before=${first.nextCursor}`)
    ).json();
    expect(second.items.map((entry: any) => entry.commentId ?? entry.decisionId)).toEqual([failure.id, m1.id]);
    expect(second.hasMore).toBe(false);
  });

  it('resumes a cursor minted before the inbox merged kinds instead of rejecting it', async () => {
    const item = await seedWorkItem();
    const older = await seedFailure(item, new Date('2030-01-01T00:00:05.000Z'));
    const newer = await seedFailure(item, new Date('2030-01-01T00:00:10.000Z'));
    await seedMention({ workItemId: item.id, body: 'ping', occurredAt: new Date('2030-01-01T00:00:20.000Z') });

    // The shape #22021 minted: a bare [occurredAt, id] over the only stream there was.
    const legacy = Buffer.from(JSON.stringify(['2030-01-01T00:00:10.000Z', newer.id]), 'utf8').toString('base64url');
    const response = await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?before=${legacy}`);

    expect(response.status).toBe(200);
    const page = await response.json();
    expect(page.items.map((entry: any) => entry.decisionId ?? entry.commentId)).toEqual([older.id]);
  });

  it('read-all marks both kinds read', async () => {
    const item = await seedWorkItem();
    await seedFailure(item, new Date('2030-01-01T00:00:10.000Z'));
    const comment = await seedMention({
      workItemId: item.id,
      body: 'ping',
      occurredAt: new Date('2030-01-01T00:00:20.000Z'),
    });

    const readAll = await request('POST', `/web/factory/projects/${PROJECT_ID}/attention/read-all`);
    expect(readAll.status).toBe(200);
    await expect(readAll.json()).resolves.toEqual({ ok: true, hasMore: false });

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { unreadCount: 0, openCount: 2 },
    );
    await expect(
      seed.workItems.listAttentionReceipts({
        orgId: 'org1',
        factoryProjectId: PROJECT_ID,
        userId: 'u1',
        identities: [{ kind: 'mention', sourceId: comment.id, occurrence: 0 }],
      }),
    ).resolves.toMatchObject([{ kind: 'mention', state: 'read' }]);
  });
});

describe('activity attention items', () => {
  /** `u1` created the item, so any comment by someone else fans out to them. */
  async function seedActivity(workItemId: string, body: string, occurredAt: Date) {
    return seed.comments.create({
      orgId: 'org1',
      factoryProjectId: PROJECT_ID,
      workItemId,
      author: { kind: 'user', id: 'user-author', displayName: 'Author' },
      body,
      occurredAt,
    });
  }

  it('lists a comment on a followed item without ever reaching the badge', async () => {
    const item = await seedWorkItem();
    const comment = await seedActivity(item.id, 'moved this to review', new Date('2030-01-01T00:00:00.000Z'));

    const page = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json();
    expect(page).toMatchObject({
      items: [
        {
          kind: 'activity',
          workItemId: item.id,
          commentId: comment.id,
          occurrence: 1,
          title: 'Fix login',
          detail: 'moved this to review',
          authorName: 'Author',
          read: false,
          target: { kind: 'work-item', workItemId: item.id, commentId: comment.id },
        },
      ],
      openCount: 0,
      unreadCount: 0,
      badgeCount: 0,
      activityUnreadCount: 1,
    });
    // The sound is the badge tier's alone.
    expect(page.latestOccurrenceKey).toBeNull();
    expect(page.latestOccurrenceUnread).toBe(false);
  });

  it('re-unreads on the next comment and 409s the receipt the bump left behind', async () => {
    const item = await seedWorkItem();
    await seedActivity(item.id, 'first', new Date('2030-01-01T00:00:00.000Z'));

    const receiptPath = `/web/factory/projects/${PROJECT_ID}/attention/activity/${item.id}`;
    expect((await request('POST', `${receiptPath}/1/read`)).status).toBe(200);
    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { items: [{ kind: 'activity', read: true }], activityUnreadCount: 0 },
    );

    await seedActivity(item.id, 'second', new Date('2030-01-01T00:00:10.000Z'));
    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { items: [{ kind: 'activity', occurrence: 2, detail: 'second', read: false }], activityUnreadCount: 1 },
    );

    const stale = await request('POST', `${receiptPath}/1/read`);
    expect(stale.status).toBe(409);
    await expect(stale.json()).resolves.toEqual({ error: 'attention_item_not_current' });
  });

  it('resurfaces an archived item when the discussion moves again', async () => {
    const item = await seedWorkItem();
    await seedActivity(item.id, 'first', new Date('2030-01-01T00:00:00.000Z'));
    const receiptPath = `/web/factory/projects/${PROJECT_ID}/attention/activity/${item.id}`;
    expect((await request('POST', `${receiptPath}/1/archive`)).status).toBe(200);
    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { items: [] },
    );

    await seedActivity(item.id, 'second', new Date('2030-01-01T00:00:10.000Z'));

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { items: [{ kind: 'activity', occurrence: 2, archived: false }] },
    );
  });

  it('merges into the newest-first stream and round-trips its cursor', async () => {
    const item = await seedWorkItem();
    await seedActivity(item.id, 'activity', new Date('2030-01-01T00:00:05.000Z'));
    const mention = await seedMention({
      workItemId: item.id,
      body: 'mention',
      occurredAt: new Date('2030-01-01T00:00:20.000Z'),
    });

    const first = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=1`)).json();
    expect(first.items).toMatchObject([{ kind: 'mention', commentId: mention.id }]);
    expect(first.hasMore).toBe(true);

    const second = await (
      await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=1&before=${first.nextCursor}`)
    ).json();
    expect(second.items).toMatchObject([{ kind: 'activity', workItemId: item.id, occurrence: 1 }]);
  });

  it('read-all clears the activity tier too', async () => {
    const item = await seedWorkItem();
    await seedActivity(item.id, 'ping', new Date('2030-01-01T00:00:00.000Z'));

    expect((await request('POST', `/web/factory/projects/${PROJECT_ID}/attention/read-all`)).status).toBe(200);

    await expect((await request('GET', `/web/factory/projects/${PROJECT_ID}/attention`)).json()).resolves.toMatchObject(
      { activityUnreadCount: 0, items: [{ kind: 'activity', read: true }] },
    );
  });
  it('keeps the badge tier in the page budget when activity is newer', async () => {
    const mentionItem = await seedWorkItem('Mentioned item');
    const mention = await seedMention({
      workItemId: mentionItem.id,
      body: 'Hey @you',
      occurredAt: new Date('2030-01-01T00:00:00.000Z'),
    });
    const busyA = await seedWorkItem('Busy A');
    const busyB = await seedWorkItem('Busy B');
    await seedActivity(busyA.id, 'newer chatter', new Date('2030-01-02T00:00:00.000Z'));
    await seedActivity(busyB.id, 'even newer chatter', new Date('2030-01-03T00:00:00.000Z'));

    const merged = await (await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=2`)).json();
    expect(merged.items.map((entry: { kind: string }) => entry.kind)).toEqual(['activity', 'activity']);

    const badge = await (
      await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?limit=2&tier=badge`)
    ).json();
    expect(badge.items).toMatchObject([{ kind: 'mention', commentId: mention.id }]);
    expect(badge.badgeCount).toBe(1);
    expect(badge.activityUnreadCount).toBe(2);
  });

  it('rejects an unknown tier', async () => {
    const response = await request('GET', `/web/factory/projects/${PROJECT_ID}/attention?tier=bogus`);
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'invalid_attention_tier' });
  });
});
