/**
 * The board list cache over a real backend (libsql `:memory:`). Boards poll `list()` every few
 * seconds from every open tab, so an unchanged board must not re-read its cards — and any write a
 * user or agent makes must show up on the very next poll, from any replica.
 */

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createFactoryStorageForTests } from '../../test-utils.js';
import { WorkItemCommentsStorage } from '../comments/base.js';
import { WorkItemsStorage } from './base.js';

const ORG = 'org-1';
const PROJECT = 'project-1';

type Seed = Awaited<ReturnType<typeof createFactoryStorageForTests>>;

async function seedCard(workItems: WorkItemsStorage, { factoryProjectId = PROJECT, title = 'Fix login' } = {}) {
  const { item } = await workItems.upsert({
    orgId: ORG,
    userId: 'user-alice',
    factoryProjectId,
    input: { title, stages: ['intake'], sessions: {}, metadata: {} },
  });
  return item;
}

/** Counts reads of the card table, which is what a cache hit must avoid. */
function countCardReads(seed: Seed) {
  const findMany = vi.spyOn(seed.storage.ops, 'findMany');
  return () => findMany.mock.calls.filter(([collection]) => collection === 'work_items').length;
}

const poll = (workItems: WorkItemsStorage, factoryProjectId = PROJECT) =>
  workItems.list({ orgId: ORG, factoryProjectId });

afterEach(() => {
  vi.restoreAllMocks();
});

