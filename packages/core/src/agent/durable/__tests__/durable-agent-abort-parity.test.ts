/**
 * Ported from validation harness case T14 (abort) — in-tree home for case T14.
 *
 * Aborting a live run — by run id (`abortRunStream`) or through the run's
 * `abortSignal` — must settle the stream, surface an `abort` chunk, fire
 * `onAbort` and never `onFinish`, make no further model call, never start the
 * next step, and emit no error chunk; identically on plain, durable and evented
 * agents. The run is aborted while a tool is parked at a checkpoint, so the
 * abort lands at an exact point and no timer is involved.
 *
 * The harness case is model-free and driven by a script (`stepScript`); the
 * script is rebuilt here on the parity helper's `ModelScript`. The harness's
 * `toolSawAbort` stays a detail there (whether the parked tool sees the abort or
 * falls back is a race, not a fact about the engine), so it is not asserted
 * here either.
 *
 * The engines do disagree on the abort surface itself, and that disagreement is
 * declared rather than hidden: plain finalises the parked step before it
 * terminates, so its stream carries the aborted step's `tool-result` a second
 * time and its finish chunk reports `reason: 'tripwire'`, while durable and
 * evented abort without that chunk and report `abort`. That is COR-1415, a
 * plain-side difference. It is declared below with an `expect` that maps plain's
 * observation onto what the wrapped engines produce, so every other field is
 * still compared exactly; plain's own values stay pinned literally so the
 * reference cannot drift with the fix. When COR-1415 lands the declaration stops
 * reproducing and the test fails until the declaration is removed.
 *
 * Three fidelity gaps are deliberate, because closing them would make the file
 * red for reasons outside this case's contract:
 *   - The harness waits up to a second after the abort before asserting that no
 *     further model call happened; here the script's own requests array is
 *     asserted at the end of the run, which is the same guarantee without a
 *     sleep, but it is not the harness's wall-clock window.
 *   - Plain aborts through the public `agent.abortRunStream(runId)`; durable and
 *     evented abort the run registry's controller directly, so a broken public
 *     abort-by-run-id on the wrapped engines would not be caught here. The
 *     harness routes every engine through the runner's public method.
 *   - The harness contract also records a `snapshot` of the run's persisted
 *     status after the abort; the parity snapshot has no equivalent field, so
 *     that check is not expressed here.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { globalRunRegistry } from '../run-registry';
import type {
  CapturedRequest,
  EngineDifference,
  EngineHandle,
  EngineParityResults,
  EngineParityScenario,
  EngineRunResult,
  ModelScript,
  ParityEngine,
  ParitySnapshot,
} from './parity-harness';
import { chunksOfType, expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const AGENT_ID = 't14-agent';
const STEP_TOOL = 'step';
const STEP_COUNT = 3;
const BLOCK_AT = 2;
const MAX_STEPS = 6;

const VARIANTS = ['run', 'signal'] as const;
type Variant = (typeof VARIANTS)[number];

interface Deferred<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(resolver => {
    resolve = resolver;
  });
  return { promise, resolve };
}

function aborted(signal?: AbortSignal): Promise<void> {
  return new Promise<void>(resolve => {
    if (!signal) return;
    if (signal.aborted) return resolve();
    signal.addEventListener('abort', () => resolve(), { once: true });
  });
}

/** Number of tool results the model has already been handed. */
function toolResultCount(request: CapturedRequest): number {
  let count = 0;
  for (const message of request.prompt) {
    if (message.role !== 'tool') continue;
    for (const part of message.content) {
      if (part.type === 'tool-result') count += 1;
    }
  }
  return count;
}

/**
 * The harness's `stepScript(count)`: call `step` with the next number while the
 * script still has steps left, then answer `finished N steps`.
 */
