import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { ClientError, ServerError } from '@renderinc/sdk';
import { createPostgresPersistence, init, type RunRecord } from '../src/index.js';
import { createAdmission, AdmissionError, type Admission } from '../examples/editorial-review/admission.js';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is required');
const namespace = `admission-recovery-${randomUUID()}`;
const pool = new Pool({ connectionString });
const persistence = createPostgresPersistence({ connectionString });
const clients: Admission[] = [];
let repaired = false;
let outage = false;
let outageObserved = false;
const { provider } = init({
  workflowSlug: 'synthetic-admission-recovery',
  buildId: 'test',
  persistence,
  transport: {
    async start() {
      throw new Error('This check must never submit a native task');
    },
    async cancel() {
      throw new Error('This check must never cancel a native task');
    },
    async get(id) {
      if (id === 'outage' && outage) {
        outageObserved = true;
        throw new ServerError('synthetic provider outage', 503);
      }
      if (id === '000' && !repaired) throw new ClientError('synthetic missing task', 404);
      if (id === '001' && !repaired) return { id, status: 'completed', results: [] };
      if (id === 'outage') return { id, status: 'running' };
      return { id, status: 'completed', results: [{ status: 'success', result: { synthetic: true } }] };
    },
  },
});
const make = (interval: number) => {
  const client = createAdmission({
    connectionString,
    namespace,
    reconciliationIntervalMs: interval,
    limits: { globalActive: 104, ownerActive: 2, globalSubmissions: 500, ownerSubmissions: 10 },
    getStatus: async id => (await provider.getRun(namespace, id))?.status ?? null,
  });
  clients.push(client);
  return client;
};
/** Seed only isolated synthetic provider records; never invoke native scheduling. */
async function seed(id: string) {
  const record: RunRecord = {
    workflowId: namespace,
    runId: id,
    providerId: id,
    revision: 0,
    status: 'running',
    buildId: 'test',
    manifest: 'test',
    input: {},
    initialState: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  assert.equal(await persistence.create(record), true);
}
/** Wait for the independent background refresh using database evidence. */
async function until(check: () => Promise<boolean>) {
  const deadline = Date.now() + 5000;
  while (!(await check())) {
    assert.ok(Date.now() < deadline, 'Background recovery did not finish');
    await new Promise(resolve => setTimeout(resolve, 10));
  }
}
const rejected = (status: number) => (error: unknown) => error instanceof AdmissionError && error.status === status;
try {
  const setup = make(60000);
  for (let i = 0; i < 102; i++) {
    const id = String(i).padStart(3, '0');
    await setup.reserve(id, i < 2 ? 'bad-record-owner' : `owner-${i}`, {});
    await seed(id);
  }
  await setup.close();
  const before = await Promise.all(['000', '001'].map(id => persistence.get(namespace, id)));
  const admission = make(25);
  await until(
    async () =>
      Number(
        (
          await pool.query(
            'SELECT count(*) FROM mastra_render_admissions WHERE namespace=$1 AND settled_at IS NOT NULL',
            [namespace],
          )
        ).rows[0].count,
      ) === 100,
  );
  assert.deepEqual(await Promise.all(['000', '001'].map(id => persistence.get(namespace, id))), before);
  assert.equal(await admission.reserve('new-owner', 'new-owner', {}), true);
  await assert.rejects(admission.reserve('owner-cap', 'bad-record-owner', {}), rejected(429));
  assert.equal(await admission.reserve('000', 'bad-record-owner', {}), false);
  await assert.rejects(admission.reserve('000', 'another-owner', {}), rejected(409));
  await assert.rejects(admission.reserve('000', 'bad-record-owner', { changed: true }), rejected(409));
  console.log(
    'PASS: actual provider 404/protocol failures retain reservations, preserve quotas and ownership, and allow later batches and unrelated admissions',
  );

  repaired = true;
  await until(
    async () =>
      Number(
        (
          await pool.query(
            'SELECT count(*) FROM mastra_render_admissions WHERE namespace=$1 AND settled_at IS NOT NULL',
            [namespace],
          )
        ).rows[0].count,
      ) === 102,
  );
  assert.equal((await persistence.get(namespace, '000'))?.status, 'success');
  assert.equal((await persistence.get(namespace, '001'))?.status, 'success');
  assert.equal(await admission.reserve('owner-recovered', 'bad-record-owner', {}), true);
  console.log('PASS: corrected provider records are revisited and terminal evidence releases their capacity');

  await admission.reserve('outage', 'outage-owner', {});
  await seed('outage');
  outage = true;
  await until(async () => outageObserved);
  await new Promise(resolve => setTimeout(resolve, 10));
  await assert.rejects(admission.reserve('outage-denied', 'another-owner', {}), rejected(503));
  assert.equal(await admission.reserve('outage', 'outage-owner', {}), false);
  assert.equal((await persistence.get(namespace, 'outage'))?.status, 'running');
  await admission.close();
  outage = false;
  const recovered = make(25);
  await until(async () => {
    const record = await persistence.get(namespace, 'outage');
    return record!.revision > 0;
  });
  assert.equal(await recovered.reserve('after-outage', 'another-owner', {}), true);
  console.log(
    'PASS: provider outage denies new work, preserves duplicate reconnects and active run state, and recovers after restart',
  );
} finally {
  await Promise.all(clients.map(client => client.close()));
  await pool.query('DELETE FROM mastra_render_admissions WHERE namespace=$1', [namespace]);
  await pool.query('DELETE FROM mastra_render_runs WHERE workflow_id=$1', [namespace]);
  await persistence.close();
  await pool.end();
}
