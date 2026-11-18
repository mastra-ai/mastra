// @vitest-environment jsdom
import type { AggregateTracesResponse, GetObservabilityCapabilitiesResponse } from '@mastra/client-js';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { useState } from 'react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';
import { TracesExplorer } from '../index';
import { DEFAULT_TRACES_FILTERS, DEFAULT_TRACES_SORT, EMPTY_TRACES_SELECTION } from '../traces-explorer-actions';
import type { TracesFilters, TracesSort } from '../traces-explorer-actions';
import {
  emptyDatasets,
  emptyEntityNames,
  emptyEnvironments,
  emptyLightTraces,
  emptyTraceQueryFields,
  idleDeltaBatch,
  traceTokenSearchCapabilities,
  twoTracesPage,
  weatherTraceUsage,
} from './fixtures/traces-explorer';
import { useFixedChartSize } from '@/test/chart-size';
import { TestLinkProvider } from '@/test/link-provider';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const DAY = 24 * 60 * 60 * 1000;
const CHUNK = 7 * DAY;

const progressiveCapabilities: GetObservabilityCapabilitiesResponse = {
  ...traceTokenSearchCapabilities,
  capabilities: { ...traceTokenSearchCapabilities.capabilities, observabilityProgressiveSearch: true },
};

const WORD_SEARCH_30D: TracesFilters = {
  ...DEFAULT_TRACES_FILTERS,
  datePreset: 'last-30d',
  tokens: [{ fieldId: 'spans.all', operatorId: 'hasAllTokens', value: 'weather' }],
};

type Body = { timeRange: { from: string; to: string }; progressive?: true; continuation?: string; mode?: string };

/** Like the server with #5246: one 7-day chunk per progressive request, newest first. */
function chunkOf(body: Body) {
  const index = Number(body.continuation ?? 0);
  const fromMs = Date.parse(body.timeRange.from);
  const toMs = Date.parse(body.timeRange.to);
  const chunkFrom = Math.max(fromMs, toMs - (index + 1) * CHUNK);
  return {
    chunkTo: toMs - index * CHUNK,
    searchedRange: { from: new Date(chunkFrom).toISOString(), to: body.timeRange.to },
    continuation: chunkFrom > fromMs ? String(index + 1) : null,
  };
}

const chunkedAggregate = (body: Body): AggregateTracesResponse => {
  const { chunkTo, searchedRange, continuation } = chunkOf(body);
  return {
    rows: [{ bucket: new Date(chunkTo - DAY).toISOString(), measures: { count: 4, errorCount: 0 } }],
    truncated: false,
    searchedRange,
    continuation,
    mergeable: true,
  };
};

const setHandlers = ({
  capabilities = progressiveCapabilities,
  aggregate = body => HttpResponse.json(chunkedAggregate(body)),
}: {
  capabilities?: GetObservabilityCapabilitiesResponse;
  aggregate?: (body: Body) => Response | Promise<Response>;
} = {}) => {
  const queries: Body[] = [];
  const aggregates: Body[] = [];
  server.use(
    http.get(`${TEST_BASE_URL}/api/observability/capabilities`, () => HttpResponse.json(capabilities)),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query`, async ({ request }) => {
      const body = (await request.json()) as Body;
      if (body.mode === 'delta') return HttpResponse.json(idleDeltaBatch);
      queries.push(body);
      return HttpResponse.json(body.progressive ? { ...twoTracesPage, ...chunkOf(body) } : twoTracesPage);
    }),
    http.post(`${TEST_BASE_URL}/api/observability/traces/aggregate`, async ({ request }) => {
      const body = (await request.json()) as Body;
      aggregates.push(body);
      await delay(20);
      return aggregate(body);
    }),
    http.get(`${TEST_BASE_URL}/api/observability/traces/light`, () => HttpResponse.json(emptyLightTraces)),
    http.post(`${TEST_BASE_URL}/api/observability/traces/query/fields`, () => HttpResponse.json(emptyTraceQueryFields)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/entity-names`, () => HttpResponse.json(emptyEntityNames)),
    http.get(`${TEST_BASE_URL}/api/observability/discovery/environments`, () => HttpResponse.json(emptyEnvironments)),
    http.get(`${TEST_BASE_URL}/api/datasets`, () => HttpResponse.json(emptyDatasets)),
    http.post(`${TEST_BASE_URL}/api/observability/metrics/breakdown`, () => HttpResponse.json(weatherTraceUsage)),
  );
  return { queries, aggregates };
};

