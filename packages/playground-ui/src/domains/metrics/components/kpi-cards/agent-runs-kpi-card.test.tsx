// @vitest-environment jsdom
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { agentRunsAggregate, emptyAggregate } from '../../__tests__/fixtures/metrics-aggregate';
import { metricsError, metricsPending, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { AgentRunsKpiCard } from './agent-runs-kpi-card';
import { server } from '@/test/msw-server';

describe('AgentRunsKpiCard', () => {
  describe('when the aggregate request is still pending', () => {
    it('shows the label next to a loading placeholder', () => {
      server.use(metricsPending('aggregate'));
      renderWithMetrics(<AgentRunsKpiCard />);

      expect(screen.getByText('Agent runs')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading Agent runs' })).toBeTruthy();
    });
  });

  describe('when the aggregate request succeeds', () => {
    it('shows the value', async () => {
      server.use(metricsSuccess('aggregate', agentRunsAggregate));
      renderWithMetrics(<AgentRunsKpiCard />);

      expect(await screen.findByText('1,500')).toBeTruthy();
    });

    it('shows the change against the previous period', async () => {
      server.use(metricsSuccess('aggregate', agentRunsAggregate));
      renderWithMetrics(<AgentRunsKpiCard />);

      expect(await screen.findByText('+50% vs previous 24h (1,000)')).toBeTruthy();
    });
  });

  describe('when there is no value yet', () => {
    it('says there is no data', async () => {
      server.use(metricsSuccess('aggregate', emptyAggregate));
      renderWithMetrics(<AgentRunsKpiCard />);

      expect(await screen.findByText('No data yet')).toBeTruthy();
    });
  });

  describe('when the aggregate request fails', () => {
    it('shows the error message', async () => {
      server.use(metricsError('aggregate'));
      renderWithMetrics(<AgentRunsKpiCard />);

      expect(await screen.findByText('Failed to load data')).toBeTruthy();
    });
  });
});
