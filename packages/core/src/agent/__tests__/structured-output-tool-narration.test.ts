import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';

/**
 * Regression tests for #25038: with direct-mode structured output, text the model writes before
 * calling tools (narration, or a JSON guess) must not be treated as the final structured answer.
 */
const schema = z.object({ answer: z.string() });

const lookupTool = createTool({
  id: 'lookup',
  description: 'Look up information',
  inputSchema: z.object({ query: z.string() }),
  execute: async () => ({ value: 'zebulon' }),
});

function hasToolResults(prompt: unknown[]) {
  return prompt.some(
    (msg: any) =>
      msg.role === 'tool' || (Array.isArray(msg.content) && msg.content.some((c: any) => c.type === 'tool-result')),
  );
}

function createNarratingModel(intermediateText: string, finalText: string) {
  return new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const final = hasToolResults(prompt);
      return {
        stream: convertArrayToReadableStream(
          final
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-2' },
                { type: 'text-delta', id: 'text-2', delta: finalText },
                { type: 'text-end', id: 'text-2' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 } },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: intermediateText },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName: 'lookup',
                  input: JSON.stringify({ query: 'capital' }),
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
                },
              ],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

const FINAL = JSON.stringify({ answer: 'final' });
const cases = [
  { label: 'prose', intermediate: 'Let me look that up.' },
  { label: 'JSON', intermediate: JSON.stringify({ answer: 'draft' }) },
];

async function collect(fullStream: ReadableStream<any> | AsyncIterable<any>) {
  const chunks: any[] = [];
  for await (const chunk of fullStream as AsyncIterable<any>) {
    chunks.push(chunk);
  }
  return chunks;
}

describe('structured output with text before tool calls (#25038)', () => {
  describe('regular agent', () => {
    it.each(cases)('resolves the final answer when $label precedes a tool call', async ({ intermediate }) => {
      const agent = new Agent({
        id: 'narration-agent',
        name: 'Narration Agent',
        instructions: 'Say what you will look up, then call tools.',
        model: createNarratingModel(intermediate, FINAL) as LanguageModelV2,
        tools: { lookup: lookupTool },
      });

      const stream = await agent.stream('What is the capital?', {
        maxSteps: 3,
        structuredOutput: { schema },
      });
      const chunks = await collect(stream.fullStream);

      expect(chunks.filter(c => c.type === 'error')).toEqual([]);
      expect(chunks.filter(c => c.type === 'object-result').map(c => c.object)).toEqual([{ answer: 'final' }]);
      expect(await stream.object).toEqual({ answer: 'final' });
    });

    it('still fails when the terminal answer is invalid', async () => {
      const agent = new Agent({
        id: 'narration-agent-invalid',
        name: 'Narration Agent',
        instructions: 'Say what you will look up, then call tools.',
        model: createNarratingModel(JSON.stringify({ answer: 'draft' }), 'not json at all') as LanguageModelV2,
        tools: { lookup: lookupTool },
      });

      const stream = await agent.stream('What is the capital?', {
        maxSteps: 3,
        structuredOutput: { schema },
      });
      const chunks = await collect(stream.fullStream);

      expect(chunks.filter(c => c.type === 'object-result')).toEqual([]);
      expect(chunks.filter(c => c.type === 'error')).toHaveLength(1);
    });
  });

  describe('durable agent', () => {
    let pubsub: EventEmitterPubSub;

    beforeEach(() => {
      pubsub = new EventEmitterPubSub();
    });

    afterEach(async () => {
      await pubsub.close();
    });

    it.each(cases)('resolves the final answer when $label precedes a tool call', async ({ intermediate }) => {
      const baseAgent = new Agent({
        id: 'durable-narration-agent',
        name: 'Durable Narration Agent',
        instructions: 'Say what you will look up, then call tools.',
        model: createNarratingModel(intermediate, FINAL) as LanguageModelV2,
        tools: { lookup: lookupTool },
      });
      const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });

      const { output, cleanup } = await durableAgent.stream('What is the capital?', {
        maxSteps: 3,
        structuredOutput: { schema },
      });
      try {
        const chunks = await collect(output.fullStream);

        expect(chunks.filter(c => c.type === 'error')).toEqual([]);
        expect(chunks.filter(c => c.type === 'object-result').map(c => c.object)).toEqual([{ answer: 'final' }]);
        expect(await output.object).toEqual({ answer: 'final' });
      } finally {
        cleanup();
      }
    });
  });
});
