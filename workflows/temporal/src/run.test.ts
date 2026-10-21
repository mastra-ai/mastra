import { Mastra } from '@mastra/core/mastra';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '@mastra/core/request-context';
import { MockStore } from '@mastra/core/storage';
import { createStep } from '@mastra/core/workflows';
import type { Client } from '@temporalio/client';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { createWorkflow } from './workflow';

describe('TemporalRun', () => {
  it('persists a pending snapshot when creating a Temporal run', async () => {
    const storage = new MockStore();
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: z.unknown(), outputSchema: z.unknown() },
      { client: { workflow: {} } as unknown as Client, taskQueue: 'test-queue' },
    ).commit();
    new Mastra({ workflows: { workflow }, storage, logger: false });

    await workflow.createRun({ runId: 'test-run', resourceId: 'resource-1' });

    const runs = await workflow.listWorkflowRuns();
    expect(runs.runs).toHaveLength(1);
    expect(runs.runs[0]).toMatchObject({
      workflowName: 'test-workflow',
      runId: 'test-run',
      resourceId: 'resource-1',
      snapshot: {
        runId: 'test-run',
        status: 'pending',
        serializedStepGraph: expect.any(Array),
      },
    });
  });

  it('persists running and successful snapshots around Temporal execution', async () => {
    const storage = new MockStore();
    const result = {
      status: 'success',
      input: { value: 1 },
      result: { value: 2 },
      state: { seen: true },
      steps: {
        increment: {
          status: 'success',
          payload: { value: 1 },
          output: { value: 2 },
          startedAt: 1,
          endedAt: 2,
        },
      },
    };
    const handle = { result: vi.fn().mockResolvedValue(result) };
    const start = vi.fn().mockResolvedValue(handle);
    const schema = z.object({ value: z.number() });
    const step = createStep({
      id: 'increment',
      inputSchema: schema,
      outputSchema: schema,
      execute: async input => input.inputData,
    });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema, stateSchema: z.object({ seen: z.boolean() }) },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    )
      .then(step)
      .commit();
    new Mastra({ workflows: { workflow }, storage, logger: false });
    const run = await workflow.createRun({ runId: 'test-run', resourceId: 'resource-1' });

    const output = await run.start({ inputData: { value: 1 }, initialState: { seen: true } });

    expect(output).toEqual(result);
    const persisted = await workflow.getWorkflowRunById('test-run');
    expect(persisted).toMatchObject({
      workflowName: 'test-workflow',
      runId: 'test-run',
      resourceId: 'resource-1',
      status: 'success',
      result: { value: 2 },
      payload: { value: 1 },
      steps: {
        increment: {
          status: 'success',
          output: { value: 2 },
          payload: { value: 1 },
        },
      },
    });
  });

  it('persists a running snapshot before returning from startAsync', async () => {
    const storage = new MockStore();
    const start = vi.fn().mockResolvedValue({ result: vi.fn(() => new Promise(() => {})) });
    const schema = z.object({ value: z.number() });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    ).commit();
    new Mastra({ workflows: { workflow }, storage, logger: false });
    const run = await workflow.createRun({ runId: 'test-run', resourceId: 'resource-1' });

    await expect(run.startAsync({ inputData: { value: 1 } })).resolves.toEqual({ runId: 'test-run' });

    const persisted = await workflow.getWorkflowRunById('test-run');
    expect(persisted).toMatchObject({
      workflowName: 'test-workflow',
      runId: 'test-run',
      resourceId: 'resource-1',
      status: 'running',
      payload: { value: 1 },
    });
  });

  it('persists a failed snapshot and rethrows when startAsync dispatch fails', async () => {
    const storage = new MockStore();
    const error = new Error('Temporal service unavailable');
    const start = vi.fn().mockRejectedValue(error);
    const schema = z.object({ value: z.number() });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    ).commit();
    new Mastra({ workflows: { workflow }, storage, logger: false });
    const run = await workflow.createRun({ runId: 'test-run', resourceId: 'resource-1' });

    await expect(run.startAsync({ inputData: { value: 1 } })).rejects.toThrow(error);

    await expect(workflow.getWorkflowRunById('test-run')).resolves.toMatchObject({
      status: 'failed',
      payload: { value: 1 },
      error: { message: 'Temporal service unavailable' },
    });
  });

  it('projects the eventual startAsync result without blocking dispatch', async () => {
    const storage = new MockStore();
    let resolveResult!: (result: unknown) => void;
    const resultPromise = new Promise(resolve => {
      resolveResult = resolve;
    });
    const start = vi.fn().mockResolvedValue({ result: vi.fn(() => resultPromise) });
    const schema = z.object({ value: z.number() });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    ).commit();
    new Mastra({ workflows: { workflow }, storage, logger: false });
    const run = await workflow.createRun({ runId: 'test-run', resourceId: 'resource-1' });

    await expect(run.startAsync({ inputData: { value: 1 } })).resolves.toEqual({ runId: 'test-run' });
    await expect(workflow.getWorkflowRunById('test-run')).resolves.toMatchObject({ status: 'running' });

    resolveResult({
      status: 'success',
      input: { value: 1 },
      result: { value: 2 },
      state: { seen: true },
      steps: {
        increment: {
          status: 'success',
          payload: { value: 1 },
          output: { value: 2 },
          startedAt: 1,
          endedAt: 2,
        },
      },
    });
    await vi.waitFor(async () => {
      await expect(workflow.getWorkflowRunById('test-run')).resolves.toMatchObject({
        status: 'success',
        result: { value: 2 },
        steps: {
          increment: {
            status: 'success',
            payload: { value: 1 },
            output: { value: 2 },
          },
        },
      });
    });
  });

  it('persists and logs eventual startAsync failures', async () => {
    const storage = new MockStore();
    const error = new Error('Workflow execution failed');
    const start = vi.fn().mockResolvedValue({ result: vi.fn().mockRejectedValue(error) });
    const schema = z.object({ value: z.number() });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    ).commit();
    const mastra = new Mastra({ workflows: { workflow }, storage, logger: false });
    const logError = vi.fn();
    vi.spyOn(mastra, 'getLogger').mockReturnValue({ error: logError } as any);
    const run = await workflow.createRun({ runId: 'test-run', resourceId: 'resource-1' });

    await expect(run.startAsync({ inputData: { value: 1 } })).resolves.toEqual({ runId: 'test-run' });

    await vi.waitFor(async () => {
      await expect(workflow.getWorkflowRunById('test-run')).resolves.toMatchObject({
        status: 'failed',
        error: { message: 'Workflow execution failed' },
      });
    });
    expect(logError).toHaveBeenCalledWith('Background Temporal workflow execution failed', {
      error,
      runId: 'test-run',
      workflowId: 'test-workflow',
    });
  });

  it('does not persist framework auth tokens in Temporal request context snapshots or dispatch args', async () => {
    const storage = new MockStore();
    const result = {
      status: 'success',
      input: { value: 1 },
      result: { value: 2 },
      state: {},
      steps: {},
    };
    const handle = { result: vi.fn().mockResolvedValue(result) };
    const start = vi.fn().mockResolvedValue(handle);
    const schema = z.object({ value: z.number() });
    const workflow = createWorkflow(
      { id: 'test-workflow', inputSchema: schema, outputSchema: schema },
      { client: { workflow: { start } } as unknown as Client, taskQueue: 'test-queue' },
    ).commit();
    new Mastra({ workflows: { workflow }, storage, logger: false });
    const run = await workflow.createRun({ runId: 'test-run', resourceId: 'resource-1' });
    const requestContext = new RequestContext();
    requestContext.set('tenant', 'acme');
    requestContext.set(MASTRA_AUTH_TOKEN_KEY, 'live-bearer-token');

    await run.start({ inputData: { value: 1 }, requestContext });

    expect(start).toHaveBeenCalledWith(
      'testWorkflow',
      expect.objectContaining({
        args: [
          expect.objectContaining({
            requestContext: { tenant: 'acme' },
          }),
        ],
      }),
    );
    const runs = await workflow.listWorkflowRuns();
    expect((runs.runs[0]?.snapshot as any).requestContext).toEqual({ tenant: 'acme' });
    expect(JSON.stringify(runs)).not.toContain('live-bearer-token');
    const persisted = await workflow.getWorkflowRunById('test-run');
    expect(JSON.stringify(persisted)).not.toContain('live-bearer-token');
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
