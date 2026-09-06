import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createStep } from './workflow';

describe('restart active step input', () => {
  it.each([
    { name: 'saved object', payload: { messages: ['retained'] }, saved: true },
    { name: 'explicit null', payload: null, saved: true },
    { name: 'explicit undefined', payload: undefined, saved: true },
    { name: 'missing payload', payload: 'previous output', saved: false },
  ])('uses $name without replaying completed steps', async ({ payload, saved }) => {
    const storage = new MockStore();
    const mastra = new Mastra({ logger: false, storage });
    const previous = vi.fn();
    const active = vi.fn(async ({ inputData }) => ({ received: inputData }));
    const following = vi.fn(async ({ inputData }) => inputData);
    const makeStep = (id: string, execute: typeof active) =>
      createStep({ id, inputSchema: z.any(), outputSchema: z.any(), execute });
    const workflow = createWorkflow({ id: 'restart-input', inputSchema: z.any(), outputSchema: z.any() })
      .then(makeStep('previous', previous))
      .then(makeStep('active', active))
      .then(makeStep('following', following))
      .commit();
    workflow.__registerMastra(mastra);
    const workflows = await storage.getStore('workflows');
    await workflows!.persistWorkflowSnapshot({
      workflowName: workflow.id,
      runId: 'disposable-restart',
      snapshot: {
        runId: 'disposable-restart',
        status: 'running',
        value: {},
        activePaths: [1],
        activeStepsPath: { active: [1] },
        context: {
          input: 'initial',
          previous: { status: 'success', output: 'previous output', startedAt: 1, endedAt: 2 },
          active: { status: 'running', startedAt: 3, ...(saved ? { payload } : {}) },
          following: { status: 'pending', payload: 'stale unrelated input' },
        },
        serializedStepGraph: (workflow as any).serializedStepGraph,
        suspendedPaths: {},
        waitingPaths: {},
        resumeLabels: {},
        timestamp: Date.now(),
      },
    });
    try {
      const run = await workflow.createRun({ runId: 'disposable-restart' });
      const result = await run.restart();
      expect(result.status).toBe('success');
      expect(active).toHaveBeenCalledOnce();
      expect(active.mock.calls[0]![0].inputData).toEqual(payload);
      expect(following.mock.calls[0]![0].inputData).toEqual({ received: payload });
      expect(previous).not.toHaveBeenCalled();
    } finally {
      await mastra.shutdown();
    }
  });
});
