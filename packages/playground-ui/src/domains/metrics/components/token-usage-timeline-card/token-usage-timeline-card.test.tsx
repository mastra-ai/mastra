// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { emptyTimeSeries, tokenUsageTimeSeries } from '../../__tests__/fixtures/metrics-timeseries';
import { metricsError, metricsPending, metricsResolve, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { TokenUsageTimelineCard } from './token-usage-timeline-card';
import { server } from '@/test/msw-server';

describe('TokenUsageTimelineCard', () => {
  describe('when the timeline request is still pending', () => {
    it('shows the title next to a loading placeholder', () => {
      server.use(metricsPending('timeseries'));
      renderWithMetrics(<TokenUsageTimelineCard />);

      expect(screen.getByText('Token Usage over Time')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading token usage timeline' })).toBeTruthy();
    });
  });

  describe('when the timeline request succeeds', () => {
    it('charts input and output tokens per hour for a 24h window', async () => {
      server.use(metricsResolve('timeseries', tokenUsageTimeSeries));
      renderWithMetrics(<TokenUsageTimelineCard />);

      expect(await screen.findByText('Input tokens')).toBeTruthy();
      expect(screen.getByText('Output tokens')).toBeTruthy();
      expect(screen.getByText('Input and output tokens per hour.')).toBeTruthy();
    });

    it('describes daily buckets for a 30d window', async () => {
      server.use(metricsResolve('timeseries', tokenUsageTimeSeries));
      renderWithMetrics(<TokenUsageTimelineCard />, { preset: '30d' });

      expect(await screen.findByText('Input and output tokens per day.')).toBeTruthy();
    });
  });

  describe('when there is nothing to chart', () => {
    it('says there is no token usage and offers no action', async () => {
      server.use(metricsSuccess('timeseries', emptyTimeSeries));
      renderWithMetrics(<TokenUsageTimelineCard onOpenTraces={vi.fn()} />);

      expect(await screen.findByText('No token usage data yet')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'View in Traces' })).toBeNull();
    });
  });

  describe('when the timeline request fails', () => {
    it('shows the error message', async () => {
      server.use(metricsError('timeseries'));
      renderWithMetrics(<TokenUsageTimelineCard />);

      expect(await screen.findByText('Failed to load token usage timeline')).toBeTruthy();
    });
  });

  describe('when no handler is provided', () => {
    it('renders no traces button', async () => {
      server.use(metricsResolve('timeseries', tokenUsageTimeSeries));
      renderWithMetrics(<TokenUsageTimelineCard />);

      await screen.findByText('Input tokens');
      expect(screen.queryByRole('button', { name: 'View in Traces' })).toBeNull();
    });
  });

  describe('when a handler is provided', () => {
    it('opens unscoped traces', async () => {
      server.use(metricsResolve('timeseries', tokenUsageTimeSeries));
      const onOpenTraces = vi.fn();
      renderWithMetrics(<TokenUsageTimelineCard onOpenTraces={onOpenTraces} />);

      fireEvent.click(await screen.findByRole('button', { name: 'View in Traces' }));

      expect(onOpenTraces).toHaveBeenCalledWith({});
    });
  });
});
