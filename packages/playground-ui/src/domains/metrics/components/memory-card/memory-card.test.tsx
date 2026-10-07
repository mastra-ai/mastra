// @vitest-environment jsdom
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { emptyBreakdown, memoryBreakdown } from '../../__tests__/fixtures/metrics-breakdown';
import { metricsError, metricsPending, metricsResolve, metricsSuccess } from '../../__tests__/msw-handlers';
import { renderWithMetrics } from '../../__tests__/render-with-metrics';
import { MemoryCard } from './memory-card';
import { server } from '@/test/msw-server';

describe('MemoryCard', () => {
  describe('when the memory requests are still pending', () => {
    it('shows the title next to a loading placeholder', () => {
      server.use(metricsPending('breakdown'));
      renderWithMetrics(<MemoryCard />);

      expect(screen.getByText('Memory')).toBeTruthy();
      expect(screen.getByRole('status', { name: 'Loading threads' })).toBeTruthy();
    });
  });

  describe('when the memory requests succeed', () => {
    it('lists the most active threads with their total runs', async () => {
      server.use(metricsResolve('breakdown', memoryBreakdown));
      renderWithMetrics(<MemoryCard />);

      expect(await screen.findByText('thread…0001')).toBeTruthy();
      expect(screen.getByText('thread-2')).toBeTruthy();
      expect(screen.getByText('15')).toBeTruthy();
    });

    it('lists the resources once the resources tab is opened', async () => {
      server.use(metricsResolve('breakdown', memoryBreakdown));
      renderWithMetrics(<MemoryCard />);

      fireEvent.click(await screen.findByRole('tab', { name: 'Resources' }));

      expect(await screen.findByText('user-1')).toBeTruthy();
      expect(screen.getByText('Total threads')).toBeTruthy();
    });
  });

  describe('when nothing has run yet', () => {
    it('says there is no thread activity', async () => {
      server.use(metricsSuccess('breakdown', emptyBreakdown));
      renderWithMetrics(<MemoryCard />);

      expect(await screen.findByText('No thread activity yet')).toBeTruthy();
    });
  });

  describe('when the memory requests fail', () => {
    it('shows the error message', async () => {
      server.use(metricsError('breakdown'));
      renderWithMetrics(<MemoryCard />);

      expect(await screen.findByText('Failed to load memory data')).toBeTruthy();
    });
  });

  describe('when no click handlers are given', () => {
    it('does not make the rows clickable', async () => {
      server.use(metricsResolve('breakdown', memoryBreakdown));
      renderWithMetrics(<MemoryCard />);

      await screen.findByText('thread-2');

      expect(screen.queryByRole('button', { name: /thread-2/ })).toBeNull();
    });
  });

  describe('when an onThreadClick handler is given', () => {
    it('scopes the drilldown to the clicked thread and its resource', async () => {
      server.use(metricsResolve('breakdown', memoryBreakdown));
      const onThreadClick = vi.fn();
      renderWithMetrics(<MemoryCard onThreadClick={onThreadClick} />);

      fireEvent.click(await screen.findByRole('button', { name: /thread…0001/ }));

      expect(onThreadClick).toHaveBeenCalledWith({ threadId: 'thread-aaaaaaaaaaaa-0001', resourceId: 'user-1' });
    });

    it('leaves the resource out when the thread has none', async () => {
      server.use(metricsResolve('breakdown', memoryBreakdown));
      const onThreadClick = vi.fn();
      renderWithMetrics(<MemoryCard onThreadClick={onThreadClick} />);

      fireEvent.click(await screen.findByRole('button', { name: /thread-2/ }));

      expect(onThreadClick).toHaveBeenCalledWith({ threadId: 'thread-2' });
    });
  });

  describe('when an onResourceClick handler is given', () => {
    it('scopes the drilldown to the clicked resource', async () => {
      server.use(metricsResolve('breakdown', memoryBreakdown));
      const onResourceClick = vi.fn();
      renderWithMetrics(<MemoryCard onResourceClick={onResourceClick} />);

      fireEvent.click(await screen.findByRole('tab', { name: 'Resources' }));
      fireEvent.click(await screen.findByRole('button', { name: /user-1/ }));

      expect(onResourceClick).toHaveBeenCalledWith({ resourceId: 'user-1' });
    });
  });
});
