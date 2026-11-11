import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../events/event-emitter';
import type { PubSub } from '../events/pubsub';
import { UnixSocketPubSub } from '../events/unix-socket-pubsub';
import { Mastra } from '../mastra';
import { MockStore } from '../storage/mock';
import { createWorkflow } from './create';
import { createWorkflow as createEventedWorkflow, createStep as createEventedStep } from './evented';
import { createFlakyPublishPubSub } from './evented/test-utils/flaky-publish-pubsub';
import type { WorkflowRunStatus } from './types';
import { createStep } from './workflow';

// Background jobs dispatched with `run.startAsync()` rely on onFinish/onError for completion
// logging and failure alerts. On the evented engine startAsync() only published `workflow.start`
// and returned, so the hooks `start()` runs once the worker reports the finish never ran at all.
// These tests pin the hook contract across both engines. (#29391)

const engines = [
  ['default', createWorkflow, createStep],
  ['evented', createEventedWorkflow, createEventedStep],
] as const;

const methods = ['start', 'startAsync'] as const;

type Outcome = 'success' | 'failed' | 'suspended';

const outcomes: ReadonlyArray<readonly [Outcome, readonly string[]]> = [
  ['success', ['start', 'finish:success:done']],
  ['failed', ['start', 'finish:failed:job crashed', 'error:failed:job crashed']],
  ['suspended', ['start', 'finish:suspended']],
];

const HOOK_TIMEOUT_MS = 3_000;
// Long enough for a duplicate finish event or a second hook call to land after the first one.
const SETTLE_MS = 200;

const jobOutput = z.object({ ok: z.string() });

// The default engine hands hooks a serialized error ({ message, ... }); the evented engine hydrates
// a real Error, so read the message off either shape.
const errorMessage = (error: unknown) =>
  typeof error === 'object' && error !== null && 'message' in error ? String(error.message) : String(error);

