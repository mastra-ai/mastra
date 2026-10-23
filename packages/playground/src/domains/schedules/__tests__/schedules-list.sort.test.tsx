import type { ScheduleResponse } from '@mastra/client-js';
import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SchedulesList } from '../components/schedules-list';
import type { SchedulesListProps } from '../components/schedules-list';
import { interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const schedules = [
  { id: 'sched-c', workflowId: 'charlie', cron: '* * * * *', status: 'paused', nextFireAt: 3000, lastFireAt: 1000 },
  { id: 'sched-a', workflowId: 'alpha', cron: '* * * * *', status: 'active', nextFireAt: 1000 },
  { id: 'sched-b', agentId: 'bravo', cron: '* * * * *', status: 'active', nextFireAt: 2000, lastFireAt: 3000 },
] as unknown as ScheduleResponse[];

const renderList = (props?: Partial<SchedulesListProps>) =>
  renderWithProviders(
    <TestLinkProvider>
      <SchedulesList schedules={schedules} isLoading={false} {...props} />
    </TestLinkProvider>,
  );

const rowIds = () => interactiveRows().map(row => row.getAttribute('href')?.replace('/schedules/', ''));

describe('SchedulesList', () => {
  describe('when sorted from the Target column', () => {
    it('reports the requested direction to the parent', () => {
      const onSortChange = vi.fn();
      renderList({ onSortChange });

      fireEvent.click(screen.getByRole('button', { name: 'Target, not sorted, sort ascending' }));

      expect(onSortChange).toHaveBeenCalledWith('asc', 'target');
    });

    it('orders schedules by target A to Z', () => {
      renderList({ sort: { key: 'target', direction: 'asc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['sched-a', 'sched-b', 'sched-c']);
    });
  });

  describe('when sorted from the Status column', () => {
    it('groups active schedules before paused ones when ascending', () => {
      renderList({ sort: { key: 'status', direction: 'asc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['sched-a', 'sched-b', 'sched-c']);
    });
  });

  describe('when sorted from the Next fire column', () => {
    it('puts the soonest schedule first when ascending', () => {
      renderList({ sort: { key: 'nextFireAt', direction: 'asc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['sched-a', 'sched-b', 'sched-c']);
    });
  });

  describe('when sorted from the Last run column', () => {
    it('puts the most recent run first and never-run schedules last when descending', () => {
      renderList({ sort: { key: 'lastFireAt', direction: 'desc' }, onSortChange: () => {} });

      expect(rowIds()).toEqual(['sched-b', 'sched-c', 'sched-a']);
    });
  });
});
