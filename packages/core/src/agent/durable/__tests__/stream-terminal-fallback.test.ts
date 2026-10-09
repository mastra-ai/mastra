/**
 * Regression tests for issue #25974: a durable run whose stream never receives
 * a terminal FINISH/ERROR event (early cleanup(), dropped events) must still
 * settle its output and release the thread run once the workflow finishes.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it, vi } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { Agent } from '../../agent';
import { agentThreadStreamRuntime } from '../../thread-stream-runtime';
import { AgentStreamEventTypes } from '../constants';
import { createDurableAgent } from '../create-durable-agent';

const scope = { threadId: 'thread-25974', resourceId: 'resource-25974' };

function makeFailingModel(): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      throw new Error('Cannot connect to API: Headers Timeout Error');
    },
  }) as unknown as LanguageModelV2;
}

function makeSuccessModel(): LanguageModelV2 {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue({ type: 'stream-start', warnings: [] });
          controller.enqueue({ type: 'text-start', id: 't' });
          controller.enqueue({ type: 'text-delta', id: 't', delta: 'hi' });
          controller.enqueue({ type: 'text-end', id: 't' });
          controller.enqueue({
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
          });
          controller.close();
        },
      }),
    }),
  }) as unknown as LanguageModelV2;
}

function setup(model: LanguageModelV2, pubsub = new EventEmitterPubSub()) {
  const baseAgent = new Agent({ id: 'fallback-agent', name: 'Fallback', instructions: 'x', model, pubsub });
  const agent = createDurableAgent({ agent: baseAgent, pubsub });
  new Mastra({ agents: { agent }, pubsub, logger: false });
  return agent;
}

function dropTerminalEvents(pubsub: EventEmitterPubSub, types: string[]) {
  const original = pubsub.publish.bind(pubsub);
  vi.spyOn(pubsub, 'publish').mockImplementation(async (topic, event) => {
    if (types.includes((event as { type?: string })?.type ?? '')) return;
    return original(topic, event);
  });
}

describe('DurableAgent stream terminal fallback (#25974)', () => {
  it('releases the thread when cleanup() is called before the run ends', async () => {
    const agent = setup(makeFailingModel());
    const result = await agent.stream('hello', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
    });
    result.cleanup();

    await result.output.consumeStream();
    await vi.waitFor(() =>
      expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, agent.getPubSub())).toBeUndefined(),
    );
  });

  it('settles the output with an error when FINISH and ERROR are dropped', async () => {
    const pubsub = new EventEmitterPubSub();
    const agent = setup(makeFailingModel(), pubsub);
    dropTerminalEvents(pubsub, [AgentStreamEventTypes.FINISH, AgentStreamEventTypes.ERROR]);
    const onError = vi.fn();
    const result = await agent.stream('hello', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      onError,
    });

    await result.output.consumeStream();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await vi.waitFor(() =>
      expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, agent.getPubSub())).toBeUndefined(),
    );
    result.cleanup();
  });

  it('settles a successful run whose FINISH event was dropped', async () => {
    const pubsub = new EventEmitterPubSub();
    const agent = setup(makeSuccessModel(), pubsub);
    dropTerminalEvents(pubsub, [AgentStreamEventTypes.FINISH]);
    const onError = vi.fn();
    const result = await agent.stream('hello', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      onError,
    });

    await result.output.consumeStream();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledTimes(1), { timeout: 5000 });
    await vi.waitFor(() =>
      expect(agentThreadStreamRuntime.getActiveThreadRunId(scope, agent.getPubSub())).toBeUndefined(),
    );
    result.cleanup();
  });

  it('fires callbacks exactly once when terminal events arrive normally', async () => {
    const agent = setup(makeSuccessModel());
    const onFinish = vi.fn();
    const onError = vi.fn();
    const result = await agent.stream('hello', {
      memory: { thread: scope.threadId, resource: scope.resourceId },
      onFinish,
      onError,
    });

    await result.output.consumeStream();
    await new Promise(resolve => setTimeout(resolve, 50));
    expect(onFinish).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
    result.cleanup();
  });
});
