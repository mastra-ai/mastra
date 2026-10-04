/**
 * Seeded interleaving fuzz runner for the observational memory lifecycle, shared by the InMemory
 * unit test (`lifecycle-fuzz.test.ts`) and the LibSQL integration test
 * (`integration-tests/src/om-lifecycle-fuzz-libsql.test.ts`).
 *
 * Two ObservationalMemory instances share one store and one thread. Each seed picks a sequence of
 * message saves, buffering, activation, sync observation, sync reflection, and buffered reflection,
 * launches them with seeded model latencies and random awaits in between, drains all work, and
 * checks the invariants in `lifecycle-invariants.ts`.
 */
import type { MastraDBMessage } from '@mastra/core/agent';
import type { MemoryStorage, ObservationalMemoryRecord } from '@mastra/core/storage';

import {
  checkInvariants,
  createLedger,
  instrumentStorage,
  observerOutput,
  reflectorOutput,
} from './lifecycle-invariants';
import type { LifecycleLedger, Violation } from './lifecycle-invariants';

/** The ObservationalMemory surface the runner drives (source build in unit tests, dist in integration tests). */
export interface FuzzOM {
  observer: { call: (...args: any[]) => Promise<unknown>; callMultiThread: (...args: any[]) => Promise<unknown> };
  reflector: {
    call: (...args: any[]) => Promise<unknown>;
    maybeReflect: (opts: { record: any; observationTokens: number; threadId: string }) => Promise<unknown>;
  };
  getOrCreateRecord(threadId: string, resourceId: string): Promise<unknown>;
  buffer(opts: {
    threadId: string;
    resourceId: string;
    messages: any[];
    skipMinimumTokenCheck?: boolean;
  }): Promise<unknown>;
  activate(opts: { threadId: string; resourceId: string }): Promise<unknown>;
  observe(opts: { threadId: string; resourceId: string; messages: any[] }): Promise<unknown>;
  reflect(threadId: string, resourceId?: string): Promise<unknown>;
  waitForBuffering(threadId: string, resourceId: string, timeoutMs?: number): Promise<unknown>;
  settled(): Promise<unknown>;
  getUnobservedMessages(messages: MastraDBMessage[], record: ObservationalMemoryRecord): MastraDBMessage[];
}

export interface FuzzEnv {
  ObservationalMemory: new (config: any) => FuzzOM;
  createStorage(seed: number): Promise<MemoryStorage>;
  spyOn: (
    object: any,
    method: string,
  ) => { mockImplementation(fn: (...args: any[]) => any): unknown; mockRejectedValue(error: unknown): unknown };
}

/** mulberry32 */
function createRng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

function createOM(env: FuzzEnv, storage: MemoryStorage, rng: () => number, ledger: LifecycleLedger): FuzzOM {
  const om = new env.ObservationalMemory({
    storage,
    scope: 'thread',
    observation: { model: 'openai/gpt-4o-mini', messageTokens: 1_000, bufferTokens: 200 },
    reflection: { model: 'openai/gpt-4o-mini', observationTokens: 200, bufferActivation: 0.5 },
  });
  env.spyOn(om.observer, 'call').mockImplementation(async (_existing: string, messages: Array<{ id: string }>) => {
    ledger.observerReads.push({ seq: ledger.nextSeq(), messageIds: messages.map(m => m.id) });
    await sleep(Math.floor(rng() * 6));
    return { observations: observerOutput(messages.map(m => m.id)) };
  });
  env.spyOn(om.observer, 'callMultiThread').mockRejectedValue(new Error('Unexpected multi-thread Observer call'));
  env.spyOn(om.reflector, 'call').mockImplementation(async (observations: string) => {
    await sleep(Math.floor(rng() * 6));
    return { observations: reflectorOutput(observations) };
  });
  return om;
}

type Op = 'save' | 'buffer' | 'activate' | 'observe' | 'reflect' | 'maybeReflect';
const WEIGHTS: Array<[Op, number]> = [
  ['save', 5],
  ['buffer', 3],
  ['activate', 2],
  ['observe', 1],
  ['reflect', 1],
  ['maybeReflect', 2],
];
const TOTAL_WEIGHT = WEIGHTS.reduce((sum, [, w]) => sum + w, 0);

function pickOp(rng: () => number): Op {
  let roll = rng() * TOTAL_WEIGHT;
  for (const [op, weight] of WEIGHTS) {
    roll -= weight;
    if (roll < 0) return op;
  }
  return 'save';
}

export interface SeedResult {
  seed: number;
  violations: Violation[];
  explainedDuplicates: number;
  overlappingSyncDuplicates: number;
  trace: string[];
  stats: Record<string, number>;
}

