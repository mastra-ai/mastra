import { convertArrayToReadableStream, MockLanguageModelV2 } from 'ai-v5/test';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { MockMemory } from '../../memory/mock';
import type { AIV5FullStreamPart } from '../../stream/aisdk/v5/output';
import type { ChunkType } from '../../stream/types';
import { createTool } from '../../tools';
import { delay } from '../../utils';
import { Agent } from '../agent';

describe('Writable Stream from Tool', () => {
  let mockElectionModel: MockLanguageModelV2;

  beforeEach(() => {
    mockElectionModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-election-1',
            toolName: 'election-tool',
            input: '{"year": 2016}',
            providerExecuted: false,
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'According to the election-tool, ' },
          { type: 'text-delta', id: 'text-1', delta: 'Donald Trump won the 2016 election.' },
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

  it('should get a text response from the agent', async () => {
    const tool = createTool({
      description: 'A tool that returns the winner of the 2016 US presidential election',
      id: 'election-tool',
      inputSchema: z.object({
        year: z.number(),
      }),
      execute: async (inputData, context) => {
        context?.writer?.write({
          type: 'election-data',
          args: {
            year: inputData.year,
          },
          status: 'pending',
        });

        await delay(1000);

        context?.writer?.write({
          type: 'election-data',
          args: {
            year: inputData.year,
          },
          result: {
            winner: 'Donald Trump',
          },
          status: 'success',
        });

        return { winner: 'Donald Trump' };
      },
    });

    const electionAgent = new Agent({
      id: 'us-election-agent',
      name: 'US Election agent',
      instructions: 'You know about the past US elections',
      model: mockElectionModel,
      tools: {
        electionTool: tool,
      },
    });

    const mastraStream = await electionAgent.stream('Call the election-tool and tell me what it says.');

    const chunks: ChunkType[] = [];
    for await (const chunk of mastraStream.fullStream) {
      chunks.push(chunk);
    }

    expect(chunks.find(chunk => chunk.type === 'tool-output')).toBeDefined();

    const aiSdkParts: AIV5FullStreamPart[] = [];

    const aiSdkStream = await electionAgent.stream('Call the election-tool and tell me what it says.', {
      format: 'aisdk',
    });

    for await (const chunk of aiSdkStream.fullStream) {
      aiSdkParts.push(chunk);
    }

    // our types are broken, we do output these tool-output types when a tool writes
    // but adding this to the ai sdk output stream part types breaks 100 other types
    // so cast as any
    const toolOutputChunk = aiSdkParts.find((chunk: any) => chunk.type === 'tool-output');

    expect(toolOutputChunk).toBeDefined();
  });

  it('should not create duplicate assistant messages when data-* parts are emitted with memory', async () => {
    const memory = new MockMemory();

    const threadId = 'test-thread-data-parts';
    const resourceId = 'test-resource';

    // Create thread first
    await memory.createThread({ threadId, resourceId, title: 'Data Parts Test' });

    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          {
            type: 'tool-call',
            toolCallId: 'call-progress-1',
            toolName: 'progress-tool',
            input: '{"taskName": "test"}',
            providerExecuted: false,
          },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Task completed successfully.' },
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

    const progressTool = createTool({
      id: 'progress-tool',
      description: 'A tool that emits progress data-* parts',
      inputSchema: z.object({
        taskName: z.string(),
      }),
      execute: async (input, context) => {
        // Emit multiple data-* parts
        for (let i = 1; i <= 3; i++) {
          await context?.writer?.custom({
            type: 'data-progress',
            data: {
              taskName: input.taskName,
              step: i,
              progress: i * 33,
            },
          });
        }
        return { success: true };
      },
    });

    const agent = new Agent({
      id: 'progress-test-agent',
      name: 'Progress Test Agent',
      instructions: 'You run tasks with progress updates.',
      model: mockModel,
      memory,
      tools: {
        'progress-tool': progressTool,
      },
    });

    // Stream with memory enabled
    const stream = await agent.stream('Run a task called test', { threadId, resourceId });
    for await (const _ of stream.fullStream) {
      // consume stream
    }

    // Recall messages and check for duplicates
    const recallResult = await memory.recall({ threadId, resourceId });

    // Should have exactly 2 messages: 1 user + 1 assistant (with merged data-* parts)
    // If data-* parts don't have threadId/resourceId, they won't merge and we'd see more messages
    const assistantMessages = recallResult.messages.filter(m => m.role === 'assistant');

    expect(recallResult.messages.length).toBe(2); // 1 user + 1 assistant
    expect(assistantMessages.length).toBe(1); // Only 1 assistant message, not multiple

    // The single assistant message should contain the data-progress parts
    const allParts = assistantMessages[0]?.content?.parts || [];
    const dataProgressParts = allParts.filter((p: any) => p.type === 'data-progress');

    // Should have all 3 data-progress parts merged into the single assistant message
    expect(dataProgressParts.length).toBe(3);
  });

  it('should preserve data-* parts when messages with tool parts are sent back as input', async () => {
    const memory = new MockMemory();

    const threadId = 'test-thread-roundtrip';
    const resourceId = 'test-resource';

    await memory.createThread({ threadId, resourceId, title: 'Roundtrip Test' });

    const mockModel = new MockLanguageModelV2({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Got it, continuing from where we left off.' },
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
      id: 'roundtrip-test-agent',
      name: 'Roundtrip Test Agent',
      instructions: 'You help with tasks.',
      model: mockModel,
      memory,
    });

    const messagesFromUseChat = [
      {
        id: 'user-msg-1',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Run a task' }],
      },
      {
        id: 'assistant-msg-1',
        role: 'assistant' as const,
        parts: [
          {
            type: 'tool-progress-tool', // V5 tool part format - triggers V5 detection
            toolCallId: 'call-1',
            state: 'output-available',
            input: { taskName: 'first-task' },
            output: { success: true },
          },
          { type: 'text', text: 'Task running...' },
          {
            type: 'data-progress',
            data: { taskName: 'first-task', step: 1, progress: 33, status: 'in-progress' },
          },
          {
            type: 'data-progress',
            data: { taskName: 'first-task', step: 2, progress: 66, status: 'in-progress' },
          },
          {
            type: 'data-progress',
            data: { taskName: 'first-task', step: 3, progress: 100, status: 'complete' },
          },
          { type: 'text', text: 'Task completed!' },
        ],
      },
      {
        id: 'user-msg-2',
        role: 'user' as const,
        parts: [{ type: 'text' as const, text: 'Thanks! Now do another task.' }],
      },
    ];

    const stream = await agent.stream(messagesFromUseChat as any, { threadId, resourceId });
    for await (const _ of stream.fullStream) {
      // consume stream
    }

    // Recall all messages from memory
    const recallResult = await memory.recall({ threadId, resourceId });

    // Find the first assistant message (from "turn 1")
    const firstAssistantMsg = recallResult.messages.find(m => m.role === 'assistant' && m.id === 'assistant-msg-1');

    expect(firstAssistantMsg).toBeDefined();

    // Check that data-* parts were preserved
    const dataProgressParts = firstAssistantMsg?.content?.parts?.filter((p: any) => p.type?.startsWith('data-')) || [];

    expect(dataProgressParts.length).toBe(3);
    expect(dataProgressParts[0]).toMatchObject({
      type: 'data-progress',
      data: { taskName: 'first-task', step: 1, progress: 33, status: 'in-progress' },
    });
  });
});
