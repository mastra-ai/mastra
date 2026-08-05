// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useTraceColumnPreferences } from '../use-trace-column-preferences';

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: key => values.get(key) ?? null,
    key: index => [...values.keys()][index] ?? null,
    removeItem: key => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

function makeWrapper(baseUrl: string) {
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={baseUrl}>{children}</MastraReactProvider>
  );
}

describe('useTraceColumnPreferences', () => {
  beforeEach(() => {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: createMemoryStorage(),
    });
    window.localStorage.clear();
  });

  describe('when a project customizes its columns', () => {
    it('restores that project without leaking the selection to another project', () => {
      const projectA = makeWrapper('http://project-a.test');
      const firstVisit = renderHook(() => useTraceColumnPreferences(), { wrapper: projectA });

      act(() => {
        firstVisit.result.current.toggleColumn('duration');
      });
      act(() => {
        firstVisit.result.current.addMetadataColumn('tenantId');
      });
      firstVisit.unmount();

      const returnVisit = renderHook(() => useTraceColumnPreferences(), { wrapper: projectA });
      expect(returnVisit.result.current.preferences).toEqual({
        visibleColumns: ['input', 'entity', 'duration'],
        metadataKeys: ['tenantId'],
      });

      const projectB = makeWrapper('http://project-b.test');
      const otherProject = renderHook(() => useTraceColumnPreferences(), { wrapper: projectB });
      expect(otherProject.result.current.preferences).toEqual({
        visibleColumns: ['input', 'entity'],
        metadataKeys: [],
      });
    });

    it('keeps back-to-back updates made before React rerenders', () => {
      const { result } = renderHook(() => useTraceColumnPreferences(), {
        wrapper: makeWrapper('http://project-a.test'),
      });

      act(() => {
        result.current.toggleColumn('duration');
        result.current.addMetadataColumn('tenantId');
      });

      expect(result.current.preferences).toEqual({
        visibleColumns: ['input', 'entity', 'duration'],
        metadataKeys: ['tenantId'],
      });
    });
  });
});
