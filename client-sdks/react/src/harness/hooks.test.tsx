// @vitest-environment jsdom

import type { HarnessSessionSnapshot, RemoteHarnessEventUnsubscribe } from '@mastra/client-js';
import type { HarnessEvent } from '@mastra/core/harness/v1';
import { act } from 'react';
import type { Root } from 'react-dom/client';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockMastraClient = vi.hoisted(() => ({
  getHarness: vi.fn(),
}));

vi.mock('@mastra/client-js', () => ({
  MastraClient: class MockMastraClient {},
}));

vi.mock('../mastra-client-context', () => ({
  useMastraClient: () => mockMastraClient,
}));

import type { UseRemoteHarnessSessionResult } from './hooks';
import { useHarnessSession, useRemoteHarnessSession } from './hooks';

function makeSnapshot(overrides: Partial<HarnessSessionSnapshot> = {}): HarnessSessionSnapshot {
  return {
    summary: {
      sessionId: 'session-1',
      harnessName: 'default',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      lifecycle: 'active',
      createdAt: 1,
      lastActivityAt: 2,
      modeId: 'ask',
      modelId: 'openai/gpt-5',
      busy: false,
      queueDepth: 0,
      pendingInbox: { count: 0, kinds: [], sessionOwnedOnly: true },
      durableWork: {
        activeCount: 0,
        waitingCount: 0,
        retryingCount: 0,
        failedCount: 0,
        sessionOwnedOnly: true,
      },
      ...overrides.summary,
    },
    state: {},
    queue: { depth: 0, queuedItemIds: [] },
    pendingInbox: [],
    durableWork: { active: [], recentTerminal: [], truncated: false, sessionOwnedOnly: true },
    channelBindings: [],
    tokenUsage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    messages: { cursor: { threadId: 'thread-1', route: 'thread-messages' } },
    ...overrides,
  } as HarnessSessionSnapshot;
}

function makeEvent(overrides: Partial<HarnessEvent> = {}): HarnessEvent {
  return {
    id: 'harness-v1:epoch-1:1',
    type: 'agent_end',
    sessionId: 'session-1',
    runId: 'run-1',
    reason: 'complete',
    timestamp: 3,
    ...overrides,
  } as HarnessEvent;
}

function createDeferred<T>() {
  let resolve: (value: T) => void;
  let reject: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });
  return { promise, reject: reject!, resolve: resolve! };
}

class FakeRemoteSession {
  readonly refresh = vi.fn<() => Promise<HarnessSessionSnapshot>>();
  readonly subscribe = vi.fn<
    (listener: (event: HarnessEvent) => void | Promise<void>, options: any) => RemoteHarnessEventUnsubscribe
  >();
  listener: ((event: HarnessEvent) => void | Promise<void>) | undefined;
  unsubscribe = vi.fn();

  constructor(snapshots: HarnessSessionSnapshot[]) {
    for (const snapshot of snapshots) {
      this.refresh.mockResolvedValueOnce(snapshot);
    }
    this.refresh.mockResolvedValue(snapshots.at(-1) ?? makeSnapshot());
    this.subscribe.mockImplementation(listener => {
      this.listener = listener;
      return this.unsubscribe;
    });
  }

  emit(event: HarnessEvent) {
    return this.listener?.(event);
  }
}

let root: Root;
let container: HTMLDivElement;

