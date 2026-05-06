import { describe, expect, it, vi } from 'vitest';

import { restoreCavemanForCurrentThread } from '../thread-caveman-state.js';

function createHarness({
  currentThreadId = 'thread-1',
  metadata,
  state = {},
}: {
  currentThreadId?: string | undefined;
  metadata?: Record<string, unknown>;
  state?: Record<string, unknown>;
}) {
  const harness = {
    getCurrentThreadId: vi.fn(() => currentThreadId),
    getState: vi.fn(() => state),
    listThreads: vi.fn(async () => [{ id: 'thread-1', metadata }]),
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

  it('seeds missing thread metadata from the current harness state', async () => {
    const harness = createHarness({ metadata: {}, state: { cavemanObservations: true } });

    await restoreCavemanForCurrentThread(harness as never);

    expect(harness.setState).not.toHaveBeenCalled();
    expect(harness.setThreadSetting).toHaveBeenCalledWith({ key: 'cavemanObservations', value: true });
  });

  it('does nothing when there is no current thread', async () => {
    const harness = createHarness({ currentThreadId: '', metadata: { cavemanObservations: true } });

    await restoreCavemanForCurrentThread(harness as never);

    expect(harness.listThreads).not.toHaveBeenCalled();
    expect(harness.setState).not.toHaveBeenCalled();
    expect(harness.setThreadSetting).not.toHaveBeenCalled();
  });
});
