/**
 * Ported from validation harness case T36 (callback-order) — in-tree home for case T36.
 *
 * Protects the lifecycle-callback contract of a run: which callbacks fire, in what order, and what
 * each one receives, on plain, durable and evented agents. The harness drives the callbacks from
 * outside the stream (`onChunk`, `onStepFinish`, `onFinish`, `onError`, `onAbort`), records the name
 * order and each payload's key set, and compares that contract per engine; the parity helper owns
 * the stream snapshot.
 *
 * Two shapes are ported:
 *   - `normal` — two tool steps (`STEP_COUNT`), then an answer: three step-finish chunks in all, the
 *     extra one closing the answering step.
 *   - `abort`  — aborted once the step tool reports it is parked, so no timer decides it.
 *
 * One shape is held rather than weakened:
 *   - `error` (the model fails on the call after the first tool result) is unexpressible here. The
 *     failure reaches plain as a rejecting `getFullOutput()`, and the parity helper records a turn
 *     through that call, so the turn never lands in the observation and the run aborts the whole
 *     comparison — the same wall as T44/T45 `throws` and T47 `strict`, queued behind COR-1417.
 *
 * The engines also genuinely disagree on what the callbacks themselves see — the harness's own
 * recorded pairing for the callback contract is red, and the helper does not compare callbacks — so
 * each engine's contract is pinned literally below, with plain's as the reference. One of those
 * divergences is ticketed: plain's `onFinish` payload carries keys the wrappers do not (COR-1390).
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import type {
  CapturedRequest,
  EngineHandle,
  EngineParityResults,
  EngineParityScenario,
  EngineTurnOptions,
  ModelScript,
  ParityEngine,
  ParitySnapshot,
} from './parity-harness';
import { expectEngineParity, textOnlyTape, toolCallTape } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const AGENT_ID = 't36-agent';
const STEP_TOOL = 'step';
const MAX_STEPS = 4;
const STEP_COUNT = 2;
/** The step the abort variant parks on, so the abort lands at an exact point. */
const ABORT_BLOCK_AT = 1;

type Variant = 'normal' | 'abort';
const VARIANTS: readonly Variant[] = ['normal', 'abort'];

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

/** The harness's script: run `STEP_COUNT` numbered steps, then answer. */
const script: ModelScript = {
  respond: request => {
    const done = toolResultCount(request);
    if (done < STEP_COUNT) return toolCallTape(STEP_TOOL, { n: done + 1 }, `step-${done + 1}`);
    return textOnlyTape(`finished ${done} steps`);
  },
};

/** True when `sub` appears in `full` in order, allowing other entries between. */
function isSubsequence(sub: string[], full: string[]): boolean {
  return (
    full.reduce((index, entry) => (index < sub.length && sub[index] === entry ? index + 1 : index), 0) === sub.length
  );
}

/**
 * One turn's stream options. `onStepFinish` is deliberately absent from the helper's shared option
 * type — its payload type differs between plain and durable agents (`ParityStreamOptions` documents
 * this) — so it is supplied through the intersection type the helper documents for that case. The
 * `abortSignal` is installed on every variant, as the harness does; it is only aborted in `abort`.
 */
function turnOptions(
  engine: ParityEngine,
  state: EngineCaseState,
  abortSignal: AbortSignal,
): EngineTurnOptions & { onStepFinish?: (payload: unknown) => void } {
  const record = (name: string, payload: unknown) => {
    state.names.push(name);
    state.payloadKeys.push({ name, keys: Object.keys(payload as object).sort() });
  };
  return {
    runId: `t36-run-${engine}`,
    maxSteps: MAX_STEPS,
    abortSignal,
    memory: { thread: 'thread-t36', resource: 'resource-t36' },
    onChunk: chunk => {
      state.chunkTypes.push(chunk.type);
    },
    onStepFinish: payload => record('onStepFinish', payload),
    onFinish: payload => record('onFinish', payload),
    onError: payload => record('onError', payload),
    onAbort: payload => record('onAbort', payload),
  };
}

interface EngineCaseState {
  /** Names of the non-`onChunk` callbacks, in the order they fired. */
  names: string[];
  /** Payload key sets (`Object.keys(payload).sort()`) per callback firing. */
  payloadKeys: Array<{ name: string; keys: string[] }>;
  /** Chunk types the public `onChunk` callback saw, in order. */
  chunkTypes: string[];
  /** Whether the parked tool observed the abort (`toolLog`'s `released` events, as the harness reads it). */
  released: boolean[];
  threw?: string;
  snapshot?: ParitySnapshot;
}

