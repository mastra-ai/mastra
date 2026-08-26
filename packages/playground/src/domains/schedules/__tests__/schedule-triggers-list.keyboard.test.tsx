import type { ScheduleTriggerResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { ScheduleTriggersList } from '../components/schedule-triggers-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const makeTrigger = (runId: string | null, outcome: 'published' | 'failed' = 'published'): ScheduleTriggerResponse => ({
  scheduleId: 'sched-1',
  runId,
  scheduledFireAt: 1756100000000,
  actualFireAt: 1756100000500,
  outcome,
  run: runId ? { status: 'success' } : undefined,
});

const triggers = [
  makeTrigger('run-1'),
  makeTrigger('run-2', 'failed'), // failed → static row
  makeTrigger('run-3'),
  makeTrigger('run-4'),
];

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <ScheduleTriggersList triggers={triggers} isLoading={false} workflowId="wf-1" />
    </TestLinkProvider>,
  );

describe('ScheduleTriggersList keyboard navigation', () => {
  describe('when the list mixes linked and static rows', () => {
    it('registers only the linked rows with the roving tabindex', () => {
      renderList();

      const rows = interactiveRows();
      // 4 triggers, 1 failed → 3 linked rows
      expect(rows).toHaveLength(3);
      expectRovingTabindex(rows);
      expect(rows.map(row => row.getAttribute('data-row-index'))).toEqual(['0', '1', '2']);
    });
  });

  describe('when navigating with the keyboard', () => {
    it('moves focus across linked rows only', () => {
      renderList();
      expectArrowNavigation(interactiveRows());
    });
  });

  describe('linked rows', () => {
    it('point at the workflow run route', () => {
      renderList();
      const rows = interactiveRows();
      expect((rows[0] as HTMLAnchorElement).getAttribute('href')).toBe('/workflows/wf-1/runs/run-1');
    });
  });
});
