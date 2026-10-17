/**
 * A tool transform that only defines `transcript.output` must leave the stored
 * tool-call `args` untouched, whichever save path (per-step save queue or the
 * final MessageHistory save) writes the assistant message.
 */
import type { LanguageModelV4, LanguageModelV4Prompt } from '@ai-sdk/provider';
import { MockLanguageModelV4, convertArrayToReadableStream } from '@internal/ai-v7/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const threadId = 'transform-thread';
const resourceId = 'transform-resource';

function createModel() {
  let call = 0;
  return new MockLanguageModelV4({
    doStream: async (_options: { prompt: LanguageModelV4Prompt }) => {
      call++;
      const parts =
        call <= 2
          ? [
              {
                type: 'tool-call',
                toolCallId: `call-${call}`,
                toolName: 'lookup',
                input: JSON.stringify({ query: call === 1 ? 'first' : 'second' }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls',
                usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
              },
            ]
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
            ];
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${call}`, modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ] as any[]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  }) as unknown as LanguageModelV4;
}

describe('tool transform persistence', () => {
  it.each([true, false])('keeps raw args and redacts output when savePerStep is %s', async savePerStep => {
    const memory = new MockMemory({ storage: new InMemoryStore(), options: { lastMessages: 100 } });
    await memory.createThread({ threadId, resourceId });

    const agent = new Agent({
      id: 'transform-agent',
      name: 'transform-agent',
      instructions: 'Use your tools.',
      model: createModel(),
      memory,
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Looks something up',
          inputSchema: z.object({ query: z.string() }),
          execute: async ({ query }) => ({ query, payload: 'x'.repeat(50) }),
          transform: {
            transcript: {
              output: ({ output }) => ({ query: (output as { query: string }).query }),
            },
          },
        }),
      },
    });

    const stream = await agent.stream('look things up', {
      maxSteps: 5,
      savePerStep,
      memory: { thread: threadId, resource: resourceId },
    });
    await stream.consumeStream();

    const { messages } = await memory.recall({ threadId, resourceId, perPage: false });
    const invocations = messages.flatMap(message =>
      (message.content.parts ?? []).flatMap(part => (part.type === 'tool-invocation' ? [part.toolInvocation] : [])),
    );

    expect(invocations.map(invocation => [invocation.args, (invocation as { result?: unknown }).result])).toEqual([
      [{ query: 'first' }, { query: 'first' }],
      [{ query: 'second' }, { query: 'second' }],
    ]);
  });
});
