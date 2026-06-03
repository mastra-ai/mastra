import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { BatchPartsProcessor } from '../../processors/processors/batch-parts';
import type { ChunkType } from '../../stream';
import { createTool } from '../../tools/tool';
import { Agent } from '../agent';

/**
 * Companion to batch-parts-stop-when.test.ts for https://github.com/mastra-ai/mastra/issues/17094.
 *
 * Verifies that when BatchPartsProcessor flushes buffered text alongside the
 * non-text part that triggered the flush, the flushed text still flows through
 * downstream output processors (it must NOT bypass the rest of the chain), and
 * the non-text part is not dropped — even when a stopWhen condition stops the
 * loop on that part.
 */
describe('BatchPartsProcessor with a downstream processor (issue #17094)', () => {
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

  it('routes the flushed batch through a downstream processor and keeps the tool-result', async () => {
    const seenByDownstream: string[] = [];

    // Downstream processor that uppercases text-delta chunks. The flushed batch
    // emitted by BatchPartsProcessor must pass through this processor.
    const uppercaser = {
      id: 'uppercaser',
      name: 'Uppercaser',
      processOutputStream: async ({ part }: { part: ChunkType }) => {
        if (part.type === 'text-delta') {
          seenByDownstream.push(part.payload.text);
          return { ...part, payload: { ...part.payload, text: part.payload.text.toUpperCase() } };
        }
        return part;
      },
    };

    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'You are an agent that follows the users instructions.',
      model: makeModel(),
      tools: { weatherTool },
      // BatchPartsProcessor first, then a downstream processor (the documented ordering).
      outputProcessors: [new BatchPartsProcessor({ batchSize: 10 }), uppercaser as any],
    });

    const stream = await agent.stream('What is the weather in Toronto?', {
      stopWhen: ({ steps }: { steps: any[] }) =>
        steps.some(step => step.content?.some((item: any) => item.type === 'tool-call')),
    });

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    // The flushed batched text reached the downstream processor and was uppercased.
    const emittedText = chunks
      .filter((c): c is Extract<ChunkType, { type: 'text-delta' }> => c.type === 'text-delta')
      .map(c => c.payload.text)
      .join('');
    expect(emittedText).toBe('LET ME CHECK THE WEATHER.');
    expect(seenByDownstream).toContain('Let me check the weather.');

    // The non-text part (tool-result) is still emitted even though stopWhen
    // stopped the loop on it.
    const toolResult = chunks.find(c => c.type === 'tool-result');
    expect(toolResult).toBeDefined();
    expect((toolResult as any)?.payload?.result).toEqual({ temperature: 70 });
  });
});
