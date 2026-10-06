import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkerDeps } from '../worker';
import { WorkflowTimerWorker } from './workflow-timer-worker';

function createTimer(overrides: Record<string, unknown> = {}) {
  return {
    id: 'workflow:run:sleep:0',
    workflowId: 'workflow',
    runId: 'run',
    stepId: 'sleep',
    kind: 'sleep',
    startedAt: 0,
    dueAt: 1_000,
    status: 'pending',
    emitStepEvents: false,
    continuation: {
      executionPath: [1],
      resumeSteps: [],
      stepResults: {},
      prevResult: { status: 'success', output: 'value' },
      activeStepsPath: {},
      requestContext: {},
    },
    ...overrides,
  };
}

function createHarness() {
  const timer = createTimer();
  const workflowsStore = {
    listDueWorkflowTimers: vi.fn().mockResolvedValue({ timers: [timer], nextPage: 1 }),
    claimWorkflowTimer: vi.fn().mockResolvedValue({ ...timer, status: 'claimed', claimToken: 'claim' }),
    completeWorkflowTimer: vi.fn().mockResolvedValue(true),
    releaseWorkflowTimer: vi.fn().mockResolvedValue(true),
  };
  const pubsub = {
    publish: vi.fn().mockResolvedValue(undefined),
  };
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  const storage = {
    getStore: vi.fn().mockResolvedValue(workflowsStore),
  };
  const deps = { pubsub, storage, logger } as unknown as WorkerDeps;
  return { timer, workflowsStore, pubsub, logger, deps };
}

describe('WorkflowTimerWorker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
  });

  it('polls one bounded page at a time and acknowledges a published continuation', async () => {
    const harness = createHarness();
    harness.workflowsStore.listDueWorkflowTimers.mockResolvedValue({ timers: [harness.timer], nextPage: 1 });
    const worker = new WorkflowTimerWorker({ pollInterval: 10_000, batchSize: 25, leaseDuration: 30_000 });

    await worker.init(harness.deps);
    await worker.start();

    expect(harness.workflowsStore.listDueWorkflowTimers).toHaveBeenCalledWith({
      dueAt: 1_000,
      limit: 25,
      page: 0,
    });
    expect(harness.workflowsStore.claimWorkflowTimer).toHaveBeenCalledWith({
      workflowId: 'workflow',
      runId: 'run',
      timerId: harness.timer.id,
      now: 1_000,
      leaseDuration: 30_000,
    });
    expect(harness.pubsub.publish).toHaveBeenCalledWith('workflows', {
      id: harness.timer.id,
      type: 'workflow.step.run',
      runId: 'run',
      createdAt: new Date(1_000),
      data: {
        workflowId: 'workflow',
        runId: 'run',
        ...harness.timer.continuation,
        workflowTimer: {
          id: harness.timer.id,
          claimToken: 'claim',
        },
      },
    });
    expect(harness.workflowsStore.completeWorkflowTimer).not.toHaveBeenCalled();

    await worker.stop();
  });

  it('continues scanning from the next run page on the following poll', async () => {
    const harness = createHarness();
    harness.workflowsStore.listDueWorkflowTimers
      .mockResolvedValueOnce({ timers: [], nextPage: 1 })
      .mockResolvedValueOnce({ timers: [], nextPage: 2 });
    const worker = new WorkflowTimerWorker({ pollInterval: 1_000, batchSize: 25 });

    await worker.init(harness.deps);
    await worker.start();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(harness.workflowsStore.listDueWorkflowTimers).toHaveBeenNthCalledWith(1, {
      dueAt: 1_000,
      limit: 25,
      page: 0,
    });
    expect(harness.workflowsStore.listDueWorkflowTimers).toHaveBeenNthCalledWith(2, {
      dueAt: 2_000,
      limit: 25,
      page: 1,
    });
    await worker.stop();
  });

  it('does not publish when another worker owns the timer lease', async () => {
    const harness = createHarness();
    harness.workflowsStore.listDueWorkflowTimers.mockResolvedValue({ timers: [harness.timer], nextPage: 1 });
    harness.workflowsStore.claimWorkflowTimer.mockResolvedValue(undefined);
    const worker = new WorkflowTimerWorker({ pollInterval: 10_000 });

    await worker.init(harness.deps);
    await worker.start();

    expect(harness.pubsub.publish).not.toHaveBeenCalled();
    await worker.stop();
  });

  it('releases the lease when continuation publication fails', async () => {
    const harness = createHarness();
    harness.pubsub.publish.mockRejectedValueOnce(new Error('publish failed'));
    const worker = new WorkflowTimerWorker({ pollInterval: 10_000 });

    await worker.init(harness.deps);
    await worker.start();

    expect(harness.workflowsStore.releaseWorkflowTimer).toHaveBeenCalledWith({
      workflowId: 'workflow',
      runId: 'run',
      timerId: harness.timer.id,
      claimToken: 'claim',
    });
    expect(harness.workflowsStore.completeWorkflowTimer).not.toHaveBeenCalled();
    await worker.stop();
  });

  it('keeps a published timer claimed until continuation processing settles it', async () => {
    const harness = createHarness();
    const worker = new WorkflowTimerWorker({ pollInterval: 10_000 });

    await worker.init(harness.deps);
    await worker.start();

    expect(harness.pubsub.publish).toHaveBeenCalledTimes(1);
    expect(harness.workflowsStore.completeWorkflowTimer).not.toHaveBeenCalled();
    expect(harness.workflowsStore.releaseWorkflowTimer).not.toHaveBeenCalled();
    await worker.stop();
  });
});
