import { createClient } from '@clickhouse/client';

import { TEST_WORKER_COUNT, workerName } from './vitest.setup';

async function forEachWorker(queries: (name: string, password: string) => string[]) {
  const password = process.env.CLICKHOUSE_PASSWORD || 'password';
  const admin = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password,
  });
  try {
    for (let worker = 1; worker <= TEST_WORKER_COUNT; worker++) {
      for (const query of queries(workerName(worker), password)) await admin.command({ query });
    }
  } finally {
    await admin.close();
  }
}

// The database goes first: the user is the definer of its materialized views.
const drop = (name: string) => [`DROP DATABASE IF EXISTS ${name} SYNC`, `DROP USER IF EXISTS ${name}`];

export async function setup() {
  await forEachWorker((name, password) => [
    ...drop(name),
    `CREATE DATABASE ${name}`,
    `CREATE USER ${name} IDENTIFIED BY '${password}' DEFAULT DATABASE ${name}`,
    `GRANT CURRENT GRANTS ON *.* TO ${name} WITH GRANT OPTION`,
  ]);
}

export async function teardown() {
  await forEachWorker(drop);
}
