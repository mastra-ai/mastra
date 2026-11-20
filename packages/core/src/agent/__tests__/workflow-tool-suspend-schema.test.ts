import { MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { resolveToolCallConcurrency } from '../../loop/workflows/agentic-execution/tool-call-concurrency';
import { createTool } from '../../tools';
import { createStep, createWorkflow } from '../../workflows';
import { Agent } from '../agent';
import { serializeToolsMetadata } from '../durable/utils/serialize-state';
import { resolveDurableToolCallConcurrency } from '../durable/workflows/shared/tool-call-concurrency';

// Regression coverage for #26539: workflow tools never advertised that they can
// suspend, so tool-call concurrency gates ran them in parallel.

const io = z.object({ value: z.string() });

const plainStep = (id: string) =>
  createStep({ id, inputSchema: io, outputSchema: io, execute: async ({ inputData }) => inputData });

const suspendingStep = (id: string, schemas: 'both' | 'resumeOnly' = 'both') =>
  createStep({
    id,
    inputSchema: io,
    outputSchema: io,
    ...(schemas === 'both' ? { suspendSchema: z.object({ question: z.string() }) } : {}),
    resumeSchema: z.object({ approved: z.boolean() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) return suspend({ question: 'Approve?' });
      return inputData;
    },
  });

const wf = (id: string) => createWorkflow({ id, inputSchema: io, outputSchema: io });

const workflows = {
  plain: () => wf('plain').then(plainStep('a')).commit(),
  direct: () => wf('direct').then(suspendingStep('s')).commit(),
  resumeOnly: () => wf('resume-only').then(suspendingStep('s', 'resumeOnly')).commit(),
  parallel: () =>
    wf('parallel')
      .parallel([plainStep('a'), suspendingStep('s')])
      .map(async ({ inputData }) => inputData.a)
      .commit(),
  branch: () =>
    wf('branch')
      .branch([
        [async () => false, plainStep('a')],
        [async () => true, suspendingStep('s')],
      ])
      .map(async () => ({ value: 'x' }))
      .commit(),
  loop: () =>
    wf('loop')
      .dowhile(suspendingStep('s'), async () => false)
      .commit(),
  foreach: () =>
    createWorkflow({ id: 'foreach', inputSchema: z.array(io), outputSchema: z.array(io) })
      .foreach(suspendingStep('s'))
      .commit(),
  nested: () =>
    wf('outer')
      .then(plainStep('a'))
      .then(wf('inner').then(suspendingStep('s')).commit())
      .commit(),
};

async function getWorkflowTools(wfs: Record<string, any>, tools: Record<string, any> = {}) {
  const agent = new Agent({
    id: 'wf-agent',
    name: 'wf-agent',
    instructions: 'Run workflows.',
    model: new MockLanguageModelV2(),
    tools,
    workflows: wfs,
  });
  return agent.getToolsForExecution({});
}

describe('workflow tool hasSuspendSchema (#26539)', () => {
  it('is false when no step can suspend', async () => {
    const tools = await getWorkflowTools({ plain: workflows.plain() });
    expect((tools['workflow-plain'] as any).hasSuspendSchema).toBe(false);
  });

  it.each(['direct', 'resumeOnly', 'parallel', 'branch', 'loop', 'foreach', 'nested'] as const)(
    'is true when a %s step can suspend',
    async name => {
      const tools = await getWorkflowTools({ [name]: workflows[name]() });
      expect((tools[`workflow-${name}`] as any).hasSuspendSchema).toBe(true);
    },
  );

  describe('concurrency gates', () => {
    const lookup = createTool({
      id: 'lookup',
      description: 'lookup',
      inputSchema: io,
      execute: async input => input,
    });

    it.each(['available', 'called'] as const)('serialize a suspending workflow tool (%s)', async strategy => {
      const tools = await getWorkflowTools({ approvalWorkflow: workflows.direct() }, { lookup });
      const calledToolNames = ['lookup', 'workflow-approvalWorkflow'];

      expect(
        resolveToolCallConcurrency({ tools: tools as any, configuredConcurrency: 10, strategy, calledToolNames }),
      ).toBe(1);
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 10, strategy } } as any,
          toolsMetadata: serializeToolsMetadata(tools as any),
          toolCalls: calledToolNames.map(toolName => ({ toolName })),
        }),
      ).toBe(1);
    });

    it.each(['available', 'called'] as const)('keep a non-suspending workflow tool parallel (%s)', async strategy => {
      const tools = await getWorkflowTools({ plainWorkflow: workflows.plain() }, { lookup });
      const calledToolNames = ['lookup', 'workflow-plainWorkflow'];

      expect(
        resolveToolCallConcurrency({ tools: tools as any, configuredConcurrency: 10, strategy, calledToolNames }),
      ).toBe(10);
      expect(
        resolveDurableToolCallConcurrency({
          options: { toolCallConcurrency: { limit: 10, strategy } } as any,
          toolsMetadata: serializeToolsMetadata(tools as any),
          toolCalls: calledToolNames.map(toolName => ({ toolName })),
        }),
      ).toBe(10);
    });
  });
});
