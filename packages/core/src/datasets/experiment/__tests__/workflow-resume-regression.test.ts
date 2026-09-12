import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../../../mastra';
import { MockStore } from '../../../storage/mock';
import { createStep, createWorkflow } from '../../../workflows';
import type { AnyWorkflow } from '../../../workflows';
import { executeTarget } from '../executor';

function makeBranch(id: string) {
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

/** Two independent branches that both suspend on start. */
function makeParallelWorkflow(id: string) {
  const branchA = makeBranch('branch-a');
  const branchB = makeBranch('branch-b');
  const workflow = createWorkflow({ id, inputSchema: z.object({}), outputSchema: z.any() })
    .parallel([branchA, branchB])
    .commit();
  new Mastra({ logger: false, storage: new MockStore(), workflows: { [id]: workflow } });
  return workflow;
}

interface ResumeItem {
  resumeSteps?: Record<string, unknown>;
  resumeData?: unknown;
  metadata?: Record<string, unknown>;
}

function runWorkflow(workflow: AnyWorkflow, item: ResumeItem) {
  return executeTarget(workflow, 'workflow', { input: {}, ...item });
}

function stepOutput(result: Awaited<ReturnType<typeof executeTarget>>, stepId: string): unknown {
  const step = result.stepResults?.[stepId];
  if (step?.status !== 'success') {
    throw new Error(`Expected step "${stepId}" to succeed, got "${step?.status}"`);
  }
  return step.output;
}

describe('workflow experiment branch resume', () => {
  it('resumes both parallel branches when every branch has data', async () => {
    const workflow = makeParallelWorkflow('multi-branch-control');

    const result = await runWorkflow(workflow, {
      resumeSteps: { 'branch-a': { value: 'a' }, 'branch-b': { value: 'b' } },
    });

    expect(result.error).toBeNull();
    expect(result.output).toEqual({
      'branch-a': { from: 'branch-a:a' },
      'branch-b': { from: 'branch-b:b' },
    });
    expect(stepOutput(result, 'branch-a')).toEqual({ from: 'branch-a:a' });
    expect(stepOutput(result, 'branch-b')).toEqual({ from: 'branch-b:b' });
  });

  it('resumes a later suspended branch when an earlier branch has no data', async () => {
    const workflow = makeParallelWorkflow('multi-branch-partial');

    const result = await runWorkflow(workflow, {
      resumeSteps: { 'branch-b': { value: 'b' } },
    });

    expect(stepOutput(result, 'branch-b')).toEqual({ from: 'branch-b:b' });
    expect(result.stepResults?.['branch-a']?.status).toBe('suspended');
    expect(result.error).not.toBeNull();
    expect(result.error?.message.toLowerCase()).toContain('suspend');
  });

  it('resumes a later top-level branch when an earlier nested branch has no data', async () => {
    const inner = makeBranch('inner');
    const nested = createWorkflow({
      id: 'nested-branch',
      inputSchema: z.object({}),
      outputSchema: z.object({ from: z.string() }),
    })
      .then(inner)
      .commit();
    const branchB = makeBranch('branch-b');
    const workflow = createWorkflow({
      id: 'multi-branch-nested-first',
      inputSchema: z.object({}),
      outputSchema: z.any(),
    })
      .parallel([nested, branchB])
      .commit();
    new Mastra({
      logger: false,
      storage: new MockStore(),
      workflows: { 'multi-branch-nested-first': workflow, 'nested-branch': nested },
    });

    const result = await runWorkflow(workflow, { resumeSteps: { 'branch-b': { value: 'b' } } });

    expect(stepOutput(result, 'branch-b')).toEqual({ from: 'branch-b:b' });
    expect(result.error).not.toBeNull();
    expect(result.error?.message.toLowerCase()).toContain('suspend');
  });

  it('stays suspended when no resume data matches any suspended branch', async () => {
    const workflow = makeParallelWorkflow('multi-branch-no-match');

    const result = await runWorkflow(workflow, {
      resumeSteps: { 'other-step': { value: 'x' } },
    });

    expect(result.stepResults?.['branch-a']?.status).toBe('suspended');
    expect(result.stepResults?.['branch-b']?.status).toBe('suspended');
    expect(result.error).not.toBeNull();
    expect(result.error?.message.toLowerCase()).toContain('suspend');
  });

  it('selects a later branch from metadata.resumeSteps', async () => {
    const workflow = makeParallelWorkflow('multi-branch-metadata');

    const result = await runWorkflow(workflow, {
      metadata: { resumeSteps: { 'branch-b': { value: 'b' } } },
    });

    expect(stepOutput(result, 'branch-b')).toEqual({ from: 'branch-b:b' });
    expect(result.stepResults?.['branch-a']?.status).toBe('suspended');
  });

  it('forwards a falsy defined per-step payload to a later branch', async () => {
    const branchA = makeBranch('branch-a');
    const branchB = createStep({
      id: 'branch-b',
      inputSchema: z.object({}),
      outputSchema: z.object({ from: z.string() }),
      suspendSchema: z.object({ need: z.string() }),
      resumeSchema: z.boolean(),
      execute: async ({ resumeData, suspend }) => {
        if (resumeData === undefined) {
          await suspend({ need: 'branch-b' });
          return { from: 'branch-b:pending' };
        }
        return { from: `branch-b:${resumeData}` };
      },
    });
    const workflow = createWorkflow({
      id: 'multi-branch-falsy',
      inputSchema: z.object({}),
      outputSchema: z.any(),
    })
      .parallel([branchA, branchB])
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'multi-branch-falsy': workflow } });

    const result = await runWorkflow(workflow, { resumeSteps: { 'branch-b': false } });

    expect(stepOutput(result, 'branch-b')).toEqual({ from: 'branch-b:false' });
  });

  it('stops at MAX_RESUME_CYCLES when a matching later branch keeps suspending', async () => {
    let attempts = 0;
    const branchA = makeBranch('branch-a');
    const branchB = createStep({
      id: 'branch-b',
      inputSchema: z.object({}),
      outputSchema: z.object({ from: z.string() }),
      suspendSchema: z.object({ need: z.string() }),
      resumeSchema: z.object({ value: z.string() }),
      execute: async ({ suspend }) => {
        attempts++;
        await suspend({ need: 'branch-b' });
        return { from: 'branch-b' };
      },
    });
    const workflow = createWorkflow({
      id: 'multi-branch-cycle-cap',
      inputSchema: z.object({}),
      outputSchema: z.any(),
    })
      .parallel([branchA, branchB])
      .commit();
    new Mastra({ logger: false, storage: new MockStore(), workflows: { 'multi-branch-cycle-cap': workflow } });

    const result = await runWorkflow(workflow, { resumeSteps: { 'branch-b': { value: 'b' } } });

    // One initial execute plus MAX_RESUME_CYCLES (10) resumed executes, then the cap stops the loop.
    expect(attempts).toBe(11);
    expect(result.error).not.toBeNull();
    expect(result.error?.message.toLowerCase()).toContain('suspend');
  });
});
