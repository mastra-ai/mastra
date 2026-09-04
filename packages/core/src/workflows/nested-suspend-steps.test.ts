import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

/**
 * Regression for #21229: one nested (sub-workflow) suspend must appear as a
 * single suspended leaf in getWorkflowRunById().steps, and suspend-scoped
 * fields must not linger after resume completes.
 */
describe('nested suspend steps — issue #21229', () => {
  const state = z.object({ round: z.number(), done: z.boolean() });

  const inner = createStep({
    id: 'inner-step',
    inputSchema: state,
    outputSchema: state,
    suspendSchema: z.object({ question: z.string() }),
    resumeSchema: z.object({ answer: z.string() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (resumeData) {
        return { round: inputData.round + 1, done: true };
      }
      if (inputData.round > 0) {
        return { round: inputData.round, done: true };
      }
      return await suspend({ question: 'pick one' });
    },
  });

  const nested = createWorkflow({
    id: 'inner-loop',
    inputSchema: state,
    outputSchema: state,
  })
    .then(inner)
    .commit();

  const after = createStep({
    id: 'after-step',
    inputSchema: state,
    outputSchema: state,
    execute: async ({ inputData }) => inputData,
  });

  const parent = createWorkflow({
    id: 'parent-wf',
    inputSchema: state,
    outputSchema: state,
  })
    .then(nested)
    .then(after)
    .commit();

  function suspendedStepIds(steps: Record<string, { status?: string } | undefined> | undefined) {
    return Object.entries(steps ?? {})
      .filter(([key, value]) => key !== 'input' && value?.status === 'suspended')
      .map(([key]) => key);
  }

  it('reports exactly one suspended leaf for a nested sub-workflow suspend', async () => {
    const storage = new MockStore();
    new Mastra({
      logger: false,
      storage,
      workflows: { parent },
    });

    const run = await parent.createRun();
    const startResult = await run.start({ inputData: { round: 0, done: false } });
    expect(startResult.status).toBe('suspended');

    const suspended = await parent.getWorkflowRunById(run.runId);
    expect(Object.keys(suspended?.suspendedPaths ?? {})).toHaveLength(1);
    expect(suspendedStepIds(suspended?.steps)).toEqual(['inner-loop.inner-step']);
    expect(suspended?.steps?.['inner-loop']?.status).not.toBe('suspended');
    expect(suspended?.steps?.['inner-loop']).toBeDefined();
    expect(suspended?.steps?.['inner-loop.inner-step']?.status).toBe('suspended');
  });

  it('clears suspension fields after resume completes successfully', async () => {
    const storage = new MockStore();
    new Mastra({
      logger: false,
      storage,
      workflows: { parent },
    });

    const run = await parent.createRun();
    await run.start({ inputData: { round: 0, done: false } });

    const rootStep = Object.keys((await parent.getWorkflowRunById(run.runId))?.suspendedPaths ?? {})[0];
    expect(rootStep).toBeDefined();

    const resumeResult = await run.resume({
      step: [rootStep!, 'inner-step'],
      resumeData: { answer: 'a' },
    });
    expect(resumeResult.status).toBe('success');

    const completed = await parent.getWorkflowRunById(run.runId);
    expect(suspendedStepIds(completed?.steps)).toEqual([]);

    for (const [key, step] of Object.entries(completed?.steps ?? {})) {
      if (key === 'input' || !step || typeof step !== 'object') continue;
      expect(step, key).not.toHaveProperty('suspendPayload');
      expect(step, key).not.toHaveProperty('suspendOutput');
      expect(step, key).not.toHaveProperty('suspendedAt');
    }
  });
});