describe.each(engines)('%s engine: lifecycle callbacks for background runs', (engine, makeWorkflow, makeStep) => {
  const cleanups: Array<() => Promise<void>> = [];

  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()?.();
  });

  /** `stepGate` holds the step open; `finishGate` holds onFinish open after it records the finish. */
  const setup = async (
    workflowId: string,
    outcome: Outcome,
    gates: { stepGate?: Promise<void>; finishGate?: Promise<void> } = {},
  ) => {
    const hooks: string[] = [];
    const executions = { count: 0 };

    const job = (makeStep as typeof createStep)({
      id: 'job',
      inputSchema: z.object({ attempt: z.number() }),
      outputSchema: jobOutput,
      resumeSchema: z.object({ approved: z.boolean() }),
      execute: async ({ resumeData, suspend, abortSignal }) => {
        executions.count++;
        if (gates.stepGate) {
          const aborted = new Promise<void>(resolve => abortSignal.addEventListener('abort', () => resolve()));
          await Promise.race([gates.stepGate, aborted]);
        }
        if (outcome === 'failed') throw new Error('job crashed');
        if (outcome === 'suspended' && !resumeData) return suspend({ reason: 'needs approval' });
        return { ok: 'done' };
      },
    });

    const workflow = (makeWorkflow as typeof createWorkflow)({
      id: workflowId,
      inputSchema: z.object({ attempt: z.number() }),
      outputSchema: jobOutput,
      options: {
        onStart: () => {
          hooks.push('start');
        },
        onFinish: async result => {
          const detail =
            result.status === 'success'
              ? `:${jobOutput.safeParse(result.result).data?.ok}`
              : result.status === 'failed'
                ? `:${errorMessage(result.error)}`
                : '';
          hooks.push(`finish:${result.status}${detail}`);
          if (gates.finishGate) {
            await gates.finishGate;
            hooks.push('finish-callback-done');
          }
        },
        onError: result => {
          hooks.push(`error:${result.status}:${errorMessage(result.error)}`);
        },
      },
    })
      .then(job)
      .commit();

    const storage = new MockStore();
    const pubsub = new EventEmitterPubSub();
    const mastra = new Mastra({ logger: false, storage, pubsub, workflows: { [workflowId]: workflow } });
    if (engine === 'evented') {
      await mastra.startWorkers();
      cleanups.push(() => mastra.stopWorkers());
    }

    const registered = mastra.getWorkflow(workflowId);
    return { hooks, executions, job, workflow: registered, pubsub, mastra };
  };

  const waitForStatus = async (
    workflow: Awaited<ReturnType<typeof setup>>['workflow'],
    runId: string,
    status: WorkflowRunStatus,
  ) => {
    await vi.waitFor(
      async () => {
        const run = await workflow.getWorkflowRunById(runId);
        expect(run?.status).toBe(status);
      },
      { timeout: HOOK_TIMEOUT_MS, interval: 20 },
    );
  };

  describe.each(methods)('%s()', method => {
    it.each(outcomes)(
      'calls the workflow hooks once when the run ends %s',
      async (outcome, expectedHooks) => {
        const workflowId = `background-hooks-${engine}-${method}-${outcome}`;
        const { hooks, executions, workflow, pubsub } = await setup(workflowId, outcome);

        const run = await workflow.createRun();
        if (method === 'start') {
          const result = await run.start({ inputData: { attempt: 1 } });
          expect(result.status).toBe(outcome);
        } else {
          const { runId } = await run.startAsync({ inputData: { attempt: 1 } });
          expect(runId).toBe(run.runId);
        }

        await waitForStatus(workflow, run.runId, outcome);
        await vi.waitFor(() => expect(hooks).toEqual(expectedHooks), { timeout: HOOK_TIMEOUT_MS, interval: 20 });

        await pubsub.flush();
        await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
        expect(hooks).toEqual(expectedHooks);
        expect(executions.count).toBe(1);
      },
      15_000,
    );
  });

  it('calls onFinish once for the suspension and once for the resumed run after startAsync()', async () => {
    const workflowId = `background-hooks-${engine}-resume`;
    const { hooks, executions, job, workflow, pubsub } = await setup(workflowId, 'suspended');

    const run = await workflow.createRun();
    await run.startAsync({ inputData: { attempt: 1 } });
    await waitForStatus(workflow, run.runId, 'suspended');
    await vi.waitFor(() => expect(hooks).toEqual(['start', 'finish:suspended']), {
      timeout: HOOK_TIMEOUT_MS,
      interval: 20,
    });

    const resumed = await run.resume({ step: job, resumeData: { approved: true } });
    expect(resumed.status).toBe('success');

    await pubsub.flush();
    await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
    // The background waiter must stop at the suspension; it must not also report the resumed run.
    expect(hooks).toEqual(['start', 'finish:suspended', 'finish:success:done']);
    expect(executions.count).toBe(2);
  }, 15_000);

  it('returns from startAsync() while the job is still running, then reports the finish', async () => {
    let releaseStep!: () => void;
    const stepGate = new Promise<void>(resolve => (releaseStep = resolve));
    const workflowId = `background-hooks-${engine}-gated-step`;
    const { hooks, executions, workflow } = await setup(workflowId, 'success', { stepGate });

    const run = await workflow.createRun();
    await run.startAsync({ inputData: { attempt: 1 } });
    await vi.waitFor(() => expect(executions.count).toBe(1), { timeout: HOOK_TIMEOUT_MS, interval: 20 });
    expect(hooks).toEqual(['start']);
    expect((await workflow.getWorkflowRunById(run.runId))?.status).toBe('running');

    releaseStep();
    await waitForStatus(workflow, run.runId, 'success');
    await vi.waitFor(() => expect(hooks).toEqual(['start', 'finish:success:done']), {
      timeout: HOOK_TIMEOUT_MS,
      interval: 20,
    });
  }, 15_000);

  it('calls onFinish once with canceled, and not onError, when a startAsync() run is canceled', async () => {
    const stepGate = new Promise<void>(() => {});
    const workflowId = `background-hooks-${engine}-cancel`;
    const { hooks, executions, workflow, pubsub } = await setup(workflowId, 'success', { stepGate });

    const run = await workflow.createRun();
    await run.startAsync({ inputData: { attempt: 1 } });
    await vi.waitFor(() => expect(executions.count).toBe(1), { timeout: HOOK_TIMEOUT_MS, interval: 20 });
    await run.cancel();

    await waitForStatus(workflow, run.runId, 'canceled');
    await vi.waitFor(() => expect(hooks).toEqual(['start', 'finish:canceled']), {
      timeout: HOOK_TIMEOUT_MS,
      interval: 20,
    });
    await pubsub.flush();
    await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
    expect(hooks).toEqual(['start', 'finish:canceled']);
  }, 15_000);

  it('skips the completion hooks when startAsync() runs one step at a time', async () => {
    const workflowId = `background-hooks-${engine}-per-step`;
    const { hooks, executions, workflow, pubsub } = await setup(workflowId, 'success');

    const run = await workflow.createRun();
    await run.startAsync({ inputData: { attempt: 1 }, perStep: true });
    await vi.waitFor(() => expect(executions.count).toBe(1), { timeout: HOOK_TIMEOUT_MS, interval: 20 });
    await pubsub.flush();
    await new Promise(resolve => setTimeout(resolve, SETTLE_MS));

    // Same as start({ perStep: true }): a paused run has not finished, so onFinish waits.
    const reference = await (await workflow.createRun()).start({ inputData: { attempt: 2 }, perStep: true });
    await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
    expect(reference.status).toBe('paused');
    expect(hooks).toEqual(['start', 'start']);
  }, 15_000);

  // Mastra.shutdown() drains in-flight evented runs. A default-engine run executes in-process and is
  // not tracked, so its onFinish settles on its own and shutdown does not wait for it — pre-existing,
  // out of scope for #29391.
  const itEventedOnly = engine === 'evented' ? it : it.skip;

  itEventedOnly(
    'lets shutdown() wait for an async onFinish of a startAsync() run',
    async () => {
      let releaseFinish!: () => void;
      const finishGate = new Promise<void>(resolve => (releaseFinish = resolve));
      const workflowId = `background-hooks-${engine}-shutdown`;
      const { hooks, workflow, mastra } = await setup(workflowId, 'success', { finishGate });

      const run = await workflow.createRun();
      await run.startAsync({ inputData: { attempt: 1 } });
      await vi.waitFor(() => expect(hooks).toEqual(['start', 'finish:success:done']), {
        timeout: HOOK_TIMEOUT_MS,
        interval: 20,
      });

      const shutdown = mastra.shutdown({ drainTimeout: 5_000 }).then(() => hooks.push('shutdown-done'));
      await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
      releaseFinish();
      await shutdown;

      expect(hooks).toEqual(['start', 'finish:success:done', 'finish-callback-done', 'shutdown-done']);
    },
    15_000,
  );
});

