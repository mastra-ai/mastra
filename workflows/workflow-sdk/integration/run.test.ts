import { describe, expect, it } from 'vitest';
import { resumeHook } from 'workflow/api';
import type { WorkflowSdkRun } from '../src/run';
import { readSdkRunId } from '../src/snapshot';
import { suspendToken } from '../src/workflows/walker';
import {
  chainWorkflow,
  failingWorkflow,
  mastra,
  slowStepObserved,
  slowWorkflow,
  stateWorkflow,
  suspendWorkflow,
} from './defs';

/**
 * Tests of the surface consumers actually touch: `workflow.createRun()` and the
 * `Run` methods, rather than the raw `start(mastraRunner, ...)` path exercised
 * in `workflows.test.ts`.
 */

describe('WorkflowSdkRun#start', () => {
  it('returns a Mastra WorkflowResult on success', async () => {
    const run = await chainWorkflow.createRun();
    const result = await run.start({ inputData: { value: 1 } });

    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.result).toEqual({ value: 4 });
    expect(result.input).toEqual({ value: 1 });
    expect(result.steps.increment).toMatchObject({ status: 'success' });
    expect(result.steps.double).toMatchObject({ status: 'success' });
  });

  it('surfaces a thrown step error as a failed result with a real Error', async () => {
    const run = await failingWorkflow.createRun();
    const result = await run.start({ inputData: { value: 1 } });

    expect(result.status).toBe('failed');
    if (result.status !== 'failed') return;
    expect(result.error).toBeInstanceOf(Error);
    expect(result.error.message).toBe('step blew up');
  });

  it('only includes state when outputOptions.includeState is set', async () => {
    const withoutState = await (
      await stateWorkflow.createRun()
    ).start({
      inputData: { value: 3 },
      initialState: { seen: 0 },
    });
    expect(withoutState.state).toBeUndefined();

    const withState = await (
      await stateWorkflow.createRun()
    ).start({
      inputData: { value: 3 },
      initialState: { seen: 0 },
      outputOptions: { includeState: true },
    });
    expect(withState.state).toEqual({ seen: 3 });
  });
});

describe('WorkflowSdkRun unsupported APIs', () => {
  it('throws a clear error naming this package for each unsupported method', async () => {
    const run = await chainWorkflow.createRun();

    expect(() => run.streamLegacy()).toThrow('streamLegacy() is not yet supported by @mastra/workflow-sdk.');
  });
});

describe('WorkflowSdkRun suspend and resume', () => {
  it('returns a suspended result naming the parked step', async () => {
    const run = await suspendWorkflow.createRun();
    const result = await run.start({ inputData: { value: 1 } });

    expect(result.status).toBe('suspended');
    if (result.status !== 'suspended') return;
    expect(result.suspended).toEqual([['approval']]);
    expect(result.suspendPayload).toEqual({ question: 'Approve 2?' });

    // Release the hook so the run does not linger for the rest of the suite.
    await resumeHook(suspendToken(run.runId, 'approval'), { approved: true });
  });

  it('continues the run when resumed through the Run API', async () => {
    const run = await suspendWorkflow.createRun();
    const suspended = await run.start({ inputData: { value: 1 } });
    expect(suspended.status).toBe('suspended');

    const resumed = await run.resume({ step: 'approval', resumeData: { approved: true } });

    expect(resumed.status).toBe('success');
    if (resumed.status !== 'success') return;
    expect(resumed.result).toEqual({ approved: true, value: 2 });
  });
});

