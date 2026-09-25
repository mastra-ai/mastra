/**
 * DurableAgent processor data-chunk persistence tests (#19375 parity port).
 *
 * Output processors can emit custom `data-*` chunks via `writer.custom()`.
 * Non-transient chunks must be persisted into thread history (they survive in
 * the messageList that gets serialized and flushed to memory), while
 * `transient: true` chunks are stream-only.
 *
 * Covers both durable producer-side writer surfaces:
 * - `processOutputStep` (llm-execution's outputStepWriter)
 * - `processToolResult` (tool-call's writer, carried to llm-mapping via
 *   `processorDataParts` on the step output — the tool-call step's local
 *   messageList doesn't cross the step boundary)
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createTextModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
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
  });
}

function createToolCallingModel(toolName: string, toolArgs: Record<string, unknown>) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call' as const,
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

describe('DurableAgent processor data-chunk persistence (#19375)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('persists non-transient data chunks from processOutputStep, keeps transient ones stream-only', async () => {
    const processor = {
      id: 'data-emitter',
      name: 'Data Emitter',
      processOutputStep: async ({ writer }: any) => {
        await writer?.custom({ type: 'data-note', data: { note: 'persisted-note' } });
        await writer?.custom({ type: 'data-ephemeral', data: { note: 'stream-only-note' }, transient: true });
      },
    };

    const mockMemory = new MockMemory();
    const baseAgent = new Agent({
      id: 'data-step-agent',
      name: 'Data Step Agent',
      instructions: 'You are a helpful agent.',
      model: createTextModel('assistant response') as LanguageModelV2,
      memory: mockMemory,
      outputProcessors: [processor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'data-step-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('hello', {
      memory: { thread: 'thread-data-step', resource: 'resource-data-step' },
    });
    const chunks = await drain(result.fullStream);

    // Both chunks stream to the client
    expect(chunks.some((c: any) => c.type === 'data-note')).toBe(true);
    expect(chunks.some((c: any) => c.type === 'data-ephemeral')).toBe(true);

    // Only the non-transient chunk survives in thread history
    const recalled = await mockMemory.recall({
      threadId: 'thread-data-step',
      resourceId: 'resource-data-step',
    });
    const serialized = JSON.stringify(recalled.messages);
    expect(serialized).toContain('persisted-note');
    expect(serialized).not.toContain('stream-only-note');
    result.cleanup();
  });

  it('persists non-transient data chunks emitted from processToolResult', async () => {
    const processor = {
      id: 'tool-data-emitter',
      name: 'Tool Data Emitter',
      processToolResult: async ({ writer }: any) => {
        await writer?.custom({ type: 'data-tool-note', data: { note: 'tool-persisted-note' } });
        await writer?.custom({ type: 'data-tool-ephemeral', data: { note: 'tool-stream-only' }, transient: true });
      },
    };

    const weatherTool = createTool({
      id: 'getWeather',
      description: 'Get weather',
      inputSchema: z.object({ city: z.string() }),
      outputSchema: z.object({ temp: z.number() }),
      execute: async () => ({ temp: 72 }),
    });

    const mockMemory = new MockMemory();
    const baseAgent = new Agent({
      id: 'data-tool-agent',
      name: 'Data Tool Agent',
      instructions: 'You are a helpful agent.',
      model: createToolCallingModel('getWeather', { city: 'NYC' }) as LanguageModelV2,
      tools: { getWeather: weatherTool },
      memory: mockMemory,
      outputProcessors: [processor as any],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'data-tool-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('What is the weather in NYC?', {
      maxSteps: 3,
      memory: { thread: 'thread-data-tool', resource: 'resource-data-tool' },
    });
    const chunks = await drain(result.fullStream);

    // Both chunks stream to the client
    expect(chunks.some((c: any) => c.type === 'data-tool-note')).toBe(true);
    expect(chunks.some((c: any) => c.type === 'data-tool-ephemeral')).toBe(true);

    // Only the non-transient chunk survives in thread history
    const recalled = await mockMemory.recall({
      threadId: 'thread-data-tool',
      resourceId: 'resource-data-tool',
    });
    const serialized = JSON.stringify(recalled.messages);
    expect(serialized).toContain('tool-persisted-note');
    expect(serialized).not.toContain('tool-stream-only');
    result.cleanup();
  });
});