async function runT36(variant: Variant): Promise<{
  results: EngineParityResults;
  states: Map<ParityEngine, EngineCaseState>;
}> {
  const states = new Map<ParityEngine, EngineCaseState>();
  const parking = new Map<ParityEngine, { parked: Deferred<void>; release: Deferred<void> }>();
  const controllers = new Map<ParityEngine, AbortController>();

  const scenario: EngineParityScenario = {
    model: script,
    buildAgent: ({ engine, model }: { engine: ParityEngine; model: LanguageModelV2 }) => {
      const parked = deferred<void>();
      const release = deferred<void>();
      const state: EngineCaseState = { names: [], payloadKeys: [], chunkTypes: [], released: [] };
      states.set(engine, state);
      parking.set(engine, { parked, release });
      const step = createTool({
        id: STEP_TOOL,
        description: 'Perform numbered step n.',
        inputSchema: z.object({ n: z.number() }),
        execute: async ({ n }, context) => {
          if (variant === 'abort' && n === ABORT_BLOCK_AT) {
            // Parked exactly like the harness tool (which falls back after 5 s; here the test
            // releases it instead), and the abort is raised once the tool says it has arrived.
            parked.resolve();
            await Promise.race([aborted(context.abortSignal), release.promise]);
            state.released.push(Boolean(context.abortSignal?.aborted));
          }
          return { done: n };
        },
      });
      const memory = new MockMemory();
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
      controllers.set(handle.engine, controller);
      const turn = handle.turn('go', turnOptions(handle.engine, state, controller.signal));
      if (variant === 'abort') {
        await parking.get(handle.engine)!.parked.promise;
        controller.abort();
      }
      try {
        // Settling here is the "stream settled after abort (no hang)" check: a stream that ignored
        // the abort would hold this turn open until the test times out.
        state.snapshot = await turn;
      } catch (error) {
        state.threw = String((error as Error)?.message ?? error).slice(0, 200);
      } finally {
        parking.get(handle.engine)!.release.resolve();
      }
    },
  };

  const results = await expectEngineParity(scenario);
  return { results, states };
}

/**
 * The public stream plain produced for the `normal` shape, pinned so a plain-side change cannot move
 * silently. Read off a live run of this scenario (same values the harness records as `publicTypes`).
 */
const PLAIN_PUBLIC_CHUNK_TYPES = [
  'start',
  'step-start',
  'tool-call',
  'tool-result',
  'step-finish',
  'step-start',
  'tool-call',
  'tool-result',
  'step-finish',
  'step-start',
  'text-start',
  'text-delta',
  'text-end',
  'step-finish',
  'finish',
];

/**
 * `Object.keys(payload).sort()` for each `onStepFinish`, measured on all three engines (harness case
 * T36, `normal` shape; the callback contract it records is `names` + `payloadKeys`). The values are
 * identical durable vs evented, so the wrapped contract is expressed as plain's list minus the
 * `runId` key only plain sends.
 */
const PLAIN_STEP_FINISH_KEYS = [
  'content',
  'dynamicToolCalls',
  'dynamicToolResults',
  'files',
  'finishReason',
  'model',
  'providerMetadata',
  'reasoning',
  'reasoningText',
  'request',
  'response',
  'runId',
  'sources',
  'staticToolCalls',
  'staticToolResults',
  'stepType',
  'text',
  'toolCalls',
  'toolResults',
  'tripwire',
  'usage',
  'warnings',
];

/** Durable and evented observe the same callback contract, without plain's `runId` payload key. */
const WRAPPED_STEP_FINISH_KEYS = PLAIN_STEP_FINISH_KEYS.filter(key => key !== 'runId');

/**
 * `Object.keys(payload).sort()` for `onFinish`, measured on all three engines (same run as above).
 * COR-1390: plain's `onFinish` payload carries `runId`, `error`, `messages`, `model`, `object` and
 * `usedFallbackValue`, none of which reach the wrapped engines' `onFinish`, so the two key sets are
 * pinned separately rather than derived from each other. Pinning the wrapped set at its current keys
 * is what makes this go stale — and red — when COR-1390 lands. The parity helper compares streams,
 * not callbacks, so the ticket is declared here instead of in `differences`.
 */
