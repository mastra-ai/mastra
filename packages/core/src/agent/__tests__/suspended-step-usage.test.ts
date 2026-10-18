import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import { convertArrayToReadableStream, MockLanguageModelV2 } from './mock-model';

type Usage = { inputTokens: number; outputTokens: number; totalTokens: number };

const PRIOR_STEP_USAGE = { inputTokens: 7, outputTokens: 3, totalTokens: 10 };
const SUSPENDED_STEP_USAGE = { inputTokens: 100, outputTokens: 20, totalTokens: 120 };
const RESUMED_STEP_USAGE = { inputTokens: 50, outputTokens: 10, totalTokens: 60 };

type ModelStep = { toolName?: string; usage: Usage };

function addUsage(...usages: Usage[]): Usage {
  return usages.reduce((acc, u) => ({
    inputTokens: acc.inputTokens + u.inputTokens,
    outputTokens: acc.outputTokens + u.outputTokens,
    totalTokens: acc.totalTokens + u.totalTokens,
  }));
}

// Each model call answers with the next step: a tool call when `toolName` is set, otherwise text.
function createModel(steps: ModelStep[]) {
  let calls = 0;
  const next = () => steps[Math.min(calls++, steps.length - 1)]!;
  return new MockLanguageModelV2({
    doGenerate: async () => {
      const step = next();
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        finishReason: step.toolName ? 'tool-calls' : 'stop',
        usage: step.usage,
        content: step.toolName
          ? [{ type: 'tool-call', toolCallId: `call-${calls}`, toolName: step.toolName, input: '{}' }]
          : [{ type: 'text', text: 'done' }],
      };
    },
    doStream: async () => {
      const step = next();
      const parts: any[] = step.toolName
        ? [
            {
              type: 'tool-call',
              toolCallId: `call-${calls}`,
              toolName: step.toolName,
              input: '{}',
              providerExecuted: false,
            },
            { type: 'finish', finishReason: 'tool-calls', usage: step.usage },
          ]
        : [
            { type: 'text-start', id: 't' },
            { type: 'text-delta', id: 't', delta: 'done' },
            { type: 'text-end', id: 't' },
            { type: 'finish', finishReason: 'stop', usage: step.usage },
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

const lookupTool = createTool({
  id: 'lookup',
  description: 'Plain tool',
  inputSchema: z.object({}),
  execute: async () => ({ found: true }),
});

function setup(kind: 'suspend' | 'approval', { withPriorStep = false } = {}) {
  const toolName = kind === 'suspend' ? 'ask' : 'approve';
  const steps: ModelStep[] = [
    ...(withPriorStep ? [{ toolName: 'lookup', usage: PRIOR_STEP_USAGE }] : []),
    { toolName, usage: SUSPENDED_STEP_USAGE },
    { usage: RESUMED_STEP_USAGE },
  ];
  const agent = new Agent({
    id: 'usage-agent',
    name: 'usage-agent',
    instructions: 'use the tool',
    model: createModel(steps),
    tools: { lookup: lookupTool, ...(kind === 'suspend' ? { ask: askTool } : { approve: approvalTool }) },
  });
  new Mastra({ agents: { 'usage-agent': agent }, storage: new InMemoryStore(), logger: false });
  return agent;
}

function pickTokens(usage: any) {
  return { inputTokens: usage?.inputTokens, outputTokens: usage?.outputTokens, totalTokens: usage?.totalTokens };
}

async function resume(agent: Agent, kind: 'suspend' | 'approval', runId: string, toolCallId: string) {
  return kind === 'suspend'
    ? agent.resumeStream({ answer: 'blue' }, { runId })
    : agent.approveToolCall({ runId, toolCallId });
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

      it('keeps the resumed total cumulative without counting the suspended step twice', async () => {
        const agent = setup(kind);
        const first = await agent.stream('go');
        const firstOutput = await first.getFullOutput();
        expect(firstOutput.finishReason).toBe('suspended');

        const resumed = await resume(agent, kind, first.runId, 'call-1');
        const resumedOutput = await resumed.getFullOutput();

        const cumulative = addUsage(SUSPENDED_STEP_USAGE, RESUMED_STEP_USAGE);
        expect(resumedOutput.text).toBe('done');
        expect(pickTokens(resumedOutput.totalUsage)).toEqual(cumulative);
        expect(pickTokens(await resumed.totalUsage)).toEqual(cumulative);
      });

      it('includes steps before the suspension in both suspended and resumed totals', async () => {
        const agent = setup(kind, { withPriorStep: true });
        const first = await agent.stream('go');
        const firstOutput = await first.getFullOutput();
        expect(firstOutput.finishReason).toBe('suspended');
        expect(pickTokens(firstOutput.totalUsage)).toEqual(addUsage(PRIOR_STEP_USAGE, SUSPENDED_STEP_USAGE));

        const resumed = await resume(agent, kind, first.runId, 'call-2');
        const resumedOutput = await resumed.getFullOutput();

        expect(resumedOutput.text).toBe('done');
        expect(pickTokens(resumedOutput.totalUsage)).toEqual(
          addUsage(PRIOR_STEP_USAGE, SUSPENDED_STEP_USAGE, RESUMED_STEP_USAGE),
        );
      });
    });
  }
});
