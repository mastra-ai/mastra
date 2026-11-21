// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { TraceFilterGroup, TraceFilterToken } from '../../../traces/trace-query-filters';
import {
  discoveredEntityNames,
  discoveredEnvironments,
  statusAndRunTokens,
  threadQueryCapabilities,
} from '../../__tests__/fixtures/threads';
import { useThreadsFilterBarFields } from '../../hooks/use-threads-filter-bar';
import { ThreadsFilterBar } from '../threads-filter-bar';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type OnFiltersChange = (tokens: TraceFilterToken[], groups: TraceFilterGroup[]) => void;

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

// The bar's items in order: the time range, then the chips.
const getBarItems = () => [
  ...document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-time-range"], [data-slot="filter-bar-chip"]'),
];
const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' }) as HTMLInputElement;

/** The bar fed the way Studio feeds it: `useThreadsFilterBarFields` loads its fields through the client. */
function StudioThreadsFilterBar(props: Omit<ComponentProps<typeof ThreadsFilterBar>, 'fields'>) {
  return <ThreadsFilterBar {...props} fields={useThreadsFilterBarFields()} />;
}

const renderBar = async (tokens: TraceFilterToken[]) => {
  setDiscoveryHandlers();
  const onFiltersChange = vi.fn<OnFiltersChange>();
  const { queryClient } = renderWithProviders(
    <StudioThreadsFilterBar
      datePreset="last-24h"
      tokens={tokens}
      groups={[]}
      onDatePresetChange={() => {}}
      onDateChange={() => {}}
      onDateRangeChange={() => {}}
      onFiltersChange={onFiltersChange}
    />,
  );
  await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  return { onFiltersChange };
};

describe('ThreadsFilterBar', () => {
  describe('when there are thread filters', () => {
    it('renders the time range before the filter chips', async () => {
      await renderBar(statusAndRunTokens);

      expect(getBarItems().map(chip => chip.textContent)).toEqual([
        expect.stringContaining('Last 24 hours'),
        expect.stringContaining('Status'),
        expect.stringContaining('run-a'),
      ]);
    });

    it('writes back the other filters when a chip is removed', async () => {
      const { onFiltersChange } = await renderBar(statusAndRunTokens);

      fireEvent.click(screen.getByRole('button', { name: 'Remove Status filter' }));

      expect(onFiltersChange).toHaveBeenLastCalledWith([{ fieldId: 'runId', value: 'run-a' }], []);
    });
  });

  describe('when the user searches for a field', () => {
    it('offers the thread fields', async () => {
      await renderBar([]);

      getFilterInput().focus();
      fireEvent.change(getFilterInput(), { target: { value: 'Messages' } });

      expect(await screen.findByRole('option', { name: 'Messages' })).toBeTruthy();
    });

    it('labels the input for threads', async () => {
      await renderBar([]);

      expect(getFilterInput().getAttribute('placeholder')).toBe('Filter threads');
    });
  });
});
