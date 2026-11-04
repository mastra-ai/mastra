// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { useMetricsLayout } from '../../hooks/use-metrics-layout';
import { aggregateCapabilities, olderServerCapabilities, traceAggregateCapabilities } from './fixtures/trace-aggregate';
import { CAPABILITIES_API, renderInMetrics, serveCapabilities } from './metrics-msw';
import { server } from '@/test/msw-server';

function LayoutProbe() {
  return <span>{`layout: ${useMetricsLayout()}`}</span>;
}

describe('Metrics page layout', () => {
  describe('when the server answers trace and span aggregates', () => {
    it('is unified', async () => {
      serveCapabilities(aggregateCapabilities);
      renderInMetrics(<LayoutProbe />);
      expect(await screen.findByText('layout: unified')).toBeTruthy();
    });

    it('is loading until the server says what it supports', () => {
      serveCapabilities(aggregateCapabilities);
      renderInMetrics(<LayoutProbe />);
      expect(screen.getByText('layout: loading')).toBeTruthy();
    });
  });

  describe('when the server can not answer both, it falls back to the page as it was', () => {
    it('on a server with trace aggregates only, so the page never mixes the two', async () => {
      serveCapabilities(traceAggregateCapabilities);
      renderInMetrics(<LayoutProbe />);
      expect(await screen.findByText('layout: legacy')).toBeTruthy();
    });

    it('on a store without aggregates', async () => {
      serveCapabilities(olderServerCapabilities);
      renderInMetrics(<LayoutProbe />);
      expect(await screen.findByText('layout: legacy')).toBeTruthy();
    });

    it('on a server without the capabilities route', async () => {
      serveCapabilities('missing');
      renderInMetrics(<LayoutProbe />);
      expect(await screen.findByText('layout: legacy')).toBeTruthy();
    });

    it('when the capabilities request fails', async () => {
      server.use(http.get(CAPABILITIES_API, () => HttpResponse.json({ error: 'boom' }, { status: 500 })));
      renderInMetrics(<LayoutProbe />);
      expect(await screen.findByText('layout: legacy', {}, { timeout: 5000 })).toBeTruthy();
    });
  });
});
