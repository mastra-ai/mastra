import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { BatchPartsProcessor } from '../../processors/processors/batch-parts';
import type { ChunkType } from '../../stream';
import { createTool } from '../../tools/tool';
import { Agent } from '../agent';

/**
 * Reproduction for https://github.com/mastra-ai/mastra/issues/17094
 *
 * When the BatchPartsProcessor buffers text-delta parts and a non-text part
 * (e.g. tool-result) arrives, the processor flushes the buffered text and
 * defers the non-text part to the next processOutputStream call. If the agent
 * stops on that step (e.g. stopWhen on a tool call), the next call never
 * happens and the deferred part is lost from the stream.
 */
describe('BatchPartsProcessor with stopWhen on a tool call (issue #17094)', () => {
  const weatherTool = createTool({
    id: 'weatherTool',
    description: 'Get the weather',
    inputSchema: z.object({ location: z.string() }),
    outputSchema: z.object({ temperature: z.number() }),
    execute: async () => ({ temperature: 70 }),
  });

  function makeModel() {
    return new MockLanguageModelV2({
      doStream: async () => ({
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Let me check the weather.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'weatherTool',
            input: JSON.stringify({ location: 'Toronto' }),
          },
          {
            type: 'finish',
            finishReason: 'tool-calls',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
      }),
    });
  }

  it('emits the final tool-result part even when stopWhen stops the loop', async () => {
    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'You are an agent that follows the users instructions.',
      model: makeModel(),
      tools: { weatherTool },
      outputProcessors: [new BatchPartsProcessor({ batchSize: 10 })],
    });

    const stream = await agent.stream('What is the weather in Toronto?', {
      // Stop as soon as the model produced a tool call for weatherTool.
      stopWhen: ({ steps }: { steps: any[] }) =>
        steps.some(step => step.content?.some((item: any) => item.type === 'tool-call')),
    });

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    const toolResult = chunks.find(c => c.type === 'tool-result');
    expect(toolResult).toBeDefined();
    expect((toolResult as any)?.payload?.result).toEqual({ temperature: 70 });
  });
});
