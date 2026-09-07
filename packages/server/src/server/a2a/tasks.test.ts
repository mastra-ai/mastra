import type { Message, Task } from '@mastra/core/a2a';
import { MASTRA_RESOURCE_ID_KEY, MASTRA_THREAD_ID_KEY, RequestContext } from '@mastra/core/request-context';
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
  it('persists trusted memory identity and rejects conflicting follow-ups before mutation', async () => {
    const taskStore = new InMemoryTaskStore();
    const requestContext = new RequestContext();
    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'trusted-resource');
    requestContext.set(MASTRA_THREAD_ID_KEY, 'trusted-thread');
    const input = { agentId: 'agent', taskId: 'task', taskStore, requestContext };
    const task = await loadOrCreateTask({
      ...input,
      message: { ...createMessage('first', 'Hello'), contextId: 'caller-thread' },
      metadata: { resourceId: 'caller-resource', extra: true },
    });
    expect(task.contextId).toBe('trusted-thread');
    expect(task.metadata).toEqual({ resourceId: 'trusted-resource', extra: true });

    const followUp = await loadOrCreateTask({
      ...input,
      message: { ...createMessage('second', 'Continue'), contextId: 'changed-thread' },
      metadata: { resourceId: 'changed-resource' },
    });
    expect(followUp.contextId).toBe(task.contextId);
    expect(followUp.metadata).toEqual(task.metadata);

    requestContext.set(MASTRA_RESOURCE_ID_KEY, 'another-resource');
    await expect(loadOrCreateTask({ ...input, message: createMessage('third', 'No') })).rejects.toThrow(
      'Task memory identity conflicts',
    );
    expect(await taskStore.load({ agentId: 'agent', taskId: 'task' })).toEqual(followUp);
  });

  it.each([
    [{ resourceId: 'params' }, { resourceId: 'message' }, 'params'],
    [{ resourceId: 123 }, { resourceId: 'message' }, 'message'],
    [{ resourceId: '' }, { resourceId: false }, 'agent'],
  ])('resolves usable metadata resource IDs (%j, %j)', async (metadata, messageMetadata, expected) => {
    const taskStore = new InMemoryTaskStore();
    const task = await loadOrCreateTask({
      agentId: 'agent',
      taskId: 'task',
      taskStore,
      metadata,
      message: { ...createMessage('first', 'Hello'), metadata: messageMetadata },
    });
    expect(task.contextId).toEqual(expect.any(String));
    expect(task.metadata?.resourceId).toBe(expected);
    const followUp = await loadOrCreateTask({
      agentId: 'agent',
      taskId: 'task',
      taskStore,
      metadata: { resourceId: 'replacement' },
      message: createMessage('second', 'Continue'),
    });
    expect(followUp.contextId).toBe(task.contextId);
    expect(followUp.metadata?.resourceId).toBe(expected);
  });

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
