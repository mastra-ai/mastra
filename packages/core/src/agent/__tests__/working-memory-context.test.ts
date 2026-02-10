import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import type { ChunkType } from '../../stream/types';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { ToolsInput } from '../types';

/**
 * Tests for working memory tool injection and context propagation.
 *
 * The updateWorkingMemory tool requires a Memory instance and either threadId
 * (for thread-scoped) or resourceId (for resource-scoped) to function.
 * When agent.stream() is called without memory options (no thread or resource
 * context), memory tools must NOT be injected — otherwise the model may call
 * the tool and trigger a runtime error.
 */
describe('Working memory tool context propagation', () => {
  function getToolNames(
    tools: Parameters<NonNullable<ConstructorParameters<typeof MockLanguageModelV2>[0]>['doStream']>[0]['tools'],
  ) {
    return (tools ?? []).map(t => t.name);
  }

  function findWorkingMemoryTool(tools: Array<{ name: string }>) {
    return tools.find(t => t.name === 'updateWorkingMemory' || t.name === 'update-working-memory');
  }

  function createMockModelWithWorkingMemoryToolCall() {
    let callCount = 0;
    return new MockLanguageModelV2({
      doStream: async ({ tools }) => {
        callCount++;

        if (callCount === 1) {
          const wmTool = findWorkingMemoryTool(tools ?? []);

          if (!wmTool) {
            return {
              stream: convertArrayToReadableStream([
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date() },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'No updateWorkingMemory tool found' },
                { type: 'text-end', id: 'text-1' },
                {
                  type: 'finish',
                  finishReason: 'stop',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]),
              rawCall: { rawPrompt: null, rawSettings: {} },
              warnings: [],
            };
          }

          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date() },
              {
                type: 'tool-call',
                toolCallType: 'function' as const,
                toolCallId: 'wm-call-1',
                toolName: wmTool.name,
                input: JSON.stringify({
                  memory: '# Notes\n- **Key**: greeting\n- **Value**: hello world',
                }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }

        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'I remembered that.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
  }

  function createSimpleMockModel(onTools?: (toolNames: string[]) => void) {
    return new MockLanguageModelV2({
      doStream: async ({ tools }) => {
        onTools?.(getToolNames(tools));
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Hello!' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });
  }

  async function createAgentWithThread(mockModel: MockLanguageModelV2, opts?: { tools?: ToolsInput }) {
    const mockMemory = new MockMemory({
      enableWorkingMemory: true,
      workingMemoryTemplate: `# Notes\n- **Key**:\n- **Value**:\n`,
    });

    const agent = new Agent({
      id: 'wm-test-agent',
      name: 'WM Test Agent',
      instructions: 'You are a helpful agent that remembers information.',
      model: mockModel,
      memory: mockMemory,
      ...(opts?.tools ? { tools: opts.tools } : {}),
    });

    const threadId = 'test-thread';
    const resourceId = 'test-resource';

    await mockMemory.saveThread({
      thread: {
        id: threadId,
        title: 'Test Thread',
        resourceId,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return { agent, mockMemory, threadId, resourceId };
  }

  it('should inject and execute updateWorkingMemory tool when thread context is provided', async () => {
    const mockModel = createMockModelWithWorkingMemoryToolCall();
    const { agent, mockMemory, threadId, resourceId } = await createAgentWithThread(mockModel);

    const stream = await agent.stream('Remember that my favorite greeting is hello world', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 3,
    });

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    const errorChunks = chunks.filter(c => c.type === 'error');
    expect(errorChunks).toHaveLength(0);

    const toolResultChunks = chunks.filter(c => c.type === 'tool-result');
    const wmToolResult = toolResultChunks.find(
      c =>
        c.type === 'tool-result' &&
        (c.payload.toolName === 'updateWorkingMemory' || c.payload.toolName === 'update-working-memory'),
    );
    expect(wmToolResult).toBeDefined();

    const savedWorkingMemory = await mockMemory.getWorkingMemory({ threadId, resourceId });
    expect(savedWorkingMemory).not.toBeNull();
    expect(savedWorkingMemory).toContain('greeting');
    expect(savedWorkingMemory).toContain('hello world');
  });

  it('should provide user-defined tools alongside working memory tool with correct context', async () => {
    interface ToolContext {
      toolName: string;
      threadId?: string;
      resourceId?: string;
      hasMemory: boolean;
    }
    const toolExecutionContexts: ToolContext[] = [];

    const lookupTool = createTool({
      id: 'lookup',
      description: 'Look up information',
      inputSchema: z.object({ query: z.string() }),
      execute: async (_input, context) => {
        toolExecutionContexts.push({
          toolName: 'lookup',
          threadId: context?.agent?.threadId,
          resourceId: context?.agent?.resourceId,
          hasMemory: !!context?.memory,
        });
        return { result: 'found' };
      },
    });

    let modelCallCount = 0;
    const mockModel = new MockLanguageModelV2({
      doStream: async ({ tools }) => {
        modelCallCount++;

        if (modelCallCount === 1) {
          const wmTool = findWorkingMemoryTool(tools ?? []);
          const wmToolName = wmTool?.name ?? 'updateWorkingMemory';

          return {
            stream: convertArrayToReadableStream([
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date() },
              {
                type: 'tool-call',
                toolCallType: 'function' as const,
                toolCallId: 'lookup-call-1',
                toolName: 'lookup',
                input: JSON.stringify({ query: 'test' }),
              },
              {
                type: 'tool-call',
                toolCallType: 'function' as const,
                toolCallId: 'wm-call-1',
                toolName: wmToolName,
                input: JSON.stringify({
                  memory: '# Notes\n- **Query**: test\n- **Result**: found',
                }),
              },
              {
                type: 'finish',
                finishReason: 'tool-calls' as const,
                usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
              },
            ]),
            rawCall: { rawPrompt: null, rawSettings: {} },
            warnings: [],
          };
        }

        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date() },
            { type: 'text-start', id: 'text-1' },
            { type: 'text-delta', id: 'text-1', delta: 'Done.' },
            { type: 'text-end', id: 'text-1' },
            {
              type: 'finish',
              finishReason: 'stop',
              usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
            },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      },
    });

    const { agent, mockMemory, threadId, resourceId } = await createAgentWithThread(mockModel, {
      tools: { lookup: lookupTool },
    });

    const stream = await agent.stream('Look up some info and remember it', {
      memory: { thread: threadId, resource: resourceId },
      maxSteps: 3,
    });

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    const errorChunks = chunks.filter(c => c.type === 'error');
    expect(errorChunks).toHaveLength(0);

    const lookupContext = toolExecutionContexts.find(c => c.toolName === 'lookup');
    expect(lookupContext).toBeDefined();
    expect(lookupContext!.threadId).toBe(threadId);
    expect(lookupContext!.resourceId).toBe(resourceId);
    expect(lookupContext!.hasMemory).toBe(true);

    const savedWorkingMemory = await mockMemory.getWorkingMemory({ threadId, resourceId });
    expect(savedWorkingMemory).not.toBeNull();
    expect(savedWorkingMemory).toContain('found');
  });

  it('should NOT inject memory tools when no thread or resource context is provided', async () => {
    const toolNames: string[] = [];
    const mockModel = createSimpleMockModel(names => toolNames.push(...names));

    const mockMemory = new MockMemory({
      enableWorkingMemory: true,
      workingMemoryTemplate: `# Notes\n- **Key**:\n- **Value**:\n`,
    });

    const agent = new Agent({
      id: 'no-thread-test',
      name: 'No Thread Test',
      instructions: 'You are a helpful agent.',
      model: mockModel,
      memory: mockMemory,
    });

    const stream = await agent.stream('Hello', {
      maxSteps: 1,
      // no memory option
    });

    for await (const _ of stream.fullStream) {
      // consume
    }

    expect(toolNames).not.toContain('updateWorkingMemory');
  });
});
