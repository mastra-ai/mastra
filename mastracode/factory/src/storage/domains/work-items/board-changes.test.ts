import { randomUUID } from 'node:crypto';

import type { FactoryStorage } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';

import {
  createFactoryStorageForTests,
  createIsolatedFactoryPostgresForTests,
  createIsolatedFactoryPostgresUrlForTests,
  demoteCardsToLegacyForTests,
} from '../../test-utils.js';
import type { Card, ExternalWorkItemSource } from './base.js';
import { CHANGE_RETENTION_MS, FACTORY_BOARD_CHANGES_SCHEMA } from './board-changes.js';
import { FACTORY_BOARD_VERSIONS_SCHEMA, markBoardsForeign } from './board-version.js';
import type { BoardVersionRow } from './board-version.js';
import { FACTORY_BOARD_ITEMS_SCHEMA } from './work-item-schema.js';

const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
const backends = ['libsql', ...(postgresUrl ? ['postgres'] : [])];

const issue = (n: number): ExternalWorkItemSource => ({
  integrationId: 'github',
  type: 'issue',
  externalId: `github:10:issue:${n}`,
  url: `https://github.com/acme/app/issues/${n}`,
});

async function setup(backend: string) {
  return replica(
    backend === 'postgres'
      ? await createIsolatedFactoryPostgresForTests(postgresUrl!)
      : new LibSQLFactoryStorage({ id: 'board-changes-test', url: ':memory:' }),
    randomUUID(),
  );
}

/** One Factory process on `storage`, with a card list cache of its own. */
async function replica(storage: FactoryStorage, orgId: string) {
  const { workItems } = await createFactoryStorageForTests(storage);
  const scope = { orgId, factoryProjectId: 'project', userId: 'user' };
  const project = { orgId: scope.orgId, factoryProjectId: scope.factoryProjectId };
  const where = { org_id: project.orgId, factory_project_id: project.factoryProjectId };
  const file = async (n: number, stages = ['intake']) =>
    (
      await workItems.upsert({
        ...scope,
        input: { title: `Issue ${n}`, board: 'work', stages, externalSource: issue(n), metadata: { number: n } },
      })
    ).item;
  /** The list every caller shares, kept up to date from the change log. */
  const shared = () => workItems.listShared(project);
  /** The same list read from the tables, as a replica with nothing cached reads it. */
  const stored = () => workItems.listWith(storage.ops, project);
  const counter = async () => (await storage.ops.findOne<BoardVersionRow>(FACTORY_BOARD_VERSIONS_SCHEMA.name, where))!;
  const logged = async () =>
    (await storage.ops.findMany<{ board_item_id: string }>(FACTORY_BOARD_CHANGES_SCHEMA.name, where))
      .map(row => row.board_item_id)
      .sort();
  /** A card write as a Factory from before the change log makes it: the row, then a new version. */
  const writeAsOlderFactory = async (id: string, columns: Record<string, unknown>) => {
    await storage.ops.updateMany(FACTORY_BOARD_ITEMS_SCHEMA.name, { id }, columns);
    await markBoardsForeign(storage.ops, [project]);
  };
  return { storage, workItems, scope, project, file, shared, stored, counter, logged, writeAsOlderFactory };
}

/** Cards of `after` that are the very objects `before` held. */
function reused(before: readonly Card[], after: readonly Card[]): string[] {
  const held = new Set(before);
  return after.filter(card => held.has(card)).map(card => card.id);
}

const ids = (cards: readonly Card[]) => cards.map(card => card.id);

