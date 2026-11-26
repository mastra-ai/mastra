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
 * COR-1390 is declared below for `retry`, `call-time` and `fallback`, on durable and evented:
 * durable and evented own the retry loop, so every model attempt emits its own `step-start`;
 * plain injects a single `step-start` from the AI SDK's result callback. Each failed attempt
 * therefore adds one `step-start` chunk to the public stream that plain never streams
 * (`retry` and `call-time` two, `fallback` one) while the requests the model sees stay
 * identical.
 *
 * `retry-zero-defaults`, whose default error-processor stack retries the failed step, needs no
 * declaration: every engine re-attempts the request within the same step, so each streams one
 * `step-start` per attempt, counts one step and reports the usage the model returned (COR-1554).
 *
 * Each declaration derives those values from plain's own observation instead of ignoring the
 * fields, so the leg fails again the moment either side is fixed, and the helper refuses a
 * declaration that has stopped reproducing. Plain's values are pinned literally, read from
 * the observation `expectEngineParity` returns. Nothing is pinned per engine and the helper
 * is not modified.
 *
 * `retry-zero` now runs through the same helper as the successful variants. Its
 * call-level failure produces an identical `finish.stepResult` on every engine,
 * so that COR-1390 declaration is not applicable to this scenario.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { describe, expect, it } from 'vitest';
import {
  chunksOfType,
  createRecordingModel,
  expectEngineParity,
  textOnlyTape,
} from '../../../loop/test-utils/aimock/parity';
import type {
  EngineObservation,
  EngineParityResults,
  ModelScript,
  ParityEngine,
  ParitySnapshot,
} from '../../../loop/test-utils/aimock/parity';
import { MockMemory } from '../../../memory/mock';
import { Agent } from '../../agent';

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

async function runRetryZero() {
  const served = new Map<ParityEngine, string[]>();
  const results = await expectEngineParity({
    engines: ENGINES,
    model: failingScript(1),
    buildAgent: ({ engine, model }) => {
      served.set(engine, []);
      return new Agent({
        id: `t27-agent-retry-zero-${engine}`,
        name: 't27',
        instructions: 'Follow the script.',
        model: labelledModel(model, SINGLE_MODEL_ID, id => served.get(engine)!.push(id)),
        memory: new MockMemory(),
        maxRetries: 0,
        errorProcessorDefaults: false,
      });
    },
    run: async handle => {
      await handle.turn('Go.', {
        maxSteps: MAX_STEPS,
        modelSettings: { maxRetries: 3 },
        memory: { thread: 't27-thread-retry-zero', resource: 't27-resource-retry-zero' },
      });
    },
  });
  return { results, served };
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

function extraStepStartDifference(attempts: number): EngineDifference {
  return {
    reason:
      `COR-1390: durable and evented own the retry loop, so each of the ${attempts} model attempts emits its own ` +
      `step-start where plain injects a single one from the AI SDK's result callback: ${attempts - 1} extra ` +
      'step-start chunk(s) on the public stream, with the requests the model sees unchanged.',
    expect: plain => withExtraAttemptStarts(plain, attempts),
  };
}

function heldDifferences(variant: HeldVariant): Partial<Record<Exclude<ParityEngine, 'plain'>, EngineDifference>> {
  if (variant === 'retry-zero-defaults') return {};
  const difference = extraStepStartDifference(variant === 'fallback' ? 2 : 3);
  return { durable: difference, evented: difference };
}

// ---------------------------------------------------------------------------
// The four variants that succeed after a failed attempt
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
    const { results, served } = await runRetryZero();
    for (const engine of ENGINES) {
      const turn = turnOf(results, engine);
      expect(results[engine]!.requests).toHaveLength(1);
      expect(served.get(engine)).toEqual([SINGLE_MODEL_ID]);
      expect(chunksOfType(turn, 'finish')).toBe(1);
      expect(chunksOfType(turn, 'error')).toBe(1);
      expect(turn.finishReason).toBe('error');
      expect(turn.text).toBe('');
      expect(turn.error?.message).toContain('T27 failure 1');
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
    // The failed request is re-attempted within the same step (COR-1554): one step-start per
    // attempt, one step, and the usage the model reported.
    expect(plain.stepCount).toBe(1);
    expect(plain.usage).toEqual({ ...REPORTED_USAGE, raw: REPORTED_USAGE });
    expect(plain.chunkTypes).toEqual([
      'start',
      'step-start',
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
