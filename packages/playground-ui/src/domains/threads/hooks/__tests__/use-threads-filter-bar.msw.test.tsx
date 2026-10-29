// @vitest-environment jsdom
import { act, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { TRACE_TIME_RANGE_FIELD_ID, TRACE_TIME_RANGE_ITEM } from '../../../traces/components/trace-time-range-chip';
import type { TraceFilterGroup, TraceFilterToken } from '../../../traces/trace-query-filters';
import {
  discoveredEntityNames,
  discoveredEnvironments,
  entityTypeGroup,
  statusAndRunTokens,
  threadQueryCapabilities,
} from '../../__tests__/fixtures/threads';
import { THREAD_FILTER_FIELD_IDS } from '../../thread-filters';
import { useThreadsFilterBar, useThreadsFilterBarFields } from '../index';
import { server } from '@/test/msw-server';
import { renderHookWithProviders, TEST_BASE_URL } from '@/test/render';

const setDiscoveryHandlers = () =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(threadQueryCapabilities)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () =>
      HttpResponse.json(discoveredEntityNames),
    ),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () =>
      HttpResponse.json(discoveredEnvironments),
    ),
  );

const renderFields = async () => {
  const result = renderHookWithProviders(() => useThreadsFilterBarFields());
  await waitFor(() => expect(result.queryClient.isFetching()).toBe(0));
  return result;
};

const fieldIds = (fields: { id: string }[]) => fields.map(field => field.id);

describe('useThreadsFilterBarFields', () => {
  describe('when discovery returns primitive names and environments', () => {
    it('offers the time range and every thread field', async () => {
      setDiscoveryHandlers();
      const { result } = await renderFields();

      expect(fieldIds(result.current).sort()).toEqual([TRACE_TIME_RANGE_FIELD_ID, ...THREAD_FILTER_FIELD_IDS].sort());
    });

    it('suggests the discovered primitive names', async () => {
      setDiscoveryHandlers();
      const { result } = await renderFields();

      await waitFor(() =>
        expect(result.current.find(field => field.id === 'entityName')?.suggestions).toEqual([
          { value: 'weather-agent' },
          { value: 'support-agent' },
        ]),
      );
    });

    it('suggests the discovered environments', async () => {
      setDiscoveryHandlers();
      const { result } = await renderFields();

      await waitFor(() =>
        expect(result.current.find(field => field.id === 'environment')?.suggestions).toEqual([
          { value: 'production' },
        ]),
      );
    });

    it('keeps the same fields array across renders', async () => {
      setDiscoveryHandlers();
      const { result, rerender } = await renderFields();
      const first = result.current;

      rerender();

      expect(result.current).toBe(first);
    });
  });
});

const renderFilterBar = (tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => {
  const onFiltersChange = vi.fn<(tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => void>();
  const rendered = renderHookWithProviders(() => useThreadsFilterBar({ tokens, groups, onFiltersChange }));
  return { ...rendered, onFiltersChange };
};

describe('useThreadsFilterBar', () => {
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
      const { result } = renderFilterBar(statusAndRunTokens, [entityTypeGroup]);

      expect(result.current.filterBarValue.nodes[0]).toBe(TRACE_TIME_RANGE_ITEM);
    });

    it('writes the same tokens and groups back, without the time range', () => {
      const { result, onFiltersChange } = renderFilterBar(statusAndRunTokens, [entityTypeGroup]);

      act(() => result.current.onFilterBarChange(result.current.filterBarValue));

      expect(onFiltersChange).toHaveBeenCalledWith(statusAndRunTokens, [entityTypeGroup]);
    });
  });

  describe('when filtering by a field that already has a filter', () => {
    it('replaces that filter with the new value', () => {
      const { result, onFiltersChange } = renderFilterBar(statusAndRunTokens, [entityTypeGroup]);

      act(() => result.current.onFilterByField('status', 'success'));

      expect(onFiltersChange).toHaveBeenCalledWith(
        [
          { fieldId: 'runId', value: 'run-a' },
          { fieldId: 'status', value: 'success' },
        ],
        [entityTypeGroup],
      );
    });
  });
});
