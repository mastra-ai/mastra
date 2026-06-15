import { describe, it, expect } from 'vitest';

import { MessageList } from '../message-list';
import type { MastraDBMessage, MastraMessagePart } from '../state/types';

describe('MessageList sealed message handling', () => {
  it('should not replace a sealed message, but create a new message with only new parts', () => {
    const messageList = new MessageList({ threadId: 'test-thread' });

    // Add initial user message
    messageList.add(
      {
        role: 'user',
        content: 'Hello',
      },
      'input',
    );

    // Add assistant message with a part that has sealedAt metadata
    const assistantMessageId = 'assistant-msg-1';
    const sealedPart = {
      type: 'text',
      text: 'Hello! How can I help?',
      metadata: { mastra: { sealedAt: Date.now() } },
    } as MastraMessagePart;

    messageList.add(
      {
        id: assistantMessageId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [sealedPart],
          metadata: { mastra: { sealed: true } },
        },
        createdAt: new Date(),
      } as MastraDBMessage,
      'response',
    );

    // Streaming continues - accumulated message (old parts + new parts) with same ID
    messageList.add(
      {
        id: assistantMessageId, // Same ID
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            sealedPart, // Old part with sealedAt metadata
            { type: 'text', text: 'Here is more content after observation.' }, // New part
          ],
        },
        createdAt: new Date(),
      } as MastraDBMessage,
      'response',
    );

    // Check that we now have 3 messages: user, sealed assistant, new assistant
    const allMessages = messageList.get.all.db();
    expect(allMessages.length).toBe(3);

    // The original sealed message should still have its original content
    const sealedMessage = allMessages.find(m => m.id === assistantMessageId);
    expect(sealedMessage).toBeDefined();
    expect(sealedMessage?.content.parts).toHaveLength(1);
    expect((sealedMessage?.content.parts[0] as { text?: string })?.text).toBe('Hello! How can I help?');

    // There should be a new message with ONLY the new content (not duplicated)
    const newMessage = allMessages.find(m => m.id !== assistantMessageId && m.role === 'assistant');
    expect(newMessage).toBeDefined();
    expect(newMessage?.content.parts).toHaveLength(1); // Only the new part!
    expect((newMessage?.content.parts[0] as { text?: string })?.text).toBe('Here is more content after observation.');

    // The new message should have a different ID
    expect(newMessage?.id).not.toBe(assistantMessageId);
  });

  it('should not create a new message if incoming message has no new parts after sealedAt', () => {
    const messageList = new MessageList({ threadId: 'test-thread' });

    // Add user message
    messageList.add({ role: 'user', content: 'Hello' }, 'input');

    // Add and seal assistant message with sealedAt on the part
    const assistantMessageId = 'assistant-msg-1';
    const sealedPart = {
      type: 'text',
      text: 'Response',
      metadata: { mastra: { sealedAt: Date.now() } },
    } as MastraMessagePart;

    messageList.add(
      {
        id: assistantMessageId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [sealedPart],
          metadata: { mastra: { sealed: true } },
        },
        createdAt: new Date(),
      } as MastraDBMessage,
      'response',
    );

    // Try to add same content again (no new parts after sealedAt)
    messageList.add(
      {
        id: assistantMessageId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [sealedPart], // Same part with sealedAt, no new parts
        },
        createdAt: new Date(),
      } as MastraDBMessage,
      'response',
    );

    // Should still have only 2 messages (no new message created)
    const allMessages = messageList.get.all.db();
    expect(allMessages.length).toBe(2);
  });

  it('should still merge into non-sealed messages normally', () => {
    const messageList = new MessageList({ threadId: 'test-thread' });

    // Add initial user message
    messageList.add(
      {
        role: 'user',
        content: 'Hello',
      },
      'input',
    );

    // Add assistant message
    const assistantMessageId = 'assistant-msg-1';
    messageList.add(
      {
        id: assistantMessageId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Part 1' }],
        },
        createdAt: new Date(),
      } as MastraDBMessage,
      'response',
    );

    // Add more parts (should merge since not sealed)
    messageList.add(
      {
        id: assistantMessageId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Part 2' }],
        },
        createdAt: new Date(),
      } as MastraDBMessage,
      'response',
    );

    // Should still have only 2 messages (user + merged assistant)
    const allMessages = messageList.get.all.db();
    expect(allMessages.length).toBe(2);

    // The assistant message should have both parts merged
    const assistantMessage = allMessages.find(m => m.role === 'assistant');
    expect(assistantMessage).toBeDefined();
    expect(assistantMessage?.content.parts.length).toBeGreaterThanOrEqual(2);
  });

  it('should not merge a new response into an older assistant message when the latest message is user input', () => {
    const messageList = new MessageList({ threadId: 'test-thread' });

    messageList.add(
      {
        id: 'assistant-memory-msg',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Persisted assistant reply' }],
        },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      } as MastraDBMessage,
      'memory',
    );

    messageList.add({ role: 'user', content: 'Please continue' }, 'input');

    messageList.add(
      {
        id: 'assistant-retry-msg',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Retried assistant reply' }],
        },
        createdAt: new Date('2024-01-01T00:00:01.000Z'),
      } as MastraDBMessage,
      'response',
    );

    const allMessages = messageList.get.all.db();
    expect(allMessages.length).toBe(3);

    const persistedAssistant = allMessages.find(m => m.id === 'assistant-memory-msg');
    const retriedAssistant = allMessages.find(m => m.id === 'assistant-retry-msg');

    expect(persistedAssistant?.content.parts).toHaveLength(1);
    expect((persistedAssistant?.content.parts[0] as { text?: string })?.text).toBe('Persisted assistant reply');
    expect(retriedAssistant?.content.parts).toHaveLength(1);
    expect((retriedAssistant?.content.parts[0] as { text?: string })?.text).toBe('Retried assistant reply');

    const unsavedOutput = messageList.get.response.db();
    expect(unsavedOutput).toHaveLength(1);
    expect(unsavedOutput[0]?.id).toBe('assistant-retry-msg');
  });

  it('should add text flushed independently to a sealed message as a new message', () => {
    const messageList = new MessageList({ threadId: 'test-thread' });

    // Add user message
    messageList.add({ role: 'user', content: 'Hello' }, 'input');

    // Add sealed assistant message with tool-invocation parts (simulating async buffering seal)
    const assistantMessageId = 'assistant-msg-1';
    messageList.add(
      {
        id: assistantMessageId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            { type: 'data-om-status', data: { windows: {} } } as MastraMessagePart,
            {
              type: 'tool-invocation',
              toolInvocation: { toolCallId: 'call-1', toolName: 'view', state: 'result', args: {}, result: 'ok' },
              metadata: { mastra: { sealedAt: Date.now() } },
            } as MastraMessagePart,
          ],
          metadata: { mastra: { sealed: true } },
        },
        createdAt: new Date(),
      } as MastraDBMessage,
      'response',
    );

    // Text deltas are flushed independently in processOutputStream (llm-execution-step.ts:107)
    // This creates a 1-part text message with the SAME messageId
    messageList.add(
      {
        id: assistantMessageId, // Same ID as sealed message
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Here is my analysis of the codebase...' }],
        },
        createdAt: new Date(),
      } as MastraDBMessage,
      'response',
    );

    const allMessages = messageList.get.all.db();

    // Should have 3 messages: user, sealed assistant, NEW text message
    expect(allMessages.length).toBe(3);

    // The sealed message should be unchanged
    const sealedMessage = allMessages.find(m => m.id === assistantMessageId);
    expect(sealedMessage).toBeDefined();
    expect(sealedMessage?.content.parts).toHaveLength(2);

    // The text should be in a new message (NOT discarded)
    const textMessage = allMessages.find(m => m.id !== assistantMessageId && m.role === 'assistant');
    expect(textMessage).toBeDefined();
    expect(textMessage?.content.parts).toHaveLength(1);
    expect((textMessage?.content.parts[0] as { type: string; text: string }).type).toBe('text');
    expect((textMessage?.content.parts[0] as { type: string; text: string }).text).toBe(
      'Here is my analysis of the codebase...',
    );

    // The text message should be tracked as a response message (so processOutputResult saves it)
    const responseMessages = messageList.get.response.db();
    expect(responseMessages.some(m => m.content.parts.some(p => p.type === 'text'))).toBe(true);
  });

  it('should preserve observation markers in sealed messages', () => {
    const messageList = new MessageList({ threadId: 'test-thread' });

    // Add user message
    messageList.add({ role: 'user', content: 'Hello' }, 'input');

    // Add assistant message with observation marker that has sealedAt metadata
    const assistantMessageId = 'assistant-msg-1';
    const observationMarkerPart = {
      type: 'data-om-observation-end',
      data: {
        cycleId: 'cycle-1',
        recordId: 'record-1',
        observedAt: new Date().toISOString(),
        tokensObserved: 100,
        observationTokens: 50,
      },
      metadata: { mastra: { sealedAt: Date.now() } }, // This marks the seal boundary
    } as MastraMessagePart;

    messageList.add(
      {
        id: assistantMessageId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Response text' }, observationMarkerPart],
          metadata: {
            mastra: { sealed: true },
          },
        },
        createdAt: new Date(),
      } as MastraDBMessage,
      'response',
    );

    // Streaming continues - accumulated message (old parts + new parts) with same ID
    messageList.add(
      {
        id: assistantMessageId,
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Response text' }, // Old part
            observationMarkerPart, // Old part with sealedAt metadata
            { type: 'text', text: 'New content after observation' }, // New part
          ],
        },
        createdAt: new Date(),
      } as MastraDBMessage,
      'response',
    );

    const allMessages = messageList.get.all.db();

    // Should have 3 messages
    expect(allMessages.length).toBe(3);

    // Original message should still have the observation marker
    const sealedMessage = allMessages.find(m => m.id === assistantMessageId);
    expect(sealedMessage).toBeDefined();
    const hasObservationMarker = sealedMessage?.content.parts.some(p => p.type === 'data-om-observation-end');
    expect(hasObservationMarker).toBe(true);

    // New message should only have the new content
    const newMessage = allMessages.find(m => m.id !== assistantMessageId && m.role === 'assistant');
    expect(newMessage).toBeDefined();
    expect(newMessage?.content.parts).toHaveLength(1);
    expect((newMessage?.content.parts[0] as { text?: string })?.text).toBe('New content after observation');
  });

  it('should not merge into messages at or before the latest sealed boundary', () => {
    const messageList = new MessageList({ threadId: 'test-thread' });

    messageList.add(
      {
        id: 'old-assistant',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'old response' }],
        },
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
      } as MastraDBMessage,
      'response',
    );

    messageList.add(
      {
        id: 'sealed-boundary',
        role: 'assistant',
        content: {
          format: 2,
          parts: [
            {
              type: 'data-om-observation-end',
              data: { observedAt: new Date('2024-01-01T00:00:01.000Z').toISOString() },
              metadata: { mastra: { sealedAt: 1 } },
            } as MastraMessagePart,
          ],
          metadata: { mastra: { sealed: true } },
        },
        createdAt: new Date('2024-01-01T00:00:01.000Z'),
      } as MastraDBMessage,
      'memory',
    );

    messageList.add(
      {
        id: 'old-assistant',
        role: 'assistant',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'new content after boundary' }],
        },
        createdAt: new Date('2024-01-01T00:00:02.000Z'),
      } as MastraDBMessage,
      'response',
    );

    const allMessages = messageList.get.all.db();
    const oldAssistant = allMessages.find(message => message.id === 'old-assistant');
    const newAssistant = allMessages.find(
      message => message.id !== 'old-assistant' && message.id !== 'sealed-boundary' && message.role === 'assistant',
    );

    expect(oldAssistant?.content.parts).toHaveLength(1);
    expect((oldAssistant?.content.parts[0] as { text?: string })?.text).toBe('old response');
    expect(newAssistant).toBeDefined();
    expect((newAssistant?.content.parts[0] as { text?: string })?.text).toBe('new content after boundary');
  });
});
