import { describe, expect, it, vi } from 'vitest';
import { MySQLStore } from './index';
import type { MySQLStoreConfig } from './index';

const TEST_CONFIG: MySQLStoreConfig = {
  host: process.env.MYSQL_HOST || 'localhost',
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER || 'mastra',
  password: process.env.MYSQL_PASSWORD || 'mastra',
  database: process.env.MYSQL_DB || 'mastra',
  max: 10,
};

vi.setConfig({ testTimeout: 60_000, hookTimeout: 60_000 });

/**
 * The result writer runs under REPEATABLE READ: its first plain read (the experiment's datasetId)
 * fixes the snapshot. This pauses the writer right after that read, runs a full purge to
 * completion, then lets the writer continue. The writer must still see the purge marker.
 */
async function pauseAfterSnapshotRead(experiments: unknown) {
  const pool = (experiments as { pool: { getConnection: () => Promise<any> } }).pool;
  const original = pool.getConnection.bind(pool);
  let reached!: () => void;
  let release!: () => void;
  const snapshotTaken = new Promise<void>(resolve => (reached = resolve));
  const gate = new Promise<void>(resolve => (release = resolve));
  let armed = true;
  const spy = vi.spyOn(pool, 'getConnection').mockImplementation(async () => {
    const connection = await original();
    if (!armed) return connection;
    armed = false;
    const execute = connection.execute.bind(connection);
    let paused = false;
    connection.execute = async (...args: unknown[]) => {
      const result = await (execute as (...a: unknown[]) => Promise<unknown>)(...args);
      if (!paused && String(args[0]).includes('FROM `mastra_experiments`')) {
        paused = true;
        reached();
        await gate;
      }
      return result;
    };
    return connection;
  });
  return { snapshotTaken, release, restore: () => spy.mockRestore() };
}

describe('purge barrier snapshot', () => {
  it.each(['addExperimentResult', 'upsertExperimentResult'] as const)(
    '%s keeps a purged item redacted when the purge commits after the writer took its snapshot',
    async method => {
      const store = new MySQLStore({ ...TEST_CONFIG, id: `mysql-purge-barrier-${method}` });
      try {
        await store.init();
        const datasets = store.stores.datasets!;
        const experiments = store.stores.experiments!;

        const dataset = await datasets.createDataset({ name: `purge-barrier-${method}` });
        const item = await datasets.addItem({ datasetId: dataset.id, input: { patient: 'Alice' } });
        const experiment = await experiments.createExperiment({
          name: `purge-barrier-${method}`,
          datasetId: dataset.id,
          datasetVersion: item.datasetVersion,
          targetType: 'agent',
          targetId: 'agent-1',
          totalItems: 1,
        });
        const submission = {
          experimentId: experiment.id,
          itemId: item.id,
          itemDatasetVersion: item.datasetVersion,
          input: { patient: 'Alice' },
          output: { diagnosis: 'secret' },
          groundTruth: { expected: 'private' },
          metadata: { note: 'private' },
          error: { message: 'Patient Alice failed' },
          startedAt: new Date(),
          completedAt: new Date(),
          retryCount: 0,
          attempt: 0,
        };

        const pause = await pauseAfterSnapshotRead(experiments);
        const write = experiments[method](submission);
        await pause.snapshotTaken;
        await datasets.purgeItem({ id: item.id, datasetId: dataset.id });
        pause.release();
        await write;
        pause.restore();

        const listed = await experiments.listExperimentResults({
          experimentId: experiment.id,
          pagination: { page: 0, perPage: 10 },
        });
        expect(listed.results).toHaveLength(1);
        expect(listed.results[0]).toMatchObject({
          input: null,
          output: null,
          groundTruth: null,
          metadata: { __purged: true },
          error: null,
        });
      } finally {
        await store.close();
      }
    },
  );
});
