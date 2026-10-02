import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBackgroundTask } from '../../../background-tasks/create';
import { dispatchBackgroundTool } from './background-dispatch-core';

vi.mock('../../../background-tasks/create', () => ({ createBackgroundTask: vi.fn() }));

const mockCreate = vi.mocked(createBackgroundTask);

/**
 * Pins the per-engine background-dispatch policy split:
 * - `existingRunningTask`: `'restart'` (durable, redelivery dedup)
 *   probes `checkIfRunning` and restarts; `'dispatch-duplicate'` (default
 *   engine, released contract) skips the probe entirely — fidelity includes
 *   NOT making the extra storage read.
 * - `dispatchFailure`: `'propagate'` (default engine) rethrows ladder
 *   failures as tool errors; `'fallback-to-sync'` (durable) degrades to
 *   synchronous execution.
 * Rungs that are unconditional on both policies (concurrency fallback,
 * best-effort started-chunk emission, adopt-persisted fail-closed) are
 * pinned too.
 */
function makeHandle(overrides: Record<string, unknown> = {}) {
  return {
    get task() {
      return { id: 'task-live' };
    },
    checkIfExisting: vi.fn(async () => undefined),
    checkIfSuspended: vi.fn(async () => false),
    checkIfRunning: vi.fn(async () => false),
    restart: vi.fn(async () => ({ id: 'task-restarted' })),
    resume: vi.fn(async () => ({ id: 'task-resumed' })),
    dispatch: vi.fn(async () => ({ task: { id: 'task-started' }, fallbackToSync: false })),
    waitForCompletion: vi.fn(),
    ...overrides,
  } as any;
}

function makeDeps(overrides: Record<string, unknown> = {}) {
  return {
    backgroundTaskManager: {} as any,
    agentBackgroundConfig: { tools: 'all' } as any,
    managerConfig: undefined,
    toolBackgroundConfig: undefined,
    llmBgOverrides: {},
    args: {},
    toolName: 'bg-tool',
    toolCallId: 'call-1',
    agentId: 'agent-1',
    threadId: undefined,
    resourceId: undefined,
    runId: 'run-1',
    resumeData: undefined,
    taskContext: () => ({}) as any,
    emitTaskStarted: vi.fn(),
    existingRunningTask: 'dispatch-duplicate' as const,
    dispatchFailure: 'propagate' as const,
    ...overrides,
  };
}

beforeEach(() => {
  mockCreate.mockReset();
});

describe('dispatchBackgroundTool — existing-running-task policy', () => {
  it('dispatch-duplicate (default engine): never probes checkIfRunning, goes straight to dispatch', async () => {
    const handle = makeHandle();
    mockCreate.mockReturnValue(handle);

    const outcome = await dispatchBackgroundTool(makeDeps({ existingRunningTask: 'dispatch-duplicate' }));

    expect(handle.checkIfRunning).not.toHaveBeenCalled();
    expect(handle.dispatch).toHaveBeenCalledTimes(1);
    expect(outcome).toMatchObject({ status: 'started', taskId: 'task-started' });
  });

  it('restart (durable): an already-running task is restarted instead of dispatched again', async () => {
    const handle = makeHandle({ checkIfRunning: vi.fn(async () => true) });
    mockCreate.mockReturnValue(handle);

    const outcome = await dispatchBackgroundTool(makeDeps({ existingRunningTask: 'restart' }));

    expect(handle.checkIfRunning).toHaveBeenCalledTimes(1);
    expect(handle.restart).toHaveBeenCalledTimes(1);
    expect(handle.dispatch).not.toHaveBeenCalled();
    expect(outcome).toMatchObject({ status: 'restarted', taskId: 'task-restarted' });
  });
});

describe('dispatchBackgroundTool — dispatch-failure policy', () => {
  it('propagate (default engine): a dispatch failure rejects and surfaces as a tool error', async () => {
    const handle = makeHandle({
      dispatch: vi.fn(async () => {
        throw new Error('dispatch boom');
      }),
    });
    mockCreate.mockReturnValue(handle);

    await expect(dispatchBackgroundTool(makeDeps({ dispatchFailure: 'propagate' }))).rejects.toThrow('dispatch boom');
  });

  it('propagate: the narrow concurrency-limit fallback still degrades to sync (both engines shipped this)', async () => {
    const handle = makeHandle({
      dispatch: vi.fn(async () => ({ task: { id: 'unused' }, fallbackToSync: true })),
    });
    mockCreate.mockReturnValue(handle);

    const outcome = await dispatchBackgroundTool(makeDeps({ dispatchFailure: 'propagate' }));
    expect(outcome).toEqual({ status: 'sync' });
  });

  it('fallback-to-sync (durable): a dispatch failure degrades to synchronous execution and debug-logs', async () => {
    const logger = { debug: vi.fn(), warn: vi.fn() } as any;
    const handle = makeHandle({
      dispatch: vi.fn(async () => {
        throw new Error('dispatch boom');
      }),
    });
    mockCreate.mockReturnValue(handle);

    const outcome = await dispatchBackgroundTool(makeDeps({ dispatchFailure: 'fallback-to-sync', logger }));
    expect(outcome).toEqual({ status: 'sync' });
    expect(logger.debug).toHaveBeenCalledTimes(1);
  });

  it('adopt-persisted recovery failures fail closed regardless of the dispatchFailure policy (#24418)', async () => {
    const handle = makeHandle({
      checkIfExisting: vi.fn(async () => {
        throw new Error('storage down');
      }),
    });
    mockCreate.mockReturnValue(handle);

    await expect(
      dispatchBackgroundTool(
        makeDeps({
          existingRunningTask: 'restart',
          dispatchFailure: 'fallback-to-sync',
          adoptPersistedTask: true,
          llmBgOverrides: { disposition: 'awaited' },
        }),
      ),
    ).rejects.toThrow('storage down');
  });
});

describe('dispatchBackgroundTool — started-chunk emission is best-effort on both policies', () => {
  it('an emitTaskStarted failure never fails or re-runs an already-dispatched task, even under propagate', async () => {
    const logger = { debug: vi.fn(), warn: vi.fn() } as any;
    const handle = makeHandle();
    mockCreate.mockReturnValue(handle);

    const outcome = await dispatchBackgroundTool(
      makeDeps({
        dispatchFailure: 'propagate',
        logger,
        emitTaskStarted: vi.fn(() => {
          throw new Error('transport closed');
        }),
      }),
    );

    expect(outcome).toMatchObject({ status: 'started', taskId: 'task-started' });
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });
});
