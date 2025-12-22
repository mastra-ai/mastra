import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { Agent } from '../agent';
import { Mastra } from '../mastra';
import { MockMemory } from '../memory/mock';
import type { ChunkType } from '../stream/types';
import { delay } from '../utils';
import { createStep, createWorkflow } from '../workflows/workflow';
import { createTool } from '.';

describe('ToolStream', () => {
  // A workflow step that gets an agent, streams with structured output, and pipes the objectStream to the step's writer.
  it('should allow piping agent.stream().fullStream to writer in workflow step', async () => {
    const structuredOutputResponse = JSON.stringify({
      storyTitle: 'The Hero Journey',
      chapters: [
        { chapterNumber: 1, title: 'The Call', premise: 'Hero receives the call to adventure' },
        { chapterNumber: 2, title: 'The Journey', premise: 'Hero embarks on the journey' },
        { chapterNumber: 3, title: 'The Return', premise: 'Hero returns transformed' },
      ],
    });

    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: structuredOutputResponse },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const chapterGeneratorAgent = new Agent({
      id: 'chapterGeneratorAgent',
      name: 'Chapter Generator',
      instructions: 'You generate story chapters.',
      model: mockModel,
    });

    const mastra = new Mastra({
      agents: { chapterGeneratorAgent },
    });

    const workflowInputSchema = z.object({
      storyIdea: z.string(),
      numberOfChapters: z.number(),
    });

    const _storyPlanSchema = z.object({
      storyTitle: z.string(),
      chapters: z.array(
        z.object({
          chapterNumber: z.number(),
          title: z.string(),
          premise: z.string(),
        }),
      ),
    });

    const generateChaptersStep = createStep({
      id: 'generate-chapters',
      description: 'Generates a story plan with title and chapter details',
      inputSchema: workflowInputSchema,
      outputSchema: z.object({ text: z.string() }),
      execute: async ({ inputData, mastra: stepMastra, writer }) => {
        const { storyIdea, numberOfChapters } = inputData;

        const chapterAgent = stepMastra.getAgent('chapterGeneratorAgent');

        const response = await chapterAgent.stream(
          `Create a ${numberOfChapters}-chapter story plan for: ${storyIdea}`,
          {
            structuredOutput: {
              schema: _storyPlanSchema,
            },
          },
        );

        await response.objectStream.pipeTo(writer);

        return { text: await response.text };
      },
    });

    const workflow = createWorkflow({
      id: 'story-generator-workflow',
      inputSchema: workflowInputSchema,
      outputSchema: z.object({ text: z.string() }),
      steps: [generateChaptersStep],
    });

    workflow.then(generateChaptersStep).commit();

    mastra.addWorkflow(workflow, 'story-generator-workflow');

    const run = await workflow.createRun({ runId: 'test-run' });
    const result = run.stream({
      inputData: {
        storyIdea: 'A hero journey',
        numberOfChapters: 3,
      },
    });

    const chunks: ChunkType[] = [];
    for await (const chunk of result.fullStream) {
      chunks.push(chunk);
    }

    expect(chunks.length).toBeGreaterThan(0);

    const finalResult = await result.result;
    expect(finalResult.status).toBe('success');
  });
});

