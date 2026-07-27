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
  it('renders every task with status and origin identity', () => {
    const component = new BackgroundActivitySelectorComponent({
      tui: { requestRender: vi.fn() } as unknown as TUI,
      activities: [
        activity(),
        activity({ taskId: 'task-2', toolName: 'search_content', status: 'completed' }),
        activity({ taskId: 'task-3', toolName: 'mastra_expert', status: 'failed' }),
      ],
      onSelect: vi.fn(),
      onCancel: vi.fn(),
    });

    const output = stripAnsi(component.render(100).join('\n'));
    expect(output).toContain('Background activity');
    expect(output).toContain('◌ view  thread thread-1');
    expect(output).toContain('✓ search_content  thread thread-1');
    expect(output).toContain('✗ mastra_expert  thread thread-1');
    expect(output).toContain('running · task task-1 · thread thread-123456789');
    expect(output).toContain('↑↓ navigate · Enter open thread · Esc close');
  });
});
