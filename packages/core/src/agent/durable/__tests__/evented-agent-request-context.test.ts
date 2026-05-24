import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventEmitterPubSub } from '../../../events/event-emitter';
import { RequestContext } from '../../../request-context';
import { Agent } from '../../agent';
import { EventedAgent } from '../evented-agent';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: '__AI_SDK_OPENAI_MODEL_REALTIME__', timestamp: new Date(0) },
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

describe('EventedAgent requestContext forwarding', () => {
  const pubsubs: EventEmitterPubSub[] = [];

  afterEach(async () => {
    await Promise.all(pubsubs.splice(0).map(pubsub => pubsub.close()));
  });

  it('passes requestContext to fire-and-forget workflow execution', async () => {
    const startAsync = vi.fn(async () => undefined);
    const createRun = vi.fn(async () => ({ startAsync }));
    const pubsub = new EventEmitterPubSub();
    pubsubs.push(pubsub);
    const baseAgent = new Agent({
      id: 'evented-request-context-agent',
      name: 'Evented Request Context Agent',
      instructions: 'Test requestContext',
      model: createTextModel('Hello!') as LanguageModelV2,
    });
    const eventedAgent = new (class extends EventedAgent {
      override getWorkflow() {
        return { createRun } as unknown as ReturnType<EventedAgent['getWorkflow']>;
      }
    })({ agent: baseAgent, pubsub });

    const requestContext = new RequestContext();
    requestContext.set('tenantId', 'tenant-123');

    const { cleanup } = await eventedAgent.stream('Hello', { requestContext });
    try {
      await vi.waitFor(() => expect(startAsync).toHaveBeenCalledTimes(1));
      expect(startAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          inputData: expect.any(Object),
          requestContext,
        }),
      );
    } finally {
      cleanup();
    }
  });
});
