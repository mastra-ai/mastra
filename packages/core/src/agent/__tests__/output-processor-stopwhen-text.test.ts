import { convertArrayToReadableStream, MockLanguageModelV3 } from '@internal/ai-v6/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import type { Processor } from '../../processors';
import { createTool } from '../../tools';
import { Agent } from '../agent';

// Regression for https://github.com/mastra-ai/mastra/issues/24917

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

function scriptedModel(steps: any[][]) {
  let call = 0;
  return new MockLanguageModelV3({
    doStream: async () => {
      const parts = steps[Math.min(call++, steps.length - 1)]!;
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `id-${call}`, modelId: 'mock', timestamp: new Date(0) },
          ...parts,
        ]),
      };
    },
  });
}

const textPart = (id: string, text: string) => [
  { type: 'text-start', id },
  { type: 'text-delta', id, delta: text },
  { type: 'text-end', id },
];
const askCall = (id: string) => ({ type: 'tool-call', toolCallId: id, toolName: 'ask', input: '{"question":"ok?"}' });
const finish = (unified: string) => ({ type: 'finish', finishReason: { unified, raw: unified }, usage });

const askTool = createTool({
  id: 'ask',
  description: 'Ask the user',
  inputSchema: z.object({ question: z.string() }),
  execute: async () => ({ answered: true }),
});

const passThrough: Processor = {
  id: 'pass-through',
  processOutputStream: async ({ part }) => part,
};

const stopOnAsk = ({ steps }: { steps: any[] }) =>
  steps.at(-1)?.toolCalls?.some((c: any) => (c.toolName ?? c.payload?.toolName) === 'ask') ?? false;

function makeAgent(model: MockLanguageModelV3, withProcessor: boolean) {
  return new Agent({
    id: 'a',
    name: 'a',
    instructions: 'test',
    model,
    tools: { ask: askTool },
    ...(withProcessor ? { outputProcessors: [passThrough] } : {}),
  });
}

async function run(agent: Agent) {
  const stream = await agent.stream('hi', { stopWhen: stopOnAsk as any });
  let deltas = '';
  for await (const chunk of stream.fullStream) {
    if (chunk.type === 'text-delta') deltas += chunk.payload.text;
  }
  return { deltas, text: await stream.text, steps: await stream.steps };
}

describe('output processor + stopWhen on a text+tool-call step (#24917)', () => {
  for (const withProcessor of [false, true]) {
    it(`keeps stream.text for the final step (processor: ${withProcessor})`, async () => {
      const model = scriptedModel([[...textPart('t1', 'Hello there.'), askCall('c1'), finish('tool-calls')]]);
      const { deltas, text, steps } = await run(makeAgent(model, withProcessor));

      expect(deltas).toBe('Hello there.');
      expect(steps).toHaveLength(1);
      expect(steps.at(-1)!.text).toBe('Hello there.');
      expect(text).toBe('Hello there.');
    });

    it(`does not leak earlier-step text when the final step is tool-only (processor: ${withProcessor})`, async () => {
      const model = scriptedModel([
        [...textPart('t1', 'Let me check.'), { ...askCall('c0'), toolName: 'noop' }, finish('tool-calls')],
        [askCall('c1'), finish('tool-calls')],
      ]);
      const agent = new Agent({
        id: 'a',
        name: 'a',
        instructions: 'test',
        model,
        tools: {
          ask: askTool,
          noop: createTool({
            id: 'noop',
            description: 'noop',
            inputSchema: z.object({ question: z.string() }),
            execute: async () => ({}),
          }),
        },
        ...(withProcessor ? { outputProcessors: [passThrough] } : {}),
      });
      const { steps, text } = await run(agent);

      expect(steps).toHaveLength(2);
      expect(steps.at(-1)!.text).toBe('');
      expect(text).toBe('');
    });
  }
});
