import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from '../agent/message-list';

import { filterSystemReminderMessages, isSystemReminderMessage, isSystemReminderSignalType } from './system-reminders';

describe('system reminder filtering', () => {
  it.each([
    ['reactive', true],
    ['system-reminder', true],
    ['user', false],
    ['user-message', false],
    ['state', false],
    ['notification', false],
    ['custom', false],
    [undefined, false],
    [null, false],
    [{}, false],
  ])('classifies signal type %s consistently', (type, hidden) => {
    expect(isSystemReminderSignalType(type)).toBe(hidden);
    const message = {
      role: 'signal',
      content: { format: 2, parts: [], metadata: { signal: { type } } },
    } as unknown as MastraDBMessage;
    expect(isSystemReminderMessage(message)).toBe(hidden);
    expect(filterSystemReminderMessages([message])).toHaveLength(hidden ? 0 : 1);
    expect(filterSystemReminderMessages([message], true)).toEqual([message]);
  });

  it('filters metadata-backed and leading-tag system reminders while preserving embedded markup in normal text', () => {
    const metadataReminderMessage = {
      id: 'metadata-reminder',
      role: 'user',
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: 'plain text' }],
        metadata: { systemReminder: { type: 'dynamic-agents-md' } },
      },
    } as unknown as MastraDBMessage;
    const textReminderMessage = {
      id: 'text-reminder',
      role: 'user',
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: '<system-reminder>continue</system-reminder>' }],
      },
    } as unknown as MastraDBMessage;
    const signalReminderMessage = {
      id: 'signal-reminder',
      role: 'signal',
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: 'continue' }],
        metadata: { signal: { type: 'system-reminder' } },
      },
    } as unknown as MastraDBMessage;
    const reactiveSignalMessage = {
      id: 'reactive-signal',
      role: 'signal',
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: 'continue' }],
        metadata: { signal: { type: 'reactive', tagName: 'policy-reminder' } },
      },
    } as unknown as MastraDBMessage;
    const userSignalMessage = {
      id: 'user-signal',
      role: 'signal',
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: 'hello' }],
        metadata: { signal: { type: 'user-message' } },
      },
    } as unknown as MastraDBMessage;
    const embeddedMarkupMessage = {
      id: 'embedded-markup',
      role: 'user',
      createdAt: new Date(),
      threadId: 'thread-1',
      resourceId: 'resource-1',
      content: {
        format: 2 as const,
        parts: [{ type: 'text' as const, text: 'before <system-reminder>continue</system-reminder> after' }],
      },
    } as unknown as MastraDBMessage;

    expect(isSystemReminderMessage(metadataReminderMessage)).toBe(true);
    expect(isSystemReminderMessage(textReminderMessage)).toBe(true);
    expect(isSystemReminderMessage(signalReminderMessage)).toBe(true);
    expect(isSystemReminderMessage(reactiveSignalMessage)).toBe(true);
    expect(isSystemReminderMessage(userSignalMessage)).toBe(false);
    expect(isSystemReminderMessage(embeddedMarkupMessage)).toBe(false);
    expect(
      filterSystemReminderMessages([
        metadataReminderMessage,
        textReminderMessage,
        signalReminderMessage,
        reactiveSignalMessage,
        userSignalMessage,
        embeddedMarkupMessage,
      ]),
    ).toEqual([userSignalMessage, embeddedMarkupMessage]);
  });
});
