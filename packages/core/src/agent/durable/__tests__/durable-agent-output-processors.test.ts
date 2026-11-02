/**
 * DurableAgent output processor tests for tool chunks that the aimock scenarios
 * (output-stream-processor.scenario.test.ts) cannot reach: provider-executed tool
 * results (an OpenAI chat fixture cannot emit them), a worker with no processors
 * in its run registry, and replay from the resumable-stream cache.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { z } from 'zod';
import { InMemoryServerCache } from '../../../cache/inmemory';
import { CachingPubSub } from '../../../events/caching-pubsub';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';
import { globalRunRegistry } from '../run-registry';

function createToolCallingModel(toolName: string, toolArgs: Record<string, unknown>) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        // First call: invoke the tool
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'tc-1',
              toolName,
              input: JSON.stringify(toolArgs),
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
      // Second call: respond with text
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Done.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
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

// Regression: https://github.com/mastra-ai/mastra/issues/22980
// Tool chunks are processed worker-side (tool-call step) before they are
// published. The adapter's MastraModelOutput must not run processOutputStream
// on them a second time.
describe('DurableAgent output processors run once per tool chunk', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  async function runWithTool(execute: () => Promise<unknown>, outputProcessor: any) {
    const executeSpy = vi.fn().mockImplementation(execute);
    const tool = createTool({
      id: 'getWeather',
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      execute: executeSpy,
    });

    const baseAgent = new Agent({
      id: 'once-agent',
      name: 'Once Agent',
      instructions: 'You are a helpful agent.',
      model: createToolCallingModel('getWeather', { city: 'NYC' }) as LanguageModelV2,
      tools: { getWeather: tool },
      outputProcessors: [outputProcessor],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'once-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('What is the weather in NYC?', { maxSteps: 3 });
    const chunks = await drain(result.fullStream);
    return { chunks, executeSpy };
  }

  it('a provider-executed tool-result is processed exactly once', async () => {
    let streamToolResults = 0;
    const processor = {
      id: 'provider-counter',
      name: 'Provider Counter',
      processOutputStream: async ({ part }: any) => {
        if (part.type === 'tool-result') streamToolResults++;
        return part;
      },
    };

    const baseAgent = new Agent({
      id: 'provider-tool-agent',
      name: 'Provider Tool Agent',
      instructions: 'You are a helpful agent.',
      model: new MockLanguageModelV2({
        doStream: async () => ({
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              toolCallId: 'ws-1',
              toolName: 'web_search',
              input: JSON.stringify({ query: 'mastra' }),
              providerExecuted: true,
            },
            {
              type: 'tool-result',
              toolCallId: 'ws-1',
              toolName: 'web_search',
              result: { hits: 3 },
              providerExecuted: true,
            },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done.' },
            { type: 'text-end', id: 'text-1' },
            { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        }),
      }) as LanguageModelV2,
      outputProcessors: [processor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'provider-tool-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Search mastra', { maxSteps: 3 });
    const chunks = await drain(result.fullStream);

    expect(chunks.filter(c => c.type === 'tool-result')).toHaveLength(1);
    expect(chunks.at(-1)?.type).toBe('finish');
    expect(streamToolResults).toBe(1);
  });

  // Newer providers (AI SDK v6+) leave `providerExecuted` unset on tool results
  // in the model stream.
  function createProviderResultModel() {
    return new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'ws-1',
            toolName: 'web_search',
            input: JSON.stringify({ query: 'mastra' }),
            providerExecuted: true,
          },
          { type: 'tool-result', toolCallId: 'ws-1', toolName: 'web_search', result: { hits: 3 } },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Done.' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    }) as LanguageModelV2;
  }

  it('a provider tool-result without providerExecuted is processed exactly once', async () => {
    let streamToolResults = 0;
    const baseAgent = new Agent({
      id: 'provider-unflagged-agent',
      name: 'Provider Unflagged Agent',
      instructions: 'You are a helpful agent.',
      model: createProviderResultModel(),
      outputProcessors: [
        {
          id: 'unflagged-counter',
          name: 'Unflagged Counter',
          processOutputStream: async ({ part }: any) => {
            if (part.type === 'tool-result') streamToolResults++;
            return part;
          },
        } as any,
      ],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'provider-unflagged-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Search mastra', { maxSteps: 3 });
    const chunks = await drain(result.fullStream);

    expect(chunks.filter(c => c.type === 'tool-result')).toHaveLength(1);
    expect(streamToolResults).toBe(1);
  });

  it('the regular Agent processes a provider tool-result without providerExecuted', async () => {
    let streamToolResults = 0;
    const agent = new Agent({
      id: 'regular-provider-agent',
      name: 'Regular Provider Agent',
      instructions: 'You are a helpful agent.',
      model: createProviderResultModel(),
      outputProcessors: [
        {
          id: 'regular-unflagged-counter',
          name: 'Regular Unflagged Counter',
          processOutputStream: async ({ part }: any) => {
            if (part.type === 'tool-result') streamToolResults++;
            return part;
          },
        } as any,
      ],
    });

    const result = await agent.stream('Search mastra', { maxSteps: 3 });
    const chunks = await drain(result.fullStream);

    expect(chunks.filter(c => c.type === 'tool-result')).toHaveLength(1);
    expect(streamToolResults).toBe(1);
  });

  it('processes a tool-result in the stream when the tool step has no processors (cross-process worker)', async () => {
    let streamToolResults = 0;
    const processor = {
      id: 'redactor',
      name: 'Redactor',
      processOutputStream: async ({ part }: any) => {
        if (part.type === 'tool-result') {
          streamToolResults++;
          return { ...part, payload: { ...part.payload, result: { card: '[REDACTED]' } } };
        }
        return part;
      },
    };

    // A worker in another process has no output processors in its run
    // registry, so the tool step publishes the result unprocessed.
    const { chunks } = await runWithTool(async () => {
      for (const entry of globalRunRegistry.values()) entry.outputProcessors = undefined;
      return { card: '4111-1111-1111-1111' };
    }, processor);

    const toolResults = chunks.filter(c => c.type === 'tool-result');
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0].payload.result).toEqual({ card: '[REDACTED]' });
    expect(streamToolResults).toBe(1);
  });

  it('a tool-result replayed from the resumable-stream cache is not processed again', async () => {
    const cachingPubsub = new CachingPubSub(pubsub, new InMemoryServerCache());
    let streamToolResults = 0;
    const processor = {
      id: 'marker',
      name: 'Marker',
      processOutputStream: async ({ part }: any) => {
        if (part.type === 'tool-result') {
          streamToolResults++;
          return { ...part, payload: { ...part.payload, result: `${part.payload.result}|marked` } };
        }
        return part;
      },
    };

    const baseAgent = new Agent({
      id: 'replay-agent',
      name: 'Replay Agent',
      instructions: 'You are a helpful agent.',
      model: createToolCallingModel('getWeather', { city: 'NYC' }) as LanguageModelV2,
      tools: {
        getWeather: createTool({
          id: 'getWeather',
          description: 'Get weather',
          inputSchema: z.object({ city: z.string() }),
          execute: async () => 'sunny',
        }),
      },
      outputProcessors: [processor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub: cachingPubsub, cleanupTimeoutMs: 60_000 });
    new Mastra({
      agents: { 'replay-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub: cachingPubsub,
    });

    const result = await durableAgent.stream('What is the weather in NYC?', { maxSteps: 3 });
    await drain(result.fullStream);
    expect(streamToolResults).toBe(1);

    const observed = await durableAgent.observe(result.runId, { offset: 0 });
    const replayed = await drain(observed.fullStream);

    const toolResults = replayed.filter(c => c.type === 'tool-result');
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0].payload.result).toBe('sunny|marked');
    expect(streamToolResults).toBe(1);
  });
});
