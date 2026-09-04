import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useSearchParams } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useDatasetItemsUrlState } from '../use-dataset-items-url-state';

function wrapper(initialUrl: string) {
  return ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialUrl]}>{children}</MemoryRouter>
  );
}

/** Drives `useDatasetItemsUrlState` with a real router so the URL is the source of truth. */
function useHookUnderTest() {
  const [searchParams, setSearchParams] = useSearchParams();
  const state = useDatasetItemsUrlState(searchParams, setSearchParams);
  return { ...state, search: searchParams.toString() };
}

describe('useDatasetItemsUrlState', () => {
  describe('reading URL params', () => {
    it('defaults the version when the URL is empty', () => {
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1') });
      expect(result.current.activeVersion).toBeNull();
    });

    it('parses the version param', () => {
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1?version=3') });
      expect(result.current.activeVersion).toBe(3);
    });

    it('falls back to the default when the version is invalid', () => {
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1?version=-1') });
      expect(result.current.activeVersion).toBeNull();
    });
  });

  describe('handleVersionChange', () => {
    it('sets and clears the version param', () => {
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1') });
      act(() => result.current.handleVersionChange(5));
      expect(result.current.activeVersion).toBe(5);
      act(() => result.current.handleVersionChange(null));
      expect(result.current.activeVersion).toBeNull();
    });

    it('preserves unrelated params', () => {
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1?foo=bar') });
      act(() => result.current.handleVersionChange(7));
      expect(result.current.activeVersion).toBe(7);
      expect(result.current.search).toBe('foo=bar&version=7');
    });
  });
});
