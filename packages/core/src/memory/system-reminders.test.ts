import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from '../agent/message-list';

import { filterSystemReminderMessages, isSystemReminderMessage } from './system-reminders';

describe('system reminder filtering', () => {
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
    expect(isSystemReminderMessage(embeddedMarkupMessage)).toBe(false);
    expect(filterSystemReminderMessages([metadataReminderMessage, textReminderMessage, embeddedMarkupMessage])).toEqual(
      [embeddedMarkupMessage],
    );
  });
});
