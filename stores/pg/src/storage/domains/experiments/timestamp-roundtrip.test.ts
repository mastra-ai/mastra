import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

// Regression for experiment results reading back with insert-time timestamps.
// Postgres creates a timestamptz `"<column>Z"` mirror per timestamp column with
// `DEFAULT NOW()`, and the domain's reads prefer the mirror. A write that only
// sets `startedAt`/`completedAt` therefore leaves the mirror at insert time, so
// `completedAt - startedAt` collapses to 0.
describe('experiment timestamps survive a real round trip', () => {
  const schemaName = `ts_roundtrip_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  const startedAt = new Date('2026-09-07T10:00:00.000Z');
  const completedAt = new Date('2026-09-07T10:02:30.000Z');
  const rewrittenStartedAt = new Date('2026-09-07T11:00:00.000Z');
  const rewrittenCompletedAt = new Date('2026-09-07T11:02:30.000Z');
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore({ ...TEST_CONFIG, schemaName } as typeof TEST_CONFIG);
    await store.init();
  });

  afterAll(async () => {
    await store?.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await store?.close();
  });

  it('reads back the real startedAt/completedAt of a result and its experiment', async () => {
    const experiments = (await store.getStore('experiments'))!;
    const experimentId = randomUUID();
    await experiments.createExperiment({
      id: experimentId,
      datasetId: null,
      datasetVersion: null,
      totalItems: 1,
    });
    await experiments.updateExperiment({
      id: experimentId,
      status: 'completed',
      startedAt,
      completedAt,
      succeededCount: 1,
      failedCount: 0,
    });

    const experiment = await experiments.getExperimentById({ id: experimentId });
    expect(experiment!.startedAt?.toISOString()).toBe(startedAt.toISOString());
    expect(experiment!.completedAt?.toISOString()).toBe(completedAt.toISOString());

    await experiments.addExperimentResult({
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

    const { results } = await experiments.listExperimentResults({
      experimentId,
      pagination: { page: 0, perPage: 10 },
    });
    expect(results[0]!.startedAt.toISOString()).toBe(startedAt.toISOString());
    expect(results[0]!.completedAt.toISOString()).toBe(completedAt.toISOString());

    const inserted = await experiments.upsertExperimentResult({
      experimentId,
      itemId: 'item-2',
      itemDatasetVersion: 1,
      input: null,
      output: { a: 'hey' },
      startedAt,
      completedAt,
      retryCount: 0,
      attempt: 0,
    } as never);
    expect(inserted.startedAt.toISOString()).toBe(startedAt.toISOString());
    expect(inserted.completedAt.toISOString()).toBe(completedAt.toISOString());

    const rewritten = await experiments.upsertExperimentResult({
      experimentId,
      itemId: 'item-2',
      itemDatasetVersion: 1,
      input: null,
      output: { a: 'hey!' },
      startedAt: rewrittenStartedAt,
      completedAt: rewrittenCompletedAt,
      retryCount: 1,
      attempt: 0,
    } as never);
    // The second upsert takes the UPDATE path; the returned row must carry the
    // new run times, not the ones stored by the first (insert) call.
    expect(rewritten.startedAt.toISOString()).toBe(rewrittenStartedAt.toISOString());
    expect(rewritten.completedAt.toISOString()).toBe(rewrittenCompletedAt.toISOString());
  });
});
