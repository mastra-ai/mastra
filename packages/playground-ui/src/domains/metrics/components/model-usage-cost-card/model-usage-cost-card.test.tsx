// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { emptyBreakdown, modelUsageBreakdown } from '../../__tests__/fixtures/metrics-breakdown';
import { metricsError, metricsPending, metricsResolve, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { ModelUsageCostCard } from './model-usage-cost-card';
import { server } from '@/test/msw-server';

describe('ModelUsageCostCard', () => {
  describe('when the usage request is still pending', () => {
    it('shows the title next to a loading placeholder', () => {
      server.use(metricsPending('breakdown'));
      renderWithMetrics(<ModelUsageCostCard />);

      expect(screen.getByText('Model Usage & Cost')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading model usage' })).toBeTruthy();
    });
  });

  describe('when the usage request succeeds', () => {
    it('lists each model with its total cost', async () => {
      server.use(metricsResolve('breakdown', modelUsageBreakdown));
      renderWithMetrics(<ModelUsageCostCard />);

      expect(await screen.findByText('gpt-4o')).toBeTruthy();
      expect(screen.getByText('claude-sonnet-4-5')).toBeTruthy();
      expect(screen.getByText('Total cost')).toBeTruthy();
    });

    it('shows the provider under each model so same-named models stay distinguishable', async () => {
      server.use(metricsResolve('breakdown', modelUsageBreakdown));
      renderWithMetrics(<ModelUsageCostCard />);

      expect(await screen.findByText('openai')).toBeTruthy();
      expect(screen.getByText('anthropic')).toBeTruthy();
    });
  });

  describe('when no model has been used yet', () => {
    it('says there is no usage data', async () => {
      server.use(metricsSuccess('breakdown', emptyBreakdown));
      renderWithMetrics(<ModelUsageCostCard />);

      expect(await screen.findByText('No model usage data yet')).toBeTruthy();
    });
  });

  describe('when the usage request fails', () => {
    it('shows the error message', async () => {
      server.use(metricsError('breakdown'));
      renderWithMetrics(<ModelUsageCostCard />);

      expect(await screen.findByText('Failed to load model usage data')).toBeTruthy();
    });
  });

  describe('when no handlers are provided', () => {
    it('renders neither the traces button nor clickable rows', async () => {
      server.use(metricsResolve('breakdown', modelUsageBreakdown));
      renderWithMetrics(<ModelUsageCostCard />);

      await screen.findByText('gpt-4o');
      expect(screen.queryByRole('button')).toBeNull();
    });
  });

  describe('when handlers are provided', () => {
    it('opens agent traces from the top bar', async () => {
      server.use(metricsResolve('breakdown', modelUsageBreakdown));
      const onOpenTraces = vi.fn();
      renderWithMetrics(<ModelUsageCostCard onOpenTraces={onOpenTraces} />);

      fireEvent.click(await screen.findByRole('button', { name: 'View in Traces' }));

      expect(onOpenTraces).toHaveBeenCalledWith({ rootEntityType: 'agent' });
    });

    it('opens traces for a clicked model', async () => {
      server.use(metricsResolve('breakdown', modelUsageBreakdown));
      const onRowClick = vi.fn();
      renderWithMetrics(<ModelUsageCostCard onRowClick={onRowClick} />);

      fireEvent.click(await screen.findByRole('button', { name: /gpt-4o/ }));

      expect(onRowClick).toHaveBeenCalledWith({ rootEntityType: 'agent', model: 'gpt-4o', provider: 'openai' });
    });
  });
});
