import type { CoreMessage, Message } from 'ai';
import { describe, expect, it } from 'vitest';
import type { MessageType } from '../memory';
import type { MessageListItem } from './message-list';
import { MessageList } from './message-list';

type VercelUIMessage = Message;
type VercelCoreMessage = CoreMessage;
type MastraMessageV1 = MessageType;

const threadId = `one`;
const resourceId = `user`;

describe('MessageList', () => {
  describe('add message', () => {
    it('should correctly convert and add a Vercel UIMessage', () => {
      const input = {
        id: 'ui-msg-1',
        role: 'user',
        content: 'Hello from UI!',
        createdAt: new Date('2023-10-26T10:00:00.000Z'),
        parts: [{ type: 'text', text: 'Hello from UI!' }],
        experimental_attachments: [],
      } satisfies VercelUIMessage;

      const list = new MessageList({ threadId, resourceId }).add(input, 'new-message');

      const messages = list.getMessages();
      expect(messages.length).toBe(1);

      expect(messages[0]).toEqual({
        id: input.id,
        role: 'user',
        createdAt: input.createdAt,
        originalMessage: input,
        contentSource: 'new-message',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello from UI!' }],
          experimental_attachments: [],
        },
        threadId,
        resourceId,
      } satisfies MessageListItem);
    });

    it('should correctly convert and add a Vercel CoreMessage with string content', () => {
      const input = {
        role: 'user',
        content: 'Hello from Core!',
      } satisfies VercelCoreMessage;

      const list = new MessageList({
        threadId,
        resourceId,
      }).add(input, 'new-message');

      const messages = list.getMessages();
      expect(messages.length).toBe(1);

      expect(messages[0]).toEqual({
        id: expect.any(String),
        role: 'user',
        createdAt: expect.any(Date),
        originalMessage: input,
        contentSource: 'new-message',
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello from Core!' }],
        },
        threadId,
        resourceId,
      } satisfies MessageListItem);
    });

    it('should correctly merge a tool result CoreMessage with the preceding assistant message', () => {
      const messageOne = { role: 'user' as const, content: 'Run the tool' as const } satisfies VercelCoreMessage;
      const messageTwo = {
        role: 'assistant' as const,
        content: [{ type: 'tool-call', toolName: 'test-tool', toolCallId: 'call-3', args: { query: 'test' } }],
      } satisfies VercelCoreMessage;

      const initialMessages = [messageOne, messageTwo];

      const list = new MessageList().add(initialMessages[0], 'memory').add(initialMessages[1], 'new-message');

      const messageThree = {
        role: 'tool',
        content: [
          { type: 'tool-result', toolName: 'test-tool', toolCallId: 'call-3', result: 'Tool execution successful' },
        ],
      } satisfies CoreMessage;

      list.add(messageThree, 'new-message');

      expect(list.toUIMessages()).toEqual([
        {
          id: expect.any(String),
          content: '',
          role: `user` as const,
          experimental_attachments: [],
          createdAt: expect.any(Date),
          parts: [{ type: 'text' as const, text: messageOne.content }],
        },
        {
          id: expect.any(String),
          role: 'assistant',
          content: '',
          createdAt: expect.any(Date),
          experimental_attachments: [],
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolName: 'test-tool',
                toolCallId: 'call-3',
                args: messageTwo.content[0].args,
                result: messageThree.content[0].result,
              },
            },
          ],
        },
      ] satisfies VercelUIMessage[]);
    });

    it('should correctly convert and add a Mastra V1 MessageType with array content (text and tool-call)', () => {
      const inputV1Message = {
        id: 'v1-msg-2',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Okay, checking the weather.' },
          { type: 'tool-call', toolName: 'weather-tool', toolCallId: 'call-2', args: { location: 'London' } },
        ],
        threadId,
        resourceId,
        createdAt: new Date('2023-10-26T09:01:00.000Z'),
        type: 'text',
      } satisfies MastraMessageV1;

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message, `new-message`);

      expect(list.getMessages()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: inputV1Message.createdAt,
          originalMessage: inputV1Message,
          contentSource: 'new-message',
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Okay, checking the weather.' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'call',
                  toolName: 'weather-tool',
                  toolCallId: 'call-2',
                  args: { location: 'London' },
                },
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MessageListItem,
      ]);
    });

    it('should correctly convert and add a Mastra V1 MessageType with string content', () => {
      const inputV1Message = {
        id: 'v1-msg-1',
        role: 'user',
        content: 'Hello from V1!',
        threadId,
        resourceId,
        createdAt: new Date('2023-10-26T09:00:00.000Z'),
        type: 'text',
      } satisfies MastraMessageV1;

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message, `new-message`);

      expect(list.getMessages()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: inputV1Message.createdAt,
          originalMessage: inputV1Message,
          contentSource: 'new-message',
          content: {
            format: 2,
            parts: [{ type: 'text', text: inputV1Message.content }],
          },
          threadId,
          resourceId,
        } satisfies MessageListItem,
      ]);
    });

    it('should correctly convert and add a Vercel CoreMessage with array content (text and tool-call)', () => {
      const inputCoreMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Okay, I can do that.' },
          {
            type: 'tool-call',
            toolName: 'calculator',
            toolCallId: 'call-1',
            args: { operation: 'add', numbers: [1, 2] },
          },
        ],
      } satisfies VercelCoreMessage;

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, `new-message`);

      expect(list.getMessages()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
          originalMessage: inputCoreMessage,
          contentSource: 'new-message',
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Okay, I can do that.' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'call',
                  toolName: 'calculator',
                  toolCallId: 'call-1',
                  args: { operation: 'add', numbers: [1, 2] },
                },
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MessageListItem,
      ]);
    });

    it('should correctly handle a sequence of mixed message types including tool calls and results', () => {
      const msg1 = {
        id: 'user-msg-seq-1',
        role: 'user' as const,
        content: 'Initial user query',
        createdAt: new Date('2023-10-26T11:00:00.000Z'),
        parts: [{ type: 'text', text: 'Initial user query' }],
        experimental_attachments: [],
      } satisfies VercelUIMessage;
      const msg2 = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Thinking...' },
          { type: 'tool-call', toolName: 'search-tool', toolCallId: 'call-seq-1', args: { query: 'some query' } },
        ],
      } satisfies VercelCoreMessage;
      const msg3 = {
        role: 'tool',
        content: [
          { type: 'tool-result', toolName: 'search-tool', toolCallId: 'call-seq-1', result: 'Search results data' },
        ],
      } satisfies VercelCoreMessage;
      const msg4 = {
        id: 'assistant-msg-seq-2',
        role: 'assistant',
        content: 'Here are the results.',
        createdAt: new Date('2023-10-26T11:00:03.000Z'),
        parts: [{ type: 'text', text: 'Here are the results.' }],
        experimental_attachments: [],
      } satisfies VercelUIMessage;

      const messageSequence = [msg1, msg2, msg3, msg4];

      expect(new MessageList({ threadId, resourceId }).add(messageSequence, `new-message`).getMessages()).toEqual([
        {
          id: msg1.id,
          role: msg1.role,
          createdAt: msg1.createdAt,
          originalMessage: msg1,
          contentSource: 'new-message',
          content: {
            format: 2,
            parts: [{ type: 'text', text: msg1.content }],
            experimental_attachments: [],
          },
          threadId,
          resourceId,
        },
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: msg4.createdAt,
          originalMessage: msg2,
          contentSource: 'new-message',
          content: {
            format: 2,
            parts: [
              { type: 'text', text: msg2.content[0].text },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolName: msg2.content[1].toolName,
                  toolCallId: msg2.content[1].toolCallId,
                  args: msg2.content[1].args,
                  result: msg3.content[0].result,
                },
              },
              {
                type: 'text',
                text: msg4.content,
              },
            ],
          },
          threadId,
          resourceId,
        },
      ]);
    });
  });
});
