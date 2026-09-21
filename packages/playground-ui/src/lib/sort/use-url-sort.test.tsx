// @vitest-environment jsdom

import { act, renderHook } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { useUrlSort } from './use-url-sort';
import type { SetURLSearchParamsLike } from './use-url-sort';

function useHarness(
  initial: string,
  allowed: readonly string[],
  defaultSort?: { key: string; direction: 'asc' | 'desc' },
) {
  const [params, setParams] = useState(() => new URLSearchParams(initial));
  const setSearchParams: SetURLSearchParamsLike = next => {
    setParams(prev => (typeof next === 'function' ? next(new URLSearchParams(prev)) : next));
  };
  const sort = useUrlSort({ searchParams: params, setSearchParams, allowedKeys: allowed, defaultSort });
  return { ...sort, params };
}

describe('useUrlSort', () => {
  describe('when the URL has no sort params', () => {
    it('returns the default sort', () => {
      const { result } = renderHook(() => useHarness('', ['name'], { key: 'name', direction: 'desc' }));
      expect(result.current.sort).toEqual({ key: 'name', direction: 'desc' });
    });

    it('returns undefined without a default', () => {
      const { result } = renderHook(() => useHarness('', ['name']));
      expect(result.current.sort).toBeUndefined();
    });
  });

  describe('when the URL has a valid sort', () => {
    it('parses key and direction', () => {
      const { result } = renderHook(() => useHarness('sort=name&dir=desc', ['name']));
      expect(result.current.sort).toEqual({ key: 'name', direction: 'desc' });
    });

    it('defaults direction to asc when dir is invalid', () => {
      const { result } = renderHook(() => useHarness('sort=name&dir=sideways', ['name']));
      expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
    });
  });

  describe('when the URL has an unknown sort key', () => {
    it('ignores it and falls back to the default', () => {
      const { result } = renderHook(() => useHarness('sort=evil&dir=asc', ['name'], { key: 'name', direction: 'asc' }));
      expect(result.current.sort).toEqual({ key: 'name', direction: 'asc' });
    });
  });

  describe('when onSortChange is called', () => {
    it('writes sort and dir into the URL', () => {
      const { result } = renderHook(() => useHarness('foo=bar', ['name']));
      act(() => result.current.onSortChange('desc', 'name'));
      expect(result.current.params.get('sort')).toBe('name');
      expect(result.current.params.get('dir')).toBe('desc');
      expect(result.current.params.get('foo')).toBe('bar');
      expect(result.current.sort).toEqual({ key: 'name', direction: 'desc' });
    });

    it('drops the page param so paginated lists reset', () => {
      const { result } = renderHook(() => useHarness('page=3', ['name']));
      act(() => result.current.onSortChange('asc', 'name'));
      expect(result.current.params.has('page')).toBe(false);
    });
  });
});
