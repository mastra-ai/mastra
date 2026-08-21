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

import { Agent } from '@mastra/core/agent';

import { Memory } from '../../src/index';
import { buildArmSubconscious, replayCycles } from '../../src/processors/observational-memory/simulate/drive';
import type { ArmConfig } from '../../src/processors/observational-memory/simulate/drive';
import { reconstructCycles } from '../../src/processors/observational-memory/simulate/reconstruct';
import { assertLocalTarget } from './extract';

/** Minimal `--flag value` reader; the extractor's parser is specific to its own flags. */
function parseFlags(argv: string[]): Map<string, string[]> {
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
  const captureInstructions = args.get('capture-instructions');
  const curateInstructions = args.get('curate-instructions');
  const curationCadence = Number(args.get('cadence') ?? 3);
  const curateMaxSteps = Number(args.get('curate-max-steps') ?? 25);
  const embedder = args.get('embedder') ?? 'google/gemini-embedding-001';

  if (!input || !target) {
    throw new Error('Usage: simulate:replay --input <local-pg-url> --target <local-pg-url> [--org id] [--model id]');
  }
  assertLocalTarget(input);
  assertLocalTarget(target);

  const arm: ArmConfig = {
    name: args.get('arm') ?? 'a',
    prompts: { capture: captureInstructions, curate: curateInstructions },
    curationCadence,
    defaultScope: 'resource',
    maxScope: 'resource',
    curateMaxSteps,
  };

  const inputClient = new Client({ connectionString: input });
  await inputClient.connect();
  const records = await inputClient
    .query('SELECT * FROM mastra_observational_memory ORDER BY "threadId", "generationCount"')
    .then((result: { rows: Record<string, unknown>[] }) => result.rows);
  await inputClient.end();

  const byThread = new Map<string, Record<string, unknown>[]>();
  for (const record of records) {
    const threadId = record.threadId as string | null;
    if (!threadId) continue;
    byThread.set(threadId, [...(byThread.get(threadId) ?? []), record]);
  }

  const storage = await loadStore(target);
  const vector = await loadVector(target);
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

  let totalCycles = 0;
  const outcomes: Record<string, number> = {};

  const onlyThreads = args.getAll('thread-id');
  for (const [threadId, threadRecords] of byThread) {
    if (onlyThreads.length && !onlyThreads.includes(threadId)) continue;
    const { cycles, warnings } = reconstructCycles(threadRecords as never);
    if (!cycles.length) continue;
    const resourceId = (threadRecords[0]?.resourceId as string) ?? threadId;

    const result = await replayCycles({
      cycles,
      threadId,
      resourceId,
      organizationId,
      memory: memory as never,
      subconscious,
      captureAgent,
      curationCadence,
      onEvent: line => console.log(`[${threadId.slice(0, 8)}] ${line}`),
    });

    totalCycles += result.cyclesReplayed;
    for (const curation of result.curations) outcomes[curation.outcome] = (outcomes[curation.outcome] ?? 0) + 1;
    for (const warning of [...warnings.map(w => w.kind), ...result.warnings]) console.log(`WARNING: ${warning}`);
  }

  console.log(`ARM=${arm.name}`);
  console.log(`CAPTURE_MODEL=${captureModel}`);
  console.log(`CURATE_MODEL=${curateModel}`);
  console.log(`THREADS_REPLAYED=${byThread.size}`);
  console.log(`CYCLES_REPLAYED=${totalCycles}`);
  for (const [outcome, count] of Object.entries(outcomes)) console.log(`CURATION_${outcome.toUpperCase()}=${count}`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
