// @vitest-environment jsdom
import type { AggregateSpansArgs, AggregateTracesArgs } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { StrictMode, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { AggregateLimiterProvider } from '../../hooks/aggregate-limiter-provider';
import { MetricsProvider } from '../../hooks/use-metrics';
import { useMetricsSpanAggregate } from '../../hooks/use-metrics-span-aggregate';
import { useMetricsTraceAggregate, useTraceAggregateGate } from '../../hooks/use-metrics-trace-aggregate';
import { AGGREGATE_PRIORITY, MAX_AGGREGATES_IN_FLIGHT } from '../../lib/request-limiter';
import type { AggregatePriority } from '../../lib/request-limiter';
import { emptyTraceAggregateFixture, traceAggregateCapabilities } from './fixtures/trace-aggregate';
import {
  renderInMetrics,
  serveCapabilities,
  serveSpanAggregate,
  serveTraceAggregate,
  TRACE_AGGREGATE_API,
} from './metrics-msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render';

const timeRange = { from: '2026-10-19T12:00:00.000Z', to: '2026-10-20T12:00:00.000Z' };

type Measure = AggregateTracesArgs['measures'][number];

function Probe({ measure, priority }: { measure: Measure; priority?: AggregatePriority }) {
  const { isSuccess } = useMetricsTraceAggregate({ timeRange, measures: [measure] }, { priority });
  return isSuccess ? <span>{`${measure} loaded`}</span> : null;
}

function SpanProbe({ measure }: { measure: AggregateSpansArgs['measures'][number] }) {
  const { isSuccess } = useMetricsSpanAggregate({ timeRange, measures: [measure] });
  return isSuccess ? <span>{`span ${measure} loaded`}</span> : null;
}

const MEASURES: Measure[] = ['count', 'errorCount', 'errorRate', 'duration.p50', 'duration.p95', 'tokens.total.sum'];

/** Holds every request until `release()`, recording each measure in the order it was sent. */
function holdTraceAggregates() {
  const sent: Request[] = [];
  const order: string[] = [];
  let release!: () => void;
  const released = new Promise<void>(resolve => (release = resolve));
  server.use(
    http.post(TRACE_AGGREGATE_API, async ({ request }) => {
      sent.push(request);
      const body: { measures: string[] } = await request.clone().json();
      order.push(body.measures.join(','));
      await released;
      return HttpResponse.json(emptyTraceAggregateFixture);
    }),
  );
  return { sent, order, release };
}

describe('aggregate request limiter', () => {
  describe('when more cards ask than the server budget allows', () => {
    it(`keeps trace and span aggregates together under ${MAX_AGGREGATES_IN_FLIGHT} in flight, and answers every card`, async () => {
      let inFlight = 0;
      let peak = 0;
      const track = async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await delay(30);
        inFlight--;
        return emptyTraceAggregateFixture;
      };
      serveTraceAggregate(track);
      serveSpanAggregate(track);

      renderInMetrics(
        <>
          {MEASURES.map(measure => (
            <Probe key={measure} measure={measure} />
          ))}
          <SpanProbe measure="count" />
          <SpanProbe measure="errorRate" />
        </>,
      );

      await waitFor(() => expect(screen.getAllByText(/ loaded$/)).toHaveLength(MEASURES.length + 2), {
        timeout: 2000,
      });
      expect(peak).toBe(MAX_AGGREGATES_IN_FLIGHT);
    });
  });

  describe('when a page renders several MetricsProviders inside one AggregateLimiterProvider', () => {
    it(`shares one cap of ${MAX_AGGREGATES_IN_FLIGHT} across all of them`, async () => {
      let inFlight = 0;
      let peak = 0;
      serveTraceAggregate(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await delay(30);
        inFlight--;
        return emptyTraceAggregateFixture;
      });
      const section = (measures: Measure[]) => (
        <MetricsProvider preset="24h" filterTokens={[]} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
          {measures.map(measure => (
            <Probe key={measure} measure={measure} />
          ))}
        </MetricsProvider>
      );

      renderWithProviders(
        <AggregateLimiterProvider>
          {section(MEASURES.slice(0, 3))}
          {section(MEASURES.slice(3))}
        </AggregateLimiterProvider>,
      );

      await waitFor(() => expect(screen.getAllByText(/ loaded$/)).toHaveLength(MEASURES.length), { timeout: 2000 });
      expect(peak).toBe(MAX_AGGREGATES_IN_FLIGHT);
    });
  });

  describe('when the cards unmount while their requests are open', () => {
    it('lets the sent requests finish and never sends the queued ones', async () => {
      const { sent, release } = holdTraceAggregates();

      const { unmount } = renderInMetrics(
        <>
          {MEASURES.map(measure => (
            <Probe key={measure} measure={measure} />
          ))}
        </>,
      );
      await waitFor(() => expect(sent).toHaveLength(MAX_AGGREGATES_IN_FLIGHT));
      unmount();
      release();

      await delay(50);
      expect(sent).toHaveLength(MAX_AGGREGATES_IN_FLIGHT);
      expect(sent.some(request => request.signal.aborted)).toBe(false);
    });
  });

  describe('when StrictMode mounts every card twice', () => {
    it('sends each request once', async () => {
      const { order, release } = holdTraceAggregates();

      renderInMetrics(
        <StrictMode>
          {MEASURES.map(measure => (
            <Probe key={measure} measure={measure} />
          ))}
        </StrictMode>,
      );
      release();

      await waitFor(() => expect(screen.getAllByText(/ loaded$/)).toHaveLength(MEASURES.length), { timeout: 2000 });
      expect(order.toSorted()).toEqual(MEASURES.toSorted());
    });
  });

  describe('when queued requests have different priorities', () => {
    it('sends the first-priority request before an earlier-queued last-priority one', async () => {
      const { order, release } = holdTraceAggregates();

      renderInMetrics(
        <>
          <Probe measure="count" />
          <Probe measure="errorCount" />
          <Probe measure="errorRate" />
          <Probe measure="duration.p50" priority={AGGREGATE_PRIORITY.last} />
          <Probe measure="duration.p95" priority={AGGREGATE_PRIORITY.first} />
        </>,
      );
      await waitFor(() => expect(order).toHaveLength(MAX_AGGREGATES_IN_FLIGHT));
      release();

      await waitFor(() => expect(order).toHaveLength(5));
      expect(order.slice(MAX_AGGREGATES_IN_FLIGHT)).toEqual(['duration.p95', 'duration.p50']);
    });
  });
});

