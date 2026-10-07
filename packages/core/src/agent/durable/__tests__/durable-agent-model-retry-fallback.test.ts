/**
 * Ported from validation harness case T27 (model-retry-fallback).
 *
 * This file ports the `retry-zero` variant only. An explicit agent `maxRetries: 0`
 * beats a call-time `modelSettings.maxRetries: 3`, so the loop makes exactly one
 * model attempt and the run fails — the precedence `llm-execution-step.ts`
 * implements. The script model throws an error the AI SDK retry ladder treats as
 * retryable (an `APICallError`-tagged Error with `isRetryable`), so the recording
 * model's own request array tells how many attempts the loop made.
 *
 * The four remaining variants are held pending a difference ticket: on each of
 * them durable and evented emit an extra `step-start` per failed model attempt
 * because they own the retry loop where plain injects a single `step-start` from
 * the AI SDK's `onResult`. `retry-zero-defaults` diverges further, reporting usage
 * and a step count where plain closes the failed step and drops usage. Held:
 *
 *   retry                agent maxRetries: 2, model fails twice        -> 3 attempts, success
 *   retry-zero-defaults  agent maxRetries: 0 + call-time 3, default error-processor stack
 *                        -> 2 attempts, success
 *   call-time            agent leaves maxRetries unset, call-time 2    -> 3 attempts, success
 *   fallback             [always-failing non-retryable, good]          -> the second model answers
 *
 * They will be added once that ticket exists with plain's values pinned literally
 * (measured by a direct plain drive, as the T18 and T23 anchors do) and durable
 * plus evented declared scenario-locally through a `differences` entry whose
 * `expect` derives the wrong values from plain. Nothing is pinned per engine and
 * the helper is not modified.
 *
 * Deviation from the harness, stated per the case's port notes: the harness drives
 * `retry-zero` alongside the others and compares each cell's contract. Here the run
 * fails, so plain rejects before producing a turn and `expectEngineParity` cannot
 * record it (it requires at least one plain turn). The variant is therefore driven
 * per engine and asserted the way the harness judges it: the attempt count on each
 * engine, that the run settled as a failure, and the harness's own cross-engine
 * comparison of the whole contract.
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
import { createRecordingModel, textOnlyTape, type ModelScript, type ParityEngine } from './parity-harness';

const ENGINES: ParityEngine[] = ['plain', 'durable', 'evented'];
const MAX_STEPS = 3;
const SINGLE_MODEL_ID = 'script';

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
});
