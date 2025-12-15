import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

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

  const createMockModel = (id: string = 'test-model') =>
    ({
      modelId: id,
      specificationVersion: 'v2',
      provider: 'test',
      defaultObjectGenerationMode: 'json',
      supportsImageUrls: false,
      supportsStructuredOutputs: true,
      doGenerate: async () => ({}),
      doStream: async () => ({}),
    }) as any;

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
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      // runProcessInputStep now returns a result object, not MessageList
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.messageList).toBeInstanceOf(MessageList);
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
        messageList: messageList0,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
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
        messageList: messageList1,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
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
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
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
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      expect(executionOrder).toEqual(['processor-1', 'processor-2']);
    });

    it('should chain model changes through multiple processors', async () => {
      const modelsSeenByEachProcessor: Array<{ processorId: string; modelId: string }> = [];

      // Create mock models with identifiable IDs
      const createMockModel = (id: string) =>
        ({
          modelId: id,
          specificationVersion: 'v2',
          provider: 'test',
          defaultObjectGenerationMode: 'json',
          supportsImageUrls: false,
          supportsStructuredOutputs: true,
          doGenerate: async () => ({}),
          doStream: async () => ({}),
        }) as any;

      const initialModel = createMockModel('initial-model');
      const modelFromProcessor1 = createMockModel('model-from-processor-1');
      const modelFromProcessor2 = createMockModel('model-from-processor-2');

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ model }) => {
          modelsSeenByEachProcessor.push({
            processorId: 'processor-1',
            modelId: model.modelId,
          });
          // Return a different model
          return { model: modelFromProcessor1 };
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async ({ model }) => {
          modelsSeenByEachProcessor.push({
            processorId: 'processor-2',
            modelId: model.modelId,
          });
          // Return yet another model
          return { model: modelFromProcessor2 };
        },
      };

      const processor3: Processor = {
        id: 'processor-3',
        processInputStep: async ({ model }) => {
          modelsSeenByEachProcessor.push({
            processorId: 'processor-3',
            modelId: model.modelId,
          });
          // Don't change the model, just observe
          return {};
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor1, processor2, processor3],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: initialModel,
        steps: [],
      });

      // Verify what each processor saw
      expect(modelsSeenByEachProcessor).toEqual([
        { processorId: 'processor-1', modelId: 'initial-model' },
        { processorId: 'processor-2', modelId: 'model-from-processor-1' },
        { processorId: 'processor-3', modelId: 'model-from-processor-2' },
      ]);

      // Verify the final result has the last model
      expect(result.model?.modelId).toBe('model-from-processor-2');
    });

    it('should chain providerOptions changes through multiple processors', async () => {
      const providerOptionsSeenByEachProcessor: Array<{ processorId: string; options: any }> = [];

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ providerOptions }) => {
          providerOptionsSeenByEachProcessor.push({
            processorId: 'processor-1',
            options: { ...providerOptions },
          });
          return {
            providerOptions: {
              ...providerOptions,
              anthropic: { cacheControl: { type: 'ephemeral' } },
            },
          };
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async ({ providerOptions }) => {
          providerOptionsSeenByEachProcessor.push({
            processorId: 'processor-2',
            options: { ...providerOptions },
          });
          return {
            providerOptions: {
              ...providerOptions,
              openai: { reasoningEffort: 'high' },
            },
          };
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

      const mockModel = {
        modelId: 'test-model',
        specificationVersion: 'v2',
        provider: 'test',
      } as any;

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: mockModel,
        steps: [],
        providerOptions: { initial: { setting: true } },
      });

      // Verify processor1 saw the initial options
      expect(providerOptionsSeenByEachProcessor[0]).toEqual({
        processorId: 'processor-1',
        options: { initial: { setting: true } },
      });

      // Verify processor2 saw the options modified by processor1
      expect(providerOptionsSeenByEachProcessor[1]).toEqual({
        processorId: 'processor-2',
        options: {
          initial: { setting: true },
          anthropic: { cacheControl: { type: 'ephemeral' } },
        },
      });

      // Verify the final result has both modifications
      expect(result.providerOptions).toEqual({
        initial: { setting: true },
        anthropic: { cacheControl: { type: 'ephemeral' } },
        openai: { reasoningEffort: 'high' },
      });
    });
  });

  describe('toolChoice and activeTools', () => {
    it('should allow processor to modify toolChoice', async () => {
      const processor: Processor = {
        id: 'toolchoice-processor',
        processInputStep: async () => {
          return { toolChoice: 'none' as const };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        toolChoice: 'auto',
      });

      expect(result.toolChoice).toBe('none');
    });

    it('should chain toolChoice changes through multiple processors', async () => {
      const toolChoicesSeenByEachProcessor: Array<{ processorId: string; toolChoice: any }> = [];

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ toolChoice }) => {
          toolChoicesSeenByEachProcessor.push({
            processorId: 'processor-1',
            toolChoice,
          });
          return { toolChoice: { type: 'tool', toolName: 'specificTool' } };
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async ({ toolChoice }) => {
          toolChoicesSeenByEachProcessor.push({
            processorId: 'processor-2',
            toolChoice,
          });
          return { toolChoice: 'none' as const };
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

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        toolChoice: 'auto',
      });

      expect(toolChoicesSeenByEachProcessor[0].toolChoice).toBe('auto');
      expect(toolChoicesSeenByEachProcessor[1].toolChoice).toEqual({ type: 'tool', toolName: 'specificTool' });
      expect(result.toolChoice).toBe('none');
    });

    it('should allow processor to modify activeTools', async () => {
      const processor: Processor = {
        id: 'activetools-processor',
        processInputStep: async () => {
          return { activeTools: ['tool1', 'tool2'] };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        activeTools: ['tool1', 'tool2', 'tool3'],
      });

      expect(result.activeTools).toEqual(['tool1', 'tool2']);
    });

    it('should chain activeTools changes through multiple processors', async () => {
      const activeToolsSeenByEachProcessor: Array<{ processorId: string; activeTools: any }> = [];

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ activeTools }) => {
          activeToolsSeenByEachProcessor.push({
            processorId: 'processor-1',
            activeTools: [...(activeTools || [])],
          });
          return { activeTools: ['tool1', 'tool2'] };
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async ({ activeTools }) => {
          activeToolsSeenByEachProcessor.push({
            processorId: 'processor-2',
            activeTools: [...(activeTools || [])],
          });
          return { activeTools: ['tool1'] };
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

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        activeTools: ['tool1', 'tool2', 'tool3'],
      });

      expect(activeToolsSeenByEachProcessor[0].activeTools).toEqual(['tool1', 'tool2', 'tool3']);
      expect(activeToolsSeenByEachProcessor[1].activeTools).toEqual(['tool1', 'tool2']);
      expect(result.activeTools).toEqual(['tool1']);
    });
  });

  describe('tools', () => {
    it('should pass tools to processor', async () => {
      let receivedTools: any;

      const processor: Processor = {
        id: 'tools-reader',
        processInputStep: async ({ tools }) => {
          receivedTools = tools;
          return {};
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const mockTools = {
        myTool: { id: 'myTool', execute: () => 'result' },
        anotherTool: { id: 'anotherTool', execute: () => 'another result' },
      };

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        tools: mockTools as any,
      });

      expect(receivedTools).toBe(mockTools);
    });

    it('should allow processor to replace tools', async () => {
      const originalTools = {
        originalTool: { id: 'originalTool', execute: () => 'original' },
      };

      const newTools = {
        newTool: { id: 'newTool', execute: () => 'new' },
        anotherNewTool: { id: 'anotherNewTool', execute: () => 'another new' },
      };

      const processor: Processor = {
        id: 'tools-replacer',
        processInputStep: async () => {
          return { tools: newTools as any };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        tools: originalTools as any,
      });

      expect(result.tools).toBe(newTools);
    });

    it('should chain tools changes through multiple processors', async () => {
      const toolsSeenByEachProcessor: Array<{ processorId: string; toolNames: string[] }> = [];

      const initialTools = {
        tool1: { id: 'tool1' },
        tool2: { id: 'tool2' },
      };

      const toolsFromProcessor1 = {
        tool1: { id: 'tool1' },
        newTool: { id: 'newTool' },
      };

      const toolsFromProcessor2 = {
        finalTool: { id: 'finalTool' },
      };

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ tools }) => {
          toolsSeenByEachProcessor.push({
            processorId: 'processor-1',
            toolNames: Object.keys(tools || {}),
          });
          return { tools: toolsFromProcessor1 as any };
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async ({ tools }) => {
          toolsSeenByEachProcessor.push({
            processorId: 'processor-2',
            toolNames: Object.keys(tools || {}),
          });
          return { tools: toolsFromProcessor2 as any };
        },
      };

      const processor3: Processor = {
        id: 'processor-3',
        processInputStep: async ({ tools }) => {
          toolsSeenByEachProcessor.push({
            processorId: 'processor-3',
            toolNames: Object.keys(tools || {}),
          });
          // Don't change tools, just observe
          return {};
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor1, processor2, processor3],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        tools: initialTools as any,
      });

      // Verify what each processor saw
      expect(toolsSeenByEachProcessor).toEqual([
        { processorId: 'processor-1', toolNames: ['tool1', 'tool2'] },
        { processorId: 'processor-2', toolNames: ['tool1', 'newTool'] },
        { processorId: 'processor-3', toolNames: ['finalTool'] },
      ]);

      // Verify the final result has the last tools
      expect(result.tools).toBe(toolsFromProcessor2);
    });

    it('should allow processor to merge tools by spreading', async () => {
      const initialTools = {
        existingTool: { id: 'existingTool', execute: () => 'existing' },
      };

      const processor: Processor = {
        id: 'tools-merger',
        processInputStep: async ({ tools }) => {
          // Merge new tools with existing ones by spreading
          return {
            tools: {
              ...tools,
              addedTool: { id: 'addedTool', execute: () => 'added' },
            } as any,
          };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        tools: initialTools as any,
      });

      expect(Object.keys(result.tools || {})).toEqual(['existingTool', 'addedTool']);
    });

    it('should handle processor not returning tools (no change)', async () => {
      const initialTools = {
        myTool: { id: 'myTool' },
      };

      const processor: Processor = {
        id: 'no-tools-change',
        processInputStep: async () => {
          // Return empty object - no tools change
          return {};
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        tools: initialTools as any,
      });

      // Result should have initial tools since processor didn't change them
      expect(result.tools).toBe(initialTools);
    });

    it('should handle undefined initial tools', async () => {
      let receivedTools: any;

      const processor: Processor = {
        id: 'tools-reader',
        processInputStep: async ({ tools }) => {
          receivedTools = tools;
          return {};
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        // No tools provided
      });

      expect(receivedTools).toBeUndefined();
    });
  });

  describe('modelSettings', () => {
    it('should allow processor to modify modelSettings', async () => {
      const processor: Processor = {
        id: 'modelsettings-processor',
        processInputStep: async () => {
          return {
            modelSettings: {
              maxTokens: 500,
              temperature: 0.7,
            },
          };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      expect(result.modelSettings).toEqual({
        maxTokens: 500,
        temperature: 0.7,
      });
    });

    it('should chain modelSettings changes through multiple processors', async () => {
      const modelSettingsSeenByEachProcessor: Array<{ processorId: string; settings: any }> = [];

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ modelSettings }) => {
          modelSettingsSeenByEachProcessor.push({
            processorId: 'processor-1',
            settings: { ...modelSettings },
          });
          return {
            modelSettings: {
              ...modelSettings,
              maxTokens: 1000,
            },
          };
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async ({ modelSettings }) => {
          modelSettingsSeenByEachProcessor.push({
            processorId: 'processor-2',
            settings: { ...modelSettings },
          });
          return {
            modelSettings: {
              ...modelSettings,
              temperature: 0.5,
            },
          };
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

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        modelSettings: { topP: 0.9 },
      });

      expect(modelSettingsSeenByEachProcessor[0].settings).toEqual({ topP: 0.9 });
      expect(modelSettingsSeenByEachProcessor[1].settings).toEqual({ topP: 0.9, maxTokens: 1000 });
      expect(result.modelSettings).toEqual({ topP: 0.9, maxTokens: 1000, temperature: 0.5 });
    });
  });

  describe('structuredOutput', () => {
    it('should allow processor to modify structuredOutput', async () => {
      const nameSchema = z.object({ name: z.string() });

      const processor: Processor = {
        id: 'schema-modifier',
        processInputStep: async () => {
          return {
            structuredOutput: {
              schema: nameSchema,
            },
          };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      expect(result.structuredOutput?.schema).toBe(nameSchema);
    });

    it('should chain structuredOutput changes through multiple processors', async () => {
      const nameSchema = z.object({ name: z.string() });
      const structuredOutputSeenByEachProcessor: Array<{ processorId: string; output: any }> = [];

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ structuredOutput }) => {
          structuredOutputSeenByEachProcessor.push({
            processorId: 'processor-1',
            output: structuredOutput ? { ...structuredOutput } : undefined,
          });
          return {
            structuredOutput: {
              schema: nameSchema,
            },
          };
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async ({ structuredOutput }) => {
          structuredOutputSeenByEachProcessor.push({
            processorId: 'processor-2',
            output: structuredOutput ? { ...structuredOutput } : undefined,
          });
          // Only modify if structuredOutput exists with a schema
          if (structuredOutput?.schema) {
            return {
              structuredOutput: {
                ...structuredOutput,
                instructions: 'Return a valid JSON object',
              },
            };
          }
          return {};
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

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      // First processor should see undefined (no initial structuredOutput)
      expect(structuredOutputSeenByEachProcessor[0].output).toBeUndefined();

      // Second processor should see the schema from processor 1
      expect(structuredOutputSeenByEachProcessor[1].output?.schema).toBe(nameSchema);

      // Final result should have both schema and instructions
      expect(result.structuredOutput?.schema).toBe(nameSchema);
      expect(result.structuredOutput?.instructions).toBe('Return a valid JSON object');
    });

    it('should pass initial structuredOutput to processors', async () => {
      const countSchema = z.object({ count: z.number() });
      let receivedStructuredOutput: any;

      const processor: Processor = {
        id: 'reader-processor',
        processInputStep: async ({ structuredOutput }) => {
          receivedStructuredOutput = structuredOutput;
          return {};
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        structuredOutput: { schema: countSchema },
      });

      expect(receivedStructuredOutput?.schema).toBe(countSchema);
    });

    it('should allow processor to extend the schema with additional fields', async () => {
      const baseSchema = z.object({ name: z.string() });
      let extendedSchema: z.ZodObject<any> | undefined;

      const processor: Processor = {
        id: 'schema-extender',
        processInputStep: async ({ structuredOutput }) => {
          if (structuredOutput?.schema && structuredOutput.schema instanceof z.ZodObject) {
            extendedSchema = structuredOutput.schema.extend({ age: z.number() });
            return {
              structuredOutput: {
                ...structuredOutput,
                schema: extendedSchema,
              },
            };
          }
          return {};
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
        structuredOutput: { schema: baseSchema },
      });

      // Verify the schema was extended
      expect(result.structuredOutput?.schema).toBe(extendedSchema);
      expect(extendedSchema).toBeDefined();

      // Verify the extended schema has both original and new fields
      const shape = extendedSchema!.shape;
      expect(shape.name).toBeDefined();
      expect(shape.age).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle empty inputProcessors array', async () => {
      const runner = new ProcessorRunner({
        inputProcessors: [],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const mockModel = createMockModel();
      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: mockModel,
        steps: [],
      });

      // Should return result with initial values (no processors to modify them)
      expect(result.model).toBe(mockModel);
    });

    it('should handle processor returning undefined', async () => {
      const processor: Processor = {
        id: 'undefined-processor',
        processInputStep: async () => {
          return undefined;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const mockModel = createMockModel();
      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: mockModel,
        steps: [],
      });

      // Should not throw, result should contain the initial model
      expect(result.model).toBe(mockModel);
    });

    it('should handle processor returning empty object', async () => {
      const processor: Processor = {
        id: 'empty-processor',
        processInputStep: async () => {
          return {};
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const mockModel = createMockModel();
      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: mockModel,
        steps: [],
      });

      // Result should contain the initial model (processor returned empty, so no changes)
      expect(result.model).toBe(mockModel);
    });

    it('should handle processor returning only partial result (just toolChoice)', async () => {
      const processor: Processor = {
        id: 'partial-processor',
        processInputStep: async () => {
          return { toolChoice: 'none' as const };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const mockModel = createMockModel();
      const result = await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: mockModel,
        steps: [],
        toolChoice: 'auto',
      });

      // toolChoice should be updated to 'none', model should be initial model
      expect(result.toolChoice).toBe('none');
      expect(result.model).toBe(mockModel);
      expect(result.activeTools).toBeUndefined(); // activeTools was not provided initially
    });

    it('should receive steps array with previous step results', async () => {
      let receivedSteps: any[] = [];

      const processor: Processor = {
        id: 'steps-processor',
        processInputStep: async ({ steps }) => {
          receivedSteps = steps;
          return {};
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      const mockSteps = [
        { text: 'First response', toolCalls: [], toolResults: [] },
        { text: 'Second response', toolCalls: [{ toolName: 'test' }], toolResults: [{ result: 'done' }] },
      ];

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 2,
        model: createMockModel(),
        steps: mockSteps as any,
      });

      expect(receivedSteps).toEqual(mockSteps);
      expect(receivedSteps.length).toBe(2);
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
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
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
        messageList,
        stepNumber: 1,
        model: createMockModel(),
        steps: [],
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
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      expect(executionLog).toEqual(['input-only-processInput', 'step-only-processInputStep-0']);
    });
  });

  describe('messages modification', () => {
    it('should allow processor to return modified messages array', async () => {
      const processor: Processor = {
        id: 'message-modifier',
        processInputStep: async ({ messages }) => {
          // Add a new message to the array
          const newMessage: MastraDBMessage = {
            id: 'injected-msg',
            role: 'user',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'Injected by processor' }],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          };
          return { messages: [...messages, newMessage] };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Original message')], 'input');

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      // The messageList should now contain the injected message
      const allMessages = messageList.get.all.db();
      expect(allMessages.length).toBe(2);
      expect(allMessages[1].id).toBe('injected-msg');
    });

    it('should chain messages modifications through multiple processors', async () => {
      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ messages }) => {
          const newMessage: MastraDBMessage = {
            id: 'msg-from-p1',
            role: 'user',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'From processor 1' }],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          };
          return { messages: [...messages, newMessage] };
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async ({ messages }) => {
          // Processor 2 should see messages including the one added by processor 1
          const newMessage: MastraDBMessage = {
            id: 'msg-from-p2',
            role: 'user',
            content: {
              format: 2 as const,
              parts: [{ type: 'text' as const, text: 'From processor 2' }],
            },
            createdAt: new Date(),
            threadId: 'test-thread',
          };
          return { messages: [...messages, newMessage] };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor1, processor2],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Original')], 'input');

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      const allMessages = messageList.get.all.db();
      expect(allMessages.length).toBe(3);
      expect(allMessages.map((m: MastraDBMessage) => m.id)).toEqual(
        expect.arrayContaining([expect.any(String), 'msg-from-p1', 'msg-from-p2']),
      );
    });
  });

  describe('systemMessages modification', () => {
    it('should allow processor to return modified systemMessages', async () => {
      const processor: Processor = {
        id: 'system-modifier',
        processInputStep: async ({ systemMessages }) => {
          // Add a new system message
          return {
            systemMessages: [...systemMessages, { role: 'system' as const, content: 'Additional instruction' }],
          };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('User message')], 'input');
      // Set initial system messages on messageList
      messageList.replaceAllSystemMessages([{ role: 'system', content: 'Original instruction' }]);

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      // Check system messages via messageList (they're applied directly, not returned in result)
      const systemMessages = messageList.getAllSystemMessages();
      expect(systemMessages.length).toBe(2);
      expect(systemMessages[0].content).toBe('Original instruction');
      expect(systemMessages[1].content).toBe('Additional instruction');
    });

    it('should chain systemMessages modifications through multiple processors', async () => {
      const systemMessagesSeenByEachProcessor: { processorId: string; count: number }[] = [];

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ systemMessages }) => {
          systemMessagesSeenByEachProcessor.push({
            processorId: 'processor-1',
            count: systemMessages.length,
          });
          return {
            systemMessages: [...systemMessages, { role: 'system' as const, content: 'From P1' }],
          };
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async ({ systemMessages }) => {
          systemMessagesSeenByEachProcessor.push({
            processorId: 'processor-2',
            count: systemMessages.length,
          });
          return {
            systemMessages: [...systemMessages, { role: 'system' as const, content: 'From P2' }],
          };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor1, processor2],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('User message')], 'input');
      // Set initial system messages on messageList
      messageList.replaceAllSystemMessages([{ role: 'system', content: 'Initial' }]);

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      // Processor 1 saw 1 system message
      // Processor 2 saw 2 system messages (processor 1 added one)
      expect(systemMessagesSeenByEachProcessor).toEqual([
        { processorId: 'processor-1', count: 1 },
        { processorId: 'processor-2', count: 2 },
      ]);

      // Final result has 3 system messages (check via messageList)
      const systemMessages = messageList.getAllSystemMessages();
      expect(systemMessages.length).toBe(3);
    });
  });

  describe('abort functionality', () => {
    it('should allow processor to abort the run', async () => {
      const processor: Processor = {
        id: 'aborting-processor',
        processInputStep: async ({ abort }) => {
          abort('Aborting for test');
          // This line should not be reached
          return {};
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      await expect(
        runner.runProcessInputStep({
          messageList,
          stepNumber: 0,
          model: createMockModel(),
          steps: [],
        }),
      ).rejects.toThrow('Aborting for test');
    });

    it('should stop the chain when processor aborts', async () => {
      const executionLog: string[] = [];

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async ({ abort }) => {
          executionLog.push('processor-1');
          abort('Abort from processor 1');
          return {};
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async () => {
          executionLog.push('processor-2');
          return {};
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

      await expect(
        runner.runProcessInputStep({
          messageList,
          stepNumber: 0,
          model: createMockModel(),
          steps: [],
        }),
      ).rejects.toThrow('Abort from processor 1');

      // Only processor-1 should have run
      expect(executionLog).toEqual(['processor-1']);
    });
  });

  describe('validation', () => {
    it('should reject external MessageList (returning different instance)', async () => {
      const externalMessageList = new MessageList({ threadId: 'external-thread' });

      const processor: Processor = {
        id: 'external-list-processor',
        processInputStep: async () => {
          // Return a different MessageList instance
          return externalMessageList;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      await expect(
        runner.runProcessInputStep({
          messageList,
          stepNumber: 0,
          model: createMockModel(),
          steps: [],
        }),
      ).rejects.toThrow(/returned a MessageList instance other than the one that was passed in/);
    });

    it('should reject external MessageList in result object', async () => {
      const externalMessageList = new MessageList({ threadId: 'external-thread' });

      const processor: Processor = {
        id: 'external-list-processor',
        processInputStep: async () => {
          return { messageList: externalMessageList };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      await expect(
        runner.runProcessInputStep({
          messageList,
          stepNumber: 0,
          model: createMockModel(),
          steps: [],
        }),
      ).rejects.toThrow(/returned a MessageList instance other than the one that was passed in/);
    });

    it('should reject returning both messages and messageList together', async () => {
      const processor: Processor = {
        id: 'both-processor',
        processInputStep: async ({ messages, messageList }) => {
          return { messages, messageList };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      await expect(
        runner.runProcessInputStep({
          messageList,
          stepNumber: 0,
          model: createMockModel(),
          steps: [],
        }),
      ).rejects.toThrow(/returned both messages and messageList/);
    });

    it('should reject v1 models', async () => {
      const v1Model = {
        modelId: 'v1-model',
        specificationVersion: 'v1',
        provider: 'test',
        doGenerate: async () => ({}),
        doStream: async () => ({}),
      } as any;

      const processor: Processor = {
        id: 'v1-model-processor',
        processInputStep: async () => {
          return { model: v1Model };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Hello')], 'input');

      await expect(
        runner.runProcessInputStep({
          messageList,
          stepNumber: 0,
          model: createMockModel(),
          steps: [],
        }),
      ).rejects.toThrow(/v1 models are not supported/);
    });
  });

  describe('error handling', () => {
    it('should stop the chain when processor throws an error', async () => {
      const executionLog: string[] = [];

      const processor1: Processor = {
        id: 'processor-1',
        processInputStep: async () => {
          executionLog.push('processor-1');
          throw new Error('Error from processor 1');
        },
      };

      const processor2: Processor = {
        id: 'processor-2',
        processInputStep: async () => {
          executionLog.push('processor-2');
          return {};
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

      await expect(
        runner.runProcessInputStep({
          messageList,
          stepNumber: 0,
          model: createMockModel(),
          steps: [],
        }),
      ).rejects.toThrow('Error from processor 1');

      // Only processor-1 should have run
      expect(executionLog).toEqual(['processor-1']);
    });
  });

  describe('messageList mutations', () => {
    it('should allow processor to mutate messageList directly and return it', async () => {
      const processor: Processor = {
        id: 'mutator',
        processInputStep: async ({ messageList }) => {
          // Mutate messageList directly
          messageList.add(
            [
              {
                id: 'mutated-msg',
                role: 'user',
                content: {
                  format: 2 as const,
                  parts: [{ type: 'text' as const, text: 'Added via mutation' }],
                },
                createdAt: new Date(),
                threadId: 'test-thread',
              } as MastraDBMessage,
            ],
            'input',
          );
          // Return the same messageList instance
          return messageList;
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Original')], 'input');

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      const allMessages = messageList.get.all.db();
      expect(allMessages.length).toBe(2);
      expect(allMessages[1].id).toBe('mutated-msg');
    });

    it('should allow processor to return messageList in result object', async () => {
      const processor: Processor = {
        id: 'mutator',
        processInputStep: async ({ messageList }) => {
          messageList.add(
            [
              {
                id: 'result-msg',
                role: 'user',
                content: {
                  format: 2 as const,
                  parts: [{ type: 'text' as const, text: 'Added and returned in result' }],
                },
                createdAt: new Date(),
                threadId: 'test-thread',
              } as MastraDBMessage,
            ],
            'input',
          );
          return { messageList };
        },
      };

      const runner = new ProcessorRunner({
        inputProcessors: [processor],
        outputProcessors: [],
        logger: mockLogger,
        agentName: 'test-agent',
      });

      const messageList = new MessageList({ threadId: 'test-thread' });
      messageList.add([createMessage('Original')], 'input');

      await runner.runProcessInputStep({
        messageList,
        stepNumber: 0,
        model: createMockModel(),
        steps: [],
      });

      const allMessages = messageList.get.all.db();
      expect(allMessages.length).toBe(2);
      expect(allMessages[1].id).toBe('result-msg');
    });
  });
});
