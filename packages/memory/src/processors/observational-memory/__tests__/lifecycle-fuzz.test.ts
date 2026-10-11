/**
 * Seeded interleaving fuzz for the observational memory lifecycle.
 *
 * Two ObservationalMemory instances share one InMemory store and one thread. Each seed picks a
 * sequence of message saves, buffering, activation, sync observation, sync reflection, and
 * buffered reflection, launches them with seeded model latencies and random awaits in between,
 * drains all work, and checks the invariants in `lifecycle-invariants.ts`.
 *
 * `OM_FUZZ_SEEDS=<n>` runs more seeds; `OM_FUZZ_REPORT_ONLY=1` reports violations without failing
 * (used to measure an older revision). A failing seed prints its seed and operation trace.
 */
import { InMemoryDB, InMemoryMemory } from '@mastra/core/storage';
import type { MemoryStorage } from '@mastra/core/storage';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BufferingCoordinator } from '../buffering-coordinator';
import { ObservationalMemory } from '../observational-memory';
import {
  checkInvariants,
  createLedger,
  instrumentStorage,
  observerOutput,
  reflectorOutput,
} from './lifecycle-invariants';
import type { LifecycleLedger, Violation } from './lifecycle-invariants';

const SEEDS = Number(process.env.OM_FUZZ_SEEDS ?? 50);
const FIRST_SEED = Number(process.env.OM_FUZZ_FIRST_SEED ?? 1);
const REPORT_ONLY = process.env.OM_FUZZ_REPORT_ONLY === '1';
const STEPS = 40;

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

function createOM(storage: MemoryStorage, rng: () => number, ledger: LifecycleLedger) {
  const om = new ObservationalMemory({
    storage,
    scope: 'thread',
    observation: { model: 'openai/gpt-4o-mini', messageTokens: 1_000, bufferTokens: 200 },
    reflection: { model: 'openai/gpt-4o-mini', observationTokens: 200, bufferActivation: 0.5 },
  });
  vi.spyOn(om.observer, 'call').mockImplementation(async (_existing, messages) => {
    ledger.observerReads.push({ seq: ledger.nextSeq(), messageIds: messages.map(m => m.id) });
    await sleep(Math.floor(rng() * 6));
    return { observations: observerOutput(messages.map(m => m.id)) } as Awaited<ReturnType<typeof om.observer.call>>;
  });
  vi.spyOn(om.observer, 'callMultiThread').mockRejectedValue(new Error('Unexpected multi-thread Observer call'));
  vi.spyOn(om.reflector, 'call').mockImplementation(async observations => {
    await sleep(Math.floor(rng() * 6));
    return { observations: reflectorOutput(observations) } as Awaited<ReturnType<typeof om.reflector.call>>;
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

interface SeedResult {
  seed: number;
  violations: Violation[];
  explainedDuplicates: number;
  overlappingSyncDuplicates: number;
  trace: string[];
  stats: Record<string, number>;
}

async function runSeed(seed: number): Promise<SeedResult> {
  const rng = createRng(seed);
  const storage = new InMemoryMemory({ db: new InMemoryDB() });
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
  const oms = [createOM(storage, rng, ledger), createOM(storage, rng, ledger)];
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

  for (let step = 0; step < STEPS; step++) {
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

afterEach(() => {
  BufferingCoordinator.asyncBufferingOps.clear();
  BufferingCoordinator.lastBufferedBoundary.clear();
  BufferingCoordinator.lastBufferedAtTime.clear();
  BufferingCoordinator.reflectionBufferCycleIds.clear();
  vi.restoreAllMocks();
});

describe('observational memory lifecycle fuzz', () => {
  it(
    `holds the lifecycle invariants for ${SEEDS} seeds`,
    async () => {
      const results: SeedResult[] = [];
      for (let seed = FIRST_SEED; seed < FIRST_SEED + SEEDS; seed++) {
        BufferingCoordinator.asyncBufferingOps.clear();
        BufferingCoordinator.lastBufferedBoundary.clear();
        BufferingCoordinator.lastBufferedAtTime.clear();
        BufferingCoordinator.reflectionBufferCycleIds.clear();
        results.push(await runSeed(seed));
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
      console.info(
        `OM_FUZZ seeds=${SEEDS} first=${FIRST_SEED} failingSeeds=${failing.length} violations=${JSON.stringify(byInvariant)} explainedDuplicates=${explained} overlappingSyncDuplicates=${overlapping} activity=${JSON.stringify(totals)}`,
      );
      for (const result of failing.slice(0, 3)) {
        console.info(
          `OM_FUZZ seed ${result.seed}: ${result.violations
            .slice(0, 5)
            .map(v => `${v.invariant}: ${v.detail}`)
            .join(' | ')}\n  trace: ${result.trace.join(' ')}`,
        );
      }

      if (!REPORT_ONLY) expect(failing.map(r => ({ seed: r.seed, violations: r.violations.slice(0, 5) }))).toEqual([]);
    },
    Math.max(120_000, SEEDS * 3_000),
  );
});
