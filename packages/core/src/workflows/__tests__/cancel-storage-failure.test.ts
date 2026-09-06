import { describe, expect, it, vi } from 'vitest';
import z from 'zod';
import { createStep, createWorkflow } from '..';
import { Mastra } from '../../mastra';
import { InMemoryStore } from '../../storage';

describe('Run.cancel durable write failures', () => {
  it('preserves completion racing the cancellation write from another run instance', async () => {
    const storage = new InMemoryStore();
    const makeWorkflow = () =>
      createWorkflow({ id: 'racing', inputSchema: z.object({}), outputSchema: z.object({}) })
        .then(
          createStep({ id: 'done', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }),
        )
        .commit();
    const workflow = makeWorkflow();
    const other = makeWorkflow();
    const mastra = new Mastra({
      workflows: { workflow },
      storage,
      logger: false,
      workers: false,
      scheduler: { enabled: false },
    });
    other.__registerMastra(mastra);
    const active = await workflow.createRun();
    const stale = await other.createRun({ runId: active.runId });
    const store = (await storage.getStore('workflows'))!;
    const update = store.updateWorkflowState.bind(store);
    vi.spyOn(store, 'updateWorkflowState').mockImplementationOnce(async options => {
      expect((await active.start({ inputData: {} })).status).toBe('success');
      return update(options);
    });
    await stale.cancel();
    expect((await store.loadWorkflowSnapshot({ workflowName: workflow.id, runId: active.runId }))?.status).toBe(
      'success',
    );
    expect(stale.workflowRunStatus).not.toBe('canceled');
  });

  it('does not replace a completed result when cancellation arrives late', async () => {
    const storage = new InMemoryStore();
    const workflow = createWorkflow({ id: 'finished', inputSchema: z.object({}), outputSchema: z.object({}) })
      .then(
        createStep({ id: 'done', inputSchema: z.object({}), outputSchema: z.object({}), execute: async () => ({}) }),
      )
      .commit();
    new Mastra({ workflows: { workflow }, storage, logger: false, workers: false, scheduler: { enabled: false } });
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('success');
    const completed = await workflow.createRun({ runId: run.runId });
    expect(completed.workflowRunStatus).toBe('success');
    await completed.cancel();
    expect(completed.workflowRunStatus).toBe('success');
    expect(completed.abortController.signal.aborted).toBe(false);
    const workflows = (await storage.getStore('workflows'))!;
    expect((await workflows.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId }))?.status).toBe(
      'success',
    );
  });

  it('repeated and concurrent cancellations retain one canceled result', async () => {
    const storage = new InMemoryStore();
    const workflow = createWorkflow({ id: 'repeat', inputSchema: z.object({}), outputSchema: z.object({}) })
      .then(
        createStep({
          id: 'wait',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async ({ suspend }) => suspend({}),
        }),
      )
      .commit();
    new Mastra({ workflows: { workflow }, storage, logger: false, workers: false, scheduler: { enabled: false } });
    const run = await workflow.createRun();
    await run.start({ inputData: {} });
    await Promise.all([run.cancel(), run.cancel()]);
    await run.cancel();
    const workflows = (await storage.getStore('workflows'))!;
    expect((await workflows.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId }))?.status).toBe(
      'canceled',
    );
    expect(run.abortController.signal.aborted).toBe(true);
  });

  it('delivers abort but rejects a failed stored cancellation without replacing the saved suspended state', async () => {
    const storage = new InMemoryStore();
    const workflow = createWorkflow({ id: 'parked', inputSchema: z.object({}), outputSchema: z.object({}) })
      .then(
        createStep({
          id: 'wait',
          inputSchema: z.object({}),
          outputSchema: z.object({}),
          execute: async ({ suspend }) => suspend({ prompt: 'Wait.' }),
        }),
      )
      .commit();
    new Mastra({ workflows: { workflow }, storage, logger: false, workers: false, scheduler: { enabled: false } });
    const run = await workflow.createRun();
    expect((await run.start({ inputData: {} })).status).toBe('suspended');
    const workflows = (await storage.getStore('workflows'))!;
    const failure = new Error('Local cancellation write rejected');
    const write = vi.spyOn(workflows, 'updateWorkflowState').mockRejectedValueOnce(failure);
    await expect(run.cancel()).rejects.toBe(failure);
    expect(run.abortController.signal.aborted).toBe(true);
    expect((await workflows.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId }))?.status).toBe(
      'suspended',
    );
    expect(write).toHaveBeenCalledTimes(1);
    write.mockRestore();
  });
});
