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
  return useDatasetItemsUrlState(searchParams, setSearchParams);
}

describe('useDatasetItemsUrlState', () => {
  describe('reading URL params', () => {
    it('defaults all fields when the URL is empty', () => {
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1') });
      expect(result.current.tab).toBe('items');
      expect(result.current.activeVersion).toBeNull();
    });

    it('parses tab and version params', () => {
      const { result } = renderHook(useHookUnderTest, {
        wrapper: wrapper('/datasets/d1?tab=experiments&version=3'),
      });
      expect(result.current.tab).toBe('experiments');
      expect(result.current.activeVersion).toBe(3);
    });

    it('falls back to defaults when params are invalid', () => {
      const { result } = renderHook(useHookUnderTest, {
        wrapper: wrapper('/datasets/d1?tab=bogus&version=-1'),
      });
      expect(result.current.tab).toBe('items');
      expect(result.current.activeVersion).toBeNull();
    });
  });

  describe('handleTabChange', () => {
    it('removes the tab param when switching back to "items"', () => {
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1?tab=review') });
      act(() => result.current.handleTabChange('items'));
      expect(result.current.tab).toBe('items');
    });

    it('preserves version when switching tabs', () => {
      const { result } = renderHook(useHookUnderTest, {
        wrapper: wrapper('/datasets/d1?version=2'),
      });
      act(() => result.current.handleTabChange('experiments'));
      expect(result.current.tab).toBe('experiments');
      expect(result.current.activeVersion).toBe(2);
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
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1?tab=review') });
      act(() => result.current.handleVersionChange(7));
      expect(result.current.activeVersion).toBe(7);
      expect(result.current.tab).toBe('review');
    });
  });
});
