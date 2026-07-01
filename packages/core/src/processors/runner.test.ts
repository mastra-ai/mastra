import type { TextPart } from '@internal/ai-sdk-v4';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import { createSignal } from '../agent/signals';
import { TripWire } from '../agent/trip-wire';
import type { IMastraLogger } from '../logger';
import { RequestContext } from '../request-context';
import type { ChunkType } from '../stream';
import { ChunkFrom } from '../stream/types';
import { createStep, createWorkflow } from '../workflows';
import { ProcessorRunner } from './runner';
import { ProcessorStepSchema } from './step-schema';
import type { Processor, ProcessorWorkflow } from './index';

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

    it('should call onViolation when a processor triggers abort()', async () => {
      const onViolation = vi.fn();
      const inputProcessors: Processor[] = [
        {
          id: 'guard-processor',
          name: 'Guard',
          onViolation,
          processInput: async ({ abort }) => {
            abort('Cost exceeded', { metadata: { limit: 5, usage: 7 } });
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

      await expect(runner.runInputProcessors(messageList)).rejects.toThrow(TripWire);
      expect(onViolation).toHaveBeenCalledWith({
        processorId: 'guard-processor',
        message: 'Cost exceeded',
        detail: { limit: 5, usage: 7 },
      });
    });

    it('should not fail if onViolation throws', async () => {
      const onViolation = vi.fn().mockRejectedValue(new Error('callback error'));
      const inputProcessors: Processor[] = [
        {
          id: 'guard-processor',
          name: 'Guard',
          onViolation,
          processInput: async ({ abort }) => {
            abort('Blocked');
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

      await expect(runner.runInputProcessors(messageList)).rejects.toThrow(TripWire);
      expect(onViolation).toHaveBeenCalled();
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

        // systemMessages parameter exposes the untagged system message bucket only.
        // Tagged buckets remain owned by the processors that added them and reach the
        // model via messageList.getAllSystemMessages() at final assembly.
        expect(receivedSystemMessages).toBeDefined();
        expect(receivedSystemMessages).toHaveLength(1);

        const systemTexts = receivedSystemMessages!.map((m: any) => {
          if (typeof m.content === 'string') return m.content;
          if (m.content?.parts?.[0]?.text) return m.content.parts[0].text;
          return m.content;
        });
        expect(systemTexts).toEqual(['You are a helpful assistant.']);

        const allSystemTexts = messageList.getAllSystemMessages().map((m: any) => m.content);
        expect(allSystemTexts).toContain('You are a helpful assistant.');
        expect(allSystemTexts).toContain('Remember the user prefers formal language.');
        expect(allSystemTexts).toContain('Relevant context from previous conversations.');
      });

      it('should preserve tagged system messages when InputProcessor returns systemMessages', async () => {
        messageList.addSystem('Original system prompt.');
        messageList.addSystem('Memory context.', 'memory');
        messageList.add([createMessage('Hello', 'user')], 'input');

        const inputProcessors: Processor[] = [
          {
            id: 'system-appender',
            name: 'System Appender',
            processInput: async ({ messages, systemMessages }) => {
              return {
                messages,
                systemMessages: [...systemMessages, { role: 'system' as const, content: 'Appended instruction.' }],
              };
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

        expect(result.getSystemMessages().map(m => m.content)).toEqual([
          'Original system prompt.',
          'Appended instruction.',
        ]);
        expect(result.getSystemMessages('memory').map(m => m.content)).toEqual(['Memory context.']);
      });

      it('should not pass tagged system messages into processor args.systemMessages', async () => {
        let seenSystemMessages: any[] = [];
        messageList.addSystem('Original system prompt.');
        messageList.addSystem('Memory context.', 'memory');
        messageList.add([createMessage('Hello', 'user')], 'input');

        const inputProcessors: Processor[] = [
          {
            id: 'system-inspector',
            name: 'System Inspector',
            processInput: async ({ messages, systemMessages }) => {
              seenSystemMessages = systemMessages;
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

        expect(seenSystemMessages.map(m => m.content)).toEqual(['Original system prompt.']);
        expect(result.getAllSystemMessages().map(m => m.content)).toEqual([
          'Original system prompt.',
          'Memory context.',
        ]);
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
      const assistantTexts = messages
        .filter(m => m.role === 'assistant')
        .flatMap(m => (Array.isArray(m.content) ? m.content : [{ type: 'text' as const, text: m.content }]))
        .map(part => (part as TextPart).text);

      expect(assistantTexts).toEqual(['initial response', 'extra message A', 'extra message B']);
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
      const assistantTexts = messages
        .filter(m => m.role === 'assistant')
        .flatMap(m => (Array.isArray(m.content) ? m.content : [{ type: 'text' as const, text: m.content }]))
        .map(part => (part as TextPart).text);

      expect(assistantTexts).toEqual(['initial response', 'message from processor 1', 'message from processor 3']);
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

  describe('drainReprocessParts', () => {
    const makeTextDelta = (text: string): ChunkType => ({
      type: 'text-delta',
      payload: { text, id: 'text-1' },
      runId: '1',
      from: ChunkFrom.AGENT,
    });

    it('re-drives a stashed part through the whole chain and emits the result', async () => {
      const seenByDownstream: string[] = [];
      const outputProcessors: Processor[] = [
        // Upstream processor that (in real usage) stashes a part for reprocessing.
        {
          id: 'stasher',
          name: 'Stasher',
          processOutputStream: async ({ part }) => part,
        },
        // Downstream processor that uppercases text-delta parts.
        {
          id: 'uppercaser',
          name: 'Uppercaser',
          processOutputStream: async ({ part }) => {
            if (part.type === 'text-delta') {
              seenByDownstream.push(part.payload.text);
              return { ...part, payload: { ...part.payload, text: part.payload.text.toUpperCase() } } as ChunkType;
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
      // Seed the chain so the stasher's state exists, then stash a part on it.
      await runner.processPart(makeTextDelta('primary'), processorStates);
      const stasherState = processorStates.get('stasher')!;
      stasherState.customState.__mastraReprocessPart = makeTextDelta('stashed');

      const results = await runner.drainReprocessParts(processorStates);

      // The stashed part was re-driven through the downstream uppercaser.
      expect(seenByDownstream).toContain('stashed');
      expect(results).toHaveLength(1);
      expect(results[0]!.blocked).toBe(false);
      expect((results[0]!.part as any)?.payload?.text).toBe('STASHED');
      // The stash key is consumed.
      expect(stasherState.customState.__mastraReprocessPart).toBeUndefined();
    });

    it('drains parts stashed by multiple processors in processor order', async () => {
      const outputProcessors: Processor[] = [
        { id: 'first', name: 'First', processOutputStream: async ({ part }) => part },
        { id: 'second', name: 'Second', processOutputStream: async ({ part }) => part },
      ];

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();
      // Seed both processor states.
      await runner.processPart(makeTextDelta('primary'), processorStates);

      // Stash a part on each processor; drain should emit them in processor order
      // (first processor's stash before second processor's stash).
      processorStates.get('first')!.customState.__mastraReprocessPart = makeTextDelta('from-first');
      processorStates.get('second')!.customState.__mastraReprocessPart = makeTextDelta('from-second');

      const results = await runner.drainReprocessParts(processorStates);

      expect(results.map(r => (r.part as any)?.payload?.text)).toEqual(['from-first', 'from-second']);
      expect(processorStates.get('first')!.customState.__mastraReprocessPart).toBeUndefined();
      expect(processorStates.get('second')!.customState.__mastraReprocessPart).toBeUndefined();
    });

    it('returns an empty array when nothing is stashed', async () => {
      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors: [{ id: 'noop', name: 'Noop', processOutputStream: async ({ part }) => part }],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const processorStates = new Map();
      await runner.processPart(makeTextDelta('primary'), processorStates);

      const results = await runner.drainReprocessParts(processorStates);
      expect(results).toEqual([]);
    });

    it('stops draining and reports the blocked result when a reprocessed part is aborted', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'blocker',
          name: 'Blocker',
          processOutputStream: async ({ part, abort }) => {
            if (part.type === 'text-delta' && part.payload.text === 'stashed') {
              abort('blocked on reprocess');
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
      await runner.processPart(makeTextDelta('primary'), processorStates);
      processorStates.get('blocker')!.customState.__mastraReprocessPart = makeTextDelta('stashed');

      const results = await runner.drainReprocessParts(processorStates);
      expect(results).toHaveLength(1);
      expect(results[0]!.blocked).toBe(true);
      expect(results[0]!.reason).toBe('blocked on reprocess');
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

    it('should not enqueue undefined into the stream when a processor returns undefined', async () => {
      const outputProcessors: Processor[] = [
        {
          id: 'returnUndefined',
          name: 'Return Undefined',
          processOutputStream: async ({ part }) => {
            if (part.type === 'text-delta' && part.payload.text === 'bad') {
              // Simulate a processor that forgets to `return part`
              return undefined as unknown as ChunkType;
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
            controller.enqueue({ type: 'text-delta', payload: { text: 'bad' } });
            controller.enqueue({ type: 'text-delta', payload: { text: 'world' } });
            controller.enqueue({ type: 'finish' });
            controller.close();
          },
        }),
      };

      const processedStream = await runner.runOutputProcessorsForStream(mockStream as any);
      const reader = processedStream.getReader();
      const chunks: Array<ChunkType | undefined> = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Consumer should never see an `undefined` chunk.
      expect(chunks.some(c => c === undefined)).toBe(false);
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ type: 'text-delta', payload: { text: 'hello' } });
      expect(chunks[1]).toEqual({ type: 'text-delta', payload: { text: 'world' } });
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

    it('surfaces step providerMetadata to processOutputStep on a content-filter block with empty steps', async () => {
      // Mirrors the AWS Bedrock guardrail case: the model step is blocked
      // (finishReason: "content-filter"), the completed-steps array is empty,
      // and the guardrail assessment is only available via providerMetadata.
      let receivedProviderMetadata: Record<string, unknown> | undefined;

      const guardrailTrace = {
        bedrock: {
          trace: {
            guardrail: {
              actionReason: 'Guardrail blocked.',
              inputAssessment: {
                'guardrail-1': {
                  topicPolicy: { topics: [{ name: 'SystemPromptDisclosure', action: 'BLOCKED', type: 'DENY' }] },
                },
              },
            },
          },
        },
      };

      const outputProcessors: Processor[] = [
        {
          id: 'guardrail-attribution',
          name: 'Guardrail Attribution',
          processOutputStep: async ({ messages, providerMetadata }) => {
            receivedProviderMetadata = providerMetadata;
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
        finishReason: 'content-filter',
        providerMetadata: guardrailTrace,
      });

      // The processor can attribute the block to the responsible policy even
      // though `steps` is empty.
      expect(receivedProviderMetadata).toEqual(guardrailTrace);
      expect((receivedProviderMetadata as typeof guardrailTrace)?.bedrock?.trace?.guardrail?.actionReason).toBe(
        'Guardrail blocked.',
      );
    });

    it('leaves providerMetadata undefined when the step produced none', async () => {
      let received: { providerMetadata?: unknown; sawKey?: boolean } = {};

      const outputProcessors: Processor[] = [
        {
          id: 'no-metadata',
          name: 'No Metadata',
          processOutputStep: async args => {
            received = { providerMetadata: args.providerMetadata, sawKey: 'providerMetadata' in args };
            return args.messages;
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
        finishReason: 'stop',
        text: 'all good',
      });

      expect(received.providerMetadata).toBeUndefined();
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

    it('should receive usage data in processOutputStep', async () => {
      let receivedUsage: unknown = undefined;

      const outputProcessors: Processor[] = [
        {
          id: 'usage-processor',
          name: 'Usage Processor',
          processOutputStep: async ({ messages, usage }) => {
            receivedUsage = usage;
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

      const usage = {
        inputTokens: 100,
        outputTokens: 50,
        totalTokens: 150,
      };

      await runner.runProcessOutputStep({
        steps: [],
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
        usage,
      });

      expect(receivedUsage).toEqual(usage);
    });

    it('should provide default usage when not supplied', async () => {
      let receivedUsage: unknown = 'NOT_CALLED';

      const outputProcessors: Processor[] = [
        {
          id: 'usage-default-processor',
          name: 'Usage Default Processor',
          processOutputStep: async ({ messages, usage }) => {
            receivedUsage = usage;
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

      expect(receivedUsage).toEqual({
        inputTokens: undefined,
        outputTokens: undefined,
        totalTokens: undefined,
      });
    });
  });

  describe('writer availability in output processors', () => {
    it('should pass writer to processOutputResult when provided', async () => {
      let receivedWriter: unknown = 'NOT_CALLED';

      const outputProcessors: Processor[] = [
        {
          id: 'writer-test',
          name: 'Writer Test',
          processOutputResult: async ({ messages, writer }) => {
            receivedWriter = writer;
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

      messageList.add([createMessage('response', 'assistant')], 'response');

      const mockWriter = { custom: vi.fn() };
      await runner.runOutputProcessors(messageList, undefined, undefined, 0, mockWriter);

      expect(receivedWriter).toBe(mockWriter);
    });

    it('should pass writer to processOutputStream when provided', async () => {
      let receivedWriter: unknown = 'NOT_CALLED';

      const outputProcessors: Processor[] = [
        {
          id: 'writer-test',
          name: 'Writer Test',
          processOutputStream: async ({ part, writer }) => {
            receivedWriter = writer;
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
      const mockWriter = { custom: vi.fn() };
      await runner.processPart(
        { type: 'text-delta', payload: { text: 'hello', id: 'text-1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
        undefined,
        undefined,
        undefined,
        0,
        mockWriter,
      );

      expect(receivedWriter).toBe(mockWriter);
    });
  });

  describe('State sharing between processOutputStream and processOutputResult', () => {
    it('should share customState from processOutputStream in processOutputResult', async () => {
      const stateInOutputResult: Record<string, unknown> = {};

      const outputProcessors: Processor[] = [
        {
          id: 'stateShareProcessor',
          name: 'State Share Processor',
          processOutputStream: async ({ part, state }) => {
            if (part.type === 'finish') {
              state.usageData = { inputTokens: 100, outputTokens: 50 };
              state.finishReason = 'stop';
            }
            return part;
          },
          processOutputResult: ({ state, messages }) => {
            // Should be able to access state set during processOutputStream
            Object.assign(stateInOutputResult, state);
            return messages;
          },
        },
      ];

      const processorStates = new Map();

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
        processorStates,
      });

      // 1. Process stream chunks through processOutputStream
      await runner.processPart(
        { type: 'text-delta', payload: { text: 'hello' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      await runner.processPart(
        {
          type: 'finish',
          payload: {
            stepResult: { reason: 'stop' },
            output: { usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 } },
          },
          runId: '1',
          from: ChunkFrom.AGENT,
        } as ChunkType,
        processorStates,
      );

      // 2. Run processOutputResult - should see state from processOutputStream
      messageList.add(createMessage('test response', 'assistant'), 'response');
      await runner.runOutputProcessors(messageList);

      expect(stateInOutputResult.usageData).toEqual({ inputTokens: 100, outputTokens: 50 });
      expect(stateInOutputResult.finishReason).toBe('stop');
    });

    it('should provide result in processOutputResult', async () => {
      let receivedResult: any;

      const outputProcessors: Processor[] = [
        {
          id: 'resultProcessor',
          name: 'Result Processor',
          processOutputStream: async ({ part }) => {
            return part;
          },
          processOutputResult: ({ result, messages }) => {
            receivedResult = result;
            return messages;
          },
        },
      ];

      const processorStates = new Map();

      runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'test-agent',
        processorStates,
      });

      const mockResult = {
        text: 'hello world',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        finishReason: 'stop',
        steps: [],
      };

      // Run processOutputResult - should receive result
      messageList.add(createMessage('test response', 'assistant'), 'response');
      await runner.runOutputProcessors(messageList, undefined, undefined, 0, undefined, mockResult);

      expect(receivedResult).toBeDefined();
      expect(receivedResult.text).toBe('hello world');
      expect(receivedResult.usage).toEqual({ inputTokens: 10, outputTokens: 5, totalTokens: 15 });
      expect(receivedResult.finishReason).toBe('stop');
      expect(receivedResult.steps).toEqual([]);
    });

    it('should share state across two separate runners sharing the same processorStates map (real agent architecture)', async () => {
      const stateInOutputResult: Record<string, unknown> = {};

      const outputProcessors: Processor[] = [
        {
          id: 'cross-runner-state-test',
          processOutputStream: async ({ part, state }) => {
            if (part.type === 'tool-error') {
              state.errorInfo = { toolName: 'myTool', error: 'something broke' };
            }
            return part;
          },
          processOutputResult: ({ state, messages }) => {
            Object.assign(stateInOutputResult, state);
            return messages;
          },
        },
      ];

      // Shared processorStates map (created in prepare-memory-step.ts in real flow)
      const processorStates = new Map();

      // Inner runner (created in MastraModelOutput for LLM execution step)
      const innerRunner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'inner-runner',
        processorStates,
      });

      // Outer runner (created in MastraModelOutput for the final output)
      const outerRunner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors,
        logger: mockLogger,
        agentName: 'outer-runner',
        processorStates,
      });

      // 1. Inner runner processes stream chunks (processOutputStream)
      await innerRunner.processPart(
        { type: 'text-delta', payload: { text: 'hello' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      await innerRunner.processPart(
        {
          type: 'tool-error',
          payload: { toolName: 'myTool', toolCallId: 'tc1', args: {} },
          runId: '1',
          from: ChunkFrom.AGENT,
        } as ChunkType,
        processorStates,
      );

      // 2. Outer runner runs processOutputResult
      messageList.add(createMessage('test response', 'assistant'), 'response');
      await outerRunner.runOutputProcessors(messageList);

      // State set in inner runner's processOutputStream should be accessible in outer runner's processOutputResult
      expect(stateInOutputResult.errorInfo).toEqual({ toolName: 'myTool', error: 'something broke' });
    });
  });

  describe('runProcessAPIError', () => {
    it('should call processAPIError on processors that implement it', async () => {
      const processAPIError = vi.fn().mockReturnValue({ retry: true });
      const processor: Processor = {
        id: 'error-handler',
        name: 'Error Handler',
        processAPIError,
      };

      runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add(createMessage('hello', 'user'), 'user');
      const error = new Error('Some API error');

      const abortSignal = new AbortController().signal;
      const result = await runner.runProcessAPIError({
        error,
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
        steps: [],
        retryCount: 0,
        abortSignal,
      });

      expect(processAPIError).toHaveBeenCalledTimes(1);
      expect(processAPIError).toHaveBeenCalledWith(
        expect.objectContaining({
          error,
          stepNumber: 0,
          retryCount: 0,
          abortSignal,
        }),
      );
      expect(result).toEqual({ retry: true });
    });

    it('should skip processors that do not implement processAPIError', async () => {
      const processAPIError = vi.fn().mockReturnValue({ retry: true });
      const skippedProcessor: Processor = {
        id: 'input-only',
        name: 'Input Only',
        processInput: vi.fn(),
      };
      const errorProcessor: Processor = {
        id: 'error-handler',
        name: 'Error Handler',
        processAPIError,
      };

      runner = new ProcessorRunner({
        inputProcessors: [skippedProcessor, errorProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add(createMessage('hello', 'user'), 'user');

      const result = await runner.runProcessAPIError({
        error: new Error('API error'),
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
        steps: [],
        retryCount: 0,
      });

      expect(processAPIError).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ retry: true });
    });

    it('should return { retry: false } when no processors handle the error', async () => {
      const processAPIError = vi.fn().mockReturnValue(undefined);
      const processor: Processor = {
        id: 'noop-handler',
        name: 'Noop Handler',
        processAPIError,
      };

      runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add(createMessage('hello', 'user'), 'user');

      const result = await runner.runProcessAPIError({
        error: new Error('API error'),
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
        steps: [],
        retryCount: 0,
      });

      expect(result).toEqual({ retry: false });
    });

    it('should stop at the first processor that signals retry', async () => {
      const processAPIError1 = vi.fn().mockReturnValue({ retry: true });
      const processAPIError2 = vi.fn().mockReturnValue({ retry: true });

      runner = new ProcessorRunner({
        inputProcessors: [
          { id: 'handler1', processAPIError: processAPIError1 },
          { id: 'handler2', processAPIError: processAPIError2 },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add(createMessage('hello', 'user'), 'user');

      const result = await runner.runProcessAPIError({
        error: new Error('API error'),
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
        steps: [],
        retryCount: 0,
      });

      expect(processAPIError1).toHaveBeenCalledTimes(1);
      expect(processAPIError2).not.toHaveBeenCalled();
      expect(result).toEqual({ retry: true });
    });

    it('should check both input and output processors', async () => {
      const inputHandler = vi.fn().mockReturnValue(undefined);
      const outputHandler = vi.fn().mockReturnValue({ retry: true });

      runner = new ProcessorRunner({
        inputProcessors: [{ id: 'input-handler', processAPIError: inputHandler }],
        outputProcessors: [{ id: 'output-handler', processAPIError: outputHandler }],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add(createMessage('hello', 'user'), 'user');

      const result = await runner.runProcessAPIError({
        error: new Error('API error'),
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
        steps: [],
        retryCount: 0,
      });

      expect(inputHandler).toHaveBeenCalledTimes(1);
      expect(outputHandler).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ retry: true });
    });

    it('should not throw if a processAPIError handler itself fails', async () => {
      const failingHandler = vi.fn().mockRejectedValue(new Error('Handler crashed'));

      runner = new ProcessorRunner({
        inputProcessors: [{ id: 'failing-handler', processAPIError: failingHandler }],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      messageList.add(createMessage('hello', 'user'), 'user');

      // Reset mockLogger.error to avoid false positives from earlier tests
      vi.mocked(mockLogger.error).mockClear();

      const result = await runner.runProcessAPIError({
        error: new Error('API error'),
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
        steps: [],
        retryCount: 0,
      });

      // Should swallow the error and return retry: false
      expect(result).toEqual({ retry: false });
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('processor state signals', () => {
    const createStateSignal = ({
      id,
      stateId = 'state-processor',
      mode,
      cacheKey,
      version,
      contents,
      createdAt,
    }: {
      id?: string;
      stateId?: string;
      mode: 'snapshot' | 'delta';
      cacheKey: string;
      version: number;
      contents: string;
      createdAt?: Date;
    }) =>
      createSignal({
        ...(id ? { id } : {}),
        ...(createdAt ? { createdAt } : {}),
        type: 'state',
        contents,
        metadata: {
          state: { id: stateId, threadId: 'thread-1', mode, cacheKey, version },
          ...(mode === 'snapshot' ? { value: { contents } } : { delta: { contents } }),
        },
      });

    it('adds state signals and stores tracking on thread metadata', async () => {
      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: {
          id: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
        resourceId: 'resource-1',
      });
      const savedThreads: unknown[] = [];
      const memory = {
        getThreadById: vi.fn(async () => ({
          id: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        })),
        saveThread: vi.fn(async ({ thread }) => {
          savedThreads.push(thread);
          return thread;
        }),
      };
      const chunks: unknown[] = [];

      runner = new ProcessorRunner({
        inputProcessors: [
          {
            id: 'state-processor',
            computeStateSignal: ({ threadId, resourceId, activeStateSignals, tracking }) => ({
              cacheKey: `state:${resourceId}:${threadId}`,
              contents: `state for ${resourceId}/${threadId} (${activeStateSignals.length})`,
              metadata: { seenTracking: Boolean(tracking) },
            }),
          },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
        writer: {
          custom: async chunk => {
            chunks.push(chunk);
          },
        },
      });

      const signalMessage = messageList.get.all.db().at(-1);
      expect(signalMessage?.role).toBe('signal');
      expect(signalMessage?.content.metadata?.signal).toEqual(
        expect.objectContaining({
          type: 'state',
          tagName: 'state',
          metadata: expect.objectContaining({
            state: expect.objectContaining({
              id: 'state-processor',
              threadId: 'thread-1',
              cacheKey: 'state:resource-1:thread-1',
              mode: 'snapshot',
              version: 1,
            }),
          }),
        }),
      );
      expect(chunks).toEqual([
        expect.objectContaining({
          type: 'data-signal',
          data: expect.objectContaining({ type: 'state', contents: 'state for resource-1/thread-1 (0)' }),
        }),
      ]);
      expect(memory.saveThread).toHaveBeenCalledTimes(1);
      expect(savedThreads[0]).toEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            mastra: expect.objectContaining({
              stateSignals: expect.objectContaining({
                'state-processor': expect.objectContaining({
                  currentCacheKey: 'state:resource-1:thread-1',
                  version: 1,
                  lastSignalId: expect.any(String),
                  lastSnapshotSignalId: expect.any(String),
                }),
              }),
            }),
          }),
        }),
      );
    });

    it('computes state signals for processors carried by combined workflows', async () => {
      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: {
          id: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
        resourceId: 'resource-1',
      });
      const memory = {
        getThreadById: vi.fn(async () => ({
          id: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        })),
        saveThread: vi.fn(async ({ thread }) => thread),
      };
      const computeStateSignal = vi.fn(() => ({
        cacheKey: 'workflow-state-cache-key',
        contents: 'workflow state',
      }));
      const processor: Processor = {
        id: 'workflow-state-processor',
        processInputStep: () => undefined,
        computeStateSignal,
      };
      const workflow = createWorkflow({
        id: 'workflow-state-test',
        inputSchema: ProcessorStepSchema,
        outputSchema: ProcessorStepSchema,
        type: 'processor',
        options: { validateInputs: false },
      })
        .then(createStep(processor as any))
        .commit() as ProcessorWorkflow;
      workflow.__stateSignalProcessors = [processor];
      const chunks: unknown[] = [];

      runner = new ProcessorRunner({
        inputProcessors: [workflow],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
        writer: {
          custom: async chunk => {
            chunks.push(chunk);
          },
        },
      });

      expect(computeStateSignal).toHaveBeenCalledTimes(1);
      expect(messageList.get.all.db().at(-1)?.content.metadata?.signal).toEqual(
        expect.objectContaining({
          type: 'state',
          metadata: expect.objectContaining({
            state: expect.objectContaining({ id: 'workflow-state-processor', cacheKey: 'workflow-state-cache-key' }),
          }),
        }),
      );
      expect(chunks).toHaveLength(1);
      expect(memory.saveThread).toHaveBeenCalledTimes(1);
    });

    it('passes empty state history to computeStateSignal before any state exists', async () => {
      messageList = new MessageList({ threadId: 'thread-1' });
      const requestContext = new RequestContext();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };
      requestContext.set('MastraMemory', { thread, resourceId: 'resource-1' });
      const memory = {
        getThreadById: vi.fn(async () => thread),
        saveThread: vi.fn(async ({ thread }) => thread),
      };
      const computeStateSignal = vi.fn((_args: any) => undefined);

      runner = new ProcessorRunner({
        inputProcessors: [{ id: 'state-processor', computeStateSignal }],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
      });

      const computeArgs = computeStateSignal.mock.calls[0]?.[0];
      expect(computeArgs.activeStateSignals).toEqual([]);
      expect(computeArgs.lastSnapshot).toBeUndefined();
      expect(computeArgs.deltasSinceSnapshot).toEqual([]);
      expect(memory.saveThread).not.toHaveBeenCalled();
    });

    it('does not write a duplicate state signal when the returned cacheKey matches tracking', async () => {
      messageList = new MessageList({ threadId: 'thread-1' });
      const requestContext = new RequestContext();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          mastra: {
            stateSignals: {
              'state-processor': {
                currentCacheKey: 'state:same',
                version: 1,
                lastSignalId: 'existing-signal',
                lastSnapshotSignalId: 'existing-snapshot',
              },
            },
          },
        },
      };
      requestContext.set('MastraMemory', { thread, resourceId: 'resource-1' });
      const memory = {
        getThreadById: vi.fn(async () => thread),
        saveThread: vi.fn(async ({ thread }) => thread),
        storage: { getStore: vi.fn(async () => null) },
      };
      const existingSignal = createStateSignal({
        id: 'existing-signal',
        mode: 'snapshot',
        cacheKey: 'state:same',
        version: 1,
        contents: 'same state',
      });
      messageList.addSignal(existingSignal);
      const writer = { custom: vi.fn(async () => undefined) };

      runner = new ProcessorRunner({
        inputProcessors: [
          { id: 'state-processor', computeStateSignal: () => ({ cacheKey: 'state:same', contents: 'same state' }) },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
        writer,
      });

      expect(messageList.get.all.db()).toHaveLength(1);
      expect(writer.custom).not.toHaveBeenCalled();
      expect(memory.saveThread).not.toHaveBeenCalled();
    });

    it('writes a fresh state signal when matching cacheKey has a different mode', async () => {
      messageList = new MessageList({ threadId: 'thread-1' });
      const requestContext = new RequestContext();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          mastra: {
            stateSignals: {
              'state-processor': {
                currentCacheKey: 'state:same',
                currentMode: 'delta',
                version: 1,
                lastSignalId: 'existing-delta',
                lastSnapshotSignalId: 'existing-snapshot',
              },
            },
          },
        },
      };
      requestContext.set('MastraMemory', { thread, resourceId: 'resource-1' });
      const memory = {
        getThreadById: vi.fn(async () => thread),
        saveThread: vi.fn(async ({ thread }) => thread),
        storage: { getStore: vi.fn(async () => null) },
      };
      messageList.addSignal(
        createStateSignal({
          id: 'existing-delta',
          mode: 'delta',
          cacheKey: 'state:same',
          version: 1,
          contents: 'same state delta',
        }),
      );
      const writer = { custom: vi.fn(async () => undefined) };

      runner = new ProcessorRunner({
        inputProcessors: [
          {
            id: 'state-processor',
            computeStateSignal: () => ({ mode: 'snapshot', cacheKey: 'state:same', contents: 'same state snapshot' }),
          },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
        writer,
      });

      expect(messageList.get.all.db()).toHaveLength(2);
      expect(writer.custom).toHaveBeenCalledTimes(1);
      expect(memory.saveThread).toHaveBeenCalledTimes(1);
      expect(writer.custom).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              state: expect.objectContaining({ cacheKey: 'state:same', mode: 'snapshot', version: 2 }),
            }),
          }),
        }),
      );
    });

    it('writes a fresh state signal when matching cacheKey is no longer active', async () => {
      messageList = new MessageList({ threadId: 'thread-1' });
      const requestContext = new RequestContext();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          mastra: {
            stateSignals: {
              'state-processor': {
                currentCacheKey: 'state:same',
                currentMode: 'snapshot',
                version: 1,
                lastSignalId: 'evicted-signal',
                lastSnapshotSignalId: 'evicted-snapshot',
              },
            },
          },
        },
      };
      requestContext.set('MastraMemory', { thread, resourceId: 'resource-1' });
      const memory = {
        getThreadById: vi.fn(async () => thread),
        saveThread: vi.fn(async ({ thread }) => thread),
        storage: { getStore: vi.fn(async () => null) },
      };
      const writer = { custom: vi.fn(async () => undefined) };

      runner = new ProcessorRunner({
        inputProcessors: [
          { id: 'state-processor', computeStateSignal: () => ({ cacheKey: 'state:same', contents: 'same state' }) },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
        writer,
      });

      expect(messageList.get.all.db()).toHaveLength(1);
      expect(writer.custom).toHaveBeenCalledTimes(1);
      expect(memory.saveThread).toHaveBeenCalledTimes(1);
      expect(writer.custom).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              state: expect.objectContaining({ cacheKey: 'state:same', version: 1 }),
            }),
          }),
        }),
      );
    });

    it('passes the latest snapshot and deltas since that snapshot to computeStateSignal', async () => {
      messageList = new MessageList({ threadId: 'thread-1' });
      const firstSnapshot = createStateSignal({
        id: 'snapshot-1',
        mode: 'snapshot',
        cacheKey: 'snapshot:1',
        version: 1,
        contents: 'snapshot 1',
      });
      const oldDelta = createStateSignal({
        id: 'delta-1',
        mode: 'delta',
        cacheKey: 'delta:1',
        version: 2,
        contents: 'delta 1',
      });
      const latestSnapshot = createStateSignal({
        id: 'snapshot-2',
        mode: 'snapshot',
        cacheKey: 'snapshot:2',
        version: 3,
        contents: 'snapshot 2',
      });
      const latestDelta = createStateSignal({
        id: 'delta-2',
        mode: 'delta',
        cacheKey: 'delta:2',
        version: 4,
        contents: 'delta 2',
      });
      messageList.addSignal(firstSnapshot);
      messageList.addSignal(oldDelta);
      messageList.addSignal(latestSnapshot);
      messageList.addSignal(latestDelta);

      const requestContext = new RequestContext();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          mastra: {
            stateSignals: {
              'state-processor': {
                currentCacheKey: 'delta:2',
                version: 4,
                lastSignalId: 'delta-2',
                lastSnapshotSignalId: 'snapshot-2',
              },
            },
          },
        },
      };
      requestContext.set('MastraMemory', { thread, resourceId: 'resource-1' });
      const memory = {
        getThreadById: vi.fn(async () => thread),
        saveThread: vi.fn(async ({ thread }) => thread),
      };
      const computeStateSignal = vi.fn((_args: any) => undefined);

      runner = new ProcessorRunner({
        inputProcessors: [{ id: 'state-processor', computeStateSignal }],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
      });

      const computeArgs = computeStateSignal.mock.calls[0]?.[0];
      expect(computeArgs.activeStateSignals.map(signal => signal.id)).toEqual([
        firstSnapshot.id,
        oldDelta.id,
        latestSnapshot.id,
        latestDelta.id,
      ]);
      expect(computeArgs.lastSnapshot?.id).toBe(latestSnapshot.id);
      expect(computeArgs.deltasSinceSnapshot.map((signal: any) => signal.id)).toEqual([latestDelta.id]);
      expect(memory.saveThread).not.toHaveBeenCalled();
    });

    it('does not query memory storage when the active message list already has a snapshot', async () => {
      messageList = new MessageList({ threadId: 'thread-1' });
      const localSnapshot = createStateSignal({
        id: 'local-snapshot',
        mode: 'snapshot',
        cacheKey: 'snapshot:local',
        version: 3,
        contents: 'local snapshot',
      });
      const localDelta = createStateSignal({
        id: 'local-delta',
        mode: 'delta',
        cacheKey: 'delta:local',
        version: 4,
        contents: 'local delta',
      });
      messageList.addSignal(localSnapshot);
      messageList.addSignal(localDelta);

      const requestContext = new RequestContext();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          mastra: {
            stateSignals: {
              'state-processor': {
                currentCacheKey: 'delta:latest',
                currentMode: 'delta',
                version: 5,
                lastSignalId: 'latest-delta-outside-window',
                lastSnapshotSignalId: 'snapshot-outside-window',
              },
            },
          },
        },
      };
      requestContext.set('MastraMemory', { thread, resourceId: 'resource-1' });
      const listMessages = vi.fn(async () => ({
        messages: [],
        total: 0,
        page: 0,
        perPage: false,
        hasMore: false,
      }));
      const memory = {
        getThreadById: vi.fn(async () => thread),
        saveThread: vi.fn(async ({ thread }) => thread),
        storage: { getStore: vi.fn(async () => ({ listMessages })) },
      };
      const computeStateSignal = vi.fn((_args: any) => undefined);

      runner = new ProcessorRunner({
        inputProcessors: [{ id: 'state-processor', computeStateSignal }],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
      });

      expect(memory.storage.getStore).not.toHaveBeenCalled();
      expect(listMessages).not.toHaveBeenCalled();
      const computeArgs = computeStateSignal.mock.calls[0]?.[0];
      expect(computeArgs.contextWindow.hasSnapshot).toBe(true);
      expect(computeArgs.lastSnapshot?.id).toBe(localSnapshot.id);
      expect(computeArgs.deltasSinceSnapshot.map((signal: any) => signal.id)).toEqual([localDelta.id]);
    });

    it('resolves snapshot and deltas from memory storage when the snapshot is outside the active message list', async () => {
      messageList = new MessageList({ threadId: 'thread-1' });
      const snapshot = createStateSignal({
        id: 'stored-snapshot',
        mode: 'snapshot',
        cacheKey: 'snapshot:stored',
        version: 1,
        contents: 'stored snapshot',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      });
      const delta = createStateSignal({
        id: 'stored-delta',
        mode: 'delta',
        cacheKey: 'delta:stored',
        version: 2,
        contents: 'stored delta',
        createdAt: new Date('2026-01-01T00:00:01.000Z'),
      });
      const storedMessages = new MessageList({ threadId: 'thread-1' });
      storedMessages.addSignal(snapshot);
      storedMessages.addSignal(delta);
      const localDelta = messageList.addSignal(
        createStateSignal({
          id: 'local-delta',
          mode: 'delta',
          cacheKey: 'delta:local',
          version: 3,
          contents: 'local delta',
          createdAt: new Date('2026-01-01T00:00:02.000Z'),
        }),
      );

      const requestContext = new RequestContext();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {
          mastra: {
            stateSignals: {
              'state-processor': {
                currentCacheKey: 'delta:local',
                version: 3,
                lastSignalId: 'local-delta',
                lastSnapshotSignalId: 'stored-snapshot',
              },
            },
          },
        },
      };
      requestContext.set('MastraMemory', { thread, resourceId: 'resource-1' });
      const listMessages = vi.fn(async () => ({
        messages: storedMessages.get.all.db(),
        total: 2,
        page: 0,
        perPage: false,
        hasMore: false,
      }));
      const listMessagesById = vi.fn(async () => ({ messages: storedMessages.get.all.db() }));
      const memory = {
        getThreadById: vi.fn(async () => thread),
        saveThread: vi.fn(async ({ thread }) => thread),
        storage: { getStore: vi.fn(async () => ({ listMessages, listMessagesById })) },
      };
      const computeStateSignal = vi.fn((_args: any) => undefined);

      runner = new ProcessorRunner({
        inputProcessors: [{ id: 'state-processor', computeStateSignal }],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
      });

      expect(listMessages).not.toHaveBeenCalled();
      expect(listMessagesById).toHaveBeenCalledWith({ messageIds: ['stored-snapshot'] });
      const computeArgs = computeStateSignal.mock.calls[0]?.[0];
      expect(computeArgs.activeStateSignals.map(signal => signal.id)).toEqual(
        expect.arrayContaining([snapshot.id, delta.id, localDelta.id]),
      );
      expect(computeArgs.activeStateSignals).toHaveLength(3);
      expect(computeArgs.lastSnapshot?.id).toBe(snapshot.id);
      expect(computeArgs.deltasSinceSnapshot.map(signal => signal.id)).toEqual(
        expect.arrayContaining([delta.id, localDelta.id]),
      );
      expect(computeArgs.deltasSinceSnapshot).toHaveLength(2);
    });

    it('lets processInputStep send state signals without computeStateSignal', async () => {
      const requestContext = new RequestContext();
      requestContext.set('MastraMemory', {
        thread: {
          id: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        },
        resourceId: 'resource-1',
      });
      const savedThreads: unknown[] = [];
      const memory = {
        getThreadById: vi.fn(async () => ({
          id: 'thread-1',
          resourceId: 'resource-1',
          createdAt: new Date(),
          updatedAt: new Date(),
          metadata: {},
        })),
        saveThread: vi.fn(async ({ thread }) => {
          savedThreads.push(thread);
          return thread;
        }),
      };

      runner = new ProcessorRunner({
        inputProcessors: [
          {
            id: 'state-processor',
            processInputStep: async ({ sendStateSignal }) => {
              await sendStateSignal?.({
                id: 'external-browser',
                cacheKey: 'browser:v1',
                mode: 'snapshot',
                contents: 'browser state',
                value: { activeUrl: 'https://example.com' },
              });
            },
          },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
      });

      expect(messageList.get.all.db().at(-1)?.content.metadata?.signal).toEqual(
        expect.objectContaining({
          type: 'state',
          metadata: expect.objectContaining({
            state: expect.objectContaining({ id: 'external-browser', cacheKey: 'browser:v1', version: 1 }),
            value: { activeUrl: 'https://example.com' },
          }),
        }),
      );
      expect(savedThreads[0]).toEqual(
        expect.objectContaining({
          metadata: expect.objectContaining({
            mastra: expect.objectContaining({
              stateSignals: expect.objectContaining({
                'external-browser': expect.objectContaining({ currentCacheKey: 'browser:v1', version: 1 }),
              }),
            }),
          }),
        }),
      );
    });

    it('skips computeStateSignal processors gracefully when no memory-backed thread', async () => {
      vi.mocked(mockLogger.debug).mockClear();
      runner = new ProcessorRunner({
        inputProcessors: [
          { id: 'state-processor', computeStateSignal: () => ({ cacheKey: 'state', contents: 'state' }) },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      // Should NOT throw — the run resolves and a debug log is emitted.
      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
      });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('[state-processor] computeStateSignal skipped'),
        expect.objectContaining({ processorId: 'state-processor' }),
      );
    });

    it('honors processor.stateId over processor.id in computeStateSignal', async () => {
      messageList = new MessageList({ threadId: 'thread-1' });
      const requestContext = new RequestContext();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };
      requestContext.set('MastraMemory', { thread, resourceId: 'resource-1' });
      const memory = {
        getThreadById: vi.fn(async () => thread),
        saveThread: vi.fn(async ({ thread: t }) => t),
      };

      runner = new ProcessorRunner({
        inputProcessors: [
          {
            id: 'default-id',
            stateId: 'custom-state-id',
            computeStateSignal: () => ({ cacheKey: 'ck', contents: 'state' }),
          },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
      });

      const signalMessage = messageList.get.all.db().at(-1);
      expect(signalMessage?.content.metadata?.signal?.metadata?.state?.id).toBe('custom-state-id');
      const savedThread = memory.saveThread.mock.calls[0]?.[0]?.thread;
      expect(savedThread.metadata.mastra.stateSignals['custom-state-id']).toBeDefined();
      expect(savedThread.metadata.mastra.stateSignals['default-id']).toBeUndefined();
    });

    it('honors processor.stateId over processor.id in sendStateSignal from processInputStep', async () => {
      messageList = new MessageList({ threadId: 'thread-1' });
      const requestContext = new RequestContext();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };
      requestContext.set('MastraMemory', { thread, resourceId: 'resource-1' });
      const memory = {
        getThreadById: vi.fn(async () => thread),
        saveThread: vi.fn(async ({ thread: t }) => t),
      };

      runner = new ProcessorRunner({
        inputProcessors: [
          {
            id: 'default-id',
            stateId: 'custom-state-id',
            processInputStep: async ({ sendStateSignal }) => {
              await sendStateSignal?.({ cacheKey: 'ck', contents: 'state from step' });
            },
          },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
      });

      const signalMessage = messageList.get.all.db().at(-1);
      expect((signalMessage?.content as any)?.metadata?.signal?.metadata?.state?.id).toBe('custom-state-id');
    });

    it('refreshes thread metadata after intermediate sendStateSignal in computeStateSignal', async () => {
      const ml = new MessageList({ threadId: 'thread-1' });
      const requestContext = new RequestContext();
      const thread = {
        id: 'thread-1',
        resourceId: 'resource-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        metadata: {},
      };
      requestContext.set('MastraMemory', {
        thread,
        resourceId: 'resource-1',
      });
      let latestThread: any = thread;
      const memory = {
        getThreadById: vi.fn(async () => latestThread),
        saveThread: vi.fn(async ({ thread: t }: { thread: any }) => {
          latestThread = t;
          return t;
        }),
      };

      const computeCalls: Array<{ trackingVersion: number | undefined }> = [];
      const r = new ProcessorRunner({
        inputProcessors: [
          {
            id: 'state-processor',
            computeStateSignal: async ({ sendStateSignal, tracking }: any) => {
              computeCalls.push({ trackingVersion: (tracking as any)?.version });
              if (computeCalls.length === 1) {
                await sendStateSignal!({ cacheKey: 'intermediate', contents: 'intermediate' });
              }
              return { cacheKey: 'final', contents: 'final' };
            },
          },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await r.runProcessInputStep({
        messageList: ml,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        requestContext,
        memory: memory as any,
      });

      expect(computeCalls).toHaveLength(1);
      expect(memory.saveThread).toHaveBeenCalledTimes(2);
      const firstTracking =
        memory.saveThread.mock.calls[0]?.[0]?.thread?.metadata?.mastra?.stateSignals?.['state-processor'];
      const secondTracking =
        memory.saveThread.mock.calls[1]?.[0]?.thread?.metadata?.mastra?.stateSignals?.['state-processor'];
      expect(firstTracking?.version).toBe(1);
      expect(secondTracking?.version).toBe(2);
      expect(secondTracking?.lastSignalId).not.toBe(firstTracking?.lastSignalId);
    });
  });

  describe('processor sendSignal', () => {
    it('adds a signal message, rotates the response id, and writes a data part', async () => {
      const rotateResponseMessageId = vi.fn(() => 'response-2');
      const chunks: unknown[] = [];

      runner = new ProcessorRunner({
        inputProcessors: [
          {
            id: 'signal-processor',
            processInputStep: async ({ sendSignal }) => {
              await sendSignal?.({
                type: 'system-reminder',
                contents: 'remember this',
                metadata: { type: 'test-reminder' },
              });
            },
          },
        ],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        steps: [],
        model: {} as any,
        tools: {},
        retryCount: 0,
        messageId: 'response-1',
        rotateResponseMessageId,
        writer: {
          custom: async chunk => {
            chunks.push(chunk);
          },
        },
      });

      const signalMessage = messageList.get.all.db().at(-1);
      expect(rotateResponseMessageId).toHaveBeenCalledTimes(1);
      expect(signalMessage?.role).toBe('signal');
      expect(signalMessage?.content.parts[0]).toEqual(expect.objectContaining({ type: 'text', text: 'remember this' }));
      expect(chunks).toEqual([
        expect.objectContaining({
          type: 'data-signal',
          data: expect.objectContaining({
            type: 'reactive',
            tagName: 'system-reminder',
            contents: 'remember this',
            metadata: { type: 'test-reminder' },
          }),
          transient: true,
        }),
      ]);
    });
  });
});
