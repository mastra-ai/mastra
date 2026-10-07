// @vitest-environment jsdom
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { emptyPercentiles, latencyPercentiles } from '../../__tests__/fixtures/metrics-percentiles';
import { metricsError, metricsPending, metricsRecorder, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { LatencyCard } from './latency-card';
import { useFixedChartSize } from '@/test/chart-size';
import { server } from '@/test/msw-server';

describe('LatencyCard', () => {
  describe('when the latency request is still pending', () => {
    it('shows the title next to a loading placeholder', () => {
      server.use(metricsPending('percentiles'));
      renderWithMetrics(<LatencyCard />);

      expect(screen.getByText('Latency')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading latency' })).toBeTruthy();
    });
  });

  describe('when the latency request succeeds', () => {
    it('shows the entity tabs and the averaged percentiles', async () => {
      server.use(metricsSuccess('percentiles', latencyPercentiles));
      renderWithMetrics(<LatencyCard />);

      expect(await screen.findByRole('tab', { name: 'Agents' })).toBeTruthy();
      expect(screen.getByText('130')).toBeTruthy();
      expect(screen.getByText('550')).toBeTruthy();
    });
  });

  describe('when every entity type comes back empty', () => {
    it('says there is no latency data yet', async () => {
      server.use(metricsSuccess('percentiles', emptyPercentiles));
      renderWithMetrics(<LatencyCard />);

      expect(await screen.findByText('No latency data yet')).toBeTruthy();
    });
  });

  describe('when the latency request fails', () => {
    it('shows the error message', async () => {
      server.use(metricsError('percentiles'));
      renderWithMetrics(<LatencyCard />);

      expect(await screen.findByText('Failed to load latency data')).toBeTruthy();
    });
  });

  describe('when no onOpenTraces handler is given', () => {
    it('does not offer to open traces', async () => {
      server.use(metricsSuccess('percentiles', latencyPercentiles));
      renderWithMetrics(<LatencyCard />);

      await screen.findByRole('tab', { name: 'Agents' });

      expect(screen.queryByRole('button', { name: 'View in Traces' })).toBeNull();
    });
  });

  describe('when an onOpenTraces handler is given', () => {
    it('scopes the drilldown to the active tab entity type', async () => {
      server.use(metricsSuccess('percentiles', latencyPercentiles));
      const onOpenTraces = vi.fn();
      renderWithMetrics(<LatencyCard onOpenTraces={onOpenTraces} />);

      await screen.findByRole('tab', { name: 'Agents' });
      fireEvent.click(screen.getByRole('button', { name: 'View in Traces' }));

      expect(onOpenTraces).toHaveBeenCalledWith({ rootEntityType: 'agent' });
    });
  });

  describe('when an onBucketClick handler is given and a bucket is clicked', () => {
    useFixedChartSize();

    it('scopes the drilldown to that hourly bucket of the active tab', async () => {
      server.use(metricsSuccess('percentiles', latencyPercentiles));
      const onBucketClick = vi.fn();
      renderWithMetrics(<LatencyCard onBucketClick={onBucketClick} />, { preset: '24h' });

      await screen.findByRole('tab', { name: 'Agents' });
      const chart = await screen.findByRole('application');
      const plot = chart.parentElement ?? chart;
      fireEvent.mouseMove(plot, { clientX: 300, clientY: 100 });
      const bucket = await screen.findAllByRole('button', { name: /bucket/i });
      fireEvent.click(bucket[0]);

      expect(onBucketClick).toHaveBeenCalledWith({
        rootEntityType: 'agent',
        window: { from: new Date('2026-06-01T00:00:00.000Z'), to: new Date('2026-06-01T01:00:00.000Z') },
      });
    });
  });

  describe('when the dashboard filters change', () => {
    it('requests latency with the new filters', async () => {
      const { handler, requests } = metricsRecorder('percentiles', latencyPercentiles);
      server.use(handler);
      const { rerenderWithMetrics } = renderWithMetrics(<LatencyCard />, { preset: '24h' });
      await screen.findByRole('tab', { name: 'Agents' });
      const initialCount = requests.length;

      rerenderWithMetrics({
        preset: '24h',
        filterTokens: [{ fieldId: 'environment', value: 'production' }],
      });

      await waitFor(() => expect(requests.length).toBeGreaterThan(initialCount));
      expect(JSON.stringify(requests.at(-1))).toContain('production');
    });
  });
});
