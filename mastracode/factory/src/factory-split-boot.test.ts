import { randomUUID } from 'node:crypto';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import type { FactoryStorage } from '@mastra/core/storage';
import { LibSQLFactoryStorage } from '@mastra/libsql';
import { describe, expect, it, onTestFinished, vi } from 'vitest';

import { MastraFactory } from './factory.js';
import { createFactorySecretEncryption } from './secret-encryption.js';
import { WorkItemsStorage } from './storage/domains/work-items/base.js';
import type { Card } from './storage/domains/work-items/base.js';
import { Cards } from './storage/domains/work-items/cards.js';
import {
  FACTORY_BOARD_ITEMS_SCHEMA,
  FACTORY_WORK_ITEM_SOURCES_SCHEMA,
  FACTORY_WORK_ITEM_SPLIT_STATE_SCHEMA,
  FACTORY_WORK_ITEMS_SCHEMA,
} from './storage/domains/work-items/work-item-schema.js';
import { createFactoryStorageForTests } from './storage/test-utils.js';
import { splitBackfillRetry } from './work-items/split-backfill.js';
import { migrateWorkItemSplit } from './work-items/split-migration.js';

const USER = 'user-split-boot';
const postgresUrl = process.env.FACTORY_TEST_POSTGRES_URL;
// Each case boots real factories over a real database, several times; under a loaded runner that
// outlasts the 5s default.
vi.setConfig({ testTimeout: 30_000 });
const secretEncryption = createFactorySecretEncryption({ primary: { id: 'test', key: Buffer.alloc(32, 7) } });

/** A database several storage instances (replicas, restarts) open in turn. */
async function database(backend: string): Promise<() => FactoryStorage> {
  if (backend === 'postgres') {
    const { PgFactoryStorage, PostgresStore } = await import('@mastra/pg');
    const admin = new PostgresStore({ id: 'split-boot-admin', connectionString: postgresUrl!, disableInit: true });
    const schema = `factory_test_${randomUUID().replaceAll('-', '')}`;
    await admin.pool.query(`CREATE SCHEMA "${schema}"`);
    onTestFinished(async () => {
      await admin.pool.query(`DROP SCHEMA "${schema}" CASCADE`);
      await admin.close();
    });
    const url = new URL(postgresUrl!);
    url.searchParams.set('options', `-c search_path=${schema}`);
    return () => new PgFactoryStorage({ id: 'split-boot', connectionString: url.toString() });
  }
  const dir = mkdtempSync(join(tmpdir(), 'factory-split-boot-'));
  onTestFinished(() => rmSync(dir, { recursive: true, force: true }));
  return () => new LibSQLFactoryStorage({ id: 'split-boot', url: `file:${join(dir, 'factory.db')}` });
}

/** Holds the background copy: before it starts, or (with `atFirstCard`) at its first card write. */
function holdBackfill(storage: FactoryStorage, { atFirstCard = false } = {}) {
  let release!: () => void;
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  let started = false;
  let waiting = false;
  const backfill = WorkItemsStorage.prototype.backfillLegacyCards;
  const spies = [] as Array<{ mockRestore(): void }>;
  const restore = () => spies.splice(0).forEach(spy => spy.mockRestore());
  onTestFinished(restore);
  const pass = vi
    .spyOn(WorkItemsStorage.prototype, 'backfillLegacyCards')
    .mockImplementation(async function (this: WorkItemsStorage, options) {
      started = true;
      if (!atFirstCard) {
        waiting = true;
        await held;
      }
      return backfill.call(this, options);
    });
  const withTransaction = storage.withTransaction.bind(storage);
  const transactions = vi.spyOn(storage, 'withTransaction').mockImplementation(async (fn, options) => {
    if (atFirstCard && started) {
      waiting = true;
      await held;
    }
    return withTransaction(fn, options);
  });
  spies.push(pass, transactions);
  return { release, restore, waiting: () => waiting };
}

