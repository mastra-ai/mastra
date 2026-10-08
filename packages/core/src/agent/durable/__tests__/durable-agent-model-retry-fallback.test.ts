/**
 * Ported from validation harness case T27 (model-retry-fallback).
 *
 * All five harness variants are ported here:
 *
 *   retry                agent maxRetries: 2, model fails twice        -> 3 attempts, success
 *   retry-zero           agent maxRetries: 0 + call-time 3, errorProcessorDefaults: false
 *                        -> 1 attempt, the run fails
 *   retry-zero-defaults  agent maxRetries: 0 + call-time 3, default error-processor stack
 *                        -> 2 attempts, success
 *   call-time            agent leaves maxRetries unset, call-time 2    -> 3 attempts, success
 *   fallback             [always-failing non-retryable, good]          -> the second model answers
 *
 * `retry-zero` pins the precedence `llm-execution-step.ts` implements: an explicit agent
 * `maxRetries: 0` beats a call-time `modelSettings.maxRetries: 3`, so the loop makes exactly
 * one model attempt and the run fails. The script model throws an error the AI SDK retry
 * ladder treats as retryable (an `APICallError`-tagged Error with `isRetryable`), so the
 * recording model's own request array tells how many attempts the loop made.
 *
 * COR-1390 is declared below for the other four variants, on durable and evented, twice over:
 *
 *  - durable and evented own the retry loop, so every model attempt emits its own
 *    `step-start`; plain injects a single `step-start` from the AI SDK's result callback.
 *    Each failed attempt therefore adds one `step-start` chunk to the public stream that
 *    plain never streams (`retry` and `call-time` two, `fallback` one) while the requests
 *    the model sees stay identical.
 *  - `retry-zero-defaults`, whose default error-processor stack retries the failed step,
 *    diverges the other way: plain closes the failed step (an extra `step-finish` carrying
 *    `reason: 'retry'`, `stepCount` 2) and drops the terminating step's usage, where durable
 *    and evented keep one step and report the usage the model returned.
 *
 * Each declaration derives those values from plain's own observation instead of ignoring the
 * fields, so the leg fails again the moment either side is fixed, and the helper refuses a
 * declaration that has stopped reproducing. Plain's values are pinned literally, read from
 * the observation `expectEngineParity` returns. Nothing is pinned per engine and the helper
 * is not modified.
 *
 * Deviation from the harness, stated per the case's port notes: the harness drives
 * `retry-zero` alongside the others and compares each cell's contract. The variant is
 * therefore driven per engine here and asserted the way the harness judges it: the attempt
 * count on each engine, that the run settled as a failure, and the harness's own cross-engine
 * comparison of the whole contract.
 *
 * It cannot move onto `expectEngineParity`. Since COR-1417 the helper does record a failed run
 * (as `snapshot.error`), but on this scenario all three engines emit the same non-empty
 * `finish.stepResult` (`{ reason: 'error', warnings: [], isContinued: false }`), which makes the
 * helper's global staleness guard fire on COR-1390's `finish` entry — "payload 'stepResult' no
 * longer differs from plain; remove it from KNOWN_CHUNK_DIFFERENCES" — before any per-scenario
 * comparison runs. That guard is not overridable, so the run is driven directly instead.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { createEventedAgent } from '../create-evented-agent';
import {
  chunksOfType,
  createRecordingModel,
  expectEngineParity,
  textOnlyTape,
  type EngineDifference,
  type EngineObservation,
  type EngineParityResults,
  type ModelScript,
  type ParityEngine,
  type ParitySnapshot,
} from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const MAX_STEPS = 3;
const SINGLE_MODEL_ID = 'script';

/** `textOnlyTape`'s default usage, which is what the model reports on every call here. */
const REPORTED_USAGE = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

/** One successful model call on plain: a single step, no extra attempts. */
const PLAIN_SINGLE_STEP_CHUNK_TYPES = [
  'start',
  'step-start',
  'text-start',
  'text-delta',
  'text-end',
  'step-finish',
  'finish',
];

