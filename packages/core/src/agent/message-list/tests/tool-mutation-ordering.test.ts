import { afterEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../message-list';
import type { MastraDBMessage } from '../state/types';

const mutations = {
  metadata: (list: MessageList) => list.updateMessageMetadataByToolCallId('call-1', { updated: true }),
  result: (list: MessageList) =>
    list.updateToolInvocation({
      type: 'tool-invocation',
      toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'search', args: {}, result: 'done' },
    }),
  error: (list: MessageList) => list.addOutputErrorsToProviderToolCalls('assistant-1', ['call-1']),
};

afterEach(() => vi.useRealTimers());

describe.each(['memory', 'response'] as const)('tool mutation ordering from %s', source => {
  describe.each(Object.entries(mutations))('%s', (_name, mutate) => {
    it.each([
      { name: 'past message', created: 1000, edit: 2000, next: 2000, expected: 2001 },
      { name: 'future message', created: 3000, edit: 2000, next: 2000, expected: 3001 },
      { name: 'clock moves backward after edit', created: 1000, edit: 2000, next: 1500, expected: 2001 },
      {
        name: 'timestamp changed through the public getter',
        created: 1000,
        updatedCreatedAt: 3000,
        edit: 2000,
        next: 2000,
        expected: 3001,
      },
    ])('preserves ordering with $name', ({ created, edit, next, expected, updatedCreatedAt }) => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(1000);
      const message: MastraDBMessage = {
        id: 'assistant-1',
        role: 'assistant',
        createdAt: new Date(created),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              providerExecuted: true,
              toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'search', args: {} },
            },
          ],
        },
      };
      const list = new MessageList().add(message, source);
      list.drainUnsavedMessages();
      if (updatedCreatedAt !== undefined) {
        list.get.all.db()[0]!.createdAt.setTime(updatedCreatedAt);
      }
      vi.setSystemTime(edit);
      expect(mutate(list)).toBe(true);
      const saved = list.drainUnsavedMessages();
      expect(saved.map(m => m.id)).toEqual(['assistant-1']);
      expect(saved[0]?.createdAt.getTime()).toBe(updatedCreatedAt ?? created);

      vi.setSystemTime(next);
      list.add({ role: 'user', content: 'next' }, 'input');
      const messages = list.get.all.db();
      expect(messages.map(m => m.role)).toEqual(['assistant', 'user']);
      expect(messages[1]?.createdAt.getTime()).toBe(expected);
    });
  });
});
