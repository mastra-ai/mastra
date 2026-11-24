import type { TUI } from '@earendil-works/pi-tui';
import stripAnsi from 'strip-ansi';
import { describe, expect, it, vi } from 'vitest';

import type { BackgroundActivity } from '../../background-activity.js';
import { BackgroundActivitySelectorComponent } from '../background-activity-selector.js';

function activity(overrides: Partial<BackgroundActivity> = {}): BackgroundActivity {
  return {
    id: 'background-task:task-1',
    taskId: 'task-1',
    toolCallId: 'call-1',
    toolName: 'view',
    resourceId: 'resource-1',
    threadId: 'thread-123456789',
    status: 'accepted',
    createdAt: 1,
    ...overrides,
  };
}

describe('BackgroundActivitySelectorComponent', () => {
  it('renders every current-thread task as inspectable activity', () => {
    const activities = [
      activity(),
      activity({ taskId: 'task-2', toolName: 'search_content', status: 'completed' }),
      activity({ taskId: 'task-3', toolName: 'mastra_expert', status: 'failed' }),
      activity({ taskId: 'task-4', toolName: 'find_files', status: 'cancelled' }),
    ];
    const component = new BackgroundActivitySelectorComponent({
      tui: { requestRender: vi.fn() } as unknown as TUI,
      activities,
      getActivity: taskId => activities.find(activity => activity.taskId === taskId),
      onCancel: vi.fn(),
      onAbort: vi.fn(),
    });

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('Background activity');
    expect(output).toContain('◌ view');
    expect(output).toContain('✓ search_content');
    expect(output).toContain('✗ mastra_expert');
    expect(output).toContain('■ find_files');
    expect(output).toContain('running · task task-1');
    expect(output).not.toContain('thread-123456789');
    expect(output).toContain('↑↓ inspect · D abort running · Esc close');
    expect(output).not.toContain('open thread');
  });

  it('aborts only the selected running task', () => {
    const onAbort = vi.fn();
    const currentActivity = activity();
    const component = new BackgroundActivitySelectorComponent({
      tui: { requestRender: vi.fn() } as unknown as TUI,
      activities: [currentActivity],
      getActivity: () => currentActivity,
      onCancel: vi.fn(),
      onAbort,
    });
    component.focused = true;

    component.handleInput('d');

    expect(onAbort).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'task-1', status: 'accepted' }));
  });

  it('does not abort a task that completed after the selector opened', () => {
    const onAbort = vi.fn();
    const initialActivity = activity();
    const currentActivity = activity({ status: 'completed' });
    const component = new BackgroundActivitySelectorComponent({
      tui: { requestRender: vi.fn() } as unknown as TUI,
      activities: [initialActivity],
      getActivity: () => currentActivity,
      onCancel: vi.fn(),
      onAbort,
    });
    component.focused = true;

    component.handleInput('d');

    expect(onAbort).not.toHaveBeenCalled();
  });

  it('renders current activity details when selection changes after completion', () => {
    const activities = [activity(), activity({ taskId: 'task-2', toolName: 'search_content' })];
    const currentActivity = activity({ taskId: 'task-2', toolName: 'search_content', status: 'completed' });
    const component = new BackgroundActivitySelectorComponent({
      tui: { requestRender: vi.fn() } as unknown as TUI,
      activities,
      getActivity: taskId => (taskId === 'task-2' ? currentActivity : activities[0]),
      onCancel: vi.fn(),
      onAbort: vi.fn(),
    });
    component.focused = true;

    component.handleInput('\x1b[B');

    expect(stripAnsi(component.render(100).join('\n'))).toContain('completed · task task-2');
  });
});
