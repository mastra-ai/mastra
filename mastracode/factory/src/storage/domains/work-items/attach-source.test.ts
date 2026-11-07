import { randomUUID } from 'node:crypto';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished } from 'vitest';

import { createFactoryStorageForTests, createIsolatedFactoryPostgresForTests } from '../../test-utils.js';
import { WorkItemSourceConflictError } from './base.js';
import type { ExternalWorkItemSource } from './base.js';
import { FACTORY_BOARD_ITEMS_SCHEMA, FACTORY_WORK_ITEM_SOURCES_SCHEMA } from './work-item-schema.js';
import type { WorkItemSourceDbRecord } from './work-item-schema.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;

const issue12: ExternalWorkItemSource = {
  integrationId: 'github',
  type: 'issue',
  externalId: 'github:10:issue:12',
  url: 'https://github.com/acme/app/issues/12',
};
const pullRequest34: ExternalWorkItemSource = {
  integrationId: 'github',
  type: 'pull-request',
  externalId: 'github:10:pull-request:34',
  url: 'https://github.com/acme/app/pull/34',
};

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('one card for an issue and its PRs on %s', backend => {
  async function setup() {
    const storage =
      backend === 'postgres'
        ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
        : new LibSQLFactoryStorage({ id: 'attach-source-test', url: ':memory:' });
    if (backend === 'libsql') onTestFinished(() => storage.close());
    const { workItems } = await createFactoryStorageForTests(storage);
    const scope = { orgId: randomUUID(), factoryProjectId: 'project', userId: 'user' };
    const file = async (externalSource: ExternalWorkItemSource, metadata: Record<string, unknown>, board = 'work') =>
      (
        await workItems.upsert({
          ...scope,
          input: { title: externalSource.externalId, board, stages: ['intake'], externalSource, metadata },
        })
      ).item;
    return { storage, workItems, scope, file };
  }

  it("files a pull request on its issue's card and keeps the issue as the card's primary source", async () => {
    const { workItems, scope, file } = await setup();
    const card = await file(issue12, { state: 'open', number: 12, author: 'reporter' });

    const attached = await workItems.attachSource({
      orgId: scope.orgId,
      id: card.id,
      source: pullRequest34,
      metadata: { state: 'open', number: 34, author: 'maintainer', githubPullRequestNumber: 34 },
    });

    expect(attached).toMatchObject({ attached: true });
    expect(attached!.item.revision).toBeGreaterThan(card.revision);
    const stored = (await workItems.get({ orgId: scope.orgId, id: card.id }))!;
    expect(stored.workItem.sources.map(source => source.sourceType)).toEqual(['issue', 'pull-request']);
    expect(stored.externalSource).toMatchObject({ type: 'issue' });
    expect(stored.workItem).toMatchObject({ state: 'open', author: 'reporter' });
    expect(stored.workItem.sources[1]).toMatchObject({ state: 'open', author: 'maintainer' });

    const all = await workItems.list({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId });
    expect(all).toHaveLength(1);
    for (const source of [issue12, pullRequest34]) {
      const found = await workItems.getByProjectSource({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        source,
      });
      expect(found?.id).toBe(card.id);
    }
  });

  it('treats attaching the same pull request again as already filed', async () => {
    const { workItems, scope, file } = await setup();
    const card = await file(issue12, { state: 'open' });
    await workItems.attachSource({
      orgId: scope.orgId,
      id: card.id,
      source: pullRequest34,
      metadata: { state: 'open' },
    });

    const again = await workItems.attachSource({
      orgId: scope.orgId,
      id: card.id,
      source: pullRequest34,
      metadata: { state: 'open' },
    });

    expect(again).toMatchObject({ attached: false });
    const stored = (await workItems.get({ orgId: scope.orgId, id: card.id }))!;
    expect(stored.workItem.sources).toHaveLength(2);
  });

  it('refuses a pull request another card already holds, and changes neither card', async () => {
    const { workItems, scope, file } = await setup();
    const issueCard = await file(issue12, { state: 'open' });
    const pullRequestCard = await file(pullRequest34, { state: 'open' });

    await expect(
      workItems.attachSource({ orgId: scope.orgId, id: issueCard.id, source: pullRequest34, metadata: {} }),
    ).rejects.toBeInstanceOf(WorkItemSourceConflictError);

    const [issueAfter, pullRequestAfter] = await Promise.all([
      workItems.get({ orgId: scope.orgId, id: issueCard.id }),
      workItems.get({ orgId: scope.orgId, id: pullRequestCard.id }),
    ]);
    expect(issueAfter!.revision).toBe(issueCard.revision);
    expect(issueAfter!.workItem.sources).toHaveLength(1);
    expect(pullRequestAfter!.workItem.sources.map(source => source.sourceType)).toEqual(['pull-request']);
  });

  it('treats losing a race to attach the same pull request as already filed, while another project holds it too', async () => {
    const { workItems, scope, file } = await setup();
    // The same repository can feed two projects in one org, so each carries its own copy of the record.
    await workItems.upsert({
      ...scope,
      factoryProjectId: 'other-project',
      input: { title: 'other', board: 'work', stages: ['intake'], externalSource: pullRequest34, metadata: {} },
    });
    const cards = await Promise.all(
      Array.from({ length: 5 }, (_, n) =>
        file({ ...issue12, externalId: `github:10:issue:${n + 1}` }, { state: 'open' }),
      ),
    );

    const results = await Promise.all(
      cards.flatMap(card =>
        [0, 1].map(() =>
          workItems.attachSource({ orgId: scope.orgId, id: card.id, source: pullRequest34, metadata: {} }).then(
            result => ({ card: card.id, attached: result?.attached }),
            (error: unknown) => ({ card: card.id, error }),
          ),
        ),
      ),
    );

    // Only one card in this project can take the pull request; every other attempt is refused.
    const winner = results.find(result => 'attached' in result && result.attached)!;
    expect(winner).toBeDefined();
    for (const result of results.filter(result => result.card === winner.card && result !== winner)) {
      expect(result).toEqual({ card: winner.card, attached: false });
    }
    const winnerWorkItem = cards.find(card => card.id === winner.card)!.workItemId;
    for (const result of results.filter(result => result.card !== winner.card)) {
      expect('error' in result && result.error).toBeInstanceOf(WorkItemSourceConflictError);
      expect((result as { error: WorkItemSourceConflictError }).error.ownerWorkItemId).toBe(winnerWorkItem);
    }
  });

  it("writes a pull request's state to its own source, never to the issue's", async () => {
    const { workItems, scope, file } = await setup();
    const card = await file(issue12, { state: 'open' });
    const attached = await workItems.attachSource({
      orgId: scope.orgId,
      id: card.id,
      source: pullRequest34,
      metadata: { state: 'open', merged: false },
    });
    const pullRequestSource = attached!.item.workItem.sources[1]!;

    await workItems.syncWorkItemSource({
      orgId: scope.orgId,
      factoryProjectId: scope.factoryProjectId,
      provider: pullRequestSource.provider,
      externalId: pullRequestSource.externalId,
      patch: { state: 'merged', metadata: { state: 'closed', merged: true } },
    });

    const stored = (await workItems.get({ orgId: scope.orgId, id: card.id }))!;
    expect(stored.workItem.state).toBe('open');
    expect(stored.workItem.sources[0]).toMatchObject({ sourceType: 'issue', state: 'open' });
    expect(stored.workItem.sources[1]).toMatchObject({ sourceType: 'pull-request', state: 'merged' });
  });

  describe("keeps the issue as the card's primary source whatever the timestamps say", () => {
    /** File issue `n`, attach its pull request, then set the pull request source's `created_at` relative to the issue's. */
    async function attachAt(
      { storage, workItems, scope, file }: Awaited<ReturnType<typeof setup>>,
      n: number,
      offsetMs: number,
    ) {
      const card = await file({ ...issue12, externalId: `github:10:issue:${n}` }, { state: 'open' });
      const attached = await workItems.attachSource({
        orgId: scope.orgId,
        id: card.id,
        source: { ...pullRequest34, externalId: `github:10:pull-request:${n + 1000}` },
        metadata: { state: 'open' },
      });
      const [issueSource, pullRequestSource] = await storage.ops.findMany<WorkItemSourceDbRecord>(
        FACTORY_WORK_ITEM_SOURCES_SCHEMA.name,
        { work_item_id: attached!.item.workItem.id },
        { orderBy: [['role', 'desc']] },
      );
      expect([issueSource!.source_type, pullRequestSource!.source_type]).toEqual(['issue', 'pull-request']);
      await storage.ops.updateMany(
        FACTORY_WORK_ITEM_SOURCES_SCHEMA.name,
        { id: pullRequestSource!.id },
        { created_at: new Date(new Date(issueSource!.created_at).getTime() + offsetMs) },
      );
      return card.id;
    }

    async function expectIssuePrimary({ workItems, scope }: Awaited<ReturnType<typeof setup>>, id: string) {
      const stored = (await workItems.get({ orgId: scope.orgId, id }))!;
      expect(stored.workItem.sources.map(source => source.sourceType)).toEqual(['issue', 'pull-request']);
      expect(stored.externalSource).toMatchObject({ type: 'issue' });
      const pullRequestSource = stored.workItem.sources[1]!;
      await workItems.syncWorkItemSource({
        orgId: scope.orgId,
        factoryProjectId: scope.factoryProjectId,
        provider: pullRequestSource.provider,
        externalId: pullRequestSource.externalId,
        patch: { state: 'merged', metadata: { state: 'closed', merged: true } },
      });
      const synced = (await workItems.get({ orgId: scope.orgId, id }))!;
      expect(synced.workItem.sources[0]).toMatchObject({ sourceType: 'issue', state: 'open' });
      expect(synced.workItem.sources[1]).toMatchObject({ sourceType: 'pull-request', state: 'merged' });
    }

    it('when the pull request source was written in the same millisecond', async () => {
      const harness = await setup();
      // Ten cards: an id tie-break would put the pull request first on about half of them.
      const ids = await Promise.all(Array.from({ length: 10 }, (_, n) => attachAt(harness, n + 1, 0)));
      for (const id of ids) await expectIssuePrimary(harness, id);
    });

    it('when the pull request source is older than the issue source', async () => {
      const harness = await setup();
      await expectIssuePrimary(harness, await attachAt(harness, 1, -60_000));
    });

    it('when the issue source predates the role column', async () => {
      const harness = await setup();
      const id = await attachAt(harness, 1, -60_000);
      const card = (await harness.workItems.get({ orgId: harness.scope.orgId, id }))!;
      await harness.storage.ops.updateMany(
        FACTORY_WORK_ITEM_SOURCES_SCHEMA.name,
        { work_item_id: card.workItem.id, source_type: 'issue' },
        { role: null },
      );
      await expectIssuePrimary(harness, id);
    });
  });

  it('reads a card stored on the retired Review board as Work and stores Work on its next write', async () => {
    const { storage, workItems, scope, file } = await setup();
    const card = await file(pullRequest34, { state: 'open' });
    // A row as the Review board left it: board `review`, phase `review`. No migration rewrote it.
    await storage.ops.updateMany(
      FACTORY_BOARD_ITEMS_SCHEMA.name,
      { id: card.id },
      {
        board: 'review',
        stages: ['review'],
        stage_history: [{ stage: 'review', enteredAt: new Date(0).toISOString(), by: 'user' }],
      },
    );

    const legacy = (await workItems.get({ orgId: scope.orgId, id: card.id }))!;
    expect(legacy).toMatchObject({ board: 'work', stages: ['pr-review'] });
    expect(legacy.stageHistory.map(entry => entry.stage)).toEqual(['pr-review']);
    const listed = await workItems.list({ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId });
    expect(listed.map(item => [item.id, item.board, item.stages])).toEqual([[card.id, 'work', ['pr-review']]]);
    expect((await storage.ops.findOne(FACTORY_BOARD_ITEMS_SCHEMA.name, { id: card.id }))?.board).toBe('review');

    await workItems.update({ ...scope, id: card.id, patch: { stages: ['done'] } });

    const raw = await storage.ops.findOne<{ board: string; stages: string[] }>(FACTORY_BOARD_ITEMS_SCHEMA.name, {
      id: card.id,
    });
    expect(raw).toMatchObject({ board: 'work', stages: ['done'] });
  });
});
