// @vitest-environment jsdom
import type { AggregateTracesArgs } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import { delay, http } from 'msw';
import { describe, expect, it } from 'vitest';
import { TraceAggregateLimiterProvider } from '../../hooks/trace-aggregate-limiter-provider';
import { MetricsProvider } from '../../hooks/use-metrics';
import { useMetricsTraceAggregate } from '../../hooks/use-metrics-trace-aggregate';
import { MAX_TRACE_AGGREGATES_IN_FLIGHT } from '../../lib/request-limiter';
import { emptyTraceAggregateFixture } from './fixtures/trace-aggregate';
import { renderInMetrics, serveTraceAggregate, TRACE_AGGREGATE_API } from './metrics-msw';
import { server } from '@/test/msw-server';
import { renderWithProviders } from '@/test/render';

const timeRange = { from: '2026-10-19T12:00:00.000Z', to: '2026-10-20T12:00:00.000Z' };

function Probe({ measure }: { measure: AggregateTracesArgs['measures'][number] }) {
  const { isSuccess } = useMetricsTraceAggregate({ timeRange, measures: [measure] });
  return isSuccess ? <span>{`${measure} loaded`}</span> : null;
}

const MEASURES: AggregateTracesArgs['measures'] = [
  'count',
  'errorCount',
  'errorRate',
  'duration.p50',
  'duration.p95',
  'cost.sum',
  'tokens.total.sum',
];

describe('trace aggregate request limiter', () => {
  describe('when more cards ask than the server budget allows', () => {
    it(`never has more than ${MAX_TRACE_AGGREGATES_IN_FLIGHT} requests in flight, and still answers every card`, async () => {
      let inFlight = 0;
      let peak = 0;
      serveTraceAggregate(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await delay(30);
        inFlight--;
        return emptyTraceAggregateFixture;
      });

      renderInMetrics(
        <>
          {MEASURES.map(measure => (
            <Probe key={measure} measure={measure} />
          ))}
        </>,
      );

      await waitFor(() => expect(screen.getAllByText(/ loaded$/)).toHaveLength(MEASURES.length), { timeout: 2000 });
      expect(peak).toBe(MAX_TRACE_AGGREGATES_IN_FLIGHT);
    });
  });

  describe('when a page renders several MetricsProviders inside one TraceAggregateLimiterProvider', () => {
    it(`shares one cap of ${MAX_TRACE_AGGREGATES_IN_FLIGHT} across all of them`, async () => {
      let inFlight = 0;
      let peak = 0;
      serveTraceAggregate(async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await delay(30);
        inFlight--;
        return emptyTraceAggregateFixture;
      });
      const section = (measures: AggregateTracesArgs['measures']) => (
        <MetricsProvider preset="24h" filterTokens={[]} onPresetChange={() => {}} onFilterTokensChange={() => {}}>
          {measures.map(measure => (
            <Probe key={measure} measure={measure} />
          ))}
        </MetricsProvider>
      );

      renderWithProviders(
        <TraceAggregateLimiterProvider>
          {section(MEASURES.slice(0, 3))}
          {section(MEASURES.slice(3))}
        </TraceAggregateLimiterProvider>,
      );

      await waitFor(() => expect(screen.getAllByText(/ loaded$/)).toHaveLength(MEASURES.length), { timeout: 2000 });
      expect(peak).toBe(MAX_TRACE_AGGREGATES_IN_FLIGHT);
    });
  });

  describe('when the cards unmount while their requests are open', () => {
    it('aborts the sent requests and never sends the queued ones', async () => {
      const sent: Request[] = [];
      server.use(
        http.post(TRACE_AGGREGATE_API, async ({ request }) => {
          sent.push(request);
          await delay('infinite');
        }),
      );

      const { unmount } = renderInMetrics(
        <>
          {MEASURES.map(measure => (
            <Probe key={measure} measure={measure} />
          ))}
        </>,
      );
      await waitFor(() => expect(sent).toHaveLength(MAX_TRACE_AGGREGATES_IN_FLIGHT));
      unmount();

      await waitFor(() => expect(sent.every(request => request.signal.aborted)).toBe(true));
      await delay(50);
      expect(sent).toHaveLength(MAX_TRACE_AGGREGATES_IN_FLIGHT);
    });
  });
});
