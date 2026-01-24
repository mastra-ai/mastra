#!/usr/bin/env node

/**
 * Waits for Docker services to be healthy before running tests.
 */

import { execSync } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';

const MAX_RETRIES = 30;
const RETRY_DELAY_MS = 1000;

async function waitForPostgres() {
  console.info('Waiting for PostgreSQL...');

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      execSync('docker compose exec -T postgres pg_isready -U mastra -d mastra_admin_test', {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      console.info('PostgreSQL is ready!');
      return;
    } catch {
      await setTimeout(RETRY_DELAY_MS);
    }
  }

  throw new Error('PostgreSQL did not become ready in time');
}

async function waitForClickHouse() {
  console.info('Waiting for ClickHouse...');

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      execSync('docker compose exec -T clickhouse clickhouse-client --query "SELECT 1"', {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      console.info('ClickHouse is ready!');
      return;
    } catch {
      await setTimeout(RETRY_DELAY_MS);
    }
  }

  throw new Error('ClickHouse did not become ready in time');
}

async function waitForRedis() {
  console.info('Waiting for Redis...');

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      execSync('docker compose exec -T redis redis-cli ping', {
        cwd: process.cwd(),
        stdio: 'pipe',
      });
      console.info('Redis is ready!');
      return;
    } catch {
      await setTimeout(RETRY_DELAY_MS);
    }
  }

  throw new Error('Redis did not become ready in time');
}

async function main() {
  console.info('Waiting for all services to be ready...\n');

  try {
    await Promise.all([waitForPostgres(), waitForClickHouse(), waitForRedis()]);

    console.info('\nAll services are ready!');
  } catch (error) {
    console.error('\nFailed to start services:', error.message);
    process.exit(1);
  }
}

main();
