/**
 * An agent turn runs through internal workflow steps (prepare-stream, stream,
 * map-results, tool-call). None of them use `writer`, so the only ToolStream an
 * agent turn should construct is the one handed to each executed tool.
 *
 * Regression for https://github.com/mastra-ai/mastra/issues/26406
 */
import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';

const constructions = vi.hoisted(() => ({ count: 0 }));

vi.mock('../../tools/stream', async importOriginal => {
  const actual = await importOriginal<typeof import('../../tools/stream')>();
  class CountedToolStream extends actual.ToolStream {
    constructor(...args: ConstructorParameters<typeof actual.ToolStream>) {
      super(...args);
      constructions.count++;
    }
  }
  return { ...actual, ToolStream: CountedToolStream };
});

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function createOneToolCallModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const parts =
        calls === 1
          ? [
              {
                type: 'tool-call' as const,
                toolCallType: 'function' as const,
                toolCallId: 'tc-1',
                toolName: 'quiet',
                input: '{}',
              },
              { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
            ]
          : [
              { type: 'text-start' as const, id: 't' },
              { type: 'text-delta' as const, id: 't', delta: 'done' },
              { type: 'text-end' as const, id: 't' },
              { type: 'finish' as const, finishReason: 'stop' as const, usage },
            ];
      return {
        stream: convertArrayToReadableStream([{ type: 'stream-start' as const, warnings: [] }, ...parts]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

function createQuietAgent(id: string) {
  const quiet = createTool({
    id: 'quiet',
    description: 'Does not stream anything',
    inputSchema: z.object({}),
    execute: async () => ({ ok: true }),
  });
  return new Agent({
    id,
    name: id,
    instructions: 'Call the tool',
    model: createOneToolCallModel() as LanguageModelV2,
    tools: { quiet },
  });
}

describe('agent turn ToolStream allocation', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    constructions.count = 0;
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('constructs only the tool writer for an Agent turn with one tool call', async () => {
    const agent = createQuietAgent('quiet-agent');

    const result = await agent.stream('go', { maxSteps: 3 });
    for await (const _ of result.fullStream) {
      // drain
    }

    expect(await result.text).toBe('done');
    expect(constructions.count).toBe(1);
  });

  it('constructs only the tool writer for a durable agent turn with one tool call', async () => {
    const durable = createDurableAgent({ agent: createQuietAgent('quiet-durable'), pubsub });
    new Mastra({ agents: { quietDurable: durable as any }, logger: false, storage: new InMemoryStore(), pubsub });

    const result = await durable.stream('go', { maxSteps: 3 });
    for await (const _ of result.fullStream) {
      // drain
    }

    expect(constructions.count).toBe(1);
  });
});
