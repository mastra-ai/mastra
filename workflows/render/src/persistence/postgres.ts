import { Pool } from 'pg';
import type { PoolConfig } from 'pg';
import type { RenderPersistence, RunRecord } from './types.js';

/** Owns only the mastra_render_runs table. Mastra snapshots use the application's Mastra store. */
export function createPostgresPersistence(config: PoolConfig): RenderPersistence {
  const pool = new Pool(config);
  pool.on('error', error => {
    console.error('[mastra-render] Idle PostgreSQL client failed; the pool will replace it:', error.message);
  });
  let ready: Promise<unknown> | undefined;
  const initialize = () =>
    (ready ??= pool
      .query(
        `
    CREATE TABLE IF NOT EXISTS mastra_render_runs (
      workflow_id text NOT NULL,
      run_id text NOT NULL,
      revision integer NOT NULL,
      record jsonb NOT NULL,
      PRIMARY KEY (workflow_id, run_id)
    )`,
      )
      .catch(error => {
        ready = undefined;
        throw error;
      }));
  return {
    durable: true,
    /** Insert a run only if its workflow/run identity has never been reserved. */
    async create(record) {
      await initialize();
      const result = await pool.query(
        'INSERT INTO mastra_render_runs (workflow_id,run_id,revision,record) VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING',
        [record.workflowId, record.runId, record.revision, JSON.stringify(record)],
      );
      return result.rowCount === 1;
    },
    /** Read the persisted binding, returning null when the identity does not exist. */
    async get(workflowId, runId) {
      await initialize();
      const result = await pool.query<{ record: RunRecord }>(
        'SELECT record FROM mastra_render_runs WHERE workflow_id=$1 AND run_id=$2',
        [workflowId, runId],
      );
      return result.rows[0]?.record ?? null;
    },
    /** Persist a new revision only while the stored revision still matches the caller's expectation. */
    async compareAndSwap(record, expectedRevision) {
      await initialize();
      const result = await pool.query(
        'UPDATE mastra_render_runs SET revision=$3, record=$4 WHERE workflow_id=$1 AND run_id=$2 AND revision=$5',
        [record.workflowId, record.runId, record.revision, JSON.stringify(record), expectedRevision],
      );
      return result.rowCount === 1;
    },
    /** Release this persistence instance's PostgreSQL pool. */
    async close() {
      await pool.end();
    },
  };
}
