// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { emptyAggregate, totalTokensAggregate } from '../../__tests__/fixtures/metrics-aggregate';
import { metricsError, metricsPending, metricsResolve, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { TotalTokensKpiCard } from './total-tokens-kpi-card';
import { server } from '@/test/msw-server';

describe('TotalTokensKpiCard', () => {
  describe('when the aggregate request is still pending', () => {
    it('shows the label next to a loading placeholder', () => {
      server.use(metricsPending('aggregate'));
      renderWithMetrics(<TotalTokensKpiCard />);

      expect(screen.getByText('Tokens')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading Tokens' })).toBeTruthy();
    });
  });

  describe('when the aggregate request succeeds', () => {
    it('shows the value', async () => {
      server.use(metricsResolve('aggregate', totalTokensAggregate));
      renderWithMetrics(<TotalTokensKpiCard />);

      expect(await screen.findByText('2,000')).toBeTruthy();
    });

    it('shows the change against the previous period', async () => {
      server.use(metricsResolve('aggregate', totalTokensAggregate));
      renderWithMetrics(<TotalTokensKpiCard />);

      expect(await screen.findByText('+100% vs previous 24h (1,000)')).toBeTruthy();
    });
  });

  describe('when there is no value yet', () => {
    it('says there is no data', async () => {
      server.use(metricsSuccess('aggregate', emptyAggregate));
      renderWithMetrics(<TotalTokensKpiCard />);

      expect(await screen.findByText('No data yet')).toBeTruthy();
    });
  });

  describe('when the aggregate request fails', () => {
    it('shows the error message', async () => {
      server.use(metricsError('aggregate'));
      renderWithMetrics(<TotalTokensKpiCard />);

      expect(await screen.findByText('Failed to load data')).toBeTruthy();
    });
  });
});
