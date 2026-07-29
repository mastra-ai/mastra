import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Returns the index of the next match when stepping `direction` (1 = forward, -1 = backward) from
 * `current`, wrapping around at both ends (like a browser's find bar). Returns -1 when there are no
 * matches so callers can treat "no active match" uniformly.
 */
export function getNextMatchIndex(current: number, count: number, direction: 1 | -1): number {
  if (count <= 0) return -1;
  return (current + direction + count) % count;
}

export interface UseMatchNavigationOptions<T> {
  /**
   * The current list of matches, in display order. Passing a new array (e.g. after re-running a
   * search) resets the active match to the first one and notifies `onActiveChange`.
   */
  matches: T[];
  /**
   * Called whenever the active match changes — on navigation, and once per new `matches` list
   * (with index 0, or -1 when the list is empty, so consumers can also clear stale highlights).
   */
  onActiveChange?: (activeIndex: number, matches: T[]) => void;
  /**
   * Also step with ArrowDown / ArrowUp in `onSearchKeyDown`. Off by default: inside a text input
   * the arrows normally move the caret, so opt in only where list-style navigation is expected.
   */
  arrowKeys?: boolean;
}

export interface MatchNavigation {
  /** Index of the active match in `matches`, or -1 when there are none. */
  activeIndex: number;
  /** 1-based position of the active match for "current/total" counters; 0 when there are none. */
  current: number;
  /** Total number of matches. */
  total: number;
  /** Step to the next match, wrapping around at the end. */
  goToNext: () => void;
  /** Step to the previous match, wrapping around at the start. */
  goToPrevious: () => void;
  /** Keydown handler for the search input: Enter / Shift+Enter (and optionally ArrowDown/Up). */
  onSearchKeyDown: React.KeyboardEventHandler<HTMLInputElement>;
}

/**
 * Browser-find-bar-style navigation over an arbitrary list of matches: tracks which match is
 * active, steps forward/backward with wraparound, and exposes the standard keyboard bindings
 * (Enter / Shift+Enter, optionally ArrowDown/ArrowUp).
 *
 * The hook is agnostic about what a "match" is and what navigating to it means — consumers react
 * through `onActiveChange` (e.g. highlight a text range and scroll it into view, or scroll a
 * matching row into view). Pair it with a counter UI such as `MatchNav` for the "3/12" display.
 */
export function useMatchNavigation<T>({
  matches,
  onActiveChange,
  arrowKeys = false,
}: UseMatchNavigationOptions<T>): MatchNavigation {
  const [activeIndex, setActiveIndex] = useState(-1);

  // Reset to the first match whenever a new match list arrives. Identity-compared via a ref so a
  // re-render with the same array (or an unstable `onActiveChange`) doesn't re-trigger the reset.
  const lastMatchesRef = useRef<T[] | null>(null);
  useEffect(() => {
    if (lastMatchesRef.current === matches) return;
    lastMatchesRef.current = matches;
    const index = matches.length > 0 ? 0 : -1;
    setActiveIndex(index);
    onActiveChange?.(index, matches);
  }, [matches, onActiveChange]);

  const goTo = useCallback(
    (direction: 1 | -1) => {
      if (matches.length === 0) return;
      const nextIndex = getNextMatchIndex(activeIndex, matches.length, direction);
      setActiveIndex(nextIndex);
      onActiveChange?.(nextIndex, matches);
    },
    [matches, activeIndex, onActiveChange],
  );

  const goToNext = useCallback(() => goTo(1), [goTo]);
  const goToPrevious = useCallback(() => goTo(-1), [goTo]);

  const onSearchKeyDown = useCallback<React.KeyboardEventHandler<HTMLInputElement>>(
    e => {
      const isArrowStep = arrowKeys && (e.key === 'ArrowDown' || e.key === 'ArrowUp');
      if (e.key !== 'Enter' && !isArrowStep) return;
      e.preventDefault();
      const backwards = e.key === 'ArrowUp' || (e.key === 'Enter' && e.shiftKey);
      goTo(backwards ? -1 : 1);
    },
    [goTo, arrowKeys],
  );

  return {
    activeIndex,
    current: activeIndex >= 0 ? activeIndex + 1 : 0,
    total: matches.length,
    goToNext,
    goToPrevious,
    onSearchKeyDown,
  };
}
