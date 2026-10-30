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

/** Fails every request until the returned `recover()` is called, so only Retry can make it load. */
function failUntilRetried() {
  let failing = true;
  serveTraceAggregate(request => {
    requests.push(request);
    return failing
      ? HttpResponse.json(traceAggregateErrorFixture, { status: 500 })
      : HttpResponse.json(respond(request));
  });
  return () => {
    failing = false;
  };
}

/**
 * Fails the range-totals request once — a 4xx fails at once — then serves them, and keeps the
 * bucket request in flight until `release()`: one request has failed while the other still runs.
 */
function failTotalsWhileBucketsLoad() {
  let totalsCalls = 0;
  let release = () => {};
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  serveTraceAggregate(async request => {
    requests.push(request);
    if (request.interval) {
      await held;
      return HttpResponse.json(respond(request));
    }
    totalsCalls++;
    return totalsCalls === 1
      ? HttpResponse.json(traceAggregateErrorFixture, { status: 400 })
      : HttpResponse.json(respond(request));
  });
  return {
    release: () => release(),
    totalsCalls: () => totalsCalls,
  };
}

function render(ui: ReactElement, filterTokens: PropertyFilterToken[] = []) {
  return renderWithProviders(
    <MetricsProvider preset="24h" filterTokens={filterTokens} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
      {ui}
    </MetricsProvider>,
  );
}

/** The card inside a dashboard pinned to `preset`, for re-rendering it onto another scope. */
function atPreset(preset: '24h' | '7d') {
  return (
    <MetricsProvider preset={preset} filterTokens={[]} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
      <DistinctIdsCard />
    </MetricsProvider>
  );
}

/**
 * Serves the first scope, then — once `nextScope()` is called — fails that scope's range totals
 * while holding its bucket request open. A new scope keeps the previous answer on screen, so the
 * totals failure lands with the buckets still fetching rather than still loading.
 */
function failTotalsOfNextScope() {
  let next = false;
  let release = () => {};
  const held = new Promise<void>(resolve => {
    release = resolve;
  });
  serveTraceAggregate(async request => {
    requests.push(request);
    if (!next) return HttpResponse.json(respond(request));
    if (request.interval) {
      await held;
      return HttpResponse.json(respond(request));
    }
    return HttpResponse.json(traceAggregateErrorFixture, { status: 400 });
  });
  return { nextScope: () => (next = true), release: () => release() };
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
    const recover = failUntilRetried();
    render(<DistinctIdsCard />);

    await waitFor(() => expect(screen.getByText(ERROR)).toBeDefined(), { timeout: 5000 });
    recover();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Resources', undefined, { timeout: 5000 })).toBeDefined();
    expect(legendEntry('Resources')).toBe('Resources5');
    // Two waits of up to 5 s each: the default 5 s test timeout cuts it short under a loaded run.
  }, 15_000);

  it('keeps loading until both requests settle, then loads again after Retry', async () => {
    // One request failed while the other is still loading: the card must not report a failure
    // Retry cannot fix, and Retry must re-request both once it does.
    const card = failTotalsWhileBucketsLoad();
    const { queryClient } = render(<DistinctIdsCard />);

    await waitFor(() => {
      const totals = queryClient
        .getQueryCache()
        .findAll({ queryKey: ['trace-aggregate'] })
        .find(query => !(query.queryKey[1] as { interval?: string }).interval);
      expect(totals?.state.status).toBe('error');
    });
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();

    // The buckets answer: now both requests have settled, so the totals failure is the card's.
    card.release();
    await waitFor(() => expect(screen.getByText(ERROR)).toBeDefined(), { timeout: 5000 });

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Resources', undefined, { timeout: 5000 })).toBeDefined();
    expect(card.totalsCalls()).toBe(2);
    expect(legendEntry('Resources')).toBe('Resources5');
  }, 15_000);

  it('keeps the loaded card on a new scope until that scope’s requests settle', async () => {
    // A new scope keeps the previous answer on screen while it fetches, so the card is not
    // loading when the totals of the new scope fail: the buckets are still running, and reporting
    // the failure now would leave Retry unable to recover the card.
    const card = failTotalsOfNextScope();
    const { rerender, queryClient } = renderWithProviders(atPreset('24h'));
    await screen.findByText('Resources');

    card.nextScope();
    rerender(atPreset('7d'));

    await waitFor(() => {
      const totals = queryClient
        .getQueryCache()
        .findAll({ queryKey: ['trace-aggregate'] })
        .filter(query => !(query.queryKey[1] as { interval?: string }).interval);
      expect(totals.some(query => query.state.status === 'error')).toBe(true);
    });
    expect(screen.queryByText(ERROR)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();

    card.release();
    expect(await screen.findByText(ERROR, undefined, { timeout: 5000 })).toBeDefined();
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
