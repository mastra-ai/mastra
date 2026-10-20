import { EMPTY_TRACES_SELECTION } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import type { TracesFilters } from '@mastra/playground-ui/domains/traces/components/traces-explorer';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { MemoryRouter, useLocation, useSearchParams } from 'react-router';
import { describe, expect, it, vi } from 'vitest';
import { useTracesRouteState } from '../use-traces-route-state';

const applyFilters = (filters: TracesFilters) => ({ filters, selection: EMPTY_TRACES_SELECTION });
const selectTrace = (filters: TracesFilters, traceId: string) => ({
  filters,
  selection: { ...EMPTY_TRACES_SELECTION, traceId },
});

function renderRouteState(initialEntry: string) {
  const persistedWrites = vi.fn();
  const navigations: Array<{ replace?: boolean }> = [];

  const wrapper = ({ children }: { children: ReactNode }) => (
    <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
  );

  const result = renderHook(
    () => {
      const [searchParams, setSearchParams] = useSearchParams();
      const location = useLocation();
      const setRaw: typeof setSearchParams = (next, options) => {
        navigations.push({ replace: options?.replace });
        setSearchParams(next, options);
      };
      const setPersisted: typeof setSearchParams = (next, options) => {
        persistedWrites(next);
        setRaw(next, options);
      };
      return { route: useTracesRouteState(searchParams, setRaw, setPersisted), search: location.search };
    },
    { wrapper },
  );

  const params = () => new URLSearchParams(result.result.current.search);
  return { ...result, params, persistedWrites, navigations };
}

