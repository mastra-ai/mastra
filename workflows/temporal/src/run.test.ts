import { RequestContext } from '@mastra/core/di';
import { createStep } from '@mastra/core/workflows';
import type { Client } from '@temporalio/client';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createWorkflow } from './workflow';

describe('TemporalRun', () => {
  it('does not execute stream runs with the local workflow engine', async () => {
    const execute = vi.fn().mockResolvedValue({ value: 2 });
    const start = vi.fn();
    const schema = z.object({ value: z.number() });
    const step = createStep({
      id: 'increment',
      inputSchema: schema,
      outputSchema: schema,
      execute,
    });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    )
      .then(step)
      .commit();
    const run = await workflow.createRun({ runId: 'test-run' });

    expect(() => run.stream({ inputData: { value: 1 } })).toThrow(
      '@mastra/temporal does not support stream() yet. Use start() or startAsync() instead.',
    );
    expect(start).not.toHaveBeenCalled();
    expect(execute).not.toHaveBeenCalled();
  });

  it.each(['streamLegacy', 'resumeStream', 'restart', 'timeTravel', 'timeTravelStream'] as const)(
    'rejects unsupported %s calls instead of using the local workflow engine',
    async method => {
      const workflow = createWorkflow(
        { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
        { client: { workflow: {} } as unknown as Client, taskQueue: 'test-queue' },
      );
      const run = await workflow.createRun({ runId: 'test-run' });

      expect(() => (run[method] as (...args: unknown[]) => unknown)()).toThrow(
        `@mastra/temporal does not support ${method}() yet. Use start() or startAsync() instead.`,
      );
    },
  );

  it('signals the matching Temporal workflow when resuming and waits for the result', async () => {
    const result = {
      status: 'success',
      input: { value: 1 },
      result: { approved: true },
      state: {},
      steps: {},
    };
    const signal = vi.fn().mockResolvedValue(undefined);
    const handleResult = vi.fn().mockResolvedValue(result);
    const getHandle = vi.fn().mockReturnValue({ signal, result: handleResult });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.object({ value: z.number() }), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.resume({ step: 'approval', resumeData: { approved: true } })).resolves.toEqual(result);

    expect(getHandle).toHaveBeenCalledWith('test-run');
    expect(signal).toHaveBeenCalledWith('mastra.resume', { step: 'approval', resumeData: { approved: true } });
    expect(handleResult).toHaveBeenCalledOnce();
  });

  it('defaults keyless resume to the only suspended step before signaling', async () => {
    const suspended = {
      status: 'suspended',
      input: { value: 1 },
      state: {},
      steps: {},
      suspended: [['approval']],
    };
    const signal = vi.fn().mockResolvedValue(undefined);
    const handleResult = vi
      .fn()
      .mockResolvedValue({ status: 'success', input: { value: 1 }, result: {}, state: {}, steps: {} });
    const query = vi.fn().mockResolvedValue(suspended);
    const getHandle = vi.fn().mockReturnValue({ signal, result: handleResult, query });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.object({ value: z.number() }), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await run.resume({ resumeData: { approved: true } });

    expect(query).toHaveBeenCalledWith('mastra.status');
    expect(signal).toHaveBeenCalledWith('mastra.resume', { step: 'approval', resumeData: { approved: true } });
  });

  it('ignores the pre-signal suspension and returns a fresh suspension from resume', async () => {
    const suspended = (reason: string, suspendedAt: number) => ({
      status: 'suspended',
      input: { value: 1 },
      state: {},
      steps: {
        approval: {
          __temporalStepResult: true,
          status: 'suspended',
          payload: { value: 1 },
          suspendPayload: { reason },
          suspendedAt,
        },
      },
      suspended: [['approval']],
      suspendPayload: { approval: { reason } },
    });
    const signal = vi.fn().mockResolvedValue(undefined);
    const result = vi.fn(() => new Promise(() => {}));
    const query = vi
      .fn()
      .mockResolvedValueOnce(suspended('first review', 1))
      .mockResolvedValueOnce(suspended('first review', 1))
      .mockResolvedValue(suspended('second review', 2));
    const getHandle = vi.fn().mockReturnValue({ signal, result, query });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.object({ value: z.number() }), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.resume({ step: 'approval', resumeData: { approved: true } })).resolves.toMatchObject({
      status: 'suspended',
      suspended: [['approval']],
      suspendPayload: { approval: { reason: 'second review' } },
    });
    expect(query).toHaveBeenCalledTimes(3);
  });

  it('validates label-only resume data against the labeled step schema', async () => {
    const signal = vi.fn().mockResolvedValue(undefined);
    const query = vi.fn().mockResolvedValue({
      status: 'suspended',
      steps: {
        approval: {
          status: 'suspended',
          suspendedAt: 1,
        },
      },
      suspended: [['approval']],
      resumeLabels: { approveOrder: { stepId: 'approval' } },
    });
    const getHandle = vi.fn().mockReturnValue({ signal, query, result: vi.fn(() => new Promise(() => {})) });
    const approval = createStep({
      id: 'approval',
      inputSchema: z.unknown(),
      outputSchema: z.unknown(),
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ inputData }) => inputData,
    });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    )
      .then(approval)
      .commit();
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.resume({ label: 'approveOrder', resumeData: { approved: 'yes' } })).rejects.toThrow();
    expect(signal).not.toHaveBeenCalled();
  });

  it('rejects inactive explicit resume targets before signaling', async () => {
    const signal = vi.fn().mockResolvedValue(undefined);
    const query = vi.fn().mockResolvedValue({
      status: 'suspended',
      steps: { review: { status: 'suspended', suspendedAt: 1 } },
      suspended: [['review']],
    });
    const getHandle = vi.fn().mockReturnValue({ signal, query });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.resumeAsync({ step: 'approval', resumeData: { approved: true } })).rejects.toThrow(
      'Temporal workflow is not suspended at step "approval".',
    );
    expect(signal).not.toHaveBeenCalled();
  });

  it('throws when a started workflow status cannot be observed', async () => {
    const queryError = new Error('Temporal service unavailable');
    const result = vi.fn(() => new Promise(() => {}));
    const query = vi.fn().mockRejectedValue(queryError);
    const start = vi.fn().mockResolvedValue({ result, query });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.object({ value: z.number() }), outputSchema: z.unknown() },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.start({ inputData: { value: 1 } })).rejects.toMatchObject({
      name: 'TemporalWorkflowStatusUnknownError',
      message: 'Unable to determine Temporal workflow status for run "test-run".',
      cause: queryError,
    });
  });

  it('throws after signaling when a resumed workflow status cannot be observed', async () => {
    const suspended = {
      status: 'suspended',
      steps: { approval: { status: 'suspended', suspendedAt: 1 } },
      suspended: [['approval']],
    };
    const queryError = new Error('Temporal service unavailable');
    const signal = vi.fn().mockResolvedValue(undefined);
    const result = vi.fn(() => new Promise(() => {}));
    const query = vi.fn().mockResolvedValueOnce(suspended).mockRejectedValue(queryError);
    const getHandle = vi.fn().mockReturnValue({ signal, result, query });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.resume({ step: 'approval', resumeData: { approved: true } })).rejects.toMatchObject({
      name: 'TemporalWorkflowStatusUnknownError',
      message:
        'Unable to determine Temporal workflow status for run "test-run" after sending a resume signal. The signal may have been delivered; do not retry resume() blindly.',
      cause: queryError,
    });
    expect(signal).toHaveBeenCalledOnce();
  });

  it('returns suspended from start when the Temporal workflow stays open waiting for resume', async () => {
    const suspended = {
      status: 'suspended',
      input: { value: 1 },
      state: {},
      steps: {
        approval: {
          __temporalStepResult: true,
          status: 'suspended',
          payload: { value: 1 },
          suspendPayload: { reason: 'needs approval' },
          suspendedAt: 1,
        },
      },
      suspended: [['approval']],
      suspendPayload: { approval: { reason: 'needs approval' } },
    };
    const result = vi.fn(() => new Promise(() => {}));
    const query = vi.fn().mockResolvedValue(suspended);
    const start = vi.fn().mockResolvedValue({ result, query });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.object({ value: z.number() }), outputSchema: z.unknown() },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.start({ inputData: { value: 1 } })).resolves.toEqual({
      status: 'suspended',
      input: { value: 1 },
      state: {},
      steps: {
        approval: {
          status: 'suspended',
          payload: { value: 1 },
          suspendPayload: { reason: 'needs approval' },
          suspendedAt: 1,
        },
      },
      suspended: [['approval']],
      suspendPayload: { approval: { reason: 'needs approval' } },
    });

    expect(query).toHaveBeenCalledWith('mastra.status');
  });

  it('signals the matching Temporal workflow when resuming asynchronously', async () => {
    const signal = vi.fn().mockResolvedValue(undefined);
    const getHandle = vi.fn().mockReturnValue({ signal });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.object({ value: z.number() }), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.resumeAsync({ step: 'approval', resumeData: { approved: true } })).resolves.toEqual({
      runId: 'test-run',
    });

    expect(getHandle).toHaveBeenCalledWith('test-run');
    expect(signal).toHaveBeenCalledWith('mastra.resume', { step: 'approval', resumeData: { approved: true } });
  });

  it('cancels the matching Temporal workflow before updating local state', async () => {
    const cancel = vi.fn().mockResolvedValue(undefined);
    const getHandle = vi.fn().mockReturnValue({ cancel });
    const workflow = createWorkflow(
      { id: 'test-workflow' },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await run.cancel();

    expect(getHandle).toHaveBeenCalledWith('test-run');
    expect(cancel).toHaveBeenCalledOnce();
    expect(run.workflowRunStatus).toBe('canceled');
    expect(run.abortController.signal.aborted).toBe(true);
  });

  it('leaves local state unchanged when Temporal cancellation fails', async () => {
    const error = new Error('Temporal service unavailable');
    const cancel = vi.fn().mockRejectedValue(error);
    const getHandle = vi.fn().mockReturnValue({ cancel });
    const workflow = createWorkflow(
      { id: 'test-workflow' },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.cancel()).rejects.toThrow(error);

    expect(getHandle).toHaveBeenCalledWith('test-run');
    expect(run.workflowRunStatus).toBe('pending');
    expect(run.abortController.signal.aborted).toBe(false);
  });
});
