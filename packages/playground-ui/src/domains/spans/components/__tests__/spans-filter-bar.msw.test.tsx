// @vitest-environment jsdom
import type { GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import { TRACE_TIME_RANGE_FIELD_ID, TraceTimeRangeChip } from '../../../traces/components/trace-time-range-chip';
import { TRACE_FILTER_BAR_OPERATORS } from '../../../traces/trace-filters';
import type { TraceFilterGroup, TraceFilterToken } from '../../../traces/trace-query-filters';
import {
  emptyEntityNames,
  emptyEnvironments,
  spanQueryCapabilities,
  spanTimeRange,
  statusAndTraceTokens,
} from '../../__tests__/fixtures/spans';
import { SPAN_TIME_RANGE_PRESETS, useSpansFilterBar, useSpansFilterBarFields } from '../../hooks';
import { SpansFilterBar } from '../spans-filter-bar';
import { FilterBar } from '@/ds/components/FilterBar';
import type { FilterBarField, FilterBarItem } from '@/ds/components/FilterBar';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type OnFiltersChange = (tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => void;

const setDiscoveryHandlers = (capabilities: GetObservabilityCapabilitiesResponse = spanQueryCapabilities) =>
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
  );

const settle = async (queryClient: { isFetching: () => number }) =>
  waitFor(() => expect(queryClient.isFetching()).toBe(0));

const getFilterChips = () => [...document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]')];
const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' }) as HTMLInputElement;
const typeFilter = (text: string) => fireEvent.change(getFilterInput(), { target: { value: text } });
const pressFilterKey = (key: string) => fireEvent.keyDown(getFilterInput(), { key });

const regionField: FilterBarField = { id: 'region', label: 'Region', operators: ['is'] };
const regionItem: FilterBarItem = { id: 'region', fieldId: 'region', operatorId: 'is', value: 'eu' };

/** A host bar: its own design-system FilterBar with an extra Region field, fed by the spans hooks. */
function HostSpansFilterBar({
  tokens,
  onFiltersChange,
}: {
  tokens: TraceFilterToken[];
  onFiltersChange: OnFiltersChange;
}) {
  const spanFields = useSpansFilterBarFields({ timeRange: spanTimeRange });
  const { filterBarValue, onFilterBarChange } = useSpansFilterBar({ tokens, groups: [], onFiltersChange });
  return (
    <FilterBar
      aria-label="Span filters"
      fields={[regionField, ...spanFields]}
      operators={TRACE_FILTER_BAR_OPERATORS}
      value={{ ...filterBarValue, nodes: [regionItem, ...filterBarValue.nodes] }}
      onValueChange={expression =>
        onFilterBarChange({ ...expression, nodes: expression.nodes.filter(node => node.id !== regionItem.id) })
      }
    >
      <FilterBar.Chips
        renderChip={item =>
          item.fieldId === TRACE_TIME_RANGE_FIELD_ID ? (
            <TraceTimeRangeChip
              preset="last-24h"
              onPresetChange={() => {}}
              onDateChange={() => {}}
              onDateRangeChange={() => {}}
              presets={SPAN_TIME_RANGE_PRESETS}
            />
          ) : (
            <FilterBar.Chip item={item} />
          )
        }
      />
    </FilterBar>
  );
}

const renderHostBar = async () => {
  setDiscoveryHandlers();
  const onFiltersChange = vi.fn<OnFiltersChange>();
  const { queryClient } = renderWithProviders(
    <HostSpansFilterBar tokens={statusAndTraceTokens} onFiltersChange={onFiltersChange} />,
  );
  await settle(queryClient);
  return { onFiltersChange };
};

describe('spans filter bar composition', () => {
  describe('when the host renders its own filter bar from the spans hooks', () => {
    it('renders the host field next to the span chips', async () => {
      await renderHostBar();

      expect(getFilterChips().map(chip => chip.textContent)).toEqual([
        expect.stringContaining('Region'),
        expect.stringContaining('Last 24 hours'),
        expect.stringContaining('Status'),
        expect.stringContaining('trace-a'),
      ]);
    });

    it('writes back only the span tokens when a span chip is removed', async () => {
      const { onFiltersChange } = await renderHostBar();

      fireEvent.click(screen.getByRole('button', { name: 'Remove Status filter' }));

      expect(onFiltersChange).toHaveBeenLastCalledWith([{ fieldId: 'traceId', value: 'trace-a' }], []);
    });
  });
});

describe('SpansFilterBar', () => {
  describe('when the span value suggestions fail to load', () => {
    it('shows the message from describeSuggestionsError', async () => {
      setDiscoveryHandlers();
      server.use(
        http.post(`${TEST_BASE_URL}/api/observability/traces/query/values`, () =>
          HttpResponse.json({ error: 'Query too expensive' }, { status: 400 }),
        ),
      );
      const { queryClient } = renderWithProviders(
        <SpansFilterBar
          datePreset="last-24h"
          timeRange={spanTimeRange}
          tokens={[]}
          groups={[]}
          onDatePresetChange={() => {}}
          onDateChange={() => {}}
          onDateRangeChange={() => {}}
          onFiltersChange={() => {}}
          describeSuggestionsError={() => 'Narrow the time range.'}
        />,
      );
      await settle(queryClient);

      getFilterInput().focus();
      typeFilter('Span name');
      await screen.findByRole('option', { name: 'Span name' });
      pressFilterKey('Enter');
      pressFilterKey('Enter');

      expect(await screen.findByText('Narrow the time range.')).toBeTruthy();
    });
  });
});