export async function runFuzzSeed(env: FuzzEnv, seed: number, steps = 40): Promise<SeedResult> {
  const rng = createRng(seed);
  const storage = await env.createStorage(seed);
  const ids = { threadId: `fuzz-thread-${seed}`, resourceId: `fuzz-resource-${seed}` };
  const t0 = Date.now() - 24 * 60 * 60 * 1_000;
  await storage.saveThread({
    thread: {
      id: ids.threadId,
      resourceId: ids.resourceId,
      title: 'fuzz',
      createdAt: new Date(t0),
      updatedAt: new Date(t0),
    },
  });
  const ledger: LifecycleLedger = createLedger();
  instrumentStorage(storage, ledger, ids);
  const oms = [createOM(env, storage, rng, ledger), createOM(env, storage, rng, ledger)];
  let activations = 0;
  const swap = storage.swapBufferedToActive.bind(storage);
  storage.swapBufferedToActive = async input => {
    const result = await swap(input);
    if (result.chunksActivated > 0) activations++;
    return result;
  };
  await oms[0]!.getOrCreateRecord(ids.threadId, ids.resourceId);

  const trace: string[] = [];
  const violations: Violation[] = [];
  const state = { lastCursor: null as number | null };
  const pending: Promise<unknown>[] = [];

  const sample = async (label: string) => {
    const result = await checkInvariants(storage, ledger, ids, state, false);
    for (const v of result.violations) violations.push({ ...v, detail: `${v.detail} (at ${label})` });
  };

  for (let step = 0; step < steps; step++) {
    const op = pickOp(rng);
    const om = oms[rng() < 0.5 ? 0 : 1]!;
    const who = om === oms[0] ? 'A' : 'B';
    trace.push(`${step}:${who}.${op}`);
    const run = async () => {
      switch (op) {
        case 'save': {
          const n = ledger.messages.length;
          const id = `m${String(n).padStart(4, '0')}`;
          const createdAt = new Date(t0 + (n + 1) * 1_000);
          ledger.messages.push({ id, createdAt });
          await storage.saveMessages({
            messages: [
              {
                id,
                role: n % 2 === 0 ? 'user' : 'assistant',
                type: 'text',
                threadId: ids.threadId,
                resourceId: ids.resourceId,
                createdAt,
                content: { format: 2, parts: [{ type: 'text', text: `${id} ${'detail '.repeat(220)}` }] },
              },
            ],
          });
          return;
        }
        case 'buffer': {
          const messages = (await storage.listMessages({ threadId: ids.threadId, perPage: false })).messages;
          await om.buffer({ ...ids, messages, skipMinimumTokenCheck: true });
          return;
        }
        case 'activate':
          await om.activate(ids);
          return;
        case 'observe': {
          const messages = (await storage.listMessages({ threadId: ids.threadId, perPage: false })).messages;
          await om.observe({ ...ids, messages });
          return;
        }
        case 'reflect':
          await om.reflect(ids.threadId, ids.resourceId);
          return;
        case 'maybeReflect': {
          const record = (await storage.getObservationalMemory(ids.threadId, ids.resourceId))!;
          await om.reflector.maybeReflect({
            record,
            observationTokens: record.observationTokenCount ?? 0,
            threadId: ids.threadId,
          });
          return;
        }
      }
    };
    const promise = run()
      .then(() => sample(`${step}:${who}.${op}`))
      .catch((error: unknown) => {
        violations.push({ invariant: 'error', detail: `${step}:${who}.${op} threw ${String(error)}` });
      });
    pending.push(promise);

    const roll = rng();
    if (roll < 0.3) await Promise.all(pending);
    else if (roll < 0.7) await sleep(Math.floor(rng() * 4));
  }

  await Promise.all(pending);
  for (const om of oms) {
    await om.waitForBuffering(ids.threadId, ids.resourceId, 10_000);
    await om.settled();
  }
  // Activate anything left buffered so the final check sees one consistent end state.
  await oms[0]!.activate(ids);
  const final = await checkInvariants(storage, ledger, ids, state, {
    actorRawView: (messages, head) => oms[0]!.getUnobservedMessages(messages, head),
  });
  violations.push(...final.violations);
  const generations = (await storage.getObservationalMemoryHistory(ids.threadId, ids.resourceId, 1_000)).length;
  const stats = {
    messages: ledger.messages.length,
    appends: ledger.appends.length,
    skippedAppends: ledger.appends.filter(a => !a.persisted).length,
    syncCommits: ledger.syncCommits.length,
    activations,
    generations,
  };
  return {
    seed,
    violations,
    explainedDuplicates: final.explainedDuplicates,
    overlappingSyncDuplicates: final.overlappingSyncDuplicates,
    trace,
    stats,
  };
}

/** Runs `count` seeds from `first` and returns per-seed results plus a one-line report. */
export async function runFuzzSeeds(
  env: FuzzEnv,
  opts: { first: number; count: number; beforeSeed?: () => void },
): Promise<{ results: SeedResult[]; failing: SeedResult[]; report: string }> {
  const results: SeedResult[] = [];
  for (let seed = opts.first; seed < opts.first + opts.count; seed++) {
    opts.beforeSeed?.();
    results.push(await runFuzzSeed(env, seed));
  }
  const byInvariant: Record<string, number> = {};
  for (const result of results) {
    for (const v of result.violations) byInvariant[v.invariant] = (byInvariant[v.invariant] ?? 0) + 1;
  }
  const failing = results.filter(r => r.violations.length > 0);
  const explained = results.reduce((sum, r) => sum + r.explainedDuplicates, 0);
  const overlapping = results.reduce((sum, r) => sum + r.overlappingSyncDuplicates, 0);
  const totals: Record<string, number> = {};
  for (const result of results) {
    for (const [key, value] of Object.entries(result.stats)) totals[key] = (totals[key] ?? 0) + value;
  }
  const lines = [
    `OM_FUZZ seeds=${opts.count} first=${opts.first} failingSeeds=${failing.length} violations=${JSON.stringify(byInvariant)} explainedDuplicates=${explained} overlappingSyncDuplicates=${overlapping} activity=${JSON.stringify(totals)}`,
    ...failing.slice(0, 3).map(
      result =>
        `OM_FUZZ seed ${result.seed}: ${result.violations
          .slice(0, 5)
          .map(v => `${v.invariant}: ${v.detail}`)
          .join(' | ')}\n  trace: ${result.trace.join(' ')}`,
    ),
  ];
  return { results, failing, report: lines.join('\n') };
}
