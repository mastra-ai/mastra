// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useMatchNavigation } from './use-match-navigation';

function keyEvent(key: string, shiftKey = false) {
  return { key, shiftKey, preventDefault: vi.fn() } as unknown as React.KeyboardEvent<HTMLInputElement>;
}

describe('useMatchNavigation', () => {
  it('reports no active match while the list is empty', () => {
    const { result } = renderHook(() => useMatchNavigation({ matches: [] }));

    expect(result.current.activeIndex).toBe(-1);
    expect(result.current.current).toBe(0);
    expect(result.current.total).toBe(0);
  });

  it('activates the first match of a new list and notifies onActiveChange', () => {
    const onActiveChange = vi.fn();
    const { result, rerender } = renderHook(({ matches }) => useMatchNavigation({ matches, onActiveChange }), {
      initialProps: { matches: [] as string[] },
    });

    const matches = ['a', 'b', 'c'];
    rerender({ matches });

    expect(result.current.activeIndex).toBe(0);
    expect(result.current.current).toBe(1);
    expect(result.current.total).toBe(3);
    expect(onActiveChange).toHaveBeenLastCalledWith(0, matches);
  });

  it('notifies onActiveChange with -1 when the list empties, so consumers can clear highlights', () => {
    const onActiveChange = vi.fn();
    const { rerender } = renderHook(({ matches }) => useMatchNavigation({ matches, onActiveChange }), {
      initialProps: { matches: ['a'] },
    });

    const empty: string[] = [];
    rerender({ matches: empty });

    expect(onActiveChange).toHaveBeenLastCalledWith(-1, empty);
  });

  it('does not reset when re-rendered with the same matches array', () => {
    const onActiveChange = vi.fn();
    const matches = ['a', 'b'];
    const { result, rerender } = renderHook(() => useMatchNavigation({ matches, onActiveChange }));

    act(() => result.current.goToNext());
    expect(result.current.activeIndex).toBe(1);

    rerender();
    expect(result.current.activeIndex).toBe(1);
    // One call for the initial list, one for the navigation step — none for the re-render.
    expect(onActiveChange).toHaveBeenCalledTimes(2);
  });

  // NOTE: the match arrays below are hoisted out of the render callback on purpose — `matches` is
  // identity-compared, so an inline literal (new array per render) would reset the active index
  // after every navigation step. Real consumers get this for free by holding matches in state.
  it('steps forward and backward with wraparound', () => {
    const matches = ['a', 'b', 'c'];
    const { result } = renderHook(() => useMatchNavigation({ matches }));

    act(() => result.current.goToNext());
    expect(result.current.current).toBe(2);
    act(() => result.current.goToNext());
    act(() => result.current.goToNext());
    expect(result.current.current).toBe(1); // wrapped past the end

    act(() => result.current.goToPrevious());
    expect(result.current.current).toBe(3); // wrapped past the start
  });

  it('navigates with Enter / Shift+Enter and swallows the event', () => {
    const matches = ['a', 'b'];
    const { result } = renderHook(() => useMatchNavigation({ matches }));

    const enter = keyEvent('Enter');
    act(() => result.current.onSearchKeyDown(enter));
    expect(enter.preventDefault).toHaveBeenCalled();
    expect(result.current.current).toBe(2);

    act(() => result.current.onSearchKeyDown(keyEvent('Enter', true)));
    expect(result.current.current).toBe(1);
  });

  it('ignores arrow keys unless arrowKeys is enabled', () => {
    const matches = ['a', 'b'];
    const { result: plain } = renderHook(() => useMatchNavigation({ matches }));
    const down = keyEvent('ArrowDown');
    act(() => plain.current.onSearchKeyDown(down));
    expect(down.preventDefault).not.toHaveBeenCalled();
    expect(plain.current.current).toBe(1);

    const { result: withArrows } = renderHook(() => useMatchNavigation({ matches, arrowKeys: true }));
    act(() => withArrows.current.onSearchKeyDown(keyEvent('ArrowDown')));
    expect(withArrows.current.current).toBe(2);
    act(() => withArrows.current.onSearchKeyDown(keyEvent('ArrowUp')));
    expect(withArrows.current.current).toBe(1);
  });

  it('ignores navigation while there are no matches', () => {
    const onActiveChange = vi.fn();
    const { result } = renderHook(() => useMatchNavigation({ matches: [], onActiveChange }));

    act(() => result.current.goToNext());
    act(() => result.current.onSearchKeyDown(keyEvent('Enter')));

    expect(result.current.activeIndex).toBe(-1);
    // Only the initial empty-list notification; navigation on nothing is a no-op.
    expect(onActiveChange).toHaveBeenCalledTimes(1);
  });
});
