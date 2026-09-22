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
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

  it('rejects a remembered global tool, exposes the error to the model, then permits discovery and use', async () => {
    const execute = vi.fn(async ({ size }: { size: string }) => ({ size }));
    const portrait = createTool({
      id: 'portrait',
      description: 'Generate a portrait image',
      inputSchema: z.object({ size: z.enum(['1:1', '2:3']).default('1:1') }),
      execute,
    });
    const model = createScriptedToolCallModel([
      { toolName: 'portrait', args: {} },
      { toolName: 'search_tools', args: { query: 'portrait' } },
      { toolName: 'portrait', args: { size: '2:3' } },
    ]);
    const durable = createDurableAgent({
      agent: new Agent({
        id: 'current-schema',
        name: 'Current schema',
        instructions: 'Use current tools.',
        model: model as LanguageModelV2,
        inputProcessors: [new ToolSearchProcessor({ tools: { portrait }, search: { autoLoad: true } })],
      }),
      pubsub,
    });
    new Mastra({
      agents: { durable: durable as any },
      tools: { portrait },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });
    const result = await durable.stream('Create one 2:3 portrait.', { maxSteps: 5 });
    const chunks = await drain(result.fullStream);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute.mock.calls[0]![0]).toEqual({ size: '2:3' });
    expect(toolErrors(chunks)).toHaveLength(1);
    expect(JSON.stringify(model.doStreamCalls[1]!.prompt)).toContain('Available tools: search_tools');
    expect(JSON.stringify(model.doStreamCalls[1]!.prompt)).toContain('error-text');
    expect(model.doStreamCalls[0]!.tools?.map(t => t.name)).not.toContain('portrait');
    expect(model.doStreamCalls[2]!.tools?.map(t => t.name)).toContain('portrait');
    expect(resultsByTool(chunks).find(r => r.toolName === 'portrait')?.result).toEqual({ size: '2:3' });
  });

  it('does not require discovery for a schema already shown to the model', async () => {
    const execute = vi.fn(async () => ({ ok: true }));
    const direct = createTool({ id: 'direct', description: 'Direct tool', inputSchema: z.object({}), execute });
    const model = createScriptedToolCallModel([{ toolName: 'direct', args: {} }]);
    const durable = createDurableAgent({
      agent: new Agent({
        id: 'direct-schema',
        name: 'Direct',
        instructions: 'Use tools.',
        model: model as LanguageModelV2,
        tools: { direct },
      }),
      pubsub,
    });
    new Mastra({
      agents: { durable: durable as any },
      tools: { direct },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });
    const result = await durable.stream('Use direct.', { maxSteps: 3 });
    const chunks = await drain(result.fullStream);
    expect(execute).toHaveBeenCalledTimes(1);
    expect(toolErrors(chunks)).toHaveLength(0);
    expect(model.doStreamCalls[0]!.tools?.map(t => t.name)).toContain('direct');
  });

  it.each([false, true])('rejects a global tool with no current schema (removed by processor: %s)', async removed => {
    const execute = vi.fn(async () => ({ ok: true }));
    const hidden = createTool({ id: 'hidden', description: 'Hidden tool', inputSchema: z.object({}), execute });
    const model = createScriptedToolCallModel([{ toolName: 'hidden', args: {} }]);
    const durable = createDurableAgent({
      agent: new Agent({
        id: 'empty-schema',
        name: 'Empty',
        instructions: 'Answer.',
        model: model as LanguageModelV2,
        tools: removed ? { hidden } : {},
        inputProcessors: removed ? [{ id: 'remove-tools', processInputStep: async () => ({ tools: {} }) }] : [],
      }),
      pubsub,
    });
    new Mastra({
      agents: { durable: durable as any },
      tools: { hidden },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });
    const result = await durable.stream('Answer.', { maxSteps: 3 });
    const chunks = await drain(result.fullStream);
    expect(execute).not.toHaveBeenCalled();
    expect(toolErrors(chunks)).toHaveLength(1);
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

/**
 * Issue #22933: with `includeResolvedTools: true` the searchable catalog is built
 * from the per-step tool map. The durable LLM step writes the *narrowed* per-step
 * snapshot (e.g. only `search_tools`) back to `registryEntry.tools`, and the next
 * step seeds its tools from that same registry slot. The resolved catalog is
 * therefore gone on step 2, so a tool that `search_tools` auto-loaded never
 * becomes visible and a real model loops on `search_tools` forever.
 */
describe('DurableAgent ToolSearchProcessor keeps resolved catalog across steps (#22933)', () => {
  let pubsub: EventEmitterPubSub;

  beforeEach(() => {
    pubsub = new EventEmitterPubSub();
  });

  afterEach(async () => {
    await pubsub.close();
  });

  /**
   * Model that records the tool names it is shown on each step. Step 1 calls
   * `search_tools`; step 2 calls `echo` if visible, otherwise reports it missing.
   */
  function createCatalogRecordingModel(visibleToolsByStep: string[][]) {
    let step = 0;
    const finishWithText = (text: string) => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `resp-${step}`, modelId: 'mock', timestamp: new Date(0) },
        { type: 'text-start', id: `text-${step}` },
        { type: 'text-delta', id: `text-${step}`, delta: text },
        { type: 'text-end', id: `text-${step}` },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    });
    const callTool = (toolName: string, args: Record<string, unknown>) => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: `resp-${step}`, modelId: 'mock', timestamp: new Date(0) },
        {
          type: 'tool-call',
          id: `tc-${step}`,
          toolCallType: 'function',
          toolCallId: `tc-${step}`,
          toolName,
          input: JSON.stringify(args),
        },
        { type: 'finish', finishReason: 'tool-calls', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    });

    return new MockLanguageModelV2({
      doStream: async options => {
        const visible = (options.tools ?? []).map((t: any) => t.name);
        visibleToolsByStep.push(visible);
        step++;
        if (step === 1) return callTool('search_tools', { query: 'echo a message' });
        if (step === 2 && visible.includes('echo')) return callTool('echo', { message: 'hello' });
        if (step === 2) return finishWithText('echo was unavailable');
        return finishWithText('done');
      },
    });
  }

  function makeResolvedCatalogAgent(id: string, visibleToolsByStep: string[][], onEcho: () => void) {
    const echo = createTool({
      id: 'echo',
      description: 'Echo a message back to the user.',
      inputSchema: z.object({ message: z.string() }),
      execute: async ({ message }) => {
        onEcho();
        return { echoed: message };
      },
    });
    return new Agent({
      id,
      name: id,
      instructions: 'Search for the echo tool, call it, then answer.',
      model: createCatalogRecordingModel(visibleToolsByStep) as LanguageModelV2,
      // `echo` is a regular agent tool; the processor discovers it via
      // includeResolvedTools and withholds it until search auto-loads it.
      tools: { echo },
      inputProcessors: [
        new ToolSearchProcessor({
          tools: {},
          includeResolvedTools: true,
          storage: 'context',
          search: { autoLoad: true, topK: 1, minScore: 0 },
        }),
      ],
    });
  }

  it('makes a search-auto-loaded resolved tool visible on the next durable step', async () => {
    const visibleToolsByStep: string[][] = [];
    let echoCalls = 0;
    const id = 'durable-resolved-catalog';
    const durableAgent = createDurableAgent({
      agent: makeResolvedCatalogAgent(id, visibleToolsByStep, () => echoCalls++),
      pubsub,
    });
    new Mastra({
      agents: { [id]: durableAgent as any },
      logger: false,
      storage: new InMemoryStore(),
      pubsub,
    });

    const result = await durableAgent.generate('Use the echo tool to say hello.', { maxSteps: 3 });

    // Step 1: only the meta-tool is exposed; `echo` is withheld until searched.
    expect(visibleToolsByStep[0]).toEqual(['search_tools']);
    // Step 2: search auto-loaded `echo`, so the model must now be able to call it.
    expect(visibleToolsByStep[1]).toContain('echo');
    expect(echoCalls).toBe(1);
    expect(result.text).toBe('done');
  });

  it('regular Agent parity: the auto-loaded resolved tool is visible on the next step', async () => {
    const visibleToolsByStep: string[][] = [];
    let echoCalls = 0;
    const agent = makeResolvedCatalogAgent('regular-resolved-catalog', visibleToolsByStep, () => echoCalls++);

    // The regular Agent's generate() calls doGenerate, which the mock does not
    // implement; stream() exercises the same agentic loop via doStream.
    const result = await agent.stream('Use the echo tool to say hello.', { maxSteps: 3 });
    const text = await result.text;

    expect(visibleToolsByStep[0]).toEqual(['search_tools']);
    expect(visibleToolsByStep[1]).toContain('echo');
    expect(echoCalls).toBe(1);
    expect(text).toBe('done');
  });
});
