import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { delay } from '../../utils';
import { Agent } from '../agent';

describe('Tool suspension memory persistence', () => {
  it('should save thread and messages to memory before suspension when tool requires approval', async () => {
    // Create a mock memory instance with in-memory storage
    const mockMemory = new MockMemory();

    // Create a tool that requires approval
    const findJobTool = createTool({
      id: 'find-job-tool',
      description: 'Use this tool to find job listings based on user criteria.',
      inputSchema: z.object({
        title: z.string().optional().describe('The job title to search for.'),
      }),
      requireApproval: true,
      execute: async (inputData: { title?: string }) => {
        const { title } = inputData;
        return `Here are some job listings for the title: ${title || 'any position'}.`;
      },
    });

    // Create a mock model that will generate a tool call
    const mockModel = new MockLanguageModelV2({
      doStream: async () => {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'test-id', modelId: 'test-model', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Let me find job listings for you.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'tool-call-delta',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: 'find-job-tool',
              argsTextDelta: '{"title":"software engineer"}',
            },
            {
              type: 'tool-call',
              toolCallType: 'function',
              toolCallId: 'call-1',
              toolName: 'find-job-tool',
              args: '{"title":"software engineer"}',
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ] as any),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    // Create agent with memory and the approval tool
    const agent = new Agent({
      id: 'require-tool-agent',
      name: 'Require Tool Agent',
      instructions: 'You are a helpful assistant.',
      model: mockModel,
      tools: {
        findJobTool,
      },
      memory: mockMemory,
    });

    const threadId = 'test-thread-9745';
    const resourceId = 'user-test-9745';

    // Verify thread does not exist yet
    const threadBefore = await mockMemory.getThreadById({ threadId });
    expect(threadBefore).toBeNull();

    // Start streaming
    const stream = await agent.stream('find me a software engineer job', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Consume stream until we hit the tool-call-approval event
    let hitApprovalEvent = false;
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-approval') {
        hitApprovalEvent = true;
        break; // Stop at suspension point
      }
    }

    expect(hitApprovalEvent).toBe(true);

    // Give the debounced save time to fire (if it exists)
    // The debounce is 100ms, so 150ms should be enough
    await delay(150);

    // Assert 1: Thread should be created in database
    const threadAfterSuspension = await mockMemory.getThreadById({ threadId });
    expect(threadAfterSuspension).not.toBeNull();
    expect(threadAfterSuspension?.resourceId).toBe(resourceId);

    // Assert 2: User message should be saved
    const messagesAfterSuspension = await mockMemory.recall({
      threadId,
      resourceId,
    });

    const userMessages = messagesAfterSuspension.messages.filter(m => m.role === 'user');
    expect(userMessages.length).toBeGreaterThan(0);

    const userMessage = userMessages.find(m => {
      const content = m.content;
      if (typeof content === 'string') return content.includes('software engineer job');
      if (typeof content === 'object' && 'parts' in content) {
        return content.parts.some(p => p.type === 'text' && p.text.includes('software engineer job'));
      }
      return false;
    });
    expect(userMessage).toBeDefined();

    // Assert 3: Assistant message with tool call should be saved
    const assistantMessages = messagesAfterSuspension.messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    const assistantWithToolCall = assistantMessages.find(m => {
      const content = m.content;
      if (typeof content === 'object' && 'parts' in content) {
        return content.parts.some(
          (p: any) => p.type === 'tool-invocation' && p.toolInvocation?.toolName === 'find-job-tool',
        );
      }
      return false;
    });
    expect(assistantWithToolCall).toBeDefined();
  });

  it('should save thread and messages to memory before suspension when tool calls suspend()', async () => {
    const mockMemory = new MockMemory();

    // Create a tool that validates data (doesn't suspend)
    const validateTool = createTool({
      id: 'validate-data',
      description: 'Validates data format before processing',
      inputSchema: z.object({
        data: z.string().describe('The data to validate'),
      }),
      execute: async (inputData: { data: string }) => {
        return { valid: true, message: `Data "${inputData.data}" is valid` };
      },
    });

    // Create a tool that suspends during execution
    const processDataTool = createTool({
      id: 'process-data',
      description: 'Processes validated data and may require manual approval',
      inputSchema: z.object({
        data: z.string().describe('The data to process'),
      }),
      execute: async (_inputData: { data: string }, context?: any) => {
        const suspend = context?.agent?.suspend || context?.suspend;
        if (!suspend) {
          throw new Error('Expected suspend to be provided in context');
        }
        // Suspend to simulate waiting for manual approval/async work
        await suspend({ reason: 'Waiting for manual approval' });
        return { result: 'Data processed successfully' };
      },
    });

    // Create agent with memory and both tools
    const agent = new Agent({
      id: 'suspending-tool-agent',
      name: 'Suspending Tool Agent',
      instructions: `You are a helpful assistant. When asked to process data:
1. First, use the validate-data tool to validate the data
2. Then, use the process-data tool to process the validated data
Always follow this order.`,
      model: 'openai/gpt-4o-mini',
      tools: {
        validateData: validateTool,
        processData: processDataTool,
      },
      memory: mockMemory,
    });

    const threadId = 'test-thread-9906';
    const resourceId = 'user-test-9906';

    // Verify thread does not exist yet
    const threadBefore = await mockMemory.getThreadById({ threadId });
    expect(threadBefore).toBeNull();

    // Start streaming with savePerStep
    const stream = await agent.stream('Please process the data "test-data-123". First validate it, then process it.', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
      savePerStep: true,
      maxSteps: 10,
    });

    let suspensionDetected = false;

    // Consume stream until suspension - stop immediately at suspension point
    for await (const chunk of stream.fullStream) {
      if (chunk.type === 'tool-call-suspended') {
        suspensionDetected = true;
        break; // Stop at suspension point
      }
    }

    expect(suspensionDetected).toBe(true);

    // Give the debounced save time to fire (if it exists)
    await delay(150);

    // Assert: Thread should be created in database
    const threadAfterSuspension = await mockMemory.getThreadById({ threadId });
    expect(threadAfterSuspension).not.toBeNull();
    expect(threadAfterSuspension?.resourceId).toBe(resourceId);

    // Assert: All messages should be saved
    const messagesAfterSuspension = await mockMemory.recall({
      threadId,
      resourceId,
    });

    // Assert: User message should be saved
    const userMessages = messagesAfterSuspension.messages.filter(m => m.role === 'user');
    expect(userMessages.length).toBeGreaterThan(0);

    const userMessage = userMessages.find(m => {
      const content = m.content;
      if (typeof content === 'string') return content.includes('process');
      if (typeof content === 'object' && 'parts' in content) {
        return content.parts.some(p => p.type === 'text' && p.text.includes('process'));
      }
      return false;
    });
    expect(userMessage).toBeDefined();

    // Assert: Assistant messages with tool call should be saved
    const assistantMessages = messagesAfterSuspension.messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    // Verify both tool calls are saved - validation tool and suspending tool
    // Both tools should appear in the parts array (toolName can be validateData or validate-data)
    const hasValidateTool = assistantMessages.some(m => {
      const content = m.content;
      if (typeof content === 'object' && 'parts' in content) {
        return content.parts.some(
          (p: any) =>
            p.type === 'tool-invocation' &&
            (p.toolInvocation?.toolName === 'validate-data' || p.toolInvocation?.toolName === 'validateData'),
        );
      }
      return false;
    });
    expect(hasValidateTool).toBe(true);

    const hasProcessTool = assistantMessages.some(m => {
      const content = m.content;
      if (typeof content === 'object' && 'parts' in content) {
        return content.parts.some(
          (p: any) =>
            p.type === 'tool-invocation' &&
            (p.toolInvocation?.toolName === 'process-data' || p.toolInvocation?.toolName === 'processData'),
        );
      }
      return false;
    });
    expect(hasProcessTool).toBe(true);
  });
});
