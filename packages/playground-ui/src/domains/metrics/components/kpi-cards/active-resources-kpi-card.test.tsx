// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { distinctAggregate, emptyAggregate } from '../../__tests__/fixtures/metrics-aggregate';
import { metricsError, metricsPending, metricsResolve, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { ActiveResourcesKpiCard } from './active-resources-kpi-card';
import { server } from '@/test/msw-server';

describe('ActiveResourcesKpiCard', () => {
  describe('when the aggregate request is still pending', () => {
    it('shows the label next to a loading placeholder', () => {
      server.use(metricsPending('aggregate'));
      renderWithMetrics(<ActiveResourcesKpiCard />);

      expect(screen.getByText('Resources')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading Resources' })).toBeTruthy();
    });
  });

  describe('when the aggregate request succeeds', () => {
    it('shows the value', async () => {
      server.use(metricsResolve('aggregate', distinctAggregate));
      renderWithMetrics(<ActiveResourcesKpiCard />);

      expect(await screen.findByText('9')).toBeTruthy();
    });

    it('says there is nothing to compare against', async () => {
      server.use(metricsResolve('aggregate', distinctAggregate));
      renderWithMetrics(<ActiveResourcesKpiCard />);

      expect(await screen.findByText('No previous value to compare')).toBeTruthy();
    });
  });

  describe('when there is no value yet', () => {
    it('says there is no data', async () => {
      server.use(metricsSuccess('aggregate', emptyAggregate));
      renderWithMetrics(<ActiveResourcesKpiCard />);

      expect(await screen.findByText('No data yet')).toBeTruthy();
    });
  });

  describe('when the aggregate request fails', () => {
    it('shows the error message', async () => {
      server.use(metricsError('aggregate'));
      renderWithMetrics(<ActiveResourcesKpiCard />);

      expect(await screen.findByText('Failed to load data')).toBeTruthy();
    });
  });
});
