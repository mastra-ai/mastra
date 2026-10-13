import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { createStep, createWorkflow } from '.';

function createSleepingWorkflow({
  id,
  duration,
  beforeSleep,
  afterSleep,
  autoRestartActiveRuns,
  until = false,
}: {
  id: string;
  duration: number;
  beforeSleep: () => Promise<{ value: string }>;
  afterSleep: (args: { inputData: { value: string } }) => Promise<{ value: string }>;
  autoRestartActiveRuns?: boolean;
  until?: boolean;
}) {
  const workflow = createWorkflow({
    id,
    inputSchema: z.object({ value: z.string() }),
    outputSchema: z.object({ value: z.string() }),
    options: { autoRestartActiveRuns },
  }).then(
    createStep({
      id: `before-${id}`,
      inputSchema: z.object({ value: z.string() }),
      outputSchema: z.object({ value: z.string() }),
      execute: beforeSleep,
    }),
  );

  const sleepingWorkflow = until ? workflow.sleepUntil(new Date(Date.now() + duration)) : workflow.sleep(duration);
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

async function startSleepingRun({
  storage,
  workflow,
  runId,
}: {
  storage: InstanceType<typeof MockStore>;
  workflow: ReturnType<ReturnType<typeof createWorkflow>['commit']>;
  runId: string;
}) {
  const pubsub = new EventEmitterPubSub();
  const runtime = new Mastra({ logger: false, storage, pubsub, workflows: { [workflow.id]: workflow } });
  await runtime.startWorkers();

  const run = await workflow.createRun({ runId });
  void run.start({ inputData: { value: 'persist me' } });
  const workflowsStore = await storage.getStore('workflows');
  await vi.waitFor(async () => {
    const snapshot = await workflowsStore?.loadWorkflowSnapshot({ workflowName: workflow.id, runId });
    expect(snapshot?.status).toBe('running');
    expect(Object.values(snapshot?.context ?? {}).some(result => result.status === 'waiting')).toBe(true);
  });

  await runtime.stopWorkers();
  return workflowsStore;
}

describe('evented workflow durable sleep recovery', () => {
  it('replays a sleeping path after restart without rerunning completed work', async () => {
    const storage = new MockStore();
    const beforeSleep = vi.fn(async () => ({ value: 'persist me' }));
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createSleepingWorkflow({
      id: 'sleep-restart-workflow',
      duration: 5_000,
      beforeSleep,
      afterSleep,
    });
    const workflowsStore = await startSleepingRun({ storage, workflow, runId: 'sleep-restart-run' });
    const replacementRuntime = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflow.id]: workflow },
    });
    await replacementRuntime.startWorkers();
    await replacementRuntime.restartAllActiveWorkflowRuns();

    await vi.waitFor(async () => {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId: 'sleep-restart-run',
      });
      expect(snapshot?.status).toBe('success');
    });
    expect(beforeSleep).toHaveBeenCalledTimes(1);
    expect(afterSleep).toHaveBeenCalledTimes(1);
    await replacementRuntime.stopWorkers();
  });

  it('replays a sleepUntil path after restart', async () => {
    const storage = new MockStore();
    const beforeSleep = vi.fn(async () => ({ value: 'persist me' }));
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createSleepingWorkflow({
      id: 'sleep-until-restart-workflow',
      duration: 5_000,
      beforeSleep,
      afterSleep,
      until: true,
    });
    const workflowsStore = await startSleepingRun({ storage, workflow, runId: 'sleep-until-restart-run' });

    const replacementRuntime = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflow.id]: workflow },
    });
    await replacementRuntime.startWorkers();
    await replacementRuntime.restartAllActiveWorkflowRuns();

    await vi.waitFor(async () => {
      const snapshot = await workflowsStore?.loadWorkflowSnapshot({
        workflowName: workflow.id,
        runId: 'sleep-until-restart-run',
      });
      expect(snapshot?.status).toBe('success');
    });
    expect(beforeSleep).toHaveBeenCalledTimes(1);
    expect(afterSleep).toHaveBeenCalledTimes(1);
    await replacementRuntime.stopWorkers();
  });

  it('does not restart evented runs when autoRestartActiveRuns is false', async () => {
    const storage = new MockStore();
    const beforeSleep = vi.fn(async () => ({ value: 'persist me' }));
    const afterSleep = vi.fn(async ({ inputData }: { inputData: { value: string } }) => inputData);
    const workflow = createSleepingWorkflow({
      id: 'disabled-sleep-restart-workflow',
      duration: 5_000,
      beforeSleep,
      afterSleep,
      autoRestartActiveRuns: false,
    });
    const workflowsStore = await startSleepingRun({ storage, workflow, runId: 'disabled-sleep-restart-run' });

    const replacementRuntime = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflow.id]: workflow },
    });
    await replacementRuntime.startWorkers();
    await replacementRuntime.restartAllActiveWorkflowRuns();
    await new Promise(resolve => setTimeout(resolve, 200));

    const snapshot = await workflowsStore?.loadWorkflowSnapshot({
      workflowName: workflow.id,
      runId: 'disabled-sleep-restart-run',
    });
    expect(snapshot?.status).toBe('running');
    expect(beforeSleep).toHaveBeenCalledTimes(1);
    expect(afterSleep).not.toHaveBeenCalled();
    await replacementRuntime.stopWorkers();
  });
});