/**
 * The AI SDK retry ladder only retries an error that `APICallError.isInstance()`
 * accepts (a `Symbol.for` marker check) and that carries `isRetryable === true`,
 * so a plain Error tagged with the two markers is retried exactly like a provider
 * 5xx. Mirrors the harness's `scriptError`.
 */
function retryableError(message: string): Error {
  const error = new Error(message) as Error & Record<symbol | string, unknown>;
  error[Symbol.for('vercel.ai.error')] = true;
  error[Symbol.for('vercel.ai.error.AI_APICallError')] = true;
  error.isRetryable = true;
  error.statusCode = 503;
  return error;
}

/** Fails the first `times` attempts of the call, then answers. */
function failingScript(times: number): ModelScript {
  return {
    respond: (_request, callIndex) => {
      if (callIndex < times) throw retryableError(`T27 failure ${callIndex + 1}`);
      return textOnlyTape('recovered after retries');
    },
  };
}

/**
 * Labels a model without leaving the helper's recording path: the clone keeps the
 * prototype getter and delegates `doStream` to the original method, so the helper's
 * `requests` array still sees every call, while `onCall` records which model served.
 */
function labelledModel(model: LanguageModelV2, modelId: string, onCall: (id: string) => void): LanguageModelV2 {
  const clone = Object.assign(Object.create(Object.getPrototypeOf(model)), model, { modelId }) as LanguageModelV2;
  const inner = clone.doStream;
  clone.doStream = options => {
    onCall(modelId);
    return inner(options);
  };
  return clone;
}

type FailedRunContract = {
  attempts: number;
  models: string[];
  finish: number;
  errors: string[];
  threw: string | null;
  finalText: string;
};

/** Drives one engine directly so a rejected run is recorded instead of thrown. */
async function runRetryZeroOnEngine(engine: ParityEngine): Promise<FailedRunContract> {
  const served: string[] = [];
  const recorded = createRecordingModel(failingScript(1));
  const model = labelledModel(recorded.model, SINGLE_MODEL_ID, id => served.push(id));
  const agent = new Agent({
    id: `t27-agent-${engine}`,
    name: 't27',
    instructions: 'Follow the script.',
    model,
    memory: new MockMemory(),
    maxRetries: 0,
    errorProcessorDefaults: false,
  });

  const pubsub = new EventEmitterPubSub();
  const wrapper =
    engine === 'durable'
      ? createDurableAgent({ agent, pubsub })
      : engine === 'evented'
        ? createEventedAgent({ agent, pubsub })
        : undefined;
  const host = new Mastra({
    agents: { [agent.id]: wrapper ?? agent },
    storage: new InMemoryStore(),
    logger: false,
  });

  const errors: string[] = [];
  let finish = 0;
  let finalText = '';
  let threw: string | null = null;
  try {
    const runner: { stream: (input: string, options: Record<string, unknown>) => Promise<unknown> } = wrapper ?? agent;
    const result = (await runner.stream('Go.', {
      maxSteps: MAX_STEPS,
      runId: `t27-retry-zero-${engine}`,
      memory: { thread: `t27-thread-retry-zero-${engine}`, resource: `t27-resource-retry-zero-${engine}` },
      modelSettings: { maxRetries: 3 },
    })) as { output?: { fullStream: AsyncIterable<Record<string, any>> }; cleanup?: () => void };
    const output = (result.output ?? result) as { fullStream: AsyncIterable<Record<string, any>> };
    for await (const chunk of output.fullStream) {
      if (chunk.type === 'finish') finish += 1;
      if (chunk.type === 'text-delta') finalText += String(chunk.payload?.text ?? '');
      if (chunk.type === 'error') errors.push(String(chunk.payload?.error?.message ?? '').slice(0, 120));
    }
    result.cleanup?.();
  } catch (error) {
    threw = String((error as { message?: string })?.message ?? error).slice(0, 200);
  } finally {
    await host.shutdown();
    await pubsub.close();
  }

  return { attempts: recorded.requests.length, models: served, finish, errors, threw, finalText };
}