describe('WorkflowSdkRun resuming from another process', () => {
  /**
   * Drops the workflow's in-memory handle on a run, so the next `createRun()`
   * with the same id builds a `Run` that has never seen it.
   *
   * That is the state a second process is in: same workflow definitions, same
   * storage, no memory of the run. Everything it needs has to come off the
   * stored snapshot.
   */
  function forgetRun(workflow: unknown, runId: string) {
    (workflow as { runs: Map<string, unknown> }).runs.delete(runId);
  }

  async function loadSnapshot(workflowName: string, runId: string) {
    const store = await mastra.getStorage()!.getStore('workflows');
    return store!.loadWorkflowSnapshot({ workflowName, runId });
  }

  /**
   * Core's fluent builders (`.then()`, `.commit()`) are typed as returning the
   * base `Workflow`, so a committed workflow hands back a `Run` rather than a
   * `WorkflowSdkRun`. The instance is the subclass; only the static type is
   * widened.
   */
  const sdkRunIdOf = (run: unknown) => (run as WorkflowSdkRun).sdkRunId;

  it('persists a pending snapshot at createRun so the run is visible before it starts', async () => {
    const run = await chainWorkflow.createRun();

    // The default engine writes a `pending` row at createRun time so pollers
    // and the playground can see the run before `start()` is called.
    const snapshot = await loadSnapshot('chain-workflow', run.runId);
    expect(snapshot?.status).toBe('pending');

    const stored = await chainWorkflow.getWorkflowRunById(run.runId);
    expect(stored?.status).toBe('pending');
    expect(stored?.isFromInMemory).toBeFalsy();
  });

  it('records the Workflow SDK run id on the snapshot when the run starts', async () => {
    const run = await chainWorkflow.createRun();
    await run.start({ inputData: { value: 1 } });

    const snapshot = await loadSnapshot('chain-workflow', run.runId);
    expect(readSdkRunId(snapshot)).toBe(sdkRunIdOf(run));
  });

  it('leaves the stored snapshot in a terminal state once the run settles', async () => {
    const run = await chainWorkflow.createRun();
    const result = await run.start({ inputData: { value: 1 } });
    expect(result.status).toBe('success');

    // Steps persist `running` as they go and nothing runs after the walk, so
    // the run's own last write has to be the terminal one. Otherwise a finished
    // run reads as still running from `getWorkflowRunById()` and the playground
    // — which is what happens if the walker stops issuing its `finalize` op.
    const snapshot = await loadSnapshot('chain-workflow', run.runId);
    expect(snapshot?.status).toBe('success');
    // A poller reads the output from here, not from the resolved promise it
    // never held, so a terminal status without a result is only half a fix.
    expect(snapshot?.result).toEqual(result.status === 'success' ? result.result : undefined);
  });

  it('names the waiting step on the snapshot while a run is suspended', async () => {
    const run = await suspendWorkflow.createRun();
    const suspended = await run.start({ inputData: { value: 1 } });
    expect(suspended.status).toBe('suspended');

    // "Suspended" on its own is not actionable: a resume needs the step id, and
    // this is where another process reads it from.
    const snapshot = await loadSnapshot('suspend-workflow', run.runId);
    expect(snapshot?.status).toBe('suspended');
    expect(Object.keys(snapshot?.suspendedPaths ?? {})).toEqual(['approval']);
  });

  it('resumes and returns the final result from a cold Run', async () => {
    const run = await suspendWorkflow.createRun();
    const suspended = await run.start({ inputData: { value: 1 } });
    expect(suspended.status).toBe('suspended');

    forgetRun(suspendWorkflow, run.runId);
    const coldRun = await suspendWorkflow.createRun({ runId: run.runId });
    expect(coldRun).not.toBe(run);
    expect(sdkRunIdOf(coldRun)).toBeUndefined();
    // createRun found the stored run and picked up its actual status.
    expect(coldRun.workflowRunStatus).toBe('suspended');

    const resumed = await coldRun.resume({ step: 'approval', resumeData: { approved: true } });

    expect(resumed.status).toBe('success');
    if (resumed.status !== 'success') return;
    expect(resumed.result).toEqual({ approved: true, value: 2 });
    // The mapping was recovered from storage rather than remembered.
    expect(sdkRunIdOf(coldRun)).toBe(sdkRunIdOf(run));
  });

  it('explains what is missing when there is no storage to recover from', async () => {
    // createRun persists a pending snapshot, so a genuine snapshot miss now
    // requires dropping the stored row — the state a storage-free or wiped
    // deployment is in.
    const orphan = await stateWorkflow.createRun();
    const store = await mastra.getStorage()!.getStore('workflows');
    await store!.deleteWorkflowRunById({ runId: orphan.runId, workflowName: 'state-workflow' });

    await expect(orphan.resume({ step: 'write-state', resumeData: {} })).rejects.toThrow(
      /Workflow SDK run id is unknown/,
    );
  });
});