describe.each(backends)('cached card list on %s', backend => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('takes every public card write in by re-reading only the card it changed', async () => {
    const { workItems, scope, file, shared, stored, counter } = await setup(backend);
    const card = await file(1);
    const other = await file(2);
    const untouched = await file(3);
    const source = card.workItem.sources[0]!;

    const writes: [string, () => Promise<unknown>][] = [
      ['update title', () => workItems.update({ ...scope, id: card.id, patch: { title: 'Renamed' } })],
      ['move stage', () => workItems.update({ ...scope, id: card.id, patch: { stages: ['planning'] } })],
      [
        'sync the source',
        () =>
          workItems.syncWorkItemSource({
            ...scope,
            provider: source.provider,
            externalId: source.externalId,
            patch: { state: 'closed' },
          }),
      ],
      ['sync the card', () => workItems.syncCard({ ...scope, id: card.id, patch: { title: 'Synced' } })],
      [
        'attach a pull request',
        () =>
          workItems.attachSource({
            orgId: scope.orgId,
            id: card.id,
            source: { integrationId: 'github', type: 'pull-request', externalId: 'github:10:pull-request:9' },
            metadata: { state: 'open' },
          }),
      ],
    ];
    for (const [name, write] of writes) {
      const before = await shared();
      const seq = (await counter()).change_seq!;
      await write();
      const after = await shared();
      expect(after, name).toEqual(await stored());
      expect(Object.isFrozen(after) && after.every(item => Object.isFrozen(item.workItem)), name).toBe(true);
      // Only the written card was read again.
      expect(reused(before, after).sort(), name).toEqual([other.id, untouched.id].sort());
      expect((await counter()).change_seq, name).toBe(seq + 1);
    }

    const beforeCreate = await shared();
    const created = await file(4);
    const afterCreate = await shared();
    expect(afterCreate).toEqual(await stored());
    expect(reused(beforeCreate, afterCreate)).toEqual(ids(beforeCreate));

    await workItems.delete({ orgId: scope.orgId, id: other.id });
    const afterDelete = await shared();
    expect(afterDelete).toEqual(await stored());
    expect(ids(afterDelete).sort()).toEqual([card.id, untouched.id, created.id].sort());
    expect(reused(afterCreate, afterDelete)).toEqual(ids(afterDelete));
  });

  it('refuses a card write that skips the card transaction', async () => {
    const { workItems, file } = await setup(backend);
    const card = await file(1);
    // The domain's own ops are what every method writes through outside `#withTransaction`.
    const ops = (workItems as unknown as { ops: FactoryStorage['ops'] }).ops;
    await expect(ops.updateMany(FACTORY_BOARD_ITEMS_SCHEMA.name, { id: card.id }, { stages: ['done'] })).rejects.toThrow(
      /outside a card transaction/,
    );
  });

  it('returns the very same list when the cards it holds did not change', async () => {
    const { workItems, scope, file, shared, counter } = await setup(backend);
    await file(1);
    const before = await shared();
    const seq = (await counter()).change_seq!;

    // A card that came and went between two reads.
    const passing = await file(2);
    await workItems.delete({ orgId: scope.orgId, id: passing.id });

    expect((await counter()).change_seq).toBeGreaterThan(seq);
    expect(await shared()).toBe(before);
  });

  it('orders cards created in the same millisecond as a full read does', async () => {
    const { file, shared, stored } = await setup(backend);
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-01-01T00:00:00Z') });
    await file(1);
    const before = await shared();
    for (let n = 2; n <= 9; n++) await file(n);
    vi.setSystemTime(new Date('2026-01-01T00:00:01Z'));
    await file(10);

    const after = await shared();
    expect(reused(before, after)).toEqual(ids(before));
    expect(ids(after)).toEqual(ids(await stored()));
  });

  it('gives readers that arrive together one refreshed list', async () => {
    const { workItems, scope, file, shared } = await setup(backend);
    const card = await file(1);
    await file(2);
    await shared();
    await workItems.update({ ...scope, id: card.id, patch: { title: 'Renamed' } });

    const lists = await Promise.all(Array.from({ length: 8 }, shared));
    expect(lists[0]!.find(item => item.id === card.id)!.workItem.title).toBe('Renamed');
    for (const list of lists) expect(list).toBe(lists[0]);
  });

  it('takes in a write whose replica stopped between committing it and stamping it', async () => {
    const { storage, project, file, shared, stored, counter } = await setup(backend);
    const card = await file(1);
    await file(2);
    const before = await shared();
    const seq = (await counter()).change_seq!;

    // What the card transaction commits: the row and its log entry, not yet in the sequence.
    await storage.ops.updateMany(FACTORY_BOARD_ITEMS_SCHEMA.name, { id: card.id }, { stages: ['done'] });
    await storage.ops.insertOne(FACTORY_BOARD_CHANGES_SCHEMA.name, {
      id: randomUUID(),
      org_id: project.orgId,
      factory_project_id: project.factoryProjectId,
      board_item_id: card.id,
      change_seq: null,
      changed_at: new Date(),
    });

    const after = await shared();
    expect(after.find(item => item.id === card.id)!.stages).toEqual(['done']);
    expect(after).toEqual(await stored());
    expect(reused(before, after)).toHaveLength(1);
    expect((await counter()).change_seq).toBe(seq + 1);
  });

  it('reads the list in full after a write an older Factory made, then follows the log again', async () => {
    const { workItems, scope, file, shared, stored, counter, writeAsOlderFactory } = await setup(backend);
    const card = await file(1);
    const other = await file(2);
    const before = await shared();
    const seq = (await counter()).change_seq!;

    await writeAsOlderFactory(card.id, { stages: ['done'] });

    const after = await shared();
    expect(after.find(item => item.id === card.id)!.stages).toEqual(['done']);
    expect(after).toEqual(await stored());
    // No log entry names the card, so nothing read before the write is kept.
    expect(reused(before, after)).toEqual([]);
    // The older Factory's version did not reset the counter it does not know about.
    expect(await counter()).toMatchObject({ change_seq: seq + 1, pruned_seq: seq + 1, version: `seq:${seq + 1}` });

    await workItems.update({ ...scope, id: other.id, patch: { title: 'After' } });
    const followed = await shared();
    expect(followed).toEqual(await stored());
    expect(reused(after, followed)).toEqual([card.id]);
  });

  it('reads the list in full when a logged write follows an older Factory write before any read', async () => {
    const { workItems, scope, file, shared, stored, writeAsOlderFactory } = await setup(backend);
    const card = await file(1);
    const other = await file(2);
    const before = await shared();

    await writeAsOlderFactory(card.id, { stages: ['done'] });
    await workItems.update({ ...scope, id: other.id, patch: { title: 'After' } });

    const after = await shared();
    expect(after).toEqual(await stored());
    expect(after.find(item => item.id === card.id)!.stages).toEqual(['done']);
    expect(reused(before, after)).toEqual([]);
  });

  it('follows a project whose cards were all written before the change log existed', async () => {
    const { storage, workItems, scope, project, file, shared, stored, counter } = await setup(backend);
    const card = await file(1);
    await file(2);
    // As an upgrade finds it: cards, a version an older Factory wrote, no counter and no log.
    await storage.ops.deleteMany(FACTORY_BOARD_CHANGES_SCHEMA.name, {});
    await storage.ops.updateMany(
      FACTORY_BOARD_VERSIONS_SCHEMA.name,
      { org_id: project.orgId },
      { version: randomUUID(), change_seq: null, pruned_seq: null },
    );

    const first = await shared();
    expect(first).toEqual(await stored());
    expect(await counter()).toMatchObject({ change_seq: 1, pruned_seq: 1, version: 'seq:1' });
    expect(await shared()).toBe(first);

    await workItems.update({ ...scope, id: card.id, patch: { title: 'After' } });
    const after = await shared();
    expect(after).toEqual(await stored());
    expect(reused(first, after)).toHaveLength(1);
  });

  it('reads the list in full when the counter restarts below where the list was read', async () => {
    const { storage, project, file, shared, stored, counter } = await setup(backend);
    const card = await file(1);
    await file(2);
    await shared();
    expect((await counter()).change_seq).toBe(2);

    // A counter put back to nothing, as restoring the table from before the change log does.
    await storage.ops.deleteMany(FACTORY_BOARD_CHANGES_SCHEMA.name, {});
    await storage.ops.updateMany(FACTORY_BOARD_ITEMS_SCHEMA.name, { id: card.id }, { stages: ['done'] });
    await storage.ops.updateMany(
      FACTORY_BOARD_VERSIONS_SCHEMA.name,
      { org_id: project.orgId },
      { version: randomUUID(), change_seq: null, pruned_seq: null },
    );

    const after = await shared();
    expect((await counter()).change_seq).toBe(1);
    expect(after.find(item => item.id === card.id)!.stages).toEqual(['done']);
    expect(after).toEqual(await stored());
  });

  it('reads the list in full once the project stops using the Review board', async () => {
    const { storage, workItems, scope, file, shared, stored } = await setup(backend);
    const open = await file(1);
    const closed = await file(2);
    for (const [card, stage] of [
      [open, 'review'],
      [closed, 'done'],
    ] as const) {
      await storage.ops.updateMany(
        FACTORY_BOARD_ITEMS_SCHEMA.name,
        { id: card.id },
        { board: 'review', stages: [stage], stage_history: [{ stage, enteredAt: new Date(0).toISOString(), by: 'user' }] },
      );
    }
    await markBoardsForeign(storage.ops, [{ orgId: scope.orgId, factoryProjectId: scope.factoryProjectId }]);
    expect((await shared()).map(item => item.board)).toEqual(['review', 'review']);

    // The last open Review card closes: every card stored on Review now reads as Work, the one no write touched too.
    await workItems.update({ ...scope, id: open.id, patch: { stages: ['done'] } });

    const after = await shared();
    expect(after.map(item => item.board)).toEqual(['work', 'work']);
    expect(after).toEqual(await stored());
  });

  it('keeps one change log entry per card, deleted ones until retention ends, and moves the horizon past what it drops', async () => {
    const { workItems, scope, file, counter, logged } = await setup(backend);
    vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-01-01T00:00:00Z') });
    const cards = [await file(1), await file(2), await file(3)];
    for (const title of ['a', 'b', 'c']) await workItems.update({ ...scope, id: cards[2]!.id, patch: { title } });
    await workItems.delete({ orgId: scope.orgId, id: cards[0]!.id });
    // The deleted card's entry is its deletion record.
    expect(await logged()).toEqual(ids(cards).sort());
    const seq = (await counter()).change_seq!;

    vi.setSystemTime(Date.now() + CHANGE_RETENTION_MS + 60_000);
    await workItems.delete({ orgId: scope.orgId, id: cards[2]!.id });
    expect(await logged()).toEqual([cards[2]!.id]);
    expect(await counter()).toMatchObject({ change_seq: seq + 1, pruned_seq: seq });
  });

  it(
    'converges with a full read under concurrent writes of every kind, while readers poll',
    { timeout: 240_000 },
    async () => {
      const { storage, workItems, scope, project, file, shared, stored } = await setup(backend);
      const sorted = (list: readonly Card[]) =>
        list.every((card, index) => {
          const next = list[index + 1];
          if (!next) return true;
          const age = card.createdAt.getTime() - next.createdAt.getTime();
          return age > 0 || (age === 0 && card.id > next.id);
        });
      for (let round = 0; round < 30; round++) {
        const base = round * 100;
        const seed: Card[] = [];
        for (let n = 0; n < 8; n++) seed.push(await file(base + n));
        const [renamed, moved, synced, attached, deleted, resynced, legacy, untouched] = seed as [
          Card,
          Card,
          Card,
          Card,
          Card,
          Card,
          Card,
          Card,
        ];
        // Every third round one card is still where a 0.26 Factory left it, and is copied over mid-round.
        const copies = round % 3 === 0;
        if (copies) await demoteCardsToLegacyForTests(storage, [legacy.id]);
        const before = copies ? undefined : await shared();

        const failures: unknown[] = [];
        let writing = true;
        const readers = Array.from({ length: 4 }, async () => {
          while (writing) {
            const list = await shared().catch(error => void failures.push(error));
            if (list && !sorted(list)) failures.push(new Error(`round ${round}: list out of order`));
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        });
        const run = (write: Promise<unknown>) => write.catch(error => void failures.push(error));
        await Promise.all([
          run(workItems.update({ ...scope, id: renamed.id, patch: { title: `renamed ${round}` } })),
          run(workItems.update({ ...scope, id: moved.id, patch: { stages: ['planning'] } })),
          run(
            workItems.syncWorkItemSource({
              ...scope,
              provider: synced.workItem.sources[0]!.provider,
              externalId: synced.workItem.sources[0]!.externalId,
              patch: { state: `closed ${round}` },
            }),
          ),
          run(
            workItems.attachSource({
              orgId: scope.orgId,
              id: attached.id,
              source: { integrationId: 'github', type: 'pull-request', externalId: `github:10:pull-request:${base}` },
              metadata: { state: 'open' },
            }),
          ),
          run(workItems.delete({ orgId: scope.orgId, id: deleted.id })),
          run(workItems.syncCard({ ...scope, id: resynced.id, patch: { title: `synced ${round}` } })),
          run(workItems.update({ ...scope, id: legacy.id, patch: { title: `copied ${round}` } })),
          run(file(base + 50)),
          run(file(base + 51)),
        ]);
        writing = false;
        await Promise.all(readers);
        expect(failures, `round ${round}`).toEqual([]);

        const final = await shared();
        expect(final, `round ${round}`).toEqual(await stored());
        // The list was brought up to date, not read again: a card no write touched is the object it was.
        if (before) {
          const kept = before.find(card => card.id === untouched.id)!;
          expect(final.find(card => card.id === untouched.id), `round ${round}`).toBe(kept);
        }
        expect(await workItems.listShared(project), `round ${round}`).toBe(final);
      }
    },
  );
});

