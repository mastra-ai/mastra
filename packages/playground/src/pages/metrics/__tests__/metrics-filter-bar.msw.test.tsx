import type { MastraClient } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';

import Metrics from '..';
import {
  aggregate,
  breakdown,
  emptyEntityNames,
  emptyScores,
  emptyServiceNames,
  environments,
  percentiles,
  supportedStorage,
  tags,
  timeSeries,
} from './fixtures/metrics';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

type MetricAggregateArgs = Parameters<MastraClient['getMetricAggregate']>[0];

const SAVED_FILTERS_KEY = 'mastra:metrics:saved-filters';

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

function setupHandlers() {
  const aggregateRequests: MetricAggregateArgs[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(supportedStorage)),
    http.get(`${TEST_BASE_URL}/api/observability/scores`, () => HttpResponse.json(emptyScores)),
    http.post<never, MetricAggregateArgs>(
      `${TEST_BASE_URL}/api/observability/metrics/aggregate`,
      async ({ request }) => {
        aggregateRequests.push(await request.json());
        return HttpResponse.json(aggregate);
      },
    ),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => HttpResponse.json(breakdown)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/percentiles`, () => HttpResponse.json(percentiles)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/timeseries`, () => HttpResponse.json(timeSeries)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/tags`, () => HttpResponse.json(tags)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/service-names`, () => HttpResponse.json(emptyServiceNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(environments)),
  );
  return { aggregateRequests };
}

function LocationProbe() {
  const location = useLocation();
  return <output data-testid="location">{`${location.pathname}${location.search}`}</output>;
}

const renderPage = (path = '/metrics') =>
  renderWithProviders(
    <TestLinkProvider>
      <Metrics />
      <LocationProbe />
    </TestLinkProvider>,
    { router: { initialEntries: [path] } },
  );

const renderSettledPage = async (path?: string) => {
  const result = renderPage(path);
  await screen.findByRole('heading', { name: 'Agent runs' });
  await waitFor(() => expect(result.queryClient.isFetching()).toBe(0));
  return result;
};

const getChips = () => [...document.querySelectorAll<HTMLElement>('[data-slot="filter-bar-chip"]')];
const getChipLabels = () => getChips().map(chip => chip.getAttribute('aria-label'));
const getChip = (label: string) => screen.getByRole('group', { name: label });
const getFilterInput = () => screen.getByRole('combobox', { name: 'Add filter' });
const typeFilter = (text: string) => fireEvent.change(getFilterInput(), { target: { value: text } });
const pressFilterKey = (key: string) => fireEvent.keyDown(getFilterInput(), { key });
const getLocation = () => screen.getByTestId('location').textContent ?? '';
const getUrlParams = () => new URL(getLocation(), 'http://localhost').searchParams;

/** Builds a `<field> <value>` filter through the typeahead input. */
const pickFilter = async (field: string, value: string) => {
  act(() => getFilterInput().focus());
  typeFilter(field);
  await screen.findByRole('option', { name: field });
  pressFilterKey('Enter');
  typeFilter(value);
  await screen.findByRole('option', { name: value });
  pressFilterKey('Enter');
};

beforeEach(() => {
  Object.defineProperty(window, 'localStorage', { configurable: true, value: createMemoryStorage() });
});

