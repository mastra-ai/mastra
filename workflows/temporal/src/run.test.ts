import type { RequestContext } from '@mastra/core/di';
import { createStep } from '@mastra/core/workflows';
import { CancelledFailure, WorkflowExecutionAlreadyStartedError, WorkflowFailedError } from '@temporalio/client';
import type { Client } from '@temporalio/client';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createWorkflow } from './workflow';

describe('TemporalRun', () => {
  it('propagates workflow validateInputs to synchronous and asynchronous runs', async () => {
    const start = vi.fn().mockResolvedValue({
      result: async () => ({ status: 'success', result: undefined, state: undefined, steps: {} }),
    });
    const workflow = createWorkflow(
      {
        id: 'test-workflow',
        inputSchema: z.unknown(),
        outputSchema: z.unknown(),
        options: { validateInputs: false },
      },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    );

    await (await workflow.createRun({ runId: 'run-1' })).start({ inputData: {} });
    await (await workflow.createRun({ runId: 'run-2' })).startAsync({ inputData: {} });

    expect(start.mock.calls.map(([, options]) => options.args[0].validateInputs)).toEqual([false, false]);
  });

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

  it('returns each repeated suspension before the final resumed result and runs lifecycle hooks once per call', async () => {
    const firstSuspension = {
      status: 'suspended',
      input: { value: 1 },
      state: {},
      steps: {
        firstApproval: {
          __temporalStepResult: true,
          status: 'suspended',
          payload: { value: 1 },
          suspendPayload: { reason: 'first approval' },
          suspendedAt: 1,
        },
      },
      suspended: [['firstApproval']],
      suspendPayload: { firstApproval: { reason: 'first approval' } },
    };
    const secondSuspension = {
      status: 'suspended',
      input: { value: 1 },
      state: {},
      steps: {
        firstApproval: {
          __temporalStepResult: true,
          status: 'success',
          payload: { value: 1 },
          output: { approved: true },
          resumeData: { approved: true },
          startedAt: 1,
          endedAt: 2,
        },
        secondApproval: {
          __temporalStepResult: true,
          status: 'suspended',
          payload: { approved: true },
          suspendPayload: { reason: 'second approval' },
          suspendedAt: 3,
        },
      },
      suspended: [['secondApproval']],
      suspendPayload: { secondApproval: { reason: 'second approval' } },
    };
    const finalResult = {
      status: 'success',
      input: { value: 1 },
      result: { approved: true },
      state: {},
      steps: secondSuspension.steps,
    };
    let status: unknown = firstSuspension;
    let resolveResult: (result: typeof finalResult) => void;
    const terminalResult = new Promise<typeof finalResult>(resolve => {
      resolveResult = resolve;
    });
    const result = vi.fn(() => terminalResult);
    const query = vi.fn().mockImplementation(async () => status);
    const signal = vi.fn().mockImplementation(async (_name, payload) => {
      if (payload.step === 'firstApproval') {
        status = secondSuspension;
      } else {
        resolveResult(finalResult);
      }
    });
    const handle = { signal, result, query };
    const start = vi.fn().mockResolvedValue(handle);
    const getHandle = vi.fn().mockReturnValue(handle);
    const onFinish = vi.fn();
    const onError = vi.fn();
    const workflow = createWorkflow(
      {
        id: 'test-workflow',
        inputSchema: z.object({ value: z.number() }),
        outputSchema: z.unknown(),
        options: { onFinish, onError },
      },
      { client: { workflow: { start, getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.start({ inputData: { value: 1 } })).resolves.toEqual({
      ...firstSuspension,
      steps: {
        firstApproval: {
          status: 'suspended',
          payload: { value: 1 },
          suspendPayload: { reason: 'first approval' },
          suspendedAt: 1,
        },
      },
    });
    await expect(
      Promise.race([
        run.resume({ step: 'firstApproval', resumeData: { approved: true } }),
        new Promise(resolve => setTimeout(() => resolve('timed out'), 500)),
      ]),
    ).resolves.toEqual({
      ...secondSuspension,
      steps: {
        firstApproval: {
          status: 'success',
          payload: { value: 1 },
          output: { approved: true },
          resumeData: { approved: true },
          startedAt: 1,
          endedAt: 2,
        },
        secondApproval: {
          status: 'suspended',
          payload: { approved: true },
          suspendPayload: { reason: 'second approval' },
          suspendedAt: 3,
        },
      },
    });
    await expect(run.resume({ step: 'secondApproval', resumeData: { approved: true } })).resolves.toEqual({
      ...finalResult,
      steps: {
        firstApproval: {
          status: 'success',
          payload: { value: 1 },
          output: { approved: true },
          resumeData: { approved: true },
          startedAt: 1,
          endedAt: 2,
        },
        secondApproval: {
          status: 'suspended',
          payload: { approved: true },
          suspendPayload: { reason: 'second approval' },
          suspendedAt: 3,
        },
      },
    });

    expect(getHandle).toHaveBeenCalledTimes(2);
    expect(signal).toHaveBeenNthCalledWith(1, 'mastra.resume', {
      step: 'firstApproval',
      resumeData: { approved: true },
    });
    expect(signal).toHaveBeenNthCalledWith(2, 'mastra.resume', {
      step: 'secondApproval',
      resumeData: { approved: true },
    });
    expect(onFinish).toHaveBeenCalledTimes(3);
    expect(onFinish).toHaveBeenNthCalledWith(1, expect.objectContaining({ status: 'suspended' }));
    expect(onFinish).toHaveBeenNthCalledWith(2, expect.objectContaining({ status: 'suspended' }));
    expect(onFinish).toHaveBeenNthCalledWith(3, expect.objectContaining({ status: 'success' }));
    expect(onError).not.toHaveBeenCalled();
  });

  it('surfaces status query failures while start waits for suspension', async () => {
    const queryError = new Error('query unavailable');
    const handle = {
      result: vi.fn(() => new Promise(() => {})),
      query: vi.fn().mockRejectedValue(queryError),
    };
    const start = vi.fn().mockResolvedValue(handle);
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(
      Promise.race([run.start(), new Promise(resolve => setTimeout(() => resolve('timed out'), 500))]),
    ).rejects.toMatchObject({
      name: 'TemporalWorkflowStatusUnknownError',
      message: 'Unable to determine Temporal workflow status for run "test-run".',
      cause: queryError,
    });
  });

  it('does not send a resume signal when the current status query fails', async () => {
    const queryError = new Error('query unavailable');
    const signal = vi.fn();
    const getHandle = vi.fn().mockReturnValue({
      signal,
      query: vi.fn().mockRejectedValue(queryError),
    });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.resume({ step: 'approval', resumeData: { approved: true } })).rejects.toMatchObject({
      name: 'TemporalWorkflowStatusUnknownError',
      message: 'Unable to determine Temporal workflow status for run "test-run".',
      cause: queryError,
    });
    expect(signal).not.toHaveBeenCalled();
  });

  it('warns that a resume signal may have been delivered when a later status query fails', async () => {
    const queryError = new Error('query unavailable');
    const suspended = {
      status: 'suspended',
      steps: {
        approval: {
          __temporalStepResult: true,
          status: 'suspended',
          suspendedAt: 1,
        },
      },
      suspended: [['approval']],
    };
    const signal = vi.fn().mockResolvedValue(undefined);
    const query = vi.fn().mockResolvedValueOnce(suspended).mockRejectedValue(queryError);
    const getHandle = vi.fn().mockReturnValue({
      signal,
      query,
      result: vi.fn(() => new Promise(() => {})),
    });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(
      Promise.race([
        run.resume({ step: 'approval', resumeData: { approved: true } }),
        new Promise(resolve => setTimeout(() => resolve('timed out'), 500)),
      ]),
    ).rejects.toMatchObject({
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

  describe('lifecycle hooks', () => {
    const steps = {
      increment: { status: 'success', payload: { value: 1 }, output: { ok: true }, startedAt: 1, endedAt: 2 },
    };
    const workerSteps = {
      increment: {
        __temporalStepResult: true,
        status: 'success',
        payload: { value: 1 },
        output: { ok: true },
        startedAt: 1,
        endedAt: 2,
      },
    };
    const executionResult = (result: unknown) => ({
      status: 'success',
      input: { value: 1 },
      result,
      state: {},
      steps: workerSteps,
    });

    function createHookedWorkflow(
      options: Record<string, unknown>,
      result: () => Promise<unknown>,
      start = vi.fn().mockImplementation(async () => ({ result })),
    ) {
      const workflow = createWorkflow(
        { id: 'hooked-workflow', inputSchema: z.object({ value: z.number() }), outputSchema: z.unknown(), options },
        { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
      );
      return { workflow, start };
    }

    it('runs onStart before dispatch and onFinish after a successful run', async () => {
      const order: string[] = [];
      const onStart = vi.fn(async () => {
        order.push('onStart');
      });
      const onFinish = vi.fn(async () => {
        order.push('onFinish');
      });
      const onError = vi.fn();
      const start = vi.fn().mockImplementation(async () => {
        order.push('dispatch');
        return { result: async () => executionResult({ ok: true }) };
      });
      const { workflow } = createHookedWorkflow({ onStart, onFinish, onError }, async () => ({}), start);
      const run = await workflow.createRun({ runId: 'run-1', resourceId: 'resource-1' });

      const result = await run.start({ inputData: { value: 1 } });

      expect(result).toEqual({ status: 'success', input: { value: 1 }, result: { ok: true }, state: {}, steps });
      expect(order).toEqual(['onStart', 'dispatch', 'onFinish']);
      expect(onStart).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-1', workflowId: 'hooked-workflow', resourceId: 'resource-1' }),
      );
      expect((onStart.mock.calls[0] as any)[0].getInitData()).toEqual({ value: 1 });
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', result: { ok: true }, steps, runId: 'run-1' }),
      );
      expect(onError).not.toHaveBeenCalled();
    });

    it('runs onFinish and onError when the Temporal workflow fails', async () => {
      const failure = new Error('activity failed');
      const onFinish = vi.fn();
      const onError = vi.fn();
      const { workflow } = createHookedWorkflow({ onFinish, onError }, () => Promise.reject(failure));
      const run = await workflow.createRun({ runId: 'run-1' });

      const result = await run.start({ inputData: { value: 1 } });

      expect(result.status).toBe('failed');
      expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: failure }));
      expect(onError).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: failure }));
    });

    it.each(['start', 'startAsync'] as const)(
      '%s reports canceled and does not run onError when the Temporal workflow is canceled',
      async method => {
        const failure = new WorkflowFailedError(
          'Workflow execution cancelled',
          new CancelledFailure('Workflow canceled'),
          'NON_RETRYABLE_FAILURE',
        );
        const onFinish = vi.fn();
        const onError = vi.fn();
        const { workflow } = createHookedWorkflow({ onFinish, onError }, () => Promise.reject(failure));
        const run = await workflow.createRun({ runId: 'run-1' });

        const result = await run[method]({ inputData: { value: 1 } });

        if (method === 'start') {
          expect(result).toEqual({
            status: 'canceled',
            input: { value: 1 },
            state: undefined,
            steps: {},
          });
        } else {
          expect(result).toEqual({ runId: 'run-1' });
        }
        await vi.waitFor(() => expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ status: 'canceled' })));
        expect(onError).not.toHaveBeenCalled();
      },
    );

    it('runs onError when dispatching to Temporal fails', async () => {
      const failure = new Error('Temporal service unavailable');
      const onError = vi.fn();
      const start = vi.fn().mockRejectedValue(failure);
      const { workflow } = createHookedWorkflow({ onError }, async () => ({}), start);
      const run = await workflow.createRun({ runId: 'run-1' });

      const result = await run.start({ inputData: { value: 1 } });

      expect(result.status).toBe('failed');
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: failure }));
    });

    it.each(['start', 'startAsync'] as const)(
      '%s does not run terminal hooks when Temporal rejects a duplicate workflow id',
      async method => {
        const failure = new WorkflowExecutionAlreadyStartedError(
          'Workflow execution already started',
          'run-1',
          'hooked-workflow',
        );
        const onFinish = vi.fn();
        const onError = vi.fn();
        const start = vi.fn().mockRejectedValue(failure);
        const { workflow } = createHookedWorkflow({ onFinish, onError }, async () => ({}), start);
        const run = await workflow.createRun({ runId: 'run-1' });

        if (method === 'start') {
          const result = await run.start({ inputData: { value: 1 } });
          expect(result.status).toBe('failed');
        } else {
          await expect(run.startAsync({ inputData: { value: 1 } })).rejects.toBe(failure);
        }

        expect(onFinish).not.toHaveBeenCalled();
        expect(onError).not.toHaveBeenCalled();
      },
    );

    it('runs terminal hooks when a resumed Temporal workflow fails', async () => {
      const failure = new Error('activity failed after resume');
      const onFinish = vi.fn();
      const onError = vi.fn();
      const signal = vi.fn().mockResolvedValue(undefined);
      const getHandle = vi.fn().mockReturnValue({ signal, result: vi.fn().mockRejectedValue(failure) });
      const workflow = createWorkflow(
        {
          id: 'hooked-workflow',
          inputSchema: z.object({ value: z.number() }),
          outputSchema: z.unknown(),
          options: { onFinish, onError },
        },
        { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
      );
      const run = await workflow.createRun({ runId: 'run-1' });

      const result = await run.resume({ step: 'approval', resumeData: { approved: true } });

      expect(result.status).toBe('failed');
      expect(signal).toHaveBeenCalledWith('mastra.resume', { step: 'approval', resumeData: { approved: true } });
      expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: failure }));
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: failure }));
    });

    it('sends request context values set by onStart to Temporal', async () => {
      const onStart = vi.fn(({ requestContext }: { requestContext: RequestContext }) => {
        requestContext.set('tenant', 'acme');
      });
      const { workflow, start } = createHookedWorkflow({ onStart }, async () => executionResult({}));

      await (await workflow.createRun({ runId: 'run-1' })).start({ inputData: { value: 1 } });
      await (await workflow.createRun({ runId: 'run-2' })).startAsync({ inputData: { value: 1 } });

      expect(start).toHaveBeenCalledTimes(2);
      for (const [, options] of start.mock.calls) {
        expect(options.args[0].requestContext).toEqual({ tenant: 'acme' });
      }
    });

    it('runs terminal hooks and rejects when startAsync dispatch fails', async () => {
      const failure = new Error('Temporal service unavailable');
      const onFinish = vi.fn();
      const onError = vi.fn();
      const start = vi.fn().mockRejectedValue(failure);
      const { workflow } = createHookedWorkflow({ onFinish, onError }, async () => ({}), start);
      const run = await workflow.createRun({ runId: 'run-1' });

      await expect(run.startAsync({ inputData: { value: 1 } })).rejects.toThrow(failure);
      expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: failure }));
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', error: failure }));
    });

    it('rejects start without dispatching when onStart throws', async () => {
      const gate = new Error('quota exceeded');
      const onFinish = vi.fn();
      const { workflow, start } = createHookedWorkflow(
        {
          onStart: () => {
            throw gate;
          },
          onFinish,
        },
        async () => ({}),
      );
      const run = await workflow.createRun({ runId: 'run-1' });

      await expect(run.start({ inputData: { value: 1 } })).rejects.toThrow(gate);
      await expect(run.startAsync({ inputData: { value: 1 } })).rejects.toThrow(gate);
      expect(start).not.toHaveBeenCalled();
      expect(onFinish).not.toHaveBeenCalled();
    });

    it('does not fail the run when onFinish or onError throw', async () => {
      const onFinish = vi.fn().mockRejectedValue(new Error('onFinish broke'));
      const onError = vi.fn().mockRejectedValue(new Error('onError broke'));
      const { workflow } = createHookedWorkflow({ onFinish, onError }, () => Promise.reject(new Error('boom')));
      const run = await workflow.createRun({ runId: 'run-1' });

      const result = await run.start({ inputData: { value: 1 } });

      expect(result.status).toBe('failed');
      expect(onFinish).toHaveBeenCalledOnce();
      expect(onError).toHaveBeenCalledOnce();
    });

    it('preserves serialized step results even when payload and output are omitted', async () => {
      const serializedSteps = {
        voidStep: { __temporalStepResult: true, status: 'success', startedAt: 1, endedAt: 2 },
      };
      const normalizedSteps = {
        voidStep: { status: 'success', payload: undefined, output: undefined, startedAt: 1, endedAt: 2 },
      };
      const onFinish = vi.fn();
      const { workflow } = createHookedWorkflow({ onFinish }, async () => ({
        status: 'success',
        input: { value: 1 },
        result: undefined,
        state: {},
        steps: serializedSteps,
      }));
      const run = await workflow.createRun({ runId: 'run-1' });

      const result = await run.start({ inputData: { value: 1 } });

      expect(result.steps).toEqual(normalizedSteps);
      expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ steps: normalizedSteps }));
    });

    it('preserves serialized step results from startAsync background hooks when payload and output are omitted', async () => {
      let resolveResult!: (value: unknown) => void;
      const serializedSteps = {
        voidStep: { __temporalStepResult: true, status: 'success', startedAt: 1, endedAt: 2 },
      };
      const normalizedSteps = {
        voidStep: { status: 'success', payload: undefined, output: undefined, startedAt: 1, endedAt: 2 },
      };
      const onFinish = vi.fn();
      const { workflow } = createHookedWorkflow({ onFinish }, () => new Promise(resolve => (resolveResult = resolve)));
      const run = await workflow.createRun({ runId: 'run-1' });

      await expect(run.startAsync({ inputData: { value: 1 } })).resolves.toEqual({ runId: 'run-1' });
      resolveResult({ status: 'success', input: { value: 1 }, result: undefined, state: {}, steps: serializedSteps });

      await vi.waitFor(() =>
        expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ steps: normalizedSteps })),
      );
    });

    it('runs onFinish in the background after startAsync returns', async () => {
      let resolveResult!: (value: unknown) => void;
      const onStart = vi.fn();
      const onFinish = vi.fn();
      const { workflow, start } = createHookedWorkflow(
        { onStart, onFinish },
        () => new Promise(resolve => (resolveResult = resolve)),
      );
      const run = await workflow.createRun({ runId: 'run-1' });

      await expect(run.startAsync({ inputData: { value: 1 } })).resolves.toEqual({ runId: 'run-1' });
      expect(onStart).toHaveBeenCalledOnce();
      expect(start).toHaveBeenCalledOnce();
      expect(onFinish).not.toHaveBeenCalled();

      resolveResult(executionResult({ done: true }));
      await vi.waitFor(() =>
        expect(onFinish).toHaveBeenCalledWith(expect.objectContaining({ status: 'success', result: { done: true } })),
      );
    });

    it('does not wait for the result in startAsync when no terminal hooks are registered', async () => {
      const result = vi.fn(() => new Promise(() => {}));
      const { workflow } = createHookedWorkflow({}, result);
      const run = await workflow.createRun({ runId: 'run-1' });

      await run.startAsync({ inputData: { value: 1 } });

      expect(result).not.toHaveBeenCalled();
    });
  });
});
