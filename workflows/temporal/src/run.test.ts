import { mkdtemp, realpath, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { RequestContext } from '@mastra/core/di';
import { MASTRA_AUTH_TOKEN_KEY } from '@mastra/core/request-context';
import { createStep } from '@mastra/core/workflows';
import type { Step, Workflow } from '@mastra/core/workflows';
import {
  ActivityFailure,
  ApplicationFailure,
  CancelledFailure,
  WorkflowExecutionAlreadyStartedError,
  WorkflowFailedError,
} from '@temporalio/client';
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
vi.mock('@temporalio/workflow', async importOriginal => {
  const { ApplicationFailure, TemporalFailure } = await importOriginal<typeof import('@temporalio/workflow')>();
  return {
    ApplicationFailure,
    TemporalFailure,
    isCancellation: () => false,
    condition: vi.fn(),
    defineQuery: (name: string) => name,
    defineSignal: (name: string) => name,
    setHandler: vi.fn(),
    executeChild: vi.fn(),
    proxyActivities: vi.fn(),
    sleep: vi.fn(),
    log: { info: vi.fn() },
  };
});

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

  it.each(['streamLegacy', 'resumeStream', 'restart', 'timeTravelStream'] as const)(
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

  it('requires a time-travel target before observing the source execution', async () => {
    const getHandle = vi.fn();
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.timeTravel({ step: [] })).rejects.toThrow('Step is required');
    expect(getHandle).not.toHaveBeenCalled();
  });

  it('rejects time travel while the source execution is semantically running', async () => {
    const query = vi.fn().mockResolvedValue({ status: 'running', input: { value: 1 }, state: {}, steps: {} });
    const describe = vi.fn().mockResolvedValue({ runId: 'temporal-run-1' });
    const start = vi.fn();
    const getHandle = vi.fn().mockReturnValue({ query, describe });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: { getHandle, start } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.timeTravel({ step: 'target' })).rejects.toThrow('still running');
    expect(query).toHaveBeenCalledWith('mastra.status');
    expect(start).not.toHaveBeenCalled();
  });

  it('surfaces source status query failures without starting a replacement', async () => {
    const queryError = new Error('Temporal service unavailable');
    const query = vi.fn().mockRejectedValue(queryError);
    const start = vi.fn();
    const getHandle = vi.fn().mockReturnValue({ query });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: { getHandle, start } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.timeTravel({ step: 'target' })).rejects.toMatchObject({
      name: 'TemporalWorkflowStatusUnknownError',
      cause: queryError,
    });
    expect(start).not.toHaveBeenCalled();
  });

  it('rejects nested time-travel targets before starting a replacement execution', async () => {
    const schema = z.object({ value: z.number() });
    const target = createStep({
      id: 'target',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const query = vi.fn().mockResolvedValue({
      status: 'success',
      input: { value: 1 },
      state: {},
      steps: {
        target: { status: 'success', payload: { value: 1 }, output: { value: 1 }, startedAt: 1, endedAt: 2 },
      },
      result: { value: 1 },
    });
    const describe = vi.fn().mockResolvedValue({ runId: 'temporal-run-1' });
    const start = vi.fn();
    const getHandle = vi.fn().mockReturnValue({ query, describe });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { getHandle, start } } as unknown as Client, taskQueue: 'test-queue' },
    )
      .then(target)
      .commit();
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.timeTravel({ step: 'target.nested' })).rejects.toThrow(
      'Temporal time travel currently supports only top-level sequential step targets.',
    );
    expect(start).not.toHaveBeenCalled();
  });

  it('rejects unsuccessful parallel predecessors before starting a replacement execution', async () => {
    const schema = z.object({ value: z.number() });
    const failed = createStep({
      id: 'failed',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const succeeded = createStep({
      id: 'succeeded',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const target = createStep({
      id: 'target',
      inputSchema: z.record(z.string(), schema),
      outputSchema: schema,
      execute: async ({ inputData }) => inputData.succeeded,
    });
    const query = vi.fn().mockResolvedValue({
      status: 'failed',
      input: { value: 1 },
      state: {},
      steps: {
        failed: { status: 'failed', payload: { value: 1 }, error: new Error('failed'), startedAt: 1, endedAt: 2 },
        succeeded: { status: 'success', payload: { value: 1 }, output: { value: 2 }, startedAt: 1, endedAt: 2 },
      },
      error: new Error('failed'),
    });
    const describe = vi.fn().mockResolvedValue({ runId: 'temporal-run-1' });
    const start = vi.fn();
    const getHandle = vi.fn().mockReturnValue({ query, describe });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { getHandle, start } } as unknown as Client, taskQueue: 'test-queue' },
    )
      .parallel([failed, succeeded])
      .then(target)
      .commit();
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.timeTravel({ step: 'target' })).rejects.toThrow(
      'Cannot time travel to step "target" because preceding step "failed" did not succeed in the source execution.',
    );
    expect(start).not.toHaveBeenCalled();
  });

  it('validates graph divergence before starting a replacement execution', async () => {
    const schema = z.object({ value: z.number() });
    const first = createStep({
      id: 'first',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const target = createStep({
      id: 'target',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const query = vi.fn().mockResolvedValue({
      status: 'success',
      input: { value: 1 },
      state: {},
      steps: {
        target: {
          status: 'success',
          payload: { value: 1 },
          output: { value: 1 },
          startedAt: 1,
          endedAt: 2,
        },
      },
      result: { value: 1 },
    });
    const describe = vi.fn().mockResolvedValue({ runId: 'temporal-run-1' });
    const start = vi.fn();
    const getHandle = vi.fn().mockReturnValue({ query, describe });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { getHandle, start } } as unknown as Client, taskQueue: 'test-queue' },
    )
      .then(first)
      .then(target)
      .commit();
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.timeTravel({ step: 'target' })).rejects.toThrow(
      "Cannot time travel to step 'target': step(s) 'first' precede the target in the current execution graph but were not recorded in the snapshot.",
    );
    expect(start).not.toHaveBeenCalled();
  });

  it('starts a seeded replacement under the same Mastra run id and returns its terminal result', async () => {
    const schema = z.object({ value: z.number() });
    const first = createStep({
      id: 'first',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const target = createStep({
      id: 'target',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const sourceStatus = {
      status: 'success',
      input: { value: 1 },
      state: { preserved: true },
      steps: {
        first: {
          status: 'success',
          payload: { value: 1 },
          output: { value: 2 },
          startedAt: 1,
          endedAt: 2,
        },
        target: {
          status: 'success',
          payload: { value: 2 },
          output: { value: 3 },
          startedAt: 3,
          endedAt: 4,
        },
      },
      result: { value: 3 },
    };
    const replacementResult = {
      status: 'success',
      input: { value: 2 },
      state: { preserved: true },
      steps: sourceStatus.steps,
      result: { value: 4 },
    };
    const sourceHandle = {
      query: vi.fn().mockResolvedValue(sourceStatus),
      describe: vi.fn().mockResolvedValue({ runId: 'temporal-run-1' }),
    };
    const replacementHandle = {
      result: vi.fn().mockResolvedValue(replacementResult),
      query: vi.fn(),
    };
    const signalWithStart = vi.fn().mockImplementation(async (_workflowType, options) => {
      replacementHandle.query.mockResolvedValue({ operation: 'timeTravel', token: options.signalArgs[0].token });
      return replacementHandle;
    });
    const getHandle = vi.fn().mockReturnValue(sourceHandle);
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { getHandle, signalWithStart } } as unknown as Client, taskQueue: 'test-queue' },
    )
      .then(first)
      .then(target)
      .commit();
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.timeTravel({ step: 'target', inputData: { value: 20 } })).resolves.toMatchObject({
      status: 'success',
      result: { value: 4 },
    });
    expect(signalWithStart).toHaveBeenCalledWith(
      'testWorkflow',
      expect.objectContaining({
        workflowId: 'test-run',
        workflowIdReusePolicy: 'ALLOW_DUPLICATE',
        workflowIdConflictPolicy: 'USE_EXISTING',
        signal: 'mastra.claimExecution',
        signalArgs: [expect.objectContaining({ action: 'claim', operation: 'timeTravel', token: expect.any(String) })],
        args: [
          expect.objectContaining({
            runId: 'test-run',
            inputData: { value: 1 },
            validateInputs: true,
            timeTravel: expect.objectContaining({
              inputData: { value: 20 },
              steps: ['target'],
              stepResults: expect.objectContaining({
                first: expect.objectContaining({
                  payload: { value: 1 },
                  output: { value: 20 },
                  startedAt: 1,
                  endedAt: 2,
                }),
              }),
            }),
            timeTravelLineage: {
              previousTemporalRunId: 'temporal-run-1',
              target: ['target'],
            },
          }),
        ],
      }),
    );
  });

  it('allows only one concurrent time-travel replacement of a suspended run', async () => {
    const schema = z.object({ value: z.number() });
    const target = createStep({
      id: 'target',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const sourceStatus = {
      status: 'suspended',
      input: { value: 1 },
      state: {},
      steps: {
        target: {
          status: 'suspended',
          payload: { value: 1 },
          suspendPayload: { reason: 'approval' },
          suspendedAt: 1,
        },
      },
      suspended: [['target']],
    };
    let claimToken: string | undefined;
    const signal = vi.fn(async (_signal: string, claim: { action: string; token: string }) => {
      if (claim.action === 'claim') {
        claimToken ??= claim.token;
      } else if (claimToken === claim.token) {
        claimToken = undefined;
      }
    });
    const sourceHandle = {
      query: vi.fn(async (query: string) =>
        query === 'mastra.status'
          ? sourceStatus
          : claimToken
            ? { operation: 'timeTravel', token: claimToken }
            : undefined,
      ),
      describe: vi.fn().mockResolvedValue({ runId: 'temporal-run-1' }),
      signal,
    };
    const replacementHandle = {
      result: vi.fn().mockResolvedValue({ status: 'success', input: { value: 1 }, state: {}, steps: {}, result: {} }),
      query: vi.fn(),
    };
    const start = vi
      .fn()
      .mockRejectedValueOnce(
        Object.assign(new Error('Workflow execution already started'), {
          name: 'WorkflowExecutionAlreadyStartedError',
        }),
      )
      .mockResolvedValue(replacementHandle);
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      {
        client: { workflow: { getHandle: vi.fn().mockReturnValue(sourceHandle), start } } as unknown as Client,
        taskQueue: 'test-queue',
      },
    )
      .then(target)
      .commit();
    const run = await workflow.createRun({ runId: 'test-run' });

    const results = await Promise.allSettled([run.timeTravel({ step: 'target' }), run.timeTravel({ step: 'target' })]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({ message: expect.stringContaining('already claimed') }),
      }),
    ]);
    expect(signal).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenCalledTimes(2);
    expect(start).toHaveBeenNthCalledWith(
      1,
      'testWorkflow',
      expect.objectContaining({
        workflowIdReusePolicy: 'ALLOW_DUPLICATE',
        workflowIdConflictPolicy: 'TERMINATE_EXISTING',
      }),
    );
    expect(start).toHaveBeenNthCalledWith(
      2,
      'testWorkflow',
      expect.objectContaining({ workflowIdReusePolicy: 'TERMINATE_IF_RUNNING' }),
    );
  });

  it('allows only one concurrent time-travel replacement of a completed run', async () => {
    const schema = z.object({ value: z.number() });
    const target = createStep({
      id: 'target',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const sourceStatus = {
      status: 'success',
      input: { value: 1 },
      state: {},
      steps: {
        target: { status: 'success', payload: { value: 1 }, output: { value: 2 }, startedAt: 1, endedAt: 2 },
      },
      result: { value: 2 },
    };
    const sourceHandle = {
      query: vi.fn().mockResolvedValue(sourceStatus),
      describe: vi.fn().mockResolvedValue({ runId: 'temporal-run-1' }),
    };
    let claimToken: string | undefined;
    const replacementHandle = {
      result: vi.fn().mockResolvedValue({ status: 'success', input: { value: 1 }, state: {}, steps: {}, result: {} }),
      query: vi
        .fn()
        .mockImplementation(async () => (claimToken ? { operation: 'timeTravel', token: claimToken } : undefined)),
    };
    const signalWithStart = vi.fn().mockImplementation(async (_workflowType, options) => {
      claimToken ??= options.signalArgs[0].token;
      return replacementHandle;
    });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      {
        client: {
          workflow: { getHandle: vi.fn().mockReturnValue(sourceHandle), signalWithStart },
        } as unknown as Client,
        taskQueue: 'test-queue',
      },
    )
      .then(target)
      .commit();
    const run = await workflow.createRun({ runId: 'test-run' });

    const results = await Promise.allSettled([run.timeTravel({ step: 'target' }), run.timeTravel({ step: 'target' })]);

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter(result => result.status === 'rejected')).toEqual([
      expect.objectContaining({
        reason: expect.objectContaining({ message: expect.stringContaining('already claimed') }),
      }),
    ]);
    expect(signalWithStart).toHaveBeenCalledTimes(2);
  });

  it('restores source request context for time travel, lets callers override it, and drops stale auth tokens', async () => {
    const schema = z.object({ value: z.number() });
    const target = createStep({
      id: 'target',
      inputSchema: schema,
      outputSchema: schema,
      execute: async ({ inputData }) => inputData,
    });
    const sourceStatus = {
      status: 'success',
      input: { value: 1 },
      state: {},
      requestContext: {
        tenant: 'source-tenant',
        region: 'source-region',
        [MASTRA_AUTH_TOKEN_KEY]: 'stale-token',
      },
      steps: {
        target: { status: 'success', payload: { value: 1 }, output: { value: 2 }, startedAt: 1, endedAt: 2 },
      },
      result: { value: 2 },
    };
    const sourceHandle = {
      query: vi.fn().mockResolvedValue(sourceStatus),
      describe: vi.fn().mockResolvedValue({ runId: 'temporal-run-1' }),
    };
    const replacementHandle = {
      result: vi.fn().mockResolvedValue({ status: 'success', input: { value: 1 }, state: {}, steps: {}, result: {} }),
      query: vi.fn(),
    };
    const signalWithStart = vi.fn().mockImplementation(async (_workflowType, options) => {
      replacementHandle.query.mockResolvedValue({ operation: 'timeTravel', token: options.signalArgs[0].token });
      return replacementHandle;
    });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      {
        client: {
          workflow: { getHandle: vi.fn().mockReturnValue(sourceHandle), signalWithStart },
        } as unknown as Client,
        taskQueue: 'test-queue',
      },
    )
      .then(target)
      .commit();
    const run = await workflow.createRun({ runId: 'test-run' });
    const requestContext = new RequestContext<unknown>();
    requestContext.set('tenant', 'caller-tenant');
    requestContext.set('request', 'live-request');
    requestContext.set(MASTRA_AUTH_TOKEN_KEY, 'live-token');

    await run.timeTravel({ step: 'target', requestContext });

    expect(signalWithStart).toHaveBeenCalledWith(
      'testWorkflow',
      expect.objectContaining({
        args: [
          expect.objectContaining({
            requestContext: {
              tenant: 'caller-tenant',
              region: 'source-region',
              request: 'live-request',
              [MASTRA_AUTH_TOKEN_KEY]: 'live-token',
            },
          }),
        ],
      }),
    );
  });

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
    let executionClaim: { operation: 'resume'; token: string; stepId: string } | undefined;
    const query = vi
      .fn()
      .mockImplementation(async name => (name === 'mastra.executionClaim' ? executionClaim : status));
    const signal = vi.fn().mockImplementation(async (name, payload) => {
      if (name === 'mastra.claimExecution') {
        if (payload.action === 'claim') {
          executionClaim ??= { operation: 'resume', token: payload.token, stepId: payload.target.step };
        } else if (executionClaim?.token === payload.token) {
          executionClaim = undefined;
        }
        return;
      }
      executionClaim = undefined;
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
        input: { value: 1 },
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
        input: { value: 1 },
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
        input: { value: 1 },
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
    expect(signal.mock.calls.filter(([name]) => name === 'mastra.resume')).toEqual([
      ['mastra.resume', { step: 'firstApproval', resumeData: { approved: true }, claimToken: expect.any(String) }],
      ['mastra.resume', { step: 'secondApproval', resumeData: { approved: true }, claimToken: expect.any(String) }],
    ]);
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
    let executionClaim: { operation: 'resume'; token: string; stepId: string } | undefined;
    const signal = vi.fn().mockImplementation(async (name, payload) => {
      if (name === 'mastra.claimExecution') {
        executionClaim = { operation: 'resume', token: payload.token, stepId: payload.target.step };
      }
    });
    const query = vi.fn().mockImplementation(async name => {
      if (name === 'mastra.executionClaim') return executionClaim;
      if (query.mock.calls.filter(([queryName]) => queryName === 'mastra.status').length === 1) return suspended;
      throw queryError;
    });
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
    expect(signal.mock.calls.filter(([name]) => name === 'mastra.resume')).toHaveLength(1);
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
        input: { value: 1 },
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
    let executionClaim: { operation: 'resume'; token: string; stepId: string } | undefined;
    const signal = vi.fn().mockImplementation(async (name, payload) => {
      if (name === 'mastra.claimExecution') {
        executionClaim = { operation: 'resume', token: payload.token, stepId: payload.target.step };
      }
    });
    const query = vi.fn().mockImplementation(async name =>
      name === 'mastra.executionClaim'
        ? executionClaim
        : {
            status: 'suspended',
            steps: { approval: { status: 'suspended', suspendedAt: 1 } },
            suspended: [['approval']],
          },
    );
    const getHandle = vi.fn().mockReturnValue({ signal, query });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.object({ value: z.number() }), outputSchema: z.unknown() },
      { client: { workflow: { getHandle } } as unknown as Client, taskQueue: 'test-queue' },
    );
    const run = await workflow.createRun({ runId: 'test-run' });

    await expect(run.resumeAsync({ step: 'approval', resumeData: { approved: true } })).resolves.toEqual({
      runId: 'test-run',
    });

    expect(getHandle).toHaveBeenCalledWith('test-run');
    expect(signal).toHaveBeenCalledWith('mastra.resume', {
      step: 'approval',
      resumeData: { approved: true },
      claimToken: expect.any(String),
    });
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
      input: { value: 1 },
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
      expect(result.steps).toEqual({ input: { value: 1 } });
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
      let executionClaim: { operation: 'resume'; token: string; stepId: string } | undefined;
      const signal = vi.fn().mockImplementation(async (name, payload) => {
        if (name === 'mastra.claimExecution') {
          executionClaim = { operation: 'resume', token: payload.token, stepId: payload.target.step };
        }
      });
      const query = vi.fn().mockImplementation(async name =>
        name === 'mastra.executionClaim'
          ? executionClaim
          : {
              status: 'suspended',
              steps: { approval: { status: 'suspended', suspendedAt: 1 } },
              suspended: [['approval']],
            },
      );
      const getHandle = vi.fn().mockReturnValue({ signal, query, result: vi.fn().mockRejectedValue(failure) });
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
      expect(signal).toHaveBeenCalledWith('mastra.resume', {
        step: 'approval',
        resumeData: { approved: true },
        claimToken: expect.any(String),
      });
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
        input: { value: 1 },
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
        input: { value: 1 },
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

