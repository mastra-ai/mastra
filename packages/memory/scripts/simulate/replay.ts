/**
 * Replay reconstructed observation cycles through the real Subconscious capture
 * extractor and curator, against a local Postgres.
 *
 *   pnpm simulate:replay -- \
 *     --input  postgres://user:local@127.0.0.1:55432/simulate_input \
 *     --target postgres://user:local@127.0.0.1:55432/simulate_arm_a \
 *     --org my-org --model openai/gpt-5-mini
 *
 * Both databases must be local: this tool never writes to a remote deployment.
 */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

import { Agent } from '@mastra/core/agent';

import { Memory } from '../../src/index';
import type { ArmSnapshot } from '../../src/processors/observational-memory/simulate/diff';
import { buildArmSubconscious, replayCycles } from '../../src/processors/observational-memory/simulate/drive';
import type { ArmConfig } from '../../src/processors/observational-memory/simulate/drive';
import { reconstructCycles } from '../../src/processors/observational-memory/simulate/reconstruct';
import { assertLocalTarget } from './extract';

/** Minimal `--flag value` reader; the extractor's parser is specific to its own flags. */
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

/** A bare `Number()` turns a typo into NaN, which silently disables cadence comparisons. */
export function positiveInt(flag: string, value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${flag} must be a positive integer, got "${value}"`);
  return parsed;
}

// `pg` and `@mastra/pg` are not dependencies of this package; borrow the workspace
// copies rather than adding one for a dev tool.
const require = createRequire(new URL('../../../../stores/pg/package.json', import.meta.url));
const { Client } = require('pg');

async function loadStore(connectionString: string) {
  const { PostgresStore } = await import('../../../../stores/pg/dist/index.js');
  const store = new PostgresStore({ id: 'simulate-arm', connectionString });
  // Creates the domain tables in the freshly-recreated arm database.
  await store.init();
  return store;
}

/** Subconscious knowledge is semantic, so an arm needs a vector store alongside its Postgres. */
async function loadVector(connectionString: string) {
  const { PgVector } = await import('../../../../stores/pg/dist/index.js');
  return new PgVector({ id: 'simulate-arm-vector', connectionString });
}

/** Drop and recreate an arm database, so arms can never contaminate each other. */
export async function recreateDatabase(connectionString: string): Promise<void> {
  assertLocalTarget(connectionString);
  const url = new URL(connectionString);
  // Quote-escaped: the database name comes from a URL, and identifiers cannot be bound as parameters.
  const database = url.pathname.replace(/^\//, '').replace(/"/g, '""');
  url.pathname = '/postgres';
  const admin = new Client({ connectionString: url.toString() });
  await admin.connect();
  try {
    // WITH (FORCE) requires Postgres 13+; see scripts/simulate/README.md prerequisites.
    await admin.query(`DROP DATABASE IF EXISTS "${database}" WITH (FORCE)`);
    await admin.query(`CREATE DATABASE "${database}"`);
  } finally {
    await admin.end();
  }
}

/** Read every OM record generation out of the immutable input database, grouped by thread. */
export async function readRecordsByThread(inputUrl: string): Promise<Map<string, Record<string, unknown>[]>> {
  assertLocalTarget(inputUrl);
  const client = new Client({ connectionString: inputUrl });
  await client.connect();
  let records: Record<string, unknown>[];
  try {
    records = await client
      .query('SELECT * FROM mastra_observational_memory ORDER BY "threadId", "generationCount"')
      .then((result: { rows: Record<string, unknown>[] }) => result.rows);
  } finally {
    await client.end();
  }

  const byThread = new Map<string, Record<string, unknown>[]>();
  for (const record of records) {
    const threadId = record.threadId as string | null;
    if (!threadId) continue;
    byThread.set(threadId, [...(byThread.get(threadId) ?? []), record]);
  }
  return byThread;
}

export type ArmRunOptions = {
  arm: ArmConfig;
  inputUrl: string;
  targetUrl: string;
  organizationId: string;
  captureModel: string;
  curateModel: string;
  embedder: string;
  onlyThreads?: string[];
  onEvent?: (line: string) => void;
};

export type ArmRunResult = {
  threadsReplayed: number;
  cyclesReplayed: number;
  outcomes: Record<string, number>;
};

/** Run one arm end to end against its own database. */
export async function runArm(options: ArmRunOptions): Promise<ArmRunResult> {
  const { arm, inputUrl, targetUrl, organizationId, captureModel, curateModel, embedder } = options;
  assertLocalTarget(inputUrl);
  assertLocalTarget(targetUrl);

  const byThread = await readRecordsByThread(inputUrl);
  const storage = await loadStore(targetUrl);
  const vector = await loadVector(targetUrl);
  const subconscious = buildArmSubconscious(arm);
  const memory = new Memory({
    storage,
    vector,
    embedder,
    options: { observationalMemory: { model: curateModel, experimental_subconscious: subconscious } },
  });
  const captureAgent = new Agent({
    id: 'simulate-capture',
    name: 'simulate-capture',
    instructions: 'Extract knowledge.',
    model: captureModel,
  });

  let cyclesReplayed = 0;
  let threadsReplayed = 0;
  const outcomes: Record<string, number> = {};
  const onlyThreads = options.onlyThreads ?? [];
  const log = options.onEvent ?? (line => console.log(line));

  try {
    for (const [threadId, threadRecords] of byThread) {
      if (onlyThreads.length && !onlyThreads.includes(threadId)) continue;
      const { cycles, warnings } = reconstructCycles(threadRecords as never);
      if (!cycles.length) continue;
      const resourceId = (threadRecords[0]?.resourceId as string) ?? threadId;
      threadsReplayed++;

      const result = await replayCycles({
        cycles,
        threadId,
        resourceId,
        organizationId,
        memory: memory as never,
        subconscious,
        captureAgent,
        curationCadence: arm.curationCadence,
        onEvent: line => log(`[${arm.name}][${threadId.slice(0, 8)}] ${line}`),
      });

      cyclesReplayed += result.cyclesReplayed;
      for (const curation of result.curations) outcomes[curation.outcome] = (outcomes[curation.outcome] ?? 0) + 1;
      for (const warning of [...warnings.map(w => w.kind), ...result.warnings]) log(`WARNING: ${warning}`);
    }

    return { threadsReplayed, cyclesReplayed, outcomes };
  } finally {
    // ab.ts runs up to three arms in one process, so each arm releases its pools before the next.
    await storage.close();
    await vector.disconnect();
  }
}

/** Read an arm's resulting knowledge for content comparison. */
export async function snapshotArm(targetUrl: string): Promise<ArmSnapshot> {
  assertLocalTarget(targetUrl);
  const client = new Client({ connectionString: targetUrl });
  await client.connect();
  try {
    const nodes = await client
      .query('SELECT id, name FROM mastra_knowledge_nodes')
      .then((result: { rows: { id: string; name: string }[] }) => result.rows);
    const records = await client
      .query('SELECT id, node, text FROM mastra_knowledge_records WHERE "deletedAt" IS NULL')
      .then((result: { rows: { id: string; node: string; text: string }[] }) => result.rows);
    return { nodes, records };
  } finally {
    await client.end();
  }
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));
  const args = {
    get: (key: string) => flags.get(key)?.at(-1),
    getAll: (key: string) => flags.get(key) ?? [],
  };
  const input = args.get('input');
  const target = args.get('target');
  const organizationId = args.get('org') ?? 'simulate';
  const model = args.get('model') ?? 'openai/gpt-5-mini';
  // Capture and curation can run on different models (a provider may support one path
  // better than the other). Both arms of an A/B use the same pair, so this cannot
  // confound a diff.
  const captureModel = args.get('capture-model') ?? model;
  const curateModel = args.get('curate-model') ?? model;

  if (!input || !target) {
    throw new Error('Usage: simulate:replay --input <local-pg-url> --target <local-pg-url> [--org id] [--model id]');
  }

  const arm: ArmConfig = {
    name: args.get('arm') ?? 'a',
    prompts: { capture: args.get('capture-instructions'), curate: args.get('curate-instructions') },
    curationCadence: positiveInt('cadence', args.get('cadence'), 3),
    defaultScope: 'resource',
    maxScope: 'resource',
    curateMaxSteps: positiveInt('curate-max-steps', args.get('curate-max-steps'), 25),
  };

  const result = await runArm({
    arm,
    inputUrl: input,
    targetUrl: target,
    organizationId,
    captureModel,
    curateModel,
    embedder: args.get('embedder') ?? 'google/gemini-embedding-001',
    onlyThreads: args.getAll('thread-id'),
  });

  console.log(`ARM=${arm.name}`);
  console.log(`CAPTURE_MODEL=${captureModel}`);
  console.log(`CURATE_MODEL=${curateModel}`);
  console.log(`THREADS_REPLAYED=${result.threadsReplayed}`);
  console.log(`CYCLES_REPLAYED=${result.cyclesReplayed}`);
  for (const [outcome, count] of Object.entries(result.outcomes)) {
    console.log(`CURATION_${outcome.toUpperCase()}=${count}`);
  }
}

// Only run the CLI when invoked directly; `ab.ts` imports the helpers above.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
