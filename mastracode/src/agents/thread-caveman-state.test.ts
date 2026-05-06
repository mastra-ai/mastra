import { describe, expect, it, vi } from 'vitest';

import { restoreCavemanForCurrentThread } from './thread-caveman-state.js';

function createHarness({
  currentThreadId = 'thread-1',
  metadata,
  state = {},
  onListThreads,
}: {
  currentThreadId?: string | undefined;
  metadata?: Record<string, unknown>;
  state?: Record<string, unknown>;
  onListThreads?: () => void;
}) {
  let activeThreadId: string | undefined = currentThreadId;
  const harness = {
    getCurrentThreadId: vi.fn(() => activeThreadId),
    getState: vi.fn(() => state),
    listThreads: vi.fn(async () => {
      onListThreads?.();
      return [{ id: 'thread-1', metadata }];
    }),
    switchCurrentThread: (threadId: string | undefined) => {
      activeThreadId = threadId;
    },
    setState: vi.fn(async (nextState: Record<string, unknown>) => {
      Object.assign(state, nextState);
    }),
    setThreadSetting: vi.fn(async () => {}),
  };

  return harness;
}

describe('restoreCavemanForCurrentThread', () => {
  it('mirrors persisted caveman metadata into harness state for the current thread', async () => {
    const harness = createHarness({ metadata: { cavemanObservations: true }, state: { cavemanObservations: false } });

    await restoreCavemanForCurrentThread(harness as never);

    expect(harness.listThreads).toHaveBeenCalledWith({ allResources: true });
    expect(harness.setState).toHaveBeenCalledWith({ cavemanObservations: true });
    expect(harness.setThreadSetting).not.toHaveBeenCalled();
  });

  it('mirrors persisted false caveman metadata into harness state for the current thread', async () => {
    const harness = createHarness({ metadata: { cavemanObservations: false }, state: { cavemanObservations: true } });

    await restoreCavemanForCurrentThread(harness as never);

    expect(harness.listThreads).toHaveBeenCalledWith({ allResources: true });
    expect(harness.setState).toHaveBeenCalledWith({ cavemanObservations: false });
    expect(harness.setThreadSetting).not.toHaveBeenCalled();
  });

  it('seeds missing thread metadata from the current harness state', async () => {
    const harness = createHarness({ metadata: {}, state: { cavemanObservations: true } });

    await restoreCavemanForCurrentThread(harness as never);

    expect(harness.setState).not.toHaveBeenCalled();
    expect(harness.setThreadSetting).toHaveBeenCalledWith({ key: 'cavemanObservations', value: true });
  });

  it('seeds missing thread metadata from false current harness state', async () => {
    const harness = createHarness({ metadata: {}, state: { cavemanObservations: false } });

    await restoreCavemanForCurrentThread(harness as never);

    expect(harness.setState).not.toHaveBeenCalled();
    expect(harness.setThreadSetting).toHaveBeenCalledWith({ key: 'cavemanObservations', value: false });
  });

  it('does nothing when there is no current thread', async () => {
    const harness = createHarness({ currentThreadId: '', metadata: { cavemanObservations: true } });

    await restoreCavemanForCurrentThread(harness as never);

    expect(harness.listThreads).not.toHaveBeenCalled();
    expect(harness.setState).not.toHaveBeenCalled();
    expect(harness.setThreadSetting).not.toHaveBeenCalled();
  });

  it('does not apply stale persisted metadata after the current thread changes', async () => {
    const harness = createHarness({
      metadata: { cavemanObservations: true },
      state: { cavemanObservations: false },
      onListThreads: () => harness.switchCurrentThread('thread-2'),
    });

    await restoreCavemanForCurrentThread(harness as never);

    expect(harness.setState).not.toHaveBeenCalled();
    expect(harness.setThreadSetting).not.toHaveBeenCalled();
  });

  it('does not seed stale metadata after the current thread changes', async () => {
    const harness = createHarness({
      metadata: {},
      state: { cavemanObservations: true },
      onListThreads: () => harness.switchCurrentThread('thread-2'),
    });

    await restoreCavemanForCurrentThread(harness as never);

    expect(harness.setState).not.toHaveBeenCalled();
    expect(harness.setThreadSetting).not.toHaveBeenCalled();
  });
});
