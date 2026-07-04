import { describe, expect, it, vi } from 'vitest';
import type { InputConversionContext } from './input-converter';
import { hydrateMastraDBMessageFields } from './input-converter';
import type { MastraDBMessage } from '../state/types';

describe('hydrateMastraDBMessageFields', () => {
  it('backfills resourceId when the message already has a threadId', () => {
    const message = {
      id: 'msg-1',
      role: 'user',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      threadId: 'thread-1',
      content: {
        format: 2,
        parts: [],
      },
    } satisfies MastraDBMessage;
    const context = {
      memoryInfo: {
        threadId: 'thread-1',
        resourceId: 'resource-1',
      },
      newMessageId: vi.fn(() => 'generated-id'),
      generateCreatedAt: vi.fn(() => new Date('2026-01-02T00:00:00.000Z')),
      dbMessages: [],
    } satisfies InputConversionContext;

    const result = hydrateMastraDBMessageFields(message, context, 'memory');

    expect(result.threadId).toBe('thread-1');
    expect(result.resourceId).toBe('resource-1');
    expect(context.newMessageId).not.toHaveBeenCalled();
    expect(context.generateCreatedAt).not.toHaveBeenCalled();
  });
});