describe.skipIf(!postgresUrl)('card writes on postgres', () => {
  /** Two Factory processes on one database, each with its own cached lists. */
  async function replicas() {
    const url = await createIsolatedFactoryPostgresUrlForTests(postgresUrl!);
    const { PgFactoryStorage } = await import('@mastra/pg');
    const orgId = randomUUID();
    const first = await replica(new PgFactoryStorage({ id: 'replica-1', connectionString: url }), orgId);
    const second = await replica(new PgFactoryStorage({ id: 'replica-2', connectionString: url }), orgId);
    return [first, second] as const;
  }

  it('brings a replica up to date from the cards another replica wrote', async () => {
    const [writer, reader] = await replicas();
    const cards = [await writer.file(1), await writer.file(2), await writer.file(3)];
    const before = await reader.shared();

    await writer.workItems.update({ ...writer.scope, id: cards[0]!.id, patch: { title: 'Renamed' } });
    await writer.workItems.delete({ orgId: writer.scope.orgId, id: cards[1]!.id });
    const created = await writer.file(4);

    const after = await reader.shared();
    expect(after).toEqual(await reader.stored());
    expect(ids(after)).toEqual([created.id, cards[2]!.id, cards[0]!.id]);
    expect(reused(before, after)).toEqual([cards[2]!.id]);
  });

  it('keeps two replicas that both write and read the same cards on one list', { timeout: 120_000 }, async () => {
    const [first, second] = await replicas();
    for (let round = 0; round < 10; round++) {
      const base = round * 100;
      const cards: Card[] = [];
      for (let n = 0; n < 4; n++) cards.push(await first.file(base + n));
      await Promise.all([first.shared(), second.shared()]);

      const failures: unknown[] = [];
      let writing = true;
      const readers = [first, second].map(async side => {
        while (writing) {
          await side.shared().catch(error => void failures.push(error));
          await new Promise(resolve => setTimeout(resolve, 1));
        }
      });
      const run = (write: Promise<unknown>) => write.catch(error => void failures.push(error));
      await Promise.all([
        run(first.workItems.update({ ...first.scope, id: cards[0]!.id, patch: { title: `first ${round}` } })),
        run(second.workItems.update({ ...second.scope, id: cards[0]!.id, patch: { stages: ['planning'] } })),
        run(second.workItems.update({ ...second.scope, id: cards[1]!.id, patch: { title: `second ${round}` } })),
        run(first.workItems.delete({ orgId: first.scope.orgId, id: cards[2]!.id })),
        run(second.file(base + 50)),
        run(first.file(base + 51)),
      ]);
      writing = false;
      await Promise.all(readers);
      expect(failures, `round ${round}`).toEqual([]);

      const stored = await first.stored();
      expect(await first.shared(), `round ${round}`).toEqual(stored);
      expect(await second.shared(), `round ${round}`).toEqual(stored);
    }
  });

  it('runs source syncs and card edits of the same cards concurrently without failing, stamping all of them', async () => {
    const { storage, workItems, scope, file, shared, stored } = await setup('postgres');
    const cards = [await file(1), await file(2), await file(3)];
    const failures: unknown[] = [];
    const run = (write: () => Promise<unknown>) => write().catch(error => failures.push(error));
    await Promise.all(
      Array.from({ length: 12 }, (_, round) =>
        cards.flatMap(card => [
          run(() =>
            workItems.syncWorkItemSource({
              ...scope,
              provider: card.workItem.sources[0]!.provider,
              externalId: card.workItem.sources[0]!.externalId,
              patch: { state: `s${round}` },
            }),
          ),
          run(() => workItems.update({ ...scope, id: card.id, patch: { title: `t${round}` } })),
          run(() => workItems.syncCard({ ...scope, id: card.id, patch: { title: `c${round}` } })),
        ]),
      ).flat(),
    );
    expect(failures).toEqual([]);
    const log = await storage.ops.findMany<{ board_item_id: string; change_seq: number | null }>(
      FACTORY_BOARD_CHANGES_SCHEMA.name,
      { org_id: scope.orgId },
    );
    expect(log.filter(entry => entry.change_seq === null)).toEqual([]);
    expect(log.map(entry => entry.board_item_id).sort()).toEqual(ids(cards).sort());
    expect(await shared()).toEqual(await stored());
  });
});
