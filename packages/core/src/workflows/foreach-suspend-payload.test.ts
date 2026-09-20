import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createEventedWorkflow, createWorkflow } from './create';
import { isEventedForeachSuspensionResult } from './evented/foreach-suspension';
import { createStep } from './workflow';

/**
 * Regression test for parallel-foreach `suspendPayload` being wiped between
 * resumes.
 *
 * The default-engine `foreach` loop persists each iteration's result into
 * `__workflow_meta.foreachOutput` so that, on resume, completed/suspended
 * iterations can be reconstructed without re-running. Previously every entry's
 * `suspendPayload` was forced to `{}` regardless of status, which threw away
 * resume state for iterations that were still suspended. That caused
 * downstream consumers — most notably the agent loop, which stores its
 * `__streamState` (message list, etc.) in `suspendPayload` while waiting for
 * tool-call approval — to lose conversation context as soon as a sibling
 * iteration in the same foreach was resumed.
 *
 * The fix preserves `suspendPayload` for suspended results and continues to
 * wipe it for success/failed results.
 */
describe('foreach: suspendPayload preservation across resumes', () => {
  const makeWorkflow = () => {
    const approvalStep = createStep({
      id: 'approval-step',
      inputSchema: z.object({ name: z.string() }),
      outputSchema: z.object({ name: z.string(), approved: z.boolean() }),
      suspendSchema: z.object({
        // Mirrors the kind of payload the agent loop stores while waiting for
        // approval: arbitrary per-iteration state that must round-trip through
        // the snapshot.
        streamState: z.object({ name: z.string(), token: z.string() }),
      }),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          await suspend({
            streamState: { name: inputData.name, token: `tok-${inputData.name}` },
          });
          // suspend() throws/short-circuits; the return below is unreachable
          // but satisfies the type checker.
          return { name: inputData.name, approved: false };
        }
        return { name: inputData.name, approved: resumeData.approved };
      },
    });

    const workflow = createWorkflow({
      id: 'foreach-suspend-payload-workflow',
      inputSchema: z.array(z.object({ name: z.string() })),
      outputSchema: z.array(z.object({ name: z.string(), approved: z.boolean() })),
      steps: [approvalStep],
      options: { validateInputs: false },
    })
      .foreach(approvalStep, { concurrency: 3 })
      .commit();

    return { workflow, approvalStep };
  };

  const readForeachOutput = async (storage: MockStore, runId: string) => {
    const store = await storage.getStore('workflows');
    const snapshot = await store?.loadWorkflowSnapshot({
      workflowName: 'foreach-suspend-payload-workflow',
      runId,
    });
    const stepCtx = snapshot?.context?.['approval-step'] as
      | { suspendPayload?: { __workflow_meta?: { foreachOutput?: any[] } } }
      | undefined;
    return {
      snapshot,
      foreachOutput: stepCtx?.suspendPayload?.__workflow_meta?.foreachOutput ?? [],
    };
  };

  it('preserves per-iteration suspendPayload after the initial parallel suspension', async () => {
    const storage = new MockStore();
    const { workflow } = makeWorkflow();
    new Mastra({ logger: false, storage, workflows: { 'foreach-suspend-payload-workflow': workflow } });

    const run = await workflow.createRun();
    const result = await run.start({
      inputData: [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }],
    });

    expect(result.status).toBe('suspended');

    const { foreachOutput } = await readForeachOutput(storage, run.runId);
    expect(foreachOutput).toHaveLength(3);
    for (const [idx, name] of ['alpha', 'beta', 'gamma'].entries()) {
      expect(foreachOutput[idx]?.status).toBe('suspended');
      expect(foreachOutput[idx]?.suspendPayload?.streamState).toEqual({
        name,
        token: `tok-${name}`,
      });
    }
  });

  it("keeps unresumed siblings' suspendPayload intact after a sibling iteration is resumed", async () => {
    const storage = new MockStore();
    const { workflow } = makeWorkflow();
    new Mastra({ logger: false, storage, workflows: { 'foreach-suspend-payload-workflow': workflow } });

    const run = await workflow.createRun();
    const start = await run.start({
      inputData: [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }],
    });
    expect(start.status).toBe('suspended');

    // Resume only iteration 0. The other two iterations must remain suspended
    // AND retain their original suspendPayload so the next resume can rebuild
    // their per-iteration state.
    const afterFirstResume = await run.resume({
      forEachIndex: 0,
      resumeData: { approved: true },
    });
    expect(afterFirstResume.status).toBe('suspended');

    const { foreachOutput } = await readForeachOutput(storage, run.runId);

    // Iteration 0 is now success — suspendPayload may legitimately be cleared.
    expect(foreachOutput[0]?.status).toBe('success');

    // Iterations 1 and 2 are still suspended — their original suspendPayload
    // (including the `streamState` we stored) MUST survive.
    expect(foreachOutput[1]?.status).toBe('suspended');
    expect(foreachOutput[1]?.suspendPayload?.streamState).toEqual({
      name: 'beta',
      token: 'tok-beta',
    });

    expect(foreachOutput[2]?.status).toBe('suspended');
    expect(foreachOutput[2]?.suspendPayload?.streamState).toEqual({
      name: 'gamma',
      token: 'tok-gamma',
    });
  });

  it('completes the workflow when all suspended iterations are resumed sequentially', async () => {
    const storage = new MockStore();
    const { workflow } = makeWorkflow();
    new Mastra({ logger: false, storage, workflows: { 'foreach-suspend-payload-workflow': workflow } });

    const run = await workflow.createRun();
    expect(
      (
        await run.start({
          inputData: [{ name: 'alpha' }, { name: 'beta' }, { name: 'gamma' }],
        })
      ).status,
    ).toBe('suspended');

    expect((await run.resume({ forEachIndex: 0, resumeData: { approved: true } })).status).toBe('suspended');
    expect((await run.resume({ forEachIndex: 1, resumeData: { approved: false } })).status).toBe('suspended');

    const final = await run.resume({ forEachIndex: 2, resumeData: { approved: true } });
    expect(final.status).toBe('success');
    if (final.status === 'success') {
      expect(final.steps['approval-step']).toMatchObject({
        status: 'success',
        output: [
          { name: 'alpha', approved: true },
          { name: 'beta', approved: false },
          { name: 'gamma', approved: true },
        ],
      });
    }
  });
});

