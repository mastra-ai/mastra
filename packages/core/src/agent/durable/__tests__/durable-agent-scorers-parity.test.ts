/**
 * Ported from validation harness case T50 (scorers).
 *
 * An agent-level scorer runs once after the response and stores its score under the run id, without
 * the caller awaiting it and without disturbing the run; a scorer that throws stores nothing and
 * still does not disturb the run. The script is harness `stepScript(1)` — one `step` tool call then
 * `finished 1 steps` — with `maxSteps: 3`.
 *
 * The harness waits for the score with a 250 ms polling loop (up to `SCORE_WAIT_MS`) because scoring
 * is fire-and-forget and this port may not sleep. Instead the host's scores store is wrapped so the
 * `saveScore` write itself resolves the wait for its run, and the throwing variant waits on the
 * scorer's own completion, after which nothing is ever written. Each wait is bounded, so an engine
 * that never settles fails with its name instead of running to the test timeout.
 *
 * One deliberate fidelity gap: the harness registers the scorer on the host too (`ctx.mastra({
 * scorers })`), not only on the agent. The parity helper builds the `Mastra` instance itself with
 * the agents map alone, so a host-level registration cannot be expressed here; the scorer is
 * registered on the agent, which is what the case's checks exercise.
 */

import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { createScorer } from '../../../evals';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type { CapturedRequest, EngineTurnOptions, ModelScript } from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

type Engine = 'plain' | 'durable' | 'evented';
type ScorerMode = 'pass' | 'throws';

const ENGINES: Engine[] = ['plain', 'durable', 'evented'];
const THREAD = 't50-thread';
const RESOURCE = 't50-resource';
const MAX_STEPS = 3;
const STEPS = 1;
const SCORER_ID = 't50-scorer';

/** Recorded contract per engine; the harness pairs every cell against plain. */
const PLAIN_CONTRACTS: Record<ScorerMode, Record<string, unknown>> = {
  pass: { starts: 1, commits: 1, stored: 1, score: 1, source: 'LIVE', listError: null },
  throws: { starts: 1, commits: 0, stored: 0, score: null, source: null, listError: null },
};

/** Resolvers for `saveScore`, keyed by the run the score belongs to (see `createScoringStorage`). */
const SCORE_WRITES = new Map<string, () => void>();

/**
 * Storage whose scores store resolves the per-run wait once the write has landed. `Object.create`
 * keeps the real store's prototype — every other method still works — and only intercepts the write.
 */
function createScoringStorage(storages: InMemoryStore[]): InMemoryStore {
  const storage = new InMemoryStore();
  storages.push(storage);

  const scores = storage.stores.scores;
  if (!scores) throw new Error('T50: in-memory storage has no scores store');

  const wrapped = Object.create(scores) as typeof scores;
  wrapped.saveScore = async score => {
    const result = await scores.saveScore(score);
    // Resolving after the write means a waiter observes a persisted row, not a pending one.
    SCORE_WRITES.get(score.runId)?.();
    return result;
  };
  storage.stores.scores = wrapped;

  return storage;
}

/** Harness `scoreRows`: the score rows stored for a run, across the engines' stores. */
async function scoreRows(storages: InMemoryStore[], runId: string) {
  const rows: Array<{
    scorerId: string | null;
    score: number;
    runId: string;
    entityId: string | null;
    source: string | null;
  }> = [];

  for (const storage of storages) {
    const store = await storage.getStore('scores');
    if (!store) continue;
    const { scores } = await store.listScoresByRunId({ runId, pagination: { page: 0, perPage: 20 } });
    for (const score of scores) {
      rows.push({
        scorerId: score.scorerId ?? score.scorer?.id ?? null,
        score: score.score,
        runId: score.runId,
        entityId: score.entityId ?? null,
        source: score.source ?? null,
      });
    }
  }

  return rows;
}

/**
 * Bounds a wait so an engine that never settles or never writes fails with its name, rather than
 * running to the suite's 120 s test timeout with no indication of which engine stalled.
 */
async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), 10_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** `done` counts how many completed steps the prompt already carries (harness `toolResults(prompt)`). */
function completedSteps(request: CapturedRequest): number {
  return request.prompt.reduce((total, message) => {
    if (!Array.isArray(message.content)) return total;
    return total + message.content.filter(part => part.type === 'tool-result').length;
  }, 0);
}

type EngineState = {
  starts: number;
  commits: number;
  /** Resolves when the scorer itself is done, however it ended. */
  settled: Promise<void>;
  resolveSettled: () => void;
};

