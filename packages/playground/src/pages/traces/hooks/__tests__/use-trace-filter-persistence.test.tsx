// @vitest-environment jsdom
import type { SetURLSearchParamsLike } from '@mastra/playground-ui/sort/use-url-sort';
import { act, cleanup, render } from '@testing-library/react';
import { useCallback, useState } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { useTraceFilterPersistence } from '../use-trace-filter-persistence';

const KEY = 'test:traces:saved-filters';

let currentSearch: string;
let setSearch: SetURLSearchParamsLike;
let setSearchWithoutPersistence: (next: string) => void;

function Harness({ initial, excludeParams }: { initial: string; excludeParams?: readonly string[] }) {
  const [params, setParams] = useState(() => new URLSearchParams(initial));
  currentSearch = params.toString();
  setSearchWithoutPersistence = next => setParams(new URLSearchParams(next));
  const setSearchParams = useCallback<SetURLSearchParamsLike>(next => {
    setParams(prev => (typeof next === 'function' ? next(new URLSearchParams(prev)) : new URLSearchParams(next)));
  }, []);
  setSearch = useTraceFilterPersistence(params, setSearchParams, { storageKey: KEY, excludeParams });
  return null;
}

beforeEach(() => localStorage.clear());
afterEach(() => cleanup());

describe('useTraceFilterPersistence', () => {
  describe('when filters are saved and the URL is filter-clean', () => {
    it('restores the saved filters without rewriting storage', () => {
      localStorage.setItem(KEY, 'status=error&datePreset=last-7d');

      render(<Harness initial="" />);

      expect(currentSearch).toBe('status=error&datePreset=last-7d');
      // Restoring must not be mistaken for a change that rewrites storage.
      expect(localStorage.getItem(KEY)).toBe('status=error&datePreset=last-7d');
    });
  });

  describe('when filters are saved and the URL already carries filters', () => {
    it('keeps the URL and the saved set intact', () => {
      localStorage.setItem(KEY, 'status=error');

      render(<Harness initial="status=success" />);

      expect(currentSearch).toBe('status=success');
      expect(localStorage.getItem(KEY)).toBe('status=error');
    });
  });

  describe('when the returned setter receives a value', () => {
    it('saves every change', () => {
      render(<Harness initial="" />);

      act(() => setSearch(new URLSearchParams('status=error&datePreset=last-24h')));
      expect(currentSearch).toBe('status=error&datePreset=last-24h');
      expect(localStorage.getItem(KEY)).toBe('status=error&datePreset=last-24h');

      act(() => setSearch(new URLSearchParams('status=error&datePreset=custom&dateFrom=2026-01-01&dateTo=2026-01-02')));
      expect(localStorage.getItem(KEY)).toBe('status=error');
    });
  });

  describe('when the returned setter receives an updater', () => {
    it('saves the resolved params', () => {
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
  });

  describe('when all filters are removed', () => {
    it('forgets the saved set', () => {
      localStorage.setItem(KEY, 'status=error');
      render(<Harness initial="status=error" />);

      act(() => setSearch(new URLSearchParams()));

      expect(localStorage.getItem(KEY)).toBeNull();
    });
  });

  describe('when the URL changes outside the returned setter', () => {
    it('does not touch storage', () => {
      localStorage.setItem(KEY, 'status=error');
      render(<Harness initial="status=error" />);

      act(() => setSearchWithoutPersistence('status=success'));

      expect(localStorage.getItem(KEY)).toBe('status=error');
    });
  });

  describe('when some params are excluded from persistence', () => {
    const excludeParams = ['filterThreadId'];

    it('keeps an excluded filter in the URL without saving it or its operator', () => {
      render(<Harness initial="" excludeParams={excludeParams} />);

      act(() => setSearch(new URLSearchParams('status=error&filterThreadId=t1&filterThreadId.op=isNot')));

      expect(currentSearch).toBe('status=error&filterThreadId=t1&filterThreadId.op=isNot');
      expect(localStorage.getItem(KEY)).toBe('status=error');
    });

    it('does not restore an excluded filter saved by an earlier visit', () => {
      localStorage.setItem(KEY, 'status=error&filterThreadId=t1');

      render(<Harness initial="" excludeParams={excludeParams} />);

      expect(currentSearch).toBe('status=error');
    });
  });
});
