import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function createToolThenTextModel() {
  let calls = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      calls++;
      const parts =
        calls === 1
          ? [
              { type: 'stream-start' as const, warnings: [] },
              {
                type: 'tool-call' as const,
                toolCallId: 'call-1',
                toolName: 'lookup',
                input: '{"query":"first"}',
                providerExecuted: false,
              },
              { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
            ]
          : [
              { type: 'stream-start' as const, warnings: [] },
              { type: 'text-start' as const, id: 'text-1' },
              { type: 'text-delta' as const, id: 'text-1', delta: 'done' },
              { type: 'text-end' as const, id: 'text-1' },
              { type: 'finish' as const, finishReason: 'stop' as const, usage },
            ];
      return {
        stream: convertArrayToReadableStream(parts),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

// GitHub #26597: a transcript transform configured only for `output` must not replace the
// stored tool-call `args` with a placeholder, on either save path. `savePerStep: true` persists
// through the save queue (MessageList.drainUnsavedMessages); `savePerStep: false` persists
// through MessageHistory.processOutputResult.
describe('tool transform persistence', () => {
  it.each([true, false])('keeps tool args and transforms the result when savePerStep is %s', async savePerStep => {
    const lookup = createTool({
      id: 'lookup',
      description: 'Look something up.',
      inputSchema: z.object({ query: z.string() }),
      execute: async ({ query }) => ({ query, payload: 'x'.repeat(50) }),
      transform: {
        transcript: { output: ({ output }) => ({ query: (output as { query: string }).query }) },
      },
    });

    const memory = new MockMemory();
    const agent = new Agent({
      id: 'tool-transform-persistence',
      name: 'tool-transform-persistence',
      instructions: 'Use the tool.',
      model: createToolThenTextModel(),
      memory,
      tools: { lookup },
    });

    const result = await agent.stream('go', {
      memory: { thread: `thread-${savePerStep}`, resource: 'resource-1' },
      savePerStep,
    });
    await result.consumeStream();

    const { messages } = await memory.recall({ threadId: `thread-${savePerStep}`, resourceId: 'resource-1' });
    const invocation = messages
      .flatMap(message => message.content.parts ?? [])
      .find(part => part.type === 'tool-invocation' && part.toolInvocation.toolCallId === 'call-1');

    expect(invocation?.type === 'tool-invocation' && invocation.toolInvocation).toMatchObject({
      state: 'result',
      args: { query: 'first' },
      result: { query: 'first' },
    });
  });
});
