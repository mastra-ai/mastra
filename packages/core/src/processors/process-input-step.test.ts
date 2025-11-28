import { describe, expect, it, vi } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { MastraDBMessage } from '../agent/message-list';
import type { IMastraLogger } from '../logger';
import { ProcessorRunner } from './runner';
import type { Processor } from './index';

/**
 * Tests for processInputStep - a processor method that runs at each step of the agentic loop.
 *
 * Key differences from processInput:
 * - processInput runs ONCE at the start, before the agentic loop begins
 * - processInputStep runs at EACH STEP of the agentic loop (including tool call continuations)
 *
 * This enables per-step message transformations, such as:
 * - Converting message part types between different formats
 * - Modifying messages based on step context
 * - Implementing step-aware message processing logic
 */
describe('processInputStep', () => {
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

  const createMessage = (content: string, role: 'user' | 'assistant' = 'user'): MastraDBMessage => ({
    id: `msg-${Math.random()}`,
    role,
    content: {
      format: 2 as const,
      parts: [{ type: 'text' as const, text: content }],
    },
    createdAt: new Date(),
    threadId: 'test-thread',
  });

  describe('processInput runs once', () => {
    it('processInput is called only once via runInputProcessors', async () => {
      let processInputCallCount = 0;

      const countingProcessor: Processor = {
        id: 'counting-processor',
        processInput: async ({ messages }) => {
          processInputCallCount++;
          return messages;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [countingProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('user message')], 'user');

      await runner.runInputProcessors(messageList);
      expect(processInputCallCount).toBe(1);

      // Simulate adding tool result to message list (what happens between steps)
      messageList.add([createMessage('tool result', 'assistant')], 'response');

      // processInput is only called once at the start
      expect(processInputCallCount).toBe(1);
    });
  });

  describe('processInputStep interface', () => {
    it('should include processInputStep method on Processor interface', async () => {
      const stepProcessor: Processor = {
        id: 'step-processor',
        processInputStep: async ({ messageList }) => {
          return messageList;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [stepProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('test message')], 'input');

      const result = await runner.runProcessInputStep({
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
      });

      expect(result).toBeDefined();
      expect(result).toBeInstanceOf(MessageList);
    });
  });

  describe('ProcessorRunner.runProcessInputStep', () => {
    it('should have runProcessInputStep method', async () => {
      const stepProcessor: Processor = {
        id: 'step-processor',
        processInputStep: async ({ messageList }) => {
          return messageList;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [stepProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      expect(typeof runner.runProcessInputStep).toBe('function');
    });

    it('should be callable at each step with growing message history', async () => {
      let processInputStepCallCount = 0;
      const stepNumbers: number[] = [];
      const messagesSeenAtEachStep: MastraDBMessage[][] = [];

      const stepProcessor: Processor = {
        id: 'step-processor',
        processInputStep: async ({ messages, stepNumber, messageList }) => {
          processInputStepCallCount++;
          stepNumbers.push(stepNumber);
          messagesSeenAtEachStep.push([...messages]);
          return messageList;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [stepProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      // Simulate step 0
      const messageList0 = new MessageList({ threadId: 'test-thread' });
      messageList0.add([createMessage('Hello')], 'input');

      await runner.runProcessInputStep({
        messages: messageList0.get.all.db(),
        messageList: messageList0,
        stepNumber: 0,
      });

      // Simulate step 1 (after tool call)
      const messageList1 = new MessageList({ threadId: 'test-thread' });
      messageList1.add([createMessage('Hello')], 'input');
      messageList1.add(
        [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'some_tool', args: {} }],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );
      messageList1.add(
        [
          {
            id: 'tool-1',
            role: 'tool',
            content: {
              format: 2 as const,
              parts: [
                {
                  type: 'tool-result' as const,
                  toolCallId: 'call-1',
                  toolName: 'some_tool',
                  result: { data: 'result' },
                },
              ],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );

      await runner.runProcessInputStep({
        messages: messageList1.get.all.db(),
        messageList: messageList1,
        stepNumber: 1,
      });

      expect(processInputStepCallCount).toBe(2);
      expect(stepNumbers).toEqual([0, 1]);
      expect(messagesSeenAtEachStep[0].length).toBe(1);
      expect(messagesSeenAtEachStep[1].length).toBe(3);
    });
  });

  describe('message part type transformation', () => {
    it('should transform message part types at each step', async () => {
      let transformationCount = 0;

      const typeTransformProcessor: Processor = {
        id: 'type-transform-processor',
        processInputStep: async ({ messages, messageList }) => {
          // Transform one part type to another (e.g., for provider compatibility)
          for (const msg of messages) {
            if (msg.role === 'assistant' && msg.content.parts) {
              for (const part of msg.content.parts) {
                if ((part as any).type === 'source-type') {
                  transformationCount++;
                  (part as any).type = 'target-type';
                }
              }
            }
          }
          return messageList;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [typeTransformProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('User question')], 'input');
      messageList.add(
        [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: {
              format: 2 as const,
              parts: [
                { type: 'source-type' as any, data: 'some data' },
                { type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'some_tool', args: {} },
              ],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );
      messageList.add(
        [
          {
            id: 'tool-1',
            role: 'tool',
            content: {
              format: 2 as const,
              parts: [{ type: 'tool-result' as const, toolCallId: 'call-1', toolName: 'some_tool', result: {} }],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );

      await runner.runProcessInputStep({
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 1,
      });

      expect(transformationCount).toBe(1);

      const allMessages = messageList.get.all.db();
      const assistantMsg = allMessages.find(m => m.role === 'assistant');
      const transformedPart = assistantMsg?.content.parts?.find((p: any) => p.type === 'target-type');
      expect(transformedPart).toBeDefined();
    });
  });

  describe('multiple processors', () => {
    it('should run multiple processInputStep processors in order', async () => {
      const executionOrder: string[] = [];

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ messageList }) => {
          executionOrder.push('processor-1');
          return messageList;
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async ({ messageList }) => {
          executionOrder.push('processor-2');
          return messageList;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor1, processor2],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      await runner.runProcessInputStep({
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
      });

      expect(executionOrder).toEqual(['processor-1', 'processor-2']);
    });
  });

  describe('processInput and processInputStep interaction', () => {
    it('processInput runs once at start, processInputStep runs at each step', async () => {
      const executionLog: string[] = [];

      const dualProcessor: Processor = {
        id: 'dual-processor',
        processInput: async ({ messages }) => {
          executionLog.push('processInput');
          return messages;
        },
        processInputStep: async ({ stepNumber, messageList }) => {
          executionLog.push(`processInputStep-${stepNumber}`);
          return messageList;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [dualProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('user message')], 'user');

      // runInputProcessors is called once at the start
      await runner.runInputProcessors(messageList);

      // runProcessInputStep is called at step 0
      await runner.runProcessInputStep({
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
      });

      // Simulate tool call/result between steps
      messageList.add(
        [
          {
            id: 'assistant-1',
            role: 'assistant',
            content: {
              format: 2 as const,
              parts: [{ type: 'tool-call' as const, toolCallId: 'call-1', toolName: 'test', args: {} }],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );
      messageList.add(
        [
          {
            id: 'tool-1',
            role: 'tool',
            content: {
              format: 2 as const,
              parts: [{ type: 'tool-result' as const, toolCallId: 'call-1', toolName: 'test', result: 'done' }],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          } as unknown as MastraDBMessage,
        ],
        'response',
      );

      // runProcessInputStep is called at step 1
      await runner.runProcessInputStep({
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 1,
      });

      expect(executionLog).toEqual(['processInput', 'processInputStep-0', 'processInputStep-1']);
    });

    it('processor with only processInput should not affect processInputStep flow', async () => {
      const executionLog: string[] = [];

      const inputOnlyProcessor: Processor = {
        id: 'input-only',
        processInput: async ({ messages }) => {
          executionLog.push('input-only-processInput');
          return messages;
        },
      };

      const stepOnlyProcessor: Processor = {
        id: 'step-only',
        processInputStep: async ({ stepNumber, messageList }) => {
          executionLog.push(`step-only-processInputStep-${stepNumber}`);
          return messageList;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [inputOnlyProcessor, stepOnlyProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('user message')], 'user');

      await runner.runInputProcessors(messageList);

      await runner.runProcessInputStep({
        messages: messageList.get.all.db(),
        messageList,
        stepNumber: 0,
      });

      expect(executionLog).toEqual(['input-only-processInput', 'step-only-processInputStep-0']);
    });
  });
});
