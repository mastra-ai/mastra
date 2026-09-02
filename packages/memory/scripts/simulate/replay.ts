#!/usr/bin/env tsx
/** Replay recorded observation cycles directly through the production curator dispatch path. */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { Agent } from '@mastra/core/agent';

import { Memory } from '../../src/index';
import { Subconscious } from '../../src/processors/observational-memory/subconscious';
import { replayCycles } from './drive';
import { assertLocalDatabase, assertLocalTarget, withLocalDatabase } from './extract';
import { reconstructCycles } from './reconstruct';

export function parseFlags(argv: string[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (!flag?.startsWith('--')) continue;
    const value = argv[i + 1];
    if (value === undefined || value.startsWith('--')) throw new Error(`${flag} requires a value`);
    const key = flag.slice(2);
    out.set(key, [...(out.get(key) ?? []), value]);
    i++;
  }
  return out;
}

export function positiveInt(flag: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${flag} must be a positive integer, got "${value}"`);
  return parsed;
}

const require = createRequire(new URL('../../../../stores/pg/package.json', import.meta.url));
const { Client } = require('pg');

const pgModulePath = '../../../../stores/pg/dist/index.js';

async function loadStore(connectionString: string) {
  const { PostgresStore } = await import(pgModulePath);
  const store = new PostgresStore({ id: 'simulate-direct-curation', connectionString });
  await store.init();
  return store;
}

async function loadVector(connectionString: string) {
  const { PgVector } = await import(pgModulePath);
  return new PgVector({ id: 'simulate-direct-curation-vector', connectionString });
}

export function assertDistinctReplayDatabases(inputUrl: string, targetUrl: string): void {
  const input = new URL(inputUrl);
  const target = new URL(targetUrl);
  const port = (url: URL) => url.port || '5432';
  const database = (url: URL) => decodeURIComponent(url.pathname.replace(/^\//, ''));
  if (port(input) === port(target) && database(input) === database(target)) {
    throw new Error('refusing to overwrite the input database: --input and --target resolve to the same database');
  }
}

export async function recreateDatabase(connectionString: string): Promise<void> {
  assertLocalTarget(connectionString);
  const url = new URL(connectionString);
  const database = url.pathname.replace(/^\//, '').replace(/"/g, '""');
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    await withLocalDatabase(admin, async () => {
      await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
      await admin.query(`CREATE DATABASE "${database}"`);
    });
  } finally {
    await admin.end();
  }
}

export async function readRecordsByThread(inputUrl: string): Promise<Map<string, Record<string, unknown>[]>> {
  assertLocalTarget(inputUrl);
  const client = new Client({ connectionString: inputUrl });
  await client.connect();
  try {
    const records = await client
      .query('SELECT * FROM mastra_observational_memory ORDER BY "threadId", "generationCount"')
      .then((result: { rows: Record<string, unknown>[] }) => result.rows);
    const byThread = new Map<string, Record<string, unknown>[]>();
    for (const record of records) {
      const threadId = record.threadId as string | null;
      if (threadId) byThread.set(threadId, [...(byThread.get(threadId) ?? []), record]);
    }
    return byThread;
  } finally {
    await client.end();
  }
}

async function run(argv: string[]): Promise<void> {
  const flags = parseFlags(argv);
  const input = flags.get('input')?.[0];
  const target = flags.get('target')?.[0];
  const organizationId = flags.get('org')?.[0];
  const model = flags.get('model')?.[0];
  const knowledgeResourceId = flags.get('knowledge-resource')?.[0];
  if (!input || !target || !organizationId || !model) {
    throw new Error('Required flags: --input, --target, --org, --model');
  }

  assertLocalTarget(input);
  assertLocalTarget(target);
  assertDistinctReplayDatabases(input, target);
  const inputClient = new Client({ connectionString: input });
  await inputClient.connect();
  try {
    await assertLocalDatabase(inputClient);
  } finally {
    await inputClient.end();
  }
  await recreateDatabase(target);

  const storage = await loadStore(target);
  const vector = await loadVector(target);
  const memory = new Memory({ storage, vector });
  try {
    const subconscious = new Subconscious({
      model,
      observation: ['remind', 'curate'],
      defaultScope: 'resource',
      maxScope: 'resource',
    }).resolved;
    const mainAgent = new Agent({
      id: 'simulate-direct-curation',
      name: 'simulate-direct-curation',
      instructions: '',
      model,
    });
    const recordsByThread = await readRecordsByThread(input);

    for (const [threadId, records] of recordsByThread) {
      const reconstruction = reconstructCycles(records as any);
      const result = await replayCycles({
        cycles: reconstruction.cycles,
        threadId,
        resourceId: `simulate:${threadId}`,
        organizationId,
        memory,
        subconscious,
        mainAgent,
        knowledgeResourceId,
        onEvent: console.log,
      });
      console.log(
        JSON.stringify({
          threadId,
          reconstructionWarnings: reconstruction.warnings,
          excludedReflectionHeads: reconstruction.excluded.length,
          ...result,
        }),
      );
    }
  } finally {
    await memory.settled();
    await storage.close();
    await vector.disconnect();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  run(process.argv.slice(2)).catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
}
