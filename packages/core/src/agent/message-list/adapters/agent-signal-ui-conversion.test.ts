import { describe, expect, it } from 'vitest';

import { signalToMastraDBMessage } from '../../signals';
import { MessageList } from '../message-list';
import { AIV4Adapter } from './AIV4Adapter';
import { AIV5Adapter } from './AIV5Adapter';
import { AIV6Adapter } from './AIV6Adapter';

describe('agent signal UI conversion', () => {
  it('converts user-message signals to user UI messages', () => {
    const dbMessage = signalToMastraDBMessage({
      id: 'signal-user-1',
      type: 'user-message',
      contents: 'Hello from the user',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
    });

    expect(AIV4Adapter.toUIMessage(dbMessage)).toMatchObject({
      id: 'signal-user-1',
      role: 'user',
      content: 'Hello from the user',
      parts: [{ type: 'text', text: 'Hello from the user' }],
    });
    expect(AIV5Adapter.toUIMessage(dbMessage)).toMatchObject({
      id: 'signal-user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello from the user' }],
    });
    expect(AIV6Adapter.toUIMessage(dbMessage)).toMatchObject({
      id: 'signal-user-1',
      role: 'user',
      parts: [{ type: 'text', text: 'Hello from the user' }],
    });
  });

  it('converts non-user signals to data parts instead of user text messages', () => {
    const dbMessage = signalToMastraDBMessage({
      id: 'signal-system-1',
      type: 'system-reminder',
      contents: 'continue',
      createdAt: new Date('2024-01-01T00:00:00.000Z'),
      attributes: { status: 'pending' },
      metadata: { reminderType: 'anthropic-prefill-processor-retry' },
    });

    for (const uiMessage of [
      AIV4Adapter.toUIMessage(dbMessage),
      AIV5Adapter.toUIMessage(dbMessage),
      AIV6Adapter.toUIMessage(dbMessage),
    ]) {
      expect(uiMessage.role).toBe('system');
      expect(uiMessage.parts).toEqual([
        {
          type: 'data-signal',
          data: {
            id: 'signal-system-1',
            type: 'reactive',
            tagName: 'system-reminder',
            contents: 'continue',
            createdAt: '2024-01-01T00:00:00.000Z',
            attributes: { status: 'pending' },
            metadata: { reminderType: 'anthropic-prefill-processor-retry' },
          },
        },
      ]);
    }

    expect(AIV4Adapter.toUIMessage(dbMessage).content).toBe('');
  });

  it('merges non-user signal data parts onto previous assistant message via MessageList', () => {
    const list = new MessageList();

    list.add('What is the weather?', 'input');
    list.add(
      {
        id: 'assistant-1',
        role: 'assistant',
        content: {
          format: 2,
          content: 'Let me check that for you.',
          parts: [{ type: 'text', text: 'Let me check that for you.' }],
        },
        createdAt: new Date('2024-01-01T00:00:01.000Z'),
      },
      'response',
    );
    list.add(
      signalToMastraDBMessage({
        id: 'signal-reminder-1',
        type: 'system-reminder',
        contents: 'continue',
        createdAt: new Date('2024-01-01T00:00:02.000Z'),
        metadata: { reminderType: 'anthropic-prefill-processor-retry' },
      }),
      'memory',
    );

    const v5Messages = list.get.all.aiV5.ui();
    const v4Messages = list.get.all.aiV4.ui();
    const v6Messages = list.get.all.aiV6.ui();

    for (const messages of [v5Messages, v4Messages, v6Messages]) {
      expect(messages.every(m => m.role !== 'system')).toBe(true);

      const assistantMsg = messages.find(m => m.role === 'assistant')!;
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg.parts.some(p => p.type === 'data-signal')).toBe(true);
    }
  });

  it('keeps user-type signals as standalone user messages via MessageList', () => {
    const list = new MessageList();

    list.add(
      {
        id: 'assistant-1',
        role: 'assistant',
        content: { format: 2, content: 'Hello!', parts: [{ type: 'text', text: 'Hello!' }] },
        createdAt: new Date('2024-01-01T00:00:01.000Z'),
      },
      'response',
    );
    list.add(
      signalToMastraDBMessage({
        id: 'signal-user-msg-1',
        type: 'user-message',
        contents: 'Follow up from user signal',
        createdAt: new Date('2024-01-01T00:00:02.000Z'),
      }),
      'memory',
    );

    const v5Messages = list.get.all.aiV5.ui();
    expect(
      v5Messages.some(
        m =>
          m.role === 'user' &&
          m.parts.some(p => p.type === 'text' && 'text' in p && p.text === 'Follow up from user signal'),
      ),
    ).toBe(true);
  });

  it('converts signal to assistant in-place when no immediate neighbor is assistant', () => {
    const list = new MessageList();

    list.add('What is the weather?', 'input');
    list.add(
      signalToMastraDBMessage({
        id: 'signal-orphan-1',
        type: 'system-reminder',
        contents: 'continue',
        createdAt: new Date('2024-01-01T00:00:02.000Z'),
      }),
      'memory',
    );

    const v5Messages = list.get.all.aiV5.ui();
    expect(v5Messages.every(m => m.role !== 'system')).toBe(true);
    const converted = v5Messages.find(m => m.parts.some(p => p.type === 'data-signal'));
    expect(converted).toBeDefined();
    expect(converted!.role).toBe('assistant');
  });
});
