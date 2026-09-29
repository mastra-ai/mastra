import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

const sleep = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

async function waitForPersistedTimer(storage: InstanceType<typeof MockStore>, workflowName: string, runId: string) {
  const workflowsStore = await storage.getStore('workflows');
  await vi.waitFor(async () => {
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName, runId });
    expect(Object.keys((snapshot as any)?.sleepTimers ?? {})).toHaveLength(1);
  });
  return workflowsStore;
}

describe('evented workflow sleep worker restart', () => {
  it('continues a sleep after workers are replaced', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createWorkflow({
      id: 'sleep-restart-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .sleep(500)
      .then(
        createStep({
          id: 'after-sleep',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: afterSleep,
        }),
      )
      .commit();

    const firstWorker = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await firstWorker.startWorkers();

    const run = await workflow.createRun({ runId: 'sleep-restart-run' });
    void run.start({ inputData: { value: 'persist me' } });
    const workflowsStore = await waitForPersistedTimer(storage, workflow.id, run.runId);
    await firstWorker.stopWorkers();

    const replacementWorker = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await replacementWorker.startWorkers();
    await replacementWorker.startWorkers();

    await vi.waitFor(async () => {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
      expect(snapshot?.status).toBe('success');
      expect(snapshot?.context?.['after-sleep']).toMatchObject({ status: 'success' });
      expect(snapshot?.sleepTimers).toEqual({});
      expect(afterSleep).toHaveBeenCalledTimes(1);
    });

    await replacementWorker.stopWorkers();
  });

  it('recovers an overdue sleep immediately when replacement workers start', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createWorkflow({
      id: 'overdue-sleep-restart-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .sleep(200)
      .then(
        createStep({
          id: 'after-overdue-sleep',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: afterSleep,
        }),
      )
      .commit();

    const firstWorker = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await firstWorker.startWorkers();

    const run = await workflow.createRun({ runId: 'overdue-sleep-restart-run' });
    void run.start({ inputData: { value: 'persist me' } });
    await waitForPersistedTimer(storage, workflow.id, run.runId);
    await firstWorker.stopWorkers();
    await sleep(300);

    const replacementWorker = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await replacementWorker.startWorkers();

    await vi.waitFor(() => expect(afterSleep).toHaveBeenCalledTimes(1));
    await replacementWorker.stopWorkers();
  });

  it('continues a sleepUntil after workers are replaced', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createWorkflow({
      id: 'sleep-until-restart-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .sleepUntil(new Date(Date.now() + 500))
      .then(
        createStep({
          id: 'after-sleep-until',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: afterSleep,
        }),
      )
      .commit();

    const firstWorker = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await firstWorker.startWorkers();

    const run = await workflow.createRun({ runId: 'sleep-until-restart-run' });
    void run.start({ inputData: { value: 'persist me' } });
    await waitForPersistedTimer(storage, workflow.id, run.runId);
    await firstWorker.stopWorkers();

    const replacementWorker = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await replacementWorker.startWorkers();

    await vi.waitFor(() => expect(afterSleep).toHaveBeenCalledTimes(1));
    await replacementWorker.stopWorkers();
  });

  it('allows only one replacement worker to continue the same sleep', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createWorkflow({
      id: 'competing-sleep-restart-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .sleep(300)
      .then(
        createStep({
          id: 'after-competing-sleep',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: afterSleep,
        }),
      )
      .commit();

    const firstWorker = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await firstWorker.startWorkers();

    const run = await workflow.createRun({ runId: 'competing-sleep-restart-run' });
    void run.start({ inputData: { value: 'persist me' } });
    await waitForPersistedTimer(storage, workflow.id, run.runId);
    await firstWorker.stopWorkers();

    const replacementWorkers = [
      new Mastra({ logger: false, storage, pubsub: new EventEmitterPubSub(), workflows: { workflow } }),
      new Mastra({ logger: false, storage, pubsub: new EventEmitterPubSub(), workflows: { workflow } }),
    ];
    await Promise.all(replacementWorkers.map(worker => worker.startWorkers()));

    await vi.waitFor(() => expect(afterSleep).toHaveBeenCalledTimes(1));
    await sleep(200);
    expect(afterSleep).toHaveBeenCalledTimes(1);

    await Promise.all(replacementWorkers.map(worker => worker.stopWorkers()));
  });

  it('does not execute a restored future timer before its deadline', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createWorkflow({
      id: 'future-sleep-restart-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .sleep(700)
      .then(
        createStep({
          id: 'after-future-sleep',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: afterSleep,
        }),
      )
      .commit();

    const firstWorker = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await firstWorker.startWorkers();

    const run = await workflow.createRun({ runId: 'future-sleep-restart-run' });
    void run.start({ inputData: { value: 'persist me' } });
    await waitForPersistedTimer(storage, workflow.id, run.runId);
    await firstWorker.stopWorkers();

    const replacementWorker = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await replacementWorker.startWorkers();

    await sleep(200);
    expect(afterSleep).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(afterSleep).toHaveBeenCalledTimes(1));

    await replacementWorker.stopWorkers();
  });
});
