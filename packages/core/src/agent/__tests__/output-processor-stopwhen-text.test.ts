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

    it(`keeps text on both sides of the tool call in the final step (processor: ${withProcessor})`, async () => {
      const model = scriptedModel([
        [...textPart('t1', 'Before. '), askCall('c1'), ...textPart('t2', 'After.'), finish('tool-calls')],
      ]);
      const { text, steps } = await run(makeAgent(model, withProcessor));

      expect(steps).toHaveLength(1);
      expect(steps.at(-1)!.text).toBe('Before. After.');
      expect(text).toBe('Before. After.');
    });

    it(`keeps all text when the final step interleaves text and tool calls (processor: ${withProcessor})`, async () => {
      const model = scriptedModel([
        [...textPart('t1', 'A '), askCall('c1'), ...textPart('t2', 'B'), askCall('c2'), finish('tool-calls')],
      ]);
      const { text, steps } = await run(makeAgent(model, withProcessor));

      expect(steps).toHaveLength(1);
      expect(steps.at(-1)!.text).toBe('A B');
      expect(text).toBe('A B');
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

  it('uses processed step text when an output processor collapses text parts', async () => {
    const model = scriptedModel([[...textPart('t1', 'secret '), ...textPart('t2', 'stuff'), finish('stop')]]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'collapse-result',
          processOutputResult: async ({ messages }) =>
            messages.map(message =>
              message.role === 'assistant'
                ? {
                    ...message,
                    content: {
                      ...message.content,
                      content: 'REDACTED',
                      parts: [{ type: 'text', text: 'REDACTED' }],
                    },
                  }
                : message,
            ),
        },
      ],
    });

    const stream = await agent.stream('hi');
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('REDACTED');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['REDACTED']);
    expect(fullOutput.text).toBe('REDACTED');
  });

  it('keeps feedback continuation steps iteration-local with an output processor', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'first'), finish('stop')],
      [...textPart('t2', 'MORE'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [passThrough],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Now say MORE.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('firstMORE');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['first', 'MORE']);
    expect(fullOutput.text).toBe('firstMORE');
  });

  it('keeps processed feedback continuation text iteration-local', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'first'), finish('stop')],
      [...textPart('t2', 'more'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'uppercase-result',
          processOutputResult: async ({ messages }) =>
            messages.map(message => ({
              ...message,
              content: {
                ...message.content,
                parts: message.content.parts?.map(part =>
                  part.type === 'text' ? { ...part, text: part.text.toUpperCase() } : part,
                ),
              },
            })),
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Now say more.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('FIRSTMORE');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['first', 'MORE']);
    expect(fullOutput.text).toBe('firstMORE');
  });

  it('does not reconcile the final step from an earlier message when its response is removed', async () => {
    const model = scriptedModel([
      [...textPart('t1', 'first'), finish('stop')],
      [...textPart('t2', 'MORE'), finish('stop')],
    ]);
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'test',
      model,
      outputProcessors: [
        {
          id: 'remove-final-response',
          processOutputResult: async ({ messages }) => {
            const finalResponse = messages.findLast(
              message => message.role === 'assistant' && !message.content?.metadata?.completionResult,
            );
            if (!finalResponse) return messages;

            return [
              ...messages.filter(message => message.id !== finalResponse.id),
              {
                ...finalResponse,
                id: 'earlier-response',
                content: {
                  ...finalResponse.content,
                  content: 'first',
                  parts: [{ type: 'text', text: 'first' }],
                },
              },
            ];
          },
        },
      ],
    });
    let iteration = 0;

    const stream = await agent.stream('hi', {
      maxSteps: 2,
      onIterationComplete: async () => (++iteration === 1 ? { continue: true, feedback: 'Now say MORE.' } : undefined),
    });
    const fullOutput = await stream.getFullOutput();

    expect(await stream.text).toBe('first');
    expect(fullOutput.steps.map(step => step.text)).toEqual(['first', 'MORE']);
    expect(fullOutput.text).toBe('firstMORE');
  });

  for (const [label, rewrite, step, expected] of [
    ['redacts', '[REDACTED]', [...textPart('t1', 'SECRET'), askCall('c1'), finish('tool-calls')], '[REDACTED]'],
    ['clears', '', [...textPart('t1', 'SECRET'), askCall('c1'), finish('tool-calls')], ''],
    [
      'redacts interleaved text in',
      'X',
      [...textPart('t1', 'A '), askCall('c1'), ...textPart('t2', 'B'), askCall('c2'), finish('tool-calls')],
      'XX',
    ],
  ] as const) {
    it(`uses the processed text when a processor ${label} it`, async () => {
      const model = scriptedModel([[...step]]);
      const agent = new Agent({
        id: 'a',
        name: 'a',
        instructions: 'test',
        model,
        tools: { ask: askTool },
        outputProcessors: [
          {
            id: 'redact',
            processOutputStream: async ({ part }) =>
              part.type === 'text-delta' ? { ...part, payload: { ...part.payload, text: rewrite } } : part,
          },
        ],
      });
      const { text, steps } = await run(agent);

      expect(steps.at(-1)!.text).toBe(expected);
      expect(text).toBe(expected);
    });
  }
});
