// @vitest-environment jsdom
import type { ThreadSignalsClient, ThreadSignalsSubscription } from '@mastra/client-js/thread-signals';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useThreadSignals } from './use-thread-signals';

describe('useThreadSignals', () => {
  it('subscribes before loading history and projects the native run snapshot', async () => {
    const calls: string[] = [];
    const unsubscribe = vi.fn();
    const subscription: ThreadSignalsSubscription = {
      snapshot: { status: 'idle', updatedAt: '2026-08-07T00:00:00.000Z' },
      processDataStream: vi.fn(async options => {
        await options.onSnapshot?.({
          runId: 'run-1',
          status: 'running',
          updatedAt: '2026-08-07T00:00:01.000Z',
        });
        await options.onChunk({ type: 'start', runId: 'run-1' });
      }),
      abort: vi.fn(async () => true),
      unsubscribe,
    };
    const client = {
      subscribeToThread: vi.fn(async () => {
        calls.push('subscribe');
        return subscription;
      }),
      listMessages: vi.fn(async () => {
        calls.push('history');
        return {
          messages: [{ id: 'message-1' }],
          total: 1,
          page: 0,
          perPage: 100,
          hasMore: false,
        };
      }),
      sendMessage: vi.fn(async () => ({ accepted: true, runId: 'run-1' })),
      queueMessage: vi.fn(async () => ({ accepted: true, runId: 'run-1' })),
      sendToolApproval: vi.fn(async () => ({
        accepted: true,
        runId: 'run-1',
        toolCallId: 'tool-1',
      })),
    } as unknown as ThreadSignalsClient;

    const { result, unmount } = renderHook(() =>
      useThreadSignals<{ id: string }>({
        client,
        threadId: 'thread-1',
        resourceId: 'resource-1',
      }),
    );

    await waitFor(() => expect(result.current.snapshot.status).toBe('running'));
    expect(calls).toEqual(['subscribe', 'history']);
    expect(result.current.messages).toEqual([{ id: 'message-1' }]);
    expect(result.current.chunks).toEqual([{ type: 'start', runId: 'run-1' }]);

    await act(() => result.current.abort());
    expect(subscription.abort).toHaveBeenCalledOnce();
    unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('clears old messages and ignores stale history after switching threads', async () => {
    const historyResolvers = new Map<
      string,
      (value: {
        messages: Array<{ id: string }>;
        total: number;
        page: number;
        perPage: number;
        hasMore: boolean;
      }) => void
    >();
    const subscriptions: ThreadSignalsSubscription[] = [];
    const client = {
      subscribeToThread: vi.fn(async () => {
        const subscription: ThreadSignalsSubscription = {
          snapshot: { status: 'idle', updatedAt: '2026-08-07T00:00:00.000Z' },
          processDataStream: vi.fn(async () => {}),
          abort: vi.fn(async () => true),
          unsubscribe: vi.fn(),
        };
        subscriptions.push(subscription);
        return subscription;
      }),
      listMessages: vi.fn(
        (threadId: string) =>
          new Promise(resolve => {
            historyResolvers.set(threadId, resolve);
          }),
      ),
      sendMessage: vi.fn(),
      queueMessage: vi.fn(),
      sendToolApproval: vi.fn(),
    } as unknown as ThreadSignalsClient;

    const { result, rerender } = renderHook(
      ({ threadId }) => useThreadSignals<{ id: string }>({ client, threadId }),
      { initialProps: { threadId: 'thread-1' } },
    );

    await waitFor(() => expect(historyResolvers.has('thread-1')).toBe(true));
    rerender({ threadId: 'thread-2' });

    expect(result.current.messages).toEqual([]);
    await waitFor(() => expect(historyResolvers.has('thread-2')).toBe(true));

    await act(async () => {
      historyResolvers.get('thread-2')?.({
        messages: [{ id: 'message-2' }],
        total: 1,
        page: 0,
        perPage: 100,
        hasMore: false,
      });
    });
    await waitFor(() => expect(result.current.messages).toEqual([{ id: 'message-2' }]));

    await act(async () => {
      historyResolvers.get('thread-1')?.({
        messages: [{ id: 'message-1' }],
        total: 1,
        page: 0,
        perPage: 100,
        hasMore: false,
      });
    });

    expect(result.current.messages).toEqual([{ id: 'message-2' }]);
    expect(subscriptions[0]?.unsubscribe).toHaveBeenCalledOnce();
  });
});
