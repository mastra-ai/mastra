import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod/v4';
import { Agent } from '../agent';
import { MockMemory } from '../memory/mock';
import type { ChunkType } from '../stream/types';
import { createTool } from '.';

function createToolCallingModel(toolName: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'tool-input-start', id: 'call-1', toolName },
            { type: 'tool-input-delta', id: 'call-1', delta: '{"q":"hello"}' },
            { type: 'tool-input-end', id: 'call-1' },
            { type: 'tool-call', toolCallId: 'call-1', toolName, input: '{"q":"hello"}', providerExecuted: false },
            { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
          ]),
          rawCall: { rawPrompt: null, rawSettings: {} },
          warnings: [],
        };
      }
      return {
        stream: convertArrayToReadableStream([
          { type: 'stream-start', warnings: [] },
          { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('tool title', () => {
  it('snapshots the tool title onto tool-call/tool-result chunks and persisted tool-invocation parts', async () => {
    const mockMemory = new MockMemory();
    const searchTool = createTool({
      id: 'search_web',
      title: 'Search the Web',
      description: 'Searches the web',
      inputSchema: z.object({ q: z.string() }),
      execute: async ({ q }) => ({ results: [q] }),
    });

    const agent = new Agent({
      id: 'titled-agent',
      name: 'Titled Agent',
      instructions: 'Use tools.',
      model: createToolCallingModel('search_web'),
      tools: { searchTool },
      memory: mockMemory,
    });

    const threadId = 'thread-title';
    const resourceId = 'resource-title';
    const stream = await agent.stream('search', { memory: { thread: threadId, resource: resourceId } });

    const chunks: ChunkType[] = [];
    for await (const chunk of stream.fullStream) chunks.push(chunk);

    const start = chunks.find(c => c.type === 'tool-call-input-streaming-start');
    const toolCall = chunks.find(c => c.type === 'tool-call');
    const toolResult = chunks.find(c => c.type === 'tool-result');
    expect(start?.payload).toMatchObject({ toolName: 'search_web', title: 'Search the Web' });
    expect(toolCall?.payload).toMatchObject({ toolName: 'search_web', title: 'Search the Web' });
    expect(toolResult?.payload).toMatchObject({ toolName: 'search_web', title: 'Search the Web' });

    await vi.waitFor(async () => {
      const { messages } = await mockMemory.recall({ threadId, resourceId });
      const parts = messages
        .filter(m => m.role === 'assistant')
        .flatMap(m => (typeof m.content === 'object' && 'parts' in m.content ? m.content.parts : []));
      const invocation = parts.find((p: any) => p.type === 'tool-invocation') as any;
      expect(invocation).toBeDefined();
      expect(invocation.title).toBe('Search the Web');
    });
  });

  it('falls back to mcp.annotations.title and omits title when neither is set', async () => {
    const mcpTool = createTool({
      id: 'mcp_tool',
      description: 'From MCP',
      mcp: { annotations: { title: 'MCP Display' } },
      inputSchema: z.object({ q: z.string() }),
      execute: async () => ({}),
    });
    const plainTool = createTool({
      id: 'plain_tool',
      description: 'Plain',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => ({}),
    });

    const collect = async (toolName: string, tool: any) => {
      const agent = new Agent({
        id: `agent-${toolName}`,
        name: toolName,
        instructions: 'Use tools.',
        model: createToolCallingModel(toolName),
        tools: { [toolName]: tool },
      });
      const stream = await agent.stream('go');
      const chunks: ChunkType[] = [];
      for await (const chunk of stream.fullStream) chunks.push(chunk);
      return chunks.find(c => c.type === 'tool-call')?.payload as any;
    };

    expect((await collect('mcp_tool', mcpTool)).title).toBe('MCP Display');
    expect(await collect('plain_tool', plainTool)).not.toHaveProperty('title');
  });
});
