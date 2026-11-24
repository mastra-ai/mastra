import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PostgresStore } from '../..';
import { TEST_CONFIG } from '../../test-utils';

describe('experiments init relaxes legacy NOT NULL on target columns', () => {
  const schemaName = `relax_nn_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
  let store: PostgresStore;

  beforeAll(async () => {
    store = new PostgresStore({ ...TEST_CONFIG, schemaName } as typeof TEST_CONFIG);
    await store.init();
  });

  afterAll(async () => {
    await store?.db.none(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    await store?.close();
  });

  it('drops NOT NULL on targetType/targetId left by older schemas', async () => {
    await store.db.none(
      `ALTER TABLE "${schemaName}".mastra_experiments ALTER COLUMN "targetType" SET NOT NULL, ALTER COLUMN "targetId" SET NOT NULL`,
    );

    const experiments = await store.getStore('experiments');
    await experiments!.init();

    const rows = await store.db.any<{ column_name: string; is_nullable: string }>(
      `SELECT column_name, is_nullable FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = 'mastra_experiments'
         AND column_name IN ('targetType', 'targetId')`,
      [schemaName],
    );
    expect(rows.map(r => r.is_nullable)).toEqual(['YES', 'YES']);

    const experiment = await experiments!.createExperiment({
      id: randomUUID(),
      datasetId: null,
      datasetVersion: null,
      targetType: null,
      targetId: null,
      totalItems: 1,
    });
    expect(experiment.targetType).toBeNull();
    expect(experiment.targetId).toBeNull();
  });
});
