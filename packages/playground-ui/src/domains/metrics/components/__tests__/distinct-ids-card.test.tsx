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

/** A legend entry's label and range total, e.g. `Resources5`. */
const legendEntry = (label: string) => screen.getByText(label).parentElement?.textContent;

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

/** Fails `failures` times (the client retries a 500 three times on its own), then serves the card. */
function failThenServe(failures: number) {
  let calls = 0;
  serveTraceAggregate(request => {
    calls++;
    if (calls <= failures) return HttpResponse.json(traceAggregateErrorFixture, { status: 500 });
    return respond(request);
  });
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

  it('shows range totals from their own request, not the sum of buckets', async () => {
    serveCard();
    render(<DistinctIdsCard />);

    // Buckets hold 3 + 4 resources; the range has 5.
    await screen.findByText('Resources');
    expect(legendEntry('Resources')).toBe('Resources5');
    expect(legendEntry('Threads')).toBe('Threads14');
  });

  it('asks for all four distinct ids once per hour and once for the range', async () => {
    serveCard();
    render(<DistinctIdsCard />);
    await screen.findByText('Resources');

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
      await screen.findByText('Resources');

      expect(screen.getByText('Threads')).toBeDefined();
      expect(screen.queryByText('Users')).toBeNull();
      expect(screen.queryByText('Sessions')).toBeNull();
    });
  });

  describe('when the traces also set user and session ids', () => {
    it('adds them to the legend with their totals', async () => {
      serveCard({ totals: distinctIdsWithUsersTotalsFixture });
      render(<DistinctIdsCard />);
      await screen.findByText('Resources');

      expect(legendEntry('Users')).toBe('Users2');
      expect(legendEntry('Sessions')).toBe('Sessions3');
    });
  });

  it('says when no traces in the range set any of the ids', async () => {
    serveCard({ empty: true });
    render(<DistinctIdsCard />);

    expect(
      await screen.findByText('No traces in this range set a resource, thread, user or session id.'),
    ).toBeDefined();
  });

  it('loads after Retry when both requests failed', async () => {
    failThenServe(8);
    render(<DistinctIdsCard />);

    await waitFor(() => expect(screen.getByText(ERROR)).toBeDefined(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Resources', undefined, { timeout: 5000 })).toBeDefined();
    expect(legendEntry('Resources')).toBe('Resources5');
  });

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
