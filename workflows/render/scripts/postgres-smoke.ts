import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createPostgresPersistence } from '../src/index.js';
import { updateRun, type RunRecord } from '../src/persistence/types.js';
const a = createPostgresPersistence({ connectionString: process.env.DATABASE_URL, max: 2 });
const b = createPostgresPersistence({ connectionString: process.env.DATABASE_URL, max: 2 });
const initial: RunRecord = {
  workflowId: 'postgres-proof',
  runId: randomUUID(),
  buildId: 'v1',
  manifest: 'hash',
  revision: 0,
  status: 'submitting',
  input: 1,
  initialState: {},
  createdAt: Date.now(),
  updatedAt: Date.now(),
};
try {
  assert.equal(await a.create(initial), true);
  assert.equal(await b.create(initial), false);
  await Promise.all([
    updateRun(a, initial.workflowId, initial.runId, () => ({ providerId: 'native-proof' })),
    updateRun(b, initial.workflowId, initial.runId, () => ({ workerClaim: 'worker-proof', status: 'running' })),
  ]);
  assert.deepEqual(await a.get(initial.workflowId, initial.runId), await b.get(initial.workflowId, initial.runId));
  assert.equal((await b.get(initial.workflowId, initial.runId))?.revision, 2);
  assert.equal(await a.compareAndSwap({ ...initial, status: 'failed', revision: 1 }, 0), false);
  await updateRun(a, initial.workflowId, initial.runId, () => ({ status: 'success' }));
  assert.equal(
    (await updateRun(b, initial.workflowId, initial.runId, () => ({ status: 'running' }))).status,
    'success',
  );
  console.log(
    'PASS: PostgreSQL unique creation, competing CAS updates, stale revision rejection and terminal stability',
  );
} finally {
  await a.close();
  await b.close();
}