const PLAIN_FINISH_KEYS = [
  'content',
  'dynamicToolCalls',
  'dynamicToolResults',
  'error',
  'files',
  'finishReason',
  'messages',
  'model',
  'object',
  'providerMetadata',
  'reasoning',
  'reasoningText',
  'request',
  'response',
  'runId',
  'sources',
  'staticToolCalls',
  'staticToolResults',
  'steps',
  'text',
  'toolCalls',
  'toolResults',
  'totalUsage',
  'usage',
  'usedFallbackValue',
  'warnings',
];

const WRAPPED_FINISH_KEYS = PLAIN_FINISH_KEYS.filter(
  key => !['runId', 'error', 'messages', 'model', 'object', 'usedFallbackValue'].includes(key),
);

/** `onAbort` received the same key set on every engine. */
const ON_ABORT_KEYS = ['steps', 'text'];

interface EngineCallbackContract {
  /** Non-`onChunk` callback names, in the order they fired. */
  callbacks: string[];
  /** Chunk types the public `onChunk` callback saw, in order. */
  onChunk: string[];
  /** `Object.keys(payload).sort()` per callback firing. */
  payloadKeys: Array<{ name: string; keys: string[] }>;
  /** Model calls the run made. */
  requests: number;
}

const CALLBACK_CONTRACTS: Record<ParityEngine, EngineCallbackContract> = {
  plain: {
    callbacks: ['onStepFinish', 'onStepFinish', 'onStepFinish', 'onFinish'],
    // Plain hands the callback the content chunks only; the wrappers also surface the structural
    // step/stream chunks, so the recorded pairing for this field is red in the harness too.
    onChunk: ['tool-call', 'tool-result', 'tool-call', 'tool-result', 'text-delta'],
    payloadKeys: [
      { name: 'onStepFinish', keys: PLAIN_STEP_FINISH_KEYS },
      { name: 'onStepFinish', keys: PLAIN_STEP_FINISH_KEYS },
      { name: 'onStepFinish', keys: PLAIN_STEP_FINISH_KEYS },
      { name: 'onFinish', keys: PLAIN_FINISH_KEYS },
    ],
    requests: 3,
  },
  durable: {
    callbacks: ['onStepFinish', 'onStepFinish', 'onStepFinish', 'onFinish'],
    onChunk: [
      'start',
      'tool-call',
      'tool-result',
      'step-finish',
      'tool-call',
      'tool-result',
      'step-finish',
      'text-start',
      'text-delta',
      'text-end',
      'step-finish',
    ],
    payloadKeys: [
      { name: 'onStepFinish', keys: WRAPPED_STEP_FINISH_KEYS },
      { name: 'onStepFinish', keys: WRAPPED_STEP_FINISH_KEYS },
      { name: 'onStepFinish', keys: WRAPPED_STEP_FINISH_KEYS },
      { name: 'onFinish', keys: WRAPPED_FINISH_KEYS },
    ],
    requests: 3,
  },
  evented: {
    callbacks: ['onStepFinish', 'onStepFinish', 'onStepFinish', 'onFinish'],
    onChunk: [
      'start',
      'tool-call',
      'tool-result',
      'step-finish',
      'tool-call',
      'tool-result',
      'step-finish',
      'text-start',
      'text-delta',
      'text-end',
      'step-finish',
    ],
    payloadKeys: [
      { name: 'onStepFinish', keys: WRAPPED_STEP_FINISH_KEYS },
      { name: 'onStepFinish', keys: WRAPPED_STEP_FINISH_KEYS },
      { name: 'onStepFinish', keys: WRAPPED_STEP_FINISH_KEYS },
      { name: 'onFinish', keys: WRAPPED_FINISH_KEYS },
    ],
    requests: 3,
  },
};

/** The public stream produced for the `abort` shape. */
const PLAIN_ABORT_PUBLIC_CHUNK_TYPES = [
  'start',
  'step-start',
  'tool-call',
  'tool-result',
  'step-finish',
  'abort',
  'finish',
];

