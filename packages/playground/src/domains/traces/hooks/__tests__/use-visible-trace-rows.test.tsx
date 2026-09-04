// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useVisibleTraceRows } from '../use-visible-trace-rows';

type Callback = (entries: Array<Pick<IntersectionObserverEntry, 'target' | 'isIntersecting'>>) => void;

let callback: Callback | undefined;
const observe = vi.fn();
const disconnect = vi.fn();

beforeEach(() => {
  callback = undefined;
  observe.mockClear();
  disconnect.mockClear();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: Callback) {
        callback = cb;
      }
      observe = observe;
      disconnect = disconnect;
    },
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const makeList = (traceIds: string[]) => {
  const root = document.createElement('div');
  for (const id of traceIds) {
    const row = document.createElement('div');
    row.dataset.traceId = id;
    root.appendChild(row);
  }
  document.body.appendChild(root);
  return root;
};

const row = (root: HTMLElement, id: string) => root.querySelector<HTMLElement>(`[data-trace-id="${id}"]`)!;

describe('useVisibleTraceRows', () => {
  it('observes every trace row and reports visible rows in trace order, topmost first', () => {
    const traceIds = ['trace-a', 'trace-b', 'trace-c'];
    const root = makeList(traceIds);
    const { result } = renderHook(() => useVisibleTraceRows({ current: root }, traceIds));

    expect(observe).toHaveBeenCalledTimes(3);
    expect(result.current).toEqual({ visibleTraceIds: [], currentTraceId: undefined });

    // Entries arrive out of order; the hook still follows the trace order.
    act(() =>
      callback?.([
        { target: row(root, 'trace-c'), isIntersecting: true },
        { target: row(root, 'trace-b'), isIntersecting: true },
      ]),
    );
    expect(result.current).toEqual({ visibleTraceIds: ['trace-b', 'trace-c'], currentTraceId: 'trace-b' });

    act(() => callback?.([{ target: row(root, 'trace-b'), isIntersecting: false }]));
    expect(result.current).toEqual({ visibleTraceIds: ['trace-c'], currentTraceId: 'trace-c' });
  });

  it('disconnects the observer on unmount and does nothing without a list element', () => {
    const root = makeList(['trace-a']);
    const { unmount } = renderHook(() => useVisibleTraceRows({ current: root }, ['trace-a']));
    unmount();
    expect(disconnect).toHaveBeenCalledTimes(1);

    const { result } = renderHook(() => useVisibleTraceRows({ current: null }, ['trace-a']));
    expect(observe).toHaveBeenCalledTimes(1);
    expect(result.current.visibleTraceIds).toEqual([]);
  });
});
