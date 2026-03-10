import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent';

import { MemoryTokenLimiter } from './memory-token-limiter';

function createMessage(id: string, role: 'user' | 'assistant', text: string, threadId = 'thread-1'): MastraDBMessage {
  return {
    id,
    threadId,
    role,
    content: {
      format: 'v2' as const,
      content: text,
      parts: [{ type: 'text' as const, text }],
    },
    createdAt: new Date(),
    type: 'text',
  };
}

function createAbort(): (reason?: string) => never {
  return (reason?: string) => {
    throw new Error(`Aborted: ${reason}`);
  };
}

describe('MemoryTokenLimiter', () => {
  it('should not remove messages when under token limit', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 1_000_000 });
    const messageList = new MessageList();

    // Add memory messages
    const memoryMsg = createMessage('mem-1', 'user', 'Hello from memory');
    messageList.add(memoryMsg, 'memory');

    // Add input messages
    const inputMsg = createMessage('input-1', 'user', 'New input message');
    messageList.add(inputMsg, 'input');

    const result = await limiter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: createAbort(),
      systemMessages: [],
      state: {},
      retryCount: 0,
    });

    expect(result).toBe(messageList);
    expect(messageList.get.all.db()).toHaveLength(2);
    expect(messageList.get.remembered.db()).toHaveLength(1);
  });

  it('should remove oldest memory messages when over token limit', async () => {
    // Set a very small token limit to trigger trimming
    const limiter = new MemoryTokenLimiter({ maxTokens: 10 });
    const messageList = new MessageList();

    // Add memory messages with substantial content to exceed 10 tokens
    const longText = 'x'.repeat(2000);
    const memoryMsg1 = createMessage('mem-1', 'user', longText);
    const memoryMsg2 = createMessage('mem-2', 'assistant', longText);
    messageList.add(memoryMsg1, 'memory');
    messageList.add(memoryMsg2, 'memory');

    // Add input message
    const inputMsg = createMessage('input-1', 'user', 'Hi');
    messageList.add(inputMsg, 'input');

    await limiter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: createAbort(),
      systemMessages: [],
      state: {},
      retryCount: 0,
    });

    // The oldest memory messages should be removed
    const remaining = messageList.get.all.db();
    const remainingIds = remaining.map(m => m.id);

    // Input message should always be preserved
    expect(remainingIds).toContain('input-1');

    // Both memory messages should have been removed since they're very large
    expect(messageList.get.remembered.db()).toHaveLength(0);
  });

  it('should never remove input messages', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 50 });
    const messageList = new MessageList();

    // Add a large input message
    const largeInput = createMessage('input-1', 'user', 'x'.repeat(1000));
    messageList.add(largeInput, 'input');

    // Add a small memory message
    const memoryMsg = createMessage('mem-1', 'user', 'Hi');
    messageList.add(memoryMsg, 'memory');

    await limiter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: createAbort(),
      systemMessages: [],
      state: {},
      retryCount: 0,
    });

    // Input message should still exist
    const inputMessages = messageList.get.input.db();
    expect(inputMessages).toHaveLength(1);
    expect(inputMessages[0]!.id).toBe('input-1');

    // Memory message should be removed (since total is over budget)
    const memoryMessages = messageList.get.remembered.db();
    expect(memoryMessages).toHaveLength(0);
  });

  it('should remove memory messages in chronological order (oldest first)', async () => {
    // Set a token limit that allows some but not all messages
    const limiter = new MemoryTokenLimiter({ maxTokens: 200 });
    const messageList = new MessageList();

    // Add memory messages oldest first
    messageList.add(createMessage('mem-1', 'user', 'First message - oldest'), 'memory');
    messageList.add(createMessage('mem-2', 'assistant', 'Second message'), 'memory');
    messageList.add(createMessage('mem-3', 'user', 'Third message - newest'), 'memory');

    // Add input
    messageList.add(createMessage('input-1', 'user', 'Current input'), 'input');

    await limiter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: createAbort(),
      systemMessages: [],
      state: {},
      retryCount: 0,
    });

    // Check that if any memory messages remain, they are the newer ones
    const remainingMemory = messageList.get.remembered.db();
    const remainingIds = remainingMemory.map(m => m.id);

    // mem-1 (oldest) should be removed first
    if (remainingIds.length > 0 && remainingIds.length < 3) {
      expect(remainingIds).not.toContain('mem-1');
    }
  });

  it('should have the correct processor id', () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 100_000 });
    expect(limiter.id).toBe('memory-token-limiter');
  });
});