describe('evented engine: startAsync() hooks with workers on another instance', () => {
  const cleanups: Array<() => Promise<void> | void> = [];

  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()?.();
  });

  const buildWorkflow = (workflowId: string, hooks: string[], outcome: 'success' | 'failed') =>
    createEventedWorkflow({
      id: workflowId,
      inputSchema: z.object({}),
      outputSchema: jobOutput,
      options: {
        onStart: () => {
          hooks.push('start');
        },
        onFinish: result => {
          hooks.push(`finish:${result.status}`);
        },
        onError: result => {
          hooks.push(`error:${errorMessage(result.error)}`);
        },
      },
    })
      .then(
        createEventedStep({
          id: 'job',
          inputSchema: z.object({}),
          outputSchema: jobOutput,
          execute: async () => {
            if (outcome === 'failed') throw new Error('job crashed');
            return { ok: 'done' };
          },
        }),
      )
      .commit();

  const waitForStatus = async (mastra: Mastra, workflowId: string, runId: string, status: WorkflowRunStatus) => {
    await vi.waitFor(
      async () => expect((await mastra.getWorkflow(workflowId).getWorkflowRunById(runId))?.status).toBe(status),
      { timeout: HOOK_TIMEOUT_MS, interval: 20 },
    );
  };

  it.each([
    ['success', ['start', 'finish:success']],
    ['failed', ['start', 'finish:failed', 'error:job crashed']],
  ] as const)(
    'runs the %s hooks once, on the caller that started the run',
    async (outcome, expectedHooks) => {
      // A web process dispatches with startAsync(); a worker process with its own Mastra runs the
      // steps. They share storage and a socket-based pubsub that serializes every event.
      const dir = mkdtempSync(join(tmpdir(), 'mastra-start-async-hooks-'));
      const socketPath = join(dir, 'pubsub.sock');
      const workerPubsub = new UnixSocketPubSub(socketPath);
      const callerPubsub = new UnixSocketPubSub(socketPath);
      cleanups.push(async () => {
        await callerPubsub.close();
        await workerPubsub.close();
        rmSync(dir, { recursive: true, force: true });
      });

      const workflowId = `cross-instance-hooks-${outcome}`;
      const storage = new MockStore();
      const callerHooks: string[] = [];
      const workerHooks: string[] = [];
      const worker = new Mastra({
        logger: false,
        storage,
        pubsub: workerPubsub,
        workflows: { [workflowId]: buildWorkflow(workflowId, workerHooks, outcome) },
      });
      const caller = new Mastra({
        logger: false,
        storage,
        pubsub: callerPubsub,
        workflows: { [workflowId]: buildWorkflow(workflowId, callerHooks, outcome) },
      });
      await worker.startWorkers();
      cleanups.push(() => worker.stopWorkers());

      const run = await caller.getWorkflow(workflowId).createRun();
      await run.startAsync({ inputData: {} });

      await waitForStatus(caller, workflowId, run.runId, outcome);
      await vi.waitFor(() => expect(callerHooks).toEqual(expectedHooks), { timeout: HOOK_TIMEOUT_MS, interval: 20 });
      await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
      expect(callerHooks).toEqual(expectedHooks);
      expect(workerHooks).toEqual([]);
    },
    15_000,
  );

  it('rejects startAsync() and leaves no finish listener behind when workflow.start cannot be published', async () => {
    const workflowId = 'dispatch-failure-hooks';
    const hooks: string[] = [];
    const inner: PubSub = new EventEmitterPubSub();
    const { pubsub, rejected } = createFlakyPublishPubSub(inner, { 'workflow.start': 1 });
    const mastra = new Mastra({
      logger: false,
      storage: new MockStore(),
      pubsub,
      workflows: { [workflowId]: buildWorkflow(workflowId, hooks, 'success') },
    });
    await mastra.startWorkers();
    cleanups.push(() => mastra.stopWorkers());

    const run = await mastra.getWorkflow(workflowId).createRun();
    await expect(run.startAsync({ inputData: {} })).rejects.toThrow('injected publish failure for workflow.start');
    expect(rejected['workflow.start']).toBe(1);

    // A finish listener left subscribed would run the hooks for this finish event.
    await inner.publish('workflows-finish', {
      type: 'workflow.end',
      runId: run.runId,
      data: {
        workflowId,
        runId: run.runId,
        prevResult: { status: 'success', output: { ok: 'done' } },
        stepResults: {},
      },
    });
    await new Promise(resolve => setTimeout(resolve, SETTLE_MS));
    expect(hooks).toEqual(['start']);

    // Nothing is left for shutdown() to drain.
    const startedAt = Date.now();
    await mastra.shutdown({ drainTimeout: 5_000 });
    expect(Date.now() - startedAt).toBeLessThan(2_000);
  }, 15_000);
});
