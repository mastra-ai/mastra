/**
 * MODEL_INFERENCE `tools` / `availableTools` integration tests.
 *
 * Drives a real Observability instance through a TestExporter and compares
 * each MODEL_INFERENCE span against the tools the provider received on that
 * call, after per-step changes from input processors and `toolChoice`.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import type { Processor } from '@mastra/core/processors';
import { MockStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Observability } from './default';
import { TestExporter } from './exporters';

const usage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

/** Calls tool `a` on every call except the last, which answers with text. Records the tool names the provider received per call. */
function createModel(providerTools: string[][], calls: number) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async options => {
      call++;
      providerTools.push((options.tools ?? []).map(t => t.name));
      return {
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
        stream: convertArrayToReadableStream(
          call < calls
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'tool-call', toolCallId: `call-${call}`, toolName: 'a', input: '{}' },
                { type: 'finish', finishReason: 'tool-calls', usage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: `id-${call}`, modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'done' },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage },
              ],
        ),
      };
    },
  });
}

const tool = (id: string) =>
  createTool({
    id,
    description: `tool ${id}`,
    inputSchema: z.object({ value: z.string().optional() }),
    execute: async () => id,
  });

async function run(agent: Agent) {
  const result = await agent.stream('go');
  await result.consumeStream();
}

const names = (definitions: { name: string }[] | undefined) => definitions?.map(definition => definition.name);

describe('MODEL_INFERENCE tools', () => {
  let testExporter: TestExporter;
  let providerTools: string[][];

  beforeEach(() => {
    testExporter = new TestExporter();
    providerTools = [];
  });

  function createAgent(calls: number, inputProcessors: Processor[] = []) {
    const agent = new Agent({
      id: 'tools-agent',
      name: 'Tools Agent',
      instructions: 'test',
      model: createModel(providerTools, calls),
      tools: { a: tool('a'), b: tool('b'), hidden: tool('hidden') },
      inputProcessors,
    });
    new Mastra({
      agents: { agent },
      storage: new MockStore(),
      observability: new Observability({
        configs: { test: { serviceName: 'model-inference-tools', exporters: [testExporter] } },
      }),
    });
    return agent;
  }

  function inferenceSpans() {
    return testExporter
      .getSpansByType(SpanType.MODEL_INFERENCE)
      .sort((x, y) => (x.attributes?.stepIndex ?? 0) - (y.attributes?.stepIndex ?? 0));
  }

  it('records the definitions a processor narrowed with activeTools', async () => {
    const agent = createAgent(2, [{ id: 'narrow', processInputStep: async () => ({ activeTools: ['a', 'b'] }) }]);

    await run(agent);

    expect(providerTools).toEqual([
      ['a', 'b'],
      ['a', 'b'],
    ]);
    const spans = inferenceSpans();
    expect(spans.map(span => names(span.attributes?.tools))).toEqual(providerTools);
    expect(spans.map(span => span.attributes?.availableTools)).toEqual(providerTools);
    expect(spans[0]!.attributes?.tools?.[0]).toMatchObject({
      type: 'function',
      name: 'a',
      description: 'tool a',
      parameters: expect.objectContaining({ type: 'object' }),
    });
  });

  it('keeps the run-level definitions on MODEL_GENERATION', async () => {
    const agent = createAgent(2, [{ id: 'narrow', processInputStep: async () => ({ activeTools: ['a', 'b'] }) }]);

    await run(agent);

    const [generation] = testExporter.getSpansByType(SpanType.MODEL_GENERATION);
    expect(names(generation!.attributes?.tools)).toEqual(['a', 'b', 'hidden']);
  });

  it('drops activeTools names that are not registered tools', async () => {
    const agent = createAgent(1, [{ id: 'ghost', processInputStep: async () => ({ activeTools: ['a', 'ghost'] }) }]);

    await run(agent);

    expect(providerTools).toEqual([['a']]);
    const [span] = inferenceSpans();
    expect(span!.attributes?.availableTools).toEqual(['a']);
    expect(names(span!.attributes?.tools)).toEqual(['a']);
  });

  it('records the definitions of tools a processor added', async () => {
    const agent = createAgent(1, [
      { id: 'add', processInputStep: async ({ tools }) => ({ tools: { ...tools, added: tool('added') } }) },
    ]);

    await run(agent);

    expect(providerTools).toEqual([['a', 'b', 'hidden', 'added']]);
    const [span] = inferenceSpans();
    expect(span!.attributes?.availableTools).toEqual(providerTools[0]);
    expect(span!.attributes?.tools?.find(definition => definition.name === 'added')).toMatchObject({
      type: 'function',
      description: 'tool added',
      parameters: expect.objectContaining({ type: 'object' }),
    });
  });

  it('records each call when the tool set grows and then shrinks', async () => {
    const perStep = [['a'], ['a', 'b', 'hidden'], ['b']];
    const agent = createAgent(3, [
      { id: 'vary', processInputStep: async ({ stepNumber }) => ({ activeTools: perStep[stepNumber] }) },
    ]);

    await run(agent);

    expect(providerTools).toEqual(perStep);
    const spans = inferenceSpans();
    expect(spans.map(span => names(span.attributes?.tools))).toEqual(perStep);
    expect(spans.map(span => span.attributes?.availableTools)).toEqual(perStep);
  });

  it("records the tools still sent when a processor sets toolChoice to 'none'", async () => {
    const agent = createAgent(1, [{ id: 'none', processInputStep: async () => ({ toolChoice: 'none' }) }]);

    await run(agent);

    expect(providerTools).toEqual([['a', 'b', 'hidden']]);
    const [span] = inferenceSpans();
    expect(span!.attributes?.availableTools).toEqual(['a', 'b', 'hidden']);
    expect(names(span!.attributes?.tools)).toEqual(['a', 'b', 'hidden']);
    expect(span!.attributes?.toolChoice).toBe('none');
  });

  it("records no tools when toolChoice is 'none' with a structured-output schema", async () => {
    const agent = createAgent(1, [{ id: 'none', processInputStep: async () => ({ toolChoice: 'none' }) }]);

    const result = await agent.stream('go', {
      structuredOutput: { schema: z.object({ answer: z.string() }), errorStrategy: 'warn' },
    });
    await result.consumeStream();

    expect(providerTools).toEqual([[]]);
    const [span] = inferenceSpans();
    expect(span!.attributes?.tools).toBeUndefined();
    expect(span!.attributes?.toolChoice).toBe('none');
  });

  it('records per-call definitions on the durable agent path', async () => {
    const agent = createAgent(2, [{ id: 'narrow', processInputStep: async () => ({ activeTools: ['a', 'b'] }) }]);
    const mastra = new Mastra({
      agents: { wrapped: createDurableAgent({ agent }) } as any,
      storage: new MockStore(),
      observability: new Observability({
        configs: { test: { serviceName: 'model-inference-tools', exporters: [testExporter] } },
      }),
    });

    const result = await (mastra.getAgent('wrapped') as any).stream('go');
    await result.output.consumeStream();
    await expect.poll(() => inferenceSpans().length).toBe(2);
    result.cleanup?.();

    expect(providerTools).toEqual([
      ['a', 'b'],
      ['a', 'b'],
    ]);
    const spans = inferenceSpans();
    expect(spans.map(span => names(span.attributes?.tools))).toEqual(providerTools);
    expect(spans.map(span => span.attributes?.availableTools)).toEqual(providerTools);
  });
});
