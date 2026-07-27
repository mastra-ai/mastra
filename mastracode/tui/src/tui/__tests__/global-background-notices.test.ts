import type { BackgroundCompletionEvent } from '@mastra/code-sdk/agents/background-completion-events';
import { describe, expect, it, vi } from 'vitest';

import {
  dismissGlobalBackgroundNoticesForTarget,
  navigateToBackgroundCompletion,
  upsertGlobalBackgroundNotice,
} from '../global-background-notices.js';

function event(overrides: Partial<BackgroundCompletionEvent> = {}): BackgroundCompletionEvent {
  return {
    id: 'background-task:task-1:completed',
    taskId: 'task-1',
    originRunId: 'run-1',
    originToolCallId: 'call-1',
    resourceId: 'resource-a',
    threadId: 'thread-a',
    toolName: 'view',
    status: 'completed',
    ...overrides,
  };
}

describe('global background notices', () => {
  it('shows only foreign-thread completions and deduplicates by stable event ID', () => {
    const notices = new Map<string, BackgroundCompletionEvent>();
    const completion = event();

    upsertGlobalBackgroundNotice(notices, completion, { resourceId: 'resource-a', threadId: 'thread-b' });
    upsertGlobalBackgroundNotice(
      notices,
      { ...completion, toolName: 'search_content' },
      {
        resourceId: 'resource-a',
        threadId: 'thread-b',
      },
    );

    expect([...notices.values()]).toEqual([{ ...completion, toolName: 'search_content' }]);

    upsertGlobalBackgroundNotice(notices, completion, { resourceId: 'resource-a', threadId: 'thread-a' });
    expect(notices.size).toBe(0);
  });

  it('treats a pre-thread new conversation as foreign from every persisted thread', () => {
    const notices = new Map<string, BackgroundCompletionEvent>();

    upsertGlobalBackgroundNotice(notices, event(), { resourceId: 'resource-a', threadId: null });

    expect([...notices.keys()]).toEqual(['background-task:task-1:completed']);
  });

  it('keeps every distinct foreign-thread completion while deduplicating repeated delivery', () => {
    const notices = new Map<string, BackgroundCompletionEvent>();
    const current = { resourceId: 'resource-a', threadId: 'thread-b' };

    for (let index = 1; index <= 4; index += 1) {
      const completion = event({
        id: `background-task:task-${index}:completed`,
        taskId: `task-${index}`,
        originToolCallId: `call-${index}`,
      });
      upsertGlobalBackgroundNotice(notices, completion, current);
      upsertGlobalBackgroundNotice(notices, completion, current);
    }

    expect([...notices.keys()]).toEqual([
      'background-task:task-1:completed',
      'background-task:task-2:completed',
      'background-task:task-3:completed',
      'background-task:task-4:completed',
    ]);
  });

  it('dismisses notices when their origin thread becomes active', () => {
    const notices = new Map([
      [event().id, event()],
      [
        'background-task:task-2:completed',
        event({ id: 'background-task:task-2:completed', taskId: 'task-2', threadId: 'thread-b' }),
      ],
    ]);

    dismissGlobalBackgroundNoticesForTarget(notices, { resourceId: 'resource-a', threadId: 'thread-a' });

    expect([...notices.keys()]).toEqual(['background-task:task-2:completed']);
  });

  it('switches resource before thread and preserves failures for the caller to handle', async () => {
    const calls: string[] = [];
    const setResourceId = vi.fn(async (resourceId: string) => {
      calls.push(`resource:${resourceId}`);
    });
    const switchThread = vi.fn(async (threadId: string) => {
      calls.push(`thread:${threadId}`);
    });

    await navigateToBackgroundCompletion(event(), 'resource-b', setResourceId, switchThread);

    expect(calls).toEqual(['resource:resource-a', 'thread:thread-a']);

    switchThread.mockRejectedValueOnce(new Error('locked'));
    await expect(navigateToBackgroundCompletion(event(), 'resource-a', setResourceId, switchThread)).rejects.toThrow(
      'locked',
    );
  });
});
