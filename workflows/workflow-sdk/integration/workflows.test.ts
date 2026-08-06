import { waitForHook, waitForSleep } from '@workflow/vitest';
import { describe, expect, it } from 'vitest';
import { getRun, resumeHook, start } from 'workflow/api';
import { MASTRA_EVENT_NAMESPACE } from '../src/constants';
import type { MastraRunnerResult } from '../src/types';
import { mastraRunner, suspendToken } from '../src/workflows/index';
import {
  branchWorkflow,
  chainWorkflow,
  failingWorkflow,
  foreachWorkflow,
  loopWorkflow,
  parallelWorkflow,
  sleepWorkflow,
  stateWorkflow,
  suspendWorkflow,
} from './defs';

/**
 * End-to-end tests against a real Workflow SDK runtime, driven through the
 * same `start()` entry point a consumer's app would use.
 *
 * They exercise the full round trip: a Mastra workflow's serialized graph goes
 * into the sandboxed runner, the runner calls back into `"use step"` functions
 * that run the real Mastra `execute` bodies, and the result comes back over the
 * Workflow SDK event stream.
 */

type AnyWorkflow = {
  id: string;
  serializedStepGraph: unknown;
  createRun: (options?: { runId?: string }) => Promise<{ runId: string }>;
};

/**
 * Starts a workflow the way `WorkflowSdkRun` does, but without going through the
 * Mastra `Run` wrapper, so a test can hold the Workflow SDK run handle directly.
 */
async function startWorkflow(workflow: unknown, inputData: unknown, runId = crypto.randomUUID()) {
  const wf = workflow as unknown as AnyWorkflow & { serializedStepGraph: unknown[] };
  return start(mastraRunner, [
    {
      workflowId: wf.id,
      runId,
      inputData,
      initialState: {},
      requestContext: [],
      serializedStepGraph: wf.serializedStepGraph,
      stepRetries: {},
    },
  ]);
}

describe('then-chain', () => {
  it('threads each step output into the next', async () => {
    const run = await startWorkflow(chainWorkflow, { value: 1 });
    const result = (await run.returnValue) as MastraRunnerResult;

    expect(result.status).toBe('success');
    // (1 + 1) * 2
    expect(result.result).toEqual({ value: 4 });
    expect(result.steps).toHaveProperty('increment');
    expect(result.steps).toHaveProperty('double');
  });
});

describe('parallel', () => {
  it('runs branches concurrently and keys results by step id', async () => {
    const run = await startWorkflow(parallelWorkflow, { value: 5 });
    const result = (await run.returnValue) as MastraRunnerResult;

    expect(result.status).toBe('success');
    expect(result.result).toEqual({
      'add-ten': { value: 15 },
      'add-twenty': { value: 25 },
    });
  });
});

describe('branch', () => {
  it('runs only the branch whose condition holds', async () => {
    const small = await startWorkflow(branchWorkflow, { value: 3 });
    const smallResult = (await small.returnValue) as MastraRunnerResult;
    expect(smallResult.status).toBe('success');
    expect(smallResult.result).toEqual({ 'mark-small': { label: 'small' } });

    const large = await startWorkflow(branchWorkflow, { value: 42 });
    const largeResult = (await large.returnValue) as MastraRunnerResult;
    expect(largeResult.status).toBe('success');
    expect(largeResult.result).toEqual({ 'mark-large': { label: 'large' } });
  });
});

describe('dountil', () => {
  it('repeats the step until the condition is met', async () => {
    const run = await startWorkflow(loopWorkflow, { value: 1 });
    const result = (await run.returnValue) as MastraRunnerResult;

    expect(result.status).toBe('success');
    expect(result.result).toEqual({ value: 5 });
  });
});

describe('foreach', () => {
  it('maps the step over the previous array output', async () => {
    const run = await startWorkflow(foreachWorkflow, { value: 4 });
    const result = (await run.returnValue) as MastraRunnerResult;

    expect(result.status).toBe('success');
    expect(result.result).toEqual([{ value: 1 }, { value: 4 }, { value: 9 }, { value: 16 }]);
  });
});

describe('state', () => {
  it('carries setState across steps', async () => {
    const run = await startWorkflow(stateWorkflow, { value: 7 });
    const result = (await run.returnValue) as MastraRunnerResult;

    expect(result.status).toBe('success');
    expect(result.result).toEqual({ seen: 7 });
    expect(result.state).toEqual({ seen: 7 });
  });
});

describe('sleep', () => {
  it('suspends on sleep and resumes when woken', async () => {
    const run = await startWorkflow(sleepWorkflow, { value: 1 });

    const sleepId = await waitForSleep(run);
    await getRun(run.runId).wakeUp({ correlationIds: [sleepId] });

    const result = (await run.returnValue) as MastraRunnerResult;
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ value: 4 });
  });
});

describe('suspend and resume', () => {
  it('parks on a hook and continues with the resume payload', async () => {
    const runId = crypto.randomUUID();
    const run = await startWorkflow(suspendWorkflow, { value: 1 }, runId);

    const token = suspendToken(runId, 'approval');
    const hook = await waitForHook(run, { token });
    expect(hook.token).toBe(token);

    await resumeHook(token, { approved: true });

    const result = (await run.returnValue) as MastraRunnerResult;
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ approved: true, value: 2 });
  });
});

describe('failure', () => {
  it('reports a thrown step error as a failed run rather than crashing', async () => {
    const run = await startWorkflow(failingWorkflow, { value: 1 });
    const result = (await run.returnValue) as MastraRunnerResult;

    expect(result.status).toBe('failed');
    expect(result.error?.message).toBe('step blew up');
  });
});

describe('event stream', () => {
  it('emits Mastra workflow events on the mastra:events namespace', async () => {
    const run = await startWorkflow(chainWorkflow, { value: 1 });

    const readable = getRun(run.runId).getReadable<{ type: string; payload: Record<string, unknown> }>({
      namespace: MASTRA_EVENT_NAMESPACE,
    });
    const seen: { type: string; payload: Record<string, unknown> }[] = [];
    const reader = readable.getReader();
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) seen.push(value);
        if (value?.type === 'workflow-finish') break;
      }
    } finally {
      reader.releaseLock();
      await readable.cancel().catch(() => {});
    }

    const types = seen.map(event => event.type);
    expect(types).toContain('workflow-start');
    expect(types).toContain('workflow-step-start');
    expect(types).toContain('workflow-step-result');
    expect(types).toContain('workflow-finish');

    const stepIds = seen.filter(event => event.type === 'workflow-step-result').map(event => event.payload.id);
    expect(stepIds).toEqual(['increment', 'double']);
  });
});
