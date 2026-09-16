import { describe, expect, it } from 'vitest';

import { MessageList } from '../index';
import type { MastraDBMessage } from '../state/types';
import { AIV5Adapter } from './AIV5Adapter';

const makeDBMessage = (parts?: unknown[]): MastraDBMessage =>
  ({
    id: 'message-1',
    role: 'user',
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    threadId: 'thread-1',
    resourceId: 'resource-1',
    content: {
      format: 2,
      ...(parts === undefined ? {} : { parts }),
    },
  }) as never;

describe('AIV5Adapter malformed parts', () => {
  it.each([
    ['an undefined-only parts array', [undefined]],
    ['missing parts', undefined],
  ])('converts %s without throwing', (_, malformedParts) => {
    const message = makeDBMessage(malformedParts);

    expect(() => AIV5Adapter.toUIMessage(message)).not.toThrow();
    expect(AIV5Adapter.toUIMessage(message).parts).toEqual([]);
  });

  it('preserves valid text next to an undefined part', () => {
    const message = makeDBMessage([undefined, { type: 'text', text: 'hi' }]);

    expect(AIV5Adapter.toUIMessage(message).parts).toEqual([{ type: 'text', text: 'hi' }]);
  });

  it('normalizes sparse DB history through MessageList UI and prompt conversion', async () => {
    const message = makeDBMessage([undefined, { type: 'text', text: 'hi' }]);
    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });

    expect(() => messageList.add(message, 'memory')).not.toThrow();
    expect(messageList.get.all.db()[0]?.content.parts).toEqual([{ type: 'text', text: 'hi' }]);
    expect(messageList.get.all.aiV5.ui()[0]?.parts).toEqual([{ type: 'text', text: 'hi' }]);

    await expect(messageList.get.all.aiV5.llmPrompt()).resolves.toEqual([
      {
        role: 'user',
        content: [{ type: 'text', text: 'hi' }],
      },
    ]);
  });

  it('treats undefined model content as an empty parts array', () => {
    const message = AIV5Adapter.fromModelMessage({ role: 'assistant', content: undefined } as never);

    expect(message.content.parts).toEqual([]);
  });

  it('passes missing tool output to the provider prompt fallback', async () => {
    const messageList = new MessageList({ threadId: 'thread-1', resourceId: 'resource-1' });
    messageList.add(
      {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: 'call-1',
            toolName: 'search',
            output: undefined,
          },
        ],
      } as never,
      'memory',
    );

    const prompt = await messageList.get.all.aiV5.llmPrompt();
    const toolResult = prompt
      .flatMap(message => (Array.isArray(message.content) ? message.content : []))
      .find(part => part.type === 'tool-result');

    expect(toolResult).toMatchObject({
      type: 'tool-result',
      toolCallId: 'call-1',
      output: { type: 'json', value: null },
    });
  });
});
