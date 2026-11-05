/**
 * Regression for https://github.com/mastra-ai/mastra/issues/26258
 *
 * A live scorer on a run that suspends and resumes must score the whole run,
 * including tool calls made before suspend(), even when thread-scoped
 * Observational Memory observes (and prunes) those messages between segments.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createScorer } from '@mastra/core/evals';
import { Mastra } from '@mastra/core/mastra';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

import { Memory } from '../../../index';

const usage = { inputTokens: 50, outputTokens: 20, totalTokens: 70 };

function toolCallStep(n: number, calls: Array<{ id: string; name: string }>) {
  return convertArrayToReadableStream([
    { type: 'stream-start' as const, warnings: [] },
    { type: 'response-metadata' as const, id: `resp-${n}`, modelId: 'mock-actor', timestamp: new Date() },
    ...calls.map(call => ({
      type: 'tool-call' as const,
      toolCallId: call.id,
      toolName: call.name,
      input: '{}',
      providerExecuted: false,
    })),
    { type: 'finish' as const, finishReason: 'tool-calls' as const, usage },
  ]);
}

function textStep(n: number, text: string) {
  return convertArrayToReadableStream([
    { type: 'stream-start' as const, warnings: [] },
    { type: 'response-metadata' as const, id: `resp-${n}`, modelId: 'mock-actor', timestamp: new Date() },
    { type: 'text-start' as const, id: 'text-1' },
    { type: 'text-delta' as const, id: 'text-1', delta: text },
    { type: 'text-end' as const, id: 'text-1' },
    { type: 'finish' as const, finishReason: 'stop' as const, usage },
  ]);
}

// toolA + toolB -> askUser (suspends) -> askUser (suspends again) -> toolC -> final text
function createActorModel(actorPrompts: unknown[][]) {
  const steps = [
    (n: number) =>
      toolCallStep(n, [
        { id: 'call-a', name: 'toolA' },
        { id: 'call-b', name: 'toolB' },
      ]),
    (n: number) => toolCallStep(n, [{ id: 'call-ask-1', name: 'askUser' }]),
    (n: number) => toolCallStep(n, [{ id: 'call-ask-2', name: 'askUser' }]),
    (n: number) => toolCallStep(n, [{ id: 'call-c', name: 'toolC' }]),
    (n: number) => textStep(n, 'All done.'),
  ];
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async options => {
      const n = call++;
      actorPrompts.push(options.prompt);
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: steps[Math.min(n, steps.length - 1)]!(n),
      };
    },
  });
}

function createTextModel(id: string, text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
      stream: convertArrayToReadableStream([
        { type: 'stream-start' as const, warnings: [] },
        { type: 'response-metadata' as const, id, modelId: id, timestamp: new Date() },
        { type: 'text-start' as const, id: 'text-1' },
        { type: 'text-delta' as const, id: 'text-1', delta: text },
        { type: 'text-end' as const, id: 'text-1' },
        {
          type: 'finish' as const,
          finishReason: 'stop' as const,
          usage: { inputTokens: 50, outputTokens: 100, totalTokens: 150 },
        },
      ]),
    }),
  });
}

// Long tool results push each step over the low messageTokens threshold so OM observes mid-run.
const longResult =
  'This tool produced a long, detailed result so that observational memory crosses its token threshold and ' +
  'observes the pre-suspend messages before the run is resumed. '.repeat(4);

function createTools() {
  const simple = (id: string) =>
    createTool({
      id,
      description: id,
      inputSchema: z.object({}),
      execute: async () => ({ tool: id, detail: longResult }),
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
        return { answer: context.agent.resumeData.answer, detail: longResult };
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

describe('live scorers across suspend/resume with Observational Memory (#26258)', () => {
  it('scores tool calls made before suspend() after OM observes them', async () => {
    const actorPrompts: unknown[][] = [];
    const store = new InMemoryStore();
    const scorerRuns: Array<{ runId?: string; output: any[]; input: any }> = [];

    const scorer = createScorer({ id: 'resume-scorer', name: 'resumeScorer', description: 'test' }).generateScore(
      ({ run }) => {
        scorerRuns.push({ runId: run.runId, output: run.output, input: run.input });
        return 1;
      },
    );

    const memory = new Memory({
      storage: store,
      options: {
        observationalMemory: {
          enabled: true,
          scope: 'thread',
          observation: {
            model: createTextModel(
              'obs',
              '<observations>\n- 🔴 User asked for a multi-step task.\n</observations>',
            ) as any,
            messageTokens: 20,
            bufferTokens: false,
          },
          reflection: {
            model: createTextModel('ref', '<observations>\n- 🔴 Condensed.\n</observations>') as any,
            observationTokens: 50000,
          },
        },
      },
    });

    const agent = new Agent({
      id: 'om-resume-agent',
      name: 'OM Resume Agent',
      instructions: 'Use tools.',
      model: createActorModel(actorPrompts) as any,
      tools: createTools(),
      memory,
      scorers: { resumeScorer: { scorer } },
    });

    const mastra = new Mastra({ agents: { agent }, logger: false, storage: store });
    const registered = mastra.getAgent('agent');
    const memoryOptions = { memory: { thread: 'om-thread', resource: 'om-resource' } };

    const first = await registered.stream('Do the multi-step task', memoryOptions);
    await drain(first);

    const memoryStore = await store.getStore('memory');
    const record = await memoryStore!.getObservationalMemory('om-thread', 'om-resource');
    expect(record?.activeObservations).toContain('multi-step task');

    const second = await registered.resumeStream({ answer: 'first' }, { runId: first.runId, ...memoryOptions });
    await drain(second);

    const third = await registered.resumeStream({ answer: 'second' }, { runId: first.runId, ...memoryOptions });
    await drain(third);

    for (const [index, toolCallId] of [
      [2, 'call-ask-1'],
      [3, 'call-ask-2'],
    ] as const) {
      expect(actorPrompts[index]).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'assistant',
            content: expect.arrayContaining([expect.objectContaining({ type: 'tool-call', toolCallId })]),
          }),
          expect.objectContaining({
            role: 'tool',
            content: expect.arrayContaining([expect.objectContaining({ type: 'tool-result', toolCallId })]),
          }),
        ]),
      );
    }
    await vi.waitFor(() => expect(scorerRuns).toHaveLength(1), { timeout: 5000 });
    expect(scorerRuns[0]!.runId).toBe(first.runId);
    expect(toolNamesIn(scorerRuns[0]!.output)).toEqual(['toolA', 'toolB', 'askUser', 'askUser', 'toolC']);
  }, 60000);
});
