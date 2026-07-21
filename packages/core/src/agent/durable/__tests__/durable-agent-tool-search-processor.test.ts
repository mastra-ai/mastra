/**
 * DurableAgent + ToolSearchProcessor meta-tool resolution (issue #19571).
 *
 * `ToolSearchProcessor` injects the `search_tools` / `load_tool` meta-tools into
 * the per-step tool list via `processInputStep`. On the regular `Agent` the same
 * step that shows these tools to the model also executes them, so they resolve
 * fine. The `DurableAgent` runs tool calls in a SEPARATE workflow step that
 * resolves tools from the run registry — before the fix those processor-injected
 * tools were never written back to the registry, so the meta-tools rejected with
 * ToolNotFoundError while the regular Agent succeeded.
 *
 * These tests guard that the durable path executes both meta-tools, that a tool
 * loaded via `load_tool` becomes callable on the next turn, and that the durable
 * and regular paths produce the same tool results.
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

type ScriptedCall = { toolName: string; args: Record<string, unknown> };

/**
 * Model that emits one scripted tool call per turn, then finishes with text
 * once the script is exhausted.
 */
function createScriptedToolCallModel(script: ScriptedCall[]) {
  let turn = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const call = script[turn];
      turn++;
      if (call) {
        return {
          stream: convertArrayToReadableStream([
            { type: 'stream-start', warnings: [] },
            { type: 'response-metadata', id: `resp-${turn}`, modelId: 'mock', timestamp: new Date(0) },
            {
              type: 'tool-call',
              id: `tc-${turn}`,
              toolCallType: 'function',
              toolCallId: `tc-${turn}`,
              toolName: call.toolName,
              input: JSON.stringify(call.args),
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
          { type: 'response-metadata', id: `resp-${turn}`, modelId: 'mock', timestamp: new Date(0) },
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

function makeAgent(id: string, script: ScriptedCall[]) {
  return new Agent({
    id,
    name: id,
    instructions: 'Discover tools with search_tools, then load them with load_tool.',
    model: createScriptedToolCallModel(script) as LanguageModelV2,
    tools: {}, // no eager tools — only the processor-injected meta-tools exist
    inputProcessors: [new ToolSearchProcessor({ tools: makeSearchableTools() })],
  });
}

/** Tool-result payloads keyed by tool name, for cross-path comparison. */
function resultsByTool(chunks: any[]) {
  return chunks
    .filter((c: any) => c.type === 'tool-result')
    .map((c: any) => ({ toolName: c.payload.toolName, result: c.payload.result }));
}

function toolErrors(chunks: any[]) {
  return chunks.filter((c: any) => c.type === 'tool-error');
}

describe('DurableAgent ToolSearchProcessor meta-tool resolution (#19571)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  async function runDurable(id: string, script: ScriptedCall[]) {
    const durableAgent = createDurableAgent({ agent: makeAgent(id, script), pubsub });
    new Mastra({
      agents: { [id]: durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });
    const result = await durableAgent.stream('What is the weather in NYC?', { maxSteps: 4 });
    return drain(result.fullStream);
  }

  async function runRegular(id: string, script: ScriptedCall[]) {
    const result = await makeAgent(id, script).stream('What is the weather in NYC?', { maxSteps: 4 });
    return drain(result.fullStream);
  }

  const searchThenLoad: ScriptedCall[] = [
    { toolName: 'search_tools', args: { query: 'weather' } },
    { toolName: 'load_tool', args: { toolName: 'getWeather' } },
  ];

  it('executes the injected search_tools meta-tool instead of throwing ToolNotFoundError', async () => {
    const chunks = await runDurable('durable-search', [searchThenLoad[0]!]);

    expect(toolErrors(chunks)).toHaveLength(0);

    const search = resultsByTool(chunks).find(r => r.toolName === 'search_tools');
    expect(search).toBeDefined();
    // The BM25 search over the weather-capable tool should find a match.
    expect(search!.result?.results?.length ?? 0).toBeGreaterThan(0);
  });

  it('executes the injected load_tool meta-tool and loads the requested tool', async () => {
    const chunks = await runDurable('durable-load', searchThenLoad);

    expect(toolErrors(chunks)).toHaveLength(0);

    const load = resultsByTool(chunks).find(r => r.toolName === 'load_tool');
    expect(load).toBeDefined();
    expect(load!.result?.success).toBe(true);
    expect(load!.result?.toolName).toBe('getWeather');
  });

  it('produces the same meta-tool results on the durable and regular Agent paths', async () => {
    const durableChunks = await runDurable('parity-durable', searchThenLoad);
    const regularChunks = await runRegular('parity-regular', searchThenLoad);

    expect(toolErrors(durableChunks)).toHaveLength(0);
    expect(toolErrors(regularChunks)).toHaveLength(0);

    const durableResults = resultsByTool(durableChunks);
    const regularResults = resultsByTool(regularChunks);

    // Both paths ran both meta-tools...
    expect(durableResults.map(r => r.toolName)).toEqual(['search_tools', 'load_tool']);
    // ...and returned identical payloads.
    expect(durableResults).toEqual(regularResults);
  });
});
