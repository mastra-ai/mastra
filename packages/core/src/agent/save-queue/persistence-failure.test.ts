import { afterEach, describe, expect, it, vi } from 'vitest';
import { MockMemory } from '../../memory/mock';
import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../types';
import { SaveQueueManager } from './index';

function message(id: string, text: string): MastraDBMessage {
  return {
    id,
    threadId: 'thread-1',
    resourceId: 'resource-1',
    role: 'assistant',
    createdAt: new Date(),
    content: { format: 2, parts: [{ type: 'text', text }] },
  };
}

describe('save failure recovery', () => {
  afterEach(() => vi.restoreAllMocks());

  it('rejects a failed flush and retries the same message IDs on the next flush', async () => {
    const memory = new MockMemory();
    const save = vi.spyOn(memory, 'saveMessages').mockRejectedValueOnce(new Error('storage unavailable'));
    const manager = new SaveQueueManager({ memory });
    const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    list.add(message('answer-1', 'Finished answer'), 'response');

    await expect(manager.flushMessages(list, 'thread-1')).rejects.toThrow('storage unavailable');
    expect(list.get.response.db().map(row => row.id)).toEqual(['answer-1']);

    save.mockResolvedValue({ messages: [] });
    await manager.flushMessages(list, 'thread-1');
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls.map(([input]) => input.messages.map(row => row.id))).toEqual([
      ['answer-1'],
      ['answer-1'],
    ]);
    expect(list.drainUnsavedMessages()).toEqual([]);
  });

  it('keeps the latest message content when a write fails during an update', async () => {
    const memory = new MockMemory();
    const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    list.add(message('answer-1', 'Partial'), 'response');
    const save = vi.spyOn(memory, 'saveMessages').mockImplementationOnce(async () => {
      list.removeByIds(['answer-1']);
      list.add(message('answer-1', 'Complete'), 'response');
      list.add({ ...message('user-2', 'Another message'), role: 'user' }, 'user');
      throw new Error('write failed');
    });
    const manager = new SaveQueueManager({ memory });

    await expect(manager.flushMessages(list, 'thread-1')).rejects.toThrow('write failed');
    save.mockResolvedValue({ messages: [] });
    await manager.flushMessages(list, 'thread-1');

    expect(save.mock.calls[1]?.[0].messages).toEqual([
      expect.objectContaining({
        id: 'answer-1',
        content: expect.objectContaining({ parts: [expect.objectContaining({ type: 'text', text: 'Complete' })] }),
      }),
      expect.objectContaining({ id: 'user-2' }),
    ]);
  });

  it('runs a queued flush after the preceding flush fails', async () => {
    const memory = new MockMemory();
    const save = vi.spyOn(memory, 'saveMessages')
      .mockRejectedValueOnce(new Error('first write failed'))
      .mockResolvedValue({ messages: [] });
    const manager = new SaveQueueManager({ memory });
    const list = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    list.add(message('answer-1', 'Finished answer'), 'response');

    const first = manager.flushMessages(list, 'thread-1');
    const firstFailure = expect(first).rejects.toThrow('first write failed');
    const second = manager.flushMessages(list, 'thread-1');
    await firstFailure;
    await second;

    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1]?.[0].messages.map(row => row.id)).toEqual(['answer-1']);
  });
});
