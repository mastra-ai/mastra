/**
 * A multi-step durable turn is stored like Agent stores it: one assistant message whose
 * steps are separated by step-start parts, not one message per iteration (#26332).
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { MockMemory } from '../../../memory/mock';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

function createToolThenTextModel(toolName: string, toolArgs: object, finalText: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount += 1;
      const stream: ReadableStream<any> =
        callCount === 1
          ? convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: `call-${callCount}`,
                toolName,
                input: JSON.stringify(toolArgs),
                providerExecuted: false,
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ])
          : convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: `id-${callCount}`, modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: finalText },
              { type: 'text-end', id: 'text-1' },
              {
                type: 'finish',
                finishReason: 'stop',
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]);
      return { stream, rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [] };
    },
  });
}

describe('DurableAgent multi-step turn storage (#26332)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await pubsub.close();
  });

  it('stores a tool step and the answer as one assistant message, matching Agent', async () => {
    const weatherTool = createTool({
      id: 'weatherTool',
      description: 'Get weather for a location',
      inputSchema: z.object({ location: z.string() }),
      execute: async () => ({ temperature: 20, conditions: 'sunny' }),
    });

    const shapes: Record<string, string[][]> = {};
    for (const engine of ['plain', 'durable'] as const) {
      const memory = new MockMemory();
      const agent = new Agent({
        id: `turn-${engine}`,
        name: `Turn ${engine}`,
        instructions: 'Get weather information.',
        model: createToolThenTextModel('weatherTool', { location: 'Toronto' }, 'It is sunny.') as LanguageModelV2,
        tools: { weatherTool },
        memory,
      });
      const runner = engine === 'durable' ? createDurableAgent({ agent, pubsub }) : agent;
      new Mastra({ agents: { [`turn-${engine}`]: runner }, logger: false });

      const result: any = await runner.stream('Weather in Toronto?', {
        memory: { thread: `thread-${engine}`, resource: 'resource' },
      });
      const startIds: string[] = [];
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'start' && chunk.payload?.messageId) startIds.push(chunk.payload.messageId);
      }
      await (result.output ?? result).getFullOutput();
      result.cleanup?.();

      const { messages } = await memory.recall({ threadId: `thread-${engine}`, resourceId: 'resource' });
      const assistantMessages = messages.filter(m => m.role === 'assistant');
      expect(startIds).toEqual([assistantMessages[0]!.id]);
      shapes[engine] = assistantMessages.map(m => (m.content as any).parts.map((p: { type: string }) => p.type));
    }

    expect(shapes.durable).toHaveLength(1);
    expect(shapes.durable![0]).toContain('step-start');
    expect(shapes.durable).toEqual(shapes.plain);
  });
});
