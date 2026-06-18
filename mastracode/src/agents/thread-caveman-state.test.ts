import { describe, expect, it, vi } from 'vitest';

import { restoreOMThreadStateForCurrentThread } from './thread-caveman-state.js';

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
  const setState = vi.fn(async (nextState: Record<string, unknown>) => {
    Object.assign(state, nextState);
  });
  const harness = {
    session: {
      state: {
        get: vi.fn(() => state),
        set: setState,
      },
      thread: {
        getId: vi.fn(() => activeThreadId),
        list: vi.fn(async () => {
          onListThreads?.();
          return [{ id: 'thread-1', metadata }];
        }),
        setSetting: vi.fn(async () => {}),
      },
    },
    switchCurrentThread: (threadId: string | undefined) => {
      activeThreadId = threadId;
    },
  };

  return harness;
}

describe('restoreOMThreadStateForCurrentThread', () => {
  it('mirrors persisted caveman metadata into harness state for the current thread', async () => {
    const harness = createHarness({ metadata: { cavemanObservations: true }, state: { cavemanObservations: false } });

    await restoreOMThreadStateForCurrentThread(harness as never);

    expect(harness.session.thread.list).toHaveBeenCalledWith({ allResources: true });
    expect(harness.session.state.set).toHaveBeenCalledWith({ cavemanObservations: true });
    expect(harness.session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('mirrors persisted false caveman metadata into harness state for the current thread', async () => {
    const harness = createHarness({ metadata: { cavemanObservations: false }, state: { cavemanObservations: true } });

    await restoreOMThreadStateForCurrentThread(harness as never);

    expect(harness.session.thread.list).toHaveBeenCalledWith({ allResources: true });
    expect(harness.session.state.set).toHaveBeenCalledWith({ cavemanObservations: false });
    expect(harness.session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('seeds missing thread metadata from the current harness state', async () => {
    const harness = createHarness({ metadata: {}, state: { cavemanObservations: true } });

    await restoreOMThreadStateForCurrentThread(harness as never);

    expect(harness.session.state.set).not.toHaveBeenCalled();
    expect(harness.session.thread.setSetting).toHaveBeenCalledWith({ key: 'cavemanObservations', value: true });
  });

  it('seeds missing thread metadata from false current harness state', async () => {
    const harness = createHarness({ metadata: {}, state: { cavemanObservations: false } });

    await restoreOMThreadStateForCurrentThread(harness as never);

    expect(harness.session.state.set).not.toHaveBeenCalled();
    expect(harness.session.thread.setSetting).toHaveBeenCalledWith({ key: 'cavemanObservations', value: false });
  });

  it('does nothing when there is no current thread', async () => {
    const harness = createHarness({ currentThreadId: '', metadata: { cavemanObservations: true } });

    await restoreOMThreadStateForCurrentThread(harness as never);

    expect(harness.session.thread.list).not.toHaveBeenCalled();
    expect(harness.session.state.set).not.toHaveBeenCalled();
    expect(harness.session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('does not apply stale persisted metadata after the current thread changes', async () => {
    const harness = createHarness({
      metadata: { cavemanObservations: true },
      state: { cavemanObservations: false },
      onListThreads: () => harness.switchCurrentThread('thread-2'),
    });

    await restoreOMThreadStateForCurrentThread(harness as never);

    expect(harness.session.state.set).not.toHaveBeenCalled();
    expect(harness.session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('does not seed stale metadata after the current thread changes', async () => {
    const harness = createHarness({
      metadata: {},
      state: { cavemanObservations: true },
      onListThreads: () => harness.switchCurrentThread('thread-2'),
    });

    await restoreOMThreadStateForCurrentThread(harness as never);

    expect(harness.session.state.set).not.toHaveBeenCalled();
    expect(harness.session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('mirrors persisted observeAttachments metadata into harness state', async () => {
    const harness = createHarness({ metadata: { observeAttachments: 'auto' }, state: { observeAttachments: true } });

    await restoreOMThreadStateForCurrentThread(harness as never);

    expect(harness.session.state.set).toHaveBeenCalledWith({ observeAttachments: 'auto' });
    expect(harness.session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('seeds missing observeAttachments metadata from current harness state', async () => {
    const harness = createHarness({ metadata: {}, state: { observeAttachments: false } });

    await restoreOMThreadStateForCurrentThread(harness as never);

    expect(harness.session.state.set).not.toHaveBeenCalled();
    expect(harness.session.thread.setSetting).toHaveBeenCalledWith({ key: 'observeAttachments', value: false });
  });
});