const ABORT_CONTRACTS: Record<ParityEngine, EngineCallbackContract> = {
  plain: {
    callbacks: ['onStepFinish', 'onAbort'],
    onChunk: ['tool-call', 'tool-result'],
    payloadKeys: [
      { name: 'onStepFinish', keys: PLAIN_STEP_FINISH_KEYS },
      { name: 'onAbort', keys: ON_ABORT_KEYS },
    ],
    requests: 1,
  },
  durable: {
    callbacks: ['onStepFinish', 'onAbort'],
    onChunk: ['start', 'tool-call', 'tool-result', 'step-finish'],
    payloadKeys: [
      { name: 'onStepFinish', keys: WRAPPED_STEP_FINISH_KEYS },
      { name: 'onAbort', keys: ON_ABORT_KEYS },
    ],
    requests: 1,
  },
  evented: {
    callbacks: ['onStepFinish', 'onAbort'],
    onChunk: ['start', 'tool-call', 'tool-result', 'step-finish'],
    payloadKeys: [
      { name: 'onStepFinish', keys: WRAPPED_STEP_FINISH_KEYS },
      { name: 'onAbort', keys: ON_ABORT_KEYS },
    ],
    requests: 1,
  },
};

describe('T36 callback order parity', () => {
  it('fires the lifecycle callbacks in order', async () => {
    const { results, states } = await runT36('normal');

    for (const engine of ENGINES) {
      const state = states.get(engine)!;
      const snapshot = state.snapshot;
      const contract = CALLBACK_CONTRACTS[engine];

      expect(snapshot, `${engine}: turn settled`).toBeDefined();

      // harness: `callbacks fired in the recorded order`.
      expect(state.names, `${engine}: callback names`).toEqual(contract.callbacks);

      // harness: `onChunk types are an in-order subsequence of the public stream`.
      expect(
        isSubsequence(state.chunkTypes, snapshot!.chunkTypes),
        `${engine}: onChunk chunk types are an in-order subsequence of the public stream (${state.chunkTypes.join()})`,
      ).toBe(true);
      expect(state.chunkTypes, `${engine}: onChunk chunk types`).toEqual(contract.onChunk);

      // harness: `each callback received the recorded payload keys`.
      expect(state.payloadKeys, `${engine}: callback payload keys`).toEqual(contract.payloadKeys);

      expect(results[engine]!.requests, `${engine}: model calls`).toHaveLength(contract.requests);
      expect(state.threw, `${engine}: stream did not throw`).toBeUndefined();
    }

    expect(results.plain!.turns.at(-1)!.streamedText, 'plain: final text').toBe('finished 2 steps');
    expect(results.plain!.turns.at(-1)!.chunkTypes, 'plain: public chunk types').toEqual(PLAIN_PUBLIC_CHUNK_TYPES);
  });

  it('fires onAbort once, and no onFinish, when a parked run is aborted', async () => {
    const { results, states } = await runT36('abort');

    for (const engine of ENGINES) {
      const state = states.get(engine)!;
      const snapshot = state.snapshot;
      const contract = ABORT_CONTRACTS[engine];

      expect(snapshot, `${engine}: turn settled after the abort`).toBeDefined();
      expect(state.threw, `${engine}: stream did not throw`).toBeUndefined();

      // harness: `onAbort once and no onFinish`.
      expect(
        state.names.filter(name => name === 'onAbort'),
        `${engine}: onAbort once`,
      ).toEqual(['onAbort']);
      expect(state.names, `${engine}: no onFinish`).not.toContain('onFinish');

      // harness: `parked tool observed the abort`.
      expect(state.released, `${engine}: parked tool observed the abort`).toContain(true);

      // harness: `no model call after the abort`.
      expect(results[engine]!.requests, `${engine}: no model call after the abort`).toHaveLength(contract.requests);

      // harness: `onChunk types are an in-order subsequence of the public stream`.
      expect(
        isSubsequence(state.chunkTypes, snapshot!.chunkTypes),
        `${engine}: onChunk chunk types are an in-order subsequence of the public stream (${state.chunkTypes.join()})`,
      ).toBe(true);

      // harness: `callbacks fired in the recorded order` and `each callback received the recorded
      // payload keys`.
      expect(state.names, `${engine}: callback names`).toEqual(contract.callbacks);
      expect(state.chunkTypes, `${engine}: onChunk chunk types`).toEqual(contract.onChunk);
      expect(state.payloadKeys, `${engine}: callback payload keys`).toEqual(contract.payloadKeys);
    }

    expect(results.plain!.turns.at(-1)!.chunkTypes, 'plain: public chunk types').toEqual(
      PLAIN_ABORT_PUBLIC_CHUNK_TYPES,
    );
    expect(results.plain!.turns.at(-1)!.finishReason, 'plain: finish reason').toBe('aborted');
    expect(results.plain!.turns.at(-1)!.finishChunk?.reason, 'plain: finish chunk reason').toBe('abort');
    expect(results.plain!.turns.at(-1)!.toolResults, 'plain: tool results').toHaveLength(1);
  });
});
