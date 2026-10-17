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
import { InProcessObservationalMemoryOperations } from '@mastra/core/storage';
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
  /** Class for the second instance; pass one loaded from a separate module copy to model another process. */
  ObservationalMemoryB?: new (config: any) => FuzzOM;
  createStorage(seed: number): Promise<MemoryStorage>;
  /** Stores each replica sends operation claims to, e.g. two adapter instances on separate pools. */
  createClaimStores?: (storage: MemoryStorage, seed: number) => Promise<[ClaimSource, ClaimSource]>;
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

type ClaimSource = Pick<
  MemoryStorage,
  | 'claimObservationalMemoryOperation'
  | 'renewObservationalMemoryOperation'
  | 'releaseObservationalMemoryOperation'
  | 'getObservationalMemoryOperationOwner'
>;

function inProcessClaims(): ClaimSource {
  const claims = new InProcessObservationalMemoryOperations();
  return {
    claimObservationalMemoryOperation: async input => claims.claim(input),
    renewObservationalMemoryOperation: async input => claims.renew(input),
    releaseObservationalMemoryOperation: async input => claims.release(input),
    getObservationalMemoryOperationOwner: async input => claims.getOwner(input),
  };
}

/**
 * Counts the storage calls OM makes, without counting the runner's own reads. With `claims`, the
 * adapter's default process-local operation claims are replaced by that instance, so two replicas
 * sharing one store don't share the claims a real second process could not see.
 */
const PROOF_SEEN = new Set<string>();
function countingStorage(storage: MemoryStorage, calls: Map<string, number>, claims?: ClaimSource): MemoryStorage {
  const claimMethods: Record<string, (input: any) => unknown> = claims
    ? {
        claimObservationalMemoryOperation: input => claims.claimObservationalMemoryOperation(input),
        renewObservationalMemoryOperation: input => claims.renewObservationalMemoryOperation(input),
        releaseObservationalMemoryOperation: input => claims.releaseObservationalMemoryOperation(input),
        getObservationalMemoryOperationOwner: input => claims.getObservationalMemoryOperationOwner(input),
      }
    : {};
  return new Proxy(storage, {
    get(target, prop, receiver) {
      if (typeof prop === 'string' && prop in claimMethods) {
        const method = claimMethods[prop]!;
        return async (input: unknown) => {
          calls.set(prop, (calls.get(prop) ?? 0) + 1);
          return method(input);
        };
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value !== 'function' || typeof prop !== 'string') return value;
      if (process.env.OM_PROOF && prop === 'initializeObservationalMemory') PROOF_SEEN.clear();
      if (process.env.OM_PROOF && prop === 'appendBufferedObservations') {
        return async (input: any) => {
          calls.set(prop, (calls.get(prop) ?? 0) + 1);
          const reobserve = input.chunk.messageIds.some((m: string) => PROOF_SEEN.has(m));
          if (reobserve && process.env.OM_PROOF === 'guard') return { persisted: false, recordId: input.id };
          const result = await value.apply(target, [input]);
          if (result?.persisted) {
            if (reobserve) calls.set('PROOF:reobserve', (calls.get('PROOF:reobserve') ?? 0) + 1);
            for (const m of input.chunk.messageIds) PROOF_SEEN.add(m);
          }
          return result;
        };
      }
      return (...args: unknown[]) => {
        calls.set(prop, (calls.get(prop) ?? 0) + 1);
        return value.apply(target, args);
      };
    },
  });
}

function createOM(
  env: FuzzEnv,
  storage: MemoryStorage,
  rng: () => number,
  ledger: LifecycleLedger,
  OM: new (config: any) => FuzzOM = env.ObservationalMemory,
): FuzzOM {
  const om = new OM({
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
  storageCalls: Record<string, number>;
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
  const storageCalls = new Map<string, number>();
  const separate = !!env.ObservationalMemoryB;
  const [claimsA, claimsB] = env.createClaimStores
    ? await env.createClaimStores(storage, seed)
    : separate
      ? [inProcessClaims(), inProcessClaims()]
      : [undefined, undefined];
  const oms = [
    createOM(env, countingStorage(storage, storageCalls, claimsA), rng, ledger),
    createOM(env, countingStorage(storage, storageCalls, claimsB), rng, ledger, env.ObservationalMemoryB),
  ];
  if (process.env.OM_FUZZ_RESTAMP) {
    const save = storage.saveMessages.bind(storage);
    storage.saveMessages = async input => {
      for (const m of input.messages) {
        const original = ledger.messages.find(l => l.id === m.id);
        if (original && m.createdAt && new Date(m.createdAt).getTime() !== original.createdAt.getTime()) {
          console.log(
            `RESTAMP seed=${seed} ${m.id} ${original.createdAt.getTime()} -> ${new Date(m.createdAt).getTime()}\n${new Error().stack?.split('\n').slice(2, 12).join('\n')}`,
          );
        }
      }
      return save(input);
    };
  }
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
  let saveChain: Promise<void> = Promise.resolve();

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
          // Seed-scoped ids: stores that keep data across seeds (pg) upsert by id and keep the old createdAt.
          const id = `s${seed}-m${String(n).padStart(4, '0')}`;
          const createdAt = new Date(t0 + (n + 1) * 1_000);
          ledger.messages.push({ id, createdAt });
          // One writer per thread: an agent's steps save in createdAt order, each before the next step.
          const previous = saveChain;
          let done!: () => void;
          saveChain = new Promise<void>(resolve => (done = resolve));
          await previous;
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
          }).finally(done);
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
    storageCalls: Object.fromEntries(storageCalls),
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
  const calls: Record<string, number> = {};
  for (const result of results) {
    for (const [key, value] of Object.entries(result.storageCalls)) calls[key] = (calls[key] ?? 0) + value;
  }
  const totalCalls = Object.values(calls).reduce((sum, n) => sum + n, 0);
  const lines = [
    `OM_FUZZ seeds=${opts.count} first=${opts.first} failingSeeds=${failing.length} violations=${JSON.stringify(byInvariant)} explainedDuplicates=${explained} overlappingSyncDuplicates=${overlapping} activity=${JSON.stringify(totals)}`,
    `OM_FUZZ storageCalls total=${totalCalls} ${JSON.stringify(Object.fromEntries(Object.entries(calls).sort((a, b) => b[1] - a[1])))}`,
    ...failing.slice(0, Number(process.env.OM_FUZZ_SHOW ?? 3)).map(
      result =>
        `OM_FUZZ seed ${result.seed}: ${result.violations
          .slice(0, 5)
          .map(v => `${v.invariant}: ${v.detail}`)
          .join(' | ')}\n  trace: ${result.trace.join(' ')}`,
    ),
  ];
  return { results, failing, report: lines.join('\n') };
}
