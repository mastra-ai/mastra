import { randomUUID } from 'node:crypto';
import { createClient } from '@libsql/client';
import { EXPERIMENTS_SCHEMA, TABLE_EXPERIMENTS } from '@mastra/core/storage';
import { describe, expect, it } from 'vitest';
import { LibSQLDB } from '../../db';
import { ExperimentsLibSQL } from '.';

describe('experiments init relaxes legacy NOT NULL on target columns', () => {
  it('rebuilds the table without NOT NULL on targetType/targetId and keeps existing rows', async () => {
    const client = createClient({ url: ':memory:' });
    await new LibSQLDB({ client }).createTable({
      tableName: TABLE_EXPERIMENTS,
      schema: {
        ...EXPERIMENTS_SCHEMA,
        targetType: { type: 'text', nullable: false },
        targetId: { type: 'text', nullable: false },
      },
    });
    const experiments = new ExperimentsLibSQL({ client });
    const existing = await experiments.createExperiment({
      id: randomUUID(),
      datasetId: null,
      datasetVersion: null,
      targetType: 'agent',
      targetId: 'agent-1',
      totalItems: 1,
    });

    await experiments.init();

    const info = await client.execute(`PRAGMA table_info("${TABLE_EXPERIMENTS}")`);
    const notNull = info.rows
      .filter(row => row.name === 'targetType' || row.name === 'targetId')
      .map(row => Number(row.notnull));
    expect(notNull).toEqual([0, 0]);
    expect(await experiments.getExperimentById({ id: existing.id })).toMatchObject({
      targetType: 'agent',
      targetId: 'agent-1',
    });

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
    client.close();
  });
});
