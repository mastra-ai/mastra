import { ErrorCategory, ErrorDomain, MastraError } from '@mastra/core/error';
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

  /**
   * Persists a real snapshot (via the in-memory storage store) for the workflow and
   * returns the run plus the store so tests can reload and compare it. `snapshotOverrides`
   * lets a test seed a specific status/result/error without running the workflow.
   */
  async function createRunWithSnapshot(snapshotOverrides: Record<string, any> = {}) {
    const { workflow, step1 } = buildWorkflow();

    const mastra = new Mastra({
      storage: new MockStore(),

      workflows: { 'resume-async-wf': workflow as any },
    });

    const run = (await workflow.createRun()) as unknown as InngestRun;

    // Seed a snapshot directly so we don't need to run the workflow.
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
        ...snapshotOverrides,
      } as any,
    });

    return { run, step1, mastra, workflowsStore: workflowsStore! };
  }

  async function createSuspendedRun() {
    return createRunWithSnapshot({ status: 'suspended' });
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
    expect(sentEvent.data).not.toHaveProperty('initialState');
    expect(sentEvent.data).not.toHaveProperty('stepResults');
    expect(sentEvent.data.resume.steps).toEqual(['step1']);
    expect(sentEvent.data.resume).not.toHaveProperty('stepResults');
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

/**
 * Regression coverage for https://github.com/mastra-ai/mastra/issues/31595.
 *
 * Both public resume entry points share `_resumeAndSendEvent()`. A stored snapshot that is
 * NOT `suspended` must be rejected before any snapshot mutation or Inngest event dispatch,
 * otherwise a second resume overwrites a saved result/error and creates duplicate execution.
 * The expected rejection mirrors core's `WORKFLOW_RUN_NOT_SUSPENDED` guard.
 */
describe('InngestRun resume rejects non-suspended runs (#31595)', () => {
  let inngest: Inngest;
  let sendMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    sendMock = vi.fn().mockResolvedValue({ ids: ['evt_123'] });
    inngest = new Inngest({ id: 'mastra-test', baseUrl: 'http://localhost:9999' });

    (inngest as any).send = sendMock;
  });

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

  async function createRunWithSnapshot(snapshotOverrides: Record<string, any> = {}) {
    const { workflow, step1 } = buildWorkflow();

    const mastra = new Mastra({
      storage: new MockStore(),

      workflows: { 'resume-async-wf': workflow as any },
    });

    const run = (await workflow.createRun()) as unknown as InngestRun;

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
        ...snapshotOverrides,
      } as any,
    });

    return { run, step1, mastra, workflowsStore: workflowsStore! };
  }

  async function loadSnapshot(workflowsStore: any, runId: string) {
    return workflowsStore.loadWorkflowSnapshot({ workflowName: 'resume-async-wf', runId });
  }

  const nonSuspendedCases: Array<{ status: string; extra: Record<string, any> }> = [
    { status: 'success', extra: { result: { result: 'hello:world' } } },
    { status: 'failed', extra: { error: { name: 'Error', message: 'boom', stack: 'Error: boom' } } },
    { status: 'running', extra: {} },
  ];

  it.each(nonSuspendedCases)(
    'resumeAsync() rejects a $status snapshot before dispatch and leaves it untouched',
    async ({ status, extra }) => {
      const { run, workflowsStore } = await createRunWithSnapshot({ status, ...extra });

      const snapshotBefore = structuredClone(await loadSnapshot(workflowsStore, run.runId));

      // Sentinel: if the guard is missing, fail fast instead of entering getRunOutput() polling.
      sendMock.mockRejectedValue(new Error('unexpected send'));

      const rejection = await run.resumeAsync({ step: 'step1', resumeData: { resumed: 'world' } }).catch(e => e);

      expect(rejection).toBeInstanceOf(MastraError);
      expect(rejection).toMatchObject({
        id: 'WORKFLOW_RUN_NOT_SUSPENDED',
        domain: ErrorDomain.MASTRA_WORKFLOW,
        category: ErrorCategory.USER,
        details: { workflowId: 'resume-async-wf', runId: run.runId, status },
      });

      expect(sendMock).not.toHaveBeenCalled();

      const snapshotAfter = await loadSnapshot(workflowsStore, run.runId);
      expect(snapshotAfter).toEqual(snapshotBefore);
      expect(snapshotAfter).toMatchObject({ status, ...extra });
    },
  );

  it('resume() rejects a terminal success snapshot before dispatch and leaves it untouched', async () => {
    const { run, workflowsStore } = await createRunWithSnapshot({
      status: 'success',
      result: { result: 'hello:world' },
    });

    const snapshotBefore = structuredClone(await loadSnapshot(workflowsStore, run.runId));

    sendMock.mockRejectedValue(new Error('unexpected send'));

    const rejection = await run.resume({ step: 'step1', resumeData: { resumed: 'world' } }).catch(e => e);

    expect(rejection).toBeInstanceOf(MastraError);
    expect(rejection).toMatchObject({
      id: 'WORKFLOW_RUN_NOT_SUSPENDED',
      domain: ErrorDomain.MASTRA_WORKFLOW,
      category: ErrorCategory.USER,
      details: { workflowId: 'resume-async-wf', runId: run.runId, status: 'success' },
    });

    expect(sendMock).not.toHaveBeenCalled();

    const snapshotAfter = await loadSnapshot(workflowsStore, run.runId);
    expect(snapshotAfter).toEqual(snapshotBefore);
    expect(snapshotAfter).toMatchObject({ status: 'success', result: { result: 'hello:world' } });
  });
});
