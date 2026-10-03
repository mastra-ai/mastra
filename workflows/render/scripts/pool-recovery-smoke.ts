import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { Pool } from 'pg';
import { createPostgresPersistence } from '../src/persistence/postgres.js';
import { createAdmission } from '../examples/editorial-review/admission.js';

// Terminates only this test's own idle connections, never shared application sessions.
const connectionString = process.env.DATABASE_URL;
assert.ok(connectionString, 'DATABASE_URL is required');
const admin = new Pool({ connectionString, max: 1 });
const namespace = `pool-recovery-${randomUUID()}`;
const errors: string[] = [];
const originalError = console.error;
console.error = (...args: unknown[]) => {
  errors.push(String(args[0]));
  originalError(...args);
};
try {
  for (const kind of ['persistence', 'admission'] as const) {
    const name = `${namespace}-${kind}`;
    const url = new URL(connectionString);
    url.searchParams.set('application_name', name);
    const client =
      kind === 'persistence'
        ? createPostgresPersistence({ connectionString: url.toString(), max: 1 })
        : createAdmission({ connectionString: url.toString(), namespace, getStatus: async () => null });
    const query = () => ('get' in client ? client.get('pool-recovery', name) : client.reserve(name, namespace, {}));
    try {
      await query();
      const before = errors.length;
      const idle = await admin.query<{ pid: number }>(
        'SELECT pid FROM pg_stat_activity WHERE application_name=$1 AND datname=current_database() AND state=$2 AND pid<>pg_backend_pid()',
        [name, 'idle'],
      );
      assert.equal(idle.rows.length, 1, 'Only the dedicated test connection should be selected');
      const pid = idle.rows[0]!.pid;
      assert.equal(
        (await admin.query('SELECT pg_terminate_backend($1) AS terminated', [pid])).rows[0].terminated,
        true,
      );
      for (let i = 0; i < 100 && errors.length === before; i++) await delay(20);
      assert.equal(errors.length, before + 1, 'The idle-client error must reach the registered handler');
      await query();
      const after = await admin.query('SELECT pid FROM pg_stat_activity WHERE application_name=$1', [name]);
      assert.equal(after.rows.length, 1);
      assert.notEqual(after.rows[0].pid, pid, 'A subsequent query must use a replacement connection');
      console.log(`PASS: ${kind} survives its own idle connection loss and reconnects`);
    } finally {
      await client.close();
    }
  }
} finally {
  console.error = originalError;
  await admin.query('DELETE FROM mastra_render_admissions WHERE namespace=$1', [namespace]);
  await admin.end();
}
