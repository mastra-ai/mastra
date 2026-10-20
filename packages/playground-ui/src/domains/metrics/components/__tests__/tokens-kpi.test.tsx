// @vitest-environment jsdom
import { screen, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PropertyFilterToken } from '../../../../ds/components/PropertyFilter/types';
import { MetricsProvider } from '../../hooks/use-metrics';
import { MetricsKpis } from '../metrics-kpis';
import {
  emptyTokenTotalsFixture,
  previousTokenTotalsFixture,
  tokenTotalsFixture,
  traceAggregateCapabilities,
  traceAggregateErrorFixture,
} from './fixtures/trace-aggregate';
import { seedMetrics, serveCapabilities, serveTraceAggregate } from './metrics-msw';
import type { TraceAggregateRequest } from './metrics-msw';
import { server } from '@/test/msw-server';
import { renderWithProviders, TEST_BASE_URL } from '@/test/render';

const METRIC_AGGREGATE_API = `${TEST_BASE_URL}/api/observability/metrics/aggregate`;

let aggregateRequests: TraceAggregateRequest[] = [];
let tokenMetricRequests = 0;

/** Counts token-metric KPI requests, so a test can tell which source the KPI read. */
function countTokenMetricRequests() {
  server.use(
    http.post(METRIC_AGGREGATE_API, async ({ request }) => {
      // The cost KPI asks for input and output together; the tokens KPI asks for each on its own.
      const body: unknown = await request.clone().json();
      const names = typeof body === 'object' && body !== null && 'name' in body ? [body.name].flat() : [];
      if (names.length === 1 && names[0] === 'mastra_model_total_input_tokens') tokenMetricRequests += 1;
      return undefined;
    }),
  );
}

/** Answers the current 24h window with this window's totals and anything older with the previous. */
function serveTokenTotals(current = tokenTotalsFixture) {
  serveTraceAggregate(request => {
    aggregateRequests.push(request);
    const isCurrent = Date.now() - new Date(request.timeRange.to).getTime() < 60 * 60 * 1000;
    return isCurrent ? current : previousTokenTotalsFixture;
  });
}

function renderKpis(filterTokens: PropertyFilterToken[] = []) {
  return renderWithProviders(
    <MetricsProvider preset="24h" filterTokens={filterTokens} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
      <MetricsKpis />
    </MetricsProvider>,
  );
}

describe('Tokens KPI', () => {
  beforeEach(() => {
    aggregateRequests = [];
    tokenMetricRequests = 0;
    seedMetrics();
    countTokenMetricRequests();
  });

  describe('when the server answers aggregateTraces()', () => {
    beforeEach(() => serveCapabilities(traceAggregateCapabilities));

    it("sums the traces' input and output tokens against the previous range", async () => {
      serveTokenTotals();
      renderKpis();

      expect(await screen.findByText('12.0K')).toBeDefined();
      expect(screen.getByText('vs 8.00K')).toBeDefined();
      expect(tokenMetricRequests).toBe(0);
    });

    it('asks for the frozen 24h window and the 24h before it, unfiltered', async () => {
      serveTokenTotals();
      renderKpis();
      await screen.findByText('12.0K');

      const [current, previous] = [...aggregateRequests].sort((a, b) => b.timeRange.to.localeCompare(a.timeRange.to));
      expect(current.measures).toEqual(['tokens.input.sum', 'tokens.output.sum']);
      expect(current.groupBy ?? []).toEqual([]);
      expect(current.where).toBeUndefined();
      const day = 24 * 60 * 60 * 1000;
      const span = (r: TraceAggregateRequest) => Date.parse(r.timeRange.to) - Date.parse(r.timeRange.from);
      expect(span(current)).toBe(day);
      expect(previous.timeRange.to).toBe(current.timeRange.from);
      expect(span(previous)).toBe(day);
    });

    it('passes the page filters as a trace predicate', async () => {
      serveTokenTotals();
      renderKpis([{ fieldId: 'environment', value: 'production' }]);
      await screen.findByText('12.0K');

      expect(aggregateRequests[0].where).toEqual({
        op: 'eq',
        left: { path: 'environment' },
        right: { literal: 'production' },
      });
    });

    it('shows a dash when no trace in the range reported usage', async () => {
      serveTokenTotals(emptyTokenTotalsFixture);
      renderKpis();

      await waitFor(() => expect(aggregateRequests).toHaveLength(2));
      const card = (await screen.findByText('input and output')).closest('[class*="rounded"]');
      await waitFor(() => expect(card?.textContent).toContain('—'));
      expect(screen.queryByText('12.0K')).toBeNull();
      expect(screen.queryByText("Couldn't load")).toBeNull();
    });

    it('says the KPI could not load when the aggregate fails', async () => {
      serveTraceAggregate(() => HttpResponse.json(traceAggregateErrorFixture, { status: 500 }));
      renderKpis();

      // Only the tokens KPI reads traces; the other three still load from metrics.
      await waitFor(() => expect(screen.getAllByText("Couldn't load")).toHaveLength(1), { timeout: 5000 });
      expect(screen.getByText('693')).toBeDefined();
    });

    it('falls back to the token metrics when a filter has no trace equivalent', async () => {
      serveTokenTotals();
      renderKpis([{ fieldId: 'serviceName', value: 'checkout' }]);

      await waitFor(() => expect(tokenMetricRequests).toBe(1));
      expect(aggregateRequests).toHaveLength(0);
    });
  });

  describe('when the server is older than aggregateTraces()', () => {
    it('reads the token metrics, as before', async () => {
      serveTokenTotals();
      renderKpis();

      await waitFor(() => expect(tokenMetricRequests).toBe(1));
      expect(await screen.findByText('693')).toBeDefined();
      expect(aggregateRequests).toHaveLength(0);
    });
  });

  describe('when the capabilities request fails', () => {
    it('reads the token metrics, as before', async () => {
      serveCapabilities('missing');
      serveTokenTotals();
      renderKpis();

      await waitFor(() => expect(tokenMetricRequests).toBe(1));
      expect(aggregateRequests).toHaveLength(0);
    });
  });
});