describe('useTracesRouteState', () => {
  describe('when the URL is empty', () => {
    it('decodes the default selection, filters and sort', () => {
      const { result } = renderRouteState('/traces');

      expect(result.current.route.selection).toEqual(EMPTY_TRACES_SELECTION);
      expect(result.current.route.filters).toEqual({ datePreset: 'last-7d', tokens: [], groups: [] });
      expect(result.current.route.sortDirection).toBe('desc');
    });
  });

  describe('when the URL carries selection params', () => {
    it('decodes them into the selection', () => {
      const { result } = renderRouteState(
        '/traces?traceId=trace-a&spanId=span-b&tab=feedback&spanView=timeline&scoreId=score-1&highlightSpanIds=s1,s2',
      );

      expect(result.current.route.selection).toEqual({
        traceId: 'trace-a',
        spanId: 'span-b',
        spanTab: 'feedback',
        spanView: 'timeline',
        scoreId: 'score-1',
        highlightSpanIds: ['s1', 's2'],
      });
    });
  });

  describe('when the URL carries filter params', () => {
    it('decodes the date range, synthetic and property tokens', () => {
      const { result } = renderRouteState(
        '/traces?datePreset=custom&dateFrom=2026-01-01T00:00:00.000Z&dateTo=2026-01-02T00:00:00.000Z&rootEntityType=agent&filterThreadId=thread-1',
      );

      expect(result.current.route.filters).toEqual({
        datePreset: 'custom',
        dateFrom: new Date('2026-01-01T00:00:00.000Z'),
        dateTo: new Date('2026-01-02T00:00:00.000Z'),
        tokens: [
          { fieldId: 'rootEntityType', value: 'agent' },
          { fieldId: 'threadId', value: 'thread-1' },
        ],
        groups: [],
      });
    });
  });

  describe('when the URL asks for an unknown date preset', () => {
    it('falls back to the last 7 days', () => {
      const { result } = renderRouteState('/traces?datePreset=all');

      expect(result.current.route.filters.datePreset).toBe('last-7d');
    });
  });

  describe('when only the selection changes', () => {
    it('keeps the filters reference', () => {
      const { result } = renderRouteState('/traces?filterThreadId=thread-1');
      const filters = result.current.route.filters;

      act(() =>
        result.current.route.setState({ filters, selection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-a' } }),
      );

      expect(result.current.route.filters).toBe(filters);
    });
  });

  describe('when only the filters change', () => {
    it('keeps the selection reference', () => {
      const { result } = renderRouteState('/traces?traceId=trace-a');
      const selection = result.current.route.selection;

      act(() =>
        result.current.route.setState({ selection, filters: { datePreset: 'last-24h', tokens: [], groups: [] } }),
      );

      expect(result.current.route.selection).toBe(selection);
    });
  });

  describe('when a trace is selected', () => {
    it('writes the selection with replace and keeps unrelated params', () => {
      const { result, params, navigations } = renderRouteState('/traces?filterEntityId=agent-1&foo=bar');

      act(() =>
        result.current.route.setState({
          filters: result.current.route.filters,
          selection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-a', spanId: 'span-b' },
        }),
      );

      expect(params().get('traceId')).toBe('trace-a');
      expect(params().get('spanId')).toBe('span-b');
      expect(params().get('filterEntityId')).toBe('agent-1');
      expect(params().get('foo')).toBe('bar');
      expect(navigations).toEqual([{ replace: true }]);
    });

    it('persists the write', () => {
      const { result, persistedWrites } = renderRouteState('/traces');

      act(() => result.current.route.setState(selectTrace(result.current.route.filters, 'trace-a')));

      expect(persistedWrites).toHaveBeenCalledTimes(1);
    });
  });

  describe('when a different trace is selected while a branch anchor is set', () => {
    it('drops the anchor span', () => {
      const { result, params } = renderRouteState('/traces?traceId=trace-a&anchorSpanId=span-x');

      act(() => result.current.route.setState(selectTrace(result.current.route.filters, 'trace-b')));

      expect(params().has('anchorSpanId')).toBe(false);
    });
  });

  describe('when the span tab is set back to details', () => {
    it('omits the tab param', () => {
      const { result, params } = renderRouteState('/traces?traceId=trace-a&spanId=span-b&tab=feedback');

      act(() =>
        result.current.route.setState({
          filters: result.current.route.filters,
          selection: { ...EMPTY_TRACES_SELECTION, traceId: 'trace-a', spanId: 'span-b', spanTab: 'details' },
        }),
      );

      expect(params().has('tab')).toBe(false);
    });
  });

  describe('when the date preset switches away from custom', () => {
    it('drops the custom dates and writes the preset', () => {
      const { result, params } = renderRouteState(
        '/traces?datePreset=custom&dateFrom=2026-01-01T00:00:00.000Z&dateTo=2026-01-02T00:00:00.000Z',
      );

      act(() => result.current.route.setState(applyFilters({ datePreset: 'last-24h', tokens: [], groups: [] })));

      expect(params().get('datePreset')).toBe('last-24h');
      expect(params().has('dateFrom')).toBe(false);
      expect(params().has('dateTo')).toBe(false);
    });
  });

  describe('when the date preset returns to the default', () => {
    it('removes the preset param', () => {
      const { result, params } = renderRouteState('/traces?datePreset=last-24h');

      act(() => result.current.route.setState(applyFilters({ datePreset: 'last-7d', tokens: [], groups: [] })));

      expect(params().has('datePreset')).toBe(false);
    });
  });

  describe('when filter tokens are replaced', () => {
    it('rewrites the filter params and keeps scope-unrelated params', () => {
      const { result, params } = renderRouteState('/traces?filterThreadId=thread-1&status=error&foo=bar');

      act(() =>
        result.current.route.setState(
          applyFilters({ datePreset: 'last-7d', tokens: [{ fieldId: 'environment', value: 'prod' }], groups: [] }),
        ),
      );

      expect(params().has('filterThreadId')).toBe(false);
      expect(params().has('status')).toBe(false);
      expect(params().get('filterEnvironment')).toBe('prod');
      expect(params().get('foo')).toBe('bar');
    });
  });

  describe('when a filter edit clears an open trace', () => {
    it('writes the new filter and drops the selection in one navigation', () => {
      const { result, params, navigations } = renderRouteState('/traces?traceId=trace-a&spanId=span-b');

      act(() => result.current.route.setState(applyFilters({ datePreset: 'last-24h', tokens: [], groups: [] })));

      expect(params().get('datePreset')).toBe('last-24h');
      expect(params().has('traceId')).toBe(false);
      expect(params().has('spanId')).toBe(false);
      expect(navigations).toHaveLength(1);
    });
  });

  describe('when setState is called twice in the same tick', () => {
    it('keeps the last state', () => {
      const { result, params } = renderRouteState('/traces?traceId=trace-a');

      act(() => {
        result.current.route.setState(applyFilters({ datePreset: 'custom', tokens: [], groups: [] }));
        result.current.route.setState(
          applyFilters({
            datePreset: 'custom',
            dateFrom: new Date('2026-01-01T00:00:00.000Z'),
            tokens: [],
            groups: [],
          }),
        );
      });

      expect(params().get('datePreset')).toBe('custom');
      expect(params().get('dateFrom')).toBe('2026-01-01T00:00:00.000Z');
      expect(params().has('traceId')).toBe(false);
    });
  });

  describe('when a later interaction follows a committed one', () => {
    it('builds on the committed URL', () => {
      const { result, params } = renderRouteState('/traces?foo=bar');

      act(() => result.current.route.setState(selectTrace(result.current.route.filters, 'trace-a')));
      act(() => result.current.route.setSortDirection('asc'));

      expect(params().get('traceId')).toBe('trace-a');
      expect(params().get('dir')).toBe('asc');
      expect(params().get('foo')).toBe('bar');
    });
  });

  describe('when the sort direction changes', () => {
    it('writes the sort params', () => {
      const { result, params } = renderRouteState('/traces?page=2');

      act(() => result.current.route.setSortDirection('asc'));

      expect(result.current.route.sortDirection).toBe('asc');
      expect(params().get('sort')).toBe('startedAt');
      expect(params().get('dir')).toBe('asc');
      expect(params().has('page')).toBe(false);
    });

    it('does not persist the write', () => {
      const { result, persistedWrites } = renderRouteState('/traces');

      act(() => result.current.route.setSortDirection('asc'));

      expect(persistedWrites).not.toHaveBeenCalled();
    });
  });
});
