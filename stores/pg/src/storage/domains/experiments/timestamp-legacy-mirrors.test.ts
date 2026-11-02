import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

/**
 * Rows written before the mirrors were filled in carry the column's insert-time
 * default in `startedAtZ`/`completedAtZ` while the plain columns hold the real
 * run times. Reads derive the timestamp from the plain column, so those rows read
 * back correctly without a backfill at startup.
 */
describe('experiment reads ignore stale timestamp mirrors', () => {
  const schemaName = `ts_legacy_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const startedAt = new Date('2026-09-07T10:00:00.000Z');
  const completedAt = new Date('2026-09-07T10:02:30.000Z');
  const experimentId = randomUUID();
  const resultId = randomUUID();
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore({ ...TEST_CONFIG, schemaName } as typeof TEST_CONFIG);
    await store.init();

    const experiments = (await store.getStore('experiments'))!;
    await experiments.createExperiment({ id: experimentId, datasetId: null, datasetVersion: null, totalItems: 1 });
    await experiments.addExperimentResult({
      id: resultId,
      experimentId,
      itemId: 'item-1',
      itemDatasetVersion: 1,
      input: { q: 'hi' },
      output: { a: 'hello' },
      startedAt,
      completedAt,
      retryCount: 0,
      attempt: 0,
    } as never);

    // Whatever a pre-fix writer left behind: an insert-time value, or nothing.
    await store.db.none(
      `UPDATE "${schemaName}"."mastra_experiment_results"
          SET "startedAtZ" = NOW(), "completedAtZ" = NULL, "createdAtZ" = NOW()
        WHERE "id" = $1`,
      [resultId],
    );
    // The experiment itself finished its run; pre-fix mirrors say otherwise.
    await store.db.none(
      `UPDATE "${schemaName}"."mastra_experiments"
          SET "startedAt" = $2, "completedAt" = $3,
              "startedAtZ" = NOW(), "completedAtZ" = NOW(), "updatedAtZ" = NOW()
        WHERE "id" = $1`,
      [experimentId, startedAt.toISOString(), completedAt.toISOString()],
    );
  });

  afterAll(async () => {
    await store?.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await store?.close();
  });

  it('reads the run times from the plain timestamp columns', async () => {
    const experiments = (await store.getStore('experiments'))!;

    const experiment = await experiments.getExperimentById({ id: experimentId });
    expect(experiment!.startedAt?.toISOString()).toBe(startedAt.toISOString());
    expect(experiment!.completedAt?.toISOString()).toBe(completedAt.toISOString());

    const result = await experiments.getExperimentResultById({ id: resultId });
    expect(result!.startedAt.toISOString()).toBe(startedAt.toISOString());
    expect(result!.completedAt.toISOString()).toBe(completedAt.toISOString());
  });

  it('keeps list results and re-reads after an update on the same values', async () => {
    const experiments = (await store.getStore('experiments'))!;

    const { results } = await experiments.listExperimentResults({
      experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    expect(results[0]!.startedAt.toISOString()).toBe(startedAt.toISOString());
    expect(results[0]!.completedAt.toISOString()).toBe(completedAt.toISOString());

    const updated = await experiments.updateExperimentResult({ id: resultId, comment: 'reviewed' });
    expect(updated.comment).toBe('reviewed');
    expect(updated.startedAt.toISOString()).toBe(startedAt.toISOString());
    expect(updated.completedAt.toISOString()).toBe(completedAt.toISOString());
  });

  it('reads the plain columns under a non-UTC session', async () => {
    await store.db.none(`SET TIME ZONE 'America/New_York'`);
    try {
      const experiments = (await store.getStore('experiments'))!;
      const result = await experiments.getExperimentResultById({ id: resultId });
      expect(result!.startedAt.toISOString()).toBe(startedAt.toISOString());
      expect(result!.completedAt.toISOString()).toBe(completedAt.toISOString());
    } finally {
      await store.db.none(`SET TIME ZONE 'UTC'`);
    }
  });
});
