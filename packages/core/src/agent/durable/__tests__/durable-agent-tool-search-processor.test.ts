/**
 * DurableAgent + ToolSearchProcessor meta-tool resolution (issue #19571).
 *
 * `ToolSearchProcessor` injects the `search_tools` / `load_tool` meta-tools into
 * the per-step tool list via `processInputStep`. On the regular `Agent` the same
 * step that shows these tools to the model also executes them, so they resolve
 * fine. The `DurableAgent` runs tool calls in a SEPARATE workflow step that
 * resolves tools from the run registry — before the fix those processor-injected
 * tools were never written back to the registry, so `search_tools` rejected with
 * ToolNotFoundError while the regular Agent succeeded.
 *
 * These tests guard that the durable path now executes `search_tools` and that
 * the meta-tools are persisted onto the run registry for the tool-call step.
 */

import type { LanguageModelV2 } from '@ai-sdk/provider-v5';
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { z } from 'zod';
import { EventEmitterPubSub } from '../../../events/event-emitter';
import { Mastra } from '../../../mastra';
import { ToolSearchProcessor } from '../../../processors';
import { InMemoryStore } from '../../../storage';
import { createTool } from '../../../tools';
import { Agent } from '../../agent';
import { createDurableAgent } from '../create-durable-agent';

/**
 * Model that emits a `search_tools` call on the first turn, then plain text.
 */
function createSearchToolsModel(query: string) {
  let callCount = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      callCount++;
      if (callCount === 1) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: 'resp-1', modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              id: 'tc-1',
              toolCallType: 'function',
              toolCallId: 'tc-1',
              toolName: 'search_tools',
              input: JSON.stringify({ query }),
            },
            {
              type: 'finish',
              finishReason: 'tool-calls',
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
          { type: 'response-metadata', id: 'resp-2', modelId: 'mock', timestamp: new Date(0) },
          { type: 'text-start', id: 'text-1' },
          { type: 'text-delta', id: 'text-1', delta: 'Done.' },
          { type: 'text-end', id: 'text-1' },
          {
            type: 'finish',
            finishReason: 'stop',
            usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          },
        ]),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

async function drain(stream: ReadableStream<any>) {
  const out: any[] = [];
  for await (const c of stream) out.push(c);
  return out;
}

function makeSearchableTools() {
  return {
    getWeather: createTool({
      id: 'getWeather',
      description: 'Get the current weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async () => ({ temp: 72 }),
    }),
    sendEmail: createTool({
      id: 'sendEmail',
      description: 'Send an email to a recipient',
      inputSchema: z.object({ to: z.string() }),
      execute: async () => ({ sent: true }),
    }),
  };
}

describe('DurableAgent ToolSearchProcessor meta-tool resolution (#19571)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  it('executes the injected search_tools meta-tool instead of throwing ToolNotFoundError', async () => {
    const toolSearch = new ToolSearchProcessor({ tools: makeSearchableTools() });

    const baseAgent = new Agent({
      id: 'tool-search-agent',
      name: 'Tool Search Agent',
      instructions: 'Discover tools with search_tools before answering.',
      model: createSearchToolsModel('weather') as LanguageModelV2,
      tools: {}, // no eager tools — only the processor-injected meta-tools exist
      inputProcessors: [toolSearch],
    });

    const durableAgent = createDurableAgent({ agent: baseAgent, pubsub });
    new Mastra({
      agents: { 'tool-search-agent': durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.stream('What is the weather in NYC?', { maxSteps: 3 });
    const chunks = await drain(result.fullStream);

    // No ToolNotFoundError should surface for the meta-tool.
    const toolErrors = chunks.filter((c: any) => c.type === 'tool-error' && c.payload?.toolName === 'search_tools');
    expect(toolErrors).toHaveLength(0);

    // search_tools should have executed and produced a result chunk.
    const searchResults = chunks.filter((c: any) => c.type === 'tool-result' && c.payload?.toolName === 'search_tools');
    expect(searchResults.length).toBeGreaterThan(0);
    // The BM25 search over the weather-capable tool should find a match.
    expect(searchResults[0].payload.result?.results?.length ?? 0).toBeGreaterThan(0);
  });

  it('matches the regular Agent, which also executes search_tools successfully', async () => {
    const toolSearch = new ToolSearchProcessor({ tools: makeSearchableTools() });

    const agent = new Agent({
      id: 'tool-search-agent-regular',
      name: 'Tool Search Agent Regular',
      instructions: 'Discover tools with search_tools before answering.',
      model: createSearchToolsModel('weather') as LanguageModelV2,
      tools: {},
      inputProcessors: [toolSearch],
    });

    const result = await agent.stream('What is the weather in NYC?', { maxSteps: 3 });
    const chunks = await drain(result.fullStream);

    const toolErrors = chunks.filter((c: any) => c.type === 'tool-error' && c.payload?.toolName === 'search_tools');
    expect(toolErrors).toHaveLength(0);

    const searchResults = chunks.filter((c: any) => c.type === 'tool-result' && c.payload?.toolName === 'search_tools');
    expect(searchResults.length).toBeGreaterThan(0);
  });
});
