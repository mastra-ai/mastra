import { randomUUID } from 'crypto';
import { appendClientMessage, appendResponseMessages } from 'ai';
import type { UIMessage, CoreMessage, Message } from 'ai';
import { describe, expect, it } from 'vitest';
import type { MastraMessageV1 } from '../../memory';
import type { MastraMessageV2, UIMessageWithMetadata } from '../message-list';
import { MessageList } from './index';

type VercelUIMessage = Message;
type VercelCoreMessage = CoreMessage;

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

      const list = new MessageList({ threadId, resourceId }).add(input, 'user');

      const messages = list.get.all.v2();
      expect(messages.length).toBe(1);

      expect(messages[0]).toEqual({
        id: input.id,
        role: 'user',
        createdAt: input.createdAt,
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Hello from UI!' }],
          experimental_attachments: [],
        },
        threadId,
        resourceId,
      } satisfies MastraMessageV2);
    });

    it('should correctly convert and add a Vercel CoreMessage with string content', () => {
      const input = {
        role: 'user',
        content: 'Hello from Core!',
      } satisfies VercelCoreMessage;

      const list = new MessageList({
        threadId,
        resourceId,
      }).add(input, 'user');

      const messages = list.get.all.v2();
      expect(messages.length).toBe(1);

      expect(messages[0]).toEqual({
        id: expect.any(String),
        role: 'user',
        createdAt: expect.any(Date),
        content: {
          format: 2,
          content: 'Hello from Core!',
          parts: [{ type: 'step-start' }, { type: 'text', text: 'Hello from Core!' }],
        },
        threadId,
        resourceId,
      } satisfies MastraMessageV2);
    });

    it('should correctly merge a tool result CoreMessage with the preceding assistant message', () => {
      const messageOne = { role: 'user' as const, content: 'Run the tool' as const } satisfies VercelCoreMessage;
      const messageTwo = {
        role: 'assistant' as const,
        content: [{ type: 'tool-call', toolName: 'test-tool', toolCallId: 'call-3', args: { query: 'test' } }],
      } satisfies VercelCoreMessage;

      const initialMessages = [messageOne, messageTwo];

      const list = new MessageList().add(initialMessages[0], 'user').add(initialMessages[1], 'response');

      const messageThree = {
        role: 'tool',
        content: [
          { type: 'tool-result', toolName: 'test-tool', toolCallId: 'call-3', result: 'Tool execution successful' },
        ],
      } satisfies CoreMessage;

      list.add(messageThree, 'response');

      expect(list.get.all.ui()).toEqual([
        {
          id: expect.any(String),
          content: messageOne.content,
          role: `user` as const,
          experimental_attachments: [],
          createdAt: expect.any(Date),
          parts: [{ type: 'step-start' }, { type: 'text' as const, text: messageOne.content }],
        },
        {
          id: expect.any(String),
          role: 'assistant',
          content: '',
          createdAt: expect.any(Date),
          reasoning: undefined,
          toolInvocations: [
            {
              state: 'result',
              toolName: 'test-tool',
              toolCallId: 'call-3',
              args: messageTwo.content[0].args,
              result: messageThree.content[0].result,
            },
          ],
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

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message, 'response');

      expect(list.get.all.v2()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: expect.any(Date),
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
        } satisfies MastraMessageV2,
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

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message, 'user');

      expect(list.get.all.v2()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: expect.any(Date),
          content: {
            format: 2,
            content: 'Hello from V1!',
            parts: [{ type: 'step-start' }, { type: 'text', text: inputV1Message.content }],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'user');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
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
        } satisfies MastraMessageV2,
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

      const expected = [
        {
          id: msg1.id,
          role: msg1.role,
          createdAt: msg1.createdAt,
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
            toolInvocations: [
              {
                state: 'result',
                toolName: msg2.content[1].toolName,
                toolCallId: msg2.content[1].toolCallId,
                args: msg2.content[1].args,
                result: msg3.content[0].result,
              },
            ],
          },
          threadId,
          resourceId,
        },
      ];
      expect(new MessageList({ threadId, resourceId }).add(messageSequence, 'user').get.all.v2()).toEqual(
        expected.map(m => ({ ...m, createdAt: expect.any(Date) })),
      );

      let messages: Message[] = [];
      const list = new MessageList();

      // msg1
      messages = appendClientMessage({ messages, message: msg1 });
      expect(new MessageList().add(messages, 'user').get.all.ui()).toEqual(
        messages.map(m => ({ ...m, createdAt: expect.any(Date) })),
      );
      list.add(messages, 'user');
      expect(list.get.all.ui()).toEqual(messages.map(m => ({ ...m, createdAt: expect.any(Date) })));

      // msg2
      messages = appendResponseMessages({
        messages,
        responseMessages: [{ ...msg2, id: randomUUID() }],
      });
      // Filter out tool invocations with state="call" from expected UI messages
      const expectedUIMessages = messages.map(m => {
        if (m.role === 'assistant' && m.parts && m.toolInvocations) {
          return {
            ...m,
            parts: m.parts.filter(p => !(p.type === 'tool-invocation' && p.toolInvocation.state === 'call')),
            toolInvocations: m.toolInvocations.filter(t => t.state === 'result'),
            createdAt: expect.any(Date),
          };
        }
        return { ...m, createdAt: expect.any(Date) };
      });
      expect(new MessageList().add(messages, 'response').get.all.ui()).toEqual(expectedUIMessages);
      list.add(messages, 'response');
      expect(list.get.all.ui()).toEqual(expectedUIMessages);

      // msg3
      messages = appendResponseMessages({ messages, responseMessages: [{ id: randomUUID(), ...msg3 }] });
      expect(new MessageList().add(messages, 'response').get.all.ui()).toEqual(
        messages.map(m => ({ ...m, createdAt: expect.any(Date) })),
      );
      list.add(messages, 'response');
      expect(list.get.all.ui()).toEqual(messages.map(m => ({ ...m, createdAt: expect.any(Date) })));

      // msg4
      messages = appendResponseMessages({ messages, responseMessages: [msg4] });
      expect(new MessageList().add(messages, 'response').get.all.ui()).toEqual(
        messages.map(m => ({ ...m, createdAt: expect.any(Date) })),
      );
      list.add(messages, 'response');
      expect(list.get.all.ui()).toEqual(messages.map(m => ({ ...m, createdAt: expect.any(Date) })));
    });

    it('should correctly convert and add a Vercel CoreMessage with reasoning and redacted-reasoning parts', () => {
      const inputCoreMessage = {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Step 1: Analyze', signature: 'sig-a' },
          { type: 'redacted-reasoning', data: 'sensitive data' },
          { type: 'text', text: 'Result of step 1.' },
        ],
      } satisfies VercelCoreMessage;

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'user');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              {
                type: 'reasoning',
                reasoning: '',
                details: [{ type: 'text', text: 'Step 1: Analyze', signature: 'sig-a' }],
              },
              { type: 'reasoning', reasoning: '', details: [{ type: 'redacted', data: 'sensitive data' }] },
              { type: 'text', text: 'Result of step 1.' },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly convert and add a Vercel CoreMessage with file parts', () => {
      const inputCoreMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is an image:' },
          { type: 'file', mimeType: 'image/png', data: new Uint8Array([1, 2, 3, 4]) },
        ],
      } satisfies VercelCoreMessage;

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'user');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'user',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Here is an image:' },
              { type: 'file', mimeType: 'image/png', data: 'AQIDBA==' }, // Base64 of [1, 2, 3, 4]
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly convert and add a Mastra V1 MessageType with reasoning and redacted-reasoning parts', () => {
      const inputV1Message = {
        id: 'v1-msg-3',
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Analyzing data...', signature: 'sig-b' },
          { type: 'redacted-reasoning', data: 'more sensitive data' },
          { type: 'text', text: 'Analysis complete.' },
        ],
        threadId,
        resourceId,
        createdAt: new Date('2023-10-26T09:02:00.000Z'),
        type: 'text',
      } satisfies MastraMessageV1;

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message, 'response');

      expect(list.get.all.v2()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              {
                type: 'reasoning',
                reasoning: '',
                details: [{ type: 'text', text: 'Analyzing data...', signature: 'sig-b' }],
              },
              { type: 'reasoning', reasoning: '', details: [{ type: 'redacted', data: 'more sensitive data' }] },
              { type: 'text', text: 'Analysis complete.' },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly convert and add a Mastra V1 MessageType with file parts', () => {
      const inputV1Message = {
        id: 'v1-msg-4',
        role: 'user',
        content: [
          { type: 'text', text: 'Here is a document:' },
          { type: 'file', mimeType: 'application/pdf', data: 'JVBERi0xLjQKJ...' }, // Dummy base64
        ],
        threadId,
        resourceId,
        createdAt: new Date('2023-10-26T09:03:00.000Z'),
        type: 'text',
      } satisfies MastraMessageV1;

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message, 'user');

      expect(list.get.all.v2()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Here is a document:' },
              { type: 'file', mimeType: 'application/pdf', data: 'JVBERi0xLjQKJ...' },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly handle a sequence of assistant messages with interleaved tool calls and results', () => {
      const msg1 = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Step 1: Call tool A' },
          { type: 'tool-call', toolName: 'tool-a', toolCallId: 'call-a-1', args: {} },
        ],
      } satisfies VercelCoreMessage;
      const msg2 = {
        role: 'tool',
        content: [{ type: 'tool-result', toolName: 'tool-a', toolCallId: 'call-a-1', result: 'Result A' }],
      } satisfies VercelCoreMessage;
      const msg3 = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Step 2: Call tool B' },
          { type: 'tool-call', toolName: 'tool-b', toolCallId: 'call-b-1', args: {} },
        ],
      } satisfies VercelCoreMessage;
      const msg4 = {
        role: 'tool',
        content: [{ type: 'tool-result', toolName: 'tool-b', toolCallId: 'call-b-1', result: 'Result B' }],
      } satisfies VercelCoreMessage;
      const msg5 = {
        role: 'assistant',
        content: 'Final response.',
      } satisfies VercelCoreMessage;

      const messageSequence = [msg1, msg2, msg3, msg4, msg5];

      const list = new MessageList({ threadId, resourceId }).add(messageSequence, 'response');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
          content: {
            content: 'Final response.',
            format: 2,
            parts: [
              { type: 'text', text: 'Step 1: Call tool A' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolName: 'tool-a',
                  toolCallId: 'call-a-1',
                  args: {},
                  result: 'Result A',
                },
              },
              { type: 'text', text: 'Step 2: Call tool B' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolName: 'tool-b',
                  toolCallId: 'call-b-1',
                  args: {},
                  result: 'Result B',
                },
              },
              { type: 'step-start' },
              { type: 'text', text: 'Final response.' },
            ],
            toolInvocations: [
              {
                state: 'result',
                toolName: 'tool-a',
                toolCallId: 'call-a-1',
                args: {},
                result: 'Result A',
              },
              {
                state: 'result',
                toolName: 'tool-b',
                toolCallId: 'call-b-1',
                args: {},
                result: 'Result B',
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly handle an assistant message with reasoning, tool calls, results, and subsequent text', () => {
      const userMsg = {
        role: 'user',
        content: 'Perform a task requiring data.',
      } satisfies VercelCoreMessage;

      const assistantMsgPart1 = {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'First, I need to gather some data.', signature: 'sig-gather' },
          { type: 'text', text: 'Calling data tool...' },
          { type: 'tool-call', toolName: 'data-tool', toolCallId: 'call-data-1', args: { query: 'required data' } },
        ],
      } satisfies VercelCoreMessage;

      const toolResultMsg = {
        role: 'tool',
        content: [
          { type: 'tool-result', toolName: 'data-tool', toolCallId: 'call-data-1', result: '{"data": "gathered"}' },
        ],
      } satisfies VercelCoreMessage;

      const assistantMsgPart2 = {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Data gathered, now processing.', signature: 'sig-process' },
          { type: 'text', text: 'Task completed successfully with gathered data.' },
        ],
      } satisfies VercelCoreMessage;

      const messageSequence = [userMsg, assistantMsgPart1, toolResultMsg, assistantMsgPart2];

      const list = new MessageList({ threadId, resourceId }).add(messageSequence, 'response');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'user',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            content: userMsg.content,
            parts: [{ type: 'step-start' }, { type: 'text', text: userMsg.content }],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
        {
          id: expect.any(String), // Should be the ID of the first assistant message in the sequence
          role: 'assistant',
          createdAt: expect.any(Date), // Should be the timestamp of the last message in the sequence
          content: {
            format: 2,
            parts: [
              {
                type: 'reasoning',
                reasoning: '',
                details: [{ type: 'text', text: 'First, I need to gather some data.', signature: 'sig-gather' }],
              },
              { type: 'text', text: 'Calling data tool...' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result', // State should be updated to result
                  toolName: 'data-tool',
                  toolCallId: 'call-data-1',
                  args: { query: 'required data' },
                  result: '{"data": "gathered"}', // Result from the tool message
                },
              },
              {
                type: 'reasoning',
                reasoning: '',
                details: [{ type: 'text', text: 'Data gathered, now processing.', signature: 'sig-process' }],
              },
              { type: 'text', text: 'Task completed successfully with gathered data.' },
            ],
            toolInvocations: [
              {
                state: 'result', // State should be updated to result
                toolName: 'data-tool',
                toolCallId: 'call-data-1',
                args: { query: 'required data' },
                result: '{"data": "gathered"}', // Result from the tool message
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly convert a Mastra V1 MessageType with a file part containing a non-data URL', () => {
      const inputV1Message = {
        id: 'v1-msg-url-1',
        role: 'user',
        content: [
          { type: 'text', text: 'Here is an image URL:' },
          {
            type: 'file',
            mimeType: 'image/jpeg',
            data: new URL('https://example.com/image.jpg'),
            filename: 'image.jpg',
          },
        ],
        threadId,
        resourceId,
        createdAt: new Date('2023-10-26T09:04:00.000Z'),
        type: 'text',
      } satisfies MastraMessageV1;

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message, 'memory');

      expect(list.get.all.v2()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Here is an image URL:' },
              {
                data: 'https://example.com/image.jpg',
                mimeType: 'image/jpeg',
                type: 'file',
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly convert a Vercel CoreMessage with a file part containing a non-data URL', () => {
      const inputCoreMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is another image URL:' },
          {
            type: 'file',
            mimeType: 'image/png',
            data: new URL('https://example.com/another-image.png'),
            filename: 'another-image.png',
          },
        ],
      } satisfies VercelCoreMessage;

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'user');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'user',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Here is another image URL:' },
              {
                type: 'file',
                data: 'https://example.com/another-image.png',
                mimeType: 'image/png',
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly preserve experimental_attachments from a Vercel UIMessage', () => {
      const input = {
        id: 'ui-msg-attachments-1',
        role: 'user',
        content: 'Message with attachment',
        createdAt: new Date('2023-10-26T10:05:00.000Z'),
        parts: [{ type: 'text', text: 'Message with attachment' }],
        experimental_attachments: [
          {
            name: 'report.pdf',
            url: 'https://example.com/files/report.pdf',
            contentType: 'application/pdf',
          },
        ],
      } satisfies VercelUIMessage;

      const list = new MessageList({ threadId, resourceId }).add(input, 'user');

      const messages = list.get.all.v2();
      expect(messages.length).toBe(1);

      expect(messages[0]).toEqual({
        id: input.id,
        role: 'user',
        createdAt: expect.any(Date),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Message with attachment' }],
          experimental_attachments: [
            {
              name: 'report.pdf',
              url: 'https://example.com/files/report.pdf',
              contentType: 'application/pdf',
            },
          ],
        },
        threadId,
        resourceId,
      } satisfies MastraMessageV2);
    });

    it('should correctly convert and add a Vercel UIMessage with text and experimental_attachments', () => {
      const input = {
        id: 'ui-msg-text-attachment-1',
        role: 'user',
        content: 'Check out this image:', // The content string might still be present in some useChat versions, though parts is preferred
        createdAt: new Date('2023-10-26T10:10:00.000Z'),
        parts: [{ type: 'text', text: 'Check out this image:' }],
        experimental_attachments: [
          {
            name: 'example.png',
            url: 'https://example.com/images/example.png',
            contentType: 'image/png',
          },
        ],
      } satisfies VercelUIMessage;

      const list = new MessageList({ threadId, resourceId }).add(input, 'user');

      const messages = list.get.all.v2();
      expect(messages.length).toBe(1);

      expect(messages[0]).toEqual({
        id: input.id,
        role: 'user',
        createdAt: expect.any(Date),
        content: {
          format: 2,
          parts: [{ type: 'text', text: 'Check out this image:' }],
          experimental_attachments: [
            {
              name: 'example.png',
              url: 'https://example.com/images/example.png',
              contentType: 'image/png',
            },
          ],
        },
        threadId,
        resourceId,
      } satisfies MastraMessageV2);
    });

    it('should correctly handle a mixed sequence of Mastra V1 and Vercel UIMessages with tool calls and results', () => {
      const userMsgV1 = {
        id: 'v1-user-1',
        role: 'user',
        content: 'Please find some information.',
        threadId,
        resourceId,
        createdAt: new Date('2023-10-26T12:00:00.000Z'),
        type: 'text',
      } satisfies MastraMessageV1;

      const assistantMsgV1 = {
        id: 'v1-assistant-1',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Searching...' },
          { type: 'tool-call', toolName: 'search-tool', toolCallId: 'call-mix-1', args: { query: 'info' } },
        ],
        threadId,
        resourceId,
        createdAt: new Date('2023-10-26T12:00:01.000Z'),
        type: 'text',
      } satisfies MastraMessageV1;

      const toolResultMsgV1 = {
        id: 'v1-tool-1',
        role: 'tool',
        content: [
          { type: 'tool-result', toolName: 'search-tool', toolCallId: 'call-mix-1', result: 'Found relevant data.' },
        ],
        threadId,
        resourceId,
        createdAt: new Date('2023-10-26T12:00:02.000Z'),
        type: 'tool-result',
      } satisfies MastraMessageV1;

      const assistantMsgUIV2 = {
        id: 'ui-assistant-1',
        role: 'assistant',
        content: 'Here is the information I found.',
        createdAt: new Date('2023-10-26T12:00:03.000Z'),
        parts: [{ type: 'text', text: 'Here is the information I found.' }],
        experimental_attachments: [],
      } satisfies VercelUIMessage;

      const messageSequence = [userMsgV1, assistantMsgV1, toolResultMsgV1, assistantMsgUIV2];

      const list = new MessageList({ threadId, resourceId }).add(messageSequence, 'response');

      expect(list.get.all.v2()).toEqual([
        {
          id: userMsgV1.id,
          role: 'user',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            content: userMsgV1.content,
            parts: [{ type: 'step-start' }, { type: 'text', text: userMsgV1.content }],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
        {
          id: assistantMsgV1.id, // Should retain the original assistant message ID
          role: 'assistant',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Searching...' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result', // State should be updated to result
                  toolName: 'search-tool',
                  toolCallId: 'call-mix-1',
                  args: { query: 'info' },
                  result: 'Found relevant data.', // Result from the tool message
                },
              },
              { type: 'text', text: 'Here is the information I found.' }, // Text from the Vercel UIMessage
            ],
            toolInvocations: [
              {
                state: 'result', // State should be updated to result
                toolName: 'search-tool',
                toolCallId: 'call-mix-1',
                args: { query: 'info' },
                result: 'Found relevant data.', // Result from the tool message
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly handle an assistant message with interleaved text, tool call, and tool result', () => {
      const userMsg = {
        role: 'user',
        content: 'Perform a task.',
      } satisfies VercelCoreMessage;

      const assistantMsgWithToolCall = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Okay, I will perform the task.' },
          { type: 'tool-call', toolName: 'task-tool', toolCallId: 'call-task-1', args: { task: 'perform' } },
        ],
      } satisfies VercelCoreMessage;

      const toolResultMsg = {
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolName: 'task-tool',
            toolCallId: 'call-task-1',
            result: 'Task completed successfully.',
          },
        ],
      } satisfies VercelCoreMessage;

      const assistantMsgWithFinalText = {
        role: 'assistant',
        content: 'The task is now complete.',
      } satisfies VercelCoreMessage;

      const messageSequence = [userMsg, assistantMsgWithToolCall, toolResultMsg, assistantMsgWithFinalText];

      const list = new MessageList({ threadId, resourceId }).add(messageSequence, 'response');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'user',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            content: userMsg.content,
            parts: [{ type: 'step-start' }, { type: 'text', text: userMsg.content }],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
        {
          id: expect.any(String), // Should be the ID of the first assistant message in the sequence
          role: 'assistant',
          createdAt: expect.any(Date), // Should be the timestamp of the last message in the sequence
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Okay, I will perform the task.' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolName: 'task-tool',
                  toolCallId: 'call-task-1',
                  args: { task: 'perform' },
                  result: 'Task completed successfully.',
                },
              },
              { type: 'step-start' },
              { type: 'text', text: 'The task is now complete.' },
            ],
            toolInvocations: [
              {
                state: 'result',
                toolName: 'task-tool',
                toolCallId: 'call-task-1',
                args: { task: 'perform' },
                result: 'Task completed successfully.',
              },
            ],
            content: 'The task is now complete.',
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly convert and add a Vercel CoreMessage with text and a data URL file part', () => {
      const inputCoreMessage = {
        role: 'user',
        content: [
          { type: 'text', text: 'Here is an embedded image:' },
          {
            type: 'file',
            mimeType: 'image/gif',
            data: new URL('data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=='),
          },
        ],
      } satisfies VercelCoreMessage;

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'user');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'user',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Here is an embedded image:' },
              {
                type: 'file',
                mimeType: 'image/gif',
                data: 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==',
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly handle an assistant message with reasoning and tool calls', () => {
      const inputCoreMessage = {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'First, I need to gather some data.', signature: 'sig-gather' },
          { type: 'text', text: 'Gathering data...' },
          { type: 'tool-call', toolName: 'data-tool', toolCallId: 'call-data-1', args: { query: 'required data' } },
          { type: 'reasoning', text: 'Data gathered, now I will process it.', signature: 'sig-process' },
        ],
      } satisfies VercelCoreMessage;

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'memory');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              {
                type: 'reasoning',
                reasoning: '',
                details: [{ type: 'text', text: 'First, I need to gather some data.', signature: 'sig-gather' }],
              },
              { type: 'text', text: 'Gathering data...' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'call',
                  toolName: 'data-tool',
                  toolCallId: 'call-data-1',
                  args: { query: 'required data' },
                },
              },
              {
                type: 'reasoning',
                reasoning: '',
                details: [{ type: 'text', text: 'Data gathered, now I will process it.', signature: 'sig-process' }],
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly handle an assistant message with multiple interleaved tool calls and results', () => {
      const userMsg = {
        role: 'user',
        content: 'What is the weather in London and Paris?',
      } satisfies VercelCoreMessage;

      const assistantMsgWithCalls = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Okay, I will check the weather for both cities.' },
          { type: 'tool-call', toolName: 'weather-tool', toolCallId: 'call-london', args: { city: 'London' } },
          { type: 'text', text: 'And now for Paris.' },
          { type: 'tool-call', toolName: 'weather-tool', toolCallId: 'call-paris', args: { city: 'Paris' } },
        ],
      } satisfies VercelCoreMessage;

      const toolResultLondon = {
        role: 'tool',
        content: [{ type: 'tool-result', toolName: 'weather-tool', toolCallId: 'call-london', result: '20°C, sunny' }],
      } satisfies VercelCoreMessage;

      const toolResultParis = {
        role: 'tool',
        content: [{ type: 'tool-result', toolName: 'weather-tool', toolCallId: 'call-paris', result: '15°C, cloudy' }],
      } satisfies VercelCoreMessage;

      const assistantMsgWithFinalText = {
        role: 'assistant',
        content: "The weather in London is 20°C and sunny, and in Paris it's 15°C and cloudy.",
      } satisfies VercelCoreMessage;

      const messageSequence = [
        userMsg,
        assistantMsgWithCalls,
        toolResultLondon,
        toolResultParis,
        assistantMsgWithFinalText,
      ];

      const list = new MessageList({ threadId, resourceId }).add(messageSequence, 'response');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'user',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            content: userMsg.content,
            parts: [{ type: 'step-start' }, { type: 'text', text: userMsg.content }],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
        {
          id: expect.any(String), // Should be the ID of the first assistant message in the sequence
          role: 'assistant',
          createdAt: expect.any(Date), // Should be the timestamp of the last message in the sequence
          content: {
            format: 2,
            content: "The weather in London is 20°C and sunny, and in Paris it's 15°C and cloudy.",
            parts: [
              { type: 'text', text: 'Okay, I will check the weather for both cities.' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolName: 'weather-tool',
                  toolCallId: 'call-london',
                  args: { city: 'London' },
                  result: '20°C, sunny',
                },
              },
              { type: 'text', text: 'And now for Paris.' },
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolName: 'weather-tool',
                  toolCallId: 'call-paris',
                  args: { city: 'Paris' },
                  result: '15°C, cloudy',
                },
              },
              { type: 'step-start' },
              { type: 'text', text: "The weather in London is 20°C and sunny, and in Paris it's 15°C and cloudy." },
            ],
            toolInvocations: [
              {
                state: 'result',
                toolName: 'weather-tool',
                toolCallId: 'call-london',
                args: { city: 'London' },
                result: '20°C, sunny',
              },
              {
                state: 'result',
                toolName: 'weather-tool',
                toolCallId: 'call-paris',
                args: { city: 'Paris' },
                result: '15°C, cloudy',
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('should correctly handle an assistant message with only reasoning parts', () => {
      const inputCoreMessage = {
        role: 'assistant',
        content: [
          { type: 'reasoning', text: 'Thinking step 1...', signature: 'sig-1' },
          { type: 'redacted-reasoning', data: 'some hidden data' },
          { type: 'reasoning', text: 'Final thought.', signature: 'sig-2' },
        ],
      } satisfies VercelCoreMessage;

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'memory');

      expect(list.get.all.v2()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              {
                type: 'reasoning',
                reasoning: '',
                details: [{ type: 'text', text: 'Thinking step 1...', signature: 'sig-1' }],
              },
              { type: 'reasoning', reasoning: '', details: [{ type: 'redacted', data: 'some hidden data' }] },
              {
                type: 'reasoning',
                reasoning: '',
                details: [{ type: 'text', text: 'Final thought.', signature: 'sig-2' }],
              },
            ],
          },
          threadId,
          resourceId,
        } satisfies MastraMessageV2,
      ]);
    });

    it('works with a copy/pasted conversation from useChat input messages', () => {
      const history = (
        [
          {
            id: 'c59c844b-0f1a-409a-995e-3382a3ee1eaa',
            content: 'hi',
            role: 'user' as const,
            type: 'text',
            createdAt: '2025-03-25T20:29:58.103Z',
            threadId: '68',
          },
          {
            id: '7bb920f1-1a89-4f1a-8fb0-6befff982946',
            content: [
              {
                type: 'text',
                text: 'Hello! How can I assist you today?',
              },
            ],
            role: 'assistant',
            type: 'text',
            createdAt: '2025-03-25T20:29:58.717Z',
            threadId: '68',
          },
          {
            id: '673b1279-9ce5-428e-a646-d19d83ed4d67',
            content: 'LA',
            role: 'user' as const,
            type: 'text',
            createdAt: '2025-03-25T20:30:01.911Z',
            threadId: '68',
          },
          {
            id: '6a903ed0-1cf4-463d-8ea0-c13bd0896405',
            content: [
              {
                type: 'tool-call',
                toolCallId: 'call_fziykqCGOygt5QGj6xVnkQaE',
                toolName: 'updateWorkingMemory',
                args: {
                  memory: '<user><location>LA</location></user>',
                },
              },
            ],
            role: 'assistant',
            type: 'tool-call',
            createdAt: '2025-03-25T20:30:02.175Z',
            threadId: '68',
          },
          {
            id: 'c27b7dbe-ce80-41f5-9eb3-33a668238a1b',
            content: [
              {
                type: 'tool-result',
                toolCallId: 'call_fziykqCGOygt5QGj6xVnkQaE',
                toolName: 'updateWorkingMemory',
                result: {
                  success: true,
                },
              },
            ],
            role: 'tool',
            type: 'tool-result',
            createdAt: '2025-03-25T20:30:02.176Z',
            threadId: '68',
          },
          {
            id: 'd1fc1d8e-2aca-47a8-8239-0bb761d63fd6',
            content: [
              {
                type: 'text',
                text: "Got it! You're in LA. What would you like to talk about or do today?",
              },
            ],
            role: 'assistant',
            type: 'text',
            createdAt: '2025-03-25T20:30:02.177Z',
            threadId: '68',
          },
          {
            id: '1b271c02-7762-4416-91e9-146a25ce9c73',
            content: [
              {
                type: 'text',
                text: 'Hello',
              },
            ],
            role: 'user' as const,
            type: 'text',
            createdAt: '2025-05-13T22:23:26.584Z',
            threadId: '68',
          },
          {
            id: 'msg-Cpo828mGmAc8dhWwQcD32Net',
            content: [
              {
                type: 'text',
                text: 'Hello again! How can I help you today?',
              },
            ],
            role: 'assistant',
            type: 'text',
            createdAt: '2025-05-13T22:23:26.585Z',
            threadId: '68',
          },
          {
            id: 'eab9da82-6120-4630-b60e-0a7cb86b0718',
            content: [
              {
                type: 'text',
                text: 'Hi',
              },
            ],
            role: 'user' as const,
            type: 'text',
            createdAt: '2025-05-13T22:24:51.608Z',
            threadId: '68',
          },
          {
            id: 'msg-JpZvGeyqVaUo1wthbXf0EVSS',
            content: [
              {
                type: 'text',
                text: "Hi there! What's on your mind?",
              },
            ],
            role: 'assistant',
            type: 'text',
            createdAt: '2025-05-13T22:24:51.609Z',
            threadId: '68',
          },
          {
            role: 'user' as const,
            content: [
              {
                type: 'text',
                text: 'hello',
              },
            ],
          },
        ] as const
      ).map(m => ({
        ...m,
        createdAt: `createdAt` in m && m.createdAt ? new Date(m.createdAt) : new Date(),
      })) as MastraMessageV1[];

      const list = new MessageList({ threadId: '68' }).add(history, 'response');

      const uiMessages = list.get.all.ui();

      expect(uiMessages.length).toBe(9);
      const expectedMessages = [
        {
          id: 'c59c844b-0f1a-409a-995e-3382a3ee1eaa',
          role: 'user',
          content: 'hi',
          createdAt: expect.any(Date),
          parts: [{ type: 'step-start' }, { type: 'text', text: 'hi' }],
          experimental_attachments: [],
        },
        {
          id: '7bb920f1-1a89-4f1a-8fb0-6befff982946',
          role: 'assistant',
          content: 'Hello! How can I assist you today?',
          createdAt: expect.any(Date),
          parts: [{ type: 'text', text: 'Hello! How can I assist you today?' }],
          reasoning: undefined,
          toolInvocations: undefined,
        },
        {
          id: '673b1279-9ce5-428e-a646-d19d83ed4d67',
          role: 'user',
          content: 'LA',
          createdAt: expect.any(Date),
          parts: [{ type: 'step-start' }, { type: 'text', text: 'LA' }],
          experimental_attachments: [],
        },
        {
          id: '6a903ed0-1cf4-463d-8ea0-c13bd0896405',
          role: 'assistant',
          content: "Got it! You're in LA. What would you like to talk about or do today?",
          createdAt: expect.any(Date),
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call_fziykqCGOygt5QGj6xVnkQaE',
                toolName: 'updateWorkingMemory',
                args: { memory: '<user><location>LA</location></user>' },
                result: { success: true },
              },
            },
            {
              type: 'text',
              text: "Got it! You're in LA. What would you like to talk about or do today?",
            },
          ],
          reasoning: undefined,
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call_fziykqCGOygt5QGj6xVnkQaE',
              toolName: 'updateWorkingMemory',
              args: { memory: '<user><location>LA</location></user>' },
              result: { success: true },
            },
          ],
        },
        {
          id: '1b271c02-7762-4416-91e9-146a25ce9c73',
          role: 'user',
          content: 'Hello',
          createdAt: expect.any(Date),
          parts: [{ type: 'text', text: 'Hello' }],
          experimental_attachments: [],
        },
        {
          id: 'msg-Cpo828mGmAc8dhWwQcD32Net',
          role: 'assistant',
          content: 'Hello again! How can I help you today?',
          createdAt: expect.any(Date),
          parts: [{ type: 'text', text: 'Hello again! How can I help you today?' }],
          reasoning: undefined,
          toolInvocations: undefined,
        },
        {
          id: 'eab9da82-6120-4630-b60e-0a7cb86b0718',
          role: 'user',
          content: 'Hi',
          createdAt: expect.any(Date),
          parts: [{ type: 'text', text: 'Hi' }],
          experimental_attachments: [],
        },
        {
          id: 'msg-JpZvGeyqVaUo1wthbXf0EVSS',
          role: 'assistant',
          content: "Hi there! What's on your mind?",
          createdAt: expect.any(Date),
          parts: [{ type: 'text', text: "Hi there! What's on your mind?" }],
          reasoning: undefined,
          toolInvocations: undefined,
        },
        {
          id: expect.any(String), // The last message doesn't have an ID in the input, so MessageList generates one
          role: 'user',
          content: 'hello',
          createdAt: expect.any(Date), // MessageList generates createdAt for messages without one
          parts: [{ type: 'text', text: 'hello' }],
          experimental_attachments: [],
        },
      ];
      expect(uiMessages).toEqual(expectedMessages);

      let newId = randomUUID();
      const responseMessages = [
        {
          id: newId,
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: 'As a large language model...' }],
        },
      ];
      let newUIMessages = appendResponseMessages({
        messages: uiMessages,
        responseMessages,
      });

      expect(newUIMessages.length).toBe(uiMessages.length + 1);
      const newUIMessages2 = list.add(responseMessages, 'response').get.all.ui();
      expect(newUIMessages2).toEqual([
        ...uiMessages,
        {
          role: 'assistant',
          id: newId,
          content: 'As a large language model...',
          createdAt: expect.any(Date),
          parts: [{ type: 'text', text: 'As a large language model...' }],
          reasoning: undefined,
          toolInvocations: undefined,
        } satisfies UIMessage,
      ]);

      const newClientMessage = {
        id: randomUUID(),
        role: 'user',
        createdAt: new Date(),
        content: 'Do it anyway please',
        experimental_attachments: [],
        parts: [{ type: 'step-start' }, { type: 'text', text: 'Do it anyway please' }],
      } satisfies Message;

      const newUIMessages3 = appendClientMessage({
        messages: newUIMessages2,
        message: newClientMessage,
      });

      expect(newUIMessages3.length).toBe(newUIMessages2.length + 1);
      const newUIMessages4 = list.add(newClientMessage, 'user').get.all.ui();
      expect(newUIMessages4.map(m => ({ ...m, createdAt: expect.any(Date) }))).toEqual(
        newUIMessages3.map(m => ({ ...m, createdAt: expect.any(Date) })),
      );

      const responseMessages2 = [
        { id: randomUUID(), role: 'assistant', content: "Ok fine I'll call a tool then" },
        {
          id: randomUUID(),
          role: 'assistant',
          content: [{ type: 'tool-call', args: { ok: 'fine' }, toolCallId: 'ok-fine-1', toolName: 'okFineTool' }],
        },
        {
          id: randomUUID(),
          role: 'tool',
          content: [{ type: 'tool-result', toolName: 'okFineTool', toolCallId: 'ok-fine-1', result: { lets: 'go' } }],
        },
      ];
      const newUIMessages5 = appendResponseMessages({
        messages: newUIMessages3,
        // @ts-ignore
        responseMessages: responseMessages2,
      });

      expect(list.add(newUIMessages5, 'response').get.all.ui()).toEqual([
        ...newUIMessages4.map(m => ({ ...m, createdAt: expect.any(Date) })),
        {
          role: 'assistant',
          content: "Ok fine I'll call a tool then",
          id: expect.any(String),
          createdAt: expect.any(Date),
          parts: [
            { type: 'step-start' },
            { type: 'text', text: "Ok fine I'll call a tool then" },
            { type: 'step-start' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                result: { lets: 'go' },
                toolCallId: 'ok-fine-1',
                toolName: 'okFineTool',
                args: { ok: 'fine' },
                state: 'result',
                step: 1,
              },
            },
          ],
          reasoning: undefined,
          toolInvocations: [
            {
              result: { lets: 'go' },
              toolCallId: 'ok-fine-1',
              toolName: 'okFineTool',
              args: { ok: 'fine' },
              state: 'result',
              step: 1,
            },
          ],
        } satisfies Message,
      ]);
    });

    describe('system messages', () => {
      it('should add and retrieve a single system message', () => {
        const list = new MessageList({ threadId, resourceId });
        const systemMsgContent = 'This is a system directive.';
        list.add({ role: 'system', content: systemMsgContent }, 'system');

        const systemMessages = list.getSystemMessages();
        expect(systemMessages.length).toBe(1);
        expect(systemMessages[0]?.role).toBe('system');
        expect(systemMessages[0]?.content).toBe(systemMsgContent);

        expect(list.get.all.v2().length).toBe(0); // Should not be in MastraMessageV2 list
        expect(list.get.all.ui().length).toBe(0); // Should not be in UI messages
      });

      it('should not add duplicate system messages based on content', () => {
        const list = new MessageList({ threadId, resourceId });
        const systemMsgContent = 'This is a unique system directive.';
        list.add({ role: 'system', content: systemMsgContent }, 'system');
        list.add({ role: 'system', content: systemMsgContent }, 'system'); // Add duplicate

        const systemMessages = list.getSystemMessages();
        expect(systemMessages.length).toBe(1); // Still only one
        expect(systemMessages[0]?.content).toBe(systemMsgContent);
      });

      it('should add and retrieve multiple unique system messages', () => {
        const list = new MessageList({ threadId, resourceId });
        const systemMsgContent1 = 'Directive one.';
        const systemMsgContent2 = 'Directive two.';
        list.add({ role: 'system', content: systemMsgContent1 }, 'system');
        list.add({ role: 'system', content: systemMsgContent2 }, 'system');

        const systemMessages = list.getSystemMessages();
        expect(systemMessages.length).toBe(2);
        expect(systemMessages.find(m => m.content === systemMsgContent1)).toBeDefined();
        expect(systemMessages.find(m => m.content === systemMsgContent2)).toBeDefined();
      });

      it('should handle system messages added amidst other messages', () => {
        const list = new MessageList({ threadId, resourceId });
        list.add({ role: 'user', content: 'Hello' }, 'user');
        list.add({ role: 'system', content: 'System setup complete.' }, 'system');
        list.add({ role: 'assistant', content: 'Hi there!' }, 'response');
        list.add({ role: 'system', content: 'Another system note.' }, 'system');

        const systemMessages = list.getSystemMessages();
        expect(systemMessages.length).toBe(2);
        expect(systemMessages.find(m => m.content === 'System setup complete.')).toBeDefined();
        expect(systemMessages.find(m => m.content === 'Another system note.')).toBeDefined();

        expect(list.get.all.v2().length).toBe(2); // user and assistant
        expect(list.get.all.ui().length).toBe(2); // user and assistant
      });
    });
    it('handles upgrading from tool-invocation (call) to [step-start, tool-invocation (result)]', () => {
      const latestMessage = {
        id: 'msg-toolcall',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call-xyz', toolName: 'foo', args: {} },
            },
          ],
        },
        threadId,
        resourceId,
      } satisfies MastraMessageV2;

      const messageV2 = {
        ...latestMessage,
        content: {
          ...latestMessage.content,
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'result', toolCallId: 'call-xyz', toolName: 'foo', args: {}, result: 123 },
            },
          ],
        },
      } satisfies MastraMessageV2;

      const list = new MessageList({ threadId, resourceId });
      list.add(latestMessage, 'memory');
      list.add(messageV2, 'response');

      expect(list.get.all.v2()[0].content.parts).toEqual([
        { type: 'step-start' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call-xyz', toolName: 'foo', args: {}, result: 123 },
        },
      ]);
    });
    it('merges tool-invocation upgrade and prepends missing step-start/text', () => {
      const latestMessage = {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call-1', toolName: 'foo', args: {} },
            },
          ],
        },
        threadId,
        resourceId,
      } satisfies MastraMessageV2;

      const messageV2 = {
        ...latestMessage,
        content: {
          ...latestMessage.content,
          parts: [
            { type: 'step-start' },
            { type: 'text', text: 'Let me do this.' },
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'foo', args: {}, result: 42 },
            },
          ],
        },
      } satisfies MastraMessageV2;

      const list = new MessageList({ threadId, resourceId });
      list.add(latestMessage, 'memory');
      list.add(messageV2, 'response');

      expect(list.get.all.v2()[0].content.parts).toEqual([
        { type: 'step-start' },
        { type: 'text', text: 'Let me do this.' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call-1', toolName: 'foo', args: {}, result: 42 },
        },
      ]);
    });
    it('inserts step-start and upgrades tool-invocation', () => {
      const latestMessage = {
        id: 'msg-2',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'text', text: 'Doing it.' },
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call-2', toolName: 'bar', args: {} },
            },
          ],
        },
        threadId,
        resourceId,
      } satisfies MastraMessageV2;

      const messageV2 = {
        ...latestMessage,
        content: {
          ...latestMessage.content,
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'result', toolCallId: 'call-2', toolName: 'bar', args: {}, result: 100 },
            },
          ],
        },
      } satisfies MastraMessageV2;

      const list = new MessageList({ threadId, resourceId });
      list.add(latestMessage, 'memory');
      list.add(messageV2, 'response');

      expect(list.get.all.v2()[0].content.parts).toEqual([
        { type: 'step-start' },
        { type: 'text', text: 'Doing it.' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call-2', toolName: 'bar', args: {}, result: 100 },
        },
      ]);
    });
    it('upgrades only matching tool-invocation and preserves order', () => {
      const latestMessage = {
        id: 'msg-3',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'step-start' },
            { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId: 'A', toolName: 'foo', args: {} } },
            { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId: 'B', toolName: 'bar', args: {} } },
          ],
        },
        threadId,
        resourceId,
      } satisfies MastraMessageV2;

      const messageV2 = {
        ...latestMessage,
        content: {
          ...latestMessage.content,
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'result', toolCallId: 'B', toolName: 'bar', args: {}, result: 7 },
            },
            { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId: 'A', toolName: 'foo', args: {} } },
          ],
        },
      } satisfies MastraMessageV2;

      const list = new MessageList({ threadId, resourceId });
      list.add(latestMessage, 'memory');
      list.add(messageV2, 'response');

      expect(list.get.all.v2()[0].content.parts).toEqual([
        { type: 'step-start' },
        { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId: 'A', toolName: 'foo', args: {} } },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'B', toolName: 'bar', args: {}, result: 7 },
        },
      ]);
    });
    it('drops text not present in new canonical message', () => {
      const latestMessage = {
        id: 'msg-4',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'step-start' },
            { type: 'text', text: 'Old reasoning' },
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call-4', toolName: 'baz', args: {} },
            },
          ],
        },
        threadId,
        resourceId,
      } satisfies MastraMessageV2;

      const messageV2 = {
        ...latestMessage,
        content: {
          ...latestMessage.content,
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'result', toolCallId: 'call-4', toolName: 'baz', args: {}, result: 5 },
            },
          ],
        },
      } satisfies MastraMessageV2;

      const list = new MessageList({ threadId, resourceId });
      list.add(latestMessage, 'memory');
      list.add(messageV2, 'response');

      expect(list.get.all.v2()[0].content.parts).toEqual([
        { type: 'step-start' },
        { type: 'text', text: 'Old reasoning' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call-4', toolName: 'baz', args: {}, result: 5 },
        },
      ]);
    });
    it('merges incremental streaming updates step by step', () => {
      const base = {
        id: 'msg-5',
        role: 'assistant',
        createdAt: new Date(),
        content: { format: 2, parts: [], toolInvocations: [] },
        threadId,
        resourceId,
      } satisfies MastraMessageV2;

      // Step 1: Only text
      let list = new MessageList({ threadId, resourceId });
      let msg1 = {
        ...base,
        content: { ...base.content, parts: [{ type: 'step-start' }, { type: 'text', text: 'First...' }] },
      } satisfies MastraMessageV2;
      list.add(msg1, 'memory');
      expect(list.get.all.v2()[0].content.parts).toEqual([{ type: 'step-start' }, { type: 'text', text: 'First...' }]);

      // Step 2: Add tool-invocation (call)
      let msg2 = {
        ...base,
        content: {
          ...base.content,
          parts: [
            { type: 'step-start' },
            { type: 'text', text: 'First...' },
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'call', toolCallId: 'call-5', toolName: 'foo', args: {} },
            },
          ],
        },
      } satisfies MastraMessageV2;
      list.add(msg2, 'memory');
      expect(list.get.all.v2()[0].content.parts).toEqual([
        { type: 'step-start' },
        { type: 'text', text: 'First...' },
        { type: 'tool-invocation', toolInvocation: { state: 'call', toolCallId: 'call-5', toolName: 'foo', args: {} } },
      ]);

      // Step 3: Upgrade tool-invocation to result
      let msg3 = {
        ...base,
        content: {
          ...base.content,
          parts: [
            { type: 'step-start' },
            { type: 'text', text: 'First...' },
            {
              type: 'tool-invocation',
              toolInvocation: { state: 'result', toolCallId: 'call-5', toolName: 'foo', args: {}, result: 123 },
            },
          ],
        },
      } satisfies MastraMessageV2;
      list.add(msg3, 'response');
      expect(list.get.all.v2()[0].content.parts).toEqual([
        { type: 'step-start' },
        { type: 'text', text: 'First...' },
        {
          type: 'tool-invocation',
          toolInvocation: { state: 'result', toolCallId: 'call-5', toolName: 'foo', args: {}, result: 123 },
        },
      ]);
    });
  });

  describe('core message sanitization', () => {
    it('should remove an orphaned tool-call part from an assistant message if no result is provided', () => {
      const list = new MessageList({ threadId, resourceId });
      const userMessage: CoreMessage = { role: 'user', content: 'Call a tool' };
      const assistantMessageWithOrphanedCall: CoreMessage = {
        role: 'assistant',
        content: [
          { type: 'text', text: 'Okay' },
          { type: 'tool-call', toolCallId: 'orphan-call-1', toolName: 'test-tool', args: {} },
        ],
      };

      list.add(userMessage, 'user');
      list.add(assistantMessageWithOrphanedCall, 'response');

      const coreMessages = list.get.all.core();

      expect(coreMessages.length).toBe(2);
      const assistantMsg = coreMessages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();
      expect(assistantMsg?.content).toEqual([{ type: 'text', text: 'Okay' }]); // Should only have the text part
    });

    it('should handle an assistant message with mixed valid and orphaned tool calls', () => {
      const list = new MessageList({ threadId, resourceId });
      const assistantMessage: CoreMessage = {
        role: 'assistant',
        content: [
          { type: 'tool-call', toolCallId: 'valid-1', toolName: 'tool-a', args: {} },
          { type: 'text', text: 'Some text in between' },
          { type: 'tool-call', toolCallId: 'orphan-3', toolName: 'tool-b', args: {} },
        ],
      };
      const toolMessageResult: CoreMessage = {
        role: 'tool',
        content: [{ type: 'tool-result', toolCallId: 'valid-1', toolName: 'tool-a', result: 'Result for valid-1' }],
      };

      list.add(assistantMessage, 'response');
      list.add(toolMessageResult, 'response');

      const coreMessages = list.get.all.core();
      expect(coreMessages.length).toBe(3); // Assistant message and Tool message for valid-1

      const finalAssistantMsg = [...coreMessages].reverse().find(m => m.role === 'assistant');
      expect(finalAssistantMsg).toBeDefined();
      expect(finalAssistantMsg?.content).toEqual([{ type: 'text', text: 'Some text in between' }]);

      const finalToolMsg = coreMessages.find(m => m.role === 'tool');
      expect(finalToolMsg).toBeDefined();
      expect(finalToolMsg?.content).toEqual([
        { type: 'tool-result', toolCallId: 'valid-1', toolName: 'tool-a', result: 'Result for valid-1' },
      ]);
    });
  });

  describe('JSON content parsing regression', () => {
    it('should handle the exact bug scenario: user calls JSON.stringify but content stays as string', () => {
      const list = new MessageList({ threadId: 'test', resourceId: 'test' });

      const inputData = {
        linkedinUrl: 'https://www.linkedin.com/in/ex/',
        enrichmentType: 'people',
      };

      const messageWithStringContent = {
        role: 'user' as const,
        content: JSON.stringify(inputData),
      };

      // This should work fine and the content should remain as a string
      expect(() => list.add(messageWithStringContent, 'user')).not.toThrow();

      // Verify the content remains as a JSON string (not parsed back to object)
      const messages = list.get.all.v2();
      expect(messages.length).toBe(1);
      expect(messages[0].content.content).toBe(JSON.stringify(inputData)); // Should stay as string
      expect(typeof messages[0].content.content).toBe('string'); // Should be a string, not an object
    });

    it('should not parse regular JSON string content back to objects', () => {
      const list = new MessageList({ threadId: 'test', resourceId: 'test' });

      // User sends a JSON string as content (valid use case)
      const messageWithJSONString = {
        role: 'user' as const,
        content: '{"data": "value", "number": 42}',
      };

      // This should work and the content should remain as a string
      expect(() => list.add(messageWithJSONString, 'user')).not.toThrow();

      // The content should stay as a string, not be parsed to an object
      const messages = list.get.all.v2();
      expect(messages[0].content.content).toBe('{"data": "value", "number": 42}'); // Should stay as string
      expect(typeof messages[0].content.content).toBe('string'); // Should be a string, not an object
      expect(messages[0].content.parts).toEqual([
        {
          type: 'step-start',
        },
        {
          type: 'text',
          text: '{"data": "value", "number": 42}',
        },
      ]);
    });
  });

  describe('toUIMessage filtering', () => {
    it('should filter out tool invocations with state="call" when converting to UIMessage', () => {
      const messageWithCallState: MastraMessageV2 = {
        id: 'msg-1',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'step-start' },
            { type: 'text', text: 'Let me check that for you.' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'call-1',
                toolName: 'getLuckyNumber',
                args: {},
              },
            },
          ],
          toolInvocations: [
            {
              state: 'call',
              toolCallId: 'call-1',
              toolName: 'getLuckyNumber',
              args: {},
            },
          ],
        },
        threadId: 'test-thread',
        resourceId: 'test-resource',
      };

      const list = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
      list.add(messageWithCallState, 'response');

      const uiMessages = list.get.all.ui();
      expect(uiMessages.length).toBe(1);

      const uiMessage = uiMessages[0];
      expect(uiMessage.role).toBe('assistant');
      expect(uiMessage.parts).toEqual([
        {
          type: 'step-start',
        },
        {
          type: 'text',
          text: 'Let me check that for you.',
        },
      ]);

      // Check that the tool invocation with state="call" is filtered out from parts
      const toolInvocationParts = uiMessage.parts.filter(p => p.type === 'tool-invocation');
      expect(toolInvocationParts.length).toBe(0);

      // Check that text and step-start parts are preserved
      expect(uiMessage.parts).toEqual([{ type: 'step-start' }, { type: 'text', text: 'Let me check that for you.' }]);

      // Check that toolInvocations array is also filtered
      expect(uiMessage.toolInvocations).toEqual([]);
    });

    it('should preserve tool invocations with state="result" when converting to UIMessage', () => {
      const messageWithResultState: MastraMessageV2 = {
        id: 'msg-2',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'step-start' },
            { type: 'text', text: 'Your lucky number is:' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-2',
                toolName: 'getLuckyNumber',
                args: {},
                result: 42,
              },
            },
          ],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call-2',
              toolName: 'getLuckyNumber',
              args: {},
              result: 42,
            },
          ],
        },
        threadId: 'test-thread',
        resourceId: 'test-resource',
      };

      const list = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
      list.add(messageWithResultState, 'response');

      const uiMessages = list.get.all.ui();
      expect(uiMessages.length).toBe(1);

      const uiMessage = uiMessages[0];
      expect(uiMessage.role).toBe('assistant');
      expect(uiMessage.parts).toEqual([
        {
          type: 'step-start',
        },
        {
          type: 'text',
          text: 'Your lucky number is:',
        },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-2',
            toolName: 'getLuckyNumber',
            args: {},
            result: 42,
          },
        },
      ]);

      // Check that the tool invocation with state="result" is preserved
      const toolInvocationParts = uiMessage.parts.filter(p => p.type === 'tool-invocation');
      expect(toolInvocationParts.length).toBe(1);
      expect(toolInvocationParts[0]).toEqual({
        type: 'tool-invocation',
        toolInvocation: {
          state: 'result',
          toolCallId: 'call-2',
          toolName: 'getLuckyNumber',
          args: {},
          result: 42,
        },
      });

      // Check that toolInvocations array also has the result
      expect(uiMessage.toolInvocations).toEqual([
        {
          state: 'result',
          toolCallId: 'call-2',
          toolName: 'getLuckyNumber',
          args: {},
          result: 42,
        },
      ]);
    });

    it('should filter out partial-call states and preserve only results', () => {
      const messageWithMixedStates: MastraMessageV2 = {
        id: 'msg-3',
        role: 'assistant',
        createdAt: new Date(),
        content: {
          format: 2,
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'partial-call',
                toolCallId: 'call-3',
                toolName: 'searchTool',
                args: { query: 'weather' },
              },
            },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-4',
                toolName: 'calculateTool',
                args: { x: 10, y: 20 },
                result: 30,
              },
            },
          ],
          toolInvocations: [
            {
              state: 'partial-call',
              toolCallId: 'call-3',
              toolName: 'searchTool',
              args: { query: 'weather' },
            },
            {
              state: 'result',
              toolCallId: 'call-4',
              toolName: 'calculateTool',
              args: { x: 10, y: 20 },
              result: 30,
            },
          ],
        },
        threadId: 'test-thread',
        resourceId: 'test-resource',
      };

      const list = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });
      list.add(messageWithMixedStates, 'response');

      const uiMessages = list.get.all.ui();
      const uiMessage = uiMessages[0];

      // Only the result state should be preserved
      const toolInvocationParts = uiMessage.parts.filter(p => p.type === 'tool-invocation');
      expect(toolInvocationParts.length).toBe(1);
      expect(toolInvocationParts[0].toolInvocation.state).toBe('result');
      expect(toolInvocationParts[0].toolInvocation.toolCallId).toBe('call-4');

      // toolInvocations array should also only have the result
      expect(uiMessage.toolInvocations).toHaveLength(1);
      expect(uiMessage.toolInvocations![0].state).toBe('result');
      expect(uiMessage.toolInvocations![0].toolCallId).toBe('call-4');
    });

    it('should handle clientTool scenario - filter call states when querying from memory', () => {
      // Simulate the scenario from GitHub issue #5016
      // Test that tool invocations with "call" state are filtered when converting to UI messages

      const list = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });

      // Assistant message with tool invocation in "call" state (as saved in DB)
      const assistantCallMessage: MastraMessageV2 = {
        id: 'msg-assistant-1',
        role: 'assistant',
        createdAt: new Date('2024-01-01T10:00:00'),
        content: {
          format: 2,
          parts: [
            { type: 'step-start' },
            { type: 'text', text: 'Let me get your lucky number.' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'call',
                toolCallId: 'call-lucky-1',
                toolName: 'getLuckyNumber',
                args: {},
              },
            },
          ],
          toolInvocations: [
            {
              state: 'call',
              toolCallId: 'call-lucky-1',
              toolName: 'getLuckyNumber',
              args: {},
            },
          ],
        },
        threadId: 'test-thread',
        resourceId: 'test-resource',
      };

      // Add message as if loaded from memory/database
      list.add(assistantCallMessage, 'memory');

      // When converting to UI messages (what the client sees)
      const uiMessages = list.get.all.ui();
      expect(uiMessages.length).toBe(1);

      const uiMessage = uiMessages[0];
      expect(uiMessage.role).toBe('assistant');
      expect(uiMessage.parts).toEqual([
        {
          type: 'step-start',
        },
        {
          type: 'text',
          text: 'Let me get your lucky number.',
        },
      ]);

      // Tool invocations with "call" state should be filtered out from parts
      const toolInvocationParts = uiMessage.parts.filter(p => p.type === 'tool-invocation');
      expect(toolInvocationParts.length).toBe(0); // Should be filtered out

      // Only text and step-start parts should remain
      expect(uiMessage.parts).toEqual([
        { type: 'step-start' },
        { type: 'text', text: 'Let me get your lucky number.' },
      ]);

      // toolInvocations array should be empty (filtered)
      expect(uiMessage.toolInvocations).toEqual([]);

      // Now test with a result state - should be preserved
      const assistantResultMessage: MastraMessageV2 = {
        id: 'msg-assistant-2',
        role: 'assistant',
        createdAt: new Date('2024-01-01T10:00:01'),
        content: {
          format: 2,
          parts: [
            { type: 'step-start' },
            { type: 'text', text: 'Your lucky number is:' },
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-lucky-2',
                toolName: 'getLuckyNumber',
                args: {},
                result: 42,
              },
            },
          ],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call-lucky-2',
              toolName: 'getLuckyNumber',
              args: {},
              result: 42,
            },
          ],
        },
        threadId: 'test-thread',
        resourceId: 'test-resource',
      };

      list.add(assistantResultMessage, 'memory');

      const uiMessages2 = list.get.all.ui();
      expect(uiMessages2.length).toBe(2);

      const uiMessageWithResult = uiMessages2[1];

      // Tool invocations with "result" state should be preserved
      const resultToolParts = uiMessageWithResult.parts.filter(p => p.type === 'tool-invocation');
      expect(resultToolParts.length).toBe(1);
      expect(resultToolParts[0].toolInvocation.state).toBe('result');
      if (resultToolParts[0].toolInvocation.state === `result`) {
        expect(resultToolParts[0].toolInvocation.result).toBe(42);
      }

      // toolInvocations array should have the result
      expect(uiMessageWithResult.toolInvocations).toHaveLength(1);
      expect(uiMessageWithResult.toolInvocations![0].state).toBe('result');
      if (uiMessageWithResult.toolInvocations![0].state === `result`) {
        expect(uiMessageWithResult.toolInvocations![0].result).toBe(42);
      }
    });
  });

  describe('MessageList metadata support', () => {
    describe('existing v2 metadata support', () => {
      it('should preserve metadata when adding MastraMessageV2', () => {
        const metadata = {
          customField: 'custom value',
          context: [{ type: 'project', content: '', displayName: 'Project', path: './' }],
          anotherField: { nested: 'data' },
        };

        const v2Message: MastraMessageV2 = {
          id: 'v2-msg-metadata',
          role: 'user',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Hello with metadata' }],
            metadata,
          },
          createdAt: new Date('2023-10-26T12:00:00.000Z'),
          threadId,
          resourceId,
        };

        const list = new MessageList({ threadId, resourceId }).add(v2Message, 'user');
        const messages = list.get.all.v2();

        expect(messages.length).toBe(1);
        expect(messages[0].content.metadata).toEqual(metadata);
      });

      it('should preserve metadata through message transformations', () => {
        const metadata = { preserved: true, data: 'test' };

        const v2Message: MastraMessageV2 = {
          id: 'v2-msg-transform',
          role: 'assistant',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Message with metadata' }],
            metadata,
          },
          createdAt: new Date(),
          threadId,
          resourceId,
        };

        const list = new MessageList({ threadId, resourceId }).add(v2Message, 'response');

        // Convert to UI and back to v2
        const uiMessages = list.get.all.ui();
        const newList = new MessageList({ threadId, resourceId }).add(uiMessages, 'response');
        const v2Messages = newList.get.all.v2();

        expect(v2Messages[0].content.metadata).toEqual(metadata);
      });
    });

    describe('UIMessage metadata extraction', () => {
      it('should preserve metadata field from UIMessage', () => {
        const metadata = {
          context: [{ type: 'project', content: '', displayName: 'Project', path: './' }],
          customField: 'custom value',
          anotherField: { nested: 'data' },
        };

        const uiMessage: UIMessageWithMetadata = {
          id: 'ui-msg-metadata',
          role: 'user' as const,
          content: 'hi',
          parts: [{ type: 'text' as const, text: 'hi' }],
          createdAt: new Date(),
          metadata,
        };

        const list = new MessageList({ threadId, resourceId }).add(uiMessage, 'user');
        const v2Messages = list.get.all.v2();

        expect(v2Messages.length).toBe(1);
        expect(v2Messages[0].content.metadata).toEqual(metadata);
      });

      it('should ignore non-metadata custom fields on UIMessage', () => {
        const uiMessage = {
          id: 'ui-msg-custom',
          role: 'user' as const,
          content: 'hi',
          parts: [{ type: 'text' as const, text: 'hi' }],
          createdAt: new Date(),
          // These should be ignored
          context: 'ignored',
          customField: 'ignored',
          // This should be preserved
          metadata: { preserved: true },
        } as UIMessageWithMetadata & { context: string; customField: string };

        const list = new MessageList({ threadId, resourceId }).add(uiMessage, 'user');
        const v2Messages = list.get.all.v2();

        expect(v2Messages.length).toBe(1);
        expect(v2Messages[0].content.metadata).toEqual({ preserved: true });
        // Verify custom fields were not copied to metadata
        expect(v2Messages[0].content.metadata).not.toHaveProperty('context');
        expect(v2Messages[0].content.metadata).not.toHaveProperty('customField');
      });

      it('should handle UIMessage with no metadata field', () => {
        const uiMessage = {
          id: 'ui-msg-no-metadata',
          role: 'user' as const,
          content: 'hi',
          parts: [{ type: 'text' as const, text: 'hi' }],
          createdAt: new Date(),
        };

        const list = new MessageList({ threadId, resourceId }).add(uiMessage, 'user');
        const v2Messages = list.get.all.v2();

        expect(v2Messages.length).toBe(1);
        expect(v2Messages[0].content.metadata).toBeUndefined();
      });

      it('should handle UIMessage with empty metadata object', () => {
        const uiMessage: UIMessageWithMetadata = {
          id: 'ui-msg-empty-metadata',
          role: 'user' as const,
          content: 'hi',
          parts: [{ type: 'text' as const, text: 'hi' }],
          createdAt: new Date(),
          metadata: {},
        };

        const list = new MessageList({ threadId, resourceId }).add(uiMessage, 'user');
        const v2Messages = list.get.all.v2();

        expect(v2Messages.length).toBe(1);
        expect(v2Messages[0].content.metadata).toEqual({});
      });

      it('should handle UIMessage with null/undefined metadata', () => {
        const uiMessageNull: UIMessageWithMetadata = {
          id: 'ui-msg-null-metadata',
          role: 'user' as const,
          content: 'hi',
          parts: [{ type: 'text' as const, text: 'hi' }],
          createdAt: new Date(),
          metadata: null as any, // null is technically not allowed by the type, but we're testing the edge case
        };

        const uiMessageUndefined: UIMessageWithMetadata = {
          id: 'ui-msg-undefined-metadata',
          role: 'user' as const,
          content: 'hi',
          parts: [{ type: 'text' as const, text: 'hi' }],
          createdAt: new Date(),
          metadata: undefined,
        };

        const list1 = new MessageList({ threadId, resourceId }).add(uiMessageNull, 'user');
        const list2 = new MessageList({ threadId, resourceId }).add(uiMessageUndefined, 'user');

        expect(list1.get.all.v2()[0].content.metadata).toBeUndefined();
        expect(list2.get.all.v2()[0].content.metadata).toBeUndefined();
      });

      it('should preserve metadata for assistant UIMessage with tool invocations', () => {
        const metadata = { assistantContext: 'processing', step: 1 };

        const uiMessage: UIMessageWithMetadata = {
          id: 'ui-assistant-metadata',
          role: 'assistant' as const,
          content: 'Processing your request',
          createdAt: new Date(),
          parts: [{ type: 'text' as const, text: 'Processing your request' }],
          toolInvocations: [],
          metadata,
        };

        const list = new MessageList({ threadId, resourceId }).add(uiMessage, 'response');
        const v2Messages = list.get.all.v2();

        expect(v2Messages.length).toBe(1);
        expect(v2Messages[0].content.metadata).toEqual(metadata);
      });
    });

    describe('end-to-end metadata flow', () => {
      it('should preserve metadata through a complete message flow simulation', () => {
        // Simulate what happens in agent.stream/generate
        const userMetadata = {
          context: [{ type: 'project', content: '', displayName: 'Project', path: './' }],
          sessionId: '12345',
          customData: { priority: 'high' },
        };

        // 1. User sends message with metadata
        const userMessage: UIMessageWithMetadata = {
          id: 'user-msg-flow',
          role: 'user' as const,
          content: 'hi',
          parts: [{ type: 'text' as const, text: 'hi' }],
          createdAt: new Date(),
          metadata: userMetadata,
        };

        const list = new MessageList({ threadId, resourceId });

        // Add user message (like what happens in agent.__primitive)
        list.add(userMessage, 'user');

        // Simulate assistant response
        const assistantResponse = {
          role: 'assistant' as const,
          content: 'Hello! How can I help you?',
        } satisfies CoreMessage;

        list.add(assistantResponse, 'response');

        // Get final messages (what would be saved to memory)
        const v2Messages = list.get.all.v2();

        // Verify user message metadata is preserved
        const savedUserMessage = v2Messages.find(m => m.id === 'user-msg-flow');
        expect(savedUserMessage).toBeDefined();
        expect(savedUserMessage?.content.metadata).toEqual(userMetadata);

        // Convert back to UI messages (for client display)
        const uiMessages = list.get.all.ui();
        const uiUserMessage = uiMessages.find(m => m.id === 'user-msg-flow') as UIMessageWithMetadata | undefined;
        expect(uiUserMessage).toBeDefined();
        expect(uiUserMessage?.metadata).toEqual(userMetadata);
      });

      it('should handle metadata from onlook.dev use case', () => {
        // This is what onlook.dev would send after migration
        const onlookMessage: UIMessageWithMetadata = {
          id: '586b71b9-1a84-421e-b931-3ff40a06728f',
          role: 'user' as const,
          content: 'hi',
          createdAt: new Date('2025-07-25T16:46:38.580Z'),
          parts: [{ type: 'text' as const, text: 'hi' }],
          metadata: {
            context: [
              {
                type: 'project',
                content: '',
                displayName: 'Project',
                path: './',
              },
            ],
            snapshots: [],
          },
        };

        const list = new MessageList({ threadId: 'onlook-thread', resourceId: 'onlook-project' });
        list.add(onlookMessage, 'user');

        // Verify it's saved correctly as v2
        const v2Messages = list.get.all.v2();
        expect(v2Messages[0].content.metadata).toEqual(onlookMessage.metadata);

        // Verify it roundtrips back to UI format
        const uiMessages = list.get.all.ui();
        expect((uiMessages[0] as UIMessageWithMetadata).metadata).toEqual(onlookMessage.metadata);
      });
    });
  });

  describe('Memory integration', () => {
    it('should preserve metadata when messages are saved and retrieved from memory', async () => {
      // Create a message list with thread/resource info (simulating memory context)
      const messageList = new MessageList({ threadId: 'test-thread', resourceId: 'test-resource' });

      // Add messages with metadata
      const messagesWithMetadata: UIMessageWithMetadata[] = [
        {
          id: 'msg1',
          role: 'user',
          content: 'Hello with metadata',
          parts: [{ type: 'text', text: 'Hello with metadata' }],
          metadata: {
            source: 'web-ui',
            timestamp: 1234567890,
            customField: 'custom-value',
          },
        },
        {
          id: 'msg2',
          role: 'assistant',
          content: 'Response with metadata',
          parts: [{ type: 'text', text: 'Response with metadata' }],
          metadata: {
            model: 'gpt-4',
            processingTime: 250,
            tokens: 50,
          },
        },
      ];

      messageList.add(messagesWithMetadata[0], 'user');
      messageList.add(messagesWithMetadata[1], 'response');

      // Get messages in v2 format (what would be saved to memory)
      const v2Messages = messageList.get.all.v2();

      // Verify metadata is preserved in v2 format
      expect(v2Messages.length).toBe(2);
      expect(v2Messages[0].content.metadata).toEqual({
        source: 'web-ui',
        timestamp: 1234567890,
        customField: 'custom-value',
      });
      expect(v2Messages[1].content.metadata).toEqual({
        model: 'gpt-4',
        processingTime: 250,
        tokens: 50,
      });

      // Simulate loading from memory by creating a new MessageList with v2 messages
      const newMessageList = new MessageList();
      newMessageList.add(v2Messages, 'memory');

      // Get back as UI messages
      const uiMessages = newMessageList.get.all.ui();

      // Verify metadata is still preserved after round trip
      expect(uiMessages[0].metadata).toEqual({
        source: 'web-ui',
        timestamp: 1234567890,
        customField: 'custom-value',
      });
      expect(uiMessages[1].metadata).toEqual({
        model: 'gpt-4',
        processingTime: 250,
        tokens: 50,
      });
    });
  });
});
