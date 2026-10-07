// @vitest-environment jsdom
import { EntityType } from '@mastra/core/observability';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { emptyBreakdown, traceVolumeBreakdown } from '../../__tests__/fixtures/metrics-breakdown';
import { metricsError, metricsPending, metricsResolve, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { TracesVolumeCard } from './traces-volume-card';
import { server } from '@/test/msw-server';

describe('TracesVolumeCard', () => {
  describe('when the volume request is still pending', () => {
    it('shows the title next to a loading placeholder', () => {
      server.use(metricsPending('breakdown'));
      renderWithMetrics(<TracesVolumeCard />);

      expect(screen.getByText('Trace Volume')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading trace volume' })).toBeTruthy();
    });
  });

  describe('when the volume request succeeds', () => {
    it('shows the total runs and one bar per agent', async () => {
      server.use(metricsResolve('breakdown', traceVolumeBreakdown));
      renderWithMetrics(<TracesVolumeCard />);

      expect(await screen.findByText('support-agent')).toBeTruthy();
      expect(screen.getByText('52')).toBeTruthy();
      expect(screen.getByRole('tab', { name: 'Tools' }).hasAttribute('disabled')).toBe(false);
    });
  });

  describe('when there is no volume', () => {
    it('says so and offers no action', async () => {
      server.use(metricsSuccess('breakdown', emptyBreakdown));
      renderWithMetrics(<TracesVolumeCard onOpenTraces={vi.fn()} onOpenErrorsInLogs={vi.fn()} />);

      expect(await screen.findByText('No trace volume data yet')).toBeTruthy();
      expect(screen.queryByRole('button', { name: 'View in Traces' })).toBeNull();
    });
  });

  describe('when the volume request fails', () => {
    it('shows the error message', async () => {
      server.use(metricsError('breakdown'));
      renderWithMetrics(<TracesVolumeCard />);

      expect(await screen.findByText('Failed to load trace volume data')).toBeTruthy();
    });
  });

  describe('when no handlers are provided', () => {
    it('renders no action buttons and no clickable bars', async () => {
      server.use(metricsResolve('breakdown', traceVolumeBreakdown));
      renderWithMetrics(<TracesVolumeCard />);

      await screen.findByText('support-agent');
      expect(screen.queryByRole('button', { name: 'View in Traces' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'View errors in Logs' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'support-agent' })).toBeNull();
    });
  });

  describe('when handlers are provided', () => {
    it('scopes the action buttons to the active tab', async () => {
      server.use(metricsResolve('breakdown', traceVolumeBreakdown));
      const onOpenTraces = vi.fn();
      const onOpenErrorsInLogs = vi.fn();
      renderWithMetrics(<TracesVolumeCard onOpenTraces={onOpenTraces} onOpenErrorsInLogs={onOpenErrorsInLogs} />);

      fireEvent.click(await screen.findByRole('button', { name: 'View in Traces' }));
      fireEvent.click(screen.getByRole('button', { name: 'View errors in Logs' }));

      expect(onOpenTraces).toHaveBeenCalledWith({ rootEntityType: EntityType.AGENT });
      expect(onOpenErrorsInLogs).toHaveBeenCalledWith({ rootEntityType: EntityType.AGENT, status: 'error' });
    });

    it('opens the clicked row', async () => {
      server.use(metricsResolve('breakdown', traceVolumeBreakdown));
      const onRowClick = vi.fn();
      renderWithMetrics(<TracesVolumeCard onRowClick={onRowClick} />);

      fireEvent.click(await screen.findByRole('button', { name: 'support-agent' }));

      expect(onRowClick).toHaveBeenCalledWith({ rootEntityType: EntityType.AGENT, entityName: 'support-agent' });
    });

    it('opens errors when the error segment is clicked', async () => {
      server.use(metricsResolve('breakdown', traceVolumeBreakdown));
      const onRowClick = vi.fn();
      const onErrorSegmentClick = vi.fn();
      renderWithMetrics(<TracesVolumeCard onRowClick={onRowClick} onErrorSegmentClick={onErrorSegmentClick} />);

      fireEvent.click(await screen.findByRole('button', { name: 'support-agent — Errors' }));
      fireEvent.click(screen.getByRole('button', { name: 'support-agent — Completed' }));

      expect(onErrorSegmentClick).toHaveBeenCalledWith({
        rootEntityType: EntityType.AGENT,
        entityName: 'support-agent',
        status: 'error',
      });
      expect(onRowClick).toHaveBeenCalledWith({ rootEntityType: EntityType.AGENT, entityName: 'support-agent' });
    });
  });
});
