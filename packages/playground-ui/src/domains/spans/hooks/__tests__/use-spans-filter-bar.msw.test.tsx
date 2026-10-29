// @vitest-environment jsdom
import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { TRACE_TIME_RANGE_FIELD_ID, TRACE_TIME_RANGE_ITEM } from '../../../traces/components/trace-time-range-chip';
import type { TraceFilterGroup, TraceFilterToken } from '../../../traces/trace-query-filters';
import {
  emptyEntityNames,
  emptyEnvironments,
  spanQueryCapabilities,
  spanQueryCoreOnlyCapabilities,
  spanTimeRange,
  spanTypeGroup,
  statusAndTraceTokens,
} from '../../__tests__/fixtures/spans';
import { SPAN_CONTEXT_FILTER_FIELD_IDS, SPAN_CORE_FILTER_FIELD_IDS } from '../../span-filters';
import { useSpansFilterBar, useSpansFilterBarFields } from '../index';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '@/test/render';

const setDiscoveryHandlers = (capabilities: GetObservabilityCapabilitiesResponse) =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
  );

const renderFields = async () => {
  const result = renderHookWithProviders(() => useSpansFilterBarFields({ timeRange: spanTimeRange }));
  await waitFor(() => expect(result.queryClient.isFetching()).toBe(0));
  return result;
};

const fieldIds = (fields: { id: string }[]) => fields.map(field => field.id);

describe('useSpansFilterBarFields', () => {
  describe('when the store declares span query context fields', () => {
    it('offers the time range, core and context fields', async () => {
      setDiscoveryHandlers(spanQueryCapabilities);
      const { result } = await renderFields();

      await waitFor(() =>
        expect(fieldIds(result.current)).toEqual(
          expect.arrayContaining([
            TRACE_TIME_RANGE_FIELD_ID,
            ...SPAN_CORE_FILTER_FIELD_IDS,
            ...SPAN_CONTEXT_FILTER_FIELD_IDS,
          ]),
        ),
      );
    });

    it('keeps the same fields array across renders with the same time range', async () => {
      setDiscoveryHandlers(spanQueryCapabilities);
      const { result, rerender } = await renderFields();
      const first = result.current;

      rerender();

      expect(result.current).toBe(first);
    });
  });

  describe('when the store only supports the core span fields', () => {
    it('offers the time range and core fields', async () => {
      setDiscoveryHandlers(spanQueryCoreOnlyCapabilities);
      const { result } = await renderFields();

      expect(fieldIds(result.current)).toEqual(
        expect.arrayContaining([TRACE_TIME_RANGE_FIELD_ID, ...SPAN_CORE_FILTER_FIELD_IDS]),
      );
    });

    it('leaves the context fields out', async () => {
      setDiscoveryHandlers(spanQueryCoreOnlyCapabilities);
      const { result } = await renderFields();

      const contextIds: ReadonlySet<string> = new Set(SPAN_CONTEXT_FILTER_FIELD_IDS);
      expect(fieldIds(result.current).filter(id => contextIds.has(id))).toEqual([]);
    });
  });
});

const renderFilterBar = (tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => {
  const onFiltersChange = vi.fn<(tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => void>();
  const rendered = renderHookWithProviders(() => useSpansFilterBar({ tokens, groups, onFiltersChange }));
  return { ...rendered, onFiltersChange };
};

describe('useSpansFilterBar', () => {
  describe('when there are no filters', () => {
    it('only holds the time range item', () => {
      const { result } = renderFilterBar([], []);

      expect(result.current.filterBarValue.nodes).toEqual([TRACE_TIME_RANGE_ITEM]);
    });

    it('writes back no filters when the bar keeps only the time range', () => {
      const { result, onFiltersChange } = renderFilterBar([], []);

      act(() => result.current.onFilterBarChange(result.current.filterBarValue));

      expect(onFiltersChange).toHaveBeenCalledWith([], []);
    });
  });

  describe('when there are tokens and groups', () => {
    it('puts the time range item first', () => {
      const { result } = renderFilterBar(statusAndTraceTokens, [spanTypeGroup]);

      expect(result.current.filterBarValue.nodes[0]).toBe(TRACE_TIME_RANGE_ITEM);
    });

    it('writes the same tokens and groups back, without the time range', () => {
      const { result, onFiltersChange } = renderFilterBar(statusAndTraceTokens, [spanTypeGroup]);

      act(() => result.current.onFilterBarChange(result.current.filterBarValue));

      expect(onFiltersChange).toHaveBeenCalledWith(statusAndTraceTokens, [spanTypeGroup]);
    });

    it('never hands the time range to the filters', () => {
      const { result, onFiltersChange } = renderFilterBar(statusAndTraceTokens, [spanTypeGroup]);

      act(() => result.current.onFilterBarChange(result.current.filterBarValue));

      const [tokens] = onFiltersChange.mock.calls[0] ?? [[]];
      expect(tokens.map(token => token.fieldId)).not.toContain(TRACE_TIME_RANGE_FIELD_ID);
    });
  });

  describe('when filtering by a field that has no filter yet', () => {
    it('adds an `is` filter on that field and keeps the others', () => {
      const { result, onFiltersChange } = renderFilterBar(statusAndTraceTokens, [spanTypeGroup]);

      act(() => result.current.onFilterByField('entityName', 'weather-agent'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        [...statusAndTraceTokens, { fieldId: 'entityName', value: 'weather-agent' }],
        [spanTypeGroup],
      );
    });
  });

  describe('when filtering by a field that already has a filter', () => {
    it('replaces that filter with the new value', () => {
      const { result, onFiltersChange } = renderFilterBar(statusAndTraceTokens, [spanTypeGroup]);

      act(() => result.current.onFilterByField('status', 'success'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        [
          { fieldId: 'traceId', value: 'trace-a' },
          { fieldId: 'status', value: 'success' },
        ],
        [spanTypeGroup],
      );
    });
  });
});
