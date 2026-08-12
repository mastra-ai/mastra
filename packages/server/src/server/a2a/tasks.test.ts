import type { Message, Task } from '@mastra/core/a2a';
import { describe, expect, it, vi } from 'vitest';
import { InMemoryTaskStore } from './store';
import { loadOrCreateTask } from './tasks';

function createMessage(messageId: string, text: string): Message {
  return {
    kind: 'message',
    messageId,
    role: 'user',
    parts: [{ kind: 'text', text }],
  };
}

describe('loadOrCreateTask', () => {
  it('retries a conflicting update without dropping task history', async () => {
    const taskStore = new InMemoryTaskStore();
    const agentId = 'agent-1';
    const taskId = 'task-1';
    const initialMessage = createMessage('message-1', 'First');
    const competingMessage = createMessage('message-2', 'Second');
    const incomingMessage = createMessage('message-3', 'Third');
    const initialTask: Task = {
      id: taskId,
      contextId: 'context-1',
      status: { state: 'working' },
      artifacts: [],
      history: [initialMessage],
      kind: 'task',
    };

    await taskStore.save({ agentId, data: initialTask });

    const originalSave = taskStore.save.bind(taskStore);
    let injectConflict = true;
    vi.spyOn(taskStore, 'save').mockImplementation(async input => {
      if (injectConflict && input.expectedVersion === 1) {
        injectConflict = false;
        await originalSave({
          agentId,
          data: { ...initialTask, history: [initialMessage, competingMessage] },
          expectedVersion: 1,
        });
      }
      return originalSave(input);
    });

    const task = await loadOrCreateTask({
      agentId,
      taskId,
      taskStore,
      message: incomingMessage,
      contextId: 'context-1',
    });

    expect(task.history?.map(message => message.messageId)).toEqual(['message-1', 'message-2', 'message-3']);
    expect(taskStore.getVersion({ agentId, taskId })).toBe(3);
  });
});