function stepScript(count: number): ModelScript {
  return {
    respond: request => {
      const done = toolResultCount(request);
      if (done < count) return toolCallTape(STEP_TOOL, { n: done + 1 }, `step-${done + 1}`);
      return textOnlyTape(`finished ${done} steps`);
    },
  };
}

/**
 * The harness aborts through `runner.abortRunStream(runId)`, where `runner` is
 * the agent the engine actually runs. On plain that agent is the one the parity
 * helper hands the scenario. A durable/evented run's abort controller is not on
 * that agent — it is created per run on the durable run registry, and
 * `DurableAgent.abortRunStream` flips exactly that controller (its second step,
 * a cross-process abort request, is a no-op in-process).
 */
function abortRun(handle: EngineHandle, runId: string): boolean {
  if (handle.engine === 'plain') return handle.agent.abortRunStream(runId);
  const controller = globalRunRegistry.get(runId)?.abortController;
  if (!controller) return false;
  controller.abort(new Error('Aborted'));
  return true;
}

/**
 * COR-1415 — plain's abort surface. Plain delivers the aborted step's
 * `tool-result` a second time, immediately before the `abort` chunk, and reports
 * `reason: 'tripwire'` on the finish chunk; durable and evented do neither. The
 * `expect` maps plain's observation onto the wrapped engines' shape, so the
 * comparison outside these fields stays exact. When plain stops finalising the
 * aborted step the difference no longer reproduces and the helper fails the
 * test, which is the signal to delete this declaration.
 */
const ABORT_ARTIFACT: EngineDifference = {
  reason:
    "COR-1415: plain emits the aborted step's tool-result a second time and finishes the abort as 'tripwire'; durable and evented abort without it.",
  expect: plain => ({
    ...plain,
    turns: plain.turns.map(turn => {
      // Plain's spurious chunk sits directly before the abort chunk it also
      // emits; both wrapped engines go straight from the parked step to `abort`.
      const spurious = turn.chunkTypes.indexOf('abort') - 1;
      const withoutSpurious = <T>(list: T[]): T[] => list.filter((_, index) => index !== spurious);
      return {
        ...turn,
        chunks: withoutSpurious(turn.chunks),
        chunkTypes: withoutSpurious(turn.chunkTypes),
        chunkPayloads: withoutSpurious(turn.chunkPayloads),
        finishChunk: { ...turn.finishChunk, reason: 'abort' },
        // The duplicate result sorts next to the result it duplicates.
        toolResults: turn.toolResults.slice(0, -1),
      };
    }),
  }),
};

interface EngineCaseState {
  memory: MockMemory;
  parked: Deferred<void>;
  release: Deferred<void>;
  toolLog: number[];
  callbacks: string[];
  accepted?: boolean;
  snapshot?: ParitySnapshot;
}

