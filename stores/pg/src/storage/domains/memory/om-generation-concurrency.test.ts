import { randomUUID } from 'node:crypto';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../../index';
import { connectionString, TEST_CONFIG } from '../../test-utils';

/**
 * Regression tests for https://github.com/mastra-ai/mastra/issues/22188.
 *
 * Each PostgresStore has its own pool, so several stores stand in for several
 * processes sharing one database.
 */
describe('PostgreSQL observational memory generation creation under concurrency', () => {
  const schemaName = `om_gen_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
  const tableName = `"${schemaName}"."mastra_observational_memory"`;
  const STORE_COUNT = 3;
  const CALLS_PER_STORE = 8;
  let stores: PostgresStore[];
  let memories: MemoryStorage[];
  let pool: Pool;

  const omInput = (resourceId: string) => ({
    threadId: null,
    resourceId,
    scope: 'resource' as const,
    config: { observationThreshold: 5000, reflectionThreshold: 40000 },
  });

  const rowsFor = async (resourceId: string) =>
    (
      await pool.query(
        `SELECT id, "generationCount" FROM ${tableName} WHERE "lookupKey" = $1 ORDER BY "generationCount", id`,
        [`resource:${resourceId}`],
      )
    ).rows as { id: string; generationCount: number }[];

  /** Runs `fn` CALLS_PER_STORE times on every store, all at once. */
  const onEveryStore = <T>(fn: (memory: MemoryStorage) => Promise<T>) =>
    Promise.all(memories.flatMap(memory => Array.from({ length: CALLS_PER_STORE }, () => fn(memory))));

  beforeAll(async () => {
    pool = new Pool({ connectionString });
    stores = Array.from(
      { length: STORE_COUNT },
      (_, i) => new PostgresStore({ ...TEST_CONFIG, id: `om-gen-${i}`, schemaName }),
    );
    await stores[0]!.init();
    await Promise.all(stores.slice(1).map(store => store.init()));
    memories = await Promise.all(stores.map(async store => (await store.getStore('memory'))!));
  });

  afterAll(async () => {
    await Promise.all(stores.map(store => store.close().catch(() => {})));
    await pool.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await pool.end();
  });

  it('creates one generation-0 record when many callers initialize at once', async () => {
    const resourceId = `resource-${randomUUID()}`;

    const records = await onEveryStore(memory => memory.initializeObservationalMemory(omInput(resourceId)));

    const rows = await rowsFor(resourceId);
    expect(rows).toHaveLength(1);
    expect(new Set(records.map(r => r.id))).toEqual(new Set([rows[0]!.id]));
  });

  it('creates one reflection generation when many callers reflect the same record at once', async () => {
    const resourceId = `resource-${randomUUID()}`;
    const initial = await memories[0]!.initializeObservationalMemory(omInput(resourceId));

    const records = await onEveryStore(memory =>
      memory.createReflectionGeneration({ currentRecord: initial, reflection: 'reflected', tokenCount: 10 }),
    );

    const rows = await rowsFor(resourceId);
    expect(rows.map(r => r.generationCount)).toEqual([0, 1]);
    expect(new Set(records.map(r => r.id))).toEqual(new Set([rows[1]!.id]));
  });

  it('activates a buffered reflection once when many callers swap at once', async () => {
    const resourceId = `resource-${randomUUID()}`;
    const initial = await memories[0]!.initializeObservationalMemory(omInput(resourceId));
    await memories[0]!.updateBufferedReflection({
      id: initial.id,
      reflection: 'buffered reflection',
      tokenCount: 10,
      inputTokenCount: 20,
      reflectedObservationLineCount: 0,
    });

    const records = await onEveryStore(memory =>
      memory.swapBufferedReflectionToActive({ currentRecord: initial, tokenCount: 10 }),
    );

    const rows = await rowsFor(resourceId);
    expect(rows.map(r => r.generationCount)).toEqual([0, 1]);
    expect(new Set(records.map(r => r.id))).toEqual(new Set([rows[1]!.id]));
    const active = await memories[0]!.getObservationalMemory(null, resourceId);
    expect(active?.activeObservations).toBe('buffered reflection');
  });

  it('keeps using one record when the database already holds duplicate generations', async () => {
    const resourceId = `resource-${randomUUID()}`;
    const duplicate = (id: string, createdAt: Date): ObservationalMemoryRecord => ({
      id,
      scope: 'resource',
      threadId: null,
      resourceId,
      createdAt,
      updatedAt: createdAt,
      lastObservedAt: undefined,
      originType: 'initial',
      generationCount: 0,
      activeObservations: '',
      totalTokensObserved: 0,
      observationTokenCount: 0,
      pendingMessageTokens: 0,
      isReflecting: false,
      isObserving: false,
      isBufferingObservation: false,
      isBufferingReflection: false,
      lastBufferedAtTokens: 0,
      lastBufferedAtTime: null,
      config: {},
    });
    // Rows left behind by the race before it was fixed. The later-created row is
    // stored first and has the smaller id, so neither storage order nor id picks
    // the earliest-created row by accident.
    const second = `a-${randomUUID()}`;
    const first = `b-${randomUUID()}`;
    await memories[0]!.insertObservationalMemoryRecord(duplicate(second, new Date('2026-01-02T00:00:00Z')));
    await memories[0]!.insertObservationalMemoryRecord(duplicate(first, new Date('2026-01-01T00:00:00Z')));

    expect((await memories[0]!.getObservationalMemory(null, resourceId))?.id).toBe(first);

    // Writing to the other duplicate must not change which record is active.
    await memories[0]!.updateActiveObservations({
      id: second,
      observations: 'written to the other duplicate',
      tokenCount: 5,
      lastObservedAt: new Date(),
    });
    expect((await memories[0]!.getObservationalMemory(null, resourceId))?.id).toBe(first);
    expect((await memories[0]!.getObservationalMemoryHistory(null, resourceId))[0]?.id).toBe(first);

    // Initializing again returns the existing record instead of adding a third row.
    expect((await memories[1]!.initializeObservationalMemory(omInput(resourceId))).id).toBe(first);
    expect(await rowsFor(resourceId)).toHaveLength(2);
  });
});
