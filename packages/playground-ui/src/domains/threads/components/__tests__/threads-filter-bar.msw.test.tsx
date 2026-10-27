// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it, vi } from 'vitest';
import type { TraceFilterGroup, TraceFilterToken } from '../../../traces/trace-query-filters';
import {
  discoveredEntityNames,
  discoveredEnvironments,
  statusAndRunTokens,
  threadQueryCapabilities,
} from '../../__tests__/fixtures/threads';
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

const getFilterChips = () => [...document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]')];
const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' }) as HTMLInputElement;

const renderBar = async (tokens: TraceFilterToken[]) => {
  setDiscoveryHandlers();
  const onFiltersChange = vi.fn<OnFiltersChange>();
  const { queryClient } = renderWithProviders(
    <ThreadsFilterBar
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
    it('renders the time range chip before the filter chips', async () => {
      await renderBar(statusAndRunTokens);

      expect(getFilterChips().map(chip => chip.textContent)).toEqual([
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
      fireEvent.change(getFilterInput(), { target: { value: 'Trace count' } });

      expect(await screen.findByRole('option', { name: 'Trace count' })).toBeTruthy();
    });

    it('labels the input for threads', async () => {
      await renderBar([]);

      expect(getFilterInput().getAttribute('placeholder')).toBe('Filter threads…');
    });
  });
});