describe('TemporalRun failed runs', () => {
  // #28754: start() returned every failed run as `failed` with `steps: {}` and Temporal's
  // WorkflowFailedError, because the Workflow dropped its step outputs when a step threw and the
  // Activity failure kept only the error's class name and message.
  it('returns the same success, failed and tripwire results as a local run', async () => {
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

         export const succeeding = createWorkflow({ id: 'succeeding', inputSchema: Value }).then(addOne).commit();
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
        succeeding: createTemporalWorkflow({ id: 'succeeding', inputSchema }).then(addOne).commit(),
        failing: createTemporalWorkflow({ id: 'failing', inputSchema }).then(addOne).then(fail).commit(),
        parallel: createTemporalWorkflow({ id: 'parallel', inputSchema }).parallel([addOne, fail]).commit(),
        tripwire: createTemporalWorkflow({ id: 'tripwire', inputSchema }).then(guard).commit(),
      };
      // Step ids to statuses.
      const statuses = (steps: Record<string, unknown>) =>
        Object.fromEntries(
          Object.entries(steps).map(([stepId, step]) => [stepId, (step as { status?: string }).status]),
        );
      // Fails the test if a fixture stops failing, which would make both runs succeed alike.
      const expectedStatus = {
        succeeding: 'success',
        failing: 'failed',
        parallel: 'failed',
        tripwire: 'tripwire',
      } as const;

      for (const id of ['succeeding', 'failing', 'parallel', 'tripwire'] as const) {
        const expected = await (await local[id]!.createRun()).start({ inputData: { value: 5 } });
        const actual = await (await temporal[id].createRun()).start({ inputData: { value: 5 } });

        expect(expected.status).toBe(expectedStatus[id]);
        expect(statuses(actual.steps)).toEqual(statuses(expected.steps));
        expect(actual.status).toBe(expected.status);
        // #29502: a local run keeps the start input under `steps.input`.
        expect(expected.steps.input).toEqual({ value: 5 });
        expect(actual.steps.input).toEqual(expected.steps.input);
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
});
