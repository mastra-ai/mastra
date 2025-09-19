import type { TextPart } from 'ai';
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
          traceMethod: vi.fn((fn, _options) => {
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
        await runner.runInputProcessors(messageList, undefined, mockTelemetry);

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
          traceMethod: vi.fn((fn, _options) => {
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
        await runner.runOutputProcessors(messageList, undefined, mockTelemetry);

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
        { type: 'text-delta', payload: { text: 'hello world', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result.blocked).toBe(false);
    });

    it('should abort stream when processor calls abort', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'processor1',
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
        { type: 'text-delta', payload: { text: 'blocked content', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result.part).toBe(null); // When aborted, part is null
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
      const result = await runner.processPart(
        { type: 'text-delta', payload: { text: 'test content', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result.part?.type === 'text-delta' ? result.part?.payload.text : '').toBe('test content'); // Should return original text on error
      expect(result.blocked).toBe(false);
    });

    it('should skip processors that do not implement processOutputStream', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'processor1',
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
          name: 'processor2',
          // No processOutputStream method - should be skipped
        },
        {
          name: 'processor3',
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
        { type: 'text-delta', payload: { text: 'hello', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
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
        { type: 'text-delta', payload: { text: 'original text', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
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
          name: 'statefulProcessor',
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
        { type: 'text-delta', payload: { text: 'Hello world', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result1.part).toBe(null); // No period, so no emission

      const result2 = await runner.processPart(
        { type: 'text-delta', payload: { text: '.', id: '2' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result2.part?.type === 'text-delta' ? result2.part?.payload.text : '').toBe('Hello world.'); // Complete sentence, should emit
    });

    it('should accumulate chunks for moderation decisions', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'moderationProcessor',
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
        { type: 'text-delta', payload: { text: 'i want to ', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result1.part?.type === 'text-delta' ? result1.part?.payload.text : '').toBe('i want to ');

      const result2 = await runner.processPart(
        { type: 'text-delta', payload: { text: 'punch', id: '2' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result2.part?.type === 'text-delta' ? result2.part?.payload.text : '').toBe('punch');

      // This part should trigger the violence detection
      const result3 = await runner.processPart(
        { type: 'text-delta', payload: { text: ' you in the face', id: '3' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result3.part).toBe(null); // When aborted, part is null
      expect(result3.blocked).toBe(true);
      expect(result3.reason).toBe('Violent content detected');
    });

    it('should handle custom state management', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'customStateProcessor',
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
        { type: 'text-delta', payload: { text: 'hello world', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result1.part).toBe(null);

      const result2 = await runner.processPart(
        { type: 'text-delta', payload: { text: ' goodbye', id: '2' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result2.part?.type === 'text-delta' ? result2.part?.payload.text : '').toBe(' GOODBYE');
    });

    it('should handle stream end detection', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'streamEndProcessor',
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
        { type: 'text-delta', payload: { text: 'hello', id: '1' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      await runner.processPart(
        { type: 'text-delta', payload: { text: ' world', id: '2' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );

      // Simulate stream end by processing an empty part

      const result = await runner.processPart(
        { type: 'text-delta', payload: { text: '', id: '3' }, runId: '1', from: ChunkFrom.AGENT },
        processorStates,
      );
      expect(result.part?.type === 'text-delta' ? result.part?.payload.text : '').toBe('HELLO WORLD');
    });
  });

  describe('Stream Processing Integration', () => {
    it('should create a readable stream that processes text chunks', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'filterProcessor',
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
          name: 'abortProcessor',
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
      expect(chunks[1]).toEqual({ type: 'tripwire', tripwireReason: 'Stream aborted' });
    });

    it('should pass through non-text chunks unchanged', async () => {
      const outputProcessors: Processor[] = [
        {
          name: 'textProcessor',
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
});
