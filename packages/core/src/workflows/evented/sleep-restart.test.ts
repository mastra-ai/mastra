import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MASTRA_AUTH_TOKEN_KEY, RequestContext } from '../../request-context';
import { MockStore } from '../../storage/mock';
import { schedulePersistedSleepTimer } from './workflow-event-processor/sleep';
import { createStep, createWorkflow } from '.';

const delay = (duration: number) => new Promise(resolve => setTimeout(resolve, duration));

async function waitForPersistedTimer(storage: InstanceType<typeof MockStore>, workflowName: string, runId: string) {
  const workflowsStore = await storage.getStore('workflows');
  await vi.waitFor(async () => {
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName, runId });
    expect(Object.keys(snapshot?.sleepTimers ?? {})).toHaveLength(1);
  });
  return workflowsStore;
}

function createSleepingWorkflow({
  id,
  duration,
  sleepUntil,
  afterSleep,
}: {
  id: string;
  duration?: number;
  sleepUntil?: Date;
  afterSleep: (args: { inputData: { value: string } }) => Promise<{ value: string }>;
}) {
  const workflow = createWorkflow({
    id,
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
  });
  const sleepingWorkflow = sleepUntil ? workflow.sleepUntil(sleepUntil) : workflow.sleep(duration ?? 0);
  return sleepingWorkflow
    .then(
      createStep({
        id: `after-${id}`,
        inputSchema: z.object({ value: z.string() }),
        outputSchema: z.object({ value: z.string() }),
        execute: afterSleep,
      }),
    )
    .commit();
}

async function startRunAndReplaceRuntime({
  storage,
  workflow,
  runId,
}: {
  storage: InstanceType<typeof MockStore>;
  workflow: ReturnType<ReturnType<typeof createWorkflow>['commit']>;
  runId: string;
}) {
  const firstPubsub = new EventEmitterPubSub();
  const firstRuntime = new Mastra({
    logger: false,
    storage,
    pubsub: firstPubsub,
    workflows: { [workflow.id]: workflow },
  });
  await firstRuntime.startWorkers();

  const run = await workflow.createRun({ runId });
  void run.start({ inputData: { value: 'persist me' } });
  const workflowsStore = await waitForPersistedTimer(storage, workflow.id, run.runId);
  const publish = firstPubsub.publish.bind(firstPubsub);
  vi.spyOn(firstPubsub, 'publish').mockImplementation(async (topic, event) => {
    if (topic === 'workflows') {
      throw new Error('original runtime unavailable');
    }
    return publish(topic, event);
  });
  await firstRuntime.stopWorkers();

  const replacementRuntime = new Mastra({
    logger: false,
    storage,
    pubsub: new EventEmitterPubSub(),
    workflows: { [workflow.id]: workflow },
  });
  await replacementRuntime.startWorkers();
  await replacementRuntime.restartAllActiveWorkflowRuns();

  return { replacementRuntime, run, workflowsStore };
}

