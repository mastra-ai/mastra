import { randomUUID } from 'crypto';
import { appendClientMessage, appendResponseMessages } from 'ai';
import type { UIMessage, CoreMessage, Message } from 'ai';
import { describe, expect, it } from 'vitest';
import type { MastraMessageV1 } from '../../memory';
import type { MastraMessageV2, UIMessageWithMetadata } from '../message-list';
import type { AIV4Type } from './types';
import { MessageList } from './index';

type VercelUIMessage = Message;
type VercelCoreMessage = CoreMessage;

const threadId = `one`;
const resourceId = `user`;

describe('MessageList', () => {
  describe('Response message tracking', () => {
    it('should track all response messages including tool calls and results', () => {
      const messageList = new MessageList();

      // Add user message
      messageList.add({ role: 'user', content: 'What is the weather?' }, 'input');

      // Add assistant message with tool-call
      messageList.add(
        {
          role: 'assistant',
          content: [
            {
              type: 'tool-call',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              args: { location: 'London' },
            },
          ],
        },
        'response',
      );

      // Add tool result message
      messageList.add(
        {
          role: 'tool',
          content: [
            {
              type: 'tool-result',
              toolCallId: 'call-1',
              toolName: 'get_weather',
              result: 'Sunny, 70°F',
            },
          ],
        },
        'response',
      );

      // Add final assistant response
      messageList.add(
        {
          role: 'assistant',
          content: 'The weather in London is sunny at 70°F.',
        },
        'response',
      );

      // Check what's in response messages
      const responseMessages = messageList.get.response.aiV5.model();

      // We expect 3 messages: tool-call assistant, tool result, final assistant
      expect(responseMessages).toHaveLength(3);

      // First message: assistant with tool-call
      expect(responseMessages[0].role).toBe('assistant');
      expect(responseMessages[0].content).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'tool-call' })]),
      );

      // Second message: tool result
      expect(responseMessages[1].role).toBe('tool');
      expect(responseMessages[1].content).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'tool-result' })]),
      );

      // Third message: final assistant response
      expect(responseMessages[2].role).toBe('assistant');
      expect(responseMessages[2].content).toEqual(expect.arrayContaining([expect.objectContaining({ type: 'text' })]));
    });
  });

  describe('add message', () => {
    it('should skip over system messages that are retrieved from the db', async () => {
      // this is to fix a bug detailed in https://github.com/mastra-ai/mastra/issues/6689
      // in the past we accidentally introduced a bug where system messages were saved in memory unintentionally.
      // so the fix is to skip any system messages with a message source of memory
      // memory source means it was retrieved from the db via memory

      const list = new MessageList().add(
        {
          id: 'one',
          role: 'system',
          content: 'test',
          createdAt: new Date(),
          resourceId,
          threadId,
          type: 'text',
        } satisfies MastraMessageV1,
        'memory',
      );

      expect(list.get.all.aiV4.core()).toHaveLength(0);
      expect(list.get.all.aiV4.ui()).toHaveLength(0);
      expect(list.get.all.aiV5.model()).toHaveLength(0);
      expect(list.get.all.aiV5.ui()).toHaveLength(0);
      expect(list.get.all.v1()).toHaveLength(0);
      expect(list.get.all.v2()).toHaveLength(0);
      expect(list.get.all.v3()).toHaveLength(0);

      list.add(
        {
          id: 'one',
          role: 'user',
          content: '',
          parts: [{ type: 'text' as const, text: 'hi' }],
        } satisfies AIV4Type.Message,
        'memory',
      );

      list.addSystem(`test system message`, `memory`);

      expect(list.get.all.aiV4.core()).toHaveLength(1);
      expect(list.get.all.aiV4.ui()).toHaveLength(1);
      expect(list.get.all.aiV5.model()).toHaveLength(1);
      expect(list.get.all.aiV5.ui()).toHaveLength(1);
      expect(list.get.all.v1()).toHaveLength(1);
      expect(list.get.all.v2()).toHaveLength(1);
      expect(list.get.all.v3()).toHaveLength(1);

      expect(list.getSystemMessages(`memory`)).toHaveLength(1);
      expect(list.get.all.aiV4.prompt()).toHaveLength(2); // system message + user message
      expect(list.get.all.aiV4.llmPrompt()).toHaveLength(2); // system message + user message
      expect(list.get.all.aiV5.prompt()).toHaveLength(2); // system message + user message
      expect(await list.get.all.aiV5.llmPrompt()).toHaveLength(2); // system message + user message
    });

    it('should correctly convert and add a Vercel UIMessage', () => {
      const input = {
        id: 'ui-msg-1',
        role: 'user',
        content: 'Hello from UI!',
        createdAt: new Date('2023-10-26T10:00:00.000Z'),
        parts: [{ type: 'text', text: 'Hello from UI!' }],
        experimental_attachments: [],
      } satisfies VercelUIMessage;

      const list = new MessageList({ threadId, resourceId }).add(input, 'input');

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
      }).add(input, 'input');

      const messages = list.get.all.v2();
      expect(messages.length).toBe(1);

      expect(messages[0]).toEqual({
        id: expect.any(String),
        role: 'user',
        createdAt: expect.any(Date),
        content: {
          format: 2,
          content: 'Hello from Core!',
          parts: [{ type: 'text', text: 'Hello from Core!' }],
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

      const list = new MessageList().add(initialMessages[0], 'input').add(initialMessages[1], 'response');

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
          parts: [{ type: 'text' as const, text: messageOne.content }],
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

    it('should preserve tool args when restoring messages from database with toolInvocations', () => {
      // This test simulates messages being restored from the database where
      // toolInvocations might have empty args but parts have the correct args
      const dbMessage: MastraMessageV2 = {
        id: 'db-msg-1',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'resource-1',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result',
                toolCallId: 'call-123',
                toolName: 'searchTool',
                args: { query: 'mastra framework' }, // Args are here in parts
                result: { results: ['result1', 'result2'] },
              },
            },
          ],
          toolInvocations: [
            {
              state: 'result',
              toolCallId: 'call-123',
              toolName: 'searchTool',
              args: {}, // But args might be empty in toolInvocations
              result: { results: ['result1', 'result2'] },
            },
          ],
        },
      };

      const list = new MessageList().add(dbMessage, 'memory');

      // Check that args are preserved in both parts and toolInvocations
      const v2Messages = list.get.all.v2();
      expect(v2Messages).toHaveLength(1);

      // Check parts array has correct args and no duplicate entries
      expect(v2Messages[0].content.parts).toEqual([
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'call-123',
            toolName: 'searchTool',
            args: { query: 'mastra framework' },
            result: { results: ['result1', 'result2'] },
          },
        },
      ]);

      // Check toolInvocations array has correct args (should be fixed by hydration)
      expect(v2Messages[0].content.toolInvocations).toEqual([
        {
          state: 'result',
          toolCallId: 'call-123',
          toolName: 'searchTool',
          args: { query: 'mastra framework' },
          result: { results: ['result1', 'result2'] },
        },
      ]);

      // Check UI messages preserve args
      const uiMessages = list.get.all.ui();
      expect(uiMessages).toHaveLength(1);
      expect(uiMessages[0].toolInvocations![0].args).toEqual({ query: 'mastra framework' });
    });

    it('should preserve tool args when tool-result arrives in a separate message', () => {
      // This test reproduces the issue where tool args are lost when tool-result
      // messages arrive separately from tool-call messages
      const userMessage = {
        role: 'user' as const,
        content: 'Check the weather in Paris',
      } satisfies VercelCoreMessage;

      const toolCallMessage = {
        role: 'assistant' as const,
        content: [
          {
            type: 'tool-call' as const,
            toolName: 'weatherTool',
            toolCallId: 'toolu_01Y9o5yfKqKvdueRhupfT9Jf',
            args: { location: 'Paris' },
          },
        ],
      } satisfies VercelCoreMessage;

      const toolResultMessage = {
        role: 'tool' as const,
        content: [
          {
            type: 'tool-result' as const,
            toolName: 'weatherTool',
            toolCallId: 'toolu_01Y9o5yfKqKvdueRhupfT9Jf',
            result: {
              temperature: 24.3,
              conditions: 'Partly cloudy',
            },
          },
        ],
      } satisfies VercelCoreMessage;

      // Add messages as they would arrive from the AI SDK
      const list = new MessageList()
        .add(userMessage, 'input')
        .add(toolCallMessage, 'response')
        .add(toolResultMessage, 'response');

      // Check that args are preserved in v2 messages (internal representation)
      const v2Messages = list.get.all.v2();
      expect(v2Messages).toHaveLength(2);

      const assistantV2Message = v2Messages[1];
      expect(assistantV2Message.role).toBe('assistant');

      // Check parts array has correct args and only one tool-invocation (no duplicate call part)
      expect(assistantV2Message.content.parts).toEqual([
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'toolu_01Y9o5yfKqKvdueRhupfT9Jf',
            toolName: 'weatherTool',
            args: { location: 'Paris' },
            result: {
              temperature: 24.3,
              conditions: 'Partly cloudy',
            },
          },
        },
      ]);

      // Check toolInvocations array has correct args
      expect(assistantV2Message.content.toolInvocations).toEqual([
        {
          state: 'result',
          toolCallId: 'toolu_01Y9o5yfKqKvdueRhupfT9Jf',
          toolName: 'weatherTool',
          args: { location: 'Paris' },
          result: {
            temperature: 24.3,
            conditions: 'Partly cloudy',
          },
        },
      ]);

      // Check that the args are preserved in the final UI messages
      const uiMessages = list.get.all.ui();
      expect(uiMessages).toHaveLength(2);

      const assistantMessage = uiMessages[1];
      expect(assistantMessage.role).toBe('assistant');
      expect(assistantMessage.toolInvocations).toHaveLength(1);
      expect(assistantMessage.toolInvocations![0].args).toEqual({ location: 'Paris' });

      // Check that args are preserved in Core messages (used by LLM)
      const coreMessages = list.get.all.core();
      // Note: Core messages may include the tool message separately
      expect(coreMessages.length).toBeGreaterThanOrEqual(2);

      const assistantCoreMessage = coreMessages[1];
      expect(assistantCoreMessage.role).toBe('assistant');

      if (typeof assistantCoreMessage.content === `string`) {
        throw new Error(`Expected message to have non-string content`);
      }
      // Find the tool-call part in the content
      const toolCallPart = assistantCoreMessage.content.find((part: any) => part.type === 'tool-call');
      // This is the bug - the tool-call part doesn't exist in core messages after sanitization
      expect(toolCallPart).toBeDefined();
      if (toolCallPart?.type !== `tool-call`) {
        throw new Error(`expected tool call part`);
      }
      expect(toolCallPart.args).toEqual({ location: 'Paris' });
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

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message, 'input');

      expect(list.get.all.v2()).toEqual([
        {
          id: inputV1Message.id,
          role: inputV1Message.role,
          createdAt: expect.any(Date),
          content: {
            format: 2,
            content: 'Hello from V1!',
            parts: [{ type: 'text', text: inputV1Message.content }],
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'input');

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
              { type: 'step-start' },
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
      expect(new MessageList({ threadId, resourceId }).add(messageSequence, 'input').get.all.v2()).toEqual(
        expected.map(m => ({ ...m, createdAt: expect.any(Date) })),
      );

      let messages: Message[] = [];
      const list = new MessageList();

      // msg1
      messages = appendClientMessage({ messages, message: msg1 });
      expect(new MessageList().add(messages, 'input').get.all.ui()).toEqual(
        messages.map(m => ({ ...m, createdAt: expect.any(Date) })),
      );
      list.add(messages, 'input');
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'input');

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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'input');

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

      const list = new MessageList({ threadId, resourceId }).add(inputV1Message, 'input');

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
              { type: 'step-start' },
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
            parts: [{ type: 'text', text: userMsg.content }],
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'input');

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

      const list = new MessageList({ threadId, resourceId }).add(input, 'input');

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

      const list = new MessageList({ threadId, resourceId }).add(input, 'input');

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
            parts: [{ type: 'text', text: userMsgV1.content }],
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
              { type: 'step-start' },
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
            parts: [{ type: 'text', text: userMsg.content }],
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

      const list = new MessageList({ threadId, resourceId }).add(inputCoreMessage, 'input');

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
            parts: [{ type: 'text', text: userMsg.content }],
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
              { type: 'step-start' },
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
          parts: [{ type: 'text', text: 'hi' }],
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
          parts: [{ type: 'text', text: 'LA' }],
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
              type: 'step-start',
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
      const newUIMessages4 = list.add(newClientMessage, 'input').get.all.ui();
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
        list.add({ role: 'user', content: 'Hello' }, 'input');
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

      list.add(userMessage, 'input');
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
      expect(() => list.add(messageWithStringContent, 'input')).not.toThrow();

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
      expect(() => list.add(messageWithJSONString, 'input')).not.toThrow();

      // The content should stay as a string, not be parsed to an object
      const messages = list.get.all.v2();
      expect(messages[0].content.content).toBe('{"data": "value", "number": 42}'); // Should stay as string
      expect(typeof messages[0].content.content).toBe('string'); // Should be a string, not an object
      expect(messages[0].content.parts).toEqual([
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
            step: 0,
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
          step: 0,
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

        const list = new MessageList({ threadId, resourceId }).add(v2Message, 'input');
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

        const list = new MessageList({ threadId, resourceId }).add(uiMessage, 'input');
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

        const list = new MessageList({ threadId, resourceId }).add(uiMessage, 'input');
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

        const list = new MessageList({ threadId, resourceId }).add(uiMessage, 'input');
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

        const list = new MessageList({ threadId, resourceId });
        list.add(uiMessage, 'input');
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

        const list1 = new MessageList({ threadId, resourceId }).add(uiMessageNull, 'input');
        const list2 = new MessageList({ threadId, resourceId }).add(uiMessageUndefined, 'input');

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
        list.add(userMessage, 'input');

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
        list.add(onlookMessage, 'input');

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

      messageList.add(messagesWithMetadata[0], 'input');
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

  describe('v1 message ID bug', () => {
    it('should handle memory processor flow like agent does (BUG: v1 messages with same ID replace each other)', () => {
      // This test reproduces the bug where v1 messages with the same ID replace each other
      // when added back to a MessageList, causing tool history to be lost

      // Step 1: Create message list with thread info
      const messageList = new MessageList({
        threadId: 'ff1fa961-7925-44b7-909a-a4c9fba60b4e',
        resourceId: 'weatherAgent',
      });

      // Step 2: Add memory messages (from rememberMessages)
      const memoryMessagesV2: MastraMessageV2[] = [
        {
          id: 'fbd2f506-90e6-4f52-8ba4-633abe9e8442',
          role: 'user',
          createdAt: new Date('2025-08-05T22:58:18.403Z'),
          threadId: 'ff1fa961-7925-44b7-909a-a4c9fba60b4e',
          resourceId: 'weatherAgent',
          content: {
            format: 2,
            parts: [{ type: 'text', text: 'LA weather' }],
            content: 'LA weather',
          },
        },
        {
          id: '17949558-8a2b-4841-990d-ce05d29a8afb',
          role: 'assistant',
          createdAt: new Date('2025-08-05T22:58:22.151Z'),
          threadId: 'ff1fa961-7925-44b7-909a-a4c9fba60b4e',
          resourceId: 'weatherAgent',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
                  toolName: 'weatherTool',
                  args: { location: 'Los Angeles' },
                  result: {
                    temperature: 29.4,
                    feelsLike: 30.5,
                    humidity: 48,
                    windSpeed: 16,
                    windGust: 18.7,
                    conditions: 'Clear sky',
                    location: 'Los Angeles',
                  },
                },
              },
              {
                type: 'text',
                text: 'The current weather in Los Angeles is as follows:\n\n- **Temperature:** 29.4°C (Feels like 30.5°C)\n- **Humidity:** 48%\n- **Wind Speed:** 16 km/h\n- **Wind Gusts:** 18.7 km/h\n- **Conditions:** Clear sky\n\nIf you need any specific activities or further information, let me know!',
              },
            ],
            toolInvocations: [
              {
                state: 'result',
                toolCallId: 'call_WLUBDGduzBI0KBmGZVXA8lMM',
                toolName: 'weatherTool',
                args: { location: 'Los Angeles' },
                result: {
                  temperature: 29.4,
                  feelsLike: 30.5,
                  humidity: 48,
                  windSpeed: 16,
                  windGust: 18.7,
                  conditions: 'Clear sky',
                  location: 'Los Angeles',
                },
              },
            ],
          },
        },
      ];

      messageList.add(memoryMessagesV2, 'memory');

      // Step 3: Get remembered messages as v1 (like agent does for processing)
      const rememberedV1 = messageList.get.remembered.v1();

      // Step 4: Simulate memory.processMessages (which just returns them if no processors)
      const processedMemoryMessages = rememberedV1;

      // Step 5: Create return list like agent does
      const returnList = new MessageList().add(processedMemoryMessages as any, 'memory').add(
        [
          {
            id: 'd936d31b-0ad5-43a8-89ed-c5cc24c60895',
            role: 'user',
            createdAt: new Date('2025-08-05T22:58:38.656Z'),
            threadId: 'ff1fa961-7925-44b7-909a-a4c9fba60b4e',
            resourceId: 'weatherAgent',
            content: {
              format: 2,
              parts: [{ type: 'text', text: 'what was the result when you called the tool?' }],
              content: 'what was the result when you called the tool?',
            },
          },
        ],
        'user',
      );

      // Step 6: Get prompt messages (what's sent to LLM)
      const promptMessages = returnList.get.all.prompt();

      // Verify the tool history is preserved
      // Check if tool calls are present
      const hasToolCall = promptMessages.some(
        m => m.role === 'assistant' && Array.isArray(m.content) && m.content.some(c => c.type === 'tool-call'),
      );

      const hasToolResult = promptMessages.some(
        m => m.role === 'tool' && Array.isArray(m.content) && m.content.some(c => c.type === 'tool-result'),
      );

      // These should be true if tool history is preserved
      expect(hasToolCall).toBe(true);
      expect(hasToolResult).toBe(true);
    });

    it('should handle v1 messages with suffixed IDs and prevent double-suffixing', () => {
      // Test what happens when we create a new MessageList using v1 messages that already have suffixed IDs
      const v1MessagesWithSuffixes: MastraMessageV1[] = [
        {
          role: 'user',
          id: 'user-1',
          createdAt: new Date('2025-08-05T22:58:18.403Z'),
          resourceId: 'weatherAgent',
          threadId: 'thread-1',
          type: 'text',
          content: 'LA weather',
        },
        {
          role: 'assistant',
          id: 'msg-1',
          createdAt: new Date('2025-08-05T22:58:22.151Z'),
          resourceId: 'weatherAgent',
          threadId: 'thread-1',
          type: 'tool-call',
          content: [
            {
              type: 'tool-call' as const,
              toolCallId: 'call_123',
              toolName: 'weatherTool',
              args: { location: 'LA' },
            },
          ],
        },
        {
          role: 'tool',
          id: 'msg-1__split-1', // Suffixed ID from our fix with new pattern
          createdAt: new Date('2025-08-05T22:58:22.151Z'),
          resourceId: 'weatherAgent',
          threadId: 'thread-1',
          type: 'tool-result',
          content: [
            {
              type: 'tool-result' as const,
              toolCallId: 'call_123',
              toolName: 'weatherTool',
              result: { temperature: 29.4 },
            },
          ],
        },
        {
          role: 'assistant',
          id: 'msg-1__split-2', // Suffixed ID from our fix with new pattern
          createdAt: new Date('2025-08-05T22:58:22.151Z'),
          resourceId: 'weatherAgent',
          threadId: 'thread-1',
          type: 'text',
          content: 'The weather in LA is 29.4°C.',
        },
      ];

      // Create a new MessageList with these v1 messages
      const newList = new MessageList({ threadId: 'thread-1', resourceId: 'weatherAgent' });
      newList.add(v1MessagesWithSuffixes, 'memory');

      // Get the v2 messages to see how they're stored
      const v2Messages = newList.get.all.v2();

      // Check that all messages are preserved with their IDs
      expect(v2Messages.length).toBe(4);
      expect(v2Messages[0].id).toBe('user-1');
      expect(v2Messages[1].id).toBe('msg-1');
      expect(v2Messages[2].id).toBe('msg-1__split-1');
      expect(v2Messages[3].id).toBe('msg-1__split-2');

      // Now convert back to v1 and see what happens
      const v1Again = newList.get.all.v1();

      // With our improved suffix pattern, messages with __split- suffix should NOT get double-suffixed
      // Note: v1 tool messages get converted to v2 assistant messages, then split again when converting back
      expect(v1Again.length).toBe(5); // 5 messages because tool message gets split
      expect(v1Again[0].id).toBe('user-1');
      expect(v1Again[1].id).toBe('msg-1');
      expect(v1Again[2].id).toBe('msg-1__split-1'); // assistant tool-call (preserved)
      expect(v1Again[3].id).toBe('msg-1__split-1'); // tool result (preserved - no double suffix!)
      expect(v1Again[4].id).toBe('msg-1__split-2'); // assistant text (preserved)

      // Now if we try to convert these v2 messages that came from suffixed v1s
      // We need to check if we get double-suffixed IDs
      const v2MessageWithToolAndText: MastraMessageV2 = {
        id: 'msg-2',
        role: 'assistant',
        createdAt: new Date(),
        threadId: 'thread-1',
        resourceId: 'weatherAgent',
        content: {
          format: 2,
          parts: [
            {
              type: 'tool-invocation',
              toolInvocation: {
                state: 'result' as const,
                toolCallId: 'call_456',
                toolName: 'anotherTool',
                args: {},
                result: { data: 'test' },
              },
            },
            {
              type: 'text',
              text: 'Here is the result.',
            },
          ],
          toolInvocations: [
            {
              state: 'result' as const,
              toolCallId: 'call_456',
              toolName: 'anotherTool',
              args: {},
              result: { data: 'test' },
            },
          ],
        },
      };

      // Add this new message that will be split
      newList.add(v2MessageWithToolAndText, 'response');

      // Get v1 messages again
      const finalV1 = newList.get.all.v1();

      // The test shows our fix works! Messages with __split- suffix are not getting double-suffixed
      expect(finalV1.length).toBeGreaterThanOrEqual(8); // At least 5 existing + 3 new split messages

      // Verify that messages with __split- suffix are preserved (no double-suffixing)
      const splitMessages = finalV1.filter(m => m.id.includes('__split-'));
      splitMessages.forEach(msg => {
        // Check that we don't have double suffixes like __split-1__split-1
        expect(msg.id).not.toMatch(/__split-\d+__split-\d+/);
      });
    });
  });
});
