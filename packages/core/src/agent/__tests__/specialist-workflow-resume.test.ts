import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';

import { Mastra } from '../../mastra';
import { MockMemory } from '../../memory/mock';
import { InMemoryStore } from '../../storage';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';

/**
 * Regression test for #15734: a workflow owned by a *specialist* agent restarted
 * from step 1 when the supervisor delegation was resumed, instead of continuing
 * from the suspended step.
 *
 * Reported root cause: the delegation tool minted a fresh sub-agent thread id on
 * every re-entry — including resume — so the suspended workflow metadata saved on
 * the original sub-agent thread was unreachable and the workflow got a new runId.
 *
 * The invariant under test is side-effect based rather than identity based: the
 * pre-suspension step must execute exactly once across the initial run and the
 * resume.
 */

const usage = { inputTokens: 1, outputTokens: 1, totalTokens: 2 };

function streamOf(chunks: unknown[], id: string) {
  return {
    rawCall: { rawPrompt: null, rawSettings: {} },
    warnings: [],
    stream: convertArrayToReadableStream([
      { type: 'stream-start', warnings: [] },
      { type: 'response-metadata', id, modelId: 'mock-model-id', timestamp: new Date(0) },
      ...chunks,
    ] as any),
  };
}

function buildIntakeWorkflow() {
  const executions = { gather: 0, finalize: 0 };

  const gather = createStep({
    id: 'gather',
    inputSchema: z.object({ item: z.string() }),
    outputSchema: z.object({ item: z.string() }),
    execute: async ({ inputData }) => {
      executions.gather++;
      return { item: inputData.item };
    },
  });

  const approval = createStep({
    id: 'approval',
    inputSchema: z.object({ item: z.string() }),
    outputSchema: z.object({ item: z.string(), approved: z.boolean() }),
    suspendSchema: z.object({ reason: z.string() }),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) {
        await suspend({ reason: `Needs approval: ${inputData.item}` });
        return { item: inputData.item, approved: false };
      }
      return { item: inputData.item, approved: resumeData.approved };
    },
  });

  const finalize = createStep({
    id: 'finalize',
    inputSchema: z.object({ item: z.string(), approved: z.boolean() }),
    outputSchema: z.object({ item: z.string(), approved: z.boolean() }),
    execute: async ({ inputData }) => {
      executions.finalize++;
      return inputData;
    },
  });

  const intakeWorkflow = createWorkflow({
    id: 'intake-workflow',
    inputSchema: z.object({ item: z.string() }),
    outputSchema: z.object({ item: z.string(), approved: z.boolean() }),
  })
    .then(gather)
    .then(approval)
    .then(finalize)
    .commit();

  return { intakeWorkflow, executions };
}

function buildSpecialist(
  intakeWorkflow: ReturnType<typeof buildIntakeWorkflow>['intakeWorkflow'],
  opts: { ownMemory?: boolean } = {},
) {
  const model = new MockLanguageModelV2({
    doStream: async ({ prompt }) => {
      const hasToolResult = JSON.stringify(prompt).includes('"type":"tool-result"');
      return streamOf(
        hasToolResult
          ? [
              { type: 'text-start', id: 's1' },
              { type: 'text-delta', id: 's1', delta: 'Intake complete.' },
              { type: 'text-end', id: 's1' },
              { type: 'finish', finishReason: 'stop', usage },
            ]
          : [
              {
                type: 'tool-call',
                toolCallId: 'spec-wf-1',
                toolName: 'workflow-intakeWorkflow',
                input: JSON.stringify({ inputData: { item: 'widget' } }),
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ],
        'spec-1',
      );
    },
  });

  return new Agent({
    id: 'specialist',
    name: 'Specialist',
    description: 'Runs the intake workflow.',
    instructions: 'Run the intake workflow for the requested item.',
    model,
    workflows: { intakeWorkflow },
    // The original repro gives the specialist its own memory, which flips
    // `injectSupervisorMemory` (agent.ts:5529) to false and takes a different
    // delegation-identity branch than a memory-less specialist.
    ...(opts.ownMemory ? { memory: new MockMemory() } : {}),
  });
}

function buildSupervisor(specialist: Agent) {
  let step = 0;
  const model = new MockLanguageModelV2({
    doStream: async () => {
      step += 1;
      return streamOf(
        step === 1
          ? [
              {
                type: 'tool-call',
                toolCallId: 'sup-tc-A',
                toolName: 'agent-specialist',
                input: JSON.stringify({ prompt: 'Run intake for widget.', maxSteps: 3 }),
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'text-start', id: 'sf' },
              { type: 'text-delta', id: 'sf', delta: 'Done.' },
              { type: 'text-end', id: 'sf' },
              { type: 'finish', finishReason: 'stop', usage },
            ],
        `sup-${step}`,
      );
    },
  });

  return new Agent({
    id: 'supervisor',
    name: 'Supervisor',
    instructions: 'Delegate intake to the specialist.',
    model,
    agents: { specialist },
    memory: new MockMemory(),
  });
}

async function collectChunks(stream: any): Promise<any[]> {
  const chunks: any[] = [];
  for await (const chunk of stream.fullStream) chunks.push(chunk);
  return chunks;
}

describe.each([
  ['specialist without own memory', false],
  ['specialist with own memory (as in the reported repro)', true],
])('specialist-owned workflow suspend/resume (#15734) — %s', (_label, ownMemory) => {
  it('resumes the suspended workflow instead of restarting it from step 1', async () => {
    const { intakeWorkflow, executions } = buildIntakeWorkflow();
    const specialist = buildSpecialist(intakeWorkflow, { ownMemory: ownMemory as boolean });
    const supervisor = buildSupervisor(specialist);
    const mastra = new Mastra({
      agents: { supervisor },
      workflows: { intakeWorkflow },
      storage: new InMemoryStore(),
      logger: false,
    });
    const sup = mastra.getAgent('supervisor');

    const stream = await sup.stream('Handle the widget intake.', {
      maxSteps: 6,
      memory: { resource: 'r1', thread: 'thread-1' },
    });
    const initialChunks = await collectChunks(stream);

    expect(executions.gather).toBe(1);
    expect(executions.finalize).toBe(0);

    const resumed = await sup.resumeStream({ approved: true }, { runId: stream.runId });
    const resumedChunks = await collectChunks(resumed);

    // The pre-suspension step must NOT run a second time.
    expect(executions.gather).toBe(1);
    expect(executions.finalize).toBe(1);

    const errors = [...initialChunks, ...resumedChunks].filter(c => c.type === 'error');
    expect(errors).toEqual([]);
  });
});
