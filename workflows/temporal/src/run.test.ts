import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStep, createWorkflow as createLocalWorkflow } from '@mastra/core/workflows';
import {
  ApplicationFailure,
  CancelledFailure,
  WorkflowExecutionAlreadyStartedError,
  WorkflowFailedError,
} from '@temporalio/client';
import type { Client } from '@temporalio/client';
import { proxyActivities } from '@temporalio/workflow';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { buildTemporalWorkflowModule } from './transforms/workflows';
import { createWorkflow } from './workflow';
import { init } from './index';

// The Temporal SDK cannot load under the repository's protobufjs override, so the
// worker sandbox is replaced by calling the generated workflow module directly.
vi.mock('@temporalio/workflow', () => ({
  executeChild: vi.fn(),
  proxyActivities: vi.fn(),
  sleep: vi.fn(),
  log: { info: vi.fn() },
}));

// Temporal's default payload converter sends workflow arguments and results as JSON.
function overTheWire<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

describe('TemporalRun', () => {
  it('returns the same output as a local run', async () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    const directory = await realpath(await mkdtemp(path.join(packageRoot, '.start-result-')));

    try {
      const sourcePath = path.join(directory, 'source.mjs');
      await writeFile(
        sourcePath,
        `import { createWorkflow } from '@mastra/core/workflows';
         export const echoWorkflow = createWorkflow({ id: 'echo-workflow' }).then('echo').commit();`,
      );
      const { outputPath } = await buildTemporalWorkflowModule(sourcePath, directory, 'workflow.mjs');
      const workflows: Record<string, (args: unknown) => Promise<unknown>> = await import(
        pathToFileURL(outputPath).href
      );
      vi.mocked(proxyActivities).mockReturnValue({
        echo: async ({ inputData }: { inputData: { output: unknown } }) => inputData.output,
      });
      const start = vi.fn(async (workflowType: string, options: { args: [unknown] }) => {
        const execution = workflows[workflowType]!(overTheWire(options.args[0]));
        return { result: async () => overTheWire(await execution) };
      });
      const client = { workflow: { start } } as unknown as Client;

      const schema = z.unknown();
      const stateSchema = z.object({ date: z.date(), optional: z.unknown().optional() });
      const inputSchema = stateSchema.extend({ output: schema });
      const echo = createStep({
        id: 'echo',
        inputSchema,
        outputSchema: schema,
        execute: async ({ inputData }) => inputData.output,
      });
      const config = { id: 'echo-workflow', inputSchema, outputSchema: schema, stateSchema };
      const local = createLocalWorkflow(config).then(echo).commit();
      const temporal = init({ client, taskQueue: 'start-result' }).createWorkflow(config).then(echo).commit();

      // #27934: decode only the transport envelope, preserving falsy outputs and user result fields.
      for (const output of [{ value: 6 }, null, { result: { value: 6 } }, 0, false, '']) {
        const initialState = { date: new Date('2026-10-20T00:00:00Z'), optional: undefined };
        const inputData = { ...initialState, output };
        const expected = await (await local.createRun()).start({ inputData, initialState });
        const actual = await (await temporal.createRun()).start({ inputData, initialState });
        expect(expected.status).toBe('success');
        expect(actual.status).toBe('success');
        if (expected.status === 'success' && actual.status === 'success') {
          expect(expected.result).toEqual(output);
          expect(actual.result).toEqual(output);
          expect(actual.input).toStrictEqual(expected.input);
          expect(actual.state).toStrictEqual(initialState);
        }
      }
      expect(start).toHaveBeenCalledTimes(6);
      expect(start).toHaveBeenCalledWith('echoWorkflow', expect.objectContaining({ taskQueue: 'start-result' }));
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("uses the workflow's validateInputs when the build cannot read its options", async () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    const directory = await realpath(await mkdtemp(path.join(packageRoot, '.validate-inputs-')));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    try {
      const sourcePath = path.join(directory, 'source.mjs');
      await writeFile(
        sourcePath,
        `import { createWorkflow } from '@mastra/core/workflows';
         import { sharedOptions } from './options.mjs';
         export const echoWorkflow = createWorkflow({ id: 'echo-workflow', options: sharedOptions }).then('echo').commit();`,
      );
      await writeFile(path.join(directory, 'options.mjs'), 'export const sharedOptions = { validateInputs: false };');
      const { outputPath } = await buildTemporalWorkflowModule(sourcePath, directory, 'workflow.mjs');
      const workflows: Record<string, (args: unknown) => Promise<unknown>> = await import(
        pathToFileURL(outputPath).href
      );
      const received: unknown[] = [];
      vi.mocked(proxyActivities).mockReturnValue({
        echo: async ({ validateInputs }: { validateInputs?: boolean }) => received.push(validateInputs),
      });
      const executions: Promise<unknown>[] = [];
      const start = vi.fn(async (workflowType: string, options: { args: [unknown] }) => {
        const execution = workflows[workflowType]!(overTheWire(options.args[0]));
        executions.push(execution);
        return { result: async () => overTheWire(await execution) };
      });
      const workflow = createWorkflow(
        { id: 'echo-workflow', options: { validateInputs: false } },
        { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
      );

      await (await workflow.createRun()).start({ inputData: {} });
      await (await workflow.createRun()).startAsync({ inputData: {} });
      await Promise.all(executions);

      expect(received).toEqual([false, false]);
    } finally {
      warn.mockRestore();
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('returns one step record per step, like a local run', async () => {
    const schema = z.object({ value: z.number() });
    const step = createStep({
      id: 'increment',
      inputSchema: schema,
      outputSchema: schema,
      execute: async () => ({ value: 6 }),
    });
    const start = vi.fn(async () => ({
      result: async () => ({
        status: 'success',
        input: { value: 5 },
        result: { value: 6 },
        steps: { increment: { value: 6 } },
        stepMeta: {
          increment: { startedAt: 1_000, endedAt: 1_250 },
          'no-output': { startedAt: 1_250, endedAt: 1_300 },
        },
      }),
    }));
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    )
      .then(step)
      .commit();
    const run = await workflow.createRun({ runId: 'test-run' });

    const result = await run.start({ inputData: { value: 5 } });

    expect(start).toHaveBeenCalledWith(
      'testWorkflow',
      expect.objectContaining({ args: [expect.objectContaining({ inputData: { value: 5 }, recordStepMeta: true })] }),
    );
    expect(result.status).toBe('success');
    expect(result.steps).toStrictEqual({
      input: { value: 5 },
      increment: { status: 'success', output: { value: 6 }, startedAt: 1_000, endedAt: 1_250 },
      'no-output': { status: 'success', output: undefined, startedAt: 1_250, endedAt: 1_300 },
    });
  });

  it('does not ask for step times from startAsync()', async () => {
    const start = vi.fn(async () => ({}));
    const workflow = createWorkflow(
      { id: 'test-workflow' },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await run.startAsync({ inputData: { value: 5 } });

    expect(start).toHaveBeenCalledWith(
      'testWorkflow',
      expect.objectContaining({ args: [expect.not.objectContaining({ recordStepMeta: expect.anything() })] }),
    );
  });

  it('keeps steps empty for a result from a Worker that records no step times', async () => {
    const schema = z.object({ value: z.number() });
    const start = vi.fn(async () => ({
      result: async () => ({
        status: 'success',
        input: { value: 5 },
        result: { value: 6 },
        steps: { increment: { value: 6 } },
      }),
    }));
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    const result = await run.start({ inputData: { value: 5 } });

    expect(result.status).toBe('success');
    expect(result.steps).toEqual({});
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
});

// The errors `handle.result()` throws for a failed or canceled Temporal workflow.
function workflowFailed(message: string, cause: Error) {
  return new WorkflowFailedError(message, cause, 'NON_RETRYABLE_FAILURE' as never);
}

// #24018: hooks used to be accepted and never called.
describe('TemporalRun lifecycle hooks', () => {
  function createHookedWorkflow(start: unknown) {
    const hooks = { onStart: vi.fn(), onFinish: vi.fn(), onError: vi.fn() };
    const workflow = createWorkflow(
      { id: 'test-workflow', options: hooks },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    );
    return { hooks, workflow };
  }

  it.each([
    { outcome: 'success', settle: () => Promise.resolve({ result: { value: 6 } }), status: 'success', onError: false },
    {
      outcome: 'failure',
      settle: () =>
        Promise.reject(workflowFailed('Workflow execution failed', ApplicationFailure.nonRetryable('step failed'))),
      status: 'failed',
      onError: true,
    },
    {
      outcome: 'cancellation',
      settle: () =>
        Promise.reject(workflowFailed('Workflow execution cancelled', new CancelledFailure('Workflow canceled'))),
      status: 'canceled',
      onError: false,
    },
  ])(
    'start() reports a $outcome to onFinish, and to onError only for failures',
    async ({ settle, status, onError }) => {
      const { hooks, workflow } = createHookedWorkflow(async () => ({ result: settle }));
      const run = await workflow.createRun({ runId: 'test-run' });

      const result = await run.start({ inputData: { value: 5 } });

      expect(result.status).toBe(status);
      expect(hooks.onFinish).toHaveBeenCalledOnce();
      expect(hooks.onFinish).toHaveBeenCalledWith(
        expect.objectContaining({ status, runId: 'test-run', workflowId: 'test-workflow' }),
      );
      expect(hooks.onError).toHaveBeenCalledTimes(onError ? 1 : 0);
    },
  );

  it('start() does not run the finish callbacks when Temporal does not start the run', async () => {
    // Another run already owns the id, so its outcome must not be reported as this run's.
    const start = vi
      .fn()
      .mockRejectedValue(
        new WorkflowExecutionAlreadyStartedError('Workflow execution already started', 'test-run', 'testWorkflow'),
      );
    const { hooks, workflow } = createHookedWorkflow(start);
    const run = await workflow.createRun({ runId: 'test-run' });

    const result = await run.start({ inputData: {} });

    expect(result.status).toBe('failed');
    expect(hooks.onFinish).not.toHaveBeenCalled();
    expect(hooks.onError).not.toHaveBeenCalled();
  });

  it.each(['start', 'startAsync'] as const)(
    '%s() rejects without starting the workflow when onStart throws',
    async method => {
      const start = vi.fn();
      const { hooks, workflow } = createHookedWorkflow(start);
      hooks.onStart.mockRejectedValue(new Error('quota exceeded'));
      const run = await workflow.createRun({ runId: 'test-run' });

      await expect(run[method]({ inputData: {} })).rejects.toThrow('quota exceeded');

      expect(hooks.onStart).toHaveBeenCalledWith(expect.objectContaining({ runId: 'test-run' }));
      expect(start).not.toHaveBeenCalled();
      expect(hooks.onFinish).not.toHaveBeenCalled();
    },
  );

  it('startAsync() runs onFinish and onError once the workflow fails in the background', async () => {
    let fail!: (error: Error) => void;
    const settled = new Promise<never>((_, reject) => {
      fail = reject;
    });
    const start = vi.fn(async () => ({ result: () => settled }));
    const { hooks, workflow } = createHookedWorkflow(start);
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.startAsync({ inputData: {} })).resolves.toEqual({ runId: 'test-run' });
    expect(start).toHaveBeenCalledOnce();
    expect(hooks.onFinish).not.toHaveBeenCalled();

    fail(workflowFailed('Workflow execution failed', ApplicationFailure.nonRetryable('step failed')));

    await vi.waitFor(() => expect(hooks.onError).toHaveBeenCalledOnce());
    expect(hooks.onFinish).toHaveBeenCalledWith(expect.objectContaining({ status: 'failed', runId: 'test-run' }));
  });
});
