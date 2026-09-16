// @vitest-environment jsdom
import { MastraReactProvider } from '@mastra/react';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_TRACE_COLUMN_PREFERENCES } from '../../trace-list-columns';
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

function makeWrapper(baseUrl: string, apiPrefix?: string) {
  return ({ children }: { children: ReactNode }) => (
    <MastraReactProvider baseUrl={baseUrl} apiPrefix={apiPrefix}>
      {children}
    </MastraReactProvider>
  );
}

const STORAGE_KEY_PREFIX = 'mastra:traces:columns:';

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

    it('keys storage on the project URL and the default API prefix', () => {
      const { result } = renderHook(() => useTraceColumnPreferences(), {
        wrapper: makeWrapper('http://project-a.test'),
      });

      act(() => {
        result.current.toggleColumn('duration');
      });

      expect(window.localStorage.getItem(`${STORAGE_KEY_PREFIX}http://project-a.test:/api`)).not.toBeNull();
    });

    it('falls back to the page origin when the client has no base URL', () => {
      const { result } = renderHook(() => useTraceColumnPreferences(), {
        wrapper: ({ children }: { children: ReactNode }) => <MastraReactProvider>{children}</MastraReactProvider>,
      });

      act(() => {
        result.current.toggleColumn('duration');
      });

      expect(window.location.origin).toBeTruthy();
      expect(window.localStorage.getItem(`${STORAGE_KEY_PREFIX}${window.location.origin}:/api`)).not.toBeNull();
    });

    it('separates projects that share a host but not an API prefix', () => {
      const defaultPrefix = renderHook(() => useTraceColumnPreferences(), {
        wrapper: makeWrapper('http://project-a.test'),
      });

      act(() => {
        defaultPrefix.result.current.toggleColumn('duration');
      });
      defaultPrefix.unmount();

      const otherPrefix = renderHook(() => useTraceColumnPreferences(), {
        wrapper: makeWrapper('http://project-a.test', '/custom-api'),
      });

      expect(otherPrefix.result.current.preferences).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
    });
  });

  describe('when the columns are edited', () => {
    const renderPreferences = () =>
      renderHook(() => useTraceColumnPreferences(), { wrapper: makeWrapper('http://project-a.test') });

    it('toggles a column off again', () => {
      const { result } = renderPreferences();

      act(() => {
        result.current.toggleColumn('duration');
      });
      expect(result.current.preferences.visibleColumns).toEqual(['input', 'entity', 'duration']);

      act(() => {
        result.current.toggleColumn('duration');
      });
      expect(result.current.preferences.visibleColumns).toEqual(['input', 'entity']);

      act(() => {
        result.current.toggleColumn('input');
      });
      expect(result.current.preferences.visibleColumns).toEqual(['entity']);
    });

    it('removes a metadata column without touching the others', () => {
      const { result } = renderPreferences();

      act(() => {
        result.current.addMetadataColumn('tenantId');
        result.current.addMetadataColumn('requestKind');
      });
      expect(result.current.preferences.metadataKeys).toEqual(['tenantId', 'requestKind']);

      act(() => {
        result.current.removeMetadataColumn('tenantId');
      });
      expect(result.current.preferences.metadataKeys).toEqual(['requestKind']);

      act(() => {
        result.current.removeMetadataColumn('not-there');
      });
      expect(result.current.preferences.metadataKeys).toEqual(['requestKind']);
    });

    it('trims a metadata key and ignores a blank or duplicate one', () => {
      const { result } = renderPreferences();

      act(() => {
        result.current.addMetadataColumn('  tenantId  ');
      });
      expect(result.current.preferences.metadataKeys).toEqual(['tenantId']);

      act(() => {
        result.current.addMetadataColumn('tenantId');
        result.current.addMetadataColumn('   ');
        result.current.addMetadataColumn('');
      });
      expect(result.current.preferences.metadataKeys).toEqual(['tenantId']);
    });

    it('resets back to the default columns', () => {
      const { result } = renderPreferences();

      act(() => {
        result.current.toggleColumn('duration');
        result.current.addMetadataColumn('tenantId');
      });

      act(() => {
        result.current.resetColumns();
      });

      expect(result.current.preferences).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
    });
  });

  describe('when storage is involved', () => {
    // Restored here rather than at the end of each test, so a failing assertion
    // cannot leave a throwing storage spy in place for every test after it.
    afterEach(() => vi.restoreAllMocks());

    it('does not write anything until the columns are edited', () => {
      const setItem = vi.spyOn(window.localStorage, 'setItem');

      const { unmount } = renderHook(() => useTraceColumnPreferences(), {
        wrapper: makeWrapper('http://project-a.test'),
      });
      unmount();

      expect(setItem).not.toHaveBeenCalled();
    });

    it('does not persist one project’s edits under another project’s key', () => {
      let baseUrl = 'http://project-a.test';
      const Wrapper = ({ children }: { children: ReactNode }) => (
        <MastraReactProvider baseUrl={baseUrl}>{children}</MastraReactProvider>
      );

      const { result, rerender } = renderHook(() => useTraceColumnPreferences(), { wrapper: Wrapper });

      act(() => {
        result.current.toggleColumn('duration');
      });

      baseUrl = 'http://project-b.test';
      rerender();

      // Project B shows its own (default) columns...
      expect(result.current.preferences).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
      // ...and project A's edit was not copied onto B's key.
      expect(window.localStorage.getItem(`${STORAGE_KEY_PREFIX}http://project-b.test:/api`)).toBeNull();

      // An edit made after the switch starts from B's columns, not A's.
      act(() => {
        result.current.toggleColumn('inputTokens');
      });

      expect(result.current.preferences.visibleColumns).toEqual(['input', 'entity', 'inputTokens']);
    });

    it('falls back to the default columns when storage cannot be read', () => {
      vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const { result } = renderHook(() => useTraceColumnPreferences(), {
        wrapper: makeWrapper('http://project-a.test'),
      });

      expect(result.current.preferences).toEqual(DEFAULT_TRACE_COLUMN_PREFERENCES);
    });

    it('keeps editing in memory when storage cannot be written', () => {
      vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const { result } = renderHook(() => useTraceColumnPreferences(), {
        wrapper: makeWrapper('http://project-a.test'),
      });

      act(() => {
        result.current.toggleColumn('duration');
      });

      expect(result.current.preferences.visibleColumns).toEqual(['input', 'entity', 'duration']);
    });
  });
});