async function runT14(variant: Variant): Promise<{
  results: EngineParityResults;
  states: Map<ParityEngine, EngineCaseState>;
}> {
  const states = new Map<ParityEngine, EngineCaseState>();
  const runIdFor = (engine: ParityEngine) => `t14-run-${variant}-${engine}`;

  const scenario: EngineParityScenario = {
    model: stepScript(STEP_COUNT),
    differences: { durable: ABORT_ARTIFACT, evented: ABORT_ARTIFACT },
    buildAgent: ({ engine, model }: { engine: ParityEngine; model: LanguageModelV2 }) => {
      const parked = deferred<void>();
      const release = deferred<void>();
      const toolLog: number[] = [];
      const memory = new MockMemory();
      const step = createTool({
        id: STEP_TOOL,
        description: 'Perform numbered step n.',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }, context) => {
          toolLog.push(n);
          if (n === BLOCK_AT) {
            // Parked at the checkpoint exactly like the harness tool (which
            // falls back after 3 s; here the test releases it instead).
            parked.resolve();
            await Promise.race([aborted(context.abortSignal), release.promise]);
          }
          return { done: n };
        },
      });
      states.set(engine, { memory, parked, release, toolLog, callbacks: [] });
      return new Agent({
        id: AGENT_ID,
        name: AGENT_ID,
        instructions: 'Follow the script.',
        model,
        tools: { step },
        memory,
      });
    },
    run: async (handle: EngineHandle) => {
      const state = states.get(handle.engine)!;
      const controller = new AbortController();
      const runId = runIdFor(handle.engine);
      const turn = handle.turn('go', {
        runId,
        maxSteps: MAX_STEPS,
        // The run has a memory thread: `abortRunStream` tracks thread-bound
        // streams, and a durable run's controller lives on its run registry.
        memory: { thread: `thread-t14-${variant}`, resource: `resource-t14-${variant}` },
        ...(variant === 'signal' ? { abortSignal: controller.signal } : {}),
        onAbort: () => {
          state.callbacks.push('onAbort');
        },
        onFinish: () => {
          state.callbacks.push('onFinish');
        },
      });
      await state.parked.promise;
      state.accepted = variant === 'run' ? abortRun(handle, runId) : (controller.abort(), true);
      try {
        // Settling here is the "stream settled after abort (no hang)" check: a
        // stream that ignored the abort would hold this turn open until the
        // test times out.
        state.snapshot = await turn;
      } finally {
        state.release.resolve();
      }
    },
  };

  const results = await expectEngineParity(scenario);
  return { results, states };
}

describe('T14 abort parity', () => {
  afterEach(() => {
    globalRunRegistry.clear();
  });

  for (const variant of VARIANTS) {
    it(`aborts a parked run and surfaces the abort surface (${variant})`, async () => {
      const { results, states } = await runT14(variant);

      for (const engine of ENGINES) {
        const state = states.get(engine)!;
        const snapshot = state.snapshot;
        expect(snapshot, `${engine}: turn settled after the abort`).toBeDefined();
        expect(state.accepted, `${engine}: abort accepted`).toBe(true);
        expect(chunksOfType(snapshot!, 'abort'), `${engine}: abort chunk`).toBe(1);
        expect(chunksOfType(snapshot!, 'error'), `${engine}: no error chunk`).toBe(0);
        expect(chunksOfType(snapshot!, 'finish'), `${engine}: finish chunk`).toBe(1);
        expect(state.callbacks, `${engine}: onAbort fired and onFinish did not`).toEqual(['onAbort']);
        expect(state.toolLog, `${engine}: step 3 never started`).toEqual([1, BLOCK_AT]);
        // Two calls happen before the abort (step 1, then step 2 parked), so a
        // run that made a call after the abort would report more.
        expect(results[engine]!.requests, `${engine}: no model call after the abort`).toHaveLength(2);
      }

      expectPlainT14Reference(results.plain!);
    });
  }
});

/**
 * Literal contract for the plain engine. The helper treats plain as the
 * reference, so pinning its values stops a plain-side change from silently
 * moving that reference and keeping the engines "in parity".
 *
 * Plain finalises the parked, abort-observing step before it terminates: the
 * aborted step's tool result is delivered a second time (the extra
 * `tool-result` after the second `step-finish`) and the run finishes with
 * `reason: 'tripwire'`. This is plain's abort surface and is the reference the
 * harness's own recorded plain cell has
 * (`results/2026-09-29T20-29-45.968Z/plain-run-none-head`).
 */
function expectPlainT14Reference(result: EngineRunResult): void {
  const snapshot = result.turns.at(-1)!;
  expect(snapshot.chunkTypes).toEqual([
    'start',
    'step-start',
    'tool-call',
    'tool-result',
    'step-finish',
    'step-start',
    'tool-call',
    'tool-result',
    'step-finish',
    'tool-result',
    'abort',
    'finish',
  ]);
  expect(snapshot.finishReason).toBe('aborted');
  expect(snapshot.finishChunk?.reason).toBe('tripwire');
  expect(snapshot.toolResults).toHaveLength(3);
}