describe('Metrics page filter bar', () => {
  describe('when no filter is set', () => {
    it('shows a single non-removable Time chip set to the last 24 hours', async () => {
      setupHandlers();
      await renderSettledPage();

      expect(screen.getByRole('group', { name: 'Metrics filters' })).toBeTruthy();
      expect(getChipLabels()).toEqual(['Time']);
      expect(within(getChip('Time')).getByRole('button', { name: 'Value: Last 24 hours' })).toBeTruthy();
      expect(within(getChip('Time')).queryByRole('button', { name: /remove/i })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Clear filters' })).toBeNull();
    });
  });

  describe('when the URL carries filters', () => {
    it('renders one chip per filter after the Time chip, in URL order', async () => {
      setupHandlers();
      await renderSettledPage('/metrics?filterEnvironment=production&filterTags=beta&filterTags=support');

      expect(getChipLabels()).toEqual(['Time', 'Environment production', 'Tags beta, support']);
    });

    it('requires every tag of the Tags chip in metrics requests', async () => {
      const { aggregateRequests } = setupHandlers();
      await renderSettledPage('/metrics?filterTags=beta&filterTags=support');

      expect(aggregateRequests.length).toBeGreaterThan(0);
      for (const request of aggregateRequests) {
        expect(request.filters?.tags).toEqual(['beta', 'support']);
      }
    });

    it('shows a chip for a URL-only filter the field list does not offer', async () => {
      setupHandlers();
      await renderSettledPage('/metrics?filterModel=gpt-4o');

      expect(getChipLabels()).toEqual(['Time', 'Model gpt-4o']);
    });
  });

  describe('when the user adds an Environment filter', () => {
    it('writes the filter to the URL', async () => {
      setupHandlers();
      await renderSettledPage();

      await pickFilter('Environment', 'production');

      await waitFor(() => expect(getUrlParams().get('filterEnvironment')).toBe('production'));
      expect(getChipLabels()).toEqual(['Time', 'Environment production']);
    });

    it('scopes metrics requests to that environment', async () => {
      const { aggregateRequests } = setupHandlers();
      await renderSettledPage();

      await pickFilter('Environment', 'production');

      await waitFor(() =>
        expect(aggregateRequests.some(request => request.filters?.environment === 'production')).toBe(true),
      );
    });

    it('remembers the filter for the next visit', async () => {
      setupHandlers();
      await renderSettledPage();

      await pickFilter('Environment', 'production');

      await waitFor(() => expect(window.localStorage.getItem(SAVED_FILTERS_KEY)).toBe('filterEnvironment=production'));
    });
  });

  describe('when the user removes a filter chip', () => {
    it('drops only that filter from the URL', async () => {
      setupHandlers();
      await renderSettledPage('/metrics?filterEnvironment=production&filterServiceName=api');

      fireEvent.click(within(getChip('Environment production')).getByRole('button', { name: /remove/i }));

      await waitFor(() => expect(getUrlParams().has('filterEnvironment')).toBe(false));
      expect(getUrlParams().get('filterServiceName')).toBe('api');
    });
  });

  describe('when the user clears the filters', () => {
    it('removes every filter but keeps the time range', async () => {
      setupHandlers();
      await renderSettledPage('/metrics?period=7d&filterEnvironment=production&filterServiceName=api');

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      await waitFor(() => expect(getLocation()).toBe('/metrics?period=7d'));
      expect(getChipLabels()).toEqual(['Time']);
      // Clear hands focus to the input, which opens its field list over the bar.
      pressFilterKey('Escape');
      expect(within(getChip('Time')).getByRole('button', { name: 'Value: Last 7 days' })).toBeTruthy();
    });

    it('forgets the saved filters', async () => {
      setupHandlers();
      window.localStorage.setItem(SAVED_FILTERS_KEY, 'filterEnvironment=production');
      await renderSettledPage('/metrics?filterEnvironment=production');

      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

      await waitFor(() => expect(getUrlParams().has('filterEnvironment')).toBe(false));
      expect(window.localStorage.getItem(SAVED_FILTERS_KEY) ?? '').toBe('');
    });
  });

  describe('when filters were saved on a previous visit', () => {
    it('restores them when the page opens without filters', async () => {
      setupHandlers();
      window.localStorage.setItem(SAVED_FILTERS_KEY, 'filterEnvironment=production');

      await renderSettledPage();

      await waitFor(() => expect(getUrlParams().get('filterEnvironment')).toBe('production'));
      expect(getChipLabels()).toEqual(['Time', 'Environment production']);
    });
  });

  describe('when the user picks Last 7 days from the Time chip', () => {
    it('writes the period to the URL', async () => {
      setupHandlers();
      await renderSettledPage();

      fireEvent.click(screen.getByRole('button', { name: 'Value: Last 24 hours' }));
      fireEvent.click(await screen.findByRole('menuitemradio', { name: 'Last 7 days' }));

      await waitFor(() => expect(getLocation()).toBe('/metrics?period=7d'));
      expect(screen.getByRole('button', { name: 'Value: Last 7 days' })).toBeTruthy();
    });
  });

  describe('when the user applies a custom range from the Time chip', () => {
    it('writes both bounds of the range to the URL', async () => {
      setupHandlers();
      await renderSettledPage('/metrics?period=custom&dateFrom=2026-01-01T12:00:00Z&dateTo=2026-01-06T12:00:00Z');

      fireEvent.click(within(getChip('Time')).getByRole('button', { name: /^Value: / }));
      fireEvent.click(await screen.findByRole('button', { name: 'Apply' }));

      // The editor applies its default 12:00 AM – 11:59 PM times to the picked days.
      await waitFor(() => expect(new Date(getUrlParams().get('dateTo') ?? '').getHours()).toBe(23));
      const from = new Date(getUrlParams().get('dateFrom') ?? '');
      const to = new Date(getUrlParams().get('dateTo') ?? '');
      expect([from.getHours(), from.getMinutes()]).toEqual([0, 0]);
      expect([to.getHours(), to.getMinutes()]).toEqual([23, 59]);
      expect(getUrlParams().get('period')).toBe('custom');
    });
  });
});
