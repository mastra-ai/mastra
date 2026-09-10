import { describe, expect, it } from 'vitest';

import type { MastraDBMessage } from '../agent/message-list';
import type { AgentSignalType } from '../agent/signals';

import { MockMemory } from './mock';
import { filterSystemReminderMessages } from './system-reminders';

const target = { threadId: 'recall-thread', resourceId: 'recall-resource' };
const types: AgentSignalType[] = ['user', 'state', 'reactive', 'notification', 'user-message', 'system-reminder'];
const messages: MastraDBMessage[] = [
  ...types.map(
    (type, i): MastraDBMessage => ({
      ...target,
      id: type,
      role: 'signal',
      createdAt: new Date(i * 1000),
      content: { format: 2, parts: [{ type: 'text', text: type }], metadata: { signal: { type } } },
    }),
  ),
  {
    ...target,
    id: 'legacy',
    role: 'user',
    createdAt: new Date(6000),
    content: { format: 2, parts: [{ type: 'text', text: '<system-reminder>legacy</system-reminder>' }] },
  },
  {
    ...target,
    id: 'plain',
    role: 'user',
    createdAt: new Date(7000),
    content: { format: 2, parts: [{ type: 'text', text: 'ordinary' }] },
  },
];

describe('MockMemory recall exclusions', () => {
  it.each([undefined, false, true])(
    'preserves defaults and explicit precedence with includeSystemReminders=%s',
    async includeSystemReminders => {
      const memory = new MockMemory();
      await memory.createThread(target);
      await memory.saveMessages({ messages });
      const store = await memory.storage.getStore('memory');
      const before = await store!.listMessages({ ...target, perPage: false });
      for (const hideSignals of [undefined, false, true, [], ['reactive'], ['system-reminder'], types] satisfies (
        | boolean
        | AgentSignalType[]
        | undefined
      )[]) {
        const result = await memory.recall({ ...target, perPage: false, includeSystemReminders, hideSignals });
        const hidden =
          hideSignals === undefined
            ? includeSystemReminders
              ? []
              : ['reactive', 'system-reminder', 'legacy']
            : hideSignals === true
              ? [...types, 'legacy']
              : hideSignals === false
                ? []
                : [...hideSignals, ...(hideSignals.includes('system-reminder') ? ['legacy'] : [])];
        expect(result.messages.map(message => message.id)).toEqual(
          messages.filter(message => !hidden.includes(message.id)).map(message => message.id),
        );
        expect(result).toMatchObject({ total: 8, page: 0, perPage: false, hasMore: false });
      }
      expect(await store!.listMessages({ ...target, perPage: false })).toEqual(before);
      const page = await memory.recall({ ...target, perPage: 2, page: 0, hideSignals: types });
      expect(page).toMatchObject({ messages: [], total: 8, page: 0, perPage: 2, hasMore: true });
    },
  );
});

describe('recall encoded type precedence', () => {
  it.each(['data-signal', 'data-user-message'] as const)(
    'uses %s encoded type before legacy metadata and markup',
    partType => {
      const message: MastraDBMessage = {
        ...target,
        id: 'conflicting',
        role: 'signal',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [{ type: partType, data: { type: 'user-message' } }],
          metadata: { signal: { type: 'reactive' } },
        },
      };
      expect(filterSystemReminderMessages([message], undefined, ['reactive', 'system-reminder', 'user'])).toEqual([
        message,
      ]);
      expect(filterSystemReminderMessages([message], true, ['user-message'])).toEqual([]);
      // Omitted-option compatibility still uses the original metadata classifier.
      expect(filterSystemReminderMessages([message])).toEqual([]);
    },
  );

  it.each([null, [], {}, { type: 'future' }, { type: null }, 'reactive'])(
    'preserves unknown or malformed signal data %j',
    data => {
      const message: MastraDBMessage = {
        ...target,
        id: 'unknown',
        role: 'assistant',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'data-signal', data }] },
      };
      expect(filterSystemReminderMessages([message], undefined, types)).toEqual([message]);
      expect(filterSystemReminderMessages([message], undefined, true)).toEqual([message]);
    },
  );

  it('infers only system-reminder for legacy rows with unrecognized encodings', () => {
    const message: MastraDBMessage = {
      ...target,
      id: 'legacy-unknown',
      role: 'user',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [{ type: 'data-signal', data: { type: 'future' } }],
        metadata: { systemReminder: {} },
      },
    };
    expect(filterSystemReminderMessages([message], undefined, ['reactive'])).toEqual([message]);
    expect(filterSystemReminderMessages([message], true, ['system-reminder'])).toEqual([]);
  });
});
