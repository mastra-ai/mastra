import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { Pool } from 'pg';

// Exercise the exact documented SQL in session-local tables, without changing application rows.
const connectionString = process.env.DATABASE_URL;
assert.ok(connectionString, 'DATABASE_URL is required');
const readme = await readFile(new URL('../examples/editorial-review/README.md', import.meta.url), 'utf8');
const sql = readme
  .split('### Operator recovery for an interrupted reservation')[1]
  ?.match(/```sql\n([\s\S]*?)```/)?.[1];
assert.ok(sql, 'The operator recovery SQL must exist in the example README');
const pool = new Pool({ connectionString, max: 1 });
const connection = await pool.connect();
const workflowId = 'recovery-workflow';
// The included example uses its workflow ID as the persisted admission namespace.
const namespace = workflowId;

/** Execute the README transaction with parameterized equivalents of its explicit psql variables. */
async function recover(runId: string, selectedWorkflowId = workflowId) {
  const variables: Record<string, string> = { namespace, workflow_id: selectedWorkflowId, run_id: runId };
  const settled: unknown[] = [];
  try {
    for (const statement of sql!.split(';').filter(part => part.trim())) {
      const values: string[] = [];
      const query = statement.replace(/:'(namespace|workflow_id|run_id)'/g, (_match, key: string) => {
        values.push(variables[key]!);
        return `$${values.length}`;
      });
      const result = await connection.query(query, values);
      if (result.command === 'UPDATE') settled.push(...result.rows);
    }
    return settled;
  } catch (error) {
    await connection.query('ROLLBACK');
    throw error;
  }
}

try {
  await connection.query(`
    CREATE TEMP TABLE mastra_render_admissions (
      namespace text NOT NULL, run_id text NOT NULL, owner text NOT NULL, input_hash text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(), settled_at timestamptz,
      PRIMARY KEY (namespace, run_id)
    );
    CREATE TEMP TABLE mastra_render_runs (
      workflow_id text NOT NULL, run_id text NOT NULL, revision integer NOT NULL, record jsonb NOT NULL,
      PRIMARY KEY (workflow_id, run_id)
    );
  `);
  const cases: { name: string; record: Record<string, unknown> | null; expected: number }[] = [
    { name: 'absent', record: null, expected: 1 },
    { name: 'unbound-submitting', record: { status: 'submitting' }, expected: 1 },
    { name: 'unbound-unknown', record: { status: 'submission-unknown' }, expected: 1 },
    { name: 'bound-pending', record: { status: 'pending', providerId: 'native-run' }, expected: 0 },
    { name: 'bound-submitting', record: { status: 'submitting', providerId: 'native-run' }, expected: 0 },
    { name: 'claimed-submitting', record: { status: 'submitting', workerClaim: 'test-claim' }, expected: 0 },
    { name: 'claimed-running', record: { status: 'running', workerClaim: 'test-claim' }, expected: 0 },
    { name: 'unbound-running', record: { status: 'running' }, expected: 0 },
    { name: 'cancel-requested', record: { status: 'cancel-requested' }, expected: 0 },
    { name: 'completed', record: { status: 'success', result: { output: 'preserved' } }, expected: 0 },
    { name: 'missing-status', record: {}, expected: 0 },
    { name: 'unknown-status', record: { status: 'unrecognized' }, expected: 0 },
  ];
  for (const test of cases) {
    await connection.query(
      'INSERT INTO mastra_render_admissions(namespace,run_id,owner,input_hash) VALUES($1,$2,$3,$4),($5,$2,$3,$4)',
      [namespace, test.name, 'owner', 'input-hash', 'other-namespace'],
    );
    const unrelatedRunId = `${test.name}-other`;
    await connection.query(
      'INSERT INTO mastra_render_admissions(namespace,run_id,owner,input_hash) VALUES($1,$2,$3,$4)',
      [namespace, unrelatedRunId, 'owner', 'input-hash'],
    );
    if (test.record)
      await connection.query('INSERT INTO mastra_render_runs VALUES($1,$2,$3,$4)', [
        workflowId,
        test.name,
        7,
        JSON.stringify({ revision: 7, ...test.record }),
      ]);
    // A different workflow's native binding must neither authorize nor block this reservation.
    await connection.query('INSERT INTO mastra_render_runs VALUES($1,$2,$3,$4)', [
      'other-workflow',
      test.name,
      1,
      JSON.stringify({ status: 'running', providerId: 'unrelated-native-run' }),
    ]);
    const before = await connection.query('SELECT * FROM mastra_render_runs ORDER BY workflow_id,run_id');
    assert.equal(
      (await recover(test.name, 'wrong-workflow')).length,
      0,
      'A mismatched workflow must never release capacity',
    );
    assert.equal((await recover(test.name)).length, test.expected, test.name);
    assert.equal((await recover(test.name)).length, 0, 'Recovery must be idempotent');
    const after = await connection.query('SELECT * FROM mastra_render_runs ORDER BY workflow_id,run_id');
    assert.deepEqual(after.rows, before.rows, 'Recovery must preserve run records, revisions and results');
    const reservations = await connection.query(
      'SELECT namespace,owner,input_hash,settled_at FROM mastra_render_admissions WHERE run_id=$1',
      [test.name],
    );
    assert.equal(reservations.rowCount, 2, 'Retain reservations for idempotency and rate accounting');
    for (const row of reservations.rows) {
      assert.equal(row.owner, 'owner');
      assert.equal(row.input_hash, 'input-hash');
      assert.equal(row.settled_at !== null, row.namespace === namespace && test.expected === 1);
    }
    const unrelated = await connection.query(
      'SELECT settled_at FROM mastra_render_admissions WHERE namespace=$1 AND run_id=$2',
      [namespace, unrelatedRunId],
    );
    assert.equal(unrelated.rowCount, 1);
    assert.equal(unrelated.rows[0].settled_at, null, 'Another run in the same namespace must remain reserved');
    console.log(`PASS: recovery SQL ${test.name}`);
  }
} finally {
  await connection.query('ROLLBACK');
  connection.release(true);
  await pool.end();
}
