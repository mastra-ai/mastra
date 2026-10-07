// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { emptyBreakdown, tokenUsageByAgentBreakdown } from '../../__tests__/fixtures/metrics-breakdown';
import { metricsError, metricsPending, metricsResolve, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { TokenUsageByAgentCard } from './token-usage-by-agent-card';
import { server } from '@/test/msw-server';

describe('TokenUsageByAgentCard', () => {
  describe('when the usage request is still pending', () => {
    it('shows the title next to a loading placeholder', () => {
      server.use(metricsPending('breakdown'));
      renderWithMetrics(<TokenUsageByAgentCard />);

      expect(screen.getByText('Token Usage by Agent')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading token usage' })).toBeTruthy();
    });
  });

  describe('when the usage request succeeds', () => {
    it('shows each agent and the total tokens', async () => {
      server.use(metricsResolve('breakdown', tokenUsageByAgentBreakdown));
      renderWithMetrics(<TokenUsageByAgentCard />);

      expect(await screen.findByText('support-agent')).toBeTruthy();
      expect(screen.getByText('triage-agent')).toBeTruthy();
      expect(screen.getByText('Total tokens')).toBeTruthy();
    });

    it('switches the summary to total cost on the cost tab', async () => {
      server.use(metricsResolve('breakdown', tokenUsageByAgentBreakdown));
      renderWithMetrics(<TokenUsageByAgentCard />);

      fireEvent.click(await screen.findByRole('tab', { name: 'Cost' }));

      expect(await screen.findByText('Total cost')).toBeTruthy();
    });
  });

  describe('when no agent has used tokens yet', () => {
    it('says there is no token usage', async () => {
      server.use(metricsSuccess('breakdown', emptyBreakdown));
      renderWithMetrics(<TokenUsageByAgentCard />);

      expect(await screen.findByText('No token usage data yet')).toBeTruthy();
    });
  });

  describe('when the usage request fails', () => {
    it('shows the error message', async () => {
      server.use(metricsError('breakdown'));
      renderWithMetrics(<TokenUsageByAgentCard />);

      expect(await screen.findByText('Failed to load token usage data')).toBeTruthy();
    });
  });

  describe('when no handlers are provided', () => {
    it('renders neither the traces button nor clickable bars', async () => {
      server.use(metricsResolve('breakdown', tokenUsageByAgentBreakdown));
      renderWithMetrics(<TokenUsageByAgentCard />);

      await screen.findByText('support-agent');
      expect(screen.queryByRole('button', { name: 'View in Traces' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'support-agent' })).toBeNull();
    });
  });

  describe('when handlers are provided', () => {
    it('opens agent traces from the top bar', async () => {
      server.use(metricsResolve('breakdown', tokenUsageByAgentBreakdown));
      const onOpenTraces = vi.fn();
      renderWithMetrics(<TokenUsageByAgentCard onOpenTraces={onOpenTraces} />);

      fireEvent.click(await screen.findByRole('button', { name: 'View in Traces' }));

      expect(onOpenTraces).toHaveBeenCalledWith({ rootEntityType: 'agent' });
    });

    it('opens traces for a clicked agent', async () => {
      server.use(metricsResolve('breakdown', tokenUsageByAgentBreakdown));
      const onRowClick = vi.fn();
      renderWithMetrics(<TokenUsageByAgentCard onRowClick={onRowClick} />);

      fireEvent.click(await screen.findByRole('button', { name: 'support-agent' }));

      expect(onRowClick).toHaveBeenCalledWith({ rootEntityType: 'agent', entityName: 'support-agent' });
    });
  });
});
