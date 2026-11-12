import type { MastraDBMessage } from '@mastra/core/agent-controller';
import { describe, expect, it } from 'vitest';

import type { TimelineEntry } from '../../services/transcript';
import { runningBackgroundTasks } from './background-work';

const CREATED_AT = new Date('2026-11-12T10:00:00.000Z');

function entry(message: MastraDBMessage): TimelineEntry {
  return { kind: 'message', id: message.id, message };
}

/** A call handed to a background task whose part still says it runs. */
function deferred(taskId: string): TimelineEntry {
  return entry({
    id: `call-${taskId}`,
    role: 'assistant',
    createdAt: CREATED_AT,
    content: {
      format: 2,
      parts: [
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: `call-${taskId}`,
            toolName: 'web_search',
            args: {},
            result: '',
          },
          providerMetadata: { mastra: { backgroundTask: { taskId, status: 'running' } } },
        },
      ],
    },
  });
}

function taskNotice(taskId: string, status: string): TimelineEntry {
  return entry({
    id: `notice-${taskId}`,
    role: 'signal',
    createdAt: CREATED_AT,
    content: {
      format: 2,
      parts: [{ type: 'text', text: `Background web_search call ${status}.` }],
      metadata: {
        signal: {
          id: `background-task:${taskId}:${status}`,
          type: 'notification',
          tagName: 'notification',
          createdAt: CREATED_AT.toISOString(),
          metadata: { backgroundCompletion: { taskId, status, originToolCallId: `call-${taskId}` } },
        },
      },
    },
  });
}

describe('runningBackgroundTasks', () => {
  // The part's status is written back only when the task's end finds the part; the notice always arrives.
  it('drops a task whose end notice arrived even though its part still says running', () => {
    const tasks = runningBackgroundTasks([deferred('a'), deferred('b'), taskNotice('a', 'completed')]);

    expect(tasks.map(task => task.taskId)).toEqual(['b']);
  });
});
