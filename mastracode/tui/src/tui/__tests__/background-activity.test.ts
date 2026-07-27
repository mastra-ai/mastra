import type { BackgroundCompletionEvent } from '@mastra/code-sdk/agents/background-completion-events';
import { describe, expect, it } from 'vitest';

import {
  acceptBackgroundActivity,
  clearCompletedBackgroundActivities,
  compareBackgroundActivities,
  completeBackgroundActivity,
} from '../background-activity.js';
import type { BackgroundActivity } from '../background-activity.js';

function completion(overrides: Partial<BackgroundCompletionEvent> = {}): BackgroundCompletionEvent {
  return {
    id: 'background-task:task-1:completed',
    taskId: 'task-1',
    originRunId: 'run-1',
    originToolCallId: 'call-1',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    toolName: 'view',
    status: 'completed',
    ...overrides,
  };
}

describe('background activity', () => {
  it('tracks accepted work and updates the same task when it completes', () => {
    const activities = new Map<string, BackgroundActivity>();
    acceptBackgroundActivity(activities, 'task-1', 'call-1', {
      toolName: 'view',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      createdAt: 10,
    });

    expect(activities.get('task-1')).toMatchObject({ status: 'accepted', createdAt: 10 });

    completeBackgroundActivity(activities, completion());

    expect(activities.get('task-1')).toMatchObject({
      taskId: 'task-1',
      toolCallId: 'call-1',
      status: 'completed',
      createdAt: 10,
    });
  });

  it('sorts active work before terminal work and newest tasks first within each state', () => {
    const activities: BackgroundActivity[] = [
      {
        id: 'background-task:completed',
        taskId: 'completed',
        toolCallId: 'call-completed',
        toolName: 'view',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        status: 'completed',
        createdAt: 30,
      },
      {
        id: 'background-task:accepted-old',
        taskId: 'accepted-old',
        toolCallId: 'call-accepted-old',
        toolName: 'search_content',
        resourceId: 'resource-1',
        threadId: 'thread-1',
        status: 'accepted',
        createdAt: 10,
      },
      {
        id: 'background-task:accepted-new',
        taskId: 'accepted-new',
        toolCallId: 'call-accepted-new',
        toolName: 'mastra_expert',
        resourceId: 'resource-1',
        threadId: 'thread-2',
        status: 'accepted',
        createdAt: 20,
      },
    ];

    expect(activities.sort(compareBackgroundActivities).map(activity => activity.taskId)).toEqual([
      'accepted-new',
      'accepted-old',
      'completed',
    ]);
  });

  it('creates terminal activity when the accepted event was missed and clears only finished work', () => {
    const activities = new Map<string, BackgroundActivity>();
    completeBackgroundActivity(activities, completion({ taskId: 'task-2', status: 'failed', errorSummary: 'failed' }));
    acceptBackgroundActivity(activities, 'task-3', 'call-3', {
      toolName: 'search_content',
      resourceId: 'resource-1',
      threadId: 'thread-2',
      createdAt: 20,
    });

    clearCompletedBackgroundActivities(activities);

    expect([...activities.keys()]).toEqual(['task-3']);
  });
});
