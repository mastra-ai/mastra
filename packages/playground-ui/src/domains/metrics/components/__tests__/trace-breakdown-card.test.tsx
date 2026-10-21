// @vitest-environment jsdom
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { HttpResponse } from 'msw';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { PropertyFilterToken } from '../../../../ds/components/PropertyFilter/types';
import { buildTracesDrilldownUrl } from '../../drilldown';
import type { DrilldownScope } from '../../drilldown';
import { MetricsProvider } from '../../hooks/use-metrics';
import { TraceBreakdownCard } from '../trace-breakdown-card';
import {
  emptyTraceAggregateFixture,
  environmentBreakdownFixture,
  traceAggregateCapabilities,
  traceAggregateErrorFixture,
} from './fixtures/trace-aggregate';
import { seedMetrics, serveCapabilities, serveTraceAggregate } from './metrics-msw';
import type { TraceAggregateRequest } from './metrics-msw';
import { renderWithProviders } from '@/test/render';

const ERROR = "Couldn't load this data. Try again in a moment.";

let requests: TraceAggregateRequest[] = [];
const onDrilldown = vi.fn<(scope: DrilldownScope) => void>();

function respond(request: TraceAggregateRequest, empty = false) {
  if (empty) return emptyTraceAggregateFixture;
  return environmentBreakdownFixture;
}

function serveCards({ empty = false } = {}) {
  serveTraceAggregate(request => {
    requests.push(request);
    return respond(request, empty);
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

const drilldownUrl = (scope: DrilldownScope) =>
  new URL(buildTracesDrilldownUrl({ preset: '24h', dashboardFilter: {}, scope }), 'http://studio');
/** Body rows' text, skipping the header row. */
const rowTexts = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(row => row.textContent);

beforeEach(() => {
  requests = [];
  onDrilldown.mockReset();
  seedMetrics();
  serveCapabilities(traceAggregateCapabilities);
});

describe('Trace breakdown card', () => {
  it('lists traces, error rate and cost per environment, with no tabs', async () => {
    serveCards();
    render(<TraceBreakdownCard onEnvironmentClick={onDrilldown} />);

    await screen.findByText('production');
    expect(rowTexts()).toEqual(['production4005.00%$12.50', 'staging6020.0%~$0.75', '(not set)50%—']);

    expect(screen.queryByRole('tab')).toBeNull();
  });

  it('asks once, grouped by environment', async () => {
    serveCards();
    render(<TraceBreakdownCard />);
    await screen.findByText('production');

    expect(requests).toHaveLength(1);
    expect(requests[0]).toMatchObject({
      groupBy: ['environment'],
      measures: ['count', 'errorRate', 'cost.sum'],
      orderBy: { field: 'count', direction: 'desc' },
    });
    expect(requests[0]?.interval).toBeUndefined();
  });

  it("opens a clicked environment's traces", async () => {
    serveCards();
    render(<TraceBreakdownCard onEnvironmentClick={onDrilldown} />);

    fireEvent.click(await screen.findByRole('button', { name: /staging/ }));
    const [[scope]] = onDrilldown.mock.calls;
    expect(drilldownUrl(scope).searchParams.get('filterEnvironment')).toBe('staging');
    // A row with no environment has nothing to filter on.
    expect(screen.queryByRole('button', { name: /not set/ })).toBeNull();
  });

  it('says when the range has no traces', async () => {
    serveCards({ empty: true });
    render(<TraceBreakdownCard />);

    expect(await screen.findByText('No traces in this range.')).toBeDefined();
  });

  it('loads after Retry when the aggregate failed', async () => {
    failThenServe(4);
    render(<TraceBreakdownCard />);

    await waitFor(() => expect(screen.getByText(ERROR)).toBeDefined(), { timeout: 5000 });
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('production', undefined, { timeout: 5000 })).toBeDefined();
  });
});

describe('Trace breakdown card with a service filter', () => {
  it('says the filter has no trace equivalent, and sends nothing', async () => {
    serveCards();
    render(<TraceBreakdownCard />, [{ fieldId: 'serviceName', value: 'checkout' }]);

    expect(await screen.findByText('Not available with a service filter.')).toBeDefined();
    expect(requests).toHaveLength(0);
  });
});