describe('board list cache', () => {
  it('serves repeated polls of an unchanged board without re-reading its cards', async () => {
    const seed = await createFactoryStorageForTests();
    await seedCard(seed.workItems, { title: 'One' });
    await seedCard(seed.workItems, { title: 'Two' });
    const cardReads = countCardReads(seed);

    const first = await poll(seed.workItems);
    const second = await poll(seed.workItems);
    const third = await poll(seed.workItems);

    expect(cardReads()).toBe(1);
    expect(second).toEqual(first);
    expect(third.map(item => item.title).sort()).toEqual(['One', 'Two']);
  });

  it('stops serving cards once every card is cleared', async () => {
    const seed = await createFactoryStorageForTests();
    await seedCard(seed.workItems);
    expect(await poll(seed.workItems)).toHaveLength(1);

    await seed.workItems.dangerouslyClearAll();

    expect(await poll(seed.workItems)).toEqual([]);
  });

  it('keeps the board cached when an atomic update decides not to write', async () => {
    const seed = await createFactoryStorageForTests();
    const card = await seedCard(seed.workItems);
    await poll(seed.workItems);
    const cardReads = countCardReads(seed);

    await seed.workItems['ops'].updateAtomic('work_items', { id: card.id }, () => null);
    await poll(seed.workItems);

    expect(cardReads()).toBe(0);
  });

  it('shows a card edit on the next poll', async () => {
    const seed = await createFactoryStorageForTests();
    const card = await seedCard(seed.workItems);
    await poll(seed.workItems);

    await seed.workItems.update({
      orgId: ORG,
      id: card.id,
      userId: 'user-alice',
      patch: { title: 'Fix login on Safari' },
    });

    expect((await poll(seed.workItems)).map(item => item.title)).toEqual(['Fix login on Safari']);
  });

  it('shows a card created or deleted after the board was cached', async () => {
    const seed = await createFactoryStorageForTests();
    const doomed = await seedCard(seed.workItems, { title: 'Doomed' });
    await poll(seed.workItems);

    await seedCard(seed.workItems, { title: 'New' });
    expect((await poll(seed.workItems)).map(item => item.title).sort()).toEqual(['Doomed', 'New']);

    await seed.workItems.delete({ orgId: ORG, id: doomed.id });
    expect((await poll(seed.workItems)).map(item => item.title)).toEqual(['New']);
  });

  it('shows a rule-committed stage move, which writes inside a transaction', async () => {
    const seed = await createFactoryStorageForTests();
    const card = await seedCard(seed.workItems);
    await poll(seed.workItems);

    await seed.workItems.commitTransition({
      orgId: ORG,
      factoryProjectId: PROJECT,
      workItemId: card.id,
      expectedRevision: card.revision,
      destinationStage: 'plan',
      actorId: 'user-alice',
      ingress: { identity: 'move-1', triggerType: 'human', transitionId: 'move-1' },
      configVersion: 'rules-v1',
      causalChain: [],
      evaluation: { outcome: 'accepted', decisions: [] },
    });

    expect((await poll(seed.workItems))[0]?.stages[0]).toBe('plan');
  });

  it('shows a new comment count on the card, though only the comment domain wrote', async () => {
    const seed = await createFactoryStorageForTests();
    const card = await seedCard(seed.workItems);
    expect((await poll(seed.workItems))[0]?.commentCount).toBe(0);

    // What posting a comment does: store it, then refresh the card's feed counters.
    const scope = { orgId: ORG, factoryProjectId: PROJECT, workItemId: card.id };
    await seed.comments.create({
      ...scope,
      author: { kind: 'user', id: 'user-alice', displayName: 'Alice' },
      body: 'looking at it now',
    });
    await seed.comments.refreshWorkItemFeedActivity(scope);

    expect((await poll(seed.workItems))[0]?.commentCount).toBe(1);
  });

  it('shows a write made through another replica on the next poll', async () => {
    // Two API replicas: separate processes' storage (and caches) over one database file.
    const dir = await mkdtemp(join(tmpdir(), 'board-cache-'));
    const url = `file:${join(dir, 'factory.db')}`;
    const replica = async (id: string) => {
      const backend = new LibSQLFactoryStorage({ id, url });
      const workItems = backend.registerDomain(new WorkItemsStorage());
      backend.registerDomain(new WorkItemCommentsStorage());
      await backend.init();
      return { backend, workItems };
    };
    const a = await replica('replica-a');
    const b = await replica('replica-b');
    try {
      const card = await seedCard(a.workItems);
      expect((await poll(b.workItems)).map(item => item.title)).toEqual(['Fix login']);

      await a.workItems.update({ orgId: ORG, id: card.id, userId: 'user-alice', patch: { title: 'Edited on A' } });

      expect((await poll(b.workItems)).map(item => item.title)).toEqual(['Edited on A']);
    } finally {
      await a.backend.close();
      await b.backend.close();
      await rm(dir, { recursive: true, force: true });
    }
  });

  it('keeps other projects cached when one project changes', async () => {
    const seed = await createFactoryStorageForTests();
    const busy = await seedCard(seed.workItems, { factoryProjectId: 'busy' });
    await seedCard(seed.workItems, { factoryProjectId: 'quiet' });
    await poll(seed.workItems, 'busy');
    await poll(seed.workItems, 'quiet');
    const cardReads = countCardReads(seed);

    await seed.workItems.update({ orgId: ORG, id: busy.id, userId: 'user-alice', patch: { title: 'Busy edit' } });
    await poll(seed.workItems, 'quiet');
    expect(cardReads()).toBe(0);

    expect((await poll(seed.workItems, 'busy'))[0]?.title).toBe('Busy edit');
    expect(cardReads()).toBe(1);
  });

  it('does not let a caller that decorates the returned cards corrupt the next poll', async () => {
    const seed = await createFactoryStorageForTests();
    await seedCard(seed.workItems);

    // Decorate both a fresh read and a cached one, as two concurrent requests would.
    for (let request = 0; request < 2; request++) {
      const cards = await poll(seed.workItems);
      cards[0]!.title = 'mutated by a route';
      cards[0]!.metadata.decorated = true;
      cards[0]!.stages.push('done');
    }

    const [card] = await poll(seed.workItems);
    expect(card?.title).toBe('Fix login');
    expect(card?.metadata).toEqual({});
    expect(card?.stages).toEqual(['intake']);
  });

  it('re-reads an unchanged board once the safety window passes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const seed = await createFactoryStorageForTests();
      await seedCard(seed.workItems);
      await poll(seed.workItems);
      const cardReads = countCardReads(seed);

      vi.setSystemTime(Date.now() + 59_000);
      await poll(seed.workItems);
      expect(cardReads()).toBe(0);

      vi.setSystemTime(Date.now() + 2_000);
      await poll(seed.workItems);
      expect(cardReads()).toBe(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
