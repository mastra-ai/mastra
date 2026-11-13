import sql from 'mssql';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WorkflowsMSSQL } from '.';

/**
 * Two first writes of a run can both take MERGE's `WHEN NOT MATCHED`; the
 * loser fails with a duplicate key or as a deadlock victim. These tests stand
 * in for that loser: its first MERGE fails with the server's error, and the
 * retry must run the MERGE again instead of throwing.
 */
describe('MSSQL persistWorkflowSnapshot: losing a concurrent first write', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function storeWhoseFirstMergeFails(errorNumber: number) {
    const pool = new sql.ConnectionPool({ server: 'localhost', user: 'sa', password: 'unused' });
    const query = vi
      .fn<sql.Request['query']>()
      .mockRejectedValueOnce(Object.assign(new Error(`SQL Server error ${errorNumber}`), { number: errorNumber }))
      .mockResolvedValue({ recordsets: [], recordset: [], output: {}, rowsAffected: [1] });
    vi.spyOn(pool, 'request').mockImplementation(() => {
      const request = new sql.Request(pool);
      request.query = query;
      return request;
    });
    return { store: new WorkflowsMSSQL({ pool }), query };
  }

  function persist(store: WorkflowsMSSQL) {
    return store.persistWorkflowSnapshot({
      workflowName: 'race',
      runId: 'run-1',
      snapshot: {
        runId: 'run-1',
        status: 'running',
        value: {},
        context: {},
        activePaths: [],
        serializedStepGraph: [],
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      },
      expectedStatus: ['running', 'success'],
    });
  }

  it.each([
    ['primary key violation', 2627],
    ['unique index violation', 2601],
    ['deadlock victim', 1205],
  ])('retries the write after a %s', async (_name, errorNumber) => {
    const { store, query } = storeWhoseFirstMergeFails(errorNumber);

    await expect(persist(store)).resolves.toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    const { store, query } = storeWhoseFirstMergeFails(208);

    await expect(persist(store)).rejects.toThrow();
    expect(query).toHaveBeenCalledTimes(1);
  });
});