function Harness({ withChart = true }: { withChart?: boolean }) {
  const [selection, setSelection] = useState(EMPTY_TRACES_SELECTION);
  const [filters, setFilters] = useState(WORD_SEARCH_30D);
  const [sort, setSort] = useState<TracesSort>(DEFAULT_TRACES_SORT);
  return (
    <TracesExplorer
      selection={selection}
      filters={filters}
      onChange={next => {
        setSelection(next.selection);
        setFilters(next.filters);
      }}
      sort={sort}
      onSortChange={setSort}
      metricsSupport={{ supported: true, isLoading: false }}
    >
      <TracesExplorer.FilterBar />
      <TracesExplorer.SearchProgress />
      <TracesExplorer.Body chart={withChart ? <TracesExplorer.Histogram /> : undefined}>
        <TracesExplorer.List />
      </TracesExplorer.Body>
    </TracesExplorer>
  );
}

const renderExplorer = (props: { withChart?: boolean } = {}) =>
  renderWithProviders(
    <TestLinkProvider>
      <Harness {...props} />
    </TestLinkProvider>,
  );

// Spinners are statuses too.
const progressLine = () => screen.queryAllByRole('status').find(element => element.tagName === 'P');
const status = () => progressLine()?.textContent;

beforeAll(() => {
  Element.prototype.getAnimations ??= () => [];
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {};
});
afterEach(() => localStorage.clear());

describe('TracesExplorer progressive word search', () => {
  useFixedChartSize(1200, 800);

  describe('when the server searches in chunks', () => {
    it('charts the range one chunk at a time and follows the chart in the status line', async () => {
      const { queries, aggregates } = setHandlers();
      renderExplorer();

      await waitFor(() => expect(status()).toBe('Searched all 30 days.'), { timeout: 3000 });
      expect(aggregates.map(body => body.continuation)).toEqual([undefined, '1', '2', '3', '4']);
      expect(aggregates.every(body => body.progressive === true)).toBe(true);
      expect(queries[0]).toMatchObject({ progressive: true });
      expect(screen.getByRole('region', { name: 'Traces over time' }).textContent).toContain('20 traces');
    });

    it('stops charting on Stop and goes on with Continue', async () => {
      let release: () => void = () => {};
      const held = new Promise<void>(resolve => (release = resolve));
      const { aggregates } = setHandlers({
        aggregate: async body => {
          if (body.continuation === '1') await held;
          return HttpResponse.json(chunkedAggregate(body));
        },
      });
      renderExplorer();

      await waitFor(() => expect(status()).toBe('Searched the last 7 of 30 days…'), { timeout: 3000 });
      fireEvent.click(screen.getByRole('button', { name: 'Stop' }));
      await act(async () => {
        release();
        await delay(200);
      });
      expect(aggregates.map(body => body.continuation)).toEqual([undefined, '1']);
      expect(status()).toBe('Stopped after the last 14 of 30 days.');

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      await waitFor(() => expect(status()).toBe('Searched all 30 days.'), { timeout: 3000 });
    });

    it('follows the list when there is no chart', async () => {
      const { queries, aggregates } = setHandlers();
      renderExplorer({ withChart: false });

      // The list loads its newest chunk; older ones load as the user scrolls.
      await waitFor(() => expect(status()).toBe('Searched the last 7 of 30 days…'), { timeout: 3000 });
      expect(queries).toHaveLength(1);
      expect(aggregates).toHaveLength(0);
    });
  });

  describe('when the server does not search in chunks', () => {
    it('sends no progressive fields and shows no progress', async () => {
      const { queries, aggregates } = setHandlers({
        capabilities: traceTokenSearchCapabilities,
        aggregate: () => HttpResponse.json<AggregateTracesResponse>({ rows: [], truncated: false }),
      });
      renderExplorer();

      await waitFor(() => expect(aggregates.length).toBeGreaterThan(0));
      await waitFor(() => expect(queries.length).toBeGreaterThan(0));
      expect(queries.every(body => !('progressive' in body))).toBe(true);
      expect(aggregates.every(body => !('progressive' in body))).toBe(true);
      expect(progressLine()).toBeUndefined();
    });
  });
});
