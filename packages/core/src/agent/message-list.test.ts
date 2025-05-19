import { randomUUID } from 'crypto';
import { appendClientMessage, appendResponseMessages } from 'ai';
import type { UIMessage, CoreMessage, Message } from 'ai';
import { describe, expect, it } from 'vitest';
import type { MessageType } from '../memory';
import type { MastraMessageV2 } from './message-list';
import { MessageList, toBase64String } from './message-list';

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

      const list = new MessageList({ threadId, resourceId }).add(input);

      const messages = list.getMessages();
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
      }).add(input);

      const messages = list.getMessages();
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

      const list = new MessageList().add(initialMessages[0]).add(initialMessages[1]);

      const messageThree = {
        role: 'tool',
        content: [
          { type: 'tool-result', toolName: 'test-tool', toolCallId: 'call-3', result: 'Tool execution successful' },
        ],
      } satisfies CoreMessage;

      list.add(messageThree);

      expect(list.toUIMessages()).toEqual([
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
          toolInvocations: undefined,
          parts: [
            { type: 'step-start' },
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

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message);

      expect(list.getMessages()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: inputV1Message.createdAt,
          content: {
            format: 2,
            parts: [
              { type: 'step-start' },
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

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message);

      expect(list.getMessages()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: inputV1Message.createdAt,
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage);

      expect(list.getMessages()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'step-start' },
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
              { type: 'step-start' },
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
      ];
      expect(new MessageList({ threadId, resourceId }).add(messageSequence).getMessages()).toEqual(expected);

      let messages: Message[] = [];
      const list = new MessageList();

      // msg1
      messages = appendClientMessage({ messages, message: msg1 });
      expect(new MessageList().add(messages).toUIMessages()).toEqual(messages);
      list.add(messages);
      expect(list.toUIMessages()).toEqual(messages);

      // msg2
      messages = appendResponseMessages({
        messages,
        responseMessages: [{ ...msg2, id: randomUUID() }],
      });
      expect(new MessageList().add(messages).toUIMessages()).toEqual(messages);
      list.add(messages);
      expect(list.toUIMessages()).toEqual(messages);

      // msg3
      messages = appendResponseMessages({ messages, responseMessages: [{ id: randomUUID(), ...msg3 }] });
      expect(new MessageList().add(messages).toUIMessages()).toEqual(messages);
      list.add(messages);
      expect(list.toUIMessages()).toEqual(messages);

      // msg4
      messages = appendResponseMessages({ messages, responseMessages: [msg4] });
      expect(new MessageList().add(messages).toUIMessages()).toEqual(messages);
      list.add(messages);
      expect(list.toUIMessages()).toEqual(messages);
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage);

      expect(list.getMessages()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'step-start' },
              {
                type: 'reasoning',
                reasoning: 'Step 1: Analyze',
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage);

      expect(list.getMessages()).toEqual([
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

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message);

      expect(list.getMessages()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: inputV1Message.createdAt,
          content: {
            format: 2,
            parts: [
              { type: 'step-start' },
              {
                type: 'reasoning',
                reasoning: 'Analyzing data...',
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

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message);

      expect(list.getMessages()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: inputV1Message.createdAt,
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

      const list = new MessageList({ threadId, resourceId }).add(messageSequence);

      expect(list.getMessages()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'step-start' },
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

      const list = new MessageList({ threadId, resourceId }).add(messageSequence);

      expect(list.getMessages()).toEqual([
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
              { type: 'step-start' },
              {
                type: 'reasoning',
                reasoning: 'First, I need to gather some data.',
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
                reasoning: 'Data gathered, now processing.',
                details: [{ type: 'text', text: 'Data gathered, now processing.', signature: 'sig-process' }],
              },
              { type: 'text', text: 'Task completed successfully with gathered data.' },
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

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message);

      expect(list.getMessages()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: inputV1Message.createdAt,
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Here is an image URL:' }],
            experimental_attachments: [
              {
                name: 'image.jpg',
                url: 'https://example.com/image.jpg',
                contentType: 'image/jpeg',
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage);

      expect(list.getMessages()).toEqual([
        {
          id: expect.any(String),
          role: 'user',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'Here is another image URL:' }],
            experimental_attachments: [
              {
                name: 'another-image.png',
                url: 'https://example.com/another-image.png',
                contentType: 'image/png',
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

      const list = new MessageList({ threadId, resourceId }).add(input);

      const messages = list.getMessages();
      expect(messages.length).toBe(1);

      expect(messages[0]).toEqual({
        id: input.id,
        role: 'user',
        createdAt: input.createdAt,
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

      const list = new MessageList({ threadId, resourceId }).add(input);

      const messages = list.getMessages();
      expect(messages.length).toBe(1);

      expect(messages[0]).toEqual({
        id: input.id,
        role: 'user',
        createdAt: input.createdAt,
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

      const list = new MessageList({ threadId, resourceId }).add(messageSequence);

      expect(list.getMessages()).toEqual([
        {
          id: userMsgV1.id,
          role: 'user',
          createdAt: userMsgV1.createdAt,
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
          createdAt: assistantMsgUIV2.createdAt, // The last message's timestamp might be used for the merged message
          content: {
            format: 2,
            parts: [
              { type: 'step-start' },
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

      const list = new MessageList({ threadId, resourceId }).add(messageSequence);

      expect(list.getMessages()).toEqual([
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
              { type: 'step-start' },
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
          }, // 1x1 transparent GIF
        ],
      } satisfies VercelCoreMessage;

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage);

      expect(list.getMessages()).toEqual([
        {
          id: expect.any(String),
          role: 'user',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'text', text: 'Here is an embedded image:' },
              { type: 'file', mimeType: 'image/gif', data: 'R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==' }, // Base64 data
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage);

      expect(list.getMessages()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'step-start' },
              {
                type: 'reasoning',
                reasoning: 'First, I need to gather some data.',
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
                reasoning: 'Data gathered, now I will process it.',
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

      const list = new MessageList({ threadId, resourceId }).add(messageSequence);

      expect(list.getMessages()).toEqual([
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
              { type: 'step-start' },
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage);

      expect(list.getMessages()).toEqual([
        {
          id: expect.any(String),
          role: 'assistant',
          createdAt: expect.any(Date),
          content: {
            format: 2,
            parts: [
              { type: 'step-start' },
              {
                type: 'reasoning',
                reasoning: 'Thinking step 1...',
                details: [{ type: 'text', text: 'Thinking step 1...', signature: 'sig-1' }],
              },
              { type: 'reasoning', reasoning: '', details: [{ type: 'redacted', data: 'some hidden data' }] },
              {
                type: 'reasoning',
                reasoning: 'Final thought.',
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

      const list = new MessageList({ threadId: '68' }).add(history);

      const uiMessages = list.toUIMessages();

      expect(uiMessages.length).toBe(9);
      const expectedMessages = [
        {
          id: 'c59c844b-0f1a-409a-995e-3382a3ee1eaa',
          role: 'user',
          content: 'hi',
          createdAt: new Date('2025-03-25T20:29:58.103Z'),
          parts: [{ type: 'step-start' }, { type: 'text', text: 'hi' }],
          experimental_attachments: [],
        },
        {
          id: '7bb920f1-1a89-4f1a-8fb0-6befff982946',
          role: 'assistant',
          content: 'Hello! How can I assist you today?',
          createdAt: new Date('2025-03-25T20:29:58.717Z'),
          parts: [{ type: 'step-start' }, { type: 'text', text: 'Hello! How can I assist you today?' }],
          reasoning: undefined,
          toolInvocations: undefined,
        },
        {
          id: '673b1279-9ce5-428e-a646-d19d83ed4d67',
          role: 'user',
          content: 'LA',
          createdAt: new Date('2025-03-25T20:30:01.911Z'),
          parts: [{ type: 'step-start' }, { type: 'text', text: 'LA' }],
          experimental_attachments: [],
        },
        {
          id: '6a903ed0-1cf4-463d-8ea0-c13bd0896405',
          role: 'assistant',
          content: "Got it! You're in LA. What would you like to talk about or do today?",
          createdAt: new Date('2025-03-25T20:30:02.177Z'), // Merged message takes the latest timestamp
          parts: [
            { type: 'step-start' },
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
          toolInvocations: undefined,
        },
        {
          id: '1b271c02-7762-4416-91e9-146a25ce9c73',
          role: 'user',
          content: 'Hello',
          createdAt: new Date('2025-05-13T22:23:26.584Z'),
          parts: [{ type: 'text', text: 'Hello' }],
          experimental_attachments: [],
        },
        {
          id: 'msg-Cpo828mGmAc8dhWwQcD32Net',
          role: 'assistant',
          content: 'Hello again! How can I help you today?',
          createdAt: new Date('2025-05-13T22:23:26.585Z'),
          parts: [{ type: 'step-start' }, { type: 'text', text: 'Hello again! How can I help you today?' }],
          reasoning: undefined,
          toolInvocations: undefined,
        },
        {
          id: 'eab9da82-6120-4630-b60e-0a7cb86b0718',
          role: 'user',
          content: 'Hi',
          createdAt: new Date('2025-05-13T22:24:51.608Z'),
          parts: [{ type: 'text', text: 'Hi' }],
          experimental_attachments: [],
        },
        {
          id: 'msg-JpZvGeyqVaUo1wthbXf0EVSS',
          role: 'assistant',
          content: "Hi there! What's on your mind?",
          createdAt: new Date('2025-05-13T22:24:51.609Z'),
          parts: [{ type: 'step-start' }, { type: 'text', text: "Hi there! What's on your mind?" }],
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
      let newUIMessages = appendResponseMessages({
        messages: uiMessages,
        responseMessages: [
          {
            id: newId,
            role: 'assistant' as const,
            content: [{ type: 'text' as const, text: 'As a large language model...' }],
          },
        ],
      });

      expect(newUIMessages.length).toBe(uiMessages.length + 1);
      const newUIMessages2 = list.add(newUIMessages).toUIMessages();
      expect(newUIMessages2).toEqual([
        ...uiMessages,
        {
          role: 'assistant',
          id: newId,
          content: 'As a large language model...',
          createdAt: expect.any(Date),
          parts: [{ type: 'step-start' }, { type: 'text', text: 'As a large language model...' }],
          reasoning: undefined,
          toolInvocations: [],
        } satisfies UIMessage,
      ]);

      const newClientMessage = {
        id: randomUUID(),
        role: 'user',
        content: 'Do it anyway please',
        createdAt: new Date(),
        experimental_attachments: [],
        parts: [{ type: 'step-start' }, { type: 'text', text: 'Do it anyway please' }],
      } satisfies Message;

      const newUIMessages3 = appendClientMessage({
        messages: newUIMessages2,
        message: newClientMessage,
      });

      expect(newUIMessages3.length).toBe(newUIMessages2.length + 1);
      const newUIMessages4 = list.add(newUIMessages3).toUIMessages();
      expect(newUIMessages4).toEqual([
        ...newUIMessages2,
        {
          ...newClientMessage,
        } satisfies Message,
      ]);

      const newUIMessages5 = appendResponseMessages({
        messages: newUIMessages3,
        responseMessages: [
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
        ],
      });

      expect(list.add(newUIMessages5).toUIMessages()).toEqual([
        ...newUIMessages4,
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

    describe('toBase64String', () => {
      it('should return the string itself if the input is a string', () => {
        const input = 'alreadybase64==';
        expect(toBase64String(input)).toBe('alreadybase64==');
      });

      it('should convert Uint8Array to base64 string', () => {
        const input = new Uint8Array([1, 2, 3, 4]);
        expect(toBase64String(input)).toBe('AQIDBA==');
      });

      it('should convert ArrayBuffer to base64 string', () => {
        const input = new Uint8Array([5, 6, 7, 8]).buffer;
        expect(toBase64String(input)).toBe('BQYHCA==');
      });

      it('should extract base64 from a data URL', () => {
        const input = new URL(
          'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        );
        expect(toBase64String(input)).toBe(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        );
      });

      it('should throw an error for invalid data URL format', () => {
        const input = new URL('data:image/png,invaliddata');
        expect(() => toBase64String(input)).toThrow('Invalid data URL format');
      });

      it('should throw an error for non-data URLs', () => {
        const input = new URL('https://example.com/image.png');
        expect(() => toBase64String(input)).toThrow('Unsupported URL protocol for base64 conversion: https:');
      });

      it('should throw an error for unsupported data types', () => {
        const input = 12345 as any; // Test with a number
        expect(() => toBase64String(input)).toThrow('Unsupported data type for base64 conversion: number');
      });
    });
  });
});