// ---------------------------------------------------------------------------
// COR-1390 declarations (durable and evented)
// ---------------------------------------------------------------------------

/**
 * The `step-start` chunks the failed attempts add. Both the type and the payload
 * are taken from the run's own first `step-start`, so the extra attempts are
 * exactly the chunk plain already streams and nothing is invented.
 */
function withExtraAttemptStarts(plain: EngineObservation, attempts: number): EngineObservation {
  const extra = attempts - 1;
  if (extra <= 0) return plain;
  return {
    ...plain,
    turns: plain.turns.map(turn => {
      const at = turn.chunkTypes.indexOf('step-start');
      if (at < 0) return turn;
      const grow = <T>(values: readonly T[]): T[] => [
        ...values.slice(0, at + 1),
        ...Array.from({ length: extra }, () => structuredClone(values[at]!)),
        ...values.slice(at + 1),
      ];
      return {
        ...turn,
        chunkTypes: grow(turn.chunkTypes),
        chunks: grow(turn.chunks),
        chunkPayloads: grow(turn.chunkPayloads),
      };
    }),
  };
}

/**
 * The usage plain drops on the failed-step path, restored to the counts the model
 * reported. Plain still carries the full object under `raw`, so the expectation is
 * derived from plain's own observation rather than a literal.
 */
