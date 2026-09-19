import { randomUUID } from 'node:crypto';
import { createEmptyWorkflowSnapshot, WorkflowsStorage } from '@mastra/core/storage';
import type { WorkflowRunState } from '@mastra/core/workflows';
import { Pool, types } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { WorkflowsPG } from '.';

const connection = {
  host: process.env.POSTGRES_HOST || '127.0.0.1',
  port: Number(process.env.POSTGRES_PORT) || 5434,
  database: process.env.POSTGRES_DB || 'postgres',
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
};

const SNAPSHOT_COLUMN_TYPES = ['jsonb', 'json', 'text'] as const;
type SnapshotColumnType = (typeof SNAPSHOT_COLUMN_TYPES)[number];

const rawJsonbTypes = {
  getTypeParser(oid: number, format?: 'text' | 'binary') {
    return oid === 3802 ? (value: string) => value : types.getTypeParser(oid, format);
  },
};

describe('WorkflowsPG compact execution state', () => {
  const pool = new Pool(connection);
  const readPool = new Pool(connection);
  const schemas = new Set<string>();

  beforeAll(async () => {
    await pool.query('SELECT 1');
    await readPool.query('SELECT 1');
  });

  afterAll(async () => {
    try {
      for (const schema of schemas) {
        await pool.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      }
    } finally {
      await Promise.all([pool.end(), readPool.end()]);
    }
  });

  async function createSchema(snapshotColumnType: SnapshotColumnType): Promise<string> {
    const schema = `pf4240_${snapshotColumnType}_${randomUUID().replaceAll('-', '').slice(0, 12)}`;
    await pool.query(`CREATE SCHEMA "${schema}"`);
    schemas.add(schema);
    return schema;
  }

  function snapshot(runId: string, executionGeneration?: string): WorkflowRunState {
    return {
      ...createEmptyWorkflowSnapshot(runId),
      status: 'suspended',
      ...(executionGeneration === undefined ? {} : { executionGeneration }),
      value: { payload: 'x'.repeat(64 * 1024) },
    };
  }

  it.each(SNAPSHOT_COLUMN_TYPES)('projects status and generation from %s snapshots', async snapshotColumnType => {
    const schema = await createSchema(snapshotColumnType);
    const initializer = new WorkflowsPG({ pool, schemaName: schema, skipDefaultIndexes: true });
    await initializer.init();
    if (snapshotColumnType !== 'jsonb') {
      await pool.query(
        `ALTER TABLE "${schema}"."mastra_workflow_snapshot"
         ALTER COLUMN snapshot TYPE ${snapshotColumnType}
         USING snapshot::${snapshotColumnType}`,
      );
    }

    const readQuery = vi.spyOn(readPool, 'query').mockRejectedValue(new Error('compact read used replica'));
    const workflows = new WorkflowsPG({ pool, readPool, schemaName: schema, skipDefaultIndexes: true });
    const workflowName = `compact-state-${snapshotColumnType}`;
    const runId = randomUUID();
    const generation = `wfeg:pf4240:${snapshotColumnType}`;
    const writerQuery = vi.spyOn(pool, 'query');

    try {
      await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: snapshot(runId, generation) });

      const baseExecutionState = () =>
        WorkflowsStorage.prototype.getWorkflowExecutionState.call(workflows, { workflowName, runId });
      const expected = await baseExecutionState();
      writerQuery.mockClear();
      const compact = await workflows.getWorkflowExecutionState({ workflowName, runId });
      expect(compact).toEqual(expected);
      expect(readQuery).not.toHaveBeenCalled();

      const compactCalls = writerQuery.mock.calls.filter(([, values]) => {
        return Array.isArray(values) && values[0] === workflowName && values[1] === runId;
      });
      expect(compactCalls).toHaveLength(1);
      if (snapshotColumnType === 'jsonb') {
        expect(compactCalls[0]?.[0]).toContain("->'status'");
        expect(compactCalls[0]?.[0]).toContain("->'executionGeneration'");
        expect(compactCalls[0]?.[0]).not.toContain('SELECT *');
      } else {
        expect(compactCalls[0]?.[0]).toContain('SELECT *');
      }

      const withoutGeneration = snapshot(runId);
      await workflows.persistWorkflowSnapshot({ workflowName, runId, snapshot: withoutGeneration });
      const expectedWithoutGeneration = await baseExecutionState();
      await expect(workflows.getWorkflowExecutionState({ workflowName, runId })).resolves.toEqual(
        expectedWithoutGeneration,
      );

      await workflows.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: { ...snapshot(runId, generation), executionGeneration: null } as unknown as WorkflowRunState,
      });
      const expectedExplicitNull = await baseExecutionState();
      await expect(workflows.getWorkflowExecutionState({ workflowName, runId })).resolves.toEqual(expectedExplicitNull);

      await expect(
        workflows.getWorkflowExecutionState({ workflowName, runId: 'missing-compact-execution-state' }),
      ).resolves.toBeNull();

      const serializedSnapshot = JSON.stringify({
        status: 'running',
        executionGeneration: generation,
        value: { payload: '\u0000' },
      });
      await pool.query(
        `UPDATE "${schema}"."mastra_workflow_snapshot" SET snapshot = $1
         WHERE workflow_name = $2 AND run_id = $3`,
        [snapshotColumnType === 'text' ? serializedSnapshot : JSON.stringify(serializedSnapshot), workflowName, runId],
      );
      const expectedSerialized = await baseExecutionState();
      await expect(workflows.getWorkflowExecutionState({ workflowName, runId })).resolves.toEqual(expectedSerialized);

      await pool.query(
        `UPDATE "${schema}"."mastra_workflow_snapshot" SET snapshot = $1
         WHERE workflow_name = $2 AND run_id = $3`,
        [
          snapshotColumnType === 'text' ? 'not a serialized snapshot' : JSON.stringify('not a serialized snapshot'),
          workflowName,
          runId,
        ],
      );
      await expect(baseExecutionState()).rejects.toThrow();
      await expect(workflows.getWorkflowExecutionState({ workflowName, runId })).rejects.toThrow();

      for (const falsySnapshot of ['false', '0', 'null']) {
        await pool.query(
          `UPDATE "${schema}"."mastra_workflow_snapshot" SET snapshot = $1
          WHERE workflow_name = $2 AND run_id = $3`,
          [falsySnapshot, workflowName, runId],
        );
        const expectedFalsy = await baseExecutionState();
        await expect(workflows.getWorkflowExecutionState({ workflowName, runId })).resolves.toEqual(expectedFalsy);
      }

      await pool.query(
        `UPDATE "${schema}"."mastra_workflow_snapshot" SET snapshot = $1
         WHERE workflow_name = $2 AND run_id = $3`,
        ['""', workflowName, runId],
      );
      if (snapshotColumnType === 'text') {
        const expectedEmpty = await baseExecutionState();
        await expect(workflows.getWorkflowExecutionState({ workflowName, runId })).resolves.toEqual(expectedEmpty);
      } else {
        await expect(baseExecutionState()).rejects.toThrow();
        await expect(workflows.getWorkflowExecutionState({ workflowName, runId })).rejects.toThrow();
      }
    } finally {
      writerQuery.mockRestore();
      readQuery.mockRestore();
    }
  });

  it('preserves compact values when a configured pool returns raw JSONB text', async () => {
    const schema = await createSchema('jsonb');
    const rawJsonbPool = new Pool({ ...connection, types: rawJsonbTypes });
    const initializer = new WorkflowsPG({ pool, schemaName: schema, skipDefaultIndexes: true });
    const workflows = new WorkflowsPG({ pool: rawJsonbPool, schemaName: schema, skipDefaultIndexes: true });
    const workflowName = 'compact-state-raw-jsonb';
    const runId = randomUUID();

    try {
      await initializer.init();
      await workflows.persistWorkflowSnapshot({
        workflowName,
        runId,
        snapshot: snapshot(runId, 'wfeg:pf4240:raw-jsonb'),
      });

      const expected = await WorkflowsStorage.prototype.getWorkflowExecutionState.call(workflows, {
        workflowName,
        runId,
      });
      await expect(workflows.getWorkflowExecutionState({ workflowName, runId })).resolves.toEqual(expected);
    } finally {
      await rawJsonbPool.end();
    }
  });

  it('propagates writer query failures', async () => {
    const failingPool = new Pool(connection);
    await failingPool.end();
    const workflows = new WorkflowsPG({ pool: failingPool, schemaName: 'pf4240_failure', skipDefaultIndexes: true });

    await expect(workflows.getWorkflowExecutionState({ workflowName: 'failure', runId: 'run' })).rejects.toThrow();
  });
});
