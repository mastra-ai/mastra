/**
 * DurableAgent output processor tests for tool chunks.
 *
 * Verifies that tool-result and tool-error chunks are processed through
 * output processors (Bug 4 parity fix).
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

describe('DurableAgent output processors for tool chunks', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('tool-result chunks are processed through output processors', async () => {
    const processedChunks: any[] = [];

    const outputProcessor = {
      id: 'test-redactor',
      name: 'Test Redactor',
      processOutputStream: vi.fn().mockImplementation(async ({ part }) => {
        if (part.type === 'tool-result') {
          processedChunks.push(part);
          // Modify the chunk — e.g. redact the result
          return {
            ...part,
            payload: {
              ...part.payload,
              result: '[REDACTED]',
            },
          };
        }
        return part;
      }),
    };

    const weatherTool = createTool({
      id: 'getWeather',
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ temp: z.number() }),
      execute: async () => ({ temp: 72 }),
    });

    const baseAgent = new Agent({
      id: 'processor-agent',
      name: 'Processor Agent',
      instructions: 'You are a helpful agent.',
      model: createToolCallingModel('getWeather', { city: 'NYC' }) as LanguageModelV2,
      tools: { getWeather: weatherTool },
      outputProcessors: [outputProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'processor-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('What is the weather in NYC?', {
      maxSteps: 3,
    });

    const chunks = await drain(result.fullStream);

    // Output processor should have seen the tool-result chunk
    expect(processedChunks.length).toBeGreaterThan(0);
    expect(processedChunks[0].type).toBe('tool-result');

    // The emitted tool-result chunk should have the redacted result
    const toolResultChunks = chunks.filter((c: any) => c.type === 'tool-result');
    expect(toolResultChunks.length).toBeGreaterThan(0);
    expect(toolResultChunks[0].payload.result).toBe('[REDACTED]');
  });

  it('output processor can block tool-result chunks with tripwire', async () => {
    const blockingProcessor = {
      id: 'test-blocker',
      name: 'Test Blocker',
      processOutputStream: vi.fn().mockImplementation(async ({ part }) => {
        if (part.type === 'tool-result') {
          return null; // Block the chunk
        }
        return part;
      }),
      tripwire: {
        reason: 'Content blocked by policy',
      },
    };

    const weatherTool = createTool({
      id: 'getWeather',
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ temp: z.number() }),
      execute: async () => ({ temp: 72 }),
    });

    const baseAgent = new Agent({
      id: 'blocker-agent',
      name: 'Blocker Agent',
      instructions: 'You are a helpful agent.',
      model: createToolCallingModel('getWeather', { city: 'NYC' }) as LanguageModelV2,
      tools: { getWeather: weatherTool },
      outputProcessors: [blockingProcessor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'blocker-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('What is the weather in NYC?', {
      maxSteps: 3,
    });

    const chunks = await drain(result.fullStream);

    // The tool-result chunk should have been blocked (not emitted)
    const toolResultChunks = chunks.filter((c: any) => c.type === 'tool-result');
    expect(toolResultChunks).toHaveLength(0);
  });

  it('fails the run before emitting a tool result when a stream processor throws', async () => {
    const gatedRedactor = {
      id: 'test-gated-redactor',
      name: 'Test Gated Redactor',
      processToolResult: async ({ messageList, toolCallId, toolName, args }: any) => {
        messageList.updateToolInvocation({
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId, toolName, args, result: { secret: '[REDACTED]' } },
        });
      },
      processOutputStream: vi.fn().mockImplementation(async ({ part }) => {
        if (part.type === 'tool-result') {
          throw new Error('stream redaction processor crashed');
        }
        return part;
      }),
    };

    const secretTool = createTool({
      id: 'getSecret',
      description: 'Get secret',
      inputSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ secret: z.string() }),
      execute: async () => ({ secret: 'RAW-SECRET-VALUE' }),
    });

    const baseAgent = new Agent({
      id: 'gated-agent',
      name: 'Gated Agent',
      instructions: 'You are a helpful agent.',
      model: createToolCallingModel('getSecret', { city: 'NYC' }) as LanguageModelV2,
      tools: { getSecret: secretTool },
      outputProcessors: [gatedRedactor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'gated-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('What is the secret?', {
      maxSteps: 3,
    });

    const chunks = await drain(result.fullStream);

    expect(JSON.stringify(chunks)).not.toContain('RAW-SECRET-VALUE');
    expect(chunks.filter((c: any) => c.type === 'tool-result')).toHaveLength(0);

    const errorChunks = chunks.filter((c: any) => c.type === 'error');
    expect(errorChunks).toHaveLength(1);
    expect(errorChunks[0].payload.error.message).toContain('stream redaction processor crashed');
    expect(chunks.filter((c: any) => c.type === 'text-delta')).toHaveLength(0);
  });
});

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

  it('processOutputStream sees a tool-result chunk exactly once', async () => {
    let streamToolResults = 0;
    let toolResultHook = 0;
    const processor = {
      id: 'counter',
      name: 'Counter',
      processToolResult: async () => {
        toolResultHook++;
      },
      processOutputStream: async ({ part }: any) => {
        if (part.type === 'tool-result') streamToolResults++;
        return part;
      },
    };

    const { chunks, executeSpy } = await runWithTool(async () => ({ temp: 72 }), processor);

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(toolResultHook).toBe(1);
    expect(chunks.filter(c => c.type === 'tool-result')).toHaveLength(1);
    expect(chunks.at(-1)?.type).toBe('finish');
    expect(streamToolResults).toBe(1);
  });

  it('a processOutputStream mutation of tool-result is applied exactly once', async () => {
    const processor = {
      id: 'marker',
      name: 'Marker',
      processOutputStream: async ({ part }: any) => {
        if (part.type === 'tool-result') {
          return { ...part, payload: { ...part.payload, result: `${part.payload.result}|marked` } };
        }
        return part;
      },
    };

    const { chunks } = await runWithTool(async () => 'sunny', processor);

    const toolResults = chunks.filter(c => c.type === 'tool-result');
    expect(toolResults).toHaveLength(1);
    expect(toolResults[0].payload.result).toBe('sunny|marked');
  });

  it('processOutputStream sees a tool-error chunk exactly once', async () => {
    let streamToolErrors = 0;
    const processor = {
      id: 'error-counter',
      name: 'Error Counter',
      processOutputStream: async ({ part }: any) => {
        if (part.type === 'tool-error') streamToolErrors++;
        return part;
      },
    };

    const { chunks, executeSpy } = await runWithTool(async () => {
      throw new Error('weather service down');
    }, processor);

    expect(executeSpy).toHaveBeenCalledTimes(1);
    expect(chunks.filter(c => c.type === 'tool-error')).toHaveLength(1);
    expect(chunks.at(-1)?.type).toBe('finish');
    expect(streamToolErrors).toBe(1);
  });

  it('a tool-not-found tool-error is processed exactly once', async () => {
    let streamToolErrors = 0;
    const processor = {
      id: 'error-counter',
      name: 'Error Counter',
      processOutputStream: async ({ part }: any) => {
        if (part.type === 'tool-error') streamToolErrors++;
        return part;
      },
    };

    const baseAgent = new Agent({
      id: 'missing-tool-agent',
      name: 'Missing Tool Agent',
      instructions: 'You are a helpful agent.',
      model: createToolCallingModel('missingTool', {}) as LanguageModelV2,
      outputProcessors: [processor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'missing-tool-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('Hi', { maxSteps: 3 });
    const chunks = await drain(result.fullStream);

    expect(chunks.filter(c => c.type === 'tool-error')).toHaveLength(1);
    expect(streamToolErrors).toBe(1);
  });

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

  it('matches the regular Agent, which also processes a tool-result once', async () => {
    let streamToolResults = 0;
    const agent = new Agent({
      id: 'regular-agent',
      name: 'Regular Agent',
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
      outputProcessors: [
        {
          id: 'regular-counter',
          name: 'Regular Counter',
          processOutputStream: async ({ part }: any) => {
            if (part.type === 'tool-result') streamToolResults++;
            return part;
          },
        } as any,
      ],
    });

    const result = await agent.stream('What is the weather in NYC?', { maxSteps: 3 });
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
