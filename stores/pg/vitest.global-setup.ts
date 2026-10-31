import pg from 'pg';
import type { TestProject } from 'vitest/node';

import { workerDatabaseName } from './vitest.setup';

const servers = [
  {
    url: 'postgresql://postgres:postgres@localhost:5434/postgres',
    extensions: ['CREATE EXTENSION IF NOT EXISTS vector'],
  },
  { url: 'postgres://postgres:postgres@localhost:5435/postgres', extensions: [] },
];

async function forEachWorkerDatabase(
  workers: number,
  run: (admin: pg.Client, name: string, server: (typeof servers)[number]) => Promise<void>,
) {
  for (const server of servers) {
    const admin = new pg.Client({ connectionString: server.url });
    await admin.connect();
    try {
      for (let worker = 1; worker <= workers; worker++) {
        await run(admin, workerDatabaseName(worker), server);
      }
    } finally {
      await admin.end();
    }
  }
}

// VITEST_POOL_ID runs 1..maxWorkers. Read the resolved value so --maxWorkers or
// VITEST_MAX_WORKERS can't start a worker that has no database.
export default async function setup(project: TestProject) {
  const workers = project.config.maxWorkers;
  await forEachWorkerDatabase(workers, async (admin, name, server) => {
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
  return () =>
    forEachWorkerDatabase(workers, async (admin, name) => {
      await admin.query(`DROP DATABASE IF EXISTS ${name} WITH (FORCE)`);
    });
}
