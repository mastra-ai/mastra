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
 *   - `abort`  — aborted once the step tool reports it is parked, so no timer decides it. Plain's
 *     abort surface (the aborted step's `tool-result` delivered a second time, the finish reported as
 *     `tripwire`) differs from the wrapped engines' and is declared below against COR-1415; every
 *     other field of the stream is still compared exactly.
 *
 *   - `error`  — one tool step, then the model call itself fails (`doStream` throws). The script model
 *     is what makes this shape inexpressible to the parity helper: its recording model always turns a
 *     tape into a stream, and a turn that fails on the model call leaves the helper's own
 *     `finish.stepResult` declaration with nothing to strip, so `expectEngineParity` rejects the
 *     scenario as a stale declaration before it compares anything. Each engine is therefore checked
 *     directly here, with no per-scenario override, and the checks are the harness's own for this
 *     shape — `onError` once, no `onFinish`, a step reported before the error.
 *
 * The engines also genuinely disagree on what the callbacks themselves see — the harness's own
 * recorded pairing for the callback contract is red, and the helper does not compare callbacks — so
 * each engine's contract is pinned literally below, with plain's as the reference. One of those
 * divergences is ticketed: plain's `onFinish` payload carries keys the wrappers do not (COR-1390).
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import type {
  CapturedRequest,
  EngineDifference,
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
/** What the failing model reports on the second call of the `error` shape (harness: `T36 model failure`). */
const ERROR_MESSAGE = 'T36 model failure';

/** The shapes that run through the parity helper; `error` is driven directly (see `runErrorDirect`). */
type StreamedVariant = 'normal' | 'abort';

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
 * COR-1415 — plain's abort surface. Plain delivers the aborted step's `tool-result` a second time,
 * immediately before the `abort` chunk, and reports `reason: 'tripwire'` on the finish chunk while
 * durable and evented abort directly. The `expect` maps plain's observation onto the wrapped
 * engines' shape, so the comparison outside these fields stays exact. When plain stops finalising
 * the aborted step the difference no longer reproduces and the helper fails the test, which is the
 * signal to delete this declaration.
 */
const ABORT_ARTIFACT: EngineDifference = {
  reason:
    "COR-1415: plain emits the aborted step's tool-result a second time and finishes the abort as 'tripwire'; durable and evented abort without it.",
  expect: plain => ({
    ...plain,
    turns: plain.turns.map(turn => {
      // Plain's spurious chunk sits directly before the abort chunk it also emits; both wrapped
      // engines go straight from the parked step to `abort`.
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

async function runT36(variant: StreamedVariant): Promise<{
  results: EngineParityResults;
  states: Map<ParityEngine, EngineCaseState>;
}> {
  const states = new Map<ParityEngine, EngineCaseState>();
  const parking = new Map<ParityEngine, { parked: Deferred<void>; release: Deferred<void> }>();
  const controllers = new Map<ParityEngine, AbortController>();

  const scenario: EngineParityScenario = {
    model: script,
    ...(variant === 'abort' ? { differences: { durable: ABORT_ARTIFACT, evented: ABORT_ARTIFACT } } : {}),
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

/**
 * The public stream plain produced for the `abort` shape: the abort lands while the step tool is
 * parked, and plain delivers that step's `tool-result` a second time before the `abort` chunk
 * (COR-1415). Pinned literally so a plain-side change — including the fix — fails here.
 */
const PLAIN_ABORT_PUBLIC_CHUNK_TYPES = [
  'start',
  'step-start',
  'tool-call',
  'tool-result',
  'step-finish',
  'tool-result',
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

/**
 * What a direct run of the `error` shape recorded on one engine — the harness's `error` contract
 * fields, read without the parity helper (see the file header for why this shape cannot go through
 * it).
 */
interface ErrorCaseState {
  /** Names of the non-`onChunk` callbacks, in the order they fired. */
  names: string[];
  /** Payload key sets (`Object.keys(payload).sort()`) per callback firing. */
  payloadKeys: Array<{ name: string; keys: string[] }>;
  /** Chunk types the public `onChunk` callback saw, in order. */
  chunkTypes: string[];
  /** Chunk types the public stream yielded, in order. */
  publicChunkTypes: string[];
  /** Model calls the run made. */
  requests: number;
  threw?: string;
  /** Set when `getFullOutput()` rejected — the harness's `fullOutputError`. */
  fullOutputError?: string;
}

/**
 * Drives one engine through the `error` shape, mirroring what the parity helper does per engine
 * (wrapper, host, one streamed turn), because the helper cannot run a model whose `doStream` throws.
 */
async function runErrorDirect(engine: ParityEngine): Promise<ErrorCaseState> {
  const requests: unknown[] = [];
  const model = new MockLanguageModelV2({
    doStream: async (options: unknown) => {
      requests.push(options);
      // The harness's script model: one tool step, then the model call itself fails.
      if (requests.length > 1) throw new Error(ERROR_MESSAGE);
      return {
        stream: convertArrayToReadableStream(toolCallTape(STEP_TOOL, { n: 1 }, 'step-1') as never[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
      };
    },
  });
  const state: ErrorCaseState = {
    names: [],
    payloadKeys: [],
    chunkTypes: [],
    publicChunkTypes: [],
    requests: 0,
  };
  const step = createTool({
    id: STEP_TOOL,
    description: 'Perform numbered step n.',
    inputSchema: z.object({ n: z.number() }),
    execute: async ({ n }) => ({ done: n }),
  });
  const agent = new Agent({
    id: AGENT_ID,
    name: AGENT_ID,
    instructions: 'Follow the script.',
    model: model as LanguageModelV2,
    tools: { step },
    memory: new MockMemory(),
  });
  const pubsub = new EventEmitterPubSub();
  const runner =
    engine === 'plain'
      ? agent
      : engine === 'durable'
        ? createDurableAgent({ agent, pubsub })
        : createEventedAgent({ agent });
  const host = new Mastra({
    agents: { [AGENT_ID]: runner } as never,
    storage: new InMemoryStore(),
    logger: false,
  });

  const record = (name: string, payload: unknown) => {
    state.names.push(name);
    state.payloadKeys.push({ name, keys: Object.keys((payload as object) ?? {}).sort() });
  };
  const options = {
    maxSteps: MAX_STEPS,
    runId: `t36-error-${engine}`,
    memory: { thread: 'thread-t36', resource: 'resource-t36' },
    onChunk: (chunk: { type: string }) => {
      state.chunkTypes.push(chunk.type);
    },
    onStepFinish: (payload: unknown) => record('onStepFinish', payload),
    onFinish: (payload: unknown) => record('onFinish', payload),
    onError: (payload: unknown) => record('onError', payload),
    onAbort: (payload: unknown) => record('onAbort', payload),
  };

  let cleanup: (() => Promise<void>) | undefined;
  let output: { fullStream: AsyncIterable<{ type: string }>; getFullOutput: () => Promise<unknown> } | undefined;
  try {
    if (engine === 'plain') {
      output = (await agent.stream('go', options)) as never;
    } else {
      // A settled stream is the harness's `the run settled` check: a run that hung would time out.
      const result = await (
        runner as unknown as {
          stream: (input: string, options: unknown) => Promise<{ output: never; cleanup: () => Promise<void> }>;
        }
      ).stream('go', options);
      output = result.output;
      cleanup = result.cleanup;
    }
  } catch (error) {
    state.threw = String((error as Error)?.message ?? error).slice(0, 200);
  }
  if (output) {
    try {
      for await (const chunk of output.fullStream) state.publicChunkTypes.push(chunk.type);
    } catch (error) {
      state.threw = state.threw ?? String((error as Error)?.message ?? error).slice(0, 200);
    }
    try {
      await output.getFullOutput();
    } catch (error) {
      state.fullOutputError = String((error as Error)?.message ?? error).slice(0, 200);
    }
  }
  state.requests = requests.length;
  if (cleanup) await cleanup();
  await host.shutdown();
  return state;
}

/**
 * The public stream all three engines produced for the `error` shape — the harness records these as
 * `publicTypes`, and they agree engine to engine (plain pinned literally, as everywhere else here).
 */
const ERROR_PUBLIC_CHUNK_TYPES = [
  'start',
  'step-start',
  'tool-call',
  'tool-result',
  'step-finish',
  'step-start',
  'error',
  'step-finish',
  'finish',
];

/** The `error` shape's `onChunk` and model-call contract, per engine (same run as the types above). */
const ERROR_CONTRACTS: Record<ParityEngine, { onChunk: string[]; requests: number }> = {
  plain: { onChunk: ['tool-call', 'tool-result'], requests: 2 },
  durable: {
    onChunk: ['start', 'tool-call', 'tool-result', 'step-finish', 'error', 'step-finish'],
    requests: 2,
  },
  evented: {
    onChunk: ['start', 'tool-call', 'tool-result', 'step-finish', 'error', 'step-finish'],
    requests: 2,
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

    // Plain's abort surface, pinned literally: the extra `tool-result` for the parked step and the
    // `tripwire` finish reason are COR-1415, declared for the wrapped engines above.
    expect(results.plain!.turns.at(-1)!.chunkTypes, 'plain: public chunk types').toEqual(
      PLAIN_ABORT_PUBLIC_CHUNK_TYPES,
    );
    expect(results.plain!.turns.at(-1)!.finishReason, 'plain: finish reason').toBe('aborted');
    expect(results.plain!.turns.at(-1)!.finishChunk?.reason, 'plain: finish chunk reason').toBe('tripwire');
    expect(results.plain!.turns.at(-1)!.toolResults, 'plain: tool results').toHaveLength(2);
  });

  it('reports a failed model call through onError, and never onFinish, without a throw', async () => {
    const states = new Map<ParityEngine, ErrorCaseState>();
    for (const engine of ENGINES) states.set(engine, await runErrorDirect(engine));

    for (const engine of ENGINES) {
      const state = states.get(engine)!;
      const contract = ERROR_CONTRACTS[engine];

      // harness: `the run settled` (the awaited call above) and did not throw out of the stream.
      expect(state.threw, `${engine}: stream did not throw`).toBeUndefined();

      // harness: `onError fires exactly once, and no onFinish`.
      expect(
        state.names.filter(name => name === 'onError'),
        `${engine}: onError once`,
      ).toEqual(['onError']);
      expect(state.names, `${engine}: no onFinish`).not.toContain('onFinish');

      // harness: `a step is reported before the error is`.
      expect(state.names.indexOf('onStepFinish'), `${engine}: a step finished before onError`).toBeGreaterThanOrEqual(
        0,
      );
      expect(state.names.indexOf('onStepFinish'), `${engine}: a step finished before onError`).toBeLessThan(
        state.names.indexOf('onError'),
      );

      // harness: `no model call after the failure` (one step tool call, then the failing call).
      expect(state.requests, `${engine}: model calls`).toBe(contract.requests);

      // harness: `onChunk types are an in-order subsequence of the public stream`.
      expect(state.chunkTypes, `${engine}: onChunk chunk types`).toEqual(contract.onChunk);
      expect(
        isSubsequence(state.chunkTypes, state.publicChunkTypes),
        `${engine}: onChunk chunk types are an in-order subsequence of the public stream (${state.chunkTypes.join()})`,
      ).toBe(true);
      expect(state.publicChunkTypes, `${engine}: public chunk types`).toEqual(ERROR_PUBLIC_CHUNK_TYPES);

      // harness: `each callback received the recorded payload keys`. Keyed by callback name so the
      // engines may report the same error at different points in the sequence (see the note below).
      const stepFinishKeys = engine === 'plain' ? PLAIN_STEP_FINISH_KEYS : WRAPPED_STEP_FINISH_KEYS;
      for (const entry of state.payloadKeys) {
        expect(entry.keys, `${engine}: ${entry.name} payload keys`).toEqual(
          entry.name === 'onError' ? ['error'] : stepFinishKeys,
        );
      }

      // The failure reaches the output reads on every engine: the run cannot be read as a result.
      expect(state.fullOutputError, `${engine}: getFullOutput rejects`).toContain(ERROR_MESSAGE);
    }

    // Plain's callback order, pinned literally (harness recording: `onStepFinish, onError,
    // onStepFinish`). Durable and evented report the error after both steps instead — a divergence
    // the harness does not check (it only requires a step before the error, asserted above) and for
    // which no ticket exists, so it is recorded here and not pinned.
    expect(states.get('plain')!.names, 'plain: callback names').toEqual(['onStepFinish', 'onError', 'onStepFinish']);
  });
});
