import { randomUUID } from 'node:crypto';
import { Spanner } from '@google-cloud/spanner';
import { EXPERIMENTS_SCHEMA, TABLE_EXPERIMENTS } from '@mastra/core/storage';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SpannerDB } from '../../db';
import { ExperimentsSpanner } from '.';

vi.setConfig({ testTimeout: 120_000, hookTimeout: 120_000 });

describe.skipIf(process.env.ENABLE_TESTS !== 'true')(
  'experiments init relaxes legacy NOT NULL on target columns',
  () => {
    process.env.SPANNER_EMULATOR_HOST ||= 'localhost:9010';
    const client = new Spanner({ projectId: process.env.SPANNER_PROJECT_ID || 'test-project' });
    const instanceId = `relax-nn-${randomUUID().slice(0, 8)}`;
    const instance = client.instance(instanceId);
    const database = instance.database('relax-not-null');

    beforeAll(async () => {
      const [, instanceOperation] = await client.createInstance(instanceId, {
        config: 'emulator-config',
        nodes: 1,
        displayName: instanceId,
      });
      await instanceOperation.promise();
      const [, operation] = await instance.createDatabase(database.id);
      await operation.promise();
    });

    afterAll(async () => {
      try {
        await database.close();
        await instance.delete();
      } finally {
        await client.close();
      }
    });

    it('drops NOT NULL on targetType/targetId left by older schemas', async () => {
      await new SpannerDB({ database }).createTable({
        tableName: TABLE_EXPERIMENTS,
        schema: {
          ...EXPERIMENTS_SCHEMA,
          targetType: { type: 'text', nullable: false },
          targetId: { type: 'text', nullable: false },
        },
      });

      const experiments = new ExperimentsSpanner({ database });
      await experiments.init();

      const [rows] = await database.run({
        sql: `SELECT IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = '' AND TABLE_NAME = @tableName AND COLUMN_NAME IN ('targetType', 'targetId')`,
        params: { tableName: TABLE_EXPERIMENTS },
        json: true,
      });
      expect((rows as Array<{ IS_NULLABLE: string }>).map(row => row.IS_NULLABLE)).toEqual(['YES', 'YES']);

      const experiment = await experiments.createExperiment({
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
  },
);
