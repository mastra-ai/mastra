import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/**
 * Bug 8: processLLMRequest cached-response replay on durable
 *
 * When an input processor's `processLLMRequest` returns a cached response,
 * the regular agent replays the cached chunks instead of calling the model.
 * The durable agent must do the same.
 */
describe('DurableAgent — processLLMRequest cached response (Bug 8)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('replays cached chunks from processLLMRequest without calling the model', async () => {
    // CachedLLMStepChunk format: { type, payload } — post-transform Mastra chunks
    // with runId/from stripped (reattached at replay time).
    const cachedChunks = [
      { type: 'stream-start', payload: { warnings: [] } },
      {
        type: 'response-metadata',
        payload: { id: 'resp-cached', modelId: 'mock', timestamp: new Date(0) },
      },
      { type: 'text-start', payload: { id: 'text-1' } },
      { type: 'text-delta', payload: { id: 'text-1', text: 'cached response' } },
      { type: 'text-end', payload: { id: 'text-1' } },
      {
        // Stored as 'finish' — the durable agent's step-boundary transform
        // rewrites 'finish' → 'step-finish' at stream time.
        type: 'finish',
        payload: {
          stepResult: { reason: 'stop' },
          output: {
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
          metadata: {},
          messages: { all: [], user: [], nonUser: [] },
        },
      },
    ];

    const processLLMRequestSpy = vi.fn().mockReturnValue({
      response: {
        chunks: cachedChunks,
        warnings: [],
        request: { body: 'cached-request' },
        rawResponse: { status: 200 },
      },
    });

    const doStreamSpy = vi.fn();

    const baseAgent = new Agent({
      id: 'cached-response-agent',
      name: 'cached-response-agent',
      model: new MockLanguageModelV2({
        doStream: doStreamSpy,
      }),
      instructions: 'You are a test agent.',
      inputProcessors: [
        {
          id: 'response-cache-processor',
          processLLMRequest: processLLMRequestSpy,
        },
      ],
    });

    // Mastra must be created so the agent is registered and receives its
    // internal wiring (storage, etc.). The variable itself is unused.
    void new Mastra({
      agents: { 'cached-response-agent': baseAgent },
      storage: new InMemoryStore(),
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.stream('Hello', {
      maxSteps: 1,
    });

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    // processLLMRequest should have been called
    expect(processLLMRequestSpy).toHaveBeenCalled();

    // The model should NOT have been called since we returned a cached response
    expect(doStreamSpy).not.toHaveBeenCalled();

    // The cached text-delta should appear in the output stream
    const textChunks = chunks.filter((c: any) => c.type === 'text-delta');
    expect(textChunks.length).toBeGreaterThanOrEqual(1);
    expect(textChunks[0].payload?.text ?? textChunks[0].textDelta).toBe('cached response');
  });

  it('falls through to model call when processLLMRequest returns no cached response', async () => {
    const processLLMRequestSpy = vi.fn().mockReturnValue(undefined);

    const baseAgent = new Agent({
      id: 'no-cache-agent',
      name: 'no-cache-agent',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'live response' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      }),
      instructions: 'You are a test agent.',
      inputProcessors: [
        {
          id: 'noop-processor',
          processLLMRequest: processLLMRequestSpy,
        },
      ],
    });

    // Mastra must be created so the agent is registered and receives its
    // internal wiring (storage, etc.). The variable itself is unused.
    void new Mastra({
      agents: { 'no-cache-agent': baseAgent },
      storage: new InMemoryStore(),
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

    const result = await durableAgent.stream('Hello', {
      maxSteps: 1,
    });

    const chunks: any[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    // processLLMRequest should have been called
    expect(processLLMRequestSpy).toHaveBeenCalled();

    // The model WAS called (no cached response)
    const textChunks = chunks.filter((c: any) => c.type === 'text-delta');
    expect(textChunks.length).toBeGreaterThanOrEqual(1);
    expect(textChunks[0].payload?.text ?? textChunks[0].textDelta).toBe('live response');
  });
});
