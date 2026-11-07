import { createClient } from '@clickhouse/client';
import type { TestProject } from 'vitest/node';

import { workerName } from './vitest.setup';

async function forEachWorker(workers: number, queries: (name: string, password: string) => string[]) {
  const password = process.env.CLICKHOUSE_PASSWORD || 'password';
  const admin = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://localhost:8123',
    username: process.env.CLICKHOUSE_USERNAME || 'default',
    password,
  });
  try {
    for (let worker = 1; worker <= workers; worker++) {
      for (const query of queries(workerName(worker), password)) await admin.command({ query });
    }
  } finally {
    await admin.close();
  }
}

// The database goes first: the user is the definer of its materialized views.
const drop = (name: string) => [`DROP DATABASE IF EXISTS ${name} SYNC`, `DROP USER IF EXISTS ${name}`];

// VITEST_POOL_ID runs 1..maxWorkers. Read the resolved value so --maxWorkers or
// VITEST_MAX_WORKERS can't start a worker that has no user.
export default async function setup(project: TestProject) {
  const workers = project.config.maxWorkers;
  await forEachWorker(workers, (name, password) => [
    ...drop(name),
    `CREATE DATABASE ${name}`,
    `CREATE USER ${name} IDENTIFIED BY '${password}' DEFAULT DATABASE ${name}`,
    `GRANT CURRENT GRANTS ON *.* TO ${name} WITH GRANT OPTION`,
  ]);
  return () => forEachWorker(workers, drop);
}
