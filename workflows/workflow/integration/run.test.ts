import { describe, expect, it } from 'vitest';
import { resumeHook } from 'workflow/api';
import { suspendToken } from '../src/workflows/walker';
import { chainWorkflow, failingWorkflow, stateWorkflow, suspendWorkflow } from './defs';

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
    const withoutState = await (await stateWorkflow.createRun()).start({
      inputData: { value: 3 },
      initialState: { seen: 0 },
    });
    expect(withoutState.state).toBeUndefined();

    const withState = await (await stateWorkflow.createRun()).start({
      inputData: { value: 3 },
      initialState: { seen: 0 },
      outputOptions: { includeState: true },
    });
    expect(withState.state).toEqual({ seen: 3 });
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
    await new Promise(resolve => setTimeout(resolve, 250));
    unwatch();

    expect(seen).toContain('workflow-finish');
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
});
