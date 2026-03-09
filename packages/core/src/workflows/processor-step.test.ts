import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import type { MastraDBMessage, MessageList } from '../agent/message-list';
import { TripWire } from '../agent/trip-wire';
import type { Processor } from '../processors';
import { ProcessorStepInputSchema, ProcessorStepOutputSchema, ProcessorStepSchema } from '../processors/step-schema';
import { Tool } from '../tools';
import { createStep, createWorkflow, isProcessor } from './workflow';

// Helper to create a mock MessageList
function createMockMessageList(messages: MastraDBMessage[] = []): MessageList {
  const mockMessageList = {
    get: {
      all: { db: () => messages },
      input: { db: () => messages.filter(m => m.role === 'user') },
      response: { db: () => messages.filter(m => m.role === 'assistant') },
    },
    add: vi.fn(),
    addSystem: vi.fn(),
    removeByIds: vi.fn(),
    startRecording: vi.fn(),
    stopRecording: vi.fn(() => []),
    makeMessageSourceChecker: vi.fn(() => ({ getSource: () => 'input' })),
    getAllSystemMessages: vi.fn(() => []),
  } as unknown as MessageList;
  return mockMessageList;
}

describe('isProcessor', () => {
  it('should return true for object with processInput method', () => {
    const processor: Processor = {
      id: 'test-processor',
      processInput: async ({ messages }) => messages,
    };
    expect(isProcessor(processor)).toBe(true);
  });

  it('should return true for object with processInputStep method', () => {
    const processor: Processor = {
      id: 'test-processor',
      processInputStep: async ({ messages }) => messages,
    };
    expect(isProcessor(processor)).toBe(true);
  });

  it('should return true for object with processOutputStream method', () => {
    const processor: Processor = {
      id: 'test-processor',
      processOutputStream: async ({ part }) => part,
    };
    expect(isProcessor(processor)).toBe(true);
  });

  it('should return true for object with processOutputResult method', () => {
    const processor: Processor = {
      id: 'test-processor',
      processOutputResult: async ({ messages }) => messages,
    };
    expect(isProcessor(processor)).toBe(true);
  });

  it('should return true for object with processOutputStep method', () => {
    const processor: Processor = {
      id: 'test-processor',
      processOutputStep: async ({ messages }) => messages,
    };
    expect(isProcessor(processor)).toBe(true);
  });

  it('should return true for processor with multiple methods', () => {
    const processor: Processor = {
      id: 'multi-processor',
      name: 'Multi Processor',
      processInput: async ({ messages }) => messages,
      processOutputResult: async ({ messages }) => messages,
    };
    expect(isProcessor(processor)).toBe(true);
  });

  it('should return false for null', () => {
    expect(isProcessor(null)).toBe(false);
  });

  it('should return false for undefined', () => {
    expect(isProcessor(undefined)).toBe(false);
  });

  it('should return false for object without id', () => {
    const obj = {
      processInput: async () => [],
    };
    expect(isProcessor(obj)).toBe(false);
  });

  it('should return false for object without processor methods', () => {
    const obj = {
      id: 'not-a-processor',
      someOtherMethod: () => {},
    };
    expect(isProcessor(obj)).toBe(false);
  });

  it('should return false for Agent instance', () => {
    const agent = new Agent({
      id: 'test-agent',
      instructions: 'test-agent',
      name: 'test-agent',
      model: 'openai/gpt-4o-mini',
    });
    expect(isProcessor(agent)).toBe(false);
  });

  it('should return false for Tool instance', () => {
    const tool = new Tool({
      id: 'test-tool',
      description: 'Test tool',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    });
    expect(isProcessor(tool)).toBe(false);
  });

  it('should return false for regular Step object', () => {
    const step = {
      id: 'test-step',
      inputSchema: z.object({}),
      outputSchema: z.object({}),
      execute: async () => ({}),
    };
    expect(isProcessor(step)).toBe(false);
  });
});