beforeEach(() => {
  mockMastraClient.getHarness.mockReset();
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function renderHarnessHook(
  session: FakeRemoteSession,
  options: Parameters<typeof useRemoteHarnessSession>[1] = {},
): { latest: () => UseRemoteHarnessSessionResult } {
  let latest: UseRemoteHarnessSessionResult | undefined;

  function Probe() {
    latest = useRemoteHarnessSession(session as any, options);
    return null;
  }

  act(() => {
    root.render(<Probe />);
  });

  return {
    latest: () => {
      if (!latest) throw new Error('hook did not render');
      return latest;
    },
  };
}

function renderHarnessHookWithOptions(
  session: FakeRemoteSession,
  getOptions: (renderCount: number) => Parameters<typeof useRemoteHarnessSession>[1],
): { latest: () => UseRemoteHarnessSessionResult; rerender: (renderCount: number) => void } {
  let latest: UseRemoteHarnessSessionResult | undefined;

  function Probe({ renderCount }: { renderCount: number }) {
    latest = useRemoteHarnessSession(session as any, getOptions(renderCount));
    return null;
  }

  act(() => {
    root.render(<Probe renderCount={0} />);
  });

  return {
    latest: () => {
      if (!latest) throw new Error('hook did not render');
      return latest;
    },
    rerender: renderCount => {
      act(() => {
        root.render(<Probe renderCount={renderCount} />);
      });
    },
  };
}

function renderHarnessSessionHook(
  options: Parameters<typeof useHarnessSession>[0] = {},
): { latest: () => UseRemoteHarnessSessionResult; rerender: (nextOptions: Parameters<typeof useHarnessSession>[0]) => void } {
  let latest: UseRemoteHarnessSessionResult | undefined;

  function Probe({ hookOptions }: { hookOptions: Parameters<typeof useHarnessSession>[0] }) {
    latest = useHarnessSession(hookOptions);
    return null;
  }

  act(() => {
    root.render(<Probe hookOptions={options} />);
  });

  return {
    latest: () => {
      if (!latest) throw new Error('hook did not render');
      return latest;
    },
    rerender: nextOptions => {
      act(() => {
        root.render(<Probe hookOptions={nextOptions} />);
      });
    },
  };
}

describe('useHarnessSession', () => {
  it('opens a named RemoteSession through the Mastra client context', async () => {
    const remoteSession = new FakeRemoteSession([makeSnapshot()]);
    const openSession = vi.fn().mockResolvedValue(remoteSession);
    mockMastraClient.getHarness.mockReturnValue({ session: openSession });

    const rendered = renderHarnessSessionHook({
      harnessName: 'doxa',
      modeId: 'ask',
      sessionId: 'session-1',
    });

    await vi.waitFor(() => expect(rendered.latest().session).toBe(remoteSession));

    expect(mockMastraClient.getHarness).toHaveBeenCalledWith('doxa');
    expect(openSession).toHaveBeenCalledWith({ modeId: 'ask', sessionId: 'session-1' });
  });

  it('clears open errors when the hook is disabled', async () => {
    const openError = new Error('open failed');
    mockMastraClient.getHarness.mockReturnValue({ session: vi.fn().mockRejectedValue(openError) });
    const rendered = renderHarnessSessionHook({ harnessName: 'doxa' });

    await vi.waitFor(() => expect(rendered.latest().error).toBe(openError));
    rendered.rerender({ enabled: false, harnessName: 'doxa' });

    await vi.waitFor(() => expect(rendered.latest().error).toBeUndefined());
  });
});

describe('useRemoteHarnessSession', () => {
  it('exposes snapshot pending inbox and durable work summaries from RemoteSession.refresh()', async () => {
    const snapshot = makeSnapshot({
      pendingInbox: [{ itemId: 'inbox-1', kind: 'question', status: 'pending', createdAt: 4 } as any],
      durableWork: {
        active: [{ id: 'work-1', kind: 'message', status: 'running' } as any],
        recentTerminal: [],
        truncated: false,
        sessionOwnedOnly: true,
      },
    });
    const session = new FakeRemoteSession([snapshot]);
    const rendered = renderHarnessHook(session);

    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(snapshot));

    expect(rendered.latest().pendingInbox).toEqual(snapshot.pendingInbox);
    expect(rendered.latest().durableWork).toEqual(snapshot.durableWork);
    expect(session.subscribe).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({ reconnect: true }));
  });

  it('tracks events and refreshes from the RemoteSession subscription without legacy agent resources', async () => {
    const first = makeSnapshot();
    const second = makeSnapshot({ pendingInbox: [{ itemId: 'approval-1', kind: 'tool-approval' } as any] });
    const session = new FakeRemoteSession([first, second]);
    const onEvent = vi.fn();
    const rendered = renderHarnessHook(session, { onEvent });
    const event = makeEvent();

    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(first));
    await act(async () => {
      await session.emit(event);
    });

    expect(rendered.latest().events).toEqual([event]);
    await vi.waitFor(() => expect(rendered.latest().pendingInbox).toEqual(second.pendingInbox));
    expect(onEvent).toHaveBeenCalledWith(event);
    expect(session.refresh).toHaveBeenCalledTimes(2);
  });

  it('refreshes from events before waiting for slow consumer callbacks', async () => {
    const first = makeSnapshot();
    const second = makeSnapshot({ pendingInbox: [{ itemId: 'approval-1', kind: 'tool-approval' } as any] });
    const eventCallback = createDeferred<void>();
    const onEvent = vi.fn(() => eventCallback.promise);
    const session = new FakeRemoteSession([first, second]);
    const rendered = renderHarnessHook(session, { onEvent });

    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(first));
    const event = makeEvent();
    let eventPromise: void | Promise<void>;
    act(() => {
      eventPromise = session.emit(event);
    });

    await vi.waitFor(() => expect(session.refresh).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(second));
    expect(onEvent).toHaveBeenCalledWith(event);

    await act(async () => {
      eventCallback.resolve();
      await eventPromise;
    });
  });

  it('keeps event cursors moving when consumer event callbacks reject', async () => {
    const first = makeSnapshot();
    const second = makeSnapshot({ pendingInbox: [{ itemId: 'question-1', kind: 'question' } as any] });
    const session = new FakeRemoteSession([first, second]);
    const eventError = new Error('consumer callback failed');
    const onEvent = vi.fn().mockRejectedValue(eventError);
    const onError = vi.fn();
    const rendered = renderHarnessHook(session, { onEvent, onError });
    const event = makeEvent();

    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(first));
    await expect(
      act(async () => {
        await session.emit(event);
      }),
    ).resolves.toBeUndefined();

    expect(rendered.latest().events).toEqual([event]);
    await vi.waitFor(() => expect(rendered.latest().pendingInbox).toEqual(second.pendingInbox));
    expect(onError).toHaveBeenCalledWith(eventError);
    expect(session.refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps the stream open when callback identities change across renders', async () => {
    const session = new FakeRemoteSession([makeSnapshot()]);
    const rendered = renderHarnessHookWithOptions(session, renderCount => ({
      onEvent: vi.fn(() => {
        void renderCount;
      }),
      onError: vi.fn(),
      onReplayGap: vi.fn(),
    }));

    await vi.waitFor(() => expect(rendered.latest().snapshot).toBeDefined());
    rendered.rerender(1);

    expect(session.unsubscribe).not.toHaveBeenCalled();
    expect(session.subscribe).toHaveBeenCalledTimes(1);
  });

  it('trims retained events when maxEvents shrinks', async () => {
    const session = new FakeRemoteSession([makeSnapshot()]);
    const rendered = renderHarnessHookWithOptions(session, renderCount => ({
      maxEvents: renderCount === 0 ? 3 : 1,
      refreshOnEvent: false,
    }));
    const firstEvent = makeEvent({ id: 'harness-v1:epoch-1:1' });
    const secondEvent = makeEvent({ id: 'harness-v1:epoch-1:2' });
    const thirdEvent = makeEvent({ id: 'harness-v1:epoch-1:3' });

    await vi.waitFor(() => expect(rendered.latest().snapshot).toBeDefined());
    await act(async () => {
      await session.emit(firstEvent);
      await session.emit(secondEvent);
      await session.emit(thirdEvent);
    });

    expect(rendered.latest().events).toEqual([firstEvent, secondEvent, thirdEvent]);
    rendered.rerender(1);

    expect(rendered.latest().events).toEqual([thirdEvent]);
  });

  it('passes replay options through to client-js and refreshes on replay gaps', async () => {
    const first = makeSnapshot();
    const second = makeSnapshot({ durableWork: { active: [], recentTerminal: [], truncated: true, sessionOwnedOnly: true } });
    const session = new FakeRemoteSession([first, second]);
    const onReplayGap = vi.fn();
    const rendered = renderHarnessHook(session, {
      lastEventId: 'harness-v1:epoch-1:7',
      reconnect: true,
      onReplayGap,
    });

    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(first));
    const subscribeOptions = session.subscribe.mock.calls[0]?.[1];
    expect(subscribeOptions).toMatchObject({ lastEventId: 'harness-v1:epoch-1:7', reconnect: true });

    await act(async () => {
      await subscribeOptions.onReplayGap();
    });

    expect(rendered.latest().snapshot).toBe(second);
    expect(onReplayGap).toHaveBeenCalledTimes(1);
  });

  it('coalesces refresh requests while a snapshot refresh is in flight', async () => {
    const first = makeSnapshot();
    const second = makeSnapshot({ pendingInbox: [{ itemId: 'question-2', kind: 'question' } as any] });
    const third = makeSnapshot({ pendingInbox: [{ itemId: 'question-3', kind: 'question' } as any] });
    const session = new FakeRemoteSession([first]);
    const rendered = renderHarnessHook(session);

    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(first));
    session.refresh.mockReset();

    let resolveFirstRefresh: (() => void) | undefined;
    session.refresh.mockImplementationOnce(
      () =>
        new Promise<HarnessSessionSnapshot>(resolve => {
          resolveFirstRefresh = () => resolve(second);
        }),
    );
    session.refresh.mockResolvedValue(third);

    const firstRefresh = rendered.latest().refresh();
    const queuedRefresh = rendered.latest().refresh();

    expect(session.refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFirstRefresh?.();
      await expect(firstRefresh).resolves.toBe(second);
      await expect(queuedRefresh).resolves.toBe(third);
    });

    await vi.waitFor(() => expect(session.refresh).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(third));
  });

  it('allocates a fresh queued refresh promise for each queued refresh cycle', async () => {
    const first = makeSnapshot();
    const second = makeSnapshot({ pendingInbox: [{ itemId: 'question-2', kind: 'question' } as any] });
    const third = makeSnapshot({ pendingInbox: [{ itemId: 'question-3', kind: 'question' } as any] });
    const fourth = makeSnapshot({ pendingInbox: [{ itemId: 'question-4', kind: 'question' } as any] });
    const firstRefresh = createDeferred<HarnessSessionSnapshot>();
    const secondRefresh = createDeferred<HarnessSessionSnapshot>();
    const thirdRefresh = createDeferred<HarnessSessionSnapshot>();
    const session = new FakeRemoteSession([first]);
    const rendered = renderHarnessHook(session);

    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(first));
    session.refresh.mockReset();
    session.refresh
      .mockImplementationOnce(() => firstRefresh.promise)
      .mockImplementationOnce(() => secondRefresh.promise)
      .mockImplementationOnce(() => thirdRefresh.promise);

    const firstRefreshPromise = rendered.latest().refresh();
    const queuedRefreshPromise = rendered.latest().refresh();
    expect(session.refresh).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstRefresh.resolve(second);
      await expect(firstRefreshPromise).resolves.toBe(second);
    });
    await vi.waitFor(() => expect(session.refresh).toHaveBeenCalledTimes(2));

    const nextQueuedRefreshPromise = rendered.latest().refresh();
    expect(session.refresh).toHaveBeenCalledTimes(2);

    await act(async () => {
      secondRefresh.resolve(third);
      await expect(queuedRefreshPromise).resolves.toBe(third);
    });
    await vi.waitFor(() => expect(session.refresh).toHaveBeenCalledTimes(3));

    await act(async () => {
      thirdRefresh.resolve(fourth);
      await expect(nextQueuedRefreshPromise).resolves.toBe(fourth);
    });
    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(fourth));
  });

  it('unsubscribes from the RemoteSession stream on cleanup', async () => {
    const session = new FakeRemoteSession([makeSnapshot()]);
    renderHarnessHook(session);

    await vi.waitFor(() => expect(session.subscribe).toHaveBeenCalledTimes(1));
    act(() => root.unmount());

    expect(session.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('reports synchronous subscription failures', async () => {
    const subscribeError = new Error('subscribe failed');
    const onError = vi.fn();
    const session = new FakeRemoteSession([makeSnapshot()]);
    session.subscribe.mockImplementationOnce(() => {
      throw subscribeError;
    });
    const rendered = renderHarnessHook(session, { onError });

    await vi.waitFor(() => expect(rendered.latest().error).toBe(subscribeError));

    expect(onError).toHaveBeenCalledWith(subscribeError);
    expect(rendered.latest().isSubscribed).toBe(false);
  });

  it('clears subscribed state when a resubscribe fails', async () => {
    const subscribeError = new Error('resubscribe failed');
    const onError = vi.fn();
    const session = new FakeRemoteSession([makeSnapshot()]);
    const rendered = renderHarnessHookWithOptions(session, renderCount => ({
      lastEventId: `harness-v1:epoch-1:${renderCount + 1}`,
      onError,
    }));

    await vi.waitFor(() => expect(rendered.latest().isSubscribed).toBe(true));
    session.subscribe.mockImplementationOnce(() => {
      throw subscribeError;
    });
    rendered.rerender(1);

    await vi.waitFor(() => expect(rendered.latest().error).toBe(subscribeError));
    expect(onError).toHaveBeenCalledWith(subscribeError);
    expect(rendered.latest().isSubscribed).toBe(false);
    expect(session.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it('clears subscribed state when a terminal stream error is reported', async () => {
    const onError = vi.fn();
    const session = new FakeRemoteSession([makeSnapshot()]);
    const rendered = renderHarnessHook(session, { onError });

    await vi.waitFor(() => expect(rendered.latest().isSubscribed).toBe(true));
    const subscribeOptions = session.subscribe.mock.calls[0]?.[1];

    await act(async () => {
      await subscribeOptions.onError(Object.assign(new Error('forbidden'), { status: 403 }));
    });

    expect(rendered.latest().isSubscribed).toBe(false);
    expect(rendered.latest().error?.message).toBe('forbidden');
    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it('does not run queued event refreshes after cleanup', async () => {
    const initialRefresh = createDeferred<HarnessSessionSnapshot>();
    const session = new FakeRemoteSession([makeSnapshot()]);
    session.refresh.mockReset();
    session.refresh.mockImplementationOnce(() => initialRefresh.promise);
    session.refresh.mockResolvedValue(makeSnapshot());
    const onError = vi.fn();
    let resolveEvent: (() => void) | undefined;
    const onEvent = vi.fn(
      () =>
        new Promise<void>(resolve => {
          resolveEvent = resolve;
        }),
    );
    renderHarnessHook(session, { onError, onEvent });

    await vi.waitFor(() => expect(session.refresh).toHaveBeenCalledTimes(1));
    const eventPromise = session.emit(makeEvent());
    act(() => root.unmount());
    await act(async () => {
      initialRefresh.resolve(makeSnapshot());
      resolveEvent?.();
      await eventPromise;
    });

    expect(session.unsubscribe).toHaveBeenCalledTimes(1);
    expect(session.refresh).toHaveBeenCalledTimes(1);
    expect(onError).not.toHaveBeenCalled();
  });

  it('resolves queued refresh waiters during cleanup', async () => {
    const first = makeSnapshot();
    const second = makeSnapshot({ pendingInbox: [{ itemId: 'question-2', kind: 'question' } as any] });
    const firstRefresh = createDeferred<HarnessSessionSnapshot>();
    const session = new FakeRemoteSession([first]);
    const rendered = renderHarnessHook(session);

    await vi.waitFor(() => expect(rendered.latest().snapshot).toBe(first));
    session.refresh.mockReset();
    session.refresh.mockImplementationOnce(() => firstRefresh.promise);

    const firstRefreshPromise = rendered.latest().refresh();
    const queuedRefreshPromise = rendered.latest().refresh();
    expect(session.refresh).toHaveBeenCalledTimes(1);

    act(() => root.unmount());
    await expect(queuedRefreshPromise).resolves.toBeUndefined();

    await act(async () => {
      firstRefresh.resolve(second);
      await expect(firstRefreshPromise).resolves.toBe(second);
    });

    expect(session.refresh).toHaveBeenCalledTimes(1);
  });
});
