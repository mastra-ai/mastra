import type {
  BackgroundProcessExitEvent,
  BackgroundTaskCompletionEvent,
} from '@mastra/code-sdk/agents/background-completion-events';
import { describe, expect, it } from 'vitest';

import {
  acceptBackgroundActivity,
  clearCompletedBackgroundActivitiesForTarget,
  compareBackgroundActivities,
  completeBackgroundActivity,
  finishBackgroundProcessActivity,
  getBackgroundActivitiesForTarget,
  processActivityKey,
  startBackgroundProcessActivity,
} from '../background-activity.js';
import type { BackgroundActivity } from '../background-activity.js';

function processExit(overrides: Partial<BackgroundProcessExitEvent> = {}): BackgroundProcessExitEvent {
  return {
    kind: 'process',
    id: 'background-process:42:call-shell',
    pid: '42',
    command: 'pnpm dev',
    exitCode: 0,
    killed: false,
    toolCallId: 'call-shell',
    resourceId: 'resource-1',
    threadId: 'thread-1',
    ...overrides,
  };
}

const shellContext = {
  toolName: 'execute_command',
  resourceId: 'resource-1',
  threadId: 'thread-1',
  createdAt: 10,
  args: { description: 'Starting the dev server', command: 'pnpm dev' },
};

function completion(overrides: Partial<BackgroundTaskCompletionEvent> = {}): BackgroundTaskCompletionEvent {
  return {
    kind: 'task',
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

  it('names a host-defined subagent by its definition once its completion reports the name', () => {
    const activities = new Map<string, BackgroundActivity>();
    acceptBackgroundActivity(activities, 'task-1', 'call-1', {
      toolName: 'subagent',
      resourceId: 'resource-1',
      threadId: 'thread-1',
      createdAt: 10,
      args: { agentType: 'reviewer', task: 'Review the diff' },
    });
    expect(activities.get('task-1')?.label).toBe('reviewer: Review the diff');

    completeBackgroundActivity(
      activities,
      completion({ toolName: 'subagent', title: 'Code reviewer', summary: 'Review the diff' }),
    );

    expect(activities.get('task-1')?.label).toBe('Code reviewer: Review the diff');
  });

  it('keeps the exit of a shell that ended before its call returned the PID', () => {
    const activities = new Map<string, BackgroundActivity>();
    finishBackgroundProcessActivity(activities, processExit({ exitCode: 2 }));

    startBackgroundProcessActivity(activities, '42', 'call-shell', shellContext);

    expect(activities.get(processActivityKey('42'))).toMatchObject({ status: 'failed', exitCode: 2 });
  });

  it('shows a killed shell as cancelled rather than by its exit code', () => {
    const activities = new Map<string, BackgroundActivity>();
    startBackgroundProcessActivity(activities, '42', 'call-shell', shellContext);

    finishBackgroundProcessActivity(activities, processExit({ exitCode: 137, killed: true }));

    expect(activities.get(processActivityKey('42'))).toMatchObject({
      status: 'cancelled',
      label: 'Starting the dev server',
    });
  });

  it('ignores the exit of a shell it never saw start when the exit names no thread', () => {
    const activities = new Map<string, BackgroundActivity>();

    finishBackgroundProcessActivity(activities, processExit({ resourceId: undefined, threadId: undefined }));

    expect(activities.size).toBe(0);
  });

  it('treats a reused PID from a new call as a new running shell', () => {
    const activities = new Map<string, BackgroundActivity>();
    startBackgroundProcessActivity(activities, '42', 'call-old', shellContext);
    finishBackgroundProcessActivity(activities, processExit({ toolCallId: 'call-old' }));

    startBackgroundProcessActivity(activities, '42', 'call-new', shellContext);

    expect(activities.get(processActivityKey('42'))).toMatchObject({ status: 'accepted', toolCallId: 'call-new' });
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