describe('createStep with Processor', () => {
  it('should wrap a processor as a step with correct id', () => {
    const processor: Processor = {
      id: 'my-processor',
      processInput: async ({ messages }) => messages,
    };

    const step = createStep(processor);

    expect(step.id).toBe('processor:my-processor');
  });

  it('should use processor name as description if available', () => {
    const processor: Processor = {
      id: 'my-processor',
      name: 'My Custom Processor',
      processInput: async ({ messages }) => messages,
    };

    const step = createStep(processor);

    expect(step.description).toBe('My Custom Processor');
  });

  it('should use default description if name not provided', () => {
    const processor: Processor = {
      id: 'my-processor',
      processInput: async ({ messages }) => messages,
    };

    const step = createStep(processor);

    expect(step.description).toBe('Processor my-processor');
  });

  it('should have ProcessorStepInputSchema as inputSchema', () => {
    const processor: Processor = {
      id: 'my-processor',
      processInput: async ({ messages }) => messages,
    };

    const step = createStep(processor);

    expect(step.inputSchema).toBe(ProcessorStepInputSchema);
  });

  it('should have ProcessorStepOutputSchema as outputSchema', () => {
    const processor: Processor = {
      id: 'my-processor',
      processInput: async ({ messages }) => messages,
    };

    const step = createStep(processor);

    expect(step.outputSchema).toBe(ProcessorStepOutputSchema);
  });

  it('should have component set to PROCESSOR', () => {
    const processor: Processor = {
      id: 'my-processor',
      processInput: async ({ messages }) => messages,
    };

    const step = createStep(processor);

    expect(step.component).toBe('PROCESSOR');
  });

  describe('execute function', () => {
    it('should call processInput when phase is input', async () => {
      const processInputMock = async ({ messages }) => {
        return messages.map(m => ({ ...m, modified: true }));
      };

      const processor: Processor = {
        id: 'input-processor',
        processInput: processInputMock,
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'input' as const,
        messages: [{ id: '1', content: 'test' }],
        messageList,
        systemMessages: [],
      };

      const result = await step.execute({ inputData } as any);

      expect(result).toEqual(
        expect.objectContaining({
          messages: [{ id: '1', content: 'test', modified: true }],
        }),
      );
    });

    it('should call processInputStep when phase is inputStep', async () => {
      const processInputStepMock = async ({ messages, stepNumber }) => {
        return messages.map(m => ({ ...m, step: stepNumber }));
      };

      const processor: Processor = {
        id: 'input-step-processor',
        processInputStep: processInputStepMock,
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'inputStep' as const,
        messages: [{ id: '1', content: 'test' }],
        messageList,
        stepNumber: 5,
        systemMessages: [],
      };

      const result = await step.execute({ inputData } as any);

      expect(result).toEqual(
        expect.objectContaining({
          messages: [{ id: '1', content: 'test', step: 5 }],
        }),
      );
    });

    it('should call processOutputStream when phase is outputStream (messageList optional)', async () => {
      const processOutputStreamMock = async ({ part }) => {
        return { ...part, processed: true };
      };

      const processor: Processor = {
        id: 'stream-processor',
        processOutputStream: processOutputStreamMock,
      };

      const step = createStep(processor);
      const inputData = {
        phase: 'outputStream' as const,
        messages: [],
        part: { type: 'text', text: 'hello' },
        streamParts: [],
        state: {},
        // messageList is optional for stream processing
      };

      const result = await step.execute({ inputData } as any);

      expect(result).toEqual(
        expect.objectContaining({
          part: { type: 'text', text: 'hello', processed: true },
        }),
      );
    });

    it('should call processOutputResult when phase is outputResult', async () => {
      const processOutputResultMock = async ({ messages }) => {
        return messages.filter(m => m.role !== 'system');
      };

      const processor: Processor = {
        id: 'output-result-processor',
        processOutputResult: processOutputResultMock,
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'outputResult' as const,
        messages: [
          { id: '1', role: 'user', content: 'hi' },
          { id: '2', role: 'system', content: 'system' },
          { id: '3', role: 'assistant', content: 'hello' },
        ],
        messageList,
      };

      const result = await step.execute({ inputData } as any);

      expect(result).toEqual(
        expect.objectContaining({
          messages: [
            { id: '1', role: 'user', content: 'hi' },
            { id: '3', role: 'assistant', content: 'hello' },
          ],
        }),
      );
    });

    it('should call processOutputStep when phase is outputStep', async () => {
      const processOutputStepMock = async ({ messages, text = '', finishReason = 'stop' }) => {
        return messages.map(m => ({
          ...m,
          metadata: { text, finishReason },
        }));
      };

      const processor: Processor = {
        id: 'output-step-processor',
        processOutputStep: processOutputStepMock,
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'outputStep' as const,
        messages: [{ id: '1', role: 'assistant', content: 'response' }],
        messageList,
        stepNumber: 0,
        finishReason: 'stop',
        text: 'generated text',
        systemMessages: [],
      };

      const result = await step.execute({ inputData } as any);

      expect(result).toEqual(
        expect.objectContaining({
          messages: [
            {
              id: '1',
              role: 'assistant',
              content: 'response',
              metadata: { text: 'generated text', finishReason: 'stop' },
            },
          ],
        }),
      );
    });

    it('should return original messages when processor method not implemented', async () => {
      const processor: Processor = {
        id: 'partial-processor',
        processInput: async ({ messages }) => messages,
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'outputResult' as const,
        messages: [{ id: '1', content: 'test' }],
        messageList,
      };

      const result = await step.execute({ inputData } as any);

      // Result includes pass-through fields for chaining, but messages should be unchanged
      expect(result).toEqual(
        expect.objectContaining({
          messages: [{ id: '1', content: 'test' }],
          phase: 'outputResult',
        }),
      );
    });

    it('should pass retryCount to processor methods', async () => {
      let receivedRetryCount: number | undefined;

      const processor: Processor = {
        id: 'retry-aware-processor',
        processInput: async ({ messages, retryCount }) => {
          receivedRetryCount = retryCount;
          return messages;
        },
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'input' as const,
        messages: [],
        messageList,
        retryCount: 3,
      };

      await step.execute({ inputData } as any);

      expect(receivedRetryCount).toBe(3);
    });

    it('should default retryCount to 0 when not provided', async () => {
      let receivedRetryCount: number | undefined;

      const processor: Processor = {
        id: 'retry-aware-processor',
        processInput: async ({ messages, retryCount }) => {
          receivedRetryCount = retryCount;
          return messages;
        },
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'input' as const,
        messages: [],
        messageList,
      };

      await step.execute({ inputData } as any);

      expect(receivedRetryCount).toBe(0);
    });

    it('should auto-create messageList from messages when messageList is missing', async () => {
      const processor: Processor = {
        id: 'input-processor',
        processInput: async ({ messages, messageList }) => {
          // Verify messageList was auto-created
          expect(messageList).toBeDefined();
          return messages;
        },
      };

      const step = createStep(processor);
      const inputData = {
        phase: 'input' as const,
        messages: [{ id: '1', role: 'user', content: { format: 2, parts: [{ type: 'text', text: 'test' }] } }],
        // messageList is missing but messages are provided - should auto-create
      };

      // Should NOT throw - messageList is auto-created from messages
      const result = await step.execute({ inputData } as any);
      expect(result.messages).toHaveLength(1);
    });

    it('should throw error when both messageList and messages are missing for processInput', async () => {
      const processor: Processor = {
        id: 'input-processor',
        processInput: async ({ messages }) => messages,
      };

      const step = createStep(processor);
      const inputData = {
        phase: 'input' as const,
        // Both messageList and messages are missing
      };

      await expect(step.execute({ inputData } as any)).rejects.toThrow(
        'Processor input-processor requires messageList or messages for processInput phase',
      );
    });

    it('should auto-create messageList for processOutputStep when only messages provided', async () => {
      const processor: Processor = {
        id: 'output-step-processor',
        processOutputStep: async ({ messages, messageList }) => {
          expect(messageList).toBeDefined();
          return messages;
        },
      };

      const step = createStep(processor);
      const inputData = {
        phase: 'outputStep' as const,
        messages: [{ id: '1', role: 'assistant', content: { format: 2, parts: [{ type: 'text', text: 'response' }] } }],
        stepNumber: 0,
        // messageList is missing but messages are provided
      };

      // Should NOT throw - messageList is auto-created from messages
      const result = await step.execute({ inputData } as any);
      expect(result.messages).toHaveLength(1);
    });
  });

  describe('TripWire handling (tripwire bubbling)', () => {
    it('should throw TripWire when abort is called', async () => {
      const processor: Processor = {
        id: 'blocking-processor',
        processInput: async ({ abort }) => {
          abort('Content violates policy');
          return [];
        },
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'input' as const,
        messages: [{ id: '1', content: 'bad content' }],
        messageList,
      };

      // TripWire should be thrown, not caught
      await expect(step.execute({ inputData } as any)).rejects.toThrow(TripWire);
      await expect(step.execute({ inputData } as any)).rejects.toThrow('Content violates policy');
    });

    it('should include retry flag in TripWire when abort called with retry option', async () => {
      const processor: Processor = {
        id: 'retry-processor',
        processOutputStep: async ({ abort }) => {
          abort('Response needs improvement', { retry: true });
          return [];
        },
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'outputStep' as const,
        messages: [{ id: '1', content: 'poor response' }],
        messageList,
        stepNumber: 0,
      };

      // TripWire should be thrown with retry option
      try {
        await step.execute({ inputData } as any);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        expect((error as TripWire).message).toBe('Response needs improvement');
        expect((error as TripWire).options?.retry).toBe(true);
      }
    });

    it('should include metadata in TripWire when abort called with metadata option', async () => {
      const processor: Processor = {
        id: 'metadata-processor',
        processInput: async ({ abort }) => {
          abort('PII detected', {
            metadata: {
              type: 'pii',
              fields: ['email', 'phone'],
              severity: 'high',
            },
          });
          return [];
        },
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'input' as const,
        messages: [
          {
            id: '1',
            role: 'user' as const,
            createdAt: new Date(),
            content: { format: 2 as const, parts: [{ type: 'text', text: 'my email is test@test.com' }] },
          },
        ],
        messageList,
      };

      // TripWire should be thrown with metadata
      try {
        await step.execute({ inputData } as any);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        expect((error as TripWire).message).toBe('PII detected');
        expect((error as TripWire).options?.metadata).toEqual({
          type: 'pii',
          fields: ['email', 'phone'],
          severity: 'high',
        });
      }
    });

    it('should include both retry and metadata in TripWire when both provided', async () => {
      const processor: Processor = {
        id: 'full-tripwire-processor',
        processOutputStep: async ({ abort }) => {
          abort('Tone inappropriate', {
            retry: true,
            metadata: { tone: 'aggressive', score: 0.9 },
          });
          return [];
        },
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'outputStep' as const,
        messages: [{ id: '1', content: 'aggressive response' }],
        messageList,
        stepNumber: 0,
      };

      // TripWire should be thrown with both retry and metadata
      try {
        await step.execute({ inputData } as any);
        expect.fail('Expected TripWire to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(TripWire);
        expect((error as TripWire).message).toBe('Tone inappropriate');
        expect((error as TripWire).options?.retry).toBe(true);
        expect((error as TripWire).options?.metadata).toEqual({ tone: 'aggressive', score: 0.9 });
      }
    });

    it('should re-throw non-TripWire errors', async () => {
      const processor: Processor = {
        id: 'error-processor',
        processInput: async () => {
          throw new Error('Unexpected error');
        },
      };

      const step = createStep(processor);
      const messageList = createMockMessageList();
      const inputData = {
        phase: 'input' as const,
        messages: [],
        messageList,
      };

      await expect(step.execute({ inputData } as any)).rejects.toThrow('Unexpected error');
    });
  });
});

describe('Processor Step in Workflow - TripWire handling', () => {
  it('should return tripwire status when processor in workflow calls abort', async () => {
    const tripwireProcessor: Processor = {
      id: 'blocking-processor',
      processInput: async ({ messages, abort }) => {
        // Check for blocked content
        const hasBlockedContent = messages.some(msg => JSON.stringify(msg.content).includes('blocked'));
        if (hasBlockedContent) {
          abort('Content blocked by policy', { retry: true, metadata: { severity: 'high' } });
        }
        return messages;
      },
    };

    const processorStep = createStep(tripwireProcessor);

    const workflow = createWorkflow({
      id: 'processor-tripwire-workflow',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .then(processorStep)
      .commit();

    const run = await workflow.createRun();
    const messageList = createMockMessageList([
      {
        id: '1',
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'This is blocked content' }] },
      },
    ]);

    const result = await run.start({
      inputData: {
        phase: 'input',
        messages: [
          {
            id: '1',
            role: 'user',
            createdAt: new Date(),
            content: { format: 2, parts: [{ type: 'text', text: 'This is blocked content' }] },
          },
        ],
        messageList,
      },
    });

    // Workflow should return tripwire status, not failed
    expect(result.status).toBe('tripwire');
    if (result.status === 'tripwire') {
      expect(result.tripwire?.reason).toBe('Content blocked by policy');
      expect(result.tripwire?.retry).toBe(true);
      expect(result.tripwire?.metadata).toEqual({ severity: 'high' });
    }
  });

  it('should return tripwire status when processor in parallel workflow calls abort', async () => {
    const passingProcessor: Processor = {
      id: 'passing-processor',
      processInput: async ({ messages }) => messages,
    };

    const tripwireProcessor: Processor = {
      id: 'tripwire-processor',
      processInput: async ({ messages, abort }) => {
        const hasBlockedContent = messages.some(msg => JSON.stringify(msg.content).includes('blocked'));
        if (hasBlockedContent) {
          abort('Parallel processor blocked content', { retry: false, metadata: { source: 'parallel' } });
        }
        return messages;
      },
    };

    const passingStep = createStep(passingProcessor);
    const tripwireStep = createStep(tripwireProcessor);

    const workflow = createWorkflow({
      id: 'parallel-processor-tripwire-workflow',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .parallel([passingStep, tripwireStep])
      .commit();

    const run = await workflow.createRun();
    const messageList = createMockMessageList([
      {
        id: '1',
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'This is blocked content' }] },
      },
    ]);

    const result = await run.start({
      inputData: {
        phase: 'input',
        messages: [
          {
            id: '1',
            role: 'user',
            createdAt: new Date(),
            content: { format: 2, parts: [{ type: 'text', text: 'This is blocked content' }] },
          },
        ],
        messageList,
      },
    });

    // Workflow should return tripwire status
    expect(result.status).toBe('tripwire');
    if (result.status === 'tripwire') {
      expect(result.tripwire?.reason).toBe('Parallel processor blocked content');
      expect(result.tripwire?.retry).toBe(false);
      expect(result.tripwire?.metadata).toEqual({ source: 'parallel' });
    }
  });

  it('should propagate TripWire from a .then().parallel().map() inner workflow through the parent', async () => {
    // Simulates RegexPreFilter — passes through
    const regexPreFilter: Processor = {
      id: 'regex-pre-filter',
      async processInput({ messages }) {
        return messages;
      },
    };

    // Simulates TopicGuard — aborts for off-topic messages
    const topicGuard: Processor = {
      id: 'topic-guard',
      async processInput({ messages, abort }) {
        const text = JSON.stringify(messages);
        if (text.includes('i hate you')) {
          abort('This question is outside our support scope.', {
            metadata: { category: 'off-topic', confidence: 0.95 },
          });
        }
        return messages;
      },
    };

    // Simulates ModerationProcessor — passes through
    const moderation: Processor = {
      id: 'moderation',
      async processInput({ messages }) {
        return messages;
      },
    };

    // Build the inner pipeline: regexPreFilter → parallel([topicGuard, moderation]) → map(merge)
    const regexStep = createStep(regexPreFilter);
    const topicGuardStep = createStep(topicGuard);
    const moderationStep = createStep(moderation);

    const inputPipeline = createWorkflow({
      id: 'input-pipeline',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .then(regexStep)
      .parallel([topicGuardStep, moderationStep])
      .map(({ inputData }) => inputData['processor:topic-guard'] || inputData['processor:moderation'] || {})
      .commit();

    // Simulates ModelRouter — a processInputStep processor that runs AFTER the pipeline
    const modelRouter: Processor = {
      id: 'model-router',
      async processInputStep({ stepNumber }) {
        if (stepNumber === 0) return undefined;
        return { model: 'openai/gpt-5-nano' };
      },
    };

    // Build parent workflow: inputPipeline → modelRouter (same as combineProcessorsIntoWorkflow does)
    const inputPipelineStep = createStep(inputPipeline);
    const modelRouterStep = createStep(modelRouter);

    const parentWorkflow = createWorkflow({
      id: 'enterprise-agent-input-processor',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .then(inputPipelineStep)
      .then(modelRouterStep)
      .commit();

    const run = await parentWorkflow.createRun();
    const messageList = createMockMessageList([
      {
        id: '1',
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'i hate you' }] },
      },
    ]);

    const result = await run.start({
      inputData: {
        phase: 'input',
        messages: [
          {
            id: '1',
            role: 'user',
            createdAt: new Date(),
            content: { format: 2, parts: [{ type: 'text', text: 'i hate you' }] },
          },
        ],
        messageList,
      },
    });

    // The TripWire from topicGuard inside inputPipeline should propagate to the parent
    expect(result.status).toBe('tripwire');
    if (result.status === 'tripwire') {
      expect(result.tripwire?.reason).toBe('This question is outside our support scope.');
      expect(result.tripwire?.metadata).toEqual({ category: 'off-topic', confidence: 0.95 });
    }

    // The model-router step should NOT have run
    const modelRouterResult = result.steps['processor:model-router'];
    expect(modelRouterResult).toBeUndefined();
  });

  it('should NOT propagate TripWire when inner workflow succeeds', async () => {
    const passingProcessor: Processor = {
      id: 'passing-processor',
      async processInput({ messages }) {
        return messages;
      },
    };

    const innerWorkflow = createWorkflow({
      id: 'inner-pipeline',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .then(createStep(passingProcessor))
      .commit();

    const modelRouter: Processor = {
      id: 'model-router',
      async processInputStep() {
        return { model: 'openai/gpt-5-nano' };
      },
    };

    const parentWorkflow = createWorkflow({
      id: 'parent-pipeline',
      inputSchema: ProcessorStepSchema,
      outputSchema: ProcessorStepSchema,
    })
      .then(createStep(innerWorkflow))
      .then(createStep(modelRouter))
      .commit();

    const run = await parentWorkflow.createRun();
    const messageList = createMockMessageList([
      {
        id: '1',
        role: 'user',
        createdAt: new Date(),
        content: { format: 2, parts: [{ type: 'text', text: 'what laptops do you have?' }] },
      },
    ]);

    const result = await run.start({
      inputData: {
        phase: 'input',
        messages: [
          {
            id: '1',
            role: 'user',
            createdAt: new Date(),
            content: { format: 2, parts: [{ type: 'text', text: 'what laptops do you have?' }] },
          },
        ],
        messageList,
      },
    });

    // Should succeed — no TripWire
    expect(result.status).toBe('success');
  });
});
