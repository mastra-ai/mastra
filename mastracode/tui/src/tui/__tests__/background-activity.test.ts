import type { BackgroundCompletionEvent } from '@mastra/code-sdk/agents/background-completion-events';
import { describe, expect, it } from 'vitest';

import {
  acceptBackgroundActivity,
  clearCompletedBackgroundActivitiesForTarget,
  compareBackgroundActivities,
  completeBackgroundActivity,
  getBackgroundActivitiesForTarget,
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

  it('does not downgrade a terminal activity when accepted projection arrives later', () => {
    const activities = new Map<string, BackgroundActivity>();
    completeBackgroundActivity(activities, completion());

    acceptBackgroundActivity(activities, 'task-1', 'call-1', {
      toolName: 'view',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      createdAt: 20,
    });

    expect(activities.get('task-1')).toMatchObject({
      status: 'completed',
      completedAt: expect.any(Number),
    });
  });

  it('keeps cancellation terminal when late lifecycle projections arrive', () => {
    const activities = new Map<string, BackgroundActivity>();
    completeBackgroundActivity(activities, completion({ status: 'cancelled' }));

    acceptBackgroundActivity(activities, 'task-1', 'call-1', {
      toolName: 'view',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      createdAt: 20,
    });
    completeBackgroundActivity(activities, completion({ status: 'completed' }));

    expect(activities.get('task-1')).toMatchObject({ status: 'cancelled' });
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

  it('filters activities to the displayed thread', () => {
    const activities = new Map<string, BackgroundActivity>();
    completeBackgroundActivity(activities, completion({ taskId: 'task-1', threadId: 'thread-1' }));
    completeBackgroundActivity(activities, completion({ taskId: 'task-2', threadId: 'thread-2' }));

    expect(
      getBackgroundActivitiesForTarget(activities, 'resource-1', 'thread-1').map(activity => activity.taskId),
    ).toEqual(['task-1']);
    expect(getBackgroundActivitiesForTarget(activities, 'resource-1', null)).toEqual([]);
  });

  it('clears only finished work from the displayed thread', () => {
    const activities = new Map<string, BackgroundActivity>();
    completeBackgroundActivity(activities, completion({ taskId: 'task-1', threadId: 'thread-1' }));
    completeBackgroundActivity(activities, completion({ taskId: 'task-2', threadId: 'thread-2', status: 'failed' }));
    acceptBackgroundActivity(activities, 'task-3', 'call-3', {
      toolName: 'search_content',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      createdAt: 20,
    });

    clearCompletedBackgroundActivitiesForTarget(activities, 'resource-1', 'thread-1');

    expect([...activities.keys()]).toEqual(['task-2', 'task-3']);
  });
});
