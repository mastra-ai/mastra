import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import type { ChunkType } from '../../stream/types';
import { createTool, Tool } from '../../tools';
import { createWorkflow, createStep } from '../../workflows';
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

  it('should provide memory context when updateWorkingMemory is called inside a workflow step', async () => {
    const mockModel = createMockModelWithWorkingMemoryToolCall();
    const mockMemory = new MockMemory({
      enableWorkingMemory: true,
      workingMemoryTemplate: `# Notes\n- **Key**:\n- **Value**:\n`,
    });

    const agent = new Agent({
      id: 'wm-workflow-test-agent',
      name: 'WM Workflow Test Agent',
      instructions: 'You are a helpful agent that remembers information.',
      model: mockModel,
      memory: mockMemory,
    });

    const threadId = 'test-thread-workflow';
    const resourceId = 'test-resource-workflow';

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

    // Create a workflow step that calls the agent with memory via stream
    const agentStep = createStep({
      id: 'agent-step',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      execute: async ({ inputData }) => {
        const stream = await agent.stream(inputData.prompt, {
          memory: { thread: threadId, resource: resourceId },
          maxSteps: 3,
        });

        const chunks: ChunkType[] = [];
        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }

        const errorChunks = chunks.filter(c => c.type === 'error');
        if (errorChunks.length > 0) {
          throw new Error(`Agent stream had errors: ${JSON.stringify(errorChunks)}`);
        }

        const textChunks = chunks.filter(c => c.type === 'text-delta');
        const text = textChunks.map(c => (c.type === 'text-delta' ? c.payload.delta : '')).join('');
        return { text };
      },
    });

    const workflow = createWorkflow({
      id: 'test-workflow',
      inputSchema: z.object({ prompt: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      steps: [agentStep],
    })
      .then(agentStep)
      .commit();

    const run = await workflow.createRun();
    const result = await run.start({ inputData: { prompt: 'Remember that my favorite color is blue' } });

    // Verify the workflow completed successfully (no memory undefined error)
    expect(result.status).toBe('success');

    // Verify working memory was actually saved
    const savedWorkingMemory = await mockMemory.getWorkingMemory({ threadId, resourceId });
    expect(savedWorkingMemory).not.toBeNull();
  });

  it('should provide memory context when updateWorkingMemory is called inside a workflow foreach step', async () => {
    let agentCallCount = 0;
    const mockMemory = new MockMemory({
      enableWorkingMemory: true,
      workingMemoryTemplate: `# Notes\n- **Key**:\n- **Value**:\n`,
    });

    const threadId = 'test-thread-foreach';
    const resourceId = 'test-resource-foreach';

    // Create a workflow with foreach that calls the agent
    // foreach expects the previous step's output (or workflow input) to be an array
    const agentStep = createStep({
      id: 'foreach-agent-step',
      inputSchema: z.object({ item: z.string() }),
      outputSchema: z.object({ text: z.string() }),
      execute: async ({ inputData }) => {
        agentCallCount++;
        const foreachThreadId = `${threadId}-${inputData.item}`;
        await mockMemory.saveThread({
          thread: {
            id: foreachThreadId,
            title: `Thread for ${inputData.item}`,
            resourceId,
            metadata: {},
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Fresh mock model per iteration so callCount resets and the tool call fires each time
        const iterationModel = createMockModelWithWorkingMemoryToolCall();
        const iterationAgent = new Agent({
          id: `wm-foreach-test-agent-${inputData.item}`,
          name: 'WM Foreach Test Agent',
          instructions: 'You are a helpful agent that remembers information.',
          model: iterationModel,
          memory: mockMemory,
        });

        const stream = await iterationAgent.stream(inputData.item, {
          memory: { thread: foreachThreadId, resource: resourceId },
          maxSteps: 3,
        });

        const chunks: ChunkType[] = [];
        for await (const chunk of stream.fullStream) {
          chunks.push(chunk);
        }

        const errorChunks = chunks.filter(c => c.type === 'error');
        if (errorChunks.length > 0) {
          throw new Error(`Agent stream had errors: ${JSON.stringify(errorChunks)}`);
        }

        const textChunks = chunks.filter(c => c.type === 'text-delta');
        const text = textChunks.map(c => (c.type === 'text-delta' ? c.payload.delta : '')).join('');
        return { text };
      },
    });

    const workflow = createWorkflow({
      id: 'test-foreach-workflow',
      inputSchema: z.array(z.object({ item: z.string() })),
      outputSchema: z.any(),
      steps: [agentStep],
      options: {
        validateInputs: false,
      },
    })
      .foreach(agentStep)
      .commit();

    const run = await workflow.createRun();
    const result = await run.start({ inputData: [{ item: 'task1' }, { item: 'task2' }] });

    // Verify the workflow completed successfully (no memory undefined error)
    expect(result.status).toBe('success');

    // Verify the agent was actually called for each item
    expect(agentCallCount).toBe(2);

    // Verify working memory was saved for each foreach iteration
    const wm1 = await mockMemory.getWorkingMemory({ threadId: `${threadId}-task1`, resourceId });
    const wm2 = await mockMemory.getWorkingMemory({ threadId: `${threadId}-task2`, resourceId });
    expect(wm1).not.toBeNull();
    expect(wm2).not.toBeNull();
  });

  it('should provide memory context even when instanceof Tool check fails (simulating module duplication)', async () => {
    // This test simulates what happens in environments like Vite SSR where the Tool class
    // might be loaded from different module instances, causing instanceof to fail.
    // When instanceof fails, isVercelTool incorrectly returns true, and the tool is called
    // with AI SDK options instead of the enriched toolContext (which includes memory).
    const mockModel = createMockModelWithWorkingMemoryToolCall();
    const mockMemory = new MockMemory({
      enableWorkingMemory: true,
      workingMemoryTemplate: `# Notes\n- **Key**:\n- **Value**:\n`,
    });

    // Spy on Tool's Symbol.hasInstance to simulate instanceof failure
    // This mimics what happens when the same module is loaded twice (e.g., Vite SSR)
    const originalHasInstance = Tool[Symbol.hasInstance];
    Object.defineProperty(Tool, Symbol.hasInstance, {
      value: () => false, // Always return false, simulating module duplication
      configurable: true,
    });

    try {
      const agent = new Agent({
        id: 'wm-instanceof-test',
        name: 'WM instanceof Failure Test',
        instructions: 'You are a helpful agent that remembers information.',
        model: mockModel,
        memory: mockMemory,
      });

      const threadId = 'test-thread-instanceof';
      const resourceId = 'test-resource-instanceof';

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

      const stream = await agent.stream('Remember my name', {
        memory: { thread: threadId, resource: resourceId },
        maxSteps: 3,
      });

      const chunks: ChunkType[] = [];
      for await (const chunk of stream.fullStream) {
        chunks.push(chunk);
      }

      // Check for errors - if instanceof fails, the tool would be called without memory
      // and we'd see an error about "Memory instance is required"
      const errorChunks = chunks.filter(c => c.type === 'error');
      expect(errorChunks).toHaveLength(0);

      // Verify working memory was actually saved
      const savedWorkingMemory = await mockMemory.getWorkingMemory({ threadId, resourceId });
      expect(savedWorkingMemory).not.toBeNull();
    } finally {
      // Restore original Symbol.hasInstance
      Object.defineProperty(Tool, Symbol.hasInstance, {
        value: originalHasInstance,
        configurable: true,
      });
    }
  });
});