describe('ToolStream - writer.custom', () => {
  let mockModel: MockLanguageModelV2;

  beforeEach(() => {
    mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-custom-1',
            toolName: 'customTool',
            input: '{"message": "test"}',
            providerExecuted: false,
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Tool executed successfully.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });
  });

  it('should allow tools to write custom data chunks using writer.custom', async () => {
    const customTool = createTool({
      id: 'custom-tool',
      description: 'A tool that uses writer.custom to send custom data chunks',
      inputSchema: z.object({
        message: z.string(),
      }),
      execute: async (inputData, context) => {
        // Use writer.custom to send a custom data chunk
        await context?.writer?.custom({
          type: 'data-custom-progress',
          data: {
            status: 'processing',
            message: inputData.message,
            progress: 50,
          },
        });

        // Send another custom chunk
        await context?.writer?.custom({
          type: 'data-custom-result',
          data: {
            status: 'complete',
            result: `Processed: ${inputData.message}`,
          },
        });

        return { success: true, message: inputData.message };
      },
    });

    const agent = new Agent({
      id: 'test-agent',
      name: 'Test Agent',
      instructions: 'You are a test agent that uses custom tools.',
      model: mockModel,
      tools: {
        customTool,
      },
    });

    const stream = await agent.stream('Call the custom-tool with message "test"');

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    // Find the custom data chunks - they should bubble up directly as data-* chunks
    const customProgressChunk = chunks.find(chunk => chunk.type === 'data-custom-progress');
    const customResultChunk = chunks.find(chunk => chunk.type === 'data-custom-result');

    expect(customProgressChunk).toBeDefined();
    expect(customResultChunk).toBeDefined();

    // Verify the data payload
    if (customProgressChunk && 'data' in customProgressChunk) {
      const data = (customProgressChunk as any).data;
      expect(data.status).toBe('processing');
      expect(data.progress).toBe(50);
      expect(data.message).toBe('test');
    }
  });

  it('should allow sub-agent tools to use writer.custom', async () => {
    // Create a sub-agent with a tool that uses writer.custom
    const subAgentTool = createTool({
      id: 'sub-agent-tool',
      description: 'A tool on a sub-agent that uses writer.custom',
      inputSchema: z.object({
        task: z.string(),
      }),
      execute: async (inputData, context) => {
        // Send custom progress updates
        await context?.writer?.custom({
          type: 'data-sub-agent-progress',
          data: {
            step: 'initializing',
            task: inputData.task,
          },
        });

        await context?.writer?.custom({
          type: 'data-sub-agent-progress',
          data: {
            step: 'processing',
            task: inputData.task,
            progress: 75,
          },
        });

        return { completed: true, task: inputData.task };
      },
    });

    const subAgentModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-sub-1',
            toolName: 'sub-agent-tool',
            input: '{"task": "analyze data"}',
            providerExecuted: false,
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Task completed.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const subAgent = new Agent({
      id: 'sub-agent',
      name: 'Sub Agent',
      instructions: 'You are a sub-agent that can execute tasks.',
      model: subAgentModel,
      tools: {
        subAgentTool,
      },
    });

    // Create parent agent that has the sub-agent registered
    const parentAgentModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-2', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-agent-1',
            toolName: 'agent-subAgent',
            input: '{"prompt": "Use the sub-agent-tool to analyze data"}',
            providerExecuted: false,
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Sub-agent executed successfully.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const parentAgent = new Agent({
      id: 'parent-agent',
      name: 'Parent Agent',
      instructions: 'You are a parent agent that can delegate to sub-agents.',
      model: parentAgentModel,
      agents: {
        subAgent,
      },
    });

    const stream = await parentAgent.stream('Use the sub-agent to analyze data');

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    // Find custom chunks from the sub-agent's tool
    // Data chunks should bubble up directly as data-* chunks (not wrapped)
    const customChunks = chunks.filter(chunk => chunk.type === 'data-sub-agent-progress');
    // We should have custom chunks from the sub-agent's tool execution
    expect(customChunks.length).toBeGreaterThan(0);
  });

  it('should handle writer.custom with regular tool-output chunks', async () => {
    const mixedTool = createTool({
      id: 'mixed-tool',
      description: 'A tool that uses both writer.write and writer.custom',
      inputSchema: z.object({
        value: z.string(),
      }),
      execute: async (inputData, context) => {
        // Use regular write
        await context?.writer?.write({
          type: 'status-update',
          message: 'Starting processing',
        });

        // Use custom for data chunks
        await context?.writer?.custom({
          type: 'data-processing-metrics',
          data: {
            value: inputData.value,
            timestamp: Date.now(),
          },
        });

        // Another regular write
        await context?.writer?.write({
          type: 'status-update',
          message: 'Processing complete',
        });

        return { processed: inputData.value };
      },
    });

    const mixedToolModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-mixed-1',
            toolName: 'mixedTool',
            input: '{"value": "test"}',
            providerExecuted: false,
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Tool executed successfully.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    const agent = new Agent({
      id: 'mixed-agent',
      name: 'Mixed Agent',
      instructions: 'You are an agent that uses mixed streaming tools.',
      model: mixedToolModel,
      tools: {
        mixedTool,
      },
    });

    const stream = await agent.stream('Call the mixed-tool with value "test"');

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    // Find tool-output chunks (from writer.write) and direct custom chunks (from writer.custom)
    const toolOutputChunks = chunks.filter(chunk => chunk.type === 'tool-output');
    const customDataChunks = chunks.filter(chunk => chunk.type === 'data-processing-metrics');

    expect(toolOutputChunks.length).toBeGreaterThan(0);

    // Verify we have regular writes (wrapped in tool-output)
    const hasRegularWrite = toolOutputChunks.some(chunk => {
      if ('payload' in chunk) {
        const payload = chunk.payload as any;
        return payload?.output?.type === 'status-update';
      }
      return false;
    });

    // Verify we have custom data chunks (bubbled up directly, not wrapped)
    expect(customDataChunks.length).toBeGreaterThan(0);
    expect(hasRegularWrite).toBe(true);

    // Verify the custom data chunk has the correct structure
    if (customDataChunks.length > 0 && 'data' in customDataChunks[0]) {
      const data = (customDataChunks[0] as any).data;
      expect(data.value).toBe('test');
      expect(data.timestamp).toBeDefined();
    }
  });

  it('should persist data-* chunks to memory storage', async () => {
    // Create a mock memory instance
    const mockMemory = new MockMemory();

    // Create a tool that emits data-* chunks
    const progressTool = createTool({
      id: 'progress-tool',
      description: 'A tool that emits progress data chunks',
      inputSchema: z.object({
        taskName: z.string(),
      }),
      execute: async (inputData, context) => {
        // Emit a data-* chunk for progress tracking
        await context?.writer?.custom({
          type: 'data-progress',
          data: {
            taskName: inputData.taskName,
            progress: 50,
            status: 'in-progress',
          },
        });

        // Emit another data-* chunk for completion
        await context?.writer?.custom({
          type: 'data-progress',
          data: {
            taskName: inputData.taskName,
            progress: 100,
            status: 'complete',
          },
        });

        return { success: true, taskName: inputData.taskName };
      },
    });

    // Create a mock model that will call the tool
    const mockModelWithTool = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-progress-1',
            toolName: 'progressTool',
            input: '{"taskName": "test-task"}',
            providerExecuted: false,
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Task completed.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      }),
    });

    // Create agent with memory
    const agent = new Agent({
      id: 'test-agent-with-memory',
      name: 'Test Agent with Memory',
      instructions: 'You are a test agent.',
      model: mockModelWithTool,
      tools: {
        progressTool,
      },
      memory: mockMemory,
    });

    const threadId = 'test-thread-data-chunks';
    const resourceId = 'user-test-data-chunks';

    // Stream with memory enabled
    const stream = await agent.stream('Run the progress tool for test-task', {
      memory: {
        thread: threadId,
        resource: resourceId,
      },
    });

    // Collect chunks and verify data-* chunks appear in stream
    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) {
      chunks.push(chunk);
    }

    // Verify data-* chunks appeared in the stream
    const dataChunks = chunks.filter(chunk => chunk.type === 'data-progress');
    expect(dataChunks.length).toBe(2);

    // Wait for debounced save to complete
    await delay(200);

    // Retrieve messages from storage
    const recalledMessages = await mockMemory.recall({
      threadId,
      resourceId,
    });

    // Find assistant messages
    const assistantMessages = recalledMessages.messages.filter(m => m.role === 'assistant');
    expect(assistantMessages.length).toBeGreaterThan(0);

    // Check if any assistant message contains data parts (stored as { type: 'data-progress', data: ... })
    const hasDataParts = assistantMessages.some(m => {
      const content = m.content;
      if (typeof content === 'object' && 'parts' in content) {
        return content.parts.some((p: any) => p.type === 'data-progress');
      }
      return false;
    });

    // data-* chunks should now be persisted to storage
    expect(hasDataParts).toBe(true);
  });
});
