import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

const SUSPENDED_STEP_USAGE = { inputTokens: 100, outputTokens: 20, totalTokens: 120 };
const RESUMED_STEP_USAGE = { inputTokens: 50, outputTokens: 10, totalTokens: 60 };

function createModel(toolName: string) {
  let calls = 0;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      calls++;
      return calls === 1
        ? {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            finishReason: 'tool-calls',
            usage: SUSPENDED_STEP_USAGE,
            content: [{ type: 'tool-call', toolCallId: 'call-1', toolName, input: '{}' }],
          }
        : {
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
            finishReason: 'stop',
            usage: RESUMED_STEP_USAGE,
            content: [{ type: 'text', text: 'done' }],
          };
    },
    doStream: async () => {
      calls++;
      const parts: any[] =
        calls === 1
          ? [
              { type: 'tool-call', toolCallId: 'call-1', toolName, input: '{}', providerExecuted: false },
              { type: 'finish', finishReason: 'tool-calls', usage: SUSPENDED_STEP_USAGE },
            ]
          : [
              { type: 'text-start', id: 't' },
              { type: 'text-delta', id: 't', delta: 'done' },
              { type: 'text-end', id: 't' },
              { type: 'finish', finishReason: 'stop', usage: RESUMED_STEP_USAGE },
            ];
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream([{ type: 'stream-start', warnings: [] }, ...parts]),
      };
    },
  });
}

const askTool = createTool({
  id: 'ask',
  description: 'Ask a person',
  inputSchema: z.object({}),
  resumeSchema: z.object({ answer: z.string() }),
  execute: async (_input, { agent }) => {
    if (!agent?.resumeData) return agent!.suspend({ question: 'which one?' });
    return { answer: (agent.resumeData as { answer: string }).answer };
  },
});

const approvalTool = createTool({
  id: 'approve',
  description: 'Needs approval',
  inputSchema: z.object({}),
  requireApproval: true,
  execute: async () => ({ ok: true }),
});

function setup(kind: 'suspend' | 'approval') {
  const toolName = kind === 'suspend' ? 'ask' : 'approve';
  const agent = new Agent({
    id: 'usage-agent',
    name: 'usage-agent',
    instructions: 'use the tool',
    model: createModel(toolName),
    tools: kind === 'suspend' ? { ask: askTool } : { approve: approvalTool },
  });
  new Mastra({ agents: { 'usage-agent': agent }, storage: new InMemoryStore(), logger: false });
  return agent;
}

function pickTokens(usage: any) {
  return { inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens, totalTokens: usage?.totalTokens };
}

describe('token usage when a tool call suspends', () => {
  for (const kind of ['suspend', 'approval'] as const) {
    describe(kind, () => {
      it('stream() reports the suspended step usage', async () => {
        const agent = setup(kind);
        const stream = await agent.stream('go');
        const output = await stream.getFullOutput();

        expect(output.finishReason).toBe('suspended');
        expect(pickTokens(await stream.usage)).toEqual(SUSPENDED_STEP_USAGE);
        expect(pickTokens(await stream.totalUsage)).toEqual(SUSPENDED_STEP_USAGE);
        expect(pickTokens(output.totalUsage)).toEqual(SUSPENDED_STEP_USAGE);
      });

      it('generate() reports the suspended step usage', async () => {
        const agent = setup(kind);
        const result = await agent.generate('go');

        expect(result.finishReason).toBe('suspended');
        expect(pickTokens(result.usage)).toEqual(SUSPENDED_STEP_USAGE);
        expect(pickTokens(result.totalUsage)).toEqual(SUSPENDED_STEP_USAGE);
      });

      it('does not count the suspended step again after resume', async () => {
        const agent = setup(kind);
        const first = await agent.stream('go');
        const firstOutput = await first.getFullOutput();
        expect(firstOutput.finishReason).toBe('suspended');

        const resumed =
          kind === 'suspend'
            ? await agent.resumeStream({ answer: 'blue' }, { runId: first.runId })
            : await agent.approveToolCall({ runId: first.runId, toolCallId: 'call-1' });
        const resumedOutput = await resumed.getFullOutput();

        expect(resumedOutput.text).toBe('done');
        expect(pickTokens(resumedOutput.totalUsage)).toEqual(RESUMED_STEP_USAGE);
        expect(pickTokens(await resumed.totalUsage)).toEqual(RESUMED_STEP_USAGE);

        const sum = {
          inputTokens: firstOutput.totalUsage.inputTokens! + resumedOutput.totalUsage.inputTokens!,
          outputTokens: firstOutput.totalUsage.outputTokens! + resumedOutput.totalUsage.outputTokens!,
          totalTokens: firstOutput.totalUsage.totalTokens! + resumedOutput.totalUsage.totalTokens!,
        };
        expect(sum).toEqual({ inputTokens: 150, outputTokens: 30, totalTokens: 180 });
      });
    });
  }
});
