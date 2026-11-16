import { describe, expect, it, vi } from 'vitest';
import { MessageList } from '../message-list';
import { persistPartialTurn } from './persist-partial-turn';

function setup(overrides: Record<string, unknown> = {}) {
  const flushMessages = vi.fn(async () => {});
  const error = vi.fn();
  const authorize = vi.fn(async () => {});
  const messageList = new MessageList({ threadId: 'thread-1' });
  const logger = { error } as any;

  const run = (overrides2: Record<string, unknown> = {}) =>
    persistPartialTurn({
      memory: {} as any,
      threadId: 'thread-1',
      memoryConfig: undefined,
      messageList,
      saveQueueManager: { flushMessages } as any,
      authorize,
      logger,
      runId: 'run-1',
      ...overrides,
      ...overrides2,
    });

  return { run, flushMessages, error, authorize, messageList };
}

describe('persistPartialTurn', () => {
  it('saves the turn through the save queue', async () => {
    const { run, flushMessages, authorize, messageList } = setup();

    await run();

    expect(authorize).toHaveBeenCalledOnce();
    expect(flushMessages).toHaveBeenCalledOnce();
    expect(flushMessages).toHaveBeenCalledWith(messageList, 'thread-1', undefined);
  });

  it.each([
    ['no memory', { memory: undefined }],
    ['no thread id', { threadId: undefined }],
    ['a read-only run', { memoryConfig: { readOnly: true } as any }],
    ['observational memory', { memoryConfig: { observationalMemory: true } as any }],
  ])('does not save with %s', async (_label, overrides) => {
    const { run, flushMessages, authorize } = setup();

    await run(overrides as Record<string, unknown>);

    expect(authorize).not.toHaveBeenCalled();
    expect(flushMessages).not.toHaveBeenCalled();
  });

  it('skips the save when the write is not authorized', async () => {
    const { run, flushMessages, error, authorize } = setup();
    authorize.mockRejectedValue(new Error('denied'));

    await expect(run()).resolves.toBeUndefined();

    expect(flushMessages).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledOnce();
    expect(error).toHaveBeenCalledWith(
      'Failed to keep a partial turn after an output processor tripwire',
      expect.objectContaining({ runId: 'run-1', threadId: 'thread-1' }),
    );
  });

  it('logs and swallows save failures so the run still ends', async () => {
    const { run, flushMessages, error } = setup();
    flushMessages.mockRejectedValue(new Error('storage down'));

    await expect(run()).resolves.toBeUndefined();

    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][1]).toMatchObject({ runId: 'run-1', threadId: 'thread-1' });
  });
});
