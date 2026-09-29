import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { init, createPostgresPersistence } from '../src/index.js';
import { updateRun, type RunRecord } from '../src/persistence/types.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const store = createPostgresPersistence({ connectionString, max: 4 });
const other = createPostgresPersistence({ connectionString, max: 4 });
const sql = new Pool({ connectionString, max: 1 });
sql.on('error', () => console.error('Polling smoke database connection failed'));
const id = randomUUID();
const initial: RunRecord = {
  workflowId: 'polling-smoke',
  runId: id,
  buildId: 'test',
  manifest: 'test',
  providerId: 'synthetic-native',
  revision: 0,
  status: 'running',
  input: { text: 'x'.repeat(1000000) },
  initialState: {},
  createdAt: 1,
  updatedAt: 1,
};
const transport = {
  start: async () => {
    throw new Error('This check must not submit a native task');
  },
  get: async (id: string) => ({ id, status: 'running' as const }),
  cancel: async () => {},
};
const a = init({ workflowSlug: 'test', buildId: 'test', persistence: store, transport }).provider;
const b = init({ workflowSlug: 'test', buildId: 'test', persistence: other, transport }).provider;
const row = async () =>
  (
    await sql.query(
      'SELECT xmin::text AS transaction,revision,record FROM mastra_render_runs WHERE workflow_id=$1 AND run_id=$2',
      [initial.workflowId, id],
    )
  ).rows[0];
try {
  assert.equal(await store.create(initial), true);
  const before = await row();
  await Promise.all(Array.from({ length: 40 }, (_, i) => (i % 2 ? a : b).getRun(initial.workflowId, id)));
  assert.deepEqual(await row(), before, 'Unchanged polls must not issue even an equivalent PostgreSQL UPDATE');
  await Promise.all([
    ...Array.from({ length: 20 }, () => a.getRun(initial.workflowId, id)),
    updateRun(other, initial.workflowId, id, () => ({
      status: 'success',
      result: { value: 42 },
      dispatchClosed: true,
    })),
  ]);
  const completed = await row();
  assert.equal(completed.revision, 1);
  assert.equal(completed.record.status, 'success');
  assert.notEqual(completed.transaction, before.transaction);
  await updateRun(store, initial.workflowId, id, () => ({ status: 'running' }));
  assert.deepEqual(await row(), completed, 'A late poll must not modify terminal state');
  console.log('PASS: 40 PostgreSQL polls make zero row updates; concurrent completion writes once and stays terminal');
} finally {
  await sql.query('DELETE FROM mastra_render_runs WHERE workflow_id=$1 AND run_id=$2', [initial.workflowId, id]);
  await Promise.all([store.close(), other.close(), sql.end()]);
}
