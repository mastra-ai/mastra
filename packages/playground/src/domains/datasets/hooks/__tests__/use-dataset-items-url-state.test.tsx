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
      expect(result.current.panel).toBeNull();
      expect(result.current.selectionMode).toBe('idle');
    });

    it('parses tab, version, panel, and mode params', () => {
      const { result } = renderHook(useHookUnderTest, {
        wrapper: wrapper('/datasets/d1?tab=experiments&version=3&panel=versions&mode=delete'),
      });
      expect(result.current.tab).toBe('experiments');
      expect(result.current.activeVersion).toBe(3);
      expect(result.current.panel).toBe('versions');
      expect(result.current.selectionMode).toBe('delete');
    });

    it('falls back to defaults when params are invalid', () => {
      const { result } = renderHook(useHookUnderTest, {
        wrapper: wrapper('/datasets/d1?tab=bogus&version=-1&panel=junk&mode=invalid'),
      });
      expect(result.current.tab).toBe('items');
      expect(result.current.activeVersion).toBeNull();
      expect(result.current.panel).toBeNull();
      expect(result.current.selectionMode).toBe('idle');
    });
  });

  describe('handleTabChange', () => {
    it('removes the tab param when switching back to "items"', () => {
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1?tab=review') });
      act(() => result.current.handleTabChange('items'));
      expect(result.current.tab).toBe('items');
    });

    it('clears panel + mode when leaving the items tab, but preserves version', () => {
      const { result } = renderHook(useHookUnderTest, {
        wrapper: wrapper('/datasets/d1?panel=versions&mode=delete&version=2'),
      });
      act(() => result.current.handleTabChange('experiments'));
      expect(result.current.tab).toBe('experiments');
      expect(result.current.panel).toBeNull();
      expect(result.current.selectionMode).toBe('idle');
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
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1?tab=review&mode=delete') });
      act(() => result.current.handleVersionChange(7));
      expect(result.current.activeVersion).toBe(7);
      expect(result.current.tab).toBe('review');
      expect(result.current.selectionMode).toBe('delete');
    });
  });

  describe('handlePanelChange', () => {
    it('opens and closes the versions panel', () => {
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1') });
      act(() => result.current.handlePanelChange('versions'));
      expect(result.current.panel).toBe('versions');
      act(() => result.current.handlePanelChange(null));
      expect(result.current.panel).toBeNull();
    });
  });

  describe('handleSelectionModeChange', () => {
    it('writes the selection mode and clears on idle', () => {
      const { result } = renderHook(useHookUnderTest, { wrapper: wrapper('/datasets/d1') });
      act(() => result.current.handleSelectionModeChange('compare-items'));
      expect(result.current.selectionMode).toBe('compare-items');
      act(() => result.current.handleSelectionModeChange('idle'));
      expect(result.current.selectionMode).toBe('idle');
    });
  });
});
