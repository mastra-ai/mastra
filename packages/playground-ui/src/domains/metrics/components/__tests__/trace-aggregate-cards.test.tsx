// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropertyFilterToken } from '../../../../ds/components/PropertyFilter/types';
import { buildTracesDrilldownUrl } from '../../drilldown';
import type { DrilldownScope } from '../../drilldown';
import { MetricsProvider } from '../../hooks/use-metrics';
import { TopEntitiesCard } from '../top-entities-card';
import { TraceLatencyCard } from '../trace-latency-card';
import {
  emptyTraceAggregateFixture,
  latencyByRootTypeFixture,
  olderServerCapabilities,
  topEntitiesFixture,
  traceAggregateCapabilities,
  traceAggregateErrorFixture,
} from './fixtures/trace-aggregate';
import { seedMetrics, serveCapabilities, serveTraceAggregate } from './metrics-msw';
import type { TraceAggregateRequest } from './metrics-msw';
import { renderWithProviders } from '@/test/render';

const ERROR = "Couldn't load this data. Try again in a moment.";

let requests: TraceAggregateRequest[] = [];
const onDrilldown = vi.fn<(scope: DrilldownScope) => void>();

/** Latency series for grouped-by-spanType requests, the entity ranking for the rest. */
function serveCards({ latency = true, entities = topEntitiesFixture } = {}) {
  serveTraceAggregate(request => {
    requests.push(request);
    if (request.groupBy.includes('spanType')) {
      return latency ? latencyByRootTypeFixture(request.timeRange) : emptyTraceAggregateFixture;
    }
    return entities;
  });
}

/** Fails `failures` times (the client retries a 500 on its own first), then serves the cards. */
function failThenServe(failures: number) {
  let calls = 0;
  serveTraceAggregate(request => {
    calls++;
    if (calls <= failures) return HttpResponse.json(traceAggregateErrorFixture, { status: 500 });
    return request.groupBy.includes('spanType') ? latencyByRootTypeFixture(request.timeRange) : topEntitiesFixture;
  });
}

function renderCards(filterTokens: PropertyFilterToken[] = []) {
  return renderWithProviders(
    <MetricsProvider preset="24h" filterTokens={filterTokens} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
      <TraceLatencyCard onViewTraces={onDrilldown} onPointClick={onDrilldown} />
      <TopEntitiesCard onEntityClick={onDrilldown} />
    </MetricsProvider>,
  );
}

function card(title: string): HTMLElement {
  const found = screen.getByText(title).closest<HTMLElement>('[class*="rounded"]');
  if (!found) throw new Error(`No card titled ${title}`);
  return found;
}
/** Waits for `text` in the card; the card re-mounts once capabilities load, so it's found again each try. */
const findInCard = (title: string, text: string, timeout?: number) =>
  waitFor(() => within(card(title)).getByText(text), { timeout });
/** Body rows' text, skipping the header row. */
const rowNames = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .slice(1)
    .map(row => row.textContent);

beforeEach(() => {
  requests = [];
  onDrilldown.mockReset();
  seedMetrics();
});

describe('Trace latency card', () => {
  describe('when the server answers aggregateTraces()', () => {
    beforeEach(() => serveCapabilities(traceAggregateCapabilities));

    it("charts agent traces' percentiles and switches to workflows", async () => {
      serveCards();
      renderCards();

      expect(await findInCard('Trace latency', '650ms')).toBeDefined();
      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));
      expect(within(card('Trace latency')).getByText('2.50s')).toBeDefined();
    });

    it('asks for P50/P90/P99 by root span type, bucketed hourly within the row cap', async () => {
      serveCards();
      renderCards();
      await findInCard('Trace latency', '650ms');

      const request = requests.find(r => r.groupBy.includes('spanType'));
      expect(request).toMatchObject({
        groupBy: ['spanType'],
        interval: '1h',
        measures: ['duration.p50', 'duration.p90', 'duration.p99'],
        limit: 10,
      });
    });

    it('says when the range has no agent traces', async () => {
      serveCards({ latency: false });
      renderCards();

      expect(await screen.findByText('No agent traces in this range.')).toBeDefined();
    });

    it('opens the open tab’s traces from View in Traces', async () => {
      serveCards();
      renderCards([{ fieldId: 'environment', value: 'production' }]);
      await findInCard('Trace latency', '650ms');

      fireEvent.click(screen.getByRole('tab', { name: 'Workflows' }));
      fireEvent.click(within(card('Trace latency')).getByRole('button', { name: 'View in Traces' }));

      const [[scope]] = onDrilldown.mock.calls;
      const url = new URL(
        buildTracesDrilldownUrl({ preset: '24h', dashboardFilter: { environment: 'production' }, scope }),
        'http://studio',
      );
      expect(url.searchParams.get('rootEntityType')).toBe('workflow_run');
      expect(url.searchParams.get('filterEnvironment')).toBe('production');
    });

    it('loads after Retry when the aggregate failed', async () => {
      // Both cards fail through the client's retries; Retry on the latency card then succeeds.
      failThenServe(8);
      renderCards();

      await waitFor(() => expect(within(card('Trace latency')).getByText(ERROR)).toBeDefined(), { timeout: 5000 });
      fireEvent.click(within(card('Trace latency')).getByRole('button', { name: 'Retry' }));

      expect(await findInCard('Trace latency', '650ms', 5000)).toBeDefined();
    });

    it('says a service filter has no trace equivalent instead of ignoring it', async () => {
      serveCards();
      renderCards([{ fieldId: 'serviceName', value: 'checkout' }]);

      expect(await findInCard('Trace latency', 'Not available with a service filter.')).toBeDefined();
      expect(requests).toHaveLength(0);
    });
  });

  describe('when the server aggregates traces but not root span fields', () => {
    it('is hidden, while the entity ranking still shows', async () => {
      serveCapabilities({
        ...traceAggregateCapabilities,
        capabilities: { ...traceAggregateCapabilities.capabilities, traceQueryRootSpanFields: false },
      });
      serveCards();
      renderCards();

      expect(await screen.findByText('ingest')).toBeDefined();
      expect(screen.queryByText('Trace latency')).toBeNull();
    });
  });
});

