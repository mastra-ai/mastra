import { describe, expect, it, vi } from 'vitest';

import { MessageList } from '../agent/message-list';
import type { MastraLanguageModelV2 } from '../llm/model/shared.types';
import type { IMastraLogger } from '../logger';
import type { Processor } from './index';
import { ProcessorRunner } from './runner';

/**
 * Issue #8925: Add ability to apply processors to modify model provider requests
 * Related Issue #7799: Anthropic thinking mode fails when using tool calls
 *
 * Problem:
 * When using Anthropic Claude with "thinking" mode enabled, users get errors because:
 * 1. The AI SDK uses `reasoning` type internally
 * 2. Anthropic expects `thinking` type
 * 3. Users need to transform messages at EACH STEP of the agentic loop (during tool call continuations)
 *
 * Current behavior:
 * - `processInput` runs ONCE at the start, before the agentic loop
 * - During multi-step tool call flows, there's no processor hook to modify messages per-step
 *
 * Expected behavior:
 * - `processInputStep` should run at each step of the agentic loop
 * - This allows processors to transform messages (like `reasoning` -> `thinking`) before each LLM call
 *
 * @see https://github.com/mastra-ai/mastra/issues/8925
 * @see https://github.com/mastra-ai/mastra/issues/7799
 */
describe('processInputStep - Issue #8925', () => {
  // Mock logger
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

  describe('Current behavior: processInput runs once', () => {
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

      // First call - simulates start of agent execution
      await runner.runInputProcessors(messageList);
      expect(processInputCallCount).toBe(1);

      // Simulate adding tool result to message list (what happens between steps)
      messageList.add([createMessage('tool result', 'assistant')], 'response');

      // There is NO way to run input processors again for step 2
      // because runInputProcessors is only called once at the start
      // The only way to transform messages at each step is via prepareStep callback
      // which is NOT part of the processor system

      expect(processInputCallCount).toBe(1); // Still 1 - no per-step processing
    });
  });

  describe('processInputStep interface definition (NEW FEATURE)', () => {
    it.fails('Processor interface should include processInputStep method', async () => {
      // This test verifies that ProcessorRunner recognizes and calls processInputStep
      // It should FAIL until the feature is implemented

      const stepProcessor: Processor = {
        id: 'step-processor',
        // @ts-expect-error - processInputStep doesn't exist yet
        processInputStep: async ({ messages, _stepNumber, _model }) => {
          // Transform messages at each step
          return { messages };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [stepProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      // Check if the runner has the method to run processInputStep processors
      // This will fail until runProcessInputStep is implemented
      // @ts-expect-error - runProcessInputStep doesn't exist yet
      const result = await runner.runProcessInputStep({
        messages: [{ role: 'user', content: 'test' }],
        stepNumber: 0,
        model: {} as MastraLanguageModelV2,
        steps: [],
      });

      expect(result).toBeDefined();
    });
  });

  describe('ProcessorRunner.runProcessInputStep (NEW FEATURE)', () => {
    it.fails('ProcessorRunner should have runProcessInputStep method', async () => {
      const stepProcessor: Processor = {
        id: 'step-processor',
        // @ts-expect-error - processInputStep doesn't exist yet
        processInputStep: async ({ messages, stepNumber }) => {
          return { messages };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [stepProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      // This method doesn't exist yet - test should fail
      // @ts-expect-error - runProcessInputStep doesn't exist yet
      expect(typeof runner.runProcessInputStep).toBe('function');
    });

    it.fails('runProcessInputStep should be called at each step of agentic loop', async () => {
      let processInputStepCallCount = 0;
      const stepNumbers: number[] = [];
      const messagesSeenAtEachStep: any[][] = [];

      const stepProcessor: Processor = {
        id: 'step-processor',
        // @ts-expect-error - processInputStep doesn't exist yet
        processInputStep: async ({ messages, stepNumber }: { messages: any[]; stepNumber: number }) => {
          processInputStepCallCount++;
          stepNumbers.push(stepNumber);
          messagesSeenAtEachStep.push([...messages]);
          return { messages };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [stepProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      // Mock model and step results for testing
      const mockModel = {} as MastraLanguageModelV2;
      const mockSteps: any[] = [];

      // Simulate step 0
      const step0Messages: any[] = [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }];

      // @ts-expect-error - runProcessInputStep doesn't exist yet
      await runner.runProcessInputStep({
        messages: step0Messages,
        stepNumber: 0,
        model: mockModel,
        steps: mockSteps,
      });

      // Simulate step 1 (after tool call)
      const step1Messages: any[] = [
        { role: 'user', content: [{ type: 'text', text: 'Hello' }] },
        {
          role: 'assistant',
          content: [{ type: 'tool-call', toolCallId: 'call-1', toolName: 'get_weather', input: {} }],
        },
        { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'call-1', output: { temp: 72 } }] },
      ];

      // @ts-expect-error - runProcessInputStep doesn't exist yet
      await runner.runProcessInputStep({
        messages: step1Messages,
        stepNumber: 1,
        model: mockModel,
        steps: mockSteps,
      });

      // Verify processInputStep was called at each step
      expect(processInputStepCallCount).toBe(2);
      expect(stepNumbers).toEqual([0, 1]);

      // Messages should grow between steps (tool call + tool result added)
      expect(messagesSeenAtEachStep[0].length).toBe(1);
      expect(messagesSeenAtEachStep[1].length).toBe(3);
    });
  });

  describe('Anthropic thinking mode use case - Issue #7799', () => {
    it.fails('should transform reasoning blocks to thinking blocks at each step', async () => {
      let transformationCount = 0;

      const anthropicThinkingProcessor: Processor = {
        id: 'anthropic-thinking-fix',
        // @ts-expect-error - processInputStep doesn't exist yet
        processInputStep: async ({ messages }: { messages: any[] }) => {
          // Transform reasoning -> thinking for Anthropic compatibility
          const transformedMsgs = messages.map(msg => {
            if (msg.role === 'assistant' && Array.isArray(msg.content)) {
              return {
                ...msg,
                content: msg.content.map((part: any) => {
                  if (part.type === 'reasoning') {
                    transformationCount++;
                    return { ...part, type: 'thinking' };
                  }
                  if (part.type === 'redacted-reasoning') {
                    transformationCount++;
                    return { ...part, type: 'redacted_thinking' };
                  }
                  return part;
                }),
              };
            }
            return msg;
          });

          return { messages: transformedMsgs };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [anthropicThinkingProcessor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const mockModel = {} as MastraLanguageModelV2;
      const mockSteps: any[] = [];

      // Step 1 messages include a reasoning block from step 0
      const step1Messages: any[] = [
        { role: 'user', content: [{ type: 'text', text: 'What is the weather?' }] },
        {
          role: 'assistant',
          content: [
            // AI SDK returns 'reasoning' type, but Anthropic expects 'thinking'
            { type: 'reasoning', reasoning: 'Let me check the weather...' },
            { type: 'tool-call', toolCallId: 'call-1', toolName: 'get_weather', input: { location: 'SF' } },
          ],
        },
        { role: 'tool', content: [{ type: 'tool-result', toolCallId: 'call-1', output: { temp: 72 } }] },
      ];

      // @ts-expect-error - runProcessInputStep doesn't exist yet
      const result = await runner.runProcessInputStep({
        messages: step1Messages,
        stepNumber: 1,
        model: mockModel,
        steps: mockSteps,
      });

      // The reasoning block should have been transformed to thinking
      expect(transformationCount).toBe(1);

      // Verify the transformed message has 'thinking' type
      const assistantMsg = result.messages.find((m: any) => m.role === 'assistant');
      const thinkingPart = assistantMsg?.content.find((p: any) => p.type === 'thinking');
      expect(thinkingPart).toBeDefined();
    });
  });

  describe('Multiple processInputStep processors run in sequence', () => {
    it.fails('should run multiple processInputStep processors in order', async () => {
      const executionOrder: string[] = [];

      const processor1: Processor = {
        id: 'processor-1',
        // @ts-expect-error - processInputStep doesn't exist yet
        processInputStep: async ({ messages }: { messages: any[] }) => {
          executionOrder.push('processor-1');
          return { messages };
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        // @ts-expect-error - processInputStep doesn't exist yet
        processInputStep: async ({ messages }: { messages: any[] }) => {
          executionOrder.push('processor-2');
          return { messages };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor1, processor2],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const mockModel = {} as MastraLanguageModelV2;
      const mockSteps: any[] = [];

      // @ts-expect-error - runProcessInputStep doesn't exist yet
      await runner.runProcessInputStep({
        messages: [{ role: 'user', content: [{ type: 'text', text: 'Hello' }] }],
        stepNumber: 0,
        model: mockModel,
        steps: mockSteps,
      });

      // Processors should run in order
      expect(executionOrder).toEqual(['processor-1', 'processor-2']);
    });
  });

  describe('processInput and processInputStep work together', () => {
    it.fails('processInput runs once at start, processInputStep runs at each step', async () => {
      const executionLog: string[] = [];

      // A processor that has BOTH processInput and processInputStep
      const dualProcessor: Processor = {
        id: 'dual-processor',
        // processInput runs once at the beginning (before agentic loop)
        processInput: async ({ messages }) => {
          executionLog.push('processInput');
          return messages;
        },
        // @ts-expect-error - processInputStep doesn't exist yet
        processInputStep: async ({ messages, stepNumber }: { messages: any[]; stepNumber: number }) => {
          executionLog.push(`processInputStep-${stepNumber}`);
          return { messages };
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

      // Step 1: runInputProcessors is called once at the start (before agentic loop)
      await runner.runInputProcessors(messageList);

      // Step 2: runProcessInputStep is called at step 0
      const mockModel = {} as MastraLanguageModelV2;
      // @ts-expect-error - runProcessInputStep doesn't exist yet
      await runner.runProcessInputStep({
        messages: [{ role: 'user', content: 'Hello' }],
        stepNumber: 0,
        model: mockModel,
        steps: [],
      });

      // Step 3: runProcessInputStep is called at step 1 (after tool call)
      // @ts-expect-error - runProcessInputStep doesn't exist yet
      await runner.runProcessInputStep({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: [{ type: 'tool-call', toolName: 'test' }] },
          { role: 'tool', content: [{ type: 'tool-result', result: 'done' }] },
        ],
        stepNumber: 1,
        model: mockModel,
        steps: [],
      });

      // Verify the execution order:
      // 1. processInput runs once at the start
      // 2. processInputStep runs at each step (0, 1)
      expect(executionLog).toEqual(['processInput', 'processInputStep-0', 'processInputStep-1']);
    });

    it.fails('processor with only processInput should not affect processInputStep flow', async () => {
      const executionLog: string[] = [];

      // A processor that ONLY has processInput (legacy behavior)
      const inputOnlyProcessor: Processor = {
        id: 'input-only',
        processInput: async ({ messages }) => {
          executionLog.push('input-only-processInput');
          return messages;
        },
      };

      // A processor that ONLY has processInputStep (new behavior)
      const stepOnlyProcessor: Processor = {
        id: 'step-only',
        // @ts-expect-error - processInputStep doesn't exist yet
        processInputStep: async ({ messages, stepNumber }: { messages: any[]; stepNumber: number }) => {
          executionLog.push(`step-only-processInputStep-${stepNumber}`);
          return { messages };
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

      // Run input processors (only inputOnlyProcessor has processInput)
      await runner.runInputProcessors(messageList);

      // Run step processors (only stepOnlyProcessor has processInputStep)
      const mockModel = {} as MastraLanguageModelV2;
      // @ts-expect-error - runProcessInputStep doesn't exist yet
      await runner.runProcessInputStep({
        messages: [{ role: 'user', content: 'Hello' }],
        stepNumber: 0,
        model: mockModel,
        steps: [],
      });

      // Verify:
      // - processInput only runs for processors that have it
      // - processInputStep only runs for processors that have it
      expect(executionLog).toEqual(['input-only-processInput', 'step-only-processInputStep-0']);
    });
  });
});
