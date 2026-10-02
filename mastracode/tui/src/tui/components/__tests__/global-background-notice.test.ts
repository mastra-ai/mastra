import { describe, expect, it } from 'vitest';

import type { BackgroundActivity } from '../../background-activity.js';
import { GlobalBackgroundNoticeComponent } from '../global-background-notice.js';

function activity(overrides: Partial<BackgroundActivity> = {}): BackgroundActivity {
  return {
    taskId: 'task-1',
    id: 'background-task:task-1',
    toolCallId: 'call-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    toolName: 'view',
    status: 'accepted',
    createdAt: 1,
    ...overrides,
  };
}

describe('GlobalBackgroundNoticeComponent', () => {
  it('renders aggregate running and completed activity with the activity-center shortcut', () => {
    const component = new GlobalBackgroundNoticeComponent();
    component.setActivities([
      activity(),
      activity({ taskId: 'task-2', status: 'completed', completedAt: 2 }),
      activity({ taskId: 'task-3', status: 'failed', completedAt: 3 }),
      activity({ taskId: 'task-4', status: 'cancelled', completedAt: 4 }),
    ]);

    const output = component.render(120).join('\n');
    expect(output).toContain('Background');
    expect(output).toContain('◌ 1 running');
    expect(output).toContain('✓ 1 completed');
    expect(output).toContain('✗ 1 failed');
    expect(output).toContain('■ 1 cancelled');
    expect(output).toContain('Ctrl+G open');
    expect(output).toContain('Alt+G clear finished');
  });

  it('renders nothing when there is no activity', () => {
    const component = new GlobalBackgroundNoticeComponent();
    component.setActivities([activity()]);
    component.setActivities([]);

    expect(component.render(120)).toEqual([]);
  });
});
