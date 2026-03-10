import { describe, expect, it } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent';
import { MockMemory } from '../../memory/mock';

import { MemoryTokenLimiter } from './memory-token-limiter';

function createMessage(id: string, role: 'user' | 'assistant', text: string, threadId = 'thread-1'): MastraDBMessage {
  return {
    id,
    threadId,
    role,
    content: {
      format: 2 as const,
      parts: [{ type: 'text' as const, text }],
    },
    createdAt: new Date(),
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
    // Set a token limit smaller than the total of all messages
    // 'x'.repeat(2000) ≈ 667 tiktoken tokens, so two such messages ≈ 1334 tokens
    // plus input ≈ 2 tokens. Limit of 5 forces all memory messages to be removed.
    const limiter = new MemoryTokenLimiter({ maxTokens: 5 });
    const messageList = new MessageList();

    // Add memory messages with substantial content
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
    // 'x'.repeat(1000) ≈ 334 tiktoken tokens. Set limit below that so memory gets trimmed.
    const limiter = new MemoryTokenLimiter({ maxTokens: 5 });
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
    // Each short message ≈ 4-6 tiktoken tokens, 3 memory + 1 input ≈ 16-20 tokens total.
    // Set maxTokens to 10 so that some (but not all) memory messages must be removed.
    const limiter = new MemoryTokenLimiter({ maxTokens: 10 });
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

    const remainingMemory = messageList.get.remembered.db();
    const remainingIds = remainingMemory.map(m => m.id);

    // Some memory messages should have been removed
    expect(remainingMemory.length).toBeLessThan(3);

    // mem-1 (oldest) should be removed first
    expect(remainingIds).not.toContain('mem-1');

    // Input is always preserved
    expect(messageList.get.input.db()).toHaveLength(1);
  });

  it('should have the correct processor id', () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 100_000 });
    expect(limiter.id).toBe('memory-token-limiter');
  });

  it('should account for system message tokens in the budget', async () => {
    // Use a limit that fits messages alone but not messages + system prompt
    // Messages: ~8 tokens total. System: large enough to push over the limit.
    const limiter = new MemoryTokenLimiter({ maxTokens: 20 });
    const messageList = new MessageList();

    messageList.add(createMessage('mem-1', 'user', 'Hello from memory'), 'memory');
    messageList.add(createMessage('input-1', 'user', 'Hi'), 'input');

    // Without system messages, total ≈ 8 tokens (under 20)
    // With a large system message, total will exceed 20
    const largeSystemPrompt = 'You are a helpful assistant. '.repeat(10);

    await limiter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: createAbort(),
      systemMessages: [{ role: 'system' as const, content: largeSystemPrompt }],
      state: {},
      retryCount: 0,
    });

    // Memory should be trimmed because system + messages exceeds budget
    expect(messageList.get.remembered.db()).toHaveLength(0);
    // Input preserved
    expect(messageList.get.input.db()).toHaveLength(1);
  });

  it('should remove all memory messages when maxTokens is 0', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 0 });
    const messageList = new MessageList();

    messageList.add(createMessage('mem-1', 'user', 'Hello'), 'memory');
    messageList.add(createMessage('mem-2', 'assistant', 'Hi there'), 'memory');
    messageList.add(createMessage('input-1', 'user', 'New message'), 'input');

    await limiter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: createAbort(),
      systemMessages: [],
      state: {},
      retryCount: 0,
    });

    expect(messageList.get.remembered.db()).toHaveLength(0);
    expect(messageList.get.input.db()).toHaveLength(1);
  });

  it('should handle no memory messages gracefully', async () => {
    const limiter = new MemoryTokenLimiter({ maxTokens: 10 });
    const messageList = new MessageList();

    // Only input messages, no memory
    messageList.add(createMessage('input-1', 'user', 'x'.repeat(1000)), 'input');

    await limiter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: createAbort(),
      systemMessages: [],
      state: {},
      retryCount: 0,
    });

    // Input messages are never removed even if over budget
    expect(messageList.get.input.db()).toHaveLength(1);
    expect(messageList.get.all.db()).toHaveLength(1);
  });

  it('should preserve input messages even when they alone exceed maxTokens', async () => {
    // 'x'.repeat(5000) ≈ 1667 tiktoken tokens, well above maxTokens: 5
    const limiter = new MemoryTokenLimiter({ maxTokens: 5 });
    const messageList = new MessageList();

    // Large input that exceeds maxTokens by itself
    messageList.add(createMessage('input-1', 'user', 'x'.repeat(5000)), 'input');
    // Small memory message
    messageList.add(createMessage('mem-1', 'user', 'Hi'), 'memory');

    await limiter.processInput({
      messages: messageList.get.all.db(),
      messageList,
      abort: createAbort(),
      systemMessages: [],
      state: {},
      retryCount: 0,
    });

    // Memory removed, but input preserved even though still over budget
    expect(messageList.get.remembered.db()).toHaveLength(0);
    expect(messageList.get.input.db()).toHaveLength(1);
    expect(messageList.get.input.db()[0]!.id).toBe('input-1');
  });
});

describe('Memory.getInputProcessors with maxTokens', () => {
  it('should auto-add MemoryTokenLimiter when maxTokens is configured', async () => {
    const memory = new MockMemory();
    // Override threadConfig to include maxTokens
    (memory as any).threadConfig = {
      ...(memory as any).threadConfig,
      maxTokens: 100_000,
    };

    const processors = await memory.getInputProcessors();
    const tokenLimiter = processors.find(p => p.id === 'memory-token-limiter');
    expect(tokenLimiter).toBeDefined();
  });

  it('should NOT add MemoryTokenLimiter when maxTokens is not configured', async () => {
    const memory = new MockMemory();

    const processors = await memory.getInputProcessors();
    const tokenLimiter = processors.find(p => p.id === 'memory-token-limiter');
    expect(tokenLimiter).toBeUndefined();
  });
});
