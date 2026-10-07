// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { emptyAggregate, modelCostAggregate } from '../../__tests__/fixtures/metrics-aggregate';
import { metricsError, metricsPending, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { ModelCostKpiCard } from './model-cost-kpi-card';
import { server } from '@/test/msw-server';

describe('ModelCostKpiCard', () => {
  describe('when the aggregate request is still pending', () => {
    it('shows the label next to a loading placeholder', () => {
      server.use(metricsPending('aggregate'));
      renderWithMetrics(<ModelCostKpiCard />);

      expect(screen.getByText('Model cost')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading Model cost' })).toBeTruthy();
    });
  });

  describe('when the aggregate request succeeds', () => {
    it('shows the value', async () => {
      server.use(metricsSuccess('aggregate', modelCostAggregate));
      renderWithMetrics(<ModelCostKpiCard />);

      expect(await screen.findByText(/^\$12\.5/)).toBeTruthy();
    });

    it('shows the change against the previous period', async () => {
      server.use(metricsSuccess('aggregate', modelCostAggregate));
      renderWithMetrics(<ModelCostKpiCard />);

      expect(await screen.findByText(/^\+25% vs previous 24h/)).toBeTruthy();
    });
  });

  describe('when there is no value yet', () => {
    it('says there is no data', async () => {
      server.use(metricsSuccess('aggregate', emptyAggregate));
      renderWithMetrics(<ModelCostKpiCard />);

      expect(await screen.findByText('No data yet')).toBeTruthy();
    });
  });

  describe('when the aggregate request fails', () => {
    it('shows the error message', async () => {
      server.use(metricsError('aggregate'));
      renderWithMetrics(<ModelCostKpiCard />);

      expect(await screen.findByText('Failed to load data')).toBeTruthy();
    });
  });
});