function WindowProbe({ name, scope }: { name: string; scope: Pick<AggregateTracesArgs, 'timeRange'> }) {
  const { isSuccess } = useMetricsTraceAggregate({ timeRange: scope.timeRange, measures: ['count'] });
  return isSuccess ? <span>{`${name} loaded`}</span> : null;
}

function GatedProbe({ name }: { name: string }) {
  const gate = useTraceAggregateGate();
  return gate.status === 'ready' ? <WindowProbe name={name} scope={gate.scope} /> : null;
}

function MountLater({ children }: { children: ReactNode }) {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setShown(true), 40);
    return () => clearTimeout(timer);
  }, []);
  return shown ? children : null;
}

describe('the page window', () => {
  describe('when a card mounts after another sent the same request', () => {
    it('is the same for a card that mounts later, so its identical request is not sent again', async () => {
      serveCapabilities(traceAggregateCapabilities);
      const windows: string[] = [];
      serveTraceAggregate(request => {
        windows.push(`${request.timeRange.from}|${request.timeRange.to}`);
        return emptyTraceAggregateFixture;
      });

      renderInMetrics(
        <>
          <GatedProbe name="first" />
          <MountLater>
            <GatedProbe name="second" />
          </MountLater>
        </>,
      );

      await waitFor(() => expect(screen.getByText('second loaded')).toBeTruthy());
      expect(screen.getByText('first loaded')).toBeTruthy();
      expect(windows).toHaveLength(1);
    });
  });
});
