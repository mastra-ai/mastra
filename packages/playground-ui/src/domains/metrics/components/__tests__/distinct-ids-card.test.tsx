// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it } from 'vitest';
import type { PropertyFilterToken } from '../../../../ds/components/PropertyFilter/types';
import { MetricsProvider } from '../../hooks/use-metrics';
import { DistinctIdsCard } from '../distinct-ids-card';
import {
  distinctIdsSeriesFixture,
  distinctIdsTotalsFixture,
  distinctIdsWithUsersTotalsFixture,
  emptyTraceAggregateFixture,
  olderServerCapabilities,
  traceAggregateCapabilities,
  traceAggregateErrorFixture,
} from './fixtures/trace-aggregate';
import { seedMetrics, serveCapabilities, serveTraceAggregate } from './metrics-msw';
import type { TraceAggregateRequest } from './metrics-msw';
import { renderWithProviders } from '@/test/render';

const ERROR = "Couldn't load this data. Try again in a moment.";
const MEASURES = [
  'countDistinct.resourceId',
  'countDistinct.threadId',
  'countDistinct.userId',
  'countDistinct.sessionId',
];

let requests: TraceAggregateRequest[] = [];

/** Legend text only: each total also names its id, for screen readers. */
const LEGEND = { ignore: 'script, style, .sr-only' };

/** A legend entry's text: its label alone, e.g. `Resources`. */
const legendEntry = (label: string) => screen.getByText(label, LEGEND).parentElement?.textContent;

type Served = { empty?: boolean; totals?: typeof distinctIdsTotalsFixture };

function respond(request: TraceAggregateRequest, { empty = false, totals = distinctIdsTotalsFixture }: Served = {}) {
  if (empty) return emptyTraceAggregateFixture;
  return request.interval ? distinctIdsSeriesFixture(request.timeRange) : totals;
}

function serveCard(served?: Served) {
  serveTraceAggregate(request => {
    requests.push(request);
    return respond(request, served);
  });
}

/**
 * Fails every request until `recover()` is called, then serves the card. Failing by state, not by a
 * count of requests, keeps the test independent of how often the client retries a 500 on its own.
 */
function failUntilRecovered() {
  let failing = true;
  const failed = new Set<'series' | 'totals'>();
  serveTraceAggregate(request => {
    if (!failing) return respond(request);
    failed.add(request.interval ? 'series' : 'totals');
    return HttpResponse.json(traceAggregateErrorFixture, { status: 500 });
  });
  return {
    failed,
    recover: () => {
      failing = false;
    },
  };
}

function render(ui: ReactElement, filterTokens: PropertyFilterToken[] = []) {
  return renderWithProviders(
    <MetricsProvider preset="24h" filterTokens={filterTokens} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
      {ui}
    </MetricsProvider>,
  );
}

beforeEach(() => {
  requests = [];
  seedMetrics();
});

describe('when the server answers aggregateTraces()', () => {
  beforeEach(() => serveCapabilities(traceAggregateCapabilities));

  it('labels each id in the legend, without its range total', async () => {
    serveCard();
    render(<DistinctIdsCard />);

    await screen.findByText('Resources', LEGEND);
    expect(legendEntry('Resources')).toBe('Resources');
    expect(legendEntry('Threads')).toBe('Threads');
  });

  it("shows each id's range total top right, from the range request", async () => {
    serveCard();
    render(<DistinctIdsCard />);

    // 5 and 14 for the range, not the sum of the hourly counts.
    expect(await screen.findByText((_, el) => el?.textContent === 'Resources 5')).toBeDefined();
    expect(screen.getByText((_, el) => el?.textContent === 'Threads 14')).toBeDefined();
  });

  it('asks for all four distinct ids once per hour and once for the range', async () => {
    serveCard();
    render(<DistinctIdsCard />);
    await screen.findByText('Resources', LEGEND);

    expect(requests).toHaveLength(2);
    expect(requests.find(r => r.interval)).toMatchObject({
      interval: '1h',
      measures: MEASURES,
      groupBy: [],
      limit: 10,
    });
    expect(requests.find(r => !r.interval)).toMatchObject({ measures: MEASURES, groupBy: [] });
  });

  describe('when the traces set no user or session ids', () => {
    it('leaves users and sessions out of the legend', async () => {
      serveCard();
      render(<DistinctIdsCard />);
      await screen.findByText('Resources', LEGEND);

      expect(screen.getByText('Threads', LEGEND)).toBeDefined();
      expect(screen.queryByText('Users', LEGEND)).toBeNull();
      expect(screen.queryByText('Sessions', LEGEND)).toBeNull();
    });
  });

  describe('when the traces also set user and session ids', () => {
    it('adds them to the legend', async () => {
      serveCard({ totals: distinctIdsWithUsersTotalsFixture });
      render(<DistinctIdsCard />);
      await screen.findByText('Resources', LEGEND);

      expect(legendEntry('Users')).toBe('Users');
      expect(legendEntry('Sessions')).toBe('Sessions');
    });
  });

  it('says when no traces in the range set any of the ids', async () => {
    serveCard({ empty: true });
    render(<DistinctIdsCard />);

    expect(await screen.findByText('No data in this range')).toBeDefined();
  });

  it('loads after Retry when both requests failed', async () => {
    const outage = failUntilRecovered();
    const { queryClient } = render(<DistinctIdsCard />);

    expect(await screen.findByText(ERROR, undefined, { timeout: 5000 })).toBeDefined();
    // The error shows as soon as one request fails; the other may still be in the client's own
    // retries. Wait until both have failed, so Retry has to send both again.
    await waitFor(() => expect(queryClient.isFetching()).toBe(0), { timeout: 5000 });
    expect([...outage.failed].sort()).toEqual(['series', 'totals']);
    outage.recover();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Resources', LEGEND)).toBeDefined();
    expect(screen.getByText('Threads', LEGEND)).toBeDefined();
  }, 15_000);

  it('says a service filter has no trace equivalent, and sends nothing', async () => {
    serveCard();
    render(<DistinctIdsCard />, [{ fieldId: 'serviceName', value: 'checkout' }]);

    expect(await screen.findByText('Not available with a service filter.')).toBeDefined();
    expect(requests).toHaveLength(0);
  });
});

describe.each([
  ['the server is older than aggregateTraces()', olderServerCapabilities] as const,
  ['the capabilities request fails', 'missing'] as const,
])('when %s', (_, capabilities) => {
  it('hides the card and sends no aggregate request', async () => {
    serveCapabilities(capabilities);
    serveCard();
    const { container } = render(<DistinctIdsCard />);

    await waitFor(() => expect(container.textContent).toBe(''));
    expect(requests).toHaveLength(0);
  });
});
