import assert from 'node:assert/strict';

import pg from 'pg';

import { PgFactoryStorage, PgVector, PostgresStore } from '../../index';
import { resolvePgConfig } from '../../storage/db';

const connectionString =
  process.env.POSTGRES_CONNECTION_STRING ?? 'postgresql://postgres:postgres@localhost:5434/mastra';
const url = new URL(connectionString);
const hostConfig = {
  host: url.hostname,
  port: Number(url.port || 5432),
  database: url.pathname.slice(1),
  user: decodeURIComponent(url.username),
  password: decodeURIComponent(url.password),
};

process.on('uncaughtExceptionMonitor', error => {
  console.error('UNCAUGHT_EXCEPTION', error.message);
});

async function createOwner() {
  switch (process.argv[2]) {
    case 'store': {
      const store = new PostgresStore({ id: 'terminated-client', connectionString });
      return { pool: store.pool, close: () => store.close() };
    }
    case 'store-host': {
      const store = new PostgresStore({ id: 'terminated-client', ...hostConfig });
      return { pool: store.pool, close: () => store.close() };
    }
    case 'store-client-config': {
      // Function passwords exercise the ClientConfig path used by Cloud SQL IAM.
      process.env.PGHOST = hostConfig.host;
      const store = new PostgresStore({
        id: 'terminated-client',
        port: hostConfig.port,
        database: hostConfig.database,
        user: hostConfig.user,
        password: () => hostConfig.password,
      });
      return { pool: store.pool, close: () => store.close() };
    }
    case 'vector': {
      const vector = new PgVector({ id: 'terminated-client', connectionString });
      return { pool: vector.pool, close: () => vector.disconnect() };
    }
    case 'factory': {
      const factory = new PgFactoryStorage({ connectionString });
      const db = factory.authDatabase();
      assert.equal(db.dialect, 'postgres');
      assert.ok(db.pool instanceof pg.Pool);
      return { pool: db.pool, close: () => factory.close() };
    }
    case 'domain': {
      const { client } = resolvePgConfig({ connectionString });
      return { pool: client.$pool, close: () => client.$pool.end() };
    }
    default:
      throw new Error(`Unknown pool owner: ${process.argv[2]}`);
  }
}

const owner = await createOwner();
const admin = new pg.Pool({ connectionString });
try {
  // Repeat after recovery to also cover a newly established physical client.
  for (let attempt = 0; attempt < 2; attempt++) {
    const client = await owner.pool.connect();
    try {
      const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
      const ended = new Promise<void>(resolve => client.once('end', resolve));
      const interrupted = client.query('SELECT pg_sleep(30) /* mastra-28234 */');
      const rejected = assert.rejects(interrupted, /terminating connection|connection terminated/i);
      // Wait for the query to reach Postgres, rather than racing socket writes.
      const deadline = Date.now() + 5000;
      while (true) {
        const { rows: activity } = await admin.query<{ waiting: boolean }>(
          "SELECT wait_event = 'PgSleep' AS waiting FROM pg_stat_activity WHERE pid = $1",
          [rows[0]!.pid],
        );
        if (activity[0]?.waiting) break;
        assert.ok(Date.now() < deadline, 'sleep query did not reach Postgres');
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      const { rows: terminated } = await admin.query<{ terminated: boolean }>(
        'SELECT pg_terminate_backend($1) AS terminated',
        [rows[0]!.pid],
      );
      assert.equal(terminated[0]!.terminated, true);
      await rejected;
      console.log('QUERY_REJECTED');
      // Hold the checkout until the socket closes: pg reports the query error
      // first, then emits a client error as the backend disconnects.
      await ended;
    } finally {
      client.release(true);
    }
    const { rows } = await owner.pool.query<{ value: number }>('SELECT 1 AS value');
    assert.equal(rows[0]!.value, 1);
    console.log('RECOVERED');
  }
} finally {
  await admin.end();
  await owner.close();
}
