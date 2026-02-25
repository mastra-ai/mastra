import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
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

  // Test moved to tool-suspension.e2e.test.ts: 'should save thread and messages to memory before suspension when tool calls suspend()'
  // That test uses real OpenAI model: 'openai/gpt-4o-mini'
});
