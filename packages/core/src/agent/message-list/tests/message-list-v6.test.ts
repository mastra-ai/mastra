import * as AIV6 from '@internal/ai-v6';
import type { ModelMessage as ModelMessageV6, UIMessage as UIMessageV6 } from '@internal/ai-v6';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { convertMessages } from '../..';
import type { MastraDBMessage } from '../../index';
import { MessageList } from '../../index';

describe('MessageList AI SDK v6 support', () => {
  it('projects MastraDBMessage records to AI SDK v6 UI messages', () => {
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: { format: 2, parts: [{ type: 'text', text: 'Hello' }] },
        createdAt: new Date(),
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: { format: 2, parts: [{ type: 'text', text: 'Hi there!' }] },
        createdAt: new Date(),
      },
    ];

    const result = new MessageList().add(messages, 'memory').get.all.aiV6.ui();

    expectTypeOf(result).toEqualTypeOf<UIMessageV6[]>();
    expect(result).toHaveLength(2);
    expect(result[0]).toHaveProperty('id', 'msg-1');
    expect(result[1]).toHaveProperty('id', 'msg-2');
  });

  it('round-trips v6 approval and denied tool states through MessageList.add()', () => {
    const messages: UIMessageV6[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-search',
            toolCallId: 'call-1',
            state: 'approval-requested',
            input: { query: 'weather' },
            approval: { id: 'approval-1' },
          },
          {
            type: 'tool-search',
            toolCallId: 'call-2',
            state: 'output-denied',
            input: { query: 'bank account' },
            approval: { id: 'approval-2', approved: false, reason: 'needs human review' },
          },
        ],
      },
    ];

    const list = new MessageList().add(messages, 'memory');
    const result = list.get.all.aiV6.ui();

    expect(result[0]?.parts).toMatchObject([
      {
        type: 'tool-search',
        toolCallId: 'call-1',
        state: 'approval-requested',
        approval: { id: 'approval-1' },
      },
      {
        type: 'tool-search',
        toolCallId: 'call-2',
        state: 'output-denied',
        approval: { id: 'approval-2', approved: false, reason: 'needs human review' },
      },
    ]);
  });

  it('preserves v6 UI part order when source-document and approval parts are present', () => {
    const list = new MessageList().add(
      [
        {
          id: 'assistant-ordered',
          role: 'assistant',
          parts: [
            { type: 'text', text: 'Before' },
            {
              type: 'source-document',
              sourceId: 'doc-1',
              mediaType: 'application/pdf',
              title: 'Doc 1',
            },
            {
              type: 'tool-search',
              toolCallId: 'call-1',
              state: 'approval-requested',
              input: { query: 'weather' },
              approval: { id: 'approval-1' },
            },
            { type: 'text', text: 'After' },
          ],
        },
      ] satisfies UIMessageV6[],
      'memory',
    );

    expect(list.get.all.aiV6.ui()[0]?.parts.map(part => part.type)).toEqual([
      'text',
      'source-document',
      'tool-search',
      'text',
    ]);
  });

  it('preserves dynamic-tool parts when the message is otherwise v6-only', () => {
    const list = new MessageList().add(
      [
        {
          id: 'assistant-dynamic-tool',
          role: 'assistant',
          parts: [
            {
              type: 'source-document',
              sourceId: 'doc-1',
              mediaType: 'application/pdf',
              title: 'Doc 1',
            },
            {
              type: 'dynamic-tool',
              toolName: 'search',
              toolCallId: 'call-1',
              state: 'input-available',
              input: { query: 'weather' },
            },
          ],
        },
      ] satisfies UIMessageV6[],
      'memory',
    );

    expect(list.get.all.aiV6.ui()[0]?.parts).toMatchObject([
      {
        type: 'source-document',
        sourceId: 'doc-1',
        mediaType: 'application/pdf',
        title: 'Doc 1',
      },
      {
        type: 'tool-search',
        toolCallId: 'call-1',
        state: 'input-available',
        input: { query: 'weather' },
      },
    ]);
  });

  it('supports AIV6.UI in convertMessages()', () => {
    const messages: UIMessageV6[] = [
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'hello from v6' }],
      },
    ];

    const result = convertMessages(messages).to('AIV6.UI');

    expectTypeOf(result).toEqualTypeOf<UIMessageV6[]>();
    expect(result[0]).toMatchObject({
      id: 'assistant-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'hello from v6' }],
    });
  });

  it('adds v6 model messages with tool approval requests', () => {
    const messages: ModelMessageV6[] = [
      {
        role: 'assistant',
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'search',
            input: { query: 'weather' },
          },
          {
            type: 'tool-approval-request',
            approvalId: 'approval-1',
            toolCallId: 'call-1',
          },
        ],
      },
    ];

    const result = new MessageList().add(messages, 'response').get.all.aiV6.ui();

    expect(result[0]?.parts).toMatchObject([
      {
        type: 'tool-search',
        toolCallId: 'call-1',
        state: 'approval-requested',
        input: { query: 'weather' },
        approval: { id: 'approval-1' },
      },
    ]);
  });

  it('adds v6 tool approval responses after a prior approval request', () => {
    const list = new MessageList().add(
      [
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'search',
              input: { query: 'weather' },
            },
            {
              type: 'tool-approval-request',
              approvalId: 'approval-1',
              toolCallId: 'call-1',
            },
          ],
        },
      ] satisfies ModelMessageV6[],
      'response',
    );

    list.add(
      [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-approval-response',
              approvalId: 'approval-1',
              approved: false,
              reason: 'needs human review',
            },
          ],
        },
      ] satisfies ModelMessageV6[],
      'response',
    );

    const result = list.get.all.aiV6.ui();
    const approvalResponsePart = result
      .flatMap(message => message.parts)
      .find(part => AIV6.isToolUIPart(part) && part.state === 'approval-responded');

    expect(approvalResponsePart).toMatchObject({
      type: 'tool-search',
      toolCallId: 'call-1',
      state: 'approval-responded',
      input: { query: 'weather' },
      approval: { id: 'approval-1', approved: false, reason: 'needs human review' },
    });
  });

  it('does not duplicate source or data parts when v5 fallback adds missing text', () => {
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-source-data',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          content: 'Hello',
          parts: [
            {
              type: 'source',
              source: {
                type: 'source',
                sourceType: 'url',
                id: 'source-1',
                url: 'https://example.com/reference',
                title: 'Reference',
              },
            } as any,
            { type: 'data-custom', data: { foo: 'bar' } } as any,
          ],
        },
      },
    ];

    expect(
      new MessageList()
        .add(messages, 'memory')
        .get.all.aiV6.ui()[0]
        ?.parts.map(part => part.type),
    ).toEqual(['source-url', 'data-custom']);
  });
});
