import { describe, expect, it, vi } from 'vitest';

import { createBackgroundCompletionEvents } from './background-completion-events.js';

const event = {
  id: 'background-task:task-1:completed',
  taskId: 'task-1',
  originRunId: 'run-1',
  originToolCallId: 'call-1',
  resourceId: 'resource-1',
  threadId: 'thread-1',
  toolName: 'view',
  status: 'completed' as const,
};

describe('createBackgroundCompletionEvents', () => {
  it('notifies remaining listeners when one listener throws', () => {
    const events = createBackgroundCompletionEvents();
    const listener = vi.fn();
    events.subscribe(() => {
      throw new Error('listener failed');
    });
    events.subscribe(listener);

    expect(() => events.publish(event)).not.toThrow();
    expect(listener).toHaveBeenCalledWith(event);
  });
});
