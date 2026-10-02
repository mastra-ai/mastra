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

  it.each([
    'streamLegacy',
    'resumeStream',
    'resume',
    'resumeAsync',
    'restart',
    'timeTravel',
    'timeTravelStream',
  ] as const)('rejects unsupported %s calls instead of using the local workflow engine', async method => {
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: {} } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    expect(() => (run[method] as (...args: unknown[]) => unknown)()).toThrow(
      `@mastra/temporal does not support ${method}() yet. Use start() or startAsync() instead.`,
    );
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
        return { result: async () => ({ ok: true }) };
      });
      const { workflow } = createHookedWorkflow({ onStart, onFinish, onError }, async () => ({}), start);
      const run = await workflow.createRun({ runId: 'run-1', resourceId: 'resource-1' });

      const result = await run.start({ inputData: { value: 1 } });

      expect(result.status).toBe('success');
      expect(order).toEqual(['onStart', 'dispatch', 'onFinish']);
      expect(onStart).toHaveBeenCalledWith(
        expect.objectContaining({ runId: 'run-1', workflowId: 'hooked-workflow', resourceId: 'resource-1' }),
      );
      expect((onStart.mock.calls[0] as any)[0].getInitData()).toEqual({ value: 1 });
      expect(onFinish).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'success', result: { ok: true }, runId: 'run-1' }),
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

      resolveResult({ done: true });
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
