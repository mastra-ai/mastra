/**
 * A client-executed tool (no `execute`) must end the durable run at the call
 * so the client can answer, exactly as the non-durable loop does. The durable
 * mapping step used to record a result for the call it never got and run the
 * model again.
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/** First call: a tool call. Second call: a text answer. */
function createClientToolModel(toolName: string) {
  let callCount = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'tc-1',
              toolName,
              args: '{"label":"Done"}',
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-delta', textDelta: 'Done' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 5, outputTokens: 5, totalTokens: 10 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  }) as unknown as LanguageModelV2;
  return { model, calls: () => callCount };
}

describe('DurableAgent with a client-executed tool', () => {
  let _mastra: Mastra;
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await _mastra?.close?.();
    pubsub?.removeAllListeners?.();
  });

  it('ends the run at the client tool call and leaves it unanswered', async () => {
    const { model, calls } = createClientToolModel('client-tool');
    const baseAgent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a test agent',
      model,
      tools: {
        // Execute-less: the tool runs on the client; the server only observes.
        'client-tool': createTool({
          id: 'client-tool',
          description: 'A client-side tool',
          inputSchema: z.object({ label: z.string() }),
        }),
      },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    _mastra = new Mastra({
      agents: { 'test-agent': durableAgent },
      storage: new InMemoryStore(),
    });

    const { output } = await durableAgent.stream('test prompt', { maxSteps: 3 });
    const chunkTypes: string[] = [];
    for await (const chunk of output.fullStream) {
      chunkTypes.push(chunk.type);
    }

    // One model call, one step: the loop stopped for the client to answer.
    expect(calls()).toBe(1);
    expect(chunkTypes.filter(type => type === 'step-start')).toHaveLength(1);
    expect(chunkTypes).toContain('tool-call');
    // Nothing answered it on the server.
    expect(chunkTypes).not.toContain('tool-result');
    expect(await output.finishReason).toBe('tool-calls');
  });

  it('continues when the client result arrives on a follow-up request', async () => {
    const { model, calls } = createClientToolModel('client-tool');
    const baseAgent = new Agent({
      id: 'test-agent',
      name: 'test-agent',
      instructions: 'You are a test agent',
      model,
      tools: {
        'client-tool': createTool({
          id: 'client-tool',
          description: 'A client-side tool',
          inputSchema: z.object({ label: z.string() }),
        }),
      },
    });
    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    _mastra = new Mastra({
      agents: { 'test-agent': durableAgent },
      storage: new InMemoryStore(),
    });

    const first = await durableAgent.stream('test prompt', { maxSteps: 3 });
    await first.output.consumeStream();
    expect(calls()).toBe(1);

    const second = await durableAgent.stream(
      [
        { role: 'user', content: 'test prompt' },
        {
          role: 'assistant',
          content: [
            { type: 'tool-call', toolCallId: 'tc-1', toolName: 'client-tool', args: { label: 'Done' } },
          ],
        },
        {
          role: 'tool',
          content: [
            { type: 'tool-result', toolCallId: 'tc-1', toolName: 'client-tool', result: 'ok' },
          ],
        },
      ],
      { maxSteps: 3 },
    );
    const text = await second.output.text;
    expect(calls()).toBe(2);
    expect(text).toBe('Done');
  });
});
