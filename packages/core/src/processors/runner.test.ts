import type { TextPart } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MessageList } from '../agent/message-list';
import { TripWire } from '../agent/trip-wire';
import type { IMastraLogger } from '../logger';
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
  getLogs: vi.fn(() => []),
  getLogsByRunId: vi.fn(() => []),
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
          name: 'processor1',
          processInput: async ({ messages }) => {
            executionOrder.push('processor1');
            messages.push(createMessage('processed by 1', 'user'));
            return messages;
          },
        },
        {
          name: 'processor2',
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
          name: 'processor1',
          processInput: async ({ messages }) => {
            executionOrder.push('processor1-start');
            await new Promise(resolve => setTimeout(resolve, 10));
            executionOrder.push('processor1-end');
            return messages;
          },
        },
        {
          name: 'processor2',
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
          name: 'processor1',
          processInput: async ({ messages, abort }) => {
            messages.push(createMessage('before abort', 'user'));
            abort('Test abort reason');
            return messages;
          },
        },
        {
          name: 'processor2',
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
          name: 'processor1',
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
          name: 'processor1',
          processInput: async ({ messages, abort }) => {
            executionOrder.push('processor1');
            abort('Abort after processor1');

            return messages;
          },
        },
        {
          name: 'processor2',
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
          name: 'processor1',
          processInput: async ({ messages }) => {
            executionOrder.push('processor1');
            messages.push(createMessage('from processor 1', 'user'));
            return messages;
          },
        },
        {
          name: 'processor2',
          // No processInput method - should be skipped
        },
        {
          name: 'processor3',
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

    describe('telemetry integration', () => {
      it('should use telemetry.traceMethod for individual processors when telemetry is provided', async () => {
        const mockTelemetry = {
          traceMethod: vi.fn(fn => {
            return () => fn({ messageList });
          }),
        };

        const inputProcessors: Processor[] = [
          {
            name: 'processor1',
            processInput: async ({ messages }) => {
              messages.push(createMessage('processed', 'user'));
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
        await runner.runInputProcessors(messageList, mockTelemetry);

        expect(mockTelemetry.traceMethod).toHaveBeenCalledWith(expect.any(Function), {
          spanName: 'agent.inputProcessor.processor1',
          attributes: {
            'processor.name': 'processor1',
            'processor.index': '0',
            'processor.total': '1',
          },
        });
      });

      it('should work without telemetry when not provided', async () => {
        const inputProcessors: Processor[] = [
          {
            name: 'processor1',
            processInput: async ({ messages }) => {
              messages.push(createMessage('processed', 'user'));
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

        const messages = await result.get.all.prompt();
        expect(messages).toHaveLength(2);
        expect((messages[0].content[0] as TextPart).text).toBe('original');
        expect((messages[1].content[0] as TextPart).text).toBe('processed');
      });
    });
  });

  describe('Output Processors', () => {
    it('should run output processors in order', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'processor1',
          processOutputResult: async ({ messages }) => {
            messages.push(createMessage('extra message A', 'assistant'));
            return messages;
          },
        },
        {
          name: 'processor2',
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
          name: 'processor1',
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
          name: 'processor1',
          processOutputResult: async ({ messages }) => {
            messages.push(createMessage('message from processor 1', 'assistant'));
            return messages;
          },
        },
        {
          name: 'processor2',
          // No processOutputResult method - should be skipped
        },
        {
          name: 'processor3',
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

    describe('telemetry integration', () => {
      it('should use telemetry.traceMethod for individual processors when telemetry is provided', async () => {
        const mockTelemetry = {
          traceMethod: vi.fn(fn => {
            return () => fn({ messageList });
          }),
        };

        const outputProcessors: Processor[] = [
          {
            name: 'processor1',
            processOutputResult: async ({ messages }) => {
              messages.push(createMessage('processed', 'assistant'));
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
        await runner.runOutputProcessors(messageList, mockTelemetry);

        expect(mockTelemetry.traceMethod).toHaveBeenCalledWith(expect.any(Function), {
          spanName: 'agent.outputProcessor.processor1',
          attributes: {
            'processor.name': 'processor1',
            'processor.index': '0',
            'processor.total': '1',
          },
        });
      });
    });
  });

  describe('Stream Processing', () => {
    it('should process text chunks through output processors', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'processor1',
          processOutputStream: async ({ chunk }) => {
            // Only process text-delta chunks
            if (chunk.type === 'text-delta') {
              return { type: 'text-delta', textDelta: (chunk as any).textDelta.toUpperCase() };
            }
            return chunk;
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
      const result = await runner.processPart({ type: 'text-delta', textDelta: 'hello world' }, processorStates);
      expect((result.chunk as any).textDelta).toBe('HELLO WORLD');
      expect(result.blocked).toBe(false);
    });

    it('should abort stream when processor calls abort', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'processor1',
          processOutputStream: async ({ chunk, abort }) => {
            if ((chunk as any).textDelta?.includes('blocked')) {
              abort('Content blocked');
            }
            return chunk;
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
      const result = await runner.processPart({ type: 'text-delta', textDelta: 'blocked content' }, processorStates);
      expect(result.chunk).toBe(null); // When aborted, chunk is null
      expect(result.blocked).toBe(true);
      expect(result.reason).toBe('Content blocked');
    });

    it('should handle processor errors gracefully', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'processor1',
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
      const result = await runner.processPart({ type: 'text-delta', textDelta: 'test content' }, processorStates);
      expect((result.chunk as any).textDelta).toBe('test content'); // Should return original text on error
      expect(result.blocked).toBe(false);
    });

    it('should skip processors that do not implement processOutputStream', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'processor1',
          processOutputStream: async ({ chunk }) => {
            // Only process text-delta chunks
            if (chunk.type === 'text-delta') {
              return { type: 'text-delta', textDelta: (chunk as any).textDelta.toUpperCase() };
            }
            return chunk;
          },
        },
        {
          name: 'processor2',
          // No processOutputStream method - should be skipped
        },
        {
          name: 'processor3',
          processOutputStream: async ({ chunk }) => {
            // Only process text-delta chunks
            if (chunk.type === 'text-delta') {
              return { type: 'text-delta', textDelta: (chunk as any).textDelta + '!' };
            }
            return chunk;
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
      const result = await runner.processPart({ type: 'text-delta', textDelta: 'hello' }, processorStates);
      expect((result.chunk as any).textDelta).toBe('HELLO!');
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
      const result = await runner.processPart({ type: 'text-delta', textDelta: 'original text' }, processorStates);
      expect((result.chunk as any).textDelta).toBe('original text');
      expect(result.blocked).toBe(false);
    });
  });

  describe('Stateful Stream Processing', () => {
    it('should process chunks with state management', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'statefulProcessor',
          processOutputStream: async ({ chunk, allChunks }) => {
            // Only emit when we have a complete sentence (ends with period)
            const shouldEmit = (chunk as any).textDelta?.includes('.');
            if (shouldEmit) {
              const textToEmit = allChunks.map(c => (c as any).textDelta).join('');
              return { type: 'text-delta', textDelta: textToEmit };
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
      const result1 = await runner.processPart({ type: 'text-delta', textDelta: 'Hello world' }, processorStates);
      expect(result1.chunk).toBe(null); // No period, so no emission

      const result2 = await runner.processPart({ type: 'text-delta', textDelta: '.' }, processorStates);
      expect((result2.chunk as any).textDelta).toBe('Hello world.'); // Complete sentence, should emit
    });

    it('should accumulate chunks for moderation decisions', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'moderationProcessor',
          processOutputStream: async ({ chunk, abort, allChunks }) => {
            // Check for violence in accumulated text
            const accumulatedText = allChunks.map(c => (c as any).textDelta).join('');

            if (accumulatedText.includes('punch') && accumulatedText.includes('face')) {
              abort('Violent content detected');
            }

            return chunk; // Emit the chunk as-is
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
      const result1 = await runner.processPart({ type: 'text-delta', textDelta: 'i want to ' }, processorStates);
      expect((result1.chunk as any).textDelta).toBe('i want to ');

      const result2 = await runner.processPart({ type: 'text-delta', textDelta: 'punch' }, processorStates);
      expect((result2.chunk as any).textDelta).toBe('punch');

      // This chunk should trigger the violence detection
      const result3 = await runner.processPart({ type: 'text-delta', textDelta: ' you in the face' }, processorStates);
      expect(result3.chunk).toBe(null); // When aborted, chunk is null
      expect(result3.blocked).toBe(true);
      expect(result3.reason).toBe('Violent content detected');
    });

    it('should handle custom state management', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'customStateProcessor',
          processOutputStream: async ({ chunk, state }) => {
            // Track word count in custom state
            const wordCount = state.wordCount || 0;
            const newWordCount = wordCount + (chunk as any).textDelta.split(' ').filter(word => word.length > 0).length;
            state.wordCount = newWordCount;

            // Only emit every 3 words
            const shouldEmit = newWordCount % 3 === 0;
            if (shouldEmit) {
              return { type: 'text-delta', textDelta: (chunk as any).textDelta.toUpperCase() };
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

      const result1 = await runner.processPart({ type: 'text-delta', textDelta: 'hello world' }, processorStates);
      expect(result1.chunk).toBe(null);

      const result2 = await runner.processPart({ type: 'text-delta', textDelta: ' goodbye' }, processorStates);
      expect((result2.chunk as any).textDelta).toBe(' GOODBYE');
    });

    it('should handle stream end detection', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'streamEndProcessor',
          processOutputStream: async ({ chunk, allChunks }) => {
            if ((chunk as any).textDelta === '') {
              // Emit accumulated text at stream end
              return {
                type: 'text-delta',
                textDelta: allChunks
                  .map(c => (c as any).textDelta)
                  .join('')
                  .toUpperCase(),
              };
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
      await runner.processPart({ type: 'text-delta', textDelta: 'hello' }, processorStates);
      await runner.processPart({ type: 'text-delta', textDelta: ' world' }, processorStates);

      // Simulate stream end by processing an empty chunk

      const result = await runner.processPart({ type: 'text-delta', textDelta: '' }, processorStates);
      expect((result.chunk as any).textDelta).toBe('HELLO WORLD');
    });
  });

  describe('Stream Processing Integration', () => {
    it('should create a readable stream that processes text chunks', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'filterProcessor',
          processOutputStream: async ({ chunk }) => {
            // Only process text-delta chunks
            if (chunk.type === 'text-delta' && (chunk as any).textDelta?.includes('blocked')) {
              return null;
            }
            return chunk;
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
            controller.enqueue({ type: 'text-delta', textDelta: 'Hello world' });
            controller.enqueue({ type: 'text-delta', textDelta: 'This is blocked content' });
            controller.enqueue({ type: 'text-delta', textDelta: 'But this is allowed' });
            controller.enqueue({ type: 'finish' });
            controller.close();
          },
        }),
      };

      const processedStream = await runner.runOutputProcessorsForStream(mockStream as any);
      const reader = processedStream.getReader();
      const chunks: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      // Should filter out blocked content
      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ type: 'text-delta', textDelta: 'Hello world' });
      expect(chunks[1]).toEqual({ type: 'text-delta', textDelta: 'But this is allowed' });
      expect(chunks[2]).toEqual({ type: 'finish' });
    });

    it('should emit tripwire when processor aborts stream', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'abortProcessor',
          processOutputStream: async ({ chunk, abort }) => {
            // Only process text-delta chunks
            if (chunk.type === 'text-delta' && (chunk as any).textDelta?.includes('abort')) {
              abort('Stream aborted');
            }
            return chunk;
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
            controller.enqueue({ type: 'text-delta', textDelta: 'Hello' });
            controller.enqueue({ type: 'text-delta', textDelta: 'abort now' });
            controller.close();
          },
        }),
      };

      const processedStream = await runner.runOutputProcessorsForStream(mockStream as any);
      const reader = processedStream.getReader();
      const chunks: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(2);
      expect(chunks[0]).toEqual({ type: 'text-delta', textDelta: 'Hello' });
      expect(chunks[1]).toEqual({ type: 'tripwire', tripwireReason: 'Stream aborted' });
    });

    it('should pass through non-text chunks unchanged', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'textProcessor',
          processOutputStream: async ({ chunk }) => {
            // Only process text-delta chunks
            if (chunk.type === 'text-delta') {
              return { type: 'text-delta', textDelta: chunk.textDelta.toUpperCase() };
            }
            return chunk;
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
            controller.enqueue({ type: 'text-delta', textDelta: 'hello' });
            controller.enqueue({ type: 'tool-call', toolCallId: '123' });
            controller.enqueue({ type: 'finish' });
            controller.close();
          },
        }),
      };

      const processedStream = await runner.runOutputProcessorsForStream(mockStream as any);
      const reader = processedStream.getReader();
      const chunks: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual({ type: 'text-delta', textDelta: 'HELLO' });
      expect(chunks[1]).toEqual({ type: 'tool-call', toolCallId: '123' });
      expect(chunks[2]).toEqual({ type: 'finish' });
    });
  });
});
