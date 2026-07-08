/**
 * DurableAgent isTaskComplete tests.
 *
 * Verifies that `options.isTaskComplete` is bridged into the durable workflow:
 * - The scorer instances + onComplete closure are kept on the in-process run
 *   registry (never serialized into workflowInput).
 * - Only the JSON-safe shadow (scorerNames/strategy/timeout/parallel/
 *   suppressFeedback) is serialized for observability.
 * - Scorers run inside the durable dowhile after each iteration where the LLM
 *   signaled completion, an `is-task-complete` chunk is emitted, and the loop
 *   either stops (passed) or continues with feedback (failed).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { RequestContext } from '../../../request-context';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
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

function createSequencedTextModel(texts: string[]) {
  let i = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const text = texts[Math.min(i, texts.length - 1)] ?? '';
      i++;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${i}`, modelId: 'mock-model-id', timestamp: new Date(0) },
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
      };
    },
  });
}

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

function passingScorer(score = 1, reason = 'looks good') {
  return {
    id: 'durable-task-scorer',
    name: 'Durable Task Scorer',
    run: vi.fn().mockResolvedValue({ score, reason }),
  };
}

function failingScorer(score = 0, reason = 'try harder') {
  return {
    id: 'durable-task-scorer-fail',
    name: 'Durable Task Scorer Fail',
    run: vi.fn().mockResolvedValue({ score, reason }),
  };
}

describe('DurableAgent isTaskComplete', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('keeps scorers + onComplete on the registry and serializes only the JSON-safe shadow', async () => {
    const baseAgent = new Agent({
      id: 'task-complete-prep-agent',
      name: 'Task Complete Prep Agent',
      instructions: 'noop',
      model: createTextModel('done') as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const scorer = passingScorer();
    const onComplete = vi.fn();

    const { workflowInput, registryEntry } = await durableAgent.prepare('hello', {
      isTaskComplete: {
        scorers: [scorer as any],
        strategy: 'all',
        timeout: 2000,
        parallel: true,
        suppressFeedback: true,
        onComplete,
      } as any,
    });

    // Closures and class instances stay on the registry.
    expect(registryEntry.isTaskComplete?.scorers?.[0]).toBe(scorer);
    expect((registryEntry.isTaskComplete as any)?.onComplete).toBe(onComplete);

    // The workflowInput carries only the JSON-safe sub-keys.
    const serialized = (workflowInput.options as any).isTaskComplete;
    expect(serialized).toEqual({
      scorerNames: ['Durable Task Scorer'],
      strategy: 'all',
      timeout: 2000,
      parallel: true,
      suppressFeedback: true,
    });
    // No closures leaked.
    expect(serialized.scorers).toBeUndefined();
    expect(serialized.onComplete).toBeUndefined();
  });

  it('omits isTaskComplete from workflowInput when no policy is configured', async () => {
    const baseAgent = new Agent({
      id: 'no-task-complete-agent',
      name: 'No Task Complete Agent',
      instructions: 'noop',
      model: createTextModel('done') as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const { workflowInput, registryEntry } = await durableAgent.prepare('hi');

    expect((workflowInput.options as any).isTaskComplete).toBeUndefined();
    expect(registryEntry.isTaskComplete).toBeUndefined();
  });

  it('stops the loop and emits is-task-complete with passed=true when scorers approve the answer', async () => {
    const model = createTextModel('Here is the final answer.');
    const baseAgent = new Agent({
      id: 'task-complete-pass-agent',
      name: 'Task Complete Pass Agent',
      instructions: 'noop',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const scorer = passingScorer(1, 'great work');
    const onComplete = vi.fn();

    const { output, cleanup } = await durableAgent.stream('go', {
      isTaskComplete: {
        scorers: [scorer as any],
        onComplete,
      } as any,
      maxSteps: 5,
    });

    const chunks = await drain(output.fullStream as unknown as ReadableStream<any>);
    await cleanup();

    const taskChunks = chunks.filter(c => c.type === 'is-task-complete');
    expect(taskChunks).toHaveLength(1);
    expect(taskChunks[0].payload.passed).toBe(true);
    expect(taskChunks[0].payload.iteration).toBe(1);

    // The scorer was invoked, and onComplete was called with the verdict.
    expect(scorer.run).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete.mock.calls[0]![0]).toMatchObject({ complete: true });

    // The loop stopped at iteration 1 — the model was only called once.
    // We can verify by checking we did not see multiple text-end chunks.
    const textEnd = chunks.filter(c => c.type === 'text-end');
    expect(textEnd).toHaveLength(1);
  });

  it('continues the loop with feedback when scorers reject the answer, then stops at maxSteps', async () => {
    const model = createSequencedTextModel(['first try', 'second try', 'third try']);
    const baseAgent = new Agent({
      id: 'task-complete-fail-agent',
      name: 'Task Complete Fail Agent',
      instructions: 'noop',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const scorer = failingScorer(0, 'incomplete');

    const { output, cleanup } = await durableAgent.stream('go', {
      isTaskComplete: {
        scorers: [scorer as any],
      } as any,
      maxSteps: 2,
    });

    const chunks = await drain(output.fullStream as unknown as ReadableStream<any>);
    await cleanup();

    const taskChunks = chunks.filter(c => c.type === 'is-task-complete');
    // Scorer runs after each iteration that the LLM signals done. With
    // maxSteps=2 the dowhile budget caps the loop at 2 iterations.
    expect(taskChunks.length).toBeGreaterThanOrEqual(1);
    expect(taskChunks.every(c => c.payload.passed === false)).toBe(true);

    // The model was invoked more than once (loop continued past the first
    // attempt because the scorer rejected it).
    const textEndChunks = chunks.filter(c => c.type === 'text-end');
    expect(textEndChunks.length).toBeGreaterThanOrEqual(2);
  });

  it('forwards requestContext entries as customContext to isTaskComplete scorers', async () => {
    const model = createTextModel('done');
    const baseAgent = new Agent({
      id: 'task-complete-ctx-agent',
      name: 'Task Complete Ctx Agent',
      instructions: 'noop',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const scorer = passingScorer();
    const requestContext = new RequestContext();
    requestContext.set('userId', 'user-123');
    requestContext.set('tenantId', 'tenant-abc');

    const { output, cleanup } = await durableAgent.stream('go', {
      requestContext,
      isTaskComplete: {
        scorers: [scorer as any],
      } as any,
      maxSteps: 2,
    });

    await drain(output.fullStream as unknown as ReadableStream<any>);
    await cleanup();

    expect(scorer.run).toHaveBeenCalledTimes(1);
    const runArg = (scorer.run as any).mock.calls[0][0];
    // runStreamCompletionScorers forwards `customContext` as `requestContext`
    // on the scorer.run input, mirroring the non-durable path.
    expect(runArg.requestContext).toBeDefined();
    expect(runArg.requestContext.userId).toBe('user-123');
    expect(runArg.requestContext.tenantId).toBe('tenant-abc');
  });

  it('suppresses feedback message when suppressFeedback is true', async () => {
    const model = createSequencedTextModel(['attempt one', 'attempt two']);
    const baseAgent = new Agent({
      id: 'task-complete-suppress-agent',
      name: 'Task Complete Suppress Agent',
      instructions: 'noop',
      model: model as LanguageModelV2,
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const scorer = failingScorer();

    const { output, cleanup } = await durableAgent.stream('go', {
      isTaskComplete: {
        scorers: [scorer as any],
        suppressFeedback: true,
      } as any,
      maxSteps: 2,
    });

    const chunks = await drain(output.fullStream as unknown as ReadableStream<any>);
    await cleanup();

    const taskChunks = chunks.filter(c => c.type === 'is-task-complete');
    expect(taskChunks.length).toBeGreaterThanOrEqual(1);
    expect(taskChunks.every(c => c.payload.suppressFeedback === true)).toBe(true);
  });
});
