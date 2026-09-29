import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { createAdmission, AdmissionError, type Admission } from '../examples/editorial-review/admission.js';

const connectionString = process.env.DATABASE_URL!;
if (!connectionString) throw new Error('DATABASE_URL is required');
const pool = new Pool({ connectionString });
const clients: Admission[] = [];
const namespaces: string[] = [];
const states = new Map<string, string>();
const make = (namespace: string, limits: Parameters<typeof createAdmission>[0]['limits'] = {}) => {
  namespaces.push(namespace);
  const client = createAdmission({
    connectionString,
    namespace,
    limits,
    getStatus: async runId => states.get(runId) ?? null,
  });
  clients.push(client);
  return client;
};
const rejected = (status: number) => (error: unknown) => error instanceof AdmissionError && error.status === status;
try {
  const namespace = `admission-test-${randomUUID()}`;
  const limits = { globalActive: 2, ownerActive: 2, ownerSubmissions: 100, globalSubmissions: 100 };
  const a = make(namespace, limits),
    b = make(namespace, limits);
  const results = await Promise.allSettled(
    Array.from({ length: 8 }, (_, index) =>
      (index % 2 ? a : b).reserve(`run-${index}`, `owner-${index}`, { draft: 'synthetic' }),
    ),
  );
  assert.equal(results.filter(item => item.status === 'fulfilled').length, 2);
  for (const item of results) if (item.status === 'rejected') assert.ok(rejected(429)(item.reason));
  const rows = await pool.query('SELECT run_id,owner FROM mastra_render_admissions WHERE namespace=$1', [namespace]);
  assert.equal(rows.rowCount, 2);
  const first = rows.rows[0];
  assert.equal(await a.reserve(first.run_id, first.owner, { draft: 'synthetic' }), false);
  await assert.rejects(a.reserve(first.run_id, 'wrong-owner', { draft: 'synthetic' }), rejected(409));
  await assert.rejects(a.reserve(first.run_id, first.owner, { draft: 'changed' }), rejected(409));
  const restarted = make(namespace, limits);
  await assert.rejects(restarted.reserve('after-restart', 'another-owner', {}), rejected(429));
  states.set(first.run_id, 'cancel-requested');
  await assert.rejects(a.reserve('while-canceling', 'another-owner', {}), rejected(429));
  states.set(first.run_id, 'submission-unknown');
  await assert.rejects(a.reserve('while-unknown', 'another-owner', {}), rejected(429));
  states.set(first.run_id, 'canceled');
  assert.equal(await a.reserve('after-cancel', 'another-owner', {}), true);
  console.log(
    'PASS: atomic global admission across pools, ownership/input conflicts, restart, uncertain/canceling holds, terminal release',
  );

  const duplicates = `duplicates-${randomUUID()}`;
  const d1 = make(duplicates),
    d2 = make(duplicates);
  const same = await Promise.all(Array.from({ length: 8 }, (_, i) => (i % 2 ? d1 : d2).reserve('same', 'alice', {})));
  assert.equal(same.filter(Boolean).length, 1);
  console.log('PASS: concurrent duplicate requests reserve once');

  const rateNamespace = `rate-${randomUUID()}`;
  const rate = make(rateNamespace, { ownerSubmissions: 1, globalSubmissions: 2 });
  await rate.reserve('a1', 'alice', {});
  states.set('a1', 'success');
  await assert.rejects(rate.reserve('a2', 'alice', {}), rejected(429));
  await rate.reserve('b1', 'bob', {});
  states.set('b1', 'failed');
  await assert.rejects(rate.reserve('c1', 'carol', {}), rejected(429));
  await pool.query("UPDATE mastra_render_admissions SET created_at=now()-interval '2 hours' WHERE namespace=$1", [
    rateNamespace,
  ]);
  assert.equal(await rate.reserve('a2', 'alice', {}), true);
  console.log('PASS: per-owner and global rate caps survive terminal runs and roll over');

  const activeOwner = make(`owner-${randomUUID()}`, { ownerActive: 1 });
  await activeOwner.reserve('active-owner-1', 'alice', {});
  await assert.rejects(activeOwner.reserve('active-owner-2', 'alice', {}), rejected(429));
  assert.equal(await activeOwner.reserve('active-owner-3', 'bob', {}), true);
  const disabled = make(duplicates, { enabled: false });
  assert.equal(await disabled.reserve('same', 'alice', {}), false);
  await assert.rejects(disabled.reserve('new', 'alice', {}), rejected(503));
  console.log('PASS: per-owner active cap and circuit breaker preserve existing reservations');

  const broken = createAdmission({
    connectionString,
    namespace,
    getStatus: async () => {
      throw new Error('provider unavailable');
    },
  });
  clients.push(broken);
  await assert.rejects(broken.reserve('must-not-reserve', 'alice', {}), /provider unavailable/);
  const count = await pool.query('SELECT count(*) FROM mastra_render_admissions WHERE namespace=$1 AND run_id=$2', [
    namespace,
    'must-not-reserve',
  ]);
  assert.equal(Number(count.rows[0].count), 0);
  const unavailable = createAdmission({
    connectionString: 'postgres://test@127.0.0.1:1/test',
    namespace: 'unavailable',
    getStatus: async () => null,
  });
  clients.push(unavailable);
  await assert.rejects(unavailable.reserve('denied', 'alice', {}));
  console.log('PASS: provider/storage outage fails closed without a reservation');
} finally {
  for (const namespace of new Set(namespaces))
    await pool.query('DELETE FROM mastra_render_admissions WHERE namespace=$1', [namespace]);
  await Promise.all(clients.map(client => client.close()));
  await pool.end();
}
