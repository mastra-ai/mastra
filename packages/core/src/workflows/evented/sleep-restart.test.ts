import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../../request-context';
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

  it('reclaims an expired timer lease after the worker that claimed it dies', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createWorkflow({
      id: 'expired-sleep-lease-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .sleep(5_000)
      .then(
        createStep({
          id: 'after-expired-sleep-lease',
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

    const run = await workflow.createRun({ runId: 'expired-sleep-lease-run' });
    void run.start({ inputData: { value: 'persist me' } });
    const workflowsStore = await waitForPersistedTimer(storage, workflow.id, run.runId);
    await firstWorker.stopWorkers();

    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    const timer = Object.values(snapshot?.sleepTimers ?? {})[0]!;
    await workflowsStore?.updateWorkflowState({
      workflowName: workflow.id,
      runId: run.runId,
      opts: {
        status: 'running',
        sleepTimers: {
          [timer.id]: {
            ...timer,
            dueAt: Date.now() - 1,
            status: 'claimed',
            claimToken: 'dead-worker-claim',
            claimedAt: Date.now() - 60_000,
          },
        },
      },
    });

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

  it('does not persist the Mastra bearer token in a durable sleep continuation', async () => {
    const storage = new MockStore();
    const workflow = createWorkflow({
      id: 'sanitized-sleep-context-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
    })
      .sleep(5_000)
      .commit();
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await mastra.startWorkers();

    const requestContext = new RequestContext();
    requestContext.set('safe-value', 'persist me');
    requestContext.set(MASTRA_AUTH_TOKEN_KEY, 'super-secret-bearer-token');
    const run = await workflow.createRun({ runId: 'sanitized-sleep-context-run' });
    void run.start({ inputData: { value: 'persist me' }, requestContext });
    const workflowsStore = await waitForPersistedTimer(storage, workflow.id, run.runId);

    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    const timer = Object.values(snapshot?.sleepTimers ?? {})[0]!;
    expect(timer.continuation.requestContext).toEqual({ 'safe-value': 'persist me' });
    expect(timer.continuation.requestContext).not.toHaveProperty(MASTRA_AUTH_TOKEN_KEY);

    await mastra.stopWorkers();
  });
});
