// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { distinctAggregate, emptyAggregate } from '../../__tests__/fixtures/metrics-aggregate';
import { metricsError, metricsPending, metricsResolve, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { ActiveThreadsKpiCard } from './active-threads-kpi-card';
import { server } from '@/test/msw-server';

describe('ActiveThreadsKpiCard', () => {
  describe('when the aggregate request is still pending', () => {
    it('shows the label next to a loading placeholder', () => {
      server.use(metricsPending('aggregate'));
      renderWithMetrics(<ActiveThreadsKpiCard />);

      expect(screen.getByText('Threads')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading Threads' })).toBeTruthy();
    });
  });

  describe('when the aggregate request succeeds', () => {
    it('shows the value', async () => {
      server.use(metricsResolve('aggregate', distinctAggregate));
      renderWithMetrics(<ActiveThreadsKpiCard />);

      expect(await screen.findByText('87')).toBeTruthy();
    });

    it('shows the change against the previous period', async () => {
      server.use(metricsResolve('aggregate', distinctAggregate));
      renderWithMetrics(<ActiveThreadsKpiCard />);

      expect(await screen.findByText('-13% vs previous 24h (100)')).toBeTruthy();
    });
  });

  describe('when there is no value yet', () => {
    it('says there is no data', async () => {
      server.use(metricsSuccess('aggregate', emptyAggregate));
      renderWithMetrics(<ActiveThreadsKpiCard />);

      expect(await screen.findByText('No data yet')).toBeTruthy();
    });
  });

  describe('when the aggregate request fails', () => {
    it('shows the error message', async () => {
      server.use(metricsError('aggregate'));
      renderWithMetrics(<ActiveThreadsKpiCard />);

      expect(await screen.findByText('Failed to load data')).toBeTruthy();
    });
  });
});
