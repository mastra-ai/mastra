// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useTraceFilterPersistence } from '../use-trace-filter-persistence';
import type { SetURLSearchParamsLike } from '../use-trace-url-state';

const KEY = 'test:traces:saved-filters';

let currentSearch: string;
let setSearch: SetURLSearchParamsLike;
let setSearchWithoutPersistence: (next: string) => void;

function Harness({ initial }: { initial: string }) {
  const [params, setParams] = useState(() => new URLSearchParams(initial));
  currentSearch = params.toString();
  setSearchWithoutPersistence = next => setParams(new URLSearchParams(next));
  const setSearchParams = useCallback<SetURLSearchParamsLike>(next => {
    setParams(prev => (typeof next === 'function' ? next(new URLSearchParams(prev)) : new URLSearchParams(next)));
  }, []);
  setSearch = useTraceFilterPersistence(params, setSearchParams, { storageKey: KEY });
  return null;
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('useTraceFilterPersistence', () => {
  it('restores the saved filters when the URL is filter-clean', () => {
    localStorage.setItem(KEY, 'status=error&datePreset=last-7d');

    render(<Harness initial="" />);

    expect(currentSearch).toBe('status=error&datePreset=last-7d');
    // Restoring must not be mistaken for a change that rewrites storage.
    expect(localStorage.getItem(KEY)).toBe('status=error&datePreset=last-7d');
  });

  it('keeps the saved set intact when the URL already carries filters', () => {
    localStorage.setItem(KEY, 'status=error');

    render(<Harness initial="status=success" />);

    expect(currentSearch).toBe('status=success');
    expect(localStorage.getItem(KEY)).toBe('status=error');
  });

  it('saves every change made through the returned setter (value form)', () => {
    render(<Harness initial="" />);

    act(() => setSearch(new URLSearchParams('status=error&datePreset=last-24h')));
    expect(currentSearch).toBe('status=error&datePreset=last-24h');
    expect(localStorage.getItem(KEY)).toBe('status=error&datePreset=last-24h');

    act(() => setSearch(new URLSearchParams('status=error&datePreset=custom&dateFrom=2026-01-01&dateTo=2026-01-02')));
    expect(localStorage.getItem(KEY)).toBe('status=error');
  });

  it('saves every change made through the returned setter (updater form)', () => {
    render(<Harness initial="status=error" />);

    act(() =>
      setSearch(prev => {
        const next = new URLSearchParams(prev);
        next.set('datePreset', 'last-7d');
        return next;
      }),
    );

    expect(currentSearch).toBe('status=error&datePreset=last-7d');
    expect(localStorage.getItem(KEY)).toBe('status=error&datePreset=last-7d');
  });

  it('forgets the saved set once all filters are removed', () => {
    localStorage.setItem(KEY, 'status=error');
    render(<Harness initial="status=error" />);

    act(() => setSearch(new URLSearchParams()));

    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it('does not touch storage when the URL changes outside the returned setter', () => {
    localStorage.setItem(KEY, 'status=error');
    render(<Harness initial="status=error" />);

    act(() => setSearchWithoutPersistence('status=success'));

    expect(localStorage.getItem(KEY)).toBe('status=error');
  });
});
