import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createStep, createWorkflow as createLocalWorkflow } from '@mastra/core/workflows';
import type { Step, Workflow } from '@mastra/core/workflows';
import { ActivityFailure, ApplicationFailure, WorkflowFailedError } from '@temporalio/client';
import type { Client } from '@temporalio/client';
import { proxyActivities } from '@temporalio/workflow';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { MastraPlugin } from './plugin';
import { buildTemporalActivitiesModule } from './transforms/activities';
import { buildTemporalWorkflowModule } from './transforms/workflows';
import { createWorkflow } from './workflow';
import { init } from './index';

// The Temporal SDK cannot load under the repository's protobufjs override, so the
// worker sandbox is replaced by calling the generated workflow module directly.
vi.mock('@temporalio/workflow', async importOriginal => ({
  ApplicationFailure: (await importOriginal<typeof import('@temporalio/workflow')>()).ApplicationFailure,
  isCancellation: () => false,
  executeChild: vi.fn(),
  proxyActivities: vi.fn(),
  sleep: vi.fn(),
  log: { info: vi.fn() },
}));

// Temporal's default payload converter sends workflow arguments and results as JSON.
function overTheWire<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

// Temporal's failure converter as these runs see it: an error thrown in an Activity or Workflow
// arrives as an ApplicationFailure keeping its type, message and JSON details.
function failureOverTheWire(error: unknown): ApplicationFailure {
  const failure = ApplicationFailure.fromError(error);
  return new ApplicationFailure(
    failure.message,
    failure.type,
    failure.nonRetryable,
    overTheWire(failure.details),
    failure.cause,
  );
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

  // #28754: start() returned every failed run as `failed` with `steps: {}` and Temporal's
  // WorkflowFailedError, because the Workflow dropped its step outputs when a step threw and the
  // Activity failure kept only the error's class name and message.
  it('returns the same failed and tripwire results as a local run', async () => {
    const packageRoot = fileURLToPath(new URL('..', import.meta.url));
    const directory = await realpath(await mkdtemp(path.join(packageRoot, '.failed-result-')));

    try {
      const sourcePath = path.join(directory, 'source.mjs');
      await writeFile(
        sourcePath,
        `import { TripWire } from '@mastra/core/agent';
         import { createStep, createWorkflow } from '@mastra/core/workflows';
         import { z } from 'zod';

         const Value = z.object({ value: z.number() });
         export const addOne = createStep({
           id: 'add-one',
           inputSchema: Value,
           outputSchema: Value,
           // Finishes after \`fail\` in the parallel run, so its record needs the run to wait for it.
           execute: async ({ inputData }) => {
             await new Promise(resolve => setImmediate(resolve));
             return { value: inputData.value + 1 };
           },
         });
         export const fail = createStep({
           id: 'fail',
           inputSchema: Value,
           outputSchema: Value,
           execute: async () => {
             throw Object.assign(new Error('step failed'), { code: 'E_STEP' });
           },
         });
         export const guard = createStep({
           id: 'guard',
           inputSchema: Value,
           outputSchema: Value,
           execute: async () => {
             throw new TripWire('input blocked', { retry: false, metadata: { rule: 'no-secrets' } }, 'input-guard');
           },
         });

         export const failing = createWorkflow({ id: 'failing', inputSchema: Value }).then(addOne).then(fail).commit();
         export const parallel = createWorkflow({ id: 'parallel', inputSchema: Value }).parallel([addOne, fail]).commit();
         export const tripwire = createWorkflow({ id: 'tripwire', inputSchema: Value }).then(guard).commit();`,
      );

      // The Worker's code: the generated Workflows and the plugin's Activities.
      const { outputPath } = await buildTemporalWorkflowModule(sourcePath, directory, 'workflow.mjs');
      const { activityBindings } = await buildTemporalActivitiesModule(sourcePath, directory, 'activities.mjs');
      await writeFile(path.join(directory, 'activity-bindings.json'), JSON.stringify(activityBindings));
      const activities = new MastraPlugin(sourcePath, packageRoot).getTemporalWorkerOptions(directory)
        .activities as Record<string, (params: unknown) => Promise<unknown>>;
      vi.mocked(proxyActivities).mockReturnValue(
        Object.fromEntries(
          Object.entries(activities).map(([stepId, activity]) => [
            stepId,
            async (params: unknown) => {
              try {
                return overTheWire(await activity(overTheWire(params)));
              } catch (error) {
                throw new ActivityFailure(
                  'Activity task failed',
                  stepId,
                  undefined,
                  'NON_RETRYABLE_FAILURE',
                  undefined,
                  failureOverTheWire(error),
                );
              }
            },
          ]),
        ),
      );
      const workflows: Record<string, (args: unknown) => Promise<unknown>> = await import(
        pathToFileURL(outputPath).href
      );
      const start = vi.fn(async (workflowType: string, options: { args: [unknown] }) => {
        const execution = workflows[workflowType]!(overTheWire(options.args[0]));
        return {
          result: async () => {
            try {
              return overTheWire(await execution);
            } catch (error) {
              throw new WorkflowFailedError(
                'Workflow execution failed',
                failureOverTheWire(error),
                'RETRY_POLICY_NOT_SET',
              );
            }
          },
        };
      });
      const { createWorkflow: createTemporalWorkflow } = init({
        client: { workflow: { start } } as unknown as Client,
        taskQueue: 'failed-result',
      });

      const local: Record<string, Workflow> & Record<'addOne' | 'fail' | 'guard', Step> = await import(
        pathToFileURL(sourcePath).href
      );
      const { addOne, fail, guard } = local;
      const inputSchema = addOne.inputSchema;
      const temporal = {
        failing: createTemporalWorkflow({ id: 'failing', inputSchema }).then(addOne).then(fail).commit(),
        parallel: createTemporalWorkflow({ id: 'parallel', inputSchema }).parallel([addOne, fail]).commit(),
        tripwire: createTemporalWorkflow({ id: 'tripwire', inputSchema }).then(guard).commit(),
      };
      // Step ids to statuses, with the input record as is.
      const statuses = (steps: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(steps).map(([stepId, step]) => [stepId, (step as { status?: string }).status ?? step]),
        );

      for (const id of ['failing', 'parallel', 'tripwire'] as const) {
        const expected = await (await local[id]!.createRun()).start({ inputData: { value: 5 } });
        const actual = await (await temporal[id].createRun()).start({ inputData: { value: 5 } });

        expect(statuses(actual.steps)).toEqual(statuses(expected.steps));
        expect(actual.status).toBe(expected.status);
        if (expected.status === 'failed' && actual.status === 'failed') {
          expect(actual.error).toMatchObject({ message: 'step failed', code: 'E_STEP' });
          expect(expected.error).toMatchObject({ message: 'step failed', code: 'E_STEP' });
          expect(actual.steps.fail).toMatchObject({ error: { message: 'step failed', code: 'E_STEP' } });
        }
        if (expected.status === 'tripwire' && actual.status === 'tripwire') {
          expect(actual.tripwire).toEqual(expected.tripwire);
        }
      }
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