describe('Top entities card', () => {
  describe('when the server answers aggregateTraces()', () => {
    beforeEach(() => serveCapabilities(traceAggregateCapabilities));

    it('ranks entities by P95, error rate, then cost from one request', async () => {
      serveCards();
      renderCards();

      const list = () => within(card('Top entities')).getByRole('table');
      await findInCard('Top entities', 'ingest');
      expect(rowNames(list())).toEqual([
        'ingestworkflow_run30012.0s',
        'researcheragent1003.00s',
        'writeragent50800ms',
        'triageagent20500ms',
      ]);

      fireEvent.click(screen.getByRole('tab', { name: 'Most failing' }));
      // Same rate: more errors first. `ingest` never failed.
      expect(rowNames(list())).toEqual(['writeragent50510.0%', 'triageagent20210.0%', 'researcheragent10022.00%']);

      fireEvent.click(screen.getByRole('tab', { name: 'Most expensive' }));
      // Partly priced is approximate; a total in two currencies has no value and ranks last.
      expect(rowNames(list())).toEqual(['writeragent50~$4.50', 'researcheragent100$1.20', 'triageagent20—']);

      expect(requests.filter(r => r.groupBy.includes('entityName'))).toHaveLength(1);
    });

    it('asks for the 500 busiest entities, grouped by type and name', async () => {
      serveCards();
      renderCards();
      await screen.findByText('ingest');

      expect(requests.find(r => r.groupBy.includes('entityName'))).toMatchObject({
        groupBy: ['entityType', 'entityName'],
        measures: ['count', 'errorRate', 'errorCount', 'duration.p95', 'cost.sum'],
        orderBy: { field: 'count', direction: 'desc' },
        limit: 500,
      });
    });

    it('leaves scorer runs out, alongside the page filters', async () => {
      serveCards();
      renderCards([{ fieldId: 'environment', value: 'production' }]);
      await screen.findByText('ingest');

      const notScorer = { op: 'notIn', value: { path: 'entityType' }, set: ['scorer'] };
      expect(requests.find(r => r.groupBy.includes('entityName'))?.where).toEqual({
        op: 'and',
        args: [{ op: 'eq', left: { path: 'environment' }, right: { literal: 'production' } }, notScorer],
      });
    });

    it('notes when the ranking only covered the busiest entities', async () => {
      serveCards({ entities: { ...topEntitiesFixture, truncated: true } });
      renderCards();

      expect(await screen.findByText('Ranked from the 500 entities with the most traces.')).toBeDefined();
    });

    it('says when the range has no traces', async () => {
      serveCards({ entities: emptyTraceAggregateFixture });
      renderCards();

      expect(await screen.findByText('No traces in this range.')).toBeDefined();
    });

    it("opens a clicked entity's traces with the page filters", async () => {
      serveCards();
      renderCards([{ fieldId: 'environment', value: 'production' }]);

      fireEvent.click(await screen.findByRole('button', { name: /writer/ }));

      const [[scope]] = onDrilldown.mock.calls;
      const url = new URL(
        buildTracesDrilldownUrl({ preset: '24h', dashboardFilter: { environment: 'production' }, scope }),
        'http://studio',
      );
      expect(url.searchParams.get('rootEntityType')).toBe('agent');
      expect(url.searchParams.get('filterEntityName')).toBe('writer');
      expect(url.searchParams.get('filterEnvironment')).toBe('production');
    });

    it('loads after Retry when the aggregate failed', async () => {
      failThenServe(8);
      renderCards();

      await waitFor(() => expect(within(card('Top entities')).getByText(ERROR)).toBeDefined(), { timeout: 5000 });
      fireEvent.click(within(card('Top entities')).getByRole('button', { name: 'Retry' }));

      expect(await screen.findByText('ingest', undefined, { timeout: 5000 })).toBeDefined();
    });
  });

  describe('when the server is older than aggregateTraces()', () => {
    it('hides both cards and sends no aggregate request', async () => {
      serveCapabilities(olderServerCapabilities);
      serveCards();
      const { container } = renderCards();

      await waitFor(() => expect(container.textContent).toBe(''));
      expect(requests).toHaveLength(0);
    });
  });

  describe('when the capabilities request fails', () => {
    it('hides both cards', async () => {
      serveCapabilities('missing');
      serveCards();
      const { container } = renderCards();

      await waitFor(() => expect(container.textContent).toBe(''));
      expect(requests).toHaveLength(0);
    });
  });
});