describe('WorkflowSdkRun external cancellation', () => {
  it('fires the in-flight step abort signal after run.cancel()', async () => {
    const run = await slowWorkflow.createRun();
    await run.startAsync({ inputData: { value: 1 } });

    // The step runs host-side in this process; wait until user code is
    // actually executing before cancelling.
    await expect.poll(() => slowStepObserved.started, { timeout: 10_000 }).toBe(true);

    await run.cancel();

    // The dispatcher polls the canceled snapshot marker while user code runs
    // and fires the local abort signal — the step's listener must observe it
    // well before its own 15s timer.
    await expect.poll(() => slowStepObserved.abortFired, { timeout: 5_000 }).toBe(true);

    const store = await mastra.getStorage()?.getStore('workflows');
    const snapshot = await store?.loadWorkflowSnapshot({ workflowName: slowWorkflow.id, runId: run.runId });
    expect(snapshot?.status).toBe('canceled');
  });
});

describe('WorkflowSdkRun#watch', () => {
  it('delivers Mastra workflow events to the callback', async () => {
    const run = await chainWorkflow.createRun();

    const seen: string[] = [];
    const started = run.start({ inputData: { value: 1 } });
    // `watch()` needs the run to exist, which `start()` establishes before it
    // begins reading the stream.
    await new Promise(resolve => setTimeout(resolve, 50));
    const unwatch = run.watch(event => seen.push(event.type));

    await started;
    await expect.poll(() => seen.includes('workflow-finish'), { timeout: 10_000 }).toBe(true);
    unwatch();
  });
});

describe('WorkflowSdkRun#stream', () => {
  it('emits step events and resolves the final result', async () => {
    const run = await chainWorkflow.createRun();
    const output = run.stream({ inputData: { value: 1 } });

    const types: string[] = [];
    for await (const event of output.fullStream) {
      types.push(event.type);
    }

    expect(types).toContain('workflow-start');
    expect(types).toContain('workflow-step-result');
    expect(types).toContain('workflow-finish');

    const result = await output.result;
    expect(result.status).toBe('success');
  });

  it('stays open across a suspension when closeOnSuspend is false', async () => {
    const run = await suspendWorkflow.createRun();
    const output = run.stream({ inputData: { value: 1 }, closeOnSuspend: false });

    const types: string[] = [];
    const consumed = (async () => {
      for await (const event of output.fullStream) {
        types.push(event.type);
      }
    })();

    // The stream must not settle on the suspension; resume through the hook the
    // walker parked on and let the run finish.
    await expect.poll(() => types.includes('workflow-step-suspended'), { timeout: 10_000 }).toBe(true);
    expect(types).not.toContain('workflow-finish');

    await resumeHook(suspendToken(run.runId, 'approval'), { approved: true });
    await consumed;

    expect(types).toContain('workflow-step-suspended');
    expect(types).toContain('workflow-finish');

    const result = await output.result;
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.result).toEqual({ approved: true, value: 2 });
  });
});

describe('WorkflowSdkRun#timeTravelStream', () => {
  it('streams the replacement run, bypassing steps before the target', async () => {
    const run = await chainWorkflow.createRun();
    const first = await run.start({ inputData: { value: 1 } });
    expect(first.status).toBe('success');

    const output = run.timeTravelStream({
      step: 'double',
      context: {
        increment: {
          payload: { value: 1 },
          startedAt: Date.now(),
          status: 'success',
          output: { value: 9 },
          endedAt: Date.now(),
        },
      },
    });

    const types: string[] = [];
    const startedSteps: string[] = [];
    for await (const event of output.fullStream) {
      types.push(event.type);
      if (event.type === 'workflow-step-start') {
        startedSteps.push((event.payload as { id?: string }).id ?? '');
      }
    }

    expect(types).toContain('workflow-start');
    expect(types).toContain('workflow-finish');
    // The bypassed step never executes, so only the target starts.
    expect(startedSteps).toEqual(['double']);

    const result = await output.result;
    expect(result.status).toBe('success');
    if (result.status !== 'success') return;
    expect(result.result).toEqual({ value: 18 });
    expect(result.steps.increment).toMatchObject({ status: 'success', output: { value: 9 } });
    expect(result.steps.double).toMatchObject({ status: 'success', output: { value: 18 } });
  });
});
