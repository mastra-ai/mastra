import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createStep, createWorkflow } from '../../../workflows';
import type { AnyWorkflow } from '../../../workflows';
import { executeTarget } from '../executor';

function makeSuspendingBranch(id: string) {
  return createStep({
    id,
    inputSchema: z.object({}),
    outputSchema: z.object({ from: z.string() }),
    suspendSchema: z.object({ need: z.string() }),
    resumeSchema: z.object({ value: z.string() }),
    execute: async ({ resumeData, suspend }) => {
      if (!resumeData) {
        await suspend({ need: id });
        return { from: id };
      }

      return { from: `${id}:${resumeData.value}` };
    },
  });
}

function registerWorkflow(id: string, workflow: AnyWorkflow, nested?: AnyWorkflow) {
  new Mastra({
    logger: false,
    storage: new MockStore(),
    workflows: nested ? { [id]: workflow, [nested.id]: nested } : { [id]: workflow },
  });
}

function runWorkflow(workflow: AnyWorkflow, resumeSteps: Record<string, unknown>) {
  return executeTarget(workflow, 'workflow', { input: {}, resumeSteps });
}

function successfulOutput(result: Awaited<ReturnType<typeof executeTarget>>, stepId: string): unknown {
  const step = result.stepResults?.[stepId];
  if (step?.status !== 'success') {
    throw new Error(`Expected step "${stepId}" to succeed, got "${step?.status}"`);
  }

  return step.output;
}

describe('workflow experiment branch resume', () => {
  it('resumes a later suspended branch when an earlier branch has no data', async () => {
    const id = 'multi-branch-partial';
    const workflow = createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.any() })
      .parallel([makeSuspendingBranch('branch-a'), makeSuspendingBranch('branch-b')])
      .commit();
    registerWorkflow(id, workflow);

    const result = await runWorkflow(workflow, { 'branch-b': { value: 'b' } });

    expect(successfulOutput(result, 'branch-b')).toEqual({ from: 'branch-b:b' });
    expect(result.stepResults?.['branch-a']?.status).toBe('suspended');
    expect(result.error?.message.toLowerCase()).toContain('suspend');
  });

  it('resumes a later top-level branch when an earlier nested branch has no data', async () => {
    const nested = createWorkflow({
      id: 'nested-branch',
      inputSchema: z.object({}),
      outputSchema: z.object({ from: z.string() }),
    })
      .then(makeSuspendingBranch('inner'))
      .commit();
    const id = 'multi-branch-nested-first';
    const workflow = createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.any() })
      .parallel([nested, makeSuspendingBranch('branch-b')])
      .commit();
    registerWorkflow(id, workflow, nested);

    const result = await runWorkflow(workflow, { 'branch-b': { value: 'b' } });

    expect(successfulOutput(result, 'branch-b')).toEqual({ from: 'branch-b:b' });
    expect(result.stepResults?.['nested-branch']?.status).toBe('suspended');
    expect(result.error?.message.toLowerCase()).toContain('suspend');
  });

  it('resumes an inner suspension using the outer nested workflow id', async () => {
    const nested = createWorkflow({
      id: 'nested-resume-branch',
      inputSchema: z.object({}),
      outputSchema: z.object({ from: z.string() }),
    })
      .then(makeSuspendingBranch('inner'))
      .commit();
    const id = 'multi-branch-nested-resume';
    const workflow = createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.any() })
      .parallel([nested, makeSuspendingBranch('branch-b')])
      .commit();
    registerWorkflow(id, workflow, nested);

    const result = await runWorkflow(workflow, { 'nested-resume-branch': { value: 'inner' } });

    expect(successfulOutput(result, 'nested-resume-branch')).toEqual({ from: 'inner:inner' });
    expect(result.stepResults?.['branch-b']?.status).toBe('suspended');
    expect(result.error?.message.toLowerCase()).toContain('suspend');
  });
});
