import { describe, expect, it, vi } from 'vitest';

import { attachOMThreadStatePersistence, restoreOMThreadStateForCurrentThread } from './thread-caveman-state.js';

function createSession({
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
  let eventHandler: ((event: any) => void) | undefined;
  const session = {
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
    subscribe: vi.fn((handler: (event: any) => void) => {
      eventHandler = handler;
      return () => {
        eventHandler = undefined;
      };
    }),
    emit: (event: any) => eventHandler?.(event),
    switchCurrentThread: (threadId: string | undefined) => {
      activeThreadId = threadId;
    },
  };

  return session;
}

describe('restoreOMThreadStateForCurrentThread', () => {
  it('mirrors persisted caveman metadata into controller state for the current thread', async () => {
    const session = createSession({ metadata: { cavemanObservations: true }, state: { cavemanObservations: false } });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.thread.list).toHaveBeenCalledWith({ allResources: true });
    expect(session.state.set).toHaveBeenCalledWith({ cavemanObservations: true });
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('mirrors persisted false caveman metadata into controller state for the current thread', async () => {
    const session = createSession({ metadata: { cavemanObservations: false }, state: { cavemanObservations: true } });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.thread.list).toHaveBeenCalledWith({ allResources: true });
    expect(session.state.set).toHaveBeenCalledWith({ cavemanObservations: false });
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('seeds missing thread metadata from the current controller state', async () => {
    const session = createSession({ metadata: {}, state: { cavemanObservations: true } });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.state.set).not.toHaveBeenCalled();
    expect(session.thread.setSetting).toHaveBeenCalledWith({ key: 'cavemanObservations', value: true });
  });

  it('seeds missing thread metadata from false current controller state', async () => {
    const session = createSession({ metadata: {}, state: { cavemanObservations: false } });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.state.set).not.toHaveBeenCalled();
    expect(session.thread.setSetting).toHaveBeenCalledWith({ key: 'cavemanObservations', value: false });
  });

  it('does nothing when there is no current thread', async () => {
    const session = createSession({ currentThreadId: '', metadata: { cavemanObservations: true } });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.thread.list).not.toHaveBeenCalled();
    expect(session.state.set).not.toHaveBeenCalled();
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('does not apply stale persisted metadata after the current thread changes', async () => {
    const session = createSession({
      metadata: { cavemanObservations: true },
      state: { cavemanObservations: false },
      onListThreads: () => session.switchCurrentThread('thread-2'),
    });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.state.set).not.toHaveBeenCalled();
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('does not seed stale metadata after the current thread changes', async () => {
    const session = createSession({
      metadata: {},
      state: { cavemanObservations: true },
      onListThreads: () => session.switchCurrentThread('thread-2'),
    });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.state.set).not.toHaveBeenCalled();
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('mirrors persisted observeAttachments metadata into controller state', async () => {
    const session = createSession({ metadata: { observeAttachments: 'auto' }, state: { observeAttachments: true } });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.state.set).toHaveBeenCalledWith({ observeAttachments: 'auto' });
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('seeds missing observeAttachments metadata from current controller state', async () => {
    const session = createSession({ metadata: {}, state: { observeAttachments: false } });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.state.set).not.toHaveBeenCalled();
    expect(session.thread.setSetting).toHaveBeenCalledWith({ key: 'observeAttachments', value: false });
  });

  it('mirrors persisted sandboxAllowedPaths metadata into controller state', async () => {
    const session = createSession({
      metadata: { sandboxAllowedPaths: ['/outside/project'] },
      state: { sandboxAllowedPaths: [] },
    });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.state.set).toHaveBeenCalledWith({ sandboxAllowedPaths: ['/outside/project'] });
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('clears sandboxAllowedPaths when the current thread has no sandbox metadata', async () => {
    const session = createSession({ metadata: {}, state: { sandboxAllowedPaths: ['/outside/project'] } });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.state.set).toHaveBeenCalledWith({ sandboxAllowedPaths: [] });
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('does not update sandboxAllowedPaths when missing metadata already matches the cleared state', async () => {
    const session = createSession({ metadata: {}, state: { sandboxAllowedPaths: [] } });

    await restoreOMThreadStateForCurrentThread(session as never);

    expect(session.state.set).not.toHaveBeenCalled();
    expect(session.thread.setSetting).not.toHaveBeenCalled();
  });

  it('persists sandboxAllowedPaths state changes back to the current thread', async () => {
    const session = createSession({ metadata: {}, state: { sandboxAllowedPaths: ['/outside/project'] } });
    attachOMThreadStatePersistence(session as never);

    session.emit({
      type: 'state_changed',
      state: { sandboxAllowedPaths: ['/outside/project'] },
      changedKeys: ['sandboxAllowedPaths'],
    });

    expect(session.thread.setSetting).toHaveBeenCalledWith({
      key: 'sandboxAllowedPaths',
      value: ['/outside/project'],
    });
  });
});
