import type { ScheduleResponse } from '@mastra/client-js';
import { describe, expect, it } from 'vitest';

import { SchedulesList } from '../components/schedules-list';
import { expectArrowNavigation, expectRovingTabindex, interactiveRows } from '@/test/keyboard';
import { TestLinkProvider } from '@/test/link-provider';
import { renderWithProviders } from '@/test/render';

const schedules = [
  { id: 'sched-a', workflowId: 'wf-1', cron: '0 * * * *', status: 'active' },
  { id: 'sched-b', workflowId: 'wf-2', cron: '0 0 * * *', status: 'paused' },
  { id: 'sched-c', agentId: 'agent-1', cron: '*/5 * * * *', status: 'active' },
] as unknown as ScheduleResponse[];

const renderList = () =>
  renderWithProviders(
    <TestLinkProvider>
      <SchedulesList schedules={schedules} isLoading={false} />
    </TestLinkProvider>,
  );

describe('SchedulesList keyboard navigation', () => {
  it('applies a roving tabindex to schedule rows', () => {
    renderList();

    const rows = interactiveRows();
    expect(rows).toHaveLength(3);
    expect(rows.every(row => row.tagName === 'A')).toBe(true);
    expectRovingTabindex(rows);
  });

  it('moves focus with ArrowDown/ArrowUp and jumps with Home/End', () => {
    renderList();

    expectArrowNavigation(interactiveRows());
  });

  it('keeps row links navigable (href preserved on the focus target)', () => {
    renderList();

    expect(interactiveRows().map(row => row.getAttribute('href'))).toEqual([
      '/schedules/sched-a',
      '/schedules/sched-b',
      '/schedules/sched-c',
    ]);
  });
});
