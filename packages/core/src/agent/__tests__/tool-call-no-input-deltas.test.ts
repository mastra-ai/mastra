import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { createTool } from '../../tools';
import { Agent } from '../agent';

// Providers such as OpenAI Responses and Anthropic programmatic tool calling emit
// tool-input-start + tool-input-end with no deltas, and only carry the args on the final tool-call.
function createModel() {
  let doStreamCallCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      doStreamCallCount++;
      if (doStreamCallCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'tool-input-start', id: 'call-1', toolName: 'getTask' },
            { type: 'tool-input-end', id: 'call-1' },
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'getTask', input: '{"id":"task123"}' },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('tool call whose input stream has no deltas', () => {
  it.each([true, false])(
    'executes the tool once with the args from the final tool-call (eagerToolExecution: %s)',
    async eagerToolExecution => {
      const inputs: unknown[] = [];
      const agent = new Agent({
        id: 'no-input-deltas-agent',
        name: 'No Input Deltas Agent',
        instructions: 'Use the tool.',
        model: createModel(),
        tools: {
          getTask: createTool({
            id: 'getTask',
            description: 'Gets a task',
            inputSchema: z.object({ id: z.string() }),
            execute: async input => {
              inputs.push(input);
              return { ok: true };
            },
          }),
        },
      });

      const result = await agent.stream('get task123', { eagerToolExecution });
      const toolCallArgs: unknown[] = [];
      for await (const chunk of result.fullStream) {
        if (chunk.type === 'tool-call') toolCallArgs.push(chunk.payload.args);
      }

      expect(inputs).toEqual([{ id: 'task123' }]);
      expect(toolCallArgs).toEqual([{ id: 'task123' }]);
      expect((await result.toolCalls).map(tc => tc.payload.args)).toEqual([{ id: 'task123' }]);
    },
  );
});
