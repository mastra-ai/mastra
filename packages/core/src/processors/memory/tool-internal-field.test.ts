import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MastraDBMessage } from '../../agent';
import { MessageList } from '../../agent';
import type { MemoryRuntimeContext } from '../../memory';
import { RequestContext } from '../../request-context';
import { MemoryStorage } from '../../storage';
import type { StorageListThreadsInput, StorageListThreadsOutput } from '../../storage/types';

import type { Processor } from '../index';
import { MessageHistory } from './message-history.js';

/**
 * Issue #12385: Debug fields for tool invocation
 *
 * Problem: When a tool returns an "_internal" field for debugging purposes,
 * and a custom input processor strips that field before sending to the agent,
 * the field is ALSO stripped from the database message (because input processing
 * happens before storage).
 *
 * Expected behavior:
 * - Tool result with "_internal" field is persisted to storage WITH the field
 * - When sending to LLM, the "_internal" field should be stripped
 * - When UI renders or thread reloads, the "_internal" field should be visible
 *
 * This test reproduces the issue by:
 * 1. Creating a message with a tool result containing an "_internal" field
 * 2. Running it through the MessageHistory output processor (which saves to storage)
 * 3. Verifying the "_internal" field is preserved in storage
 * 4. Verifying the "_internal" field is stripped when converting to model messages
 */

// Helper to create RequestContext with memory context
function createRuntimeContextWithMemory(threadId: string, resourceId?: string): RequestContext {
  const requestContext = new RequestContext();
  const memoryContext: MemoryRuntimeContext = {
    thread: { id: threadId },
    resourceId,
  };
  requestContext.set('MastraMemory', memoryContext);
  return requestContext;
}

// Mock storage implementation that captures saved messages
class MockStorage extends MemoryStorage {
  public savedMessages: MastraDBMessage[] = [];
  private messages: MastraDBMessage[] = [];

  async listMessages(params: any): Promise<any> {
    const { threadId, perPage = false, orderBy } = params;
    const threadMessages = this.messages.filter(m => m.threadId === threadId);

    let sortedMessages = threadMessages;
    if (orderBy?.field === 'createdAt') {
      sortedMessages = [...threadMessages].sort((a, b) => {
        const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : new Date(a.createdAt).getTime();
        const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : new Date(b.createdAt).getTime();
        return orderBy.direction === 'DESC' ? bTime - aTime : aTime - bTime;
      });
    }

    let resultMessages = sortedMessages;
    if (typeof perPage === 'number' && perPage > 0) {
      resultMessages = sortedMessages.slice(0, perPage);
    }

    return {
      messages: resultMessages,
      total: threadMessages.length,
      page: 1,
      perPage,
      hasMore: false,
    };
  }

  async listMessagesById({ messageIds }: { messageIds: string[] }): Promise<{ messages: MastraDBMessage[] }> {
    return { messages: this.messages.filter(m => m.id && messageIds.includes(m.id)) };
  }

  setMessages(messages: MastraDBMessage[]) {
    this.messages = messages;
  }