describe('evented foreach: sparse suspension envelopes', () => {
  const workflowId = 'evented-foreach-sparse-suspension-workflow';
  const stepId = 'evented-approval-step';
  const inputSchema = z.object({ name: z.string(), requiresApproval: z.boolean() });
  const outputSchema = z.object({ name: z.string(), status: z.literal('suspended'), token: z.string() });

  const makeWorkflow = () => {
    const approvalStep = createStep({
      id: stepId,
      inputSchema,
      outputSchema,
      suspendSchema: z.object({ name: z.string(), token: z.string() }),
      resumeSchema: z.object({ token: z.string() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (inputData.requiresApproval && !resumeData) {
          return await suspend(
            { name: inputData.name, token: `pending-${inputData.name}` },
            { resumeLabel: `approve-${inputData.name}` },
          );
        }

        // This is deliberately valid user output, not an engine suspension.
        // The engine must distinguish it from StepResult by the durable envelope.
        return {
          name: inputData.name,
          status: 'suspended' as const,
          token: resumeData?.token ?? `raw-${inputData.name}`,
        };
      },
    });

    const workflow = createEventedWorkflow({
      id: workflowId,
      inputSchema: z.array(inputSchema),
      outputSchema: z.array(outputSchema),
      steps: [approvalStep],
      options: { validateInputs: false },
    })
      .foreach(approvalStep, { concurrency: 3 })
      .then(
        createStep({
          id: 'evented-downstream-step',
          inputSchema: z.array(outputSchema),
          outputSchema: z.array(outputSchema),
          execute: async ({ inputData }) => {
            const onCompleted = (globalThis as any).__mastraEventedForeachDownstreamEffect;
            if (typeof onCompleted === 'function') onCompleted();
            return inputData;
          },
        }),
      )
      .commit();

    return workflow;
  };

  const readSnapshot = async (storage: MockStore, runId: string) => {
    const store = await storage.getStore('workflows');
    const snapshot = await store?.loadWorkflowSnapshot({ workflowName: workflowId, runId });
    const stepContext = snapshot?.context?.[stepId] as
      | { suspendPayload?: { __workflow_meta?: { foreachOutput?: Record<string, any> } } }
      | undefined;
    return {
      snapshot,
      foreachOutput: stepContext?.suspendPayload?.__workflow_meta?.foreachOutput ?? {},
    };
  };

  it('keeps only genuine suspended iterations and completes with status-shaped user output', async () => {
    const storage = new MockStore();
    const workflow = makeWorkflow();
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflowId]: workflow },
    });

    await mastra.startWorkers();
    try {
      const run = await workflow.createRun({ runId: 'evented-foreach-sparse-suspension-run' });
      const started = await run.start({
        inputData: [
          { name: 'alpha', requiresApproval: false },
          { name: 'beta', requiresApproval: true },
          { name: 'gamma', requiresApproval: true },
        ],
      });
      expect(started.status).toBe('suspended');

      const initial = await readSnapshot(storage, run.runId);
      expect(
        Object.entries(initial.foreachOutput)
          .filter(([, result]) => isEventedForeachSuspensionResult(result))
          .map(([index]) => index),
      ).toEqual(['1', '2']);
      expect(initial.foreachOutput['0']).toEqual(
        expect.objectContaining({
          status: 'success',
          output: { name: 'alpha', status: 'suspended', token: 'raw-alpha' },
          suspendPayload: {},
        }),
      );
      expect(initial.foreachOutput['1']).toMatchObject({
        status: 'suspended',
        suspendPayload: { name: 'beta', token: 'pending-beta' },
      });
      expect(initial.foreachOutput['2']).toMatchObject({
        status: 'suspended',
        suspendPayload: { name: 'gamma', token: 'pending-gamma' },
      });
      expect(initial.snapshot?.resumeLabels).toMatchObject({
        'approve-beta': { stepId, foreachIndex: 1 },
        'approve-gamma': { stepId, foreachIndex: 2 },
      });

      const afterBeta = await run.resume({
        label: 'approve-beta',
        resumeData: { token: 'approved-beta' },
      });
      expect(afterBeta.status).toBe('suspended');

      const remaining = await readSnapshot(storage, run.runId);
      expect(
        Object.entries(remaining.foreachOutput)
          .filter(([, result]) => isEventedForeachSuspensionResult(result))
          .map(([index]) => index),
      ).toEqual(['2']);
      expect(remaining.foreachOutput['0']).toEqual(
        expect.objectContaining({
          status: 'success',
          output: { name: 'alpha', status: 'suspended', token: 'raw-alpha' },
          suspendPayload: {},
        }),
      );
      expect(remaining.foreachOutput['1']).toEqual(
        expect.objectContaining({
          status: 'success',
          output: { name: 'beta', status: 'suspended', token: 'approved-beta' },
          suspendPayload: {},
        }),
      );
      expect(remaining.foreachOutput['2']).toMatchObject({
        status: 'suspended',
        suspendPayload: { name: 'gamma', token: 'pending-gamma' },
      });
      expect(remaining.snapshot?.resumeLabels).not.toHaveProperty('approve-beta');
      expect(remaining.snapshot?.resumeLabels).toMatchObject({
        'approve-gamma': { stepId, foreachIndex: 2 },
      });

      const completed = await run.resume({
        label: 'approve-gamma',
        resumeData: { token: 'approved-gamma' },
      });
      expect(completed).toMatchObject({
        status: 'success',
        result: [
          { name: 'alpha', status: 'suspended', token: 'raw-alpha' },
          { name: 'beta', status: 'suspended', token: 'approved-beta' },
          { name: 'gamma', status: 'suspended', token: 'approved-gamma' },
        ],
      });
    } finally {
      await mastra.stopWorkers();
    }
  });

  it('fails closed when a persisted foreach suspension has an invalid engine path', async () => {
    const storage = new MockStore();
    const downstreamEffect = vi.fn();
    (globalThis as any).__mastraEventedForeachDownstreamEffect = downstreamEffect;
    const workflow = makeWorkflow();
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflowId]: workflow },
    });

    await mastra.startWorkers();
    try {
      const run = await workflow.createRun({ runId: 'evented-foreach-corrupt-envelope-run' });
      const started = await run.start({
        inputData: [
          { name: 'alpha', requiresApproval: false },
          { name: 'beta', requiresApproval: true },
          { name: 'gamma', requiresApproval: true },
        ],
      });
      expect(started.status).toBe('suspended');
      expect(downstreamEffect).not.toHaveBeenCalled();

      const store = await storage.getStore('workflows');
      const snapshot = await store?.loadWorkflowSnapshot({ workflowName: workflowId, runId: run.runId });
      expect(snapshot).not.toBeNull();

      const aggregate = snapshot?.context?.[stepId] as any;
      expect(aggregate?.output?.[1]?.suspendPayload?.__workflow_meta?.path).toEqual([stepId]);
      aggregate.output[1].suspendPayload.__workflow_meta.path = [];
      aggregate.suspendPayload.__workflow_meta.foreachOutput['1'].suspendPayload.__workflow_meta.path = [];
      await store?.persistWorkflowSnapshot({
        workflowName: workflowId,
        runId: run.runId,
        snapshot: snapshot!,
      });

      const failed = await run.resume({
        step: stepId,
        forEachIndex: 1,
        resumeData: { token: 'approved-beta' },
      });
      expect(failed.status).toBe('failed');
      expect((failed as any).error?.message).toBe('Invalid evented foreach suspension state at index 1');
      expect(downstreamEffect).not.toHaveBeenCalled();
    } finally {
      await mastra.stopWorkers();
      delete (globalThis as any).__mastraEventedForeachDownstreamEffect;
    }
  });

  it('replaces a sibling re-suspension with its fresh payload and label until exact-once completion', async () => {
    const resuspendWorkflowId = 'evented-foreach-resuspend-freshness-workflow';
    const resuspendStepId = 'evented-resuspend-step';
    const completionEffect = vi.fn();
    const terminalEffect = vi.fn();
    (globalThis as any).__mastraEventedForeachCompletionEffect = completionEffect;
    (globalThis as any).__mastraEventedForeachTerminalEffect = terminalEffect;

    const itemSchema = z.object({ name: z.string() });
    const completedSchema = z.object({ name: z.string(), token: z.string() });
    const resuspendStep = createStep({
      id: resuspendStepId,
      inputSchema: itemSchema,
      outputSchema: completedSchema,
      suspendSchema: z.object({ name: z.string(), token: z.string() }),
      resumeSchema: z.object({ action: z.enum(['resuspend', 'complete']) }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          return await suspend(
            { name: inputData.name, token: `initial-${inputData.name}` },
            { resumeLabel: `approve-${inputData.name}` },
          );
        }
        if (resumeData.action === 'resuspend') {
          return await suspend(
            { name: inputData.name, token: `fresh-${inputData.name}` },
            { resumeLabel: `finalize-${inputData.name}` },
          );
        }

        const effect = (globalThis as any).__mastraEventedForeachCompletionEffect;
        if (typeof effect === 'function') effect(inputData.name);
        return { name: inputData.name, token: `completed-${inputData.name}` };
      },
    });
    const terminalStep = createStep({
      id: 'evented-resuspend-terminal-step',
      inputSchema: z.array(completedSchema),
      outputSchema: z.array(completedSchema),
      execute: async ({ inputData }) => {
        const effect = (globalThis as any).__mastraEventedForeachTerminalEffect;
        if (typeof effect === 'function') effect(inputData);
        return inputData;
      },
    });
    const workflow = createEventedWorkflow({
      id: resuspendWorkflowId,
      inputSchema: z.array(itemSchema),
      outputSchema: z.array(completedSchema),
      steps: [resuspendStep, terminalStep],
      options: { validateInputs: false },
    })
      .foreach(resuspendStep, { concurrency: 2 })
      .then(terminalStep)
      .commit();
    const storage = new MockStore();
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [resuspendWorkflowId]: workflow },
    });

    await mastra.startWorkers();
    try {
      const run = await workflow.createRun({ runId: 'evented-foreach-resuspend-freshness-run' });
      const started = await run.start({ inputData: [{ name: 'A' }, { name: 'B' }] });
      expect(started.status).toBe('suspended');

      const store = await storage.getStore('workflows');
      const loadSuspension = async () => {
        const snapshot = await store?.loadWorkflowSnapshot({ workflowName: resuspendWorkflowId, runId: run.runId });
        const stepContext = snapshot?.context?.[resuspendStepId] as any;
        return {
          snapshot,
          foreachOutput: (stepContext?.suspendPayload?.__workflow_meta?.foreachOutput ?? {}) as Record<string, any>,
        };
      };

      const initial = await loadSuspension();
      expect(Object.keys(initial.foreachOutput)).toEqual(['0', '1']);
      expect(initial.foreachOutput['0']?.suspendPayload).toMatchObject({ name: 'A', token: 'initial-A' });
      expect(initial.foreachOutput['1']?.suspendPayload).toMatchObject({ name: 'B', token: 'initial-B' });
      expect(initial.snapshot?.resumeLabels).toMatchObject({
        'approve-A': { stepId: resuspendStepId, foreachIndex: 0 },
        'approve-B': { stepId: resuspendStepId, foreachIndex: 1 },
      });

      const afterAResuspends = await run.resume({
        label: 'approve-A',
        resumeData: { action: 'resuspend' },
      });
      expect(afterAResuspends.status).toBe('suspended');

      const refreshed = await loadSuspension();
      expect(Object.keys(refreshed.foreachOutput)).toEqual(['0', '1']);
      expect(refreshed.foreachOutput['0']?.suspendPayload).toMatchObject({ name: 'A', token: 'fresh-A' });
      expect(refreshed.foreachOutput['1']?.suspendPayload).toMatchObject({ name: 'B', token: 'initial-B' });
      expect(refreshed.snapshot?.resumeLabels).not.toHaveProperty('approve-A');
      expect(refreshed.snapshot?.resumeLabels).toEqual({
        'finalize-A': { stepId: resuspendStepId, foreachIndex: 0 },
        'approve-B': { stepId: resuspendStepId, foreachIndex: 1 },
      });
      expect(completionEffect).not.toHaveBeenCalled();

      const afterB = await run.resume({ label: 'approve-B', resumeData: { action: 'complete' } });
      expect(afterB.status).toBe('suspended');
      expect(completionEffect.mock.calls).toEqual([['B']]);

      const onlyA = await loadSuspension();
      expect(
        Object.entries(onlyA.foreachOutput)
          .filter(([, result]) => isEventedForeachSuspensionResult(result))
          .map(([index]) => index),
      ).toEqual(['0']);
      expect(onlyA.foreachOutput['1']).toEqual(
        expect.objectContaining({
          status: 'success',
          output: { name: 'B', token: 'completed-B' },
          suspendPayload: {},
        }),
      );
      expect(onlyA.foreachOutput['0']?.suspendPayload).toMatchObject({ name: 'A', token: 'fresh-A' });
      expect(onlyA.snapshot?.resumeLabels).toEqual({
        'finalize-A': { stepId: resuspendStepId, foreachIndex: 0 },
      });

      const completed = await run.resume({ label: 'finalize-A', resumeData: { action: 'complete' } });
      expect(completed).toMatchObject({
        status: 'success',
        result: [
          { name: 'A', token: 'completed-A' },
          { name: 'B', token: 'completed-B' },
        ],
      });
      expect(completionEffect.mock.calls).toEqual([['B'], ['A']]);
      expect(terminalEffect).toHaveBeenCalledTimes(1);

      const terminalSnapshot = await store?.loadWorkflowSnapshot({
        workflowName: resuspendWorkflowId,
        runId: run.runId,
      });
      expect(terminalSnapshot).toMatchObject({
        status: 'success',
        resumeLabels: {},
        suspendedPaths: {},
        waitingPaths: {},
      });
      expect((terminalSnapshot?.context?.[resuspendStepId] as any)?.suspendPayload).toBeUndefined();
    } finally {
      await mastra.stopWorkers();
      delete (globalThis as any).__mastraEventedForeachCompletionEffect;
      delete (globalThis as any).__mastraEventedForeachTerminalEffect;
    }
  });
});
