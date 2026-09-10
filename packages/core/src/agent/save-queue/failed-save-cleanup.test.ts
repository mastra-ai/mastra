import { expect, it, vi } from 'vitest';
import { MessageList } from '../message-list';
import { SaveQueueManager } from './index';

function setup() {
  const error = new Error('storage unavailable');
  const saveMessages = vi.fn().mockRejectedValueOnce(error).mockResolvedValue({ messages: [] });
  const logger = { error: vi.fn() };
  const queue = new SaveQueueManager({ memory: { saveMessages } as any, logger: logger as any });
  const messages = new MessageList({ threadId: 'thread', resourceId: 'user' });
  messages.add({ role: 'user', content: 'Keep this message.' }, 'input');
  return { error, saveMessages, logger, queue, messages };
}

it('waits for failed-save cleanup before a queued write starts', async () => {
  const { queue, messages, saveMessages, error } = setup();
  let finish!: () => void;
  const gate = new Promise<void>(resolve => {
    finish = resolve;
  });
  const cleanup = vi.fn(() => gate);
  const first = queue.flushMessages(messages, 'thread', undefined, cleanup).catch(error => error);
  const next = queue.flushMessages(messages, 'thread');
  await vi.waitFor(() => expect(cleanup).toHaveBeenCalledWith(error));
  expect(saveMessages).toHaveBeenCalledTimes(1);
  finish();
  expect(await first).toBe(error);
  await next;
  expect(saveMessages).toHaveBeenCalledTimes(2);
});

it.each([false, true])('preserves the save error and logs cleanup failure (async=%s)', async asynchronous => {
  const { queue, messages, logger, error } = setup();
  const cleanupError = new Error('cleanup failed');
  const cleanup = () => {
    if (asynchronous) return Promise.reject(cleanupError);
    throw cleanupError;
  };
  await expect(queue.flushMessages(messages, 'thread', undefined, cleanup)).rejects.toBe(error);
  expect(logger.error).toHaveBeenCalledWith('Error cleaning up failed message save', {
    err: cleanupError,
    threadId: 'thread',
  });
});