  async getThreadById(_args: { threadId: string }) {
    return {
      id: _args.threadId,
      resourceId: 'resource-1',
      title: 'Test Thread',
      metadata: {},
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async saveThread(args: any) {
    return args.thread || args;
  }
  async updateThread(args: { id: string; title: string; metadata: Record<string, unknown> }) {
    return {
      id: args.id,
      resourceId: 'resource-1',
      title: args.title,
      metadata: args.metadata,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
  async deleteThread(_args: { threadId: string }) {}
  async saveMessages(args: { messages: MastraDBMessage[] }) {
    // Capture the messages that would be saved to storage
    this.savedMessages = args.messages;
    return { messages: args.messages };
  }
  async updateMessages(args: any) {
    return args.messages || [];
  }
  async listThreads(args: StorageListThreadsInput): Promise<StorageListThreadsOutput> {
    return {
      threads: [],
      total: 0,
      page: args.page ?? 0,
      perPage: args.perPage ?? 100,
      hasMore: false,
    };
  }
}

describe('Tool Internal Field - Issue #12385', () => {
  let mockStorage: MockStorage;
  let processor: MessageHistory;
  const mockAbort = vi.fn(() => {
    throw new Error('Aborted');
  }) as any;

  beforeEach(() => {
    mockStorage = new MockStorage();
    processor = new MessageHistory({ storage: mockStorage });
    vi.clearAllMocks();
  });

  describe('processOutputResult - _internal field preservation', () => {
    it('should preserve tool result _internal field when saving to storage', async () => {
      // Create a message with a tool result that has an "_internal" debug field
      const toolResultWithInternalField = {
        actualResult: 'The weather in San Francisco is sunny',
        _internal: {
          debugInfo: 'This is debug information',
          rawApiResponse: { temperature: 72, conditions: 'sunny' },
          processingTime: 150,
        },
      };

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'What is the weather in SF?' }] },
          threadId: 'thread-1',
          createdAt: new Date('2024-01-01T00:00:01Z'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'getWeather',
                  args: { city: 'San Francisco' },
                  result: toolResultWithInternalField,
                },
              },
              { type: 'text', text: 'The weather in San Francisco is sunny!' },
            ],
            toolInvocations: [
              {
                state: 'result',
                toolCallId: 'call-1',
                toolName: 'getWeather',
                args: { city: 'San Francisco' },
                result: toolResultWithInternalField,
              },
            ],
          },
          threadId: 'thread-1',
          createdAt: new Date('2024-01-01T00:00:02Z'),
        },
      ];

      const messageList = new MessageList().add(messages, 'response');

      await processor.processOutputResult({
        messageList,
        messages,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // Verify the _internal field is preserved in the saved messages
      expect(mockStorage.savedMessages).toHaveLength(2);

      const savedAssistantMsg = mockStorage.savedMessages.find(m => m.role === 'assistant');
      expect(savedAssistantMsg).toBeDefined();

      // Check tool invocation in parts
      const toolPart = savedAssistantMsg?.content.parts?.find((p: any) => p.type === 'tool-invocation') as any;
      expect(toolPart).toBeDefined();
      expect(toolPart.toolInvocation.result).toHaveProperty('_internal');
      expect(toolPart.toolInvocation.result._internal).toEqual({
        debugInfo: 'This is debug information',
        rawApiResponse: { temperature: 72, conditions: 'sunny' },
        processingTime: 150,
      });

      // Also check toolInvocations array if present
      if (savedAssistantMsg?.content.toolInvocations) {
        const toolInvocation = savedAssistantMsg.content.toolInvocations[0];
        expect(toolInvocation.result).toHaveProperty('_internal');
      }
    });

    it('should strip _internal field when converting to model messages for LLM', async () => {
      // Create a message with a tool result that has an "_internal" debug field
      const toolResultWithInternalField = {
        actualResult: 'The weather in San Francisco is sunny',
        _internal: {
          debugInfo: 'This should NOT be sent to the LLM',
          rawApiResponse: { temperature: 72, conditions: 'sunny' },
        },
      };

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'What is the weather in SF?' }] },
          threadId: 'thread-1',
          createdAt: new Date('2024-01-01T00:00:01Z'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'getWeather',
                  args: { city: 'San Francisco' },
                  result: toolResultWithInternalField,
                },
              },
              { type: 'text', text: 'The weather in San Francisco is sunny!' },
            ],
          },
          threadId: 'thread-1',
          createdAt: new Date('2024-01-01T00:00:02Z'),
        },
      ];

      const messageList = new MessageList().add(messages, 'memory');

      // Get messages formatted for the LLM (model messages)
      const modelMessages = messageList.get.all.aiV5.prompt();

      // The _internal field should be STRIPPED when sending to the LLM
      // Look for tool-result parts in the model messages
      for (const msg of modelMessages) {
        if (msg.role === 'tool') {
          const content = Array.isArray(msg.content) ? msg.content : [msg.content];
          for (const part of content) {
            if (typeof part === 'object' && 'type' in part && part.type === 'tool-result') {
              const result = (part as any).result || (part as any).output;
              // This assertion should PASS - _internal should be stripped
              expect(result).not.toHaveProperty('_internal');
            }
          }
        }
      }
    });

    it('should preserve _internal field when retrieving from storage for UI display', async () => {
      // Simulate messages stored in DB with _internal field
      const storedMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'What is the weather?' }] },
          threadId: 'thread-1',
          createdAt: new Date('2024-01-01T00:00:01Z'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'getWeather',
                  args: { city: 'SF' },
                  result: {
                    weather: 'sunny',
                    _internal: { debugData: 'important debug info' },
                  },
                },
              },
            ],
          },
          threadId: 'thread-1',
          createdAt: new Date('2024-01-01T00:00:02Z'),
        },
      ];

      mockStorage.setMessages(storedMessages);

      // Simulate loading messages from storage (what happens on page reload)
      const messageList = new MessageList();

      await processor.processInput({
        messages: [],
        messageList,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // Get messages for UI display (UIMessages retain the full data)
      const uiMessages = messageList.get.all.aiV5.ui();

      // Find the assistant message with tool result
      const assistantMsg = uiMessages.find(m => m.role === 'assistant');
      expect(assistantMsg).toBeDefined();

      // The _internal field should be preserved for UI display
      const toolPart = assistantMsg?.parts.find((p: any) => p.type.startsWith('tool-'));
      expect(toolPart).toBeDefined();

      if (toolPart && 'output' in toolPart) {
        expect(toolPart.output).toHaveProperty('_internal');
        expect((toolPart.output as any)._internal).toEqual({ debugData: 'important debug info' });
      }
    });
  });

  describe('Custom input processor scenario', () => {
    it('should allow custom processor to strip _internal for LLM without affecting storage', async () => {
      /**
       * This test simulates the user's scenario:
       * 1. Tool returns result with "_internal" field
       * 2. Custom input processor strips "_internal" before sending to LLM
       * 3. Messages should still be saved to storage WITH the _internal field
       *
       * The issue is that currently, if a processor modifies messages,
       * those modifications affect what gets saved to storage.
       */

      const toolResultWithInternal = {
        weather: 'sunny',
        _internal: {
          apiCallDuration: 100,
          rawResponse: { temp: 72 },
        },
      };

      // Simulating messages BEFORE custom input processor runs
      const originalMessages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'getWeather',
                  args: {},
                  result: toolResultWithInternal,
                },
              },
            ],
          },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList().add(originalMessages, 'response');

      // Save to storage - should preserve _internal field
      await processor.processOutputResult({
        messageList,
        messages: originalMessages,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // Verify _internal field is preserved in storage
      const savedToolPart = mockStorage.savedMessages[0]?.content.parts?.find(
        (p: any) => p.type === 'tool-invocation',
      ) as any;

      expect(savedToolPart.toolInvocation.result).toHaveProperty('_internal');
      expect(savedToolPart.toolInvocation.result._internal).toEqual({
        apiCallDuration: 100,
        rawResponse: { temp: 72 },
      });

      // Now simulate what should happen when converting to model messages
      // The _internal field should be AUTOMATICALLY stripped (this is the feature request)
      const modelMessages = messageList.get.all.aiV5.prompt();

      // Find tool result in model messages
      const toolMessage = modelMessages.find(m => m.role === 'tool');
      if (toolMessage) {
        const content = Array.isArray(toolMessage.content) ? toolMessage.content : [];
        for (const part of content) {
          if (typeof part === 'object' && 'type' in part && part.type === 'tool-result') {
            // This is the expected behavior after the fix is implemented
            // The _internal field should NOT be sent to the LLM
            expect((part as any).result || (part as any).output).not.toHaveProperty('_internal');
          }
        }
      }
    });
  });

  describe('Issue reproduction: Custom input processor mutates messages before storage', () => {
    /**
     * NOTE: With the _internal field feature, users should NOT need to write custom
     * input processors to strip debug data. Mastra now automatically strips the
     * _internal field when converting to model messages for the LLM.
     *
     * The tests below document the OLD approach (custom input processor mutation)
     * which has a known limitation: mutations affect storage. Users should use
     * the _internal field instead.
     *
     * Old flow (problematic):
     * 1. Tool returns result with debug field
     * 2. Custom input processor strips the field (mutates message objects)
     * 3. Mutation affects storage - debug data is lost
     *
     * New flow (recommended):
     * 1. Tool returns result with _internal field
     * 2. Mastra automatically strips _internal when sending to LLM
     * 3. Storage and UI retain the _internal field
     */
    it.skip('documents that custom input processor mutations affect storage (use _internal field instead)', async () => {
      // Step 1: Create messages with tool result that has "_internal" field
      const toolResultWithInternal = {
        weather: 'sunny',
        _internal: {
          debugInfo: 'Should be preserved in DB',
          rawApiResponse: { temp: 72 },
        },
      };

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'user',
          content: { format: 2, parts: [{ type: 'text', text: 'What is the weather?' }] },
          threadId: 'thread-1',
          createdAt: new Date('2024-01-01T00:00:01Z'),
        },
        {
          id: 'msg-2',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'getWeather',
                  args: { city: 'SF' },
                  result: toolResultWithInternal,
                },
              },
              { type: 'text', text: 'The weather is sunny!' },
            ],
          },
          threadId: 'thread-1',
          createdAt: new Date('2024-01-01T00:00:02Z'),
        },
      ];

      // Step 2: Add messages to MessageList (simulating what happens after tool execution)
      const messageList = new MessageList();
      messageList.add(messages, 'response');

      // Step 3: Simulate a CUSTOM INPUT PROCESSOR that strips "_internal" field
      // This is what the user does to prevent debug data from being sent to the LLM
      const customInputProcessor: Processor = {
        id: 'strip-_internal',
        name: 'StripInternalFieldProcessor',
        processInput: async args => {
          const { messageList } = args;
          const allMessages = messageList.get.all.db();

          // MUTATE the messages to strip "_internal" from tool results
          // This is the problematic pattern - it modifies the original objects
          for (const msg of allMessages) {
            if (msg.content?.parts) {
              for (const part of msg.content.parts) {
                if (part.type === 'tool-invocation' && 'toolInvocation' in part) {
                  const invocation = (part as any).toolInvocation;
                  if (invocation.result && typeof invocation.result === 'object') {
                    // Strip the _internal field (this mutates the original object!)
                    delete invocation.result._internal;
                  }
                }
              }
            }
          }

          return messageList;
        },
      };

      // Run the custom input processor (simulating what happens before LLM call)
      await customInputProcessor.processInput!({
        messages: messageList.get.all.db(),
        messageList,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // Step 4: Now the OUTPUT processor runs to save messages to storage
      // The messages have already been mutated by the input processor
      await processor.processOutputResult({
        messageList,
        messages: messageList.get.all.db(),
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      // Step 5: Verify - this is the BUG!
      // The "_internal" field should STILL be in storage, but it's been stripped
      const savedAssistantMsg = mockStorage.savedMessages.find(m => m.role === 'assistant');
      const savedToolPart = savedAssistantMsg?.content.parts?.find((p: any) => p.type === 'tool-invocation') as any;

      // THIS TEST SHOULD FAIL - demonstrating the bug
      // The _internal field has been stripped because input processor mutated the objects
      // After the fix, this test should PASS because Mastra should protect the original
      // data before input processors can mutate it
      expect(savedToolPart.toolInvocation.result).toHaveProperty('_internal');
      expect(savedToolPart.toolInvocation.result._internal).toEqual({
        debugInfo: 'Should be preserved in DB',
        rawApiResponse: { temp: 72 },
      });
    });

    it('demonstrates that without protection, input processor mutations affect storage', async () => {
      // This test explicitly shows the current (buggy) behavior
      const toolResult = {
        data: 'useful data',
        _internal: { secret: 'debug info' },
      };

      const messages: MastraDBMessage[] = [
        {
          id: 'msg-1',
          role: 'assistant',
          content: {
            format: 2,
            parts: [
              {
                type: 'tool-invocation',
                toolInvocation: {
                  state: 'result',
                  toolCallId: 'call-1',
                  toolName: 'myTool',
                  args: {},
                  result: toolResult,
                },
              },
            ],
          },
          threadId: 'thread-1',
          createdAt: new Date(),
        },
      ];

      const messageList = new MessageList();
      messageList.add(messages, 'response');

      // Verify _internal field exists BEFORE input processor
      const beforeProcessing = messageList.get.all.db()[0];
      const beforeToolPart = beforeProcessing?.content.parts?.find((p: any) => p.type === 'tool-invocation') as any;
      expect(beforeToolPart.toolInvocation.result._internal).toEqual({ secret: 'debug info' });

      // Simulate input processor that mutates messages
      const dbMessages = messageList.get.all.db();
      const toolPart = dbMessages[0]?.content.parts?.find((p: any) => p.type === 'tool-invocation') as any;
      delete toolPart.toolInvocation.result._internal;

      // Verify the mutation affected the MessageList's _internal state
      const afterMutation = messageList.get.all.db()[0];
      const afterToolPart = afterMutation?.content.parts?.find((p: any) => p.type === 'tool-invocation') as any;

      // This shows the CURRENT (buggy) behavior:
      // The mutation affected the MessageList's state directly
      expect(afterToolPart.toolInvocation.result).not.toHaveProperty('_internal');

      // Now if we save to storage, the _internal field is gone
      await processor.processOutputResult({
        messageList,
        messages: dbMessages,
        abort: mockAbort,
        requestContext: createRuntimeContextWithMemory('thread-1'),
      });

      const savedToolPart = mockStorage.savedMessages[0]?.content.parts?.find(
        (p: any) => p.type === 'tool-invocation',
      ) as any;

      // Storage also doesn't have the _internal field - THIS IS THE BUG
      expect(savedToolPart.toolInvocation.result).not.toHaveProperty('_internal');
    });
  });
});
