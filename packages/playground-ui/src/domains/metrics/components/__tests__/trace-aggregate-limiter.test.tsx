// @vitest-environment jsdom
import type { AggregateTracesArgs } from '@mastra/client-js';
import { screen, waitFor } from '@testing-library/react';
import { delay } from 'msw';
import { describe, expect, it } from 'vitest';
import { useMetricsTraceAggregate } from '../../hooks/use-metrics-trace-aggregate';
import { MAX_TRACE_AGGREGATES_IN_FLIGHT } from '../../lib/request-limiter';
import { emptyTraceAggregateFixture } from './fixtures/trace-aggregate';
import { renderInMetrics, serveTraceAggregate } from './metrics-msw';

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
});
