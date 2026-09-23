import { convertArrayToReadableStream, MockLanguageModelV2 } from '@internal/ai-sdk-v5/test';
import { describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { MockMemory } from '../../memory/mock';
import { createTool } from '../../tools';
import { Agent } from '../agent';
import type { MastraToolInvocationPart } from '../message-list';

const THREAD = 'thread-tool-title';
const RESOURCE = 'resource-tool-title';

function createTwoStepModel() {
  let doStreamCallCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      doStreamCallCount++;
      if (doStreamCallCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
            { type: 'tool-input-start', id: 'call-search', toolName: 'search' },
            { type: 'tool-input-delta', id: 'call-search', delta: '{"query":"mastra"}' },
            { type: 'tool-input-end', id: 'call-search' },
            { type: 'tool-call', toolCallId: 'call-search', toolName: 'search', input: '{"query":"mastra"}' },
            { type: 'tool-call', toolCallId: 'call-untitled', toolName: 'untitled', input: '{}' },
            {
              type: 'finish',
              finishReason: 'tool-calls',
              usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
            },
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
          { type: 'text-delta', id: 'text-1', delta: 'Done' },
          { type: 'text-end', id: 'text-1' },
          { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 } },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

describe('tool display title', () => {
  it('streams and persists the title of a titled tool and leaves untitled tools bare', async () => {
    const model = createTwoStepModel();
    const memory = new MockMemory();
    const agent = new Agent({
      id: 'tool-title-agent',
      name: 'Tool Title Agent',
      instructions: 'Use the tools.',
      model,
      memory,
      tools: {
        search: createTool({
          id: 'search',
          title: 'Search the web',
          description: 'Searches the web',
          inputSchema: z.object({ query: z.string() }),
          execute: async () => ({ hits: 1 }),
        }),
        untitled: createTool({
          id: 'untitled',
          description: 'Has no display title',
          inputSchema: z.object({}),
          execute: async () => ({ ok: true }),
        }),
      },
    });

    const result = await agent.stream('find mastra', { memory: { thread: THREAD, resource: RESOURCE } });

    const toolChunks: Array<{ type: string; payload: { toolName: string; title?: string } }> = [];
    for await (const chunk of result.fullStream) {
      if (chunk.type === 'tool-call' || chunk.type === 'tool-call-input-streaming-start') {
        toolChunks.push(chunk);
      }
    }

    const searchChunks = toolChunks.filter(chunk => chunk.payload.toolName === 'search');
    expect(new Set(searchChunks.map(chunk => chunk.type))).toEqual(
      new Set(['tool-call-input-streaming-start', 'tool-call']),
    );
    for (const chunk of searchChunks) {
      expect(chunk.payload.title).toBe('Search the web');
    }

    const untitledChunks = toolChunks.filter(chunk => chunk.payload.toolName === 'untitled');
    expect(untitledChunks.length).toBeGreaterThan(0);
    for (const chunk of untitledChunks) {
      expect(chunk.payload).not.toHaveProperty('title');
    }

    const recalled = await memory.recall({ threadId: THREAD, resourceId: RESOURCE });
    const toolParts = recalled.messages
      .filter(message => message.role === 'assistant')
      .flatMap(message => message.content.parts)
      .filter((part): part is MastraToolInvocationPart => part.type === 'tool-invocation');

    expect(toolParts.find(part => part.toolInvocation.toolName === 'search')).toMatchObject({
      title: 'Search the web',
      toolInvocation: { state: 'result' },
    });
    const untitledPart = toolParts.find(part => part.toolInvocation.toolName === 'untitled');
    expect(untitledPart).toBeDefined();
    expect(untitledPart?.title).toBeUndefined();

    const providerTools = model.doStreamCalls[0]?.tools ?? [];
    expect(providerTools).toHaveLength(2);
    for (const providerTool of providerTools) {
      expect(providerTool).not.toHaveProperty('title');
    }
  });
});
