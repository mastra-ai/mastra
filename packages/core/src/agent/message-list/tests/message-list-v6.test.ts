import * as AIV6 from '@internal/ai-v6';
import type { ModelMessage as ModelMessageV6, UIMessage as UIMessageV6 } from '@internal/ai-v6';
import { describe, expect, expectTypeOf, it } from 'vitest';

import { convertMessages } from '../..';
import type { MastraDBMessage } from '../../index';
import { MessageList } from '../../index';

describe('MessageList AI SDK v6 support', () => {
  // Regression: the v5 bridge omits reasoning parts with no text and no details, but the v6
  // adapter asserted its first converted part existed. Streaming emits exactly that shape on
  // `reasoning-start`, before the first delta, so conversion threw mid-stream.
  describe('empty reasoning parts', () => {
    const emptyReasoningMessage = (id: string, parts: MastraDBMessage['content']['parts']): MastraDBMessage => ({
      id,
      role: 'assistant',
      createdAt: new Date(),
      content: { format: 2, parts },
    });

    it('omits an opening empty reasoning part instead of throwing', () => {
      const message = emptyReasoningMessage('opening-reasoning', [{ type: 'reasoning', reasoning: '', details: [] }]);

      const result = new MessageList().add(message, 'memory').get.all.aiV6.ui();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: 'opening-reasoning', role: 'assistant', parts: [] });
      // the stored message must not be mutated by conversion
      expect(message.content.parts).toEqual([{ type: 'reasoning', reasoning: '', details: [] }]);
    });

    it('omits an empty reasoning part at a non-opening index, keeping surrounding text in order', () => {
      const result = new MessageList()
        .add(
          emptyReasoningMessage('mid-reasoning', [
            { type: 'text', text: 'Before' },
            { type: 'reasoning', reasoning: '', details: [] },
            { type: 'text', text: 'After' },
          ]),
          'memory',
        )
        .get.all.aiV6.ui();

      expect(result[0]?.parts).toEqual([
        { type: 'text', text: 'Before' },
        { type: 'text', text: 'After' },
      ]);
    });

    it('omits a reasoning part with no details key at all', () => {
      const result = new MessageList()
        .add(emptyReasoningMessage('no-details', [{ type: 'reasoning', reasoning: '' } as any]), 'memory')
        .get.all.aiV6.ui();

      expect(result).toHaveLength(1);
      expect(result[0]?.parts).toEqual([]);
    });

    it('converts a whole thread when one message holds an empty reasoning part', () => {
      const list = new MessageList().add(
        [
          {
            id: 'user-1',
            role: 'user',
            createdAt: new Date(),
            content: { format: 2, parts: [{ type: 'text', text: 'Question' }] },
          },
          emptyReasoningMessage('assistant-1', [{ type: 'text', text: 'First answer' }]),
          emptyReasoningMessage('assistant-2', [{ type: 'reasoning', reasoning: '', details: [] }]),
          emptyReasoningMessage('assistant-3', [{ type: 'text', text: 'Second answer' }]),
        ] as MastraDBMessage[],
        'memory',
      );

      // one bad part previously threw for the entire list, returning no messages at all
      expect(list.get.all.aiV6.ui()).toHaveLength(list.get.all.aiV5.ui().length);
      expect(list.get.all.aiV6.ui().map(m => m.id)).toEqual(['user-1', 'assistant-1', 'assistant-2', 'assistant-3']);
    });

    it('keeps reasoning metadata and tool approvals when an empty reasoning part is omitted', () => {
      const result = new MessageList()
        .add(
          emptyReasoningMessage('mixed-reasoning', [
            { type: 'reasoning', reasoning: '', details: [] },
            {
              type: 'reasoning',
              reasoning: 'Preparing the requested task.',
              details: [{ type: 'text', text: 'Preparing the requested task.' }],
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                toolCallId: 'read-page',
                toolName: 'readPage',
                args: { url: 'https://example.com' },
                state: 'approval-requested',
                approval: { id: 'approve-page' },
              },
            } as any,
            { type: 'text', text: 'After' },
          ]),
          'memory',
        )
        .get.all.aiV6.ui();

      const parts = result[0]?.parts ?? [];
      expect(parts).toContainEqual(
        expect.objectContaining({ type: 'reasoning', text: 'Preparing the requested task.' }),
      );
      expect(parts).toContainEqual(expect.objectContaining({ type: 'text', text: 'After' }));
      expect(parts).toContainEqual(
        expect.objectContaining({ approval: expect.objectContaining({ id: 'approve-page' }) }),
      );
    });

    it('omits an empty reasoning part on the v7 projection too', () => {
      const result = new MessageList()
        .add(emptyReasoningMessage('v7-reasoning', [{ type: 'reasoning', reasoning: '', details: [] }]), 'memory')
        .get.all.aiV7.ui();

      expect(result).toHaveLength(1);
      expect(result[0]?.parts).toEqual([]);
    });

    it('still keeps a reasoning part whose details carry an empty text entry', () => {
      const result = new MessageList()
        .add(
          emptyReasoningMessage('empty-text-detail', [
            { type: 'reasoning', reasoning: '', details: [{ type: 'text', text: '' }] },
          ]),
          'memory',
        )
        .get.all.aiV6.ui();

      expect(result[0]?.parts).toEqual([expect.objectContaining({ type: 'reasoning', text: '' })]);
    });
  });

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

  it('preserves plain dynamic-tool parts with input-streaming state', () => {
    const list = new MessageList().add(
      [
        {
          id: 'assistant-dynamic-tool-streaming',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'search',
              toolCallId: 'call-1',
              state: 'input-streaming',
              input: { query: 'weath' },
            },
          ],
        },
      ] satisfies UIMessageV6[],
      'memory',
    );

    expect(list.get.all.db()[0]?.content.parts).toMatchObject([
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolName: 'search',
          toolCallId: 'call-1',
          state: 'partial-call',
          args: { query: 'weath' },
        },
      },
    ]);
  });

  it('preserves plain dynamic-tool parts with input-available state', () => {
    const list = new MessageList().add(
      [
        {
          id: 'assistant-dynamic-tool-input',
          role: 'assistant',
          parts: [
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

    expect(list.get.all.db()[0]?.content.parts).toMatchObject([
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolName: 'search',
          toolCallId: 'call-1',
          state: 'call',
          args: { query: 'weather' },
        },
      },
    ]);
    expect(list.get.all.db()[0]?.content.toolInvocations).toMatchObject([
      {
        toolName: 'search',
        toolCallId: 'call-1',
        state: 'call',
        args: { query: 'weather' },
      },
    ]);
  });

  it('preserves plain dynamic-tool parts with output-available state', () => {
    const list = new MessageList().add(
      [
        {
          id: 'assistant-dynamic-tool-output',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'search',
              toolCallId: 'call-1',
              state: 'output-available',
              input: { query: 'weather' },
              output: { forecast: 'sunny' },
            },
          ],
        },
      ] satisfies UIMessageV6[],
      'memory',
    );

    expect(list.get.all.db()[0]?.content.parts).toMatchObject([
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolName: 'search',
          toolCallId: 'call-1',
          state: 'result',
          args: { query: 'weather' },
          result: { forecast: 'sunny' },
        },
      },
    ]);
  });

  it('preserves plain dynamic-tool parts with output-error state', () => {
    const list = new MessageList().add(
      [
        {
          id: 'assistant-dynamic-tool-error',
          role: 'assistant',
          parts: [
            {
              type: 'dynamic-tool',
              toolName: 'search',
              toolCallId: 'call-1',
              state: 'output-error',
              input: { query: 'weather' },
              errorText: 'Search failed',
              rawInput: '{"query":"weather"}',
            },
          ],
        },
      ] satisfies UIMessageV6[],
      'memory',
    );

    expect(list.get.all.db()[0]?.content.parts).toMatchObject([
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolName: 'search',
          toolCallId: 'call-1',
          state: 'output-error',
          args: { query: 'weather' },
          errorText: 'Search failed',
          rawInput: '{"query":"weather"}',
        },
      },
    ]);
  });

  it('preserves plain dynamic-tool parts mixed with custom data parts', () => {
    const list = new MessageList().add(
      [
        {
          id: 'assistant-dynamic-tool-data',
          role: 'assistant',
          parts: [
            { type: 'data-progress', data: { step: 1 } } as any,
            {
              type: 'dynamic-tool',
              toolName: 'search',
              toolCallId: 'call-1',
              state: 'input-available',
              input: { query: 'weather' },
            },
            { type: 'data-custom', data: { foo: 'bar' } } as any,
          ],
        },
      ] satisfies UIMessageV6[],
      'memory',
    );

    expect(list.get.all.db()[0]?.content.parts).toMatchObject([
      { type: 'data-progress', data: { step: 1 } },
      {
        type: 'tool-invocation',
        toolInvocation: {
          toolName: 'search',
          toolCallId: 'call-1',
          state: 'call',
          args: { query: 'weather' },
        },
      },
      { type: 'data-custom', data: { foo: 'bar' } },
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

  it('preserves stored toModelOutput metadata across db to v6 ui to db round-trips', () => {
    const toolResultMessage: MastraDBMessage = {
      id: 'msg-model-output',
      role: 'assistant',
      createdAt: new Date(),
      content: {
        format: 2,
        parts: [
          {
            type: 'tool-invocation',
            toolInvocation: {
              toolCallId: 'call-1',
              toolName: 'screenshotTool',
              state: 'result',
              args: { url: 'https://example.com' },
              result: { ok: true, _b64: 'base64imagedata' },
            },
            providerMetadata: {
              mastra: {
                modelOutput: {
                  type: 'content',
                  value: [{ type: 'media', data: 'base64imagedata', mediaType: 'image/jpeg' }],
                },
              },
            },
          },
        ],
      },
    };

    const uiMessage = new MessageList().add([toolResultMessage], 'memory').get.all.aiV6.ui()[0]!;
    const toolUIPart = uiMessage.parts.find(part => AIV6.isToolUIPart(part)) as any;

    // Stored modelOutput travels on the v6 UI part as callProviderMetadata
    expect(toolUIPart?.callProviderMetadata?.mastra?.modelOutput).toEqual({
      type: 'content',
      value: [{ type: 'media', data: 'base64imagedata', mediaType: 'image/jpeg' }],
    });

    // And survives ingestion back into a db message
    const roundTripped = new MessageList().add([uiMessage], 'memory').get.all.db()[0]!;
    const roundTrippedPart = roundTripped.content.parts.find(part => part.type === 'tool-invocation') as any;
    expect(roundTrippedPart?.toolInvocation?.result).toEqual({ ok: true, _b64: 'base64imagedata' });
    expect(roundTrippedPart?.providerMetadata?.mastra?.modelOutput).toEqual({
      type: 'content',
      value: [{ type: 'media', data: 'base64imagedata', mediaType: 'image/jpeg' }],
    });
  });

  it('rehydrates persisted pending tool approvals into v6 approval-requested tool parts on reload', () => {
    const messages: MastraDBMessage[] = [
      {
        id: 'msg-pending-approval',
        role: 'assistant',
        createdAt: new Date('2024-01-01'),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              providerMetadata: {
                mastra: {
                  display: {
                    input: { approvedPath: '/tmp/test.txt' },
                  },
                },
              },
              providerExecuted: true,
              title: 'Delete file',
              toolInvocation: {
                toolCallId: 'tc-2',
                toolName: 'delete-file',
                args: { path: '/tmp/test.txt' },
                state: 'call',
              },
            },
            {
              type: 'data-tool-call-approval',
              data: {
                toolCallId: 'tc-2',
                toolName: 'delete-file',
                type: 'approval',
                runId: 'run-2',
              },
            } as any,
            { type: 'text', text: 'Waiting for approval.' },
          ],
          metadata: {
            pendingToolApprovals: {
              'delete-file': {
                toolCallId: 'tc-2',
                toolName: 'delete-file',
                args: { path: '/tmp/test.txt' },
                type: 'approval',
                runId: 'run-2',
              },
            },
          },
        },
      },
    ];

    const result = new MessageList().add(messages, 'memory').get.all.aiV6.ui();
    const toolParts = result[0]?.parts.filter(part => AIV6.isToolUIPart(part)) ?? [];

    expect(toolParts).toHaveLength(1);
    expect(toolParts[0]).toMatchObject({
      type: 'tool-delete-file',
      toolCallId: 'tc-2',
      state: 'approval-requested',
      input: { path: '/tmp/test.txt' },
      approval: { id: 'run-2::tc-2' },
      callProviderMetadata: {
        mastra: {
          display: {
            input: { approvedPath: '/tmp/test.txt' },
          },
        },
      },
      providerExecuted: true,
      title: 'Delete file',
    });

    expect(result[0]?.parts.filter(part => part.type === 'data-tool-call-approval')).toHaveLength(1);
  });

  it('adds v6 tool approval responses after reloading a metadata-backed pending approval', () => {
    const list = new MessageList().add(
      [
        {
          id: 'msg-pending-approval',
          role: 'assistant',
          createdAt: new Date('2024-01-01'),
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                providerMetadata: {
                  mastra: {
                    display: {
                      input: { approvedPath: '/tmp/test.txt' },
                    },
                  },
                },
                providerExecuted: true,
                title: 'Delete file',
                toolInvocation: {
                  toolCallId: 'tc-2',
                  toolName: 'delete-file',
                  args: { path: '/tmp/test.txt' },
                  state: 'call',
                },
              },
              {
                type: 'data-tool-call-approval',
                data: {
                  toolCallId: 'tc-2',
                  toolName: 'delete-file',
                  type: 'approval',
                  runId: 'run-2',
                },
              } as any,
              { type: 'text', text: 'Waiting for approval.' },
            ],
            metadata: {
              pendingToolApprovals: {
                'delete-file': {
                  toolCallId: 'tc-2',
                  toolName: 'delete-file',
                  args: { path: '/tmp/test.txt' },
                  type: 'approval',
                  runId: 'run-2',
                },
              },
            },
          },
        },
      ] satisfies MastraDBMessage[],
      'memory',
    );

    list.add(
      [
        {
          role: 'tool',
          content: [
            {
              type: 'tool-approval-response',
              approvalId: 'run-2::tc-2',
              approved: false,
              reason: 'needs human review',
            },
          ],
        },
      ] satisfies ModelMessageV6[],
      'response',
    );

    const approvalResponsePart = list.get.all.aiV6
      .ui()
      .flatMap(message => message.parts)
      .find(part => AIV6.isToolUIPart(part) && part.state === 'approval-responded');

    expect(approvalResponsePart).toMatchObject({
      type: 'tool-delete-file',
      toolCallId: 'tc-2',
      state: 'approval-responded',
      input: { path: '/tmp/test.txt' },
      approval: { id: 'run-2::tc-2', approved: false, reason: 'needs human review' },
      callProviderMetadata: {
        mastra: {
          display: {
            input: { approvedPath: '/tmp/test.txt' },
          },
        },
      },
      providerExecuted: true,
      title: 'Delete file',
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
