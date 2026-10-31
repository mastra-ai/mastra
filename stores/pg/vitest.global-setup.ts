import pg from 'pg';

import { TEST_WORKER_COUNT, workerDatabaseName } from './vitest.setup';

const servers = [
  {
    url: 'postgresql://postgres:postgres@localhost:5434/postgres',
    extensions: ['CREATE EXTENSION IF NOT EXISTS vector'],
  },
  { url: 'postgres://postgres:postgres@localhost:5435/postgres', extensions: [] },
];

async function forEachWorkerDatabase(
  run: (admin: pg.Client, name: string, server: (typeof servers)[number]) => Promise<void>,
) {
  for (const server of servers) {
    const admin = new pg.Client({ connectionString: server.url });
    await admin.connect();
    try {
      for (let worker = 1; worker <= TEST_WORKER_COUNT; worker++) {
        await run(admin, workerDatabaseName(worker), server);
      }
    } finally {
      await admin.end();
    }
  }
}

export async function setup() {
  await forEachWorkerDatabase(async (admin, name, server) => {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    await admin.query(`CREATE DATABASE ${name}`);
    const db = new pg.Client({ connectionString: server.url.replace(/\/[^/]*$/, `/${name}`) });
    await db.connect();
    try {
      for (const statement of server.extensions) await db.query(statement);
    } finally {
      await db.end();
    }
  });
}

export async function teardown() {
  await forEachWorkerDatabase(async (admin, name) => {
    await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
  });
}
