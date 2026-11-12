import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod/v4';
import { EventEmitterPubSub } from '../../events/event-emitter';
import { Mastra } from '../../mastra';
import { MockStore } from '../../storage/mock';
import { runLivenessKey } from './leases';
import { abandonLease } from './test-utils/abandon-lease';
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
  // The stopped runtime stands for a process that went away; the liveness its last step wrote lapses.
  await abandonLease(storage, runLivenessKey(runId));
  return workflowsStore;
}

describe('evented workflow durable sleep recovery', () => {
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
    const createRun = vi.spyOn(workflow, 'createRun');

    const replacementRuntime = new Mastra({
      logger: false,
      storage,
      pubsub: new EventEmitterPubSub(),
      workflows: { [workflow.id]: workflow },
      // With a zero grace the boot call would restart the run at once, so only the opt-out keeps it.
      recovery: { workflowGraceMs: 0 },
    });
    await replacementRuntime.startWorkers();
    await replacementRuntime.restartAllActiveWorkflowRuns();

    expect(createRun).not.toHaveBeenCalled();
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
