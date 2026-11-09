// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useMetricsTraceAggregate } from '../../hooks/use-metrics-trace-aggregate';
import { ChartCardError } from '../chart-card-error';
import { emptyTraceAggregateFixture, traceAggregateErrorFixture } from './fixtures/trace-aggregate';
import { renderInMetrics, serveTraceAggregate } from './metrics-msw';

const timeRange = { from: '2026-10-19T12:00:00.000Z', to: '2026-10-20T12:00:00.000Z' };

/** A card body as the trace-aggregate cards render it. */
function ProbeCard() {
  const { isSuccess, error, refetch } = useMetricsTraceAggregate({ timeRange, measures: ['count'] });
  if (error) return <ChartCardError error={error} onRetry={() => void refetch()} />;
  return isSuccess ? <span>Loaded</span> : null;
}

/** Fails with `status` until `failures` requests have been answered, then succeeds. */
function failThenSucceed(status: number, failures = Infinity) {
  let calls = 0;
  serveTraceAggregate(() => {
    calls++;
    return calls <= failures ? HttpResponse.json(traceAggregateErrorFixture, { status }) : emptyTraceAggregateFixture;
  });
}

describe('ChartCardError', () => {
  describe('when a trace aggregate fails', () => {
    it('loads the card when Retry succeeds', async () => {
      // The client retries a 500 itself before the card sees it; the next request succeeds.
      failThenSucceed(500, 4);
      renderInMetrics(<ProbeCard />);

      expect(
        await screen.findByText("Couldn't load this data. Try again in a moment.", {}, { timeout: 5000 }),
      ).toBeDefined();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

      expect(await screen.findByText('Loaded')).toBeDefined();
    });
  });

  describe('when the session expired', () => {
    it('says so instead of offering a retry', async () => {
      failThenSucceed(401);
      renderInMetrics(<ProbeCard />);

      expect(await screen.findByText('Session Expired', {}, { timeout: 5000 })).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    });
  });

  describe('when the user may not read traces', () => {
    it('says permission was denied', async () => {
      failThenSucceed(403);
      renderInMetrics(<ProbeCard />);

      expect(await screen.findByText('Permission Denied', {}, { timeout: 5000 })).toBeDefined();
    });
  });
});
