import type { TextPart } from '@internal/ai-sdk-v4';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import { TripWire } from '../agent/trip-wire';
import type { IMastraLogger } from '../logger';
import type { ChunkType } from '../stream';
import { ChunkFrom } from '../stream/types';
import { ProcessorRunner } from './runner';
import type { Processor } from './index';

// Helper to create a message
const createMessage = (content: string, role: 'user' | 'assistant' = 'user') => ({
  id: `msg-${Math.random()}`,
  role,
  content: {
    format: 2 as const,
    parts: [{ type: 'text' as const, text: content }],
  },
  createdAt: new Date(),
  threadId: 'test-thread',
});

// Mock logger that implements all required methods
const mockLogger: IMastraLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  trackException: vi.fn(),
  getTransports: vi.fn(() => []),
  listLogs: vi.fn(() => []),
  listLogsByRunId: vi.fn(() => []),
} as any;

describe('ProcessorRunner', () => {
  let messageList: MessageList;
  let runner: ProcessorRunner;

  beforeEach(() => {
    messageList = new MessageList({ threadId: 'test-thread' });
    runner = new ProcessorRunner({
      inputProcessors: [],
      outputProcessors: [],
      logger: mockLogger,
      agentName: 'test-agent',
    });
  });

  describe('Input Processors', () => {
    it('should run input processors in order', async () => {
      const executionOrder: string[] = [];
      const inputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processInput: async ({ messages }) => {
            executionOrder.push('processor1');
            messages.push(createMessage('processed by 1', 'user'));
            return messages;
          },
        },
        {
          id: 'processor2',
          name: 'Processor 2',
          processInput: async ({ messages }) => {
            executionOrder.push('processor2');
            messages.push(createMessage('processed by 2', 'user'));
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('original message', 'user')], 'user');
      const result = await runner.runInputProcessors(messageList);

      expect(executionOrder).toEqual(['processor1', 'processor2']);
      const messages = await result.get.all.prompt();
      expect(messages).toHaveLength(3);
      expect((messages[0].content[0] as TextPart).text).toBe('original message');
      expect((messages[1].content[0] as TextPart).text).toBe('processed by 1');
      expect((messages[2].content[0] as TextPart).text).toBe('processed by 2');
    });

    it('should run input processors sequentially in order', async () => {
      const executionOrder: string[] = [];
      const inputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processInput: async ({ messages }) => {
            executionOrder.push('processor1-start');
            await new Promise(resolve => setTimeout(resolve, 10));
            executionOrder.push('processor1-end');
            return messages;
          },
        },
        {
          id: 'processor2',
          name: 'Processor 2',
          processInput: async ({ messages }) => {
            executionOrder.push('processor2-start');
            await new Promise(resolve => setTimeout(resolve, 10));
            executionOrder.push('processor2-end');
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('test', 'user')], 'user');
      await runner.runInputProcessors(messageList);

      expect(executionOrder).toEqual(['processor1-start', 'processor1-end', 'processor2-start', 'processor2-end']);
    });

    it('should abort if tripwire is triggered in input processor', async () => {
      const inputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processInput: async ({ messages, abort }) => {
            messages.push(createMessage('before abort', 'user'));
            abort('Test abort reason');
            return messages;
          },
        },
        {
          id: 'processor2',
          name: 'Processor 2',
          processInput: async ({ messages }) => {
            messages.push(createMessage('should not run', 'user'));
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('original', 'user')], 'user');

      await expect(runner.runInputProcessors(messageList)).rejects.toThrow(TripWire);
      await expect(runner.runInputProcessors(messageList)).rejects.toThrow('Test abort reason');
    });

    it('should abort with default message when no reason provided', async () => {
      const inputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processInput: async ({ messages: _messages, abort }) => {
            abort();
            return _messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('test', 'user')], 'user');

      await expect(runner.runInputProcessors(messageList)).rejects.toThrow(TripWire);
      await expect(runner.runInputProcessors(messageList)).rejects.toThrow('Tripwire triggered by processor1');
    });

    it('should not execute subsequent processors after tripwire', async () => {
      const executionOrder: string[] = [];
      const inputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processInput: async ({ messages, abort }) => {
            executionOrder.push('processor1');
            abort('Abort after processor1');

            return messages;
          },
        },
        {
          id: 'processor2',
          name: 'Processor 2',
          processInput: async ({ messages }) => {
            executionOrder.push('processor2');
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('test', 'user')], 'user');

      await expect(runner.runInputProcessors(messageList)).rejects.toThrow(TripWire);
      expect(executionOrder).toEqual(['processor1']);
    });

    it('should skip processors that do not implement processInput', async () => {
      const executionOrder: string[] = [];
      const inputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processInput: async ({ messages }) => {
            executionOrder.push('processor1');
            messages.push(createMessage('from processor 1', 'user'));
            return messages;
          },
        },
        {
          id: 'processor2',
          name: 'Processor 2',
          // No processInput method - should be skipped
        },
        {
          id: 'processor3',
          name: 'Processor 3',
          processInput: async ({ messages }) => {
            executionOrder.push('processor3');
            messages.push(createMessage('from processor 3', 'user'));
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('original', 'user')], 'user');
      const result = await runner.runInputProcessors(messageList);

      expect(executionOrder).toEqual(['processor1', 'processor3']);
      const messages = await result.get.all.prompt();
      expect(messages).toHaveLength(3);
      expect((messages[0].content[0] as TextPart).text).toBe('original');
      expect((messages[1].content[0] as TextPart).text).toBe('from processor 1');
      expect((messages[2].content[0] as TextPart).text).toBe('from processor 3');
    });

    /**
     * Regression test for GitHub Issue #9969
     * @see https://github.com/mastra-ai/mastra/issues/9969
     *
     * Users want to process system messages (including semantic recall, working memory,
     * and user-provided system prompts) using InputProcessors. Currently, InputProcessors
     * only receive user messages via the `messages` parameter.
     *
     * Use cases:
     * - Manipulate system prompts for smaller models (trim markdown, reduce length)
     * - Modify semantic recall to prevent context overflow ("prompt too long" errors)
     */
    describe('Issue #9969: System messages in InputProcessor', () => {
      it('should provide systemMessages parameter to processInput for accessing system messages', async () => {
        // Add system messages to the MessageList
        messageList.addSystem('You are a helpful assistant.'); // untagged system message
        messageList.addSystem('Remember the user prefers formal language.', 'user-provided'); // tagged system message
        messageList.addSystem('Relevant context from previous conversations.', 'memory'); // memory tag (like semantic recall)

        // Add a user message
        messageList.add([createMessage('Hello, how are you?', 'user')], 'input');

        let receivedMessages: any[] = [];
        let receivedSystemMessages: any[] | undefined;

        const inputProcessors: Processor[] = [
          {
            id: 'system-message-processor',
            name: 'System Message Processor',
            processInput: async ({ messages, systemMessages }) => {
              receivedMessages = messages;
              receivedSystemMessages = systemMessages;
              return messages;
            },
          },
        ];

        runner = new ProcessorRunner({
          inputProcessors,
          outputProcessors: [],
          logger: mockLogger,
          agentName: 'test-agent',
        });

        await runner.runInputProcessors(messageList);

        // The messages parameter should only contain user messages (current behavior)
        expect(receivedMessages).toHaveLength(1);
        expect(receivedMessages[0].role).toBe('user');

        // NEW: systemMessages parameter should be provided and contain all system messages
        expect(receivedSystemMessages).toBeDefined();
        expect(receivedSystemMessages).toHaveLength(3);

        // Verify system messages content
        const systemTexts = receivedSystemMessages!.map((m: any) => {
          if (typeof m.content === 'string') return m.content;
          // Handle structured content format with parts array
          if (m.content?.parts?.[0]?.text) return m.content.parts[0].text;
          return m.content;
        });
        expect(systemTexts).toContain('You are a helpful assistant.');
        expect(systemTexts).toContain('Remember the user prefers formal language.');
        expect(systemTexts).toContain('Relevant context from previous conversations.');
      });

      it('should allow InputProcessor to modify system messages via return value', async () => {
        // Add system messages
        messageList.addSystem('Original system prompt with verbose instructions.');
        messageList.addSystem('Memory context that is too long and needs trimming.', 'memory');

        // Add a user message
        messageList.add([createMessage('Hello', 'user')], 'input');

        const inputProcessors: Processor[] = [
          {
            id: 'system-trimmer',
            name: 'System Trimmer',
            processInput: async ({ messages, systemMessages }) => {
              // Modify system messages - trim them for smaller models
              if (systemMessages) {
                const modifiedSystemMessages = systemMessages.map((msg: any) => ({
                  ...msg,
                  content: typeof msg.content === 'string' ? msg.content.substring(0, 20) + '...' : msg.content,
                }));
                // Return modified system messages somehow (this is what the fix should enable)
                return { messages, systemMessages: modifiedSystemMessages };
              }
              return messages;
            },
          },
        ];

        runner = new ProcessorRunner({
          inputProcessors,
          outputProcessors: [],
          logger: mockLogger,
          agentName: 'test-agent',
        });

        const result = await runner.runInputProcessors(messageList);

        // After processing, the system messages should be modified
        const allMessages = await result.get.all.aiV5.prompt();
        const systemMessages = allMessages.filter((m: any) => m.role === 'system');

        // Verify system messages were trimmed
        expect(systemMessages).toHaveLength(2);
        systemMessages.forEach((msg: any) => {
          const content = typeof msg.content === 'string' ? msg.content : msg.content[0]?.text;
          expect(content.length).toBeLessThanOrEqual(24); // 20 chars + '...'
        });
      });

      it('should continue to allow adding new system messages via return array (existing behavior)', async () => {
        // This test verifies existing behavior that MUST NOT break
        // Processors can currently add system messages by including them in the return array

        messageList.add([createMessage('Hello', 'user')], 'input');

        const inputProcessors: Processor[] = [
          {
            id: 'system-adder',
            name: 'System Adder',
            processInput: async ({ messages }) => {
              // Add a new system message by including it in the return array
              const newSystemMessage = {
                id: `msg-${Math.random()}`,
                role: 'system' as const,
                content: {
                  format: 2 as const,
                  parts: [{ type: 'text' as const, text: 'New system instruction added by processor.' }],
                },
                createdAt: new Date(),
                threadId: 'test-thread',
              };
              return [...messages, newSystemMessage];
            },
          },
        ];

        runner = new ProcessorRunner({
          inputProcessors,
          outputProcessors: [],
          logger: mockLogger,
          agentName: 'test-agent',
        });

        const result = await runner.runInputProcessors(messageList);

        // Verify the system message was added
        const allMessages = await result.get.all.aiV5.prompt();
        const systemMessages = allMessages.filter((m: any) => m.role === 'system');

        expect(systemMessages).toHaveLength(1);
        const content =
          typeof systemMessages[0].content === 'string'
            ? systemMessages[0].content
            : (systemMessages[0].content[0] as { text?: string })?.text;
        expect(content).toBe('New system instruction added by processor.');
      });
    });

    describe('processInput void return', () => {
      it('should allow processInput to return void for side-effect-only processors', async () => {
        let sideEffectCalled = false;

        const inputProcessors: Processor[] = [
          {
            id: 'side-effect-processor',
            name: 'Side Effect Processor',
            processInput: async () => {
              // Side effect only - no message mutation
              sideEffectCalled = true;
              // Return void (undefined) - signals no changes to messages
              return;
            },
          },
        ];

        runner = new ProcessorRunner({
          inputProcessors,
          outputProcessors: [],
          logger: mockLogger,
          agentName: 'test-agent',
        });

        messageList.add([createMessage('original message', 'user')], 'user');
        const result = await runner.runInputProcessors(messageList);

        // Side effect should have been called
        expect(sideEffectCalled).toBe(true);

        // Messages should remain unchanged
        const messages = await result.get.all.prompt();
        expect(messages).toHaveLength(1);
        expect((messages[0].content[0] as TextPart).text).toBe('original message');
      });

      it('should continue processing chain when void-returning processor is in the middle', async () => {
        const executionOrder: string[] = [];

        const inputProcessors: Processor[] = [
          {
            id: 'processor1',
            name: 'Processor 1',
            processInput: async ({ messages }) => {
              executionOrder.push('processor1');
              messages.push(createMessage('from processor 1', 'user'));
              return messages;
            },
          },
          {
            id: 'void-processor',
            name: 'Void Processor',
            processInput: async () => {
              executionOrder.push('void-processor');
              // Side effect only - return void
              return undefined;
            },
          },
          {
            id: 'processor3',
            name: 'Processor 3',
            processInput: async ({ messages }) => {
              executionOrder.push('processor3');
              messages.push(createMessage('from processor 3', 'user'));
              return messages;
            },
          },
        ];

        runner = new ProcessorRunner({
          inputProcessors,
          outputProcessors: [],
          logger: mockLogger,
          agentName: 'test-agent',
        });

        messageList.add([createMessage('original', 'user')], 'user');
        const result = await runner.runInputProcessors(messageList);

        // All processors should run in order
        expect(executionOrder).toEqual(['processor1', 'void-processor', 'processor3']);

        // Messages should include additions from processor1 and processor3
        const messages = await result.get.all.prompt();
        expect(messages).toHaveLength(3);
        expect((messages[0].content[0] as TextPart).text).toBe('original');
        expect((messages[1].content[0] as TextPart).text).toBe('from processor 1');
        expect((messages[2].content[0] as TextPart).text).toBe('from processor 3');
      });
    });
  });

  describe('Output Processors', () => {
    it('should run output processors in order', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processOutputResult: async ({ messages }) => {
            messages.push(createMessage('extra message A', 'assistant'));
            return messages;
          },
        },
        {
          id: 'processor2',
          name: 'Processor 2',
          processOutputResult: async ({ messages }) => {
            messages.push(createMessage('extra message B', 'assistant'));
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      // Add some initial response messages to process
      messageList.add([createMessage('initial response', 'assistant')], 'response');

      const result = await runner.runOutputProcessors(messageList);

      const messages = await result.get.all.prompt();
      expect(messages).toHaveLength(2);

      const assistantMessage = messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage!.content).toHaveLength(3);
      expect((assistantMessage!.content[0] as TextPart).text).toBe('initial response');
      expect((assistantMessage!.content[1] as TextPart).text).toBe('extra message A');
      expect((assistantMessage!.content[2] as TextPart).text).toBe('extra message B');
    });

    it('should abort if tripwire is triggered in output processor', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processOutputResult: async ({ messages, abort }) => {
            messages.push(createMessage('before abort', 'assistant'));
            abort('Output processor abort');
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('original', 'assistant')], 'response');

      await expect(runner.runOutputProcessors(messageList)).rejects.toThrow(TripWire);
      await expect(runner.runOutputProcessors(messageList)).rejects.toThrow('Output processor abort');
    });

    it('should skip processors that do not implement processOutputResult', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processOutputResult: async ({ messages }) => {
            messages.push(createMessage('message from processor 1', 'assistant'));
            return messages;
          },
        },
        {
          id: 'processor2',
          name: 'Processor 2',
          // No processOutputResult method - should be skipped
        },
        {
          id: 'processor3',
          name: 'Processor 3',
          processOutputResult: async ({ messages }) => {
            messages.push(createMessage('message from processor 3', 'assistant'));
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      // Add some initial response messages to process
      messageList.add([createMessage('initial response', 'assistant')], 'response');

      const result = await runner.runOutputProcessors(messageList);
      const messages = await result.get.all.prompt();

      expect(messages).toHaveLength(2);

      const assistantMessage = messages.find(m => m.role === 'assistant');
      expect(assistantMessage).toBeDefined();
      expect(assistantMessage!.content).toHaveLength(3);
      expect((assistantMessage!.content[0] as TextPart).text).toBe('initial response');
      expect((assistantMessage!.content[1] as TextPart).text).toBe('message from processor 1');
      expect((assistantMessage!.content[2] as TextPart).text).toBe('message from processor 3');
    });
  });

  describe('Stream Processing', () => {
    it('should process text chunks through output processors', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processOutputStream: async ({ part }) => {
            // Only process text-delta chunks
            if (part.type === 'text-delta') {
              return {
                type: 'text-delta',
                payload: { text: part.payload.text.toUpperCase() },
                runId: part.runId,
                from: part.from,
              } as ChunkType;
            }
            return part;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();
      const result = await runner.processPart(
        { type: 'text-delta', payload: { text: 'hello world', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result.blocked).toBe(false);
    });

    it('should abort stream when processor calls abort', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processOutputStream: async ({ part, abort }) => {
            if (part.type === 'text-delta' && part.payload.text?.includes('blocked')) {
              abort('Content blocked');
            }
            return part;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();
      const result = await runner.processPart(
        { type: 'text-delta', payload: { text: 'blocked content', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result.part).toBe(null); // When aborted, part is null
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Content blocked');
    });

    it('should handle processor errors gracefully', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processOutputStream: async () => {
            throw new Error('Processor error');
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();
      const result = await runner.processPart(
        { type: 'text-delta', payload: { text: 'test content', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result.part?.type === 'text-delta' ? result.part?.payload.text : '').toBe('test content'); // Should return original text on error
      expect(result.blocked).toBe(false);
    });

    it('should skip processors that do not implement processOutputStream', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processOutputStream: async ({ part }) => {
            // Only process text-delta chunks
            if (part.type === 'text-delta') {
              return {
                type: 'text-delta',
                payload: { text: part.payload.text.toUpperCase() },
                runId: part.runId,
                from: part.from,
              } as ChunkType;
            }
            return part;
          },
        },
        {
          id: 'processor2',
          name: 'Processor 2',
          // No processOutputStream method - should be skipped
        },
        {
          id: 'processor3',
          name: 'Processor 3',
          processOutputStream: async ({ part }) => {
            // Only process text-delta chunks
            if (part.type === 'text-delta') {
              return {
                type: 'text-delta',
                payload: { text: part.payload.text + '!' },
                runId: part.runId,
                from: part.from,
              } as ChunkType;
            }
            return part;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();
      const result = await runner.processPart(
        { type: 'text-delta', payload: { text: 'hello', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result.part?.type === 'text-delta' ? result.part?.payload.text : '').toBe('HELLO!');
      expect(result.blocked).toBe(false);
    });

    it('should return original text when no output processors are configured', async () => {
      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();
      const result = await runner.processPart(
        { type: 'text-delta', payload: { text: 'original text', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result.part?.type === 'text-delta' ? result.part?.payload.text : '').toBe('original text');
      expect(result.blocked).toBe(false);
    });
  });

  describe('Stateful Stream Processing', () => {
    it('should process chunks with state management', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'statefulProcessor',
          name: 'Stateful Processor',
          processOutputStream: async ({ part, streamParts }) => {
            // Only emit when we have a complete sentence (ends with period)
            const shouldEmit = part.type === 'text-delta' && part.payload.text?.includes('.');
            if (shouldEmit) {
              const textToEmit = streamParts.map(c => (c.type === 'text-delta' ? c.payload.text : '')).join('');
              return {
                type: 'text-delta',
                payload: { text: textToEmit },
                runId: part.runId,
                from: part.from,
              } as ChunkType;
            }
            return null;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();

      // Process chunks
      const result1 = await runner.processPart(
        { type: 'text-delta', payload: { text: 'Hello world', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result1.part).toBe(null); // No period, so no emission

      const result2 = await runner.processPart(
        { type: 'text-delta', payload: { text: '.', id: 'text-2' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result2.part?.type === 'text-delta' ? result2.part?.payload.text : '').toBe('Hello world.'); // Complete sentence, should emit
    });

    it('should accumulate chunks for moderation decisions', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'moderationProcessor',
          name: 'Moderation Processor',
          processOutputStream: async ({ part, abort, streamParts }) => {
            // Check for violence in accumulated text
            const accumulatedText = streamParts.map(c => (c.type === 'text-delta' ? c.payload.text : '')).join('');

            if (accumulatedText.includes('punch') && accumulatedText.includes('face')) {
              abort('Violent content detected');
            }

            return part; // Emit the part as-is
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();

      // Process harmless chunks
      const result1 = await runner.processPart(
        { type: 'text-delta', payload: { text: 'i want to ', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result1.part?.type === 'text-delta' ? result1.part?.payload.text : '').toBe('i want to ');

      const result2 = await runner.processPart(
        { type: 'text-delta', payload: { text: 'punch', id: 'text-2' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result2.part?.type === 'text-delta' ? result2.part?.payload.text : '').toBe('punch');

      // This part should trigger the violence detection
      const result3 = await runner.processPart(
        { type: 'text-delta', payload: { text: ' you in the face', id: 'text-3' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result3.part).toBe(null); // When aborted, part is null
      expect(result3.blocked).toBe(true);
      expect(result3.reason).toBe('Violent content detected');
    });

    it('should handle custom state management', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'customStateProcessor',
          name: 'Custom State Processor',
          processOutputStream: async ({ part, state }) => {
            // Track word count in custom state
            const wordCount = state.wordCount || 0;
            if (part.type === 'text-delta') {
              const newWordCount = wordCount + part.payload.text.split(' ').filter(word => word.length > 0).length;
              state.wordCount = newWordCount;
            }

            // Only emit every 3 words
            const shouldEmit = state.wordCount % 3 === 0;
            if (shouldEmit) {
              return {
                type: 'text-delta',
                payload: { text: part.type === 'text-delta' ? part.payload.text.toUpperCase() : '' },
                runId: part.runId,
                from: part.from,
              } as ChunkType;
            }
            return null;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();

      const result1 = await runner.processPart(
        { type: 'text-delta', payload: { text: 'hello world', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result1.part).toBe(null);

      const result2 = await runner.processPart(
        { type: 'text-delta', payload: { text: ' goodbye', id: 'text-2' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result2.part?.type === 'text-delta' ? result2.part?.payload.text : '').toBe(' GOODBYE');
    });

    it('should handle stream end detection', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'streamEndProcessor',
          name: 'Stream End Processor',
          processOutputStream: async ({ part, streamParts }) => {
            if (part.type === 'text-delta' && part.payload.text === '') {
              // Emit accumulated text at stream end
              return {
                type: 'text-delta',
                payload: {
                  text: streamParts
                    .map(c => (c.type === 'text-delta' ? c.payload.text : ''))
                    .join('')
                    .toUpperCase(),
                },
                runId: part.runId,
                from: part.from,
              } as ChunkType;
            }

            return null;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();

      // Process chunks without emitting
      await runner.processPart(
        { type: 'text-delta', payload: { text: 'hello', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      await runner.processPart(
        { type: 'text-delta', payload: { text: ' world', id: 'text-2' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );

      // Simulate stream end by processing an empty part

      const result = await runner.processPart(
        { type: 'text-delta', payload: { text: '', id: 'text-3' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result.part?.type === 'text-delta' ? result.part?.payload.text : '').toBe('HELLO WORLD');
    });
  });

  describe('Stream Processing Integration', () => {
    it('should create a readable stream that processes text chunks', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'filterProcessor',
          name: 'Filter Processor',
          processOutputStream: async ({ part }) => {
            // Only process text-delta chunks
            if (part.type === 'text-delta' && part.payload.text?.includes('blocked')) {
              return null;
            }
            return part;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      // Create a mock stream
      const mockStream = {
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', payload: { text: 'Hello world' } });
            controller.enqueue({ type: 'text-delta', payload: { text: 'This is blocked content' } });
            controller.enqueue({ type: 'text-delta', payload: { text: 'But this is allowed' } });
            controller.enqueue({ type: 'finish' });
            controller.close();
          },
        }),
      };

      const processedStream = await runner.runOutputProcessorsForStream(mockStream as any);
      const reader = processedStream.getReader();
      const chunks: ChunkType[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Should filter out blocked content
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ type: 'text-delta', payload: { text: 'Hello world' } });
      expect(chunks[1]).toEqual({ type: 'text-delta', payload: { text: 'But this is allowed' } });
      expect(chunks[2]).toEqual({ type: 'finish' });
    });

    it('should emit tripwire when processor aborts stream', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'abortProcessor',
          name: 'Abort Processor',
          processOutputStream: async ({ part, abort }) => {
            // Only process text-delta chunks
            if (part.type === 'text-delta' && part.payload.text?.includes('abort')) {
              abort('Stream aborted');
            }
            return part;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const mockStream = {
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', payload: { text: 'Hello' } });
            controller.enqueue({ type: 'text-delta', payload: { text: 'abort now' } });
            controller.close();
          },
        }),
      };

      const processedStream = await runner.runOutputProcessorsForStream(mockStream as any);
      const reader = processedStream.getReader();
      const chunks: ChunkType[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ type: 'text-delta', payload: { text: 'Hello' } });
      expect(chunks[1]).toEqual({
        type: 'tripwire',
        payload: {
          reason: 'Stream aborted',
          retry: undefined,
          metadata: undefined,
          processorId: 'abortProcessor',
        },
      });
    });

    it('should pass through non-text chunks unchanged', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'textProcessor',
          name: 'Text Processor',
          processOutputStream: async ({ part }) => {
            // Only process text-delta chunks
            if (part.type === 'text-delta') {
              return {
                type: 'text-delta',
                payload: { text: part.payload.text.toUpperCase() },
                runId: part.runId,
                from: part.from,
              } as ChunkType;
            }
            return part;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const mockStream = {
        fullStream: new ReadableStream({
          start(controller) {
            controller.enqueue({ type: 'text-delta', payload: { text: 'hello' } });
            controller.enqueue({ type: 'tool-call', toolCallId: '123' });
            controller.enqueue({ type: 'finish' });
            controller.close();
          },
        }),
      };

      const processedStream = await runner.runOutputProcessorsForStream(mockStream as any);
      const reader = processedStream.getReader();
      const chunks: ChunkType[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ type: 'text-delta', payload: { text: 'HELLO' } });
      expect(chunks[1]).toEqual({ type: 'tool-call', toolCallId: '123' });
      expect(chunks[2]).toEqual({ type: 'finish' });
    });
  });

  /**
   * Regression test for GitHub Issue #7933
   * @see https://github.com/mastra-ai/mastra/issues/7933
   *
   * Users want access to remembered messages in OutputProcessor.processOutputStream,
   * similar to how Scorers have access to them. This enables use cases like:
   * - Checking if output is grounded on tool executions from previous messages
   * - Using OutputProcessor as guardrails that need conversation context
   */
  describe('Issue #7933: Remembered messages in OutputProcessor', () => {
    it('should provide messageList to processOutputStream for accessing remembered messages', async () => {
      // Create a MessageList with some remembered messages (from memory)
      const testMessageList = new MessageList({ threadId: 'test-thread' });

      // Add input message (from user)
      testMessageList.add([createMessage('current user message', 'user')], 'input');

      // Add remembered messages (from memory - simulating conversation history)
      const rememberedMsg1 = createMessage('previous user question', 'user');
      const rememberedMsg2 = createMessage('previous assistant answer with tool call', 'assistant');
      testMessageList.add([rememberedMsg1, rememberedMsg2], 'memory');

      let receivedMessageList: MessageList | undefined;
      let rememberedMessagesCount: number | undefined;

      const outputProcessors: Processor[] = [
        {
          id: 'grounding-check-processor',
          name: 'Grounding Check Processor',
          processOutputStream: async ({ part, messageList }) => {
            // Store the messageList received for assertion
            receivedMessageList = messageList;

            // Try to access remembered messages (this is what Issue #7933 requests)
            if (messageList) {
              const rememberedMessages = messageList.get.remembered.db();
              rememberedMessagesCount = rememberedMessages.length;
            }

            return part;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();

      // Process a stream chunk - this should pass the messageList
      await runner.processPart(
        {
          type: 'text-delta',
          payload: { text: 'test response', id: 'text-1' },
          runId: 'test-run',
          from: ChunkFrom.AGENT,
        },
        processorStates,
        undefined, // tracingContext
        undefined, // requestContext
        testMessageList, // messageList - this parameter needs to be added to processPart
      );

      // Assert that messageList was passed to processOutputStream
      expect(receivedMessageList).toBeDefined();
      expect(receivedMessageList).toBe(testMessageList);

      // Assert that remembered messages are accessible
      expect(rememberedMessagesCount).toBe(2);
    });

    it('should allow processOutputStream to check if output is grounded on previous tool calls', async () => {
      // This simulates the use case described in Issue #7933:
      // "checking if the content of the answer is grounded on tool executions
      // made on previous answers by the assistant"

      const testMessageList = new MessageList({ threadId: 'test-thread' });

      // Add a previous assistant message with tool call (remembered from memory)
      const previousAssistantMessage = {
        id: `msg-${Math.random()}`,
        role: 'assistant' as const,
        content: {
          format: 2 as const,
          parts: [{ type: 'text' as const, text: 'Let me search for that information.' }],
          toolInvocations: [
            {
              state: 'result' as const,
              toolCallId: 'tool-call-1',
              toolName: 'search_documents',
              args: { query: 'product pricing' },
              result: { documents: [{ title: 'Pricing Guide', content: 'Product costs $99' }] },
            },
          ],
        },
        createdAt: new Date(),
        threadId: 'test-thread',
      };
      testMessageList.add([previousAssistantMessage], 'memory');

      // Add current user input
      testMessageList.add([createMessage('What is the price?', 'user')], 'input');

      let groundingCheckPassed = false;

      const outputProcessors: Processor[] = [
        {
          id: 'grounding-validator',
          name: 'Grounding Validator',
          processOutputStream: async ({ part, messageList, abort }) => {
            if (!messageList) {
              abort('messageList not available - cannot verify grounding');
            }

            // Get remembered messages to find previous tool calls
            const rememberedMessages = messageList!.get.remembered.db();
            const previousToolCalls = rememberedMessages
              .filter(m => m.role === 'assistant')
              .flatMap(m => m.content.toolInvocations || []);

            // Check if there are previous tool calls to ground the response
            if (previousToolCalls.length > 0) {
              groundingCheckPassed = true;
            }

            return part;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();

      await runner.processPart(
        {
          type: 'text-delta',
          payload: { text: 'The product costs $99', id: 'text-1' },
          runId: 'test-run',
          from: ChunkFrom.AGENT,
        },
        processorStates,
        undefined,
        undefined,
        testMessageList,
      );

      expect(groundingCheckPassed).toBe(true);
    });
  });

  describe('abort() with options', () => {
    it('should pass retry option through TripWire', async () => {
      const inputProcessors: Processor[] = [
        {
          id: 'retry-processor',
          name: 'Retry Processor',
          processInput: async ({ abort }) => {
            abort('Please retry with better input', { retry: true });
            return [];
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('test', 'user')], 'user');

      try {
        await runner.runInputProcessors(messageList);
        expect.fail('Should have thrown TripWire');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        const tripwire = error as TripWire;
        expect(tripwire.message).toBe('Please retry with better input');
        expect(tripwire.options.retry).toBe(true);
      }
    });

    it('should pass metadata option through TripWire', async () => {
      interface PIIMetadata {
        detectedTypes: string[];
        severity: 'low' | 'high';
      }

      const inputProcessors: Processor[] = [
        {
          id: 'pii-processor',
          name: 'PII Processor',
          processInput: async ({ abort }) => {
            abort<PIIMetadata>('PII detected', {
              metadata: {
                detectedTypes: ['email', 'phone'],
                severity: 'high',
              },
            });
            return [];
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('test', 'user')], 'user');

      try {
        await runner.runInputProcessors(messageList);
        expect.fail('Should have thrown TripWire');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        const tripwire = error as TripWire<PIIMetadata>;
        expect(tripwire.message).toBe('PII detected');
        expect(tripwire.options.metadata).toEqual({
          detectedTypes: ['email', 'phone'],
          severity: 'high',
        });
      }
    });

    it('should pass both retry and metadata options through TripWire', async () => {
      interface ToneMetadata {
        issue: string;
        suggestion: string;
      }

      const inputProcessors: Processor[] = [
        {
          id: 'tone-processor',
          name: 'Tone Processor',
          processInput: async ({ abort }) => {
            abort<ToneMetadata>('Tone is too informal', {
              retry: true,
              metadata: {
                issue: 'informal language',
                suggestion: 'Use professional tone',
              },
            });
            return [];
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('test', 'user')], 'user');

      try {
        await runner.runInputProcessors(messageList);
        expect.fail('Should have thrown TripWire');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        const tripwire = error as TripWire<ToneMetadata>;
        expect(tripwire.message).toBe('Tone is too informal');
        expect(tripwire.options.retry).toBe(true);
        expect(tripwire.options.metadata).toEqual({
          issue: 'informal language',
          suggestion: 'Use professional tone',
        });
      }
    });

    it('should receive retryCount in processor context', async () => {
      let receivedRetryCount: number | undefined;

      const inputProcessors: Processor[] = [
        {
          id: 'count-processor',
          name: 'Count Processor',
          processInput: async ({ messages, retryCount }) => {
            receivedRetryCount = retryCount;
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors,
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('test', 'user')], 'user');

      // Test with default retryCount (0)
      await runner.runInputProcessors(messageList);
      expect(receivedRetryCount).toBe(0);

      // Test with explicit retryCount
      await runner.runInputProcessors(messageList, undefined, undefined, 3);
      expect(receivedRetryCount).toBe(3);
    });

    it('should pass tripwire options through processPart for output processors', async () => {
      interface ContentMetadata {
        category: string;
        confidence: number;
      }

      const outputProcessors: Processor[] = [
        {
          id: 'content-filter',
          name: 'Content Filter',
          processOutputStream: async ({ abort }) => {
            abort<ContentMetadata>('Inappropriate content detected', {
              retry: true,
              metadata: {
                category: 'violence',
                confidence: 0.95,
              },
            });
            return null;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();
      const result = await runner.processPart(
        {
          type: 'text-delta',
          payload: { text: 'test content', id: '1' },
          runId: 'test-run',
          from: ChunkFrom.AGENT,
        },
        processorStates,
      );

      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Inappropriate content detected');
      expect(result.tripwireOptions?.retry).toBe(true);
      expect(result.tripwireOptions?.metadata).toEqual({
        category: 'violence',
        confidence: 0.95,
      });
      expect(result.processorId).toBe('content-filter');
    });

    it('should receive retryCount in processOutputStream context', async () => {
      let receivedRetryCount: number | undefined;

      const outputProcessors: Processor[] = [
        {
          id: 'stream-processor',
          name: 'Stream Processor',
          processOutputStream: async ({ part, retryCount }) => {
            receivedRetryCount = retryCount;
            return part;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();

      // Test with default retryCount (0)
      await runner.processPart(
        {
          type: 'text-delta',
          payload: { text: 'test', id: '1' },
          runId: 'test-run',
          from: ChunkFrom.AGENT,
        },
        processorStates,
      );
      expect(receivedRetryCount).toBe(0);

      // Test with explicit retryCount
      await runner.processPart(
        {
          type: 'text-delta',
          payload: { text: 'test', id: '2' },
          runId: 'test-run',
          from: ChunkFrom.AGENT,
        },
        processorStates,
        undefined,
        undefined,
        undefined,
        5,
      );
      expect(receivedRetryCount).toBe(5);
    });
  });

  describe('processOutputStep', () => {
    it('should run output step processors in order', async () => {
      const executionOrder: string[] = [];
      const outputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processOutputStep: async ({ messages }) => {
            executionOrder.push('processor1');
            return messages;
          },
        },
        {
          id: 'processor2',
          name: 'Processor 2',
          processOutputStep: async ({ messages }) => {
            executionOrder.push('processor2');
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('user message', 'user')], 'user');
      messageList.add([createMessage('assistant response', 'assistant')], 'response');

      await runner.runProcessOutputStep({
        steps: [],
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
        finishReason: 'stop',
        text: 'assistant response',
      });

      expect(executionOrder).toEqual(['processor1', 'processor2']);
    });

    it('should receive step context in processOutputStep', async () => {
      let receivedContext: {
        stepNumber?: number;
        finishReason?: string;
        toolCalls?: unknown[];
        text?: string;
        retryCount?: number;
      } = {};

      const outputProcessors: Processor[] = [
        {
          id: 'context-processor',
          name: 'Context Processor',
          processOutputStep: async ({ messages, stepNumber, finishReason, toolCalls, text, retryCount }) => {
            receivedContext = { stepNumber, finishReason, toolCalls, text, retryCount };
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('user message', 'user')], 'user');

      const toolCalls = [{ toolName: 'search', toolCallId: 'call-1', args: { query: 'test' } }];

      await runner.runProcessOutputStep({
        steps: [],
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 2,
        finishReason: 'tool-use',
        toolCalls,
        text: 'Let me search for that',
        retryCount: 1,
      });

      expect(receivedContext.stepNumber).toBe(2);
      expect(receivedContext.finishReason).toBe('tool-use');
      expect(receivedContext.toolCalls).toEqual(toolCalls);
      expect(receivedContext.text).toBe('Let me search for that');
      expect(receivedContext.retryCount).toBe(1);
    });

    it('should abort with retry option in processOutputStep', async () => {
      interface ToneMetadata {
        issue: string;
        suggestion: string;
      }

      const outputProcessors: Processor[] = [
        {
          id: 'tone-checker',
          name: 'Tone Checker',
          processOutputStep: async ({ abort, retryCount }) => {
            if (retryCount < 3) {
              abort('Response tone is too informal', {
                retry: true,
                metadata: {
                  issue: 'informal language',
                  suggestion: 'Use professional tone',
                } as ToneMetadata,
              });
            }
            return [];
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('user message', 'user')], 'user');

      try {
        await runner.runProcessOutputStep({
          steps: [],
          messages: messageList.get.all.db(),
          messageList,
          stepNumber: 0,
          text: 'hey whats up',
          retryCount: 0,
        });
        expect.fail('Should have thrown TripWire');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        const tripwire = error as TripWire<ToneMetadata>;
        expect(tripwire.message).toBe('Response tone is too informal');
        expect(tripwire.options.retry).toBe(true);
        expect(tripwire.options.metadata).toEqual({
          issue: 'informal language',
          suggestion: 'Use professional tone',
        });
      }
    });

    it('should not abort when retryCount exceeds threshold', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'conditional-retry',
          name: 'Conditional Retry',
          processOutputStep: async ({ messages, abort, retryCount }) => {
            if (retryCount < 3) {
              abort('Need to retry', { retry: true });
            }
            // After 3 retries, let it pass
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('user message', 'user')], 'user');

      // Should pass when retryCount is 3 or higher
      const result = await runner.runProcessOutputStep({
        steps: [],
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
        retryCount: 3,
      });

      expect(result).toBe(messageList);
    });

    it('should stop execution after tripwire in processOutputStep', async () => {
      const executionOrder: string[] = [];
      const outputProcessors: Processor[] = [
        {
          id: 'processor1',
          name: 'Processor 1',
          processOutputStep: async ({ abort }) => {
            executionOrder.push('processor1');
            abort('Blocked by processor1');
            return [];
          },
        },
        {
          id: 'processor2',
          name: 'Processor 2',
          processOutputStep: async ({ messages }) => {
            executionOrder.push('processor2');
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('user message', 'user')], 'user');

      try {
        await runner.runProcessOutputStep({
          steps: [],
          messages: messageList.get.all.db(),
          messageList,
          stepNumber: 0,
        });
      } catch {
        // Expected
      }

      // processor2 should not have run
      expect(executionOrder).toEqual(['processor1']);
    });

    it('should skip processors that do not implement processOutputStep', async () => {
      const executionOrder: string[] = [];
      const outputProcessors: Processor[] = [
        {
          id: 'stream-only',
          name: 'Stream Only Processor',
          // Only implements processOutputStream, not processOutputStep
          processOutputStream: async ({ part }) => {
            executionOrder.push('stream-only');
            return part;
          },
        },
        {
          id: 'step-processor',
          name: 'Step Processor',
          processOutputStep: async ({ messages }) => {
            executionOrder.push('step-processor');
            return messages;
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('user message', 'user')], 'user');

      await runner.runProcessOutputStep({
        steps: [],
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
      });

      // Only step-processor should have run
      expect(executionOrder).toEqual(['step-processor']);
    });

    it('should be able to modify messages in processOutputStep', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'message-modifier',
          name: 'Message Modifier',
          processOutputStep: async ({ messages }) => {
            // Add a new message
            return [...messages, createMessage('Added by processor', 'assistant')];
          },
        },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add([createMessage('user message', 'user')], 'user');

      const result = await runner.runProcessOutputStep({
        steps: [],
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
      });

      const allMessages = result.get.all.db();
      expect(allMessages).toHaveLength(2);
      expect(allMessages[1].role).toBe('assistant');
    });
  });
});
