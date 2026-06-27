/**
 * DurableAgent Scorers — End-to-end parity tests
 *
 * Complement to `durable-agent-scorers.test.ts` (which only covers
 * serialization). These tests prove that scorers configured on the
 * agent are actually executed by the durable workflow's final `.map`
 * scorer block, with the same payload shape that
 * `Agent.#runScorers` produces in the non-durable path.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { createScorer } from '../../../evals';
import type { ScoringHookInput } from '../../../evals';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { AvailableHooks, registerHook } from '../../../hooks';
import { Mastra } from '../../../mastra';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/**
 * Capture ON_SCORER_RUN payloads for the scorer ids owned by this suite.
 *
 * Hook registration is process-wide and our hooks module doesn't expose an
 * unregister API, so we filter on suite-unique scorer ids to avoid picking
 * up emissions from any other test running in the same worker. The empty
 * `afterAll` is intentional: the hook handler itself is harmless because
 * the filter rejects every non-matching payload.
 */
const SUITE_SCORER_IDS = new Set(['durable-parity-scorer', 'override-parity-scorer']);
const scorerHookPayloads: ScoringHookInput[] = [];

beforeAll(() => {
  registerHook(AvailableHooks.ON_SCORER_RUN, (payload: ScoringHookInput) => {
    const id = (payload as { scorer?: { id?: string } }).scorer?.id;
    if (id && SUITE_SCORER_IDS.has(id)) {
      scorerHookPayloads.push(payload);
    }
  });
});

afterAll(() => {
  scorerHookPayloads.length = 0;
});

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        {
          type: 'finish',
          finishReason: 'stop',
          usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
        },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/** Helper to wait until at least one scorer payload arrives. ON_SCORER_RUN fires via setImmediate. */
async function waitForScorerPayloads(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 25));
  }
  throw new Error(`Scorer payloads predicate not satisfied within ${timeoutMs}ms`);
}

describe('DurableAgent scorers — end-to-end parity', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
    scorerHookPayloads.length = 0;
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('runs the configured scorer and emits a payload that matches the non-durable shape', async () => {
    const taskScorer = createScorer({
      id: 'durable-parity-scorer',
      name: 'durable-parity-scorer',
      description: 'Parity scorer',
    }).generateScore(() => 0.87);

    const baseAgent = new Agent({
      id: 'scored-agent-1',
      name: 'scored-agent-1',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('Final answer.') as LanguageModelV2,
      scorers: { parity: { scorer: taskScorer } },
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Register the durable agent with Mastra so scorer execution can resolve
    // the scorer via mastra.getScorer(scorerName) at run time.
    const mastra = new Mastra({
      logger: false,
      agents: { scoredAgent: durableAgent as unknown as Agent },
    });
    void mastra;
    // Wait for agent-level scorer auto-registration to complete.
    await new Promise(resolve => setTimeout(resolve, 100));

    const { fullStream, cleanup } = await durableAgent.stream('Hello durable');
    for await (const _chunk of fullStream) {
      /* drain */
    }

    await waitForScorerPayloads(() => scorerHookPayloads.some(p => p.scorer?.id === 'durable-parity-scorer'));

    const payload = scorerHookPayloads.find(p => p.scorer?.id === 'durable-parity-scorer');
    expect(payload).toBeDefined();
    expect(payload!.entityType).toBe('AGENT');
    expect(payload!.source).toBe('LIVE');
    expect(payload!.entity).toEqual({ id: 'scored-agent-1', name: 'scored-agent-1' });

    // scorerInput parity: same shape Agent.#runScorers builds.
    expect(payload!.input).toEqual(
      expect.objectContaining({
        inputMessages: expect.any(Array),
        rememberedMessages: expect.any(Array),
        systemMessages: expect.any(Array),
        taggedSystemMessages: expect.any(Object),
      }),
    );
    expect((payload!.input as any).inputMessages.length).toBeGreaterThan(0);
    expect(payload!.output).toEqual(expect.any(Array));
    expect((payload!.output as unknown[]).length).toBeGreaterThan(0);

    cleanup();
  });

  it('supports per-call override scorers', async () => {
    const overrideScorer = createScorer({
      id: 'override-parity-scorer',
      name: 'override-parity-scorer',
      description: 'Override scorer',
    }).generateScore(() => 1);

    const baseAgent = new Agent({
      id: 'scored-agent-2',
      name: 'scored-agent-2',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('Done.') as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    // Register both the override scorer and the durable agent with Mastra.
    const mastra = new Mastra({
      logger: false,
      agents: { scoredAgent2: durableAgent as unknown as Agent },
      scorers: { override: overrideScorer } as any,
    });
    void mastra;
    await new Promise(resolve => setTimeout(resolve, 50));

    const { fullStream, cleanup } = await durableAgent.stream('Hello override', {
      scorers: { override: { scorer: overrideScorer } },
    } as any);
    for await (const _chunk of fullStream) {
      /* drain */
    }

    await waitForScorerPayloads(() => scorerHookPayloads.some(p => p.scorer?.id === 'override-parity-scorer'));

    const payload = scorerHookPayloads.find(p => p.scorer?.id === 'override-parity-scorer');
    expect(payload).toBeDefined();
    expect(payload!.entity).toEqual({ id: 'scored-agent-2', name: 'scored-agent-2' });

    cleanup();
  });

  it('does not invoke scorers when none are configured', async () => {
    const baseAgent = new Agent({
      id: 'no-scorer-agent',
      name: 'no-scorer-agent',
      instructions: 'You are a helpful assistant.',
      model: createTextModel('Plain answer.') as LanguageModelV2,
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { fullStream, cleanup } = await durableAgent.stream('Hello plain');
    for await (const _chunk of fullStream) {
      /* drain */
    }

    // Give any spurious setImmediate-deferred hook a chance to fire.
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(scorerHookPayloads.filter(p => p.entity?.id === 'no-scorer-agent')).toEqual([]);

    cleanup();
  });
});
