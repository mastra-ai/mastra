/**
 * Regression tests for #26514: when the model makes several tool calls in one
 * step and one of them suspends, the sibling calls must not be lost.
 *
 * Before the fix, the suspension killed the tool-call foreach, so a sibling
 * queued after the suspender never ran, and a sibling that had already finished
 * was never committed (llmMappingStep is the only place that commits results
 * and it never ran for the step). Memory kept the sibling as `state: "call"`,
 * and an auto-resume turn re-called only the suspended tool.
 *
 * Covered for both the plain and the durable agent:
 * - the sibling runs exactly once, whether it comes before or after the suspender
 * - a successful sibling is saved as `result` and the next model call sees it
 * - a throwing sibling is saved as `output-error` and the next model call sees it
 * - a sibling whose result a processor blocks is never saved or shown as a result
 */
import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { afterEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { createDurableAgent } from '../durable/create-durable-agent';
import { globalRunRegistry } from '../durable/run-registry';

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

type Engine = 'plain' | 'durable';
type Order = 'sibling-first' | 'sibling-last';
type Outcome = 'success' | 'error' | 'blocked';

const toolCall = (toolCallId: string, toolName: string, input: unknown) => ({
  type: 'tool-call' as const,
  toolCallType: 'function' as const,
  toolCallId,
  toolName,
  input: JSON.stringify(input),
});

function scriptedModel(steps: any[][]) {
  const prompts: any[][] = [];
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const index = prompts.length;
      prompts.push(prompt as any[]);
      const parts = steps[Math.min(index, steps.length - 1)]!;
      const toolStep = parts.some(p => p.type === 'tool-call');
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: `r${index}`, modelId: 'm', timestamp: new Date(0) },
          ...parts,
          { type: 'finish', finishReason: toolStep ? 'tool-calls' : 'stop', usage },
        ] as any),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
  return { model, prompts };
}

const text = (value: string) => [
  { type: 'text-start' as const, id: 't' },
  { type: 'text-delta' as const, id: 't', delta: value },
  { type: 'text-end' as const, id: 't' },
];

async function drain(stream: AsyncIterable<unknown>) {
  for await (const _chunk of stream) {
    // drain
  }
}

async function runScenario(engine: Engine, order: Order, outcome: Outcome) {
  const runs: string[] = [];
  const getWeather = createTool({
    id: 'getWeather',
    description: 'weather',
    inputSchema: z.object({ city: z.string() }),
    execute: async () => {
      runs.push('getWeather');
      if (outcome === 'error') throw new Error('weather down');
      return { tempF: 72 };
    },
  });
  const bookTable = createTool({
    id: 'bookTable',
    description: 'book',
    inputSchema: z.object({ guests: z.number() }),
    suspendSchema: z.object({ question: z.string() }),
    resumeSchema: z.object({ confirmed: z.boolean() }),
    execute: async (_input, context) => {
      runs.push('bookTable');
      if (!context?.agent?.resumeData) {
        return await context?.agent?.suspend({ question: 'which time?' });
      }
      return { booked: true };
    },
  });
  const blockWeather: Processor = {
    id: 'block-weather',
    processToolResult: async ({ toolName, abort }: any) => {
      if (toolName === 'getWeather') abort('weather result blocked');
    },
  } as Processor;

  const weather = toolCall('call-weather', 'getWeather', { city: 'Lisbon' });
  const book = toolCall('call-book', 'bookTable', { guests: 2 });
  const { model, prompts } = scriptedModel([
    order === 'sibling-first' ? [weather, book] : [book, weather],
    [
      toolCall('call-book-2', 'bookTable', {
        guests: 2,
        suspendedToolCallId: 'call-book',
        resumeData: { confirmed: true },
      }),
    ],
    text('done'),
  ]);

  const storage = new InMemoryStore();
  const memory = new MockMemory({ storage });
  const base = new Agent({
    id: 'sibling-agent',
    name: 'Sibling Agent',
    instructions: 'x',
    model,
    memory,
    tools: { getWeather, bookTable },
    ...(outcome === 'blocked' ? { outputProcessors: [blockWeather] } : {}),
  });
  const pubsub = engine === 'durable' ? new EventEmitterPubSub() : undefined;
  const agent: any = engine === 'durable' ? createDurableAgent({ agent: base, pubsub: pubsub! }) : base;
  new Mastra({ agents: { agent }, logger: false, storage });

  const threadId = `thread-${engine}-${order}-${outcome}`;
  const resourceId = 'user-1';
  const options = {
    memory: { thread: threadId, resource: resourceId },
    maxSteps: 4,
    autoResumeSuspendedTools: true,
    closeOnSuspend: true,
  } as any;

  try {
    const first = await agent.stream('weather in Lisbon, then book a table', options);
    await drain((first.output ?? first).fullStream);

    // Turn 2 auto-resumes the suspended tool.
    const second = await agent.stream('book it', options);
    await drain((second.output ?? second).fullStream);

    const recalled = await memory.recall({ threadId, resourceId, perPage: 50 } as any);
    const weatherParts = recalled.messages
      .flatMap((message: any) => message.content?.parts ?? [])
      .filter((part: any) => part.type === 'tool-invocation' && part.toolInvocation.toolName === 'getWeather')
      .map((part: any) => part.toolInvocation);
    const promptToolResults = (prompts.at(-1) ?? [])
      .flatMap((message: any) => (Array.isArray(message.content) ? message.content : []))
      .filter((part: any) => part.type === 'tool-result' && part.toolName === 'getWeather');

    return { runs, weatherParts, promptToolResults, modelCalls: prompts.length };
  } finally {
    globalRunRegistry.clear();
    await pubsub?.close();
  }
}

describe('a suspending tool call does not drop sibling tool calls (#26514)', () => {
  afterEach(() => {
    globalRunRegistry.clear();
  });

  describe.each(['plain', 'durable'] as const)('%s agent', engine => {
    describe.each(['sibling-first', 'sibling-last'] as const)('%s', order => {
      it('runs the sibling once, saves its result and shows it to the model on auto-resume', async () => {
        const { runs, weatherParts, promptToolResults } = await runScenario(engine, order, 'success');

        expect(runs.filter(name => name === 'getWeather')).toHaveLength(1);
        expect(weatherParts.map(part => part.state)).toEqual(['result']);
        expect(weatherParts[0].result).toEqual({ tempF: 72 });
        expect(promptToolResults).toHaveLength(1);
        expect(JSON.stringify(promptToolResults[0])).toContain('tempF');
      }, 30000);

      it('saves a throwing sibling as an error and shows it to the model on auto-resume', async () => {
        const { runs, weatherParts, promptToolResults } = await runScenario(engine, order, 'error');

        expect(runs.filter(name => name === 'getWeather')).toHaveLength(1);
        expect(weatherParts.map(part => part.state)).toEqual(['output-error']);
        expect(promptToolResults).toHaveLength(1);
        expect(JSON.stringify(promptToolResults[0])).toContain('weather down');
      }, 30000);

      it('never saves or shows a sibling result that a processor blocked', async () => {
        const { runs, weatherParts, promptToolResults } = await runScenario(engine, order, 'blocked');

        expect(runs.filter(name => name === 'getWeather')).toHaveLength(1);
        expect(weatherParts.every(part => part.state !== 'result' && part.result === undefined)).toBe(true);
        expect(JSON.stringify(promptToolResults)).not.toContain('tempF');
      }, 30000);
    });
  });
});