async function runT50(mode: ScorerMode) {
  const states = new Map<Engine, EngineState>();
  const storages: InMemoryStore[] = [];

  const script: ModelScript = {
    respond(request) {
      const done = completedSteps(request);
      if (done >= STEPS) return textOnlyTape(`finished ${done} steps`);
      return toolCallTape('step', { n: done + 1 }, `t50-step-${done + 1}`);
    },
  };

  const results = await expectEngineParity({
    model: script,
    createStorage: () => createScoringStorage(storages),
    buildAgent: ({ engine, model }) => {
      let resolveSettled!: () => void;
      const settled = new Promise<void>(resolve => {
        resolveSettled = resolve;
      });
      const state: EngineState = { starts: 0, commits: 0, settled, resolveSettled };
      states.set(engine, state);

      const scorer = createScorer({ id: SCORER_ID, description: 'records that it ran' })
        .generateScore(async () => {
          state.starts += 1;
          if (mode === 'throws') {
            state.resolveSettled();
            throw new Error('T50 scorer failure');
          }
          state.commits += 1;
          state.resolveSettled();
          return 1;
        })
        .generateReason(async ({ score }) => (score ? 'scored' : 'unscored'));

      return new Agent({
        id: 't50-agent',
        name: 'T50 Agent',
        instructions: 'Use the step tool until you have finished.',
        model,
        tools: {
          step: createTool({
            id: 'step',
            description: 'Record one completed step.',
            inputSchema: z.object({ n: z.number() }),
            execute: async ({ n }) => ({ done: n }),
          }),
        },
        memory: new MockMemory(),
        scorers: { probe: { scorer } },
      });
    },
    run: async handle => {
      const state = states.get(handle.engine);
      if (!state) throw new Error(`T50: no scorer state for ${handle.engine}`);

      const runId = `t50-run-${mode}-${handle.engine}`;
      const written = new Promise<void>(resolve => SCORE_WRITES.set(runId, resolve));
      const options: EngineTurnOptions = {
        maxSteps: MAX_STEPS,
        runId,
        memory: { thread: THREAD, resource: RESOURCE },
      };

      try {
        await handle.turn('go', options);

        // The scorer runs after the response: wait for it, and for the write when there is one.
        // `settled` resolves inside `generateScore` — before the store write on the `pass` path
        // (which is why `pass` waits on `written` as well), and immediately before the throw on the
        // `throws` path, where the hook catches the failure and persists nothing, so `settled` is
        // the whole signal.
        await withTimeout(state.settled, `${handle.engine}: scorer settle`);
        if (mode === 'pass') await withTimeout(written, `${handle.engine}: score write`);
      } finally {
        SCORE_WRITES.delete(runId);
      }
    },
  });

  return { results, states, storages };
}

describe('T50 scorer parity', () => {
  it('runs the scorer once after the response and stores its score under the run id on every engine', async () => {
    const { results, states, storages } = await runT50('pass');
    const contracts = new Map<Engine, Record<string, unknown>>();

    for (const engine of ENGINES) {
      const state = states.get(engine)!;
      const observation = results[engine]!;
      const snapshot = observation.turns[0];
      const runId = `t50-run-pass-${engine}`;
      if (!snapshot) throw new Error(`T50: ${engine} produced no turn`);

      // harness: `run finished` — one finish chunk, no error chunks, the scripted answer.
      expect(chunksOfType(snapshot, 'finish'), `${engine}: finish chunks`).toBe(1);
      expect(chunksOfType(snapshot, 'error'), `${engine}: error chunks`).toBe(0);
      expect(snapshot.streamedText, `${engine}: final text`).toBe('finished 1 steps');

      // harness: `scorer ran once` — the scorer is invoked exactly once per run.
      expect(state.starts, `${engine}: scorer starts`).toBe(1);

      const rows = await scoreRows(storages, runId);
      // harness: `score stored` + `stored under the run id` — one score of 1 under this run id.
      expect(rows, `${engine}: stored scores`).toHaveLength(1);
      expect(rows[0]!.score, `${engine}: stored score`).toBe(1);
      expect(rows[0]!.runId, `${engine}: score run id`).toBe(runId);

      contracts.set(engine, {
        starts: state.starts,
        commits: state.commits,
        stored: rows.length,
        score: rows[0]?.score ?? null,
        source: rows[0]?.source ?? null,
        // The harness records the read error rather than failing on it; here a read error throws
        // above, so the recorded value is simply the absence of one.
        listError: null,
      });
    }

    expect(contracts.get('plain'), 'plain contract').toEqual(PLAIN_CONTRACTS.pass);
    for (const engine of ENGINES.slice(1)) {
      // The harness pairs every cell's contract against plain's.
      expect(contracts.get(engine), `${engine} contract`).toEqual(contracts.get('plain'));
    }
  });

  it('does not store a score when the scorer throws, and leaves the run unaffected, on every engine', async () => {
    const { results, states, storages } = await runT50('throws');
    const contracts = new Map<Engine, Record<string, unknown>>();

    for (const engine of ENGINES) {
      const state = states.get(engine)!;
      const observation = results[engine]!;
      const snapshot = observation.turns[0];
      const runId = `t50-run-throws-${engine}`;
      if (!snapshot) throw new Error(`T50: ${engine} produced no turn`);

      // harness: `run finished` — the throwing scorer never reaches the run.
      expect(chunksOfType(snapshot, 'finish'), `${engine}: finish chunks`).toBe(1);
      expect(chunksOfType(snapshot, 'error'), `${engine}: error chunks`).toBe(0);
      expect(snapshot.streamedText, `${engine}: final text`).toBe('finished 1 steps');

      // harness: `scorer ran once` — the scorer started, then threw.
      expect(state.starts, `${engine}: scorer starts`).toBe(1);

      const rows = await scoreRows(storages, runId);
      // harness: `nothing stored` — the scorer never committed and no score row exists.
      expect(state.commits, `${engine}: scorer commits`).toBe(0);
      expect(rows, `${engine}: stored scores`).toHaveLength(0);

      contracts.set(engine, {
        starts: state.starts,
        commits: state.commits,
        stored: rows.length,
        score: rows[0]?.score ?? null,
        source: rows[0]?.source ?? null,
        listError: null,
      });
    }

    expect(contracts.get('plain'), 'plain contract').toEqual(PLAIN_CONTRACTS.throws);
    for (const engine of ENGINES.slice(1)) {
      expect(contracts.get(engine), `${engine} contract`).toEqual(contracts.get('plain'));
    }
  });
});