describe('evented workflow durable sleep recovery', () => {
  it('continues a relative sleep after the original runtime is replaced', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createSleepingWorkflow({ id: 'sleep-restart-workflow', duration: 500, afterSleep });

    const { replacementRuntime, run, workflowsStore } = await startRunAndReplaceRuntime({
      storage,
      workflow,
      runId: 'sleep-restart-run',
    });

    await vi.waitFor(
      async () => {
        const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
        expect(snapshot?.status).toBe('success');
        expect(snapshot?.sleepTimers).toEqual({});
        expect(afterSleep).toHaveBeenCalledTimes(1);
      },
      { timeout: 2_500 },
    );

    await replacementRuntime.stopWorkers();
  });

  it('continues sleepUntil after the original runtime is replaced', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createSleepingWorkflow({
      id: 'sleep-until-restart-workflow',
      sleepUntil: new Date(Date.now() + 500),
      afterSleep,
    });

    const { replacementRuntime } = await startRunAndReplaceRuntime({
      storage,
      workflow,
      runId: 'sleep-until-restart-run',
    });

    await vi.waitFor(() => expect(afterSleep).toHaveBeenCalledTimes(1), { timeout: 2_500 });
    await replacementRuntime.stopWorkers();
  });

  it('fires an overdue restored timer immediately', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createSleepingWorkflow({ id: 'overdue-sleep-workflow', duration: 5_000, afterSleep });

    const firstRuntime = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflow.id]: workflow },
    });
    await firstRuntime.startWorkers();
    const run = await workflow.createRun({ runId: 'overdue-sleep-run' });
    void run.start({ inputData: { value: 'persist me' } });
    const workflowsStore = await waitForPersistedTimer(storage, workflow.id, run.runId);
    await firstRuntime.stopWorkers();
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    const [timerKey, timer] = Object.entries(snapshot?.sleepTimers ?? {})[0]!;
    await workflowsStore?.updateWorkflowState({
      workflowName: workflow.id,
      runId: run.runId,
      opts: { status: 'running', sleepTimers: { [timerKey]: { ...timer, dueAt: Date.now() - 100 } } },
    });

    const replacementRuntime = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflow.id]: workflow },
    });
    await replacementRuntime.startWorkers();
    await replacementRuntime.restartAllActiveWorkflowRuns();

    await vi.waitFor(() => expect(afterSleep).toHaveBeenCalledTimes(1), { timeout: 1_000 });
    await replacementRuntime.stopWorkers();
  });

  it('preserves the original absolute deadline and does not fire a future timer early', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createSleepingWorkflow({ id: 'future-sleep-workflow', duration: 700, afterSleep });
    const startedAt = Date.now();

    const { replacementRuntime } = await startRunAndReplaceRuntime({
      storage,
      workflow,
      runId: 'future-sleep-run',
    });

    await delay(200);
    expect(afterSleep).not.toHaveBeenCalled();
    await vi.waitFor(() => expect(afterSleep).toHaveBeenCalledTimes(1), { timeout: 1_500 });
    expect(Date.now() - startedAt).toBeGreaterThanOrEqual(650);
    await replacementRuntime.stopWorkers();
  });

  it('retains a persisted timer when continuation publication fails without an unhandled rejection', async () => {
    const storage = new MockStore();
    const workflow = createSleepingWorkflow({
      id: 'failed-publication-sleep-workflow',
      duration: 5_000,
      afterSleep: vi.fn(async ({ inputData }) => inputData),
    });
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await mastra.startWorkers();
    const run = await workflow.createRun({ runId: 'failed-publication-sleep-run' });
    void run.start({ inputData: { value: 'persist me' } });
    const workflowsStore = await waitForPersistedTimer(storage, workflow.id, run.runId);
    await mastra.stopWorkers();
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    const timer = Object.values(snapshot?.sleepTimers ?? {})[0]!;
    const unhandled = vi.fn();
    const onError = vi.fn();
    process.on('unhandledRejection', unhandled);

    schedulePersistedSleepTimer({
      pubsub: { publish: vi.fn().mockRejectedValue(new Error('publication failed')) } as any,
      workflowsStore: workflowsStore!,
      workflowId: workflow.id,
      runId: run.runId,
      timer: { ...timer, dueAt: Date.now() },
      onError,
    });
    await delay(50);

    const retained = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    expect(retained?.sleepTimers?.[timer.id]).toBeDefined();
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'publication failed' }));
    expect(unhandled).not.toHaveBeenCalled();
    process.off('unhandledRejection', unhandled);
  });

  it('does not restore timers when automatic active-run restart is disabled', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createWorkflow({
      id: 'disabled-sleep-restart-workflow',
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      options: { autoRestartActiveRuns: false },
    })
      .sleep(5_000)
      .then(
        createStep({
          id: 'after-disabled-sleep',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ value: z.string() }),
          execute: afterSleep,
        }),
      )
      .commit();
    const firstRuntime = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await firstRuntime.startWorkers();
    const run = await workflow.createRun({ runId: 'disabled-sleep-restart-run' });
    void run.start({ inputData: { value: 'persist me' } });
    const workflowsStore = await waitForPersistedTimer(storage, workflow.id, run.runId);
    await firstRuntime.stopWorkers();
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    const [timerKey, timer] = Object.entries(snapshot?.sleepTimers ?? {})[0]!;
    await workflowsStore?.updateWorkflowState({
      workflowName: workflow.id,
      runId: run.runId,
      opts: { status: 'running', sleepTimers: { [timerKey]: { ...timer, dueAt: Date.now() - 100 } } },
    });
    const replacementRuntime = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await replacementRuntime.startWorkers();
    await replacementRuntime.restartAllActiveWorkflowRuns();
    await delay(100);

    expect(afterSleep).not.toHaveBeenCalled();
    const retained = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    expect(retained?.sleepTimers?.[timerKey]).toBeDefined();
    await replacementRuntime.stopWorkers();
  });

  it('does not schedule a local timer when persistence loses the running-status guard', async () => {
    const storage = new MockStore();
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createSleepingWorkflow({ id: 'failed-persistence-sleep-workflow', duration: 0, afterSleep });
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await mastra.startWorkers();
    const workflowsStore = (await storage.getStore('workflows'))!;
    const updateWorkflowState = workflowsStore.updateWorkflowState.bind(workflowsStore);
    vi.spyOn(workflowsStore, 'updateWorkflowState').mockImplementation(async args => {
      if (args.opts.sleepTimers) {
        return undefined;
      }
      return updateWorkflowState(args);
    });

    const run = await workflow.createRun({ runId: 'failed-persistence-sleep-run' });
    void run.start({ inputData: { value: 'persist me' } });
    await delay(100);

    const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    expect(snapshot?.sleepTimers).toEqual({});
    expect(afterSleep).not.toHaveBeenCalled();
    await mastra.stopWorkers();
  });

  it('does not publish a stale timer after the run stops or the timer is removed', async () => {
    const storage = new MockStore();
    const workflow = createSleepingWorkflow({
      id: 'stale-callback-sleep-workflow',
      duration: 5_000,
      afterSleep: vi.fn(async ({ inputData }) => inputData),
    });
    const mastra = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { workflow },
    });
    await mastra.startWorkers();
    const run = await workflow.createRun({ runId: 'stale-callback-sleep-run' });
    void run.start({ inputData: { value: 'persist me' } });
    const workflowsStore = (await waitForPersistedTimer(storage, workflow.id, run.runId))!;
    await mastra.stopWorkers();
    const snapshot = await workflowsStore.loadWorkflowSnapshot({ workflowName: workflow.id, runId: run.runId });
    const timer = Object.values(snapshot?.sleepTimers ?? {})[0]!;
    await workflowsStore.updateWorkflowState({
      workflowName: workflow.id,
      runId: run.runId,
      opts: { status: 'failed', sleepTimers: {} },
    });
    const publish = vi.fn();

    schedulePersistedSleepTimer({
      pubsub: { publish } as any,
      workflowsStore,
      workflowId: workflow.id,
      runId: run.runId,
      timer: { ...timer, dueAt: Date.now() },
    });
    await delay(50);

    expect(publish).not.toHaveBeenCalled();
  });

  it('does not duplicate the Mastra bearer token in persisted timer data', async () => {
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
    const serializedTimers = JSON.stringify(snapshot?.sleepTimers);
    expect(serializedTimers).not.toContain('super-secret-bearer-token');
    expect(serializedTimers).not.toContain(MASTRA_AUTH_TOKEN_KEY);

    await mastra.stopWorkers();
  });
});
