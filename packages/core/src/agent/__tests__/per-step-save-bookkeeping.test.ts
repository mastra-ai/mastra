import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import type { Processor } from '../../processors';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';

describe('per-step save bookkeeping (#25538)', () => {
  it.each([false, true])('scopes resumed stopWhen and processor steps with savePerStep=%s', async savePerStep => {
    let calls = 0;
    const processorResults: string[][] = [];
    const processor: Processor = {
      id: 'track-completed-step',
      processInputStep: async ({ steps }) => {
        const last = steps.at(-1);
        if (last) processorResults.push(last.toolResults.map(result => result.toolCallId));
        return {};
      },
    };
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        const toolName = calls === 1 ? 'lookup' : calls === 2 ? 'confirm' : 'attempt';
        const toolCallId = calls === 1 ? 'lookup-1' : calls === 2 ? 'question-1' : `attempt-${calls - 2}`;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId, toolName, input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
    const storage = new InMemoryStore();
    const memory = new MockMemory({ storage });
    const agent = new Agent({
      id: 'step-bookkeeping',
      name: 'step-bookkeeping',
      instructions: 'Look up, confirm, then try three times.',
      model,
      memory,
      inputProcessors: [processor],
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Lookup',
          inputSchema: z.object({}),
          execute: async () => 'found',
        }),
        confirm: createTool({
          id: 'confirm',
          description: 'Confirm',
          inputSchema: z.object({}),
          suspendSchema: z.object({ question: z.string() }),
          resumeSchema: z.object({ approved: z.boolean() }),
          execute: async (_input, context) => {
            if (!context?.agent?.resumeData) return context?.agent?.suspend({ question: 'Continue?' });
            return 'confirmed';
          },
        }),
        attempt: createTool({
          id: 'attempt',
          description: 'Try',
          inputSchema: z.object({}),
          execute: async () => ({ ok: false }),
        }),
      },
    });
    const mastra = new Mastra({ agents: { agent }, storage, logger: false });
    const registered = mastra.getAgent('agent');
    const options = { maxSteps: 8, savePerStep, memory: { thread: 'bookkeeping-thread', resource: 'user' } };
    const first = await registered.stream('Start', options);
    for await (const _chunk of first.fullStream) {
      /* drain */
    }
    expect(calls).toBe(2);
    processorResults.length = 0;

    const resumedResults: string[][] = [];
    const resumed = await registered.resumeStream(
      { approved: true },
      {
        ...options,
        runId: first.runId,
        toolCallId: 'question-1',
        stopWhen: ({ steps }) => {
          resumedResults.push(steps.at(-1)?.toolResults.map(result => result.toolCallId) ?? []);
          return steps.filter(step => step.toolResults.some(result => result.toolName === 'attempt')).length === 3;
        },
      },
    );
    for await (const _chunk of resumed.fullStream) {
      /* drain */
    }

    expect(resumedResults).toEqual([['question-1'], ['attempt-1'], ['attempt-2'], ['attempt-3']]);
    expect(calls).toBe(5);
    expect(processorResults).toEqual([['question-1'], ['attempt-1'], ['attempt-2']]);
    const steps = await resumed.steps;
    expect(
      steps.flatMap(step => step.content.filter(part => part.type === 'tool-call').map(part => part.toolCallId)),
    ).toEqual(['lookup-1', 'question-1', 'attempt-1', 'attempt-2', 'attempt-3']);
  });

  it('keeps every tool result in a multi-call step after saving', async () => {
    let calls = 0;
    const model = new MockLanguageModelV2({
      doStream: async () => {
        calls++;
        return {
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'tool-call', toolCallId: 'lookup-a', toolName: 'lookup', input: '{}' },
            { type: 'tool-call', toolCallId: 'lookup-b', toolName: 'lookup', input: '{}' },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
        };
      },
    });
    const agent = new Agent({
      id: 'multi-call-save',
      name: 'multi-call-save',
      instructions: 'Look up twice.',
      model,
      memory: new MockMemory(),
      tools: {
        lookup: createTool({
          id: 'lookup',
          description: 'Lookup',
          inputSchema: z.object({}),
          execute: async () => 'found',
        }),
      },
    });
    const results: string[][] = [];
    const stream = await agent.stream('Start', {
      maxSteps: 2,
      savePerStep: true,
      memory: { thread: 'multi-call-thread', resource: 'user' },
      stopWhen: ({ steps }) => {
        const ids = steps.at(-1)?.toolResults.map(result => result.toolCallId) ?? [];
        results.push(ids);
        return ids.length === 2;
      },
    });
    for await (const _chunk of stream.fullStream) {
      /* drain */
    }
    expect(results).toEqual([['lookup-a', 'lookup-b']]);
    expect(calls).toBe(1);
    expect(
      (await stream.steps)[0]?.content.filter(part => part.type === 'tool-result').map(part => part.toolCallId),
    ).toEqual(['lookup-a', 'lookup-b']);
  });
});
