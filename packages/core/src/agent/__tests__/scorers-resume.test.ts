import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { createScorer } from '../../evals';
import { runScorer } from '../../evals/hooks';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { agentThreadStreamRuntime } from '../thread-stream-runtime';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

vi.mock('../../evals/hooks', () => ({
  runScorer: vi.fn(),
}));

const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

function toolCallStep(calls: Array<{ id: string; name: string }>) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: `resp-${calls[0]!.id}`, modelId: 'mock', timestamp: new Date(0) },
    ...calls.map(call => ({
      type: 'tool-call' as const,
      toolCallId: call.id,
      toolName: call.name,
      input: '{}',
      providerExecuted: false,
    })),
    { type: 'finish', finishReason: 'tool-calls', usage },
  ]);
}

function textStep(text: string) {
  return convertArrayToReadableStream([
    { type: 'stream-start', warnings: [] },
    { type: 'response-metadata', id: 'resp-final', modelId: 'mock', timestamp: new Date(0) },
    { type: 'text-start', id: 'text-1' },
    { type: 'text-delta', id: 'text-1', delta: text },
    { type: 'text-end', id: 'text-1' },
    { type: 'finish', finishReason: 'stop', usage },
  ]);
}

// toolA + toolB -> askUser (suspends) -> askUser (suspends again) -> toolC -> final text
function createScriptedModel() {
  const steps = [
    () =>
      toolCallStep([
        { id: 'call-a', name: 'toolA' },
        { id: 'call-b', name: 'toolB' },
      ]),
    () => toolCallStep([{ id: 'call-ask-1', name: 'askUser' }]),
    () => toolCallStep([{ id: 'call-ask-2', name: 'askUser' }]),
    () => toolCallStep([{ id: 'call-c', name: 'toolC' }]),
    () => textStep('All done'),
  ];
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const step = steps[Math.min(call++, steps.length - 1)]!;
      return { rawCall: { rawPrompt: null, rawSettings: {} }, warnings: [], stream: step() };
    },
  });
}

function createTools() {
  const simple = (id: string) =>
    createTool({
      id,
      description: id,
      inputSchema: z.object({}),
      execute: async () => ({ ok: id }),
    });

  return {
    toolA: simple('toolA'),
    toolB: simple('toolB'),
    toolC: simple('toolC'),
    askUser: createTool({
      id: 'askUser',
      description: 'Ask the user a question',
      inputSchema: z.object({}),
      suspendSchema: z.object({ question: z.string() }),
      resumeSchema: z.object({ answer: z.string() }),
      execute: async (_input, context) => {
        if (!context?.agent?.resumeData) {
          return await context?.agent?.suspend({ question: 'Which one?' });
        }
        return { answer: context.agent.resumeData.answer };
      },
    }),
  };
}

function toolNamesIn(messages: any[]): string[] {
  return messages.flatMap(message =>
    (message.content?.parts ?? [])
      .filter((part: any) => part.type === 'tool-invocation')
      .map((part: any) => part.toolInvocation.toolName),
  );
}

async function drain(output: { fullStream: AsyncIterable<unknown> }) {
  for await (const _chunk of output.fullStream) {
    void _chunk;
  }
}

describe('live scorers across suspend/resume (#26258)', () => {
  beforeEach(() => {
    vi.mocked(runScorer).mockClear();
    agentThreadStreamRuntime.resetForTests();
  });

  async function runSuspendResumeTwice({ withMemory }: { withMemory: boolean }) {
    const scorer = createScorer({ id: 'resume-scorer', name: 'resumeScorer', description: 'test' }).generateScore(
      () => 1,
    );

    const agent = new Agent({
      id: 'resume-agent',
      name: 'Resume Agent',
      instructions: 'Use tools.',
      model: createScriptedModel(),
      tools: createTools(),
      scorers: { resumeScorer: { scorer } },
      ...(withMemory ? { memory: new MockMemory() } : {}),
    });

    const mastra = new Mastra({ agents: { agent }, logger: false, storage: new InMemoryStore() });
    const registered = mastra.getAgent('agent');
    const memoryOptions = withMemory ? { memory: { thread: 'thread-1', resource: 'resource-1' } } : {};

    const first = await registered.stream('Do the task', memoryOptions);
    await drain(first);
    expect(runScorer).not.toHaveBeenCalled();

    const second = await registered.resumeStream({ answer: 'first' }, { runId: first.runId, ...memoryOptions });
    await drain(second);
    expect(runScorer).not.toHaveBeenCalled();

    const third = await registered.resumeStream({ answer: 'second' }, { runId: first.runId, ...memoryOptions });
    await drain(third);

    await vi.waitFor(() => expect(runScorer).toHaveBeenCalledTimes(1));
    return { runId: first.runId, call: vi.mocked(runScorer).mock.calls[0]![0] };
  }

  it.each([{ withMemory: false }, { withMemory: true }])(
    'scores every segment of the run once, under the original runId (memory: $withMemory)',
    async ({ withMemory }) => {
      const { runId, call } = await runSuspendResumeTwice({ withMemory });

      expect(call.runId).toBe(runId);
      expect(toolNamesIn(call.output)).toEqual(['toolA', 'toolB', 'askUser', 'askUser', 'toolC']);
      expect(toolNamesIn(call.input.rememberedMessages)).toEqual([]);
    },
    30000,
  );
});