describe.each(['libsql', ...(postgresUrl ? ['postgres'] : [])])('Factory boot over legacy cards on %s', backend => {
  async function setup() {
    vi.stubEnv('MASTRA_PLATFORM_ACCESS_TOKEN', '');
    vi.stubEnv('MASTRA_FACTORY_WORK_ITEM_SPLIT', '');
    onTestFinished(() => {
      vi.unstubAllEnvs();
    });
    const open = await database(backend);
    // What an older Factory left behind: cards in the legacy table only.
    const seed = await createFactoryStorageForTests(open());
    const orgId = `org-${randomUUID()}`;
    const project = await seed.projects.create({ orgId, userId: USER, input: { name: 'Split boot' } });
    const scope = { orgId, userId: USER, factoryProjectId: project.id };
    let next = 0;
    const file = async (stages: string[], extra: Record<string, unknown> = {}) => {
      next += 1;
      return (
        await seed.workItems.upsert({
          ...scope,
          input: {
            externalSource: { integrationId: 'github', type: 'issue', externalId: `${orgId}-${next}` },
            title: `Card ${next}`,
            stages,
            sessions: {},
            metadata: {},
            ...extra,
          },
        })
      ).item;
    };
    const demoteAll = async () => {
      for (const legacy of await new Cards(seed.storage.ops).findMany({})) {
        delete legacy.work_item;
        delete legacy.work_item_sources;
        await seed.storage.ops.upsertOne('work_items', ['id'], legacy);
      }
      for (const table of [FACTORY_BOARD_ITEMS_SCHEMA, FACTORY_WORK_ITEM_SOURCES_SCHEMA, FACTORY_WORK_ITEMS_SCHEMA])
        await seed.storage.ops.deleteMany(table.name, {});
      await seed.storage.ops.deleteMany(FACTORY_WORK_ITEM_SPLIT_STATE_SCHEMA.name, {});
    };

    const boot = async ({ prepare = true }: { prepare?: boolean } = {}) => {
      const storage = open();
      const factory = new MastraFactory({ storage, auth: null, mcp: false, secretEncryption });
      onTestFinished(async () => {
        await factory.shutdown();
        await storage.close();
      });
      const findMany = vi.spyOn(storage.ops, 'findMany');
      const legacyPageQueries = () =>
        findMany.mock.calls.filter(([collection, , options]) => collection === 'work_items' && options?.limit !== 1)
          .length;
      if (prepare) await factory.prepare();
      const domain = () => storage.getDomain<WorkItemsStorage>('work-items');
      const boardItemIds = async () =>
        new Set(
          (await storage.ops.findMany<{ id: string }>(FACTORY_BOARD_ITEMS_SCHEMA.name, { org_id: orgId })).map(
            row => row.id,
          ),
        );
      const backfilled = () => vi.waitFor(() => expect(domain().legacyBackfillPending).toBe(false), 10_000);
      const marker = () => storage.ops.findMany(FACTORY_WORK_ITEM_SPLIT_STATE_SCHEMA.name, {});
      return {
        storage,
        factory,
        get workItems() {
          return domain();
        },
        boardItemIds,
        backfilled,
        marker,
        legacyPageQueries,
      };
    };
    return { seed, orgId, project, file, demoteAll, boot };
  }

  it('serves open cards at once and copies done cards in the background', async () => {
    const { orgId, file, demoteAll, boot } = await setup();
    const openCards = [await file(['intake']), await file(['planning'])];
    const doneCards = [await file(['done']), await file(['done']), await file(['done'])];
    await demoteAll();

    const { workItems, boardItemIds, backfilled, marker } = await boot();
    // Read before the background pass can land anything: the boot pass copied open cards only.
    const right = await boardItemIds();

    for (const card of openCards) expect(right.has(card.id)).toBe(true);
    await backfilled();
    const after = await boardItemIds();
    for (const card of doneCards) expect(after.has(card.id)).toBe(true);
    expect(await marker()).toHaveLength(1);
    expect((await workItems.get({ orgId, id: doneCards[0]!.id }))?.stages).toEqual(['done']);
  });

  it('leaves done cards out of the boot pass, yet finds one by id before the background copy', async () => {
    const { orgId, file, demoteAll, boot } = await setup();
    await file(['intake']);
    const done = await file(['done']);
    await demoteAll();

    const booted = await boot({ prepare: false });
    const { storage, factory } = booted;
    // Hold the background pass so the check below sees the boot pass alone.
    const hold = holdBackfill(storage);
    await factory.prepare();
    await vi.waitFor(() => expect(hold.waiting()).toBe(true));

    expect(await storage.ops.findOne(FACTORY_BOARD_ITEMS_SCHEMA.name, { id: done.id })).toBeNull();
    expect((await booted.workItems.get({ orgId, id: done.id }))?.id).toBe(done.id);
    expect(await storage.ops.findOne(FACTORY_BOARD_ITEMS_SCHEMA.name, { id: done.id })).not.toBeNull();
    hold.release();
    await booted.backfilled();
  });

  it('skips the legacy scan on the next boot once the copy finished', async () => {
    const { file, demoteAll, boot } = await setup();
    await file(['intake']);
    await file(['done']);
    await demoteAll();
    await (await boot()).backfilled();

    const second = await boot();

    expect(second.workItems.legacyBackfillPending).toBe(false);
    expect(second.legacyPageQueries()).toBe(0);
  });

  it('recopies a card an older replica changed after the copy finished', async () => {
    const { orgId, seed, file, demoteAll, boot } = await setup();
    const done = await file(['done']);
    await demoteAll();
    await (await boot()).backfilled();
    // An older replica reopens the card in the legacy table.
    await seed.storage.ops.updateMany(
      'work_items',
      { id: done.id },
      { stages: ['planning'], updated_at: new Date(Date.now() + 60_000) },
    );

    const { workItems } = await boot();

    expect((await workItems.get({ orgId, id: done.id }))?.stages).toEqual(['planning']);
  });

  // Production: a database 0.27.0 migrated, where an old replica rewrote cards that were since
  // edited on the board. Each scan skips the same cards and recopies nothing; once one boot finished,
  // the next does not scan at all.
  it('reports the same skips and no recopies on every boot that scans, then stops scanning', async () => {
    const { seed, file, demoteAll, boot } = await setup();
    const cards = [await file(['intake']), await file(['planning']), await file(['done']), await file(['done'])];
    await demoteAll();
    await migrateWorkItemSplit(seed.storage);
    for (const card of [cards[0]!, cards[2]!]) {
      const copied = await seed.storage.ops.findOne<{ updated_at: Date; revision: number }>(
        FACTORY_BOARD_ITEMS_SCHEMA.name,
        { id: card.id },
      );
      const edited = new Date(new Date(copied!.updated_at).getTime() + 1_000);
      await seed.storage.ops.updateMany(
        FACTORY_BOARD_ITEMS_SCHEMA.name,
        { id: card.id },
        { stages: ['review'], updated_at: edited, revision: copied!.revision + 1 },
      );
      await seed.storage.ops.updateMany(
        'work_items',
        { id: card.id },
        { title: 'Changed by an old replica', updated_at: new Date(edited.getTime() + 1_000) },
      );
    }

    const scan = async () => {
      const info = vi.spyOn(console, 'info').mockImplementation(() => {});
      const booted = await boot();
      await booted.backfilled();
      const lines = info.mock.calls.map(call => String(call[0])).filter(line => line.includes('work item split ('));
      info.mockRestore();
      return { booted, lines };
    };
    const first = await scan();
    expect(first.lines).toHaveLength(2);
    for (const line of first.lines) {
      expect(line).toMatch(/ 0 copied, 0 recopied, /);
      expect(line).toContain(`${cards[0]!.id} (Split board item changed after migration)`);
    }
    expect(first.lines[1]).toContain(`${cards[2]!.id} (Split board item changed after migration)`);
    expect(await first.booted.marker()).toHaveLength(1);
    await first.booted.factory.shutdown();

    // As if that boot had stopped before recording the copy finished.
    await first.booted.storage.ops.deleteMany(FACTORY_WORK_ITEM_SPLIT_STATE_SCHEMA.name, {});
    const second = await scan();
    expect(second.lines).toEqual(first.lines);
    await second.booted.factory.shutdown();

    const third = await boot();
    expect(third.legacyPageQueries()).toBe(0);
    expect(third.workItems.legacyBackfillPending).toBe(false);
    expect((await third.workItems.get({ orgId: cards[0]!.orgId, id: cards[0]!.id }))?.stages).toEqual(['review']);
  });

  it('stops the background copy on shutdown without recording it finished, and resumes on the next boot', async () => {
    const { file, demoteAll, boot } = await setup();
    const doneCards = [await file(['done']), await file(['done']), await file(['done'])];
    await demoteAll();
    const first = await boot({ prepare: false });
    const hold = holdBackfill(first.storage, { atFirstCard: true });
    await first.factory.prepare();
    await vi.waitFor(() => expect(hold.waiting()).toBe(true));

    let stopped = false;
    const stopping = first.factory.shutdown().then(() => {
      stopped = true;
    });
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(stopped).toBe(false);
    hold.release();
    await stopping;
    hold.restore();

    expect(await first.marker()).toEqual([]);
    expect(first.workItems.legacyBackfillPending).toBe(true);
    const second = await boot();
    await second.backfilled();
    const copied = await second.boardItemIds();
    for (const card of doneCards) expect(copied.has(card.id)).toBe(true);
    expect(await second.marker()).toHaveLength(1);
  });

  it('retries a failed background copy after a backoff, without a restart', async () => {
    const { file, demoteAll, boot } = await setup();
    const doneCards = [await file(['done']), await file(['done'])];
    await demoteAll();
    const failOnce = vi
      .spyOn(WorkItemsStorage.prototype, 'backfillLegacyCards')
      .mockRejectedValueOnce(new Error('connection reset'));
    const waits: number[] = [];
    const wait = vi.spyOn(splitBackfillRetry, 'wait').mockImplementation(async ms => {
      waits.push(ms);
    });
    const warn = vi.spyOn(console, 'warn');
    onTestFinished(() => {
      failOnce.mockRestore();
      wait.mockRestore();
      warn.mockRestore();
    });

    const booted = await boot();
    await booted.backfilled();

    expect(failOnce).toHaveBeenCalledTimes(2);
    expect(waits).toEqual([splitBackfillRetry.firstDelayMs]);
    expect(warn.mock.calls.map(([line]) => String(line))).toContain(
      '[factory] work item split backfill failed: connection reset; retrying in 5s',
    );
    const copied = await booted.boardItemIds();
    for (const card of doneCards) expect(copied.has(card.id)).toBe(true);
    expect(await booted.marker()).toHaveLength(1);
  });

  it('returns from shutdown at once while the background copy waits to retry', async () => {
    const { file, demoteAll, boot } = await setup();
    await file(['done']);
    await demoteAll();
    const failing = vi
      .spyOn(WorkItemsStorage.prototype, 'backfillLegacyCards')
      .mockRejectedValue(new Error('connection reset'));
    const realWait = splitBackfillRetry.wait.bind(splitBackfillRetry);
    let waiting = false;
    // The real, abortable wait, at its real five-second first delay.
    const wait = vi.spyOn(splitBackfillRetry, 'wait').mockImplementation((ms, signal) => {
      waiting = true;
      return realWait(ms, signal);
    });
    onTestFinished(() => {
      failing.mockRestore();
      wait.mockRestore();
    });

    const booted = await boot();
    await vi.waitFor(() => expect(waiting).toBe(true));
    const started = performance.now();
    await booted.factory.shutdown();

    expect(performance.now() - started).toBeLessThan(1_000);
    expect(failing).toHaveBeenCalledTimes(1);
    expect(await booted.marker()).toEqual([]);
  });

  it('copies nothing in dry-run mode', async () => {
    const { file, demoteAll, boot } = await setup();
    await file(['intake']);
    await file(['done']);
    await demoteAll();
    vi.stubEnv('MASTRA_FACTORY_WORK_ITEM_SPLIT', 'dry-run');

    const { storage, marker } = await boot();

    expect(await storage.ops.findMany(FACTORY_BOARD_ITEMS_SCHEMA.name, {})).toEqual([]);
    expect(await marker()).toEqual([]);
  });

  it('returns a held triage card that only the legacy table has to Intake at boot', async () => {
    const { orgId, project, seed, file, demoteAll, boot } = await setup();
    const card = await file(['intake']);
    const committed = await seed.workItems.commitTransition({
      orgId,
      factoryProjectId: project.id,
      workItemId: card.id,
      expectedRevision: card.revision,
      destinationStage: 'triage',
      actorId: 'agent:triage',
      ingress: { identity: `triage-${card.id}`, triggerType: 'agent', transitionId: `triage-${card.id}` },
      configVersion: 'split-boot',
      causalChain: [],
      evaluation: { outcome: 'accepted', decisions: [] },
      triageType: 'feature request',
    });
    expect((committed.item as Card | undefined)?.stages).toEqual(['triage']);
    await demoteAll();

    const { workItems } = await boot();

    expect((await workItems.get({ orgId, id: card.id }))?.stages).toEqual(['intake']);
  });
});
