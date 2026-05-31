import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { Inngest } from 'inngest';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import type { InngestRun } from './run';
import { init } from './index';

/**
 * Focused unit tests for InngestRun.resumeAsync().
 *
 * These tests do NOT require a live Inngest dev server. They mock `inngest.send()`
 * and assert the core invariant from issue #17156: `resumeAsync()` dispatches the
 * resume event and returns immediately with `{ runId }`, WITHOUT polling via
 * `getRunOutput()`.
 */
describe('InngestRun.resumeAsync()', () => {
  let inngest: Inngest;
  let sendMock: ReturnType<typeof vi.fn>;

  function buildWorkflow() {
    const { createWorkflow, createStep } = init(inngest);

    const step1 = createStep({
      id: 'step1',
      inputSchema: z.object({ value: z.string() }),
      resumeSchema: z.object({ resumed: z.string() }),
      suspendSchema: z.object({}),
      outputSchema: z.object({ result: z.string() }),
      execute: async ({ inputData, resumeData, suspend }) => {
        if (!resumeData) {
          return suspend({});
        }
        return { result: `${inputData.value}:${resumeData.resumed}` };
      },
    });

    const workflow = createWorkflow({
      id: 'resume-async-wf',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ result: z.string() }),
      steps: [step1],
    });
    workflow.then(step1).commit();

    return { workflow, step1 };
  }

  async function createSuspendedRun() {
    const { workflow, step1 } = buildWorkflow();

    const mastra = new Mastra({
      storage: new MockStore(),

      workflows: { 'resume-async-wf': workflow as any },
    });

    const run = (await workflow.createRun()) as unknown as InngestRun;

    // Seed a suspended snapshot directly so we don't need to run the workflow.
    const storage = mastra.getStorage()!;
    const workflowsStore = await storage.getStore('workflows');
    await workflowsStore!.persistWorkflowSnapshot({
      workflowName: 'resume-async-wf',
      runId: run.runId,
      snapshot: {
        runId: run.runId,
        serializedStepGraph: run.serializedStepGraph,
        status: 'suspended',
        value: {},

        context: { input: { value: 'hello' } } as any,
        activePaths: [],
        suspendedPaths: { step1: [0] },
        activeStepsPath: {},
        resumeLabels: {},
        waitingPaths: {},
        timestamp: Date.now(),
      },
    });

    return { run, step1, mastra, workflowsStore: workflowsStore! };
  }

  beforeEach(() => {
    sendMock = vi.fn().mockResolvedValue({ ids: ['evt_123'] });
    inngest = new Inngest({ id: 'mastra-test', baseUrl: 'http://localhost:9999' });
    // Replace the real transport with our mock.

    (inngest as any).send = sendMock;
  });

  it('returns { runId } immediately and does NOT poll getRunOutput', async () => {
    const { run } = await createSuspendedRun();

    const getRunOutputSpy = vi.spyOn(run, 'getRunOutput');

    const result = await run.resumeAsync({ step: 'step1', resumeData: { resumed: 'world' } });

    expect(result).toEqual({ runId: run.runId });
    expect(getRunOutputSpy).not.toHaveBeenCalled();
  });

  it('dispatches the resume event with the correct payload', async () => {
    const { run } = await createSuspendedRun();

    await run.resumeAsync({ step: 'step1', resumeData: { resumed: 'world' } });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const sentEvent = sendMock.mock.calls[0][0];
    expect(sentEvent.name).toBe('workflow.resume-async-wf');
    expect(sentEvent.data.runId).toBe(run.runId);
    expect(sentEvent.data.resume.steps).toEqual(['step1']);
    expect(sentEvent.data.resume.resumePayload).toEqual({ resumed: 'world' });
  });

  it('updates the snapshot to running before sending the event', async () => {
    const { run, workflowsStore } = await createSuspendedRun();

    let statusAtSendTime: string | undefined;
    sendMock.mockImplementation(async () => {
      const snap = await workflowsStore.loadWorkflowSnapshot({
        workflowName: 'resume-async-wf',
        runId: run.runId,
      });
      statusAtSendTime = snap?.status;
      return { ids: ['evt_123'] };
    });

    await run.resumeAsync({ step: 'step1', resumeData: { resumed: 'world' } });

    expect(statusAtSendTime).toBe('running');
  });

  it('rolls back the snapshot to suspended when event send fails', async () => {
    const { run, workflowsStore } = await createSuspendedRun();

    sendMock.mockRejectedValueOnce(new Error('inngest send failed'));

    await expect(run.resumeAsync({ step: 'step1', resumeData: { resumed: 'world' } })).rejects.toThrow(
      'inngest send failed',
    );

    const snap = await workflowsStore.loadWorkflowSnapshot({
      workflowName: 'resume-async-wf',
      runId: run.runId,
    });
    expect(snap?.status).toBe('suspended');
  });
});
