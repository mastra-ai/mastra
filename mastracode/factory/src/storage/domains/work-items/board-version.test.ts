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
  return () => findMany.mock.calls.filter(([collection]) => collection === 'factory_board_items').length;
}

/** Counts reads of every card of a project, which catching up on a few cards must avoid. */
function countFullBoardReads(seed: Seed) {
  const findMany = vi.spyOn(seed.storage.ops, 'findMany');
  return () =>
    findMany.mock.calls.filter(
      ([collection, where]) =>
        collection === 'factory_board_items' && where.id === undefined && where.work_item_id === undefined,
    ).length;
}

/** Lets the next read of the work items, which carry the card fields, take its snapshot, then holds it until released. */
function holdNextCardRead(seed: Seed) {
  const findMany = seed.storage.ops.findMany.bind(seed.storage.ops);
  const taken = Promise.withResolvers<void>();
  const held = Promise.withResolvers<void>();
  let holding = true;
  vi.spyOn(seed.storage.ops, 'findMany').mockImplementation(async (...args: Parameters<typeof findMany>) => {
    const rows = await findMany(...args);
    if (!holding || args[0] !== 'factory_work_items') return rows;
    holding = false;
    taken.resolve();
    await held.promise;
    return rows;
  });
  return { taken: taken.promise, release: held.resolve };
}

/** Resolves once the next board version read has returned to its caller. */
function nextVersionRead(seed: Seed) {
  const findOne = seed.storage.ops.findOne.bind(seed.storage.ops);
  const read = Promise.withResolvers<void>();
  vi.spyOn(seed.storage.ops, 'findOne').mockImplementationOnce(async (...args: Parameters<typeof findOne>) => {
    const row = await findOne(...args);
    setImmediate(read.resolve);
    return row;
  });
  return read.promise;
}

/** The project's cards read straight from the database, in the order a full read returns them. */
const uncached = (seed: Seed) => seed.workItems.listWith(seed.storage.ops, { orgId: ORG, factoryProjectId: PROJECT });

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

  it('reads an uncached board once when several tabs poll it at the same moment', async () => {
    const seed = await createFactoryStorageForTests();
    await seedCard(seed.workItems);
    const cardReads = countCardReads(seed);

    const [first, second] = await Promise.all([poll(seed.workItems), poll(seed.workItems)]);

    expect(cardReads()).toBe(1);
    first[0]!.title = 'mutated by a route';
    expect(second[0]?.title).toBe('Fix login');
  });

  it('does not hand a poll made after an edit the cards read before it', async () => {
    const seed = await createFactoryStorageForTests();
    const card = await seedCard(seed.workItems);
    const staleRead = holdNextCardRead(seed);
    const before = poll(seed.workItems);
    await staleRead.taken;

    await seed.workItems.update({
      orgId: ORG,
      id: card.id,
      userId: 'user-alice',
      patch: { title: 'Fix login on Safari' },
    });
    const versionRead = nextVersionRead(seed);
    const after = poll(seed.workItems);
    await versionRead;
    staleRead.release();

    expect((await after).map(item => item.title)).toEqual(['Fix login on Safari']);
    expect((await before).map(item => item.title)).toEqual(['Fix login']);
  });

  it('keeps the edited board cached when a read begun before the edit finishes last', async () => {
    const seed = await createFactoryStorageForTests();
    const card = await seedCard(seed.workItems);
    const staleRead = holdNextCardRead(seed);
    const before = poll(seed.workItems);
    await staleRead.taken;
    await seed.workItems.update({
      orgId: ORG,
      id: card.id,
      userId: 'user-alice',
      patch: { title: 'Fix login on Safari' },
    });
    await poll(seed.workItems);
    staleRead.release();
    await before;
    vi.restoreAllMocks();
    const cardReads = countCardReads(seed);

    expect((await poll(seed.workItems)).map(item => item.title)).toEqual(['Fix login on Safari']);
    expect(cardReads()).toBe(0);
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

    await seed.workItems['ops'].updateAtomic('factory_board_items', { id: card.id }, () => null);
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

  it('shows a write made through another replica on the next poll', async () => {
    // Two API replicas: separate processes' storage (and caches) over one database file.
    const dir = await mkdtemp(join(tmpdir(), 'board-cache-'));
    const url = `file:${join(dir, 'factory.db')}`;
    const replica = async (id: string) => {
      const backend = new LibSQLFactoryStorage({ id, url });
      const workItems = backend.registerDomain(new WorkItemsStorage());
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

      // B's own edit chains from a version A wrote: A must not catch up past A's bump it never saw.
      await poll(a.workItems);
      await b.workItems.update({ orgId: ORG, id: card.id, userId: 'user-alice', patch: { title: 'Edited on B' } });
      expect((await poll(a.workItems)).map(item => item.title)).toEqual(['Edited on B']);
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
    expect(cardReads()).toBeGreaterThan(0);
  });

  it('re-reads only the edited card on the poll after an edit', async () => {
    const seed = await createFactoryStorageForTests();
    const cards = [];
    for (const title of ['One', 'Two', 'Three']) cards.push(await seedCard(seed.workItems, { title }));
    await poll(seed.workItems);
    const fullReads = countFullBoardReads(seed);

    await seed.workItems.update({
      orgId: ORG,
      id: cards[1]!.id,
      userId: 'user-alice',
      patch: { title: 'Two, edited' },
    });
    const after = await poll(seed.workItems);

    expect(fullReads()).toBe(0);
    expect(after.map(item => item.title).sort()).toEqual(['One', 'Three', 'Two, edited']);
    expect(after).toEqual(await uncached(seed));
  });

  it('adds a created card and drops a deleted one without re-reading the board', async () => {
    const seed = await createFactoryStorageForTests();
    const doomed = await seedCard(seed.workItems, { title: 'Doomed' });
    await seedCard(seed.workItems, { title: 'Kept' });
    await poll(seed.workItems);
    const fullReads = countFullBoardReads(seed);

    await seedCard(seed.workItems, { title: 'New' });
    const created = await poll(seed.workItems);
    expect(fullReads()).toBe(0);
    expect(created.map(item => item.title).sort()).toEqual(['Doomed', 'Kept', 'New']);
    expect(created).toEqual(await uncached(seed));

    await seed.workItems.delete({ orgId: ORG, id: doomed.id });
    const readsBefore = fullReads();
    const deleted = await poll(seed.workItems);
    expect(fullReads()).toBe(readsBefore);
    expect(deleted.map(item => item.title).sort()).toEqual(['Kept', 'New']);
    expect(deleted).toEqual(await uncached(seed));
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

  it('stops sharing a card read that has run past the safety window', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    try {
      const seed = await createFactoryStorageForTests();
      await seedCard(seed.workItems);
      const stuck = holdNextCardRead(seed);
      const first = poll(seed.workItems);
      await stuck.taken;
      const cardReads = countCardReads(seed);
      const readsWhileStuck = cardReads();

      vi.setSystemTime(Date.now() + 61_000);
      const versionRead = nextVersionRead(seed);
      const later = poll(seed.workItems);
      await versionRead;
      stuck.release();

      expect(cardReads()).toBe(readsWhileStuck + 1);
      expect((await later).map(item => item.title)).toEqual(['Fix login']);
      await first;
    } finally {
      vi.useRealTimers();
    }
  });
});
