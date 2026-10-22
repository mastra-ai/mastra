import { randomUUID } from 'node:crypto';

import { UniqueViolationError } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { PgFactoryStorage } from '@mastra/pg';
import { describe, expect, it, onTestFinished } from 'vitest';

import { WorkItemsStorage } from './base.js';
import { WORK_ITEM_SOURCES_SCHEMA } from './sources.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const engines = ['libsql', ...(postgresUrl ? ['postgres'] : [])];

async function setup(engine: string) {
  const storage =
    engine === 'postgres'
      ? new PgFactoryStorage({ id: 'sources-test', connectionString: postgresUrl! })
      : new LibSQLFactoryStorage({ id: 'sources-test', url: ':memory:' });
  const workItems = storage.registerDomain(new WorkItemsStorage());
  await storage.init();
  onTestFinished(() => storage.close());
  const scope = { orgId: `org-${randomUUID()}`, factoryProjectId: randomUUID() };
  const card = async (title: string) =>
    (
      await workItems.upsert({
        ...scope,
        userId: 'user-1',
        input: { title, board: 'work', stages: ['intake'] },
      })
    ).item;
  return { storage, workItems, scope, card };
}

const issueKey = 'github:repo-1:issue:12';
const prKey = 'github:repo-1:pull-request:40';

describe.each(engines)('work item sources (%s)', engine => {
  it('links a card to its issue and its pull requests, and finds the card by either', async () => {
    const { workItems, scope, card } = await setup(engine);
    const item = await card('Fix login');

    await workItems.linkSource({
      ...scope,
      workItemId: item.id,
      sourceKey: issueKey,
      kind: 'issue',
      integration: 'github',
      external: { repositoryId: 'repo-1', number: 12 },
    });
    await workItems.linkSource({
      ...scope,
      workItemId: item.id,
      sourceKey: prKey,
      kind: 'pull_request',
      integration: 'github',
      external: { repositoryId: 'repo-1', number: 40 },
      headSha: 'abc',
      factoryAuthored: true,
    });

    const links = await workItems.listSources({ ...scope, workItemId: item.id });
    expect(links.map(link => [link.kind, link.sourceKey, link.state, link.factoryAuthored])).toEqual([
      ['issue', issueKey, 'open', false],
      ['pull_request', prKey, 'open', true],
    ]);
    expect(links[1]).toMatchObject({ headSha: 'abc', external: { repositoryId: 'repo-1', number: 40 } });
    expect((await workItems.findBySourceKey({ ...scope, sourceKey: prKey }))?.workItemId).toBe(item.id);
    expect(await workItems.findBySourceKey({ ...scope, sourceKey: 'github:repo-1:issue:99' })).toBeNull();
    // Another project never sees the link.
    expect(
      await workItems.findBySourceKey({ orgId: scope.orgId, factoryProjectId: randomUUID(), sourceKey: prKey }),
    ).toBeNull();
  });

  it('keeps one card per record: a second card does not take the link unless it reassigns', async () => {
    const { workItems, storage, scope, card } = await setup(engine);
    const prCard = await card('PR #40');
    const issueCard = await card('Fix login');
    const link = { ...scope, sourceKey: prKey, kind: 'pull_request' as const, integration: 'github' };

    await workItems.linkSource({ ...link, workItemId: prCard.id });
    const kept = await workItems.linkSource({ ...link, workItemId: issueCard.id });
    expect(kept.workItemId).toBe(prCard.id);

    const moved = await workItems.linkSource({
      ...link,
      workItemId: issueCard.id,
      reassign: true,
      factoryAuthored: true,
    });
    expect(moved).toMatchObject({ workItemId: issueCard.id, factoryAuthored: true });
    expect(await workItems.listSources({ ...scope, workItemId: prCard.id })).toEqual([]);

    // The unique index is what holds this, not just the read-before-write.
    const now = new Date();
    await expect(
      storage.ops.insertOne(WORK_ITEM_SOURCES_SCHEMA.name, {
        org_id: scope.orgId,
        factory_project_id: scope.factoryProjectId,
        work_item_id: prCard.id,
        source_key: prKey,
        kind: 'pull_request',
        integration: 'github',
        external: {},
        state: 'open',
        factory_authored: false,
        created_at: now,
        updated_at: now,
      }),
    ).rejects.toBeInstanceOf(UniqueViolationError);
  });

  it('settles concurrent first links on one card', async () => {
    const { workItems, scope, card } = await setup(engine);
    const [a, b] = await Promise.all([card('A'), card('B')]);
    const link = { ...scope, sourceKey: prKey, kind: 'pull_request' as const, integration: 'github' };

    const [first, second] = await Promise.all([
      workItems.linkSource({ ...link, workItemId: a.id }),
      workItems.linkSource({ ...link, workItemId: b.id }),
    ]);
    expect(first.workItemId).toBe(second.workItemId);
    const holder = await workItems.findBySourceKey({ ...scope, sourceKey: prKey });
    expect(holder?.workItemId).toBe(first.workItemId);
  });

  it('records review state and pull request state on that link only', async () => {
    const { workItems, scope, card } = await setup(engine);
    const item = await card('Fix login');
    const otherPr = 'github:repo-1:pull-request:41';
    for (const sourceKey of [prKey, otherPr]) {
      await workItems.linkSource({
        ...scope,
        workItemId: item.id,
        sourceKey,
        kind: 'pull_request',
        integration: 'github',
      });
    }

    const reviewedAt = new Date('2026-10-22T12:00:00.000Z');
    await workItems.recordSourceReview({
      ...scope,
      sourceKey: prKey,
      verdict: 'approve',
      reviewedHeadSha: 'abc',
      reviewedAt,
    });
    await workItems.updateSourceState({ ...scope, sourceKey: prKey, state: 'merged', headSha: 'abc' });

    const [reviewed, untouched] = await workItems.listSources({ ...scope, workItemId: item.id });
    expect(reviewed).toMatchObject({
      sourceKey: prKey,
      state: 'merged',
      headSha: 'abc',
      reviewVerdict: 'approve',
      reviewedHeadSha: 'abc',
      reviewedAt,
    });
    expect(untouched).toMatchObject({ sourceKey: otherPr, state: 'open', reviewVerdict: null, reviewedHeadSha: null });
  });

  it('deletes a card with its links', async () => {
    const { workItems, scope, card } = await setup(engine);
    const item = await card('Fix login');
    await workItems.linkSource({
      ...scope,
      workItemId: item.id,
      sourceKey: issueKey,
      kind: 'issue',
      integration: 'github',
    });

    await workItems.delete({ orgId: scope.orgId, id: item.id });

    expect(await workItems.findBySourceKey({ ...scope, sourceKey: issueKey })).toBeNull();
  });
});