function reportedUsage(usage: unknown): ParitySnapshot['usage'] {
  const current = usage as Partial<ParitySnapshot['usage']>;
  const raw = current.raw as { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;
  if (raw === undefined) {
    return {
      inputTokens: current.inputTokens,
      outputTokens: current.outputTokens,
      totalTokens: current.totalTokens,
      raw: current.raw,
    };
  }
  return {
    inputTokens: raw.inputTokens,
    outputTokens: raw.outputTokens,
    totalTokens: raw.totalTokens,
    raw,
  };
}

/**
 * `retry-zero-defaults`: plain closes the failed step and drops the terminating
 * step's usage; durable and evented do neither. The transform removes the extra
 * `step-finish`, drops the step plain closed, and restores the usage.
 */
function withFailedStepClosed(plain: EngineObservation): EngineObservation {
  return {
    ...plain,
    turns: plain.turns.map(turn => {
      const at = turn.chunkTypes.indexOf('step-finish');
      if (at < 0) return turn;
      const drop = <T>(values: readonly T[]): T[] => [...values.slice(0, at), ...values.slice(at + 1)];
      return {
        ...turn,
        chunkTypes: drop(turn.chunkTypes),
        chunks: drop(turn.chunks),
        chunkPayloads: drop(turn.chunkPayloads),
        stepCount: turn.stepCount - 1,
        usage: reportedUsage(turn.usage),
        finishChunk: { ...turn.finishChunk, usage: reportedUsage(turn.finishChunk.usage) },
        fullOutput: { ...turn.fullOutput, usage: reportedUsage(turn.fullOutput.usage) },
      };
    }),
  };
}

function extraStepStartDifference(attempts: number): EngineDifference {
  return {
    reason:
      `COR-1390: durable and evented own the retry loop, so each of the ${attempts} model attempts emits its own ` +
      `step-start where plain injects a single one from the AI SDK's result callback: ${attempts - 1} extra ` +
      'step-start chunk(s) on the public stream, with the requests the model sees unchanged.',
    expect: plain => withExtraAttemptStarts(plain, attempts),
  };
}

const closedFailedStepDifference: EngineDifference = {
  reason:
    'COR-1390: with the default error-processor stack plain closes the failed step — an extra step-finish with ' +
    "reason 'retry' and a step count of 2 — and drops the terminating step's usage, where durable and evented " +
    'keep one step and report the usage the model returned.',
  expect: withFailedStepClosed,
};

function heldDifferences(variant: HeldVariant): Partial<Record<Exclude<ParityEngine, 'plain'>, EngineDifference>> {
  const difference =
    variant === 'retry' || variant === 'call-time'
      ? extraStepStartDifference(3)
      : variant === 'fallback'
        ? extraStepStartDifference(2)
        : closedFailedStepDifference;
  return { durable: difference, evented: difference };
}

// ---------------------------------------------------------------------------
// The four variants the COR-1390 declaration unblocks
// ---------------------------------------------------------------------------

type HeldVariant = 'retry' | 'retry-zero-defaults' | 'call-time' | 'fallback';

const FALLBACK_TEXT = 'answered by fallback';
const PRIMARY_ID = 'script-primary';
const FALLBACK_ID = 'script-fallback';

/** The harness's fallback primary fails with an untagged (non-retryable) error. */
const primaryDownScript: ModelScript = {
  respond: () => {
    throw new Error('T27 primary down');
  },
};

type HeldSetup = {
  script: ModelScript;
  agentMaxRetries?: number;
  modelSettings?: Record<string, unknown>;
  fallback?: boolean;
};

function heldSetup(variant: HeldVariant): HeldSetup {
  switch (variant) {
    case 'retry':
      return { script: failingScript(2), agentMaxRetries: 2 };
    case 'call-time':
      return { script: failingScript(2), modelSettings: { maxRetries: 2 } };
    case 'retry-zero-defaults':
      return { script: failingScript(1), agentMaxRetries: 0, modelSettings: { maxRetries: 3 } };
    case 'fallback':
      return { script: primaryDownScript, fallback: true };
  }
}

/**
 * The harness's second model. `expectEngineParity` records only the one model it
 * builds, so this one is case-local and its call is tracked through `onCall`
 * instead — the harness's own `models` assertion is what reads it back.
 */
function fallbackModel(onCall: (id: string) => void): LanguageModelV2 {
  return labelledModel(createRecordingModel({ tapes: [textOnlyTape(FALLBACK_TEXT)] }).model, FALLBACK_ID, onCall);
}

/** Drives one held variant through the helper on every engine. */
async function runHeldVariant(variant: HeldVariant) {
  const setup = heldSetup(variant);
  const served = new Map<ParityEngine, string[]>();
  const results = await expectEngineParity({
    engines: ENGINES,
    model: setup.script,
    buildAgent: ({ engine, model }) => {
      served.set(engine, []);
      const onCall = (id: string) => served.get(engine)!.push(id);
      const agentModel = setup.fallback
        ? ([
            { model: labelledModel(model, PRIMARY_ID, onCall), maxRetries: 0 },
            { model: fallbackModel(onCall), maxRetries: 0 },
          ] as unknown as LanguageModelV2)
        : model;
      return new Agent({
        id: `t27-agent-${variant}-${engine}`,
        name: 't27',
        instructions: 'Follow the script.',
        model: agentModel,
        memory: new MockMemory(),
        ...(setup.agentMaxRetries === undefined ? {} : { maxRetries: setup.agentMaxRetries }),
      });
    },
    run: async handle => {
      const { modelSettings } = setup;
      await handle.turn('Go.', {
        maxSteps: MAX_STEPS,
        ...(modelSettings ? { modelSettings } : {}),
        memory: { thread: `t27-thread-${variant}`, resource: `t27-resource-${variant}` },
      });
    },
    differences: heldDifferences(variant),
  });
  return { results, served };
}

function turnOf(results: EngineParityResults, engine: ParityEngine): ParitySnapshot {
  const turn = results[engine]?.turns.at(-1);
  if (!turn) throw new Error(`expectEngineParity recorded no turn for ${engine}`);
  return turn;
}

/** The harness's own success test: `finish === 1 && errors.length === 0 && !threw && finalText.length > 0`. */
function expectHarnessSuccess(turn: ParitySnapshot): void {
  expect(chunksOfType(turn, 'finish')).toBe(1);
  expect(turn.finishChunk.reason).toBe('stop');
  expect(turn.text.length).toBeGreaterThan(0);
}

describe('T27 model retry and fallback (plain, durable, evented)', () => {
  it('retry-zero: an explicit agent maxRetries of 0 beats call-time maxRetries: 3, and the run fails', async () => {
    const plain = await runRetryZeroOnEngine('plain');
    expect(plain.attempts).toBe(1);
    expect(plain.errors.length > 0 || plain.threw !== null).toBe(true);
    for (const engine of ENGINES.filter(engine => engine !== 'plain')) {
      const actual = await runRetryZeroOnEngine(engine);
      expect(actual.attempts).toBe(1);
      expect(actual.errors.length > 0 || actual.threw !== null).toBe(true);
      expect(actual).toEqual(plain);
    }
  });

  it('retry: two failed attempts are retried, so every engine calls the model three times and succeeds', async () => {
    const { results } = await runHeldVariant('retry');
    for (const engine of ENGINES) {
      expect(results[engine]!.requests, `${engine}: the retry loop saw every attempt`).toHaveLength(3);
      expectHarnessSuccess(turnOf(results, engine));
    }
    const plain = turnOf(results, 'plain');
    expect(plain.text).toBe('recovered after retries');
    expect(plain.stepCount).toBe(1);
    expect(plain.usage).toEqual({ ...REPORTED_USAGE, raw: REPORTED_USAGE });
    // The two extra step-starts durable and evented stream are the declared COR-1390 difference.
    expect(plain.chunkTypes).toEqual(PLAIN_SINGLE_STEP_CHUNK_TYPES);
  });

  it('call-time: a call-time maxRetries of 2 is honoured, so every engine calls the model three times', async () => {
    const { results } = await runHeldVariant('call-time');
    for (const engine of ENGINES) {
      expect(results[engine]!.requests, `${engine}: the retry loop saw every attempt`).toHaveLength(3);
      expectHarnessSuccess(turnOf(results, engine));
    }
    const plain = turnOf(results, 'plain');
    expect(plain.text).toBe('recovered after retries');
    expect(plain.stepCount).toBe(1);
    // The two extra step-starts durable and evented stream are the declared COR-1390 difference.
    expect(plain.chunkTypes).toEqual(PLAIN_SINGLE_STEP_CHUNK_TYPES);
  });

  it('retry-zero-defaults: the default error-processor stack retries the failed step, so every engine calls the model twice', async () => {
    const { results } = await runHeldVariant('retry-zero-defaults');
    for (const engine of ENGINES) {
      expect(results[engine]!.requests, `${engine}: the failed step was retried once`).toHaveLength(2);
      expectHarnessSuccess(turnOf(results, engine));
    }
    const plain = turnOf(results, 'plain');
    expect(plain.text).toBe('recovered after retries');
    // Plain closes the failed step, so it counts two steps and reports no usage counts on
    // any surface — the second half of the declared COR-1390 difference, which removes that
    // middle step-finish for durable and evented and restores the usage.
    expect(plain.stepCount).toBe(2);
    expect(plain.usage).toEqual({ raw: REPORTED_USAGE });
    expect(plain.chunkTypes).toEqual([
      'start',
      'step-start',
      'step-finish',
      'step-start',
      'text-start',
      'text-delta',
      'text-end',
      'step-finish',
      'finish',
    ]);
  });

  it('fallback: a non-retryable primary failure falls through to the second model on every engine', async () => {
    const { results, served } = await runHeldVariant('fallback');
    for (const engine of ENGINES) {
      expect(served.get(engine), `${engine}: the failed primary handed over to the fallback`).toEqual([
        PRIMARY_ID,
        FALLBACK_ID,
      ]);
      // Only the primary is the model the helper records.
      expect(results[engine]!.requests, `${engine}: the primary was called once`).toHaveLength(1);
      const turn = turnOf(results, engine);
      expectHarnessSuccess(turn);
      expect(turn.text).toBe(FALLBACK_TEXT);
    }
    // The single extra step-start durable and evented stream is the declared COR-1390 difference.
    expect(turnOf(results, 'plain').chunkTypes).toEqual(PLAIN_SINGLE_STEP_CHUNK_TYPES);
  });
});
