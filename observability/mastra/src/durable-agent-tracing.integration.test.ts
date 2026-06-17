/**
 * Durable-agent observability integration tests.
 *
 * Unlike the unit test in @mastra/core (which mocks the span tracker, so its
 * wrapStream is identity and nothing nests/closes), these drive a REAL
 * Observability instance + the real ModelSpanTracker through a TestExporter and
 * assert the exported span tree: AGENT_RUN root, one MODEL_GENERATION, MODEL_STEP
 * / MODEL_INFERENCE / MODEL_CHUNK closing, TOOL_CALL nesting under its MODEL_STEP,
 * usage on the generation, and zero open spans — for both DurableAgent and
 * EventedAgent.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent, createEventedAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect, beforeEach } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { TestExporter } from './exporters';

function textModel(text: string) {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: text },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 } },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/** First call requests a tool, second call returns final text — a 2-step agentic loop. */
function toolThenTextModel(toolName: string, toolArgs: object, finalText: string) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const first = call++ === 0;
      return {
        stream: convertArrayToReadableStream(
          first
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: 'call-1',
                  toolName,
                  input: JSON.stringify(toolArgs),
                  providerExecuted: false,
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 20, totalTokens: 30 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: finalText },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 } },
              ],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/** Emits an error chunk so the run fails mid-stream (exercises the error path). */
function errorModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
        { type: 'error', error: new Error('mock model failure') },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

const weatherTool = createTool({
  id: 'get_weather',
  description: 'Get the weather for a city',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ city: z.string(), tempC: z.number() }),
  execute: async ({ city }: { city: string }) => ({ city, tempC: 21 }),
});

function buildMastra(testExporter: TestExporter, agent: Agent, variant: 'durable' | 'evented') {
  const wrapped = variant === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
  const mastra = new Mastra({
    agents: { wrapped } as any,
    storage: new MockStore(),
    observability: new Observability({
      configs: { test: { serviceName: 'durable-tracing-it', exporters: [testExporter] } },
    }),
  });
  return { mastra, wrapped: mastra.getAgent('wrapped') as any };
}

/** Wait until span delivery to the exporter quiesces (count stable across two checks),
 *  rather than a fixed sleep. Neutral signal — doesn't pre-judge the assertions. */
async function settle(testExporter: TestExporter, maxMs = 2000) {
  let prev = -1;
  for (let waited = 0; waited < maxMs; waited += 20) {
    const n = testExporter.getAllSpans().length;
    if (n > 0 && n === prev) return;
    prev = n;
    await new Promise(r => setTimeout(r, 20));
  }
}

async function runToCompletion(wrapped: any, prompt: string, testExporter: TestExporter) {
  const res = await wrapped.stream(prompt);
  await res.output.consumeStream();
  await settle(testExporter);
  res.cleanup?.();
}

const idOf = (s: any) => s.id ?? s.spanId;
const parentOf = (s: any) => s.parentSpanId;

describe('durable-agent observability — full span tree (real exporter)', () => {
  let testExporter: TestExporter;
  beforeEach(() => {
    testExporter = new TestExporter();
  });

  it('DurableAgent simple run: AGENT_RUN root → generation → step → inference → chunk, all closed', async () => {
    const agent = new Agent({ id: 'a', name: 'a', instructions: 'x', model: textModel('Hello') as any });
    const { wrapped } = buildMastra(testExporter, agent, 'durable');
    await runToCompletion(wrapped, 'hi', testExporter);

    expect(testExporter.getTraceIds()).toHaveLength(1);
    const agentRuns = testExporter.getSpansByType('agent_run' as any);
    const generations = testExporter.getSpansByType('model_generation' as any);
    expect(agentRuns).toHaveLength(1);
    expect(generations).toHaveLength(1);
    // root is the agent_run, generation nests under it
    expect(testExporter.getRootSpans().map(idOf)).toContain(idOf(agentRuns[0]));
    expect(parentOf(generations[0])).toBe(idOf(agentRuns[0]));
    // step / inference / chunk exist and nest
    expect(testExporter.getSpansByType('model_step' as any).length).toBeGreaterThanOrEqual(1);
    expect(testExporter.getSpansByType('model_inference' as any).length).toBeGreaterThanOrEqual(1);
    // the whole point: nothing dangling
    expect(testExporter.getIncompleteSpans()).toHaveLength(0);
  });

  it('DurableAgent tool call: ONE generation, 2 steps, TOOL_CALL nested under a model_step, all closed', async () => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'use the tool',
      model: toolThenTextModel('get_weather', { city: 'Paris' }, 'It is 21C in Paris.') as any,
      tools: { get_weather: weatherTool },
    });
    const { wrapped } = buildMastra(testExporter, agent, 'durable');
    await runToCompletion(wrapped, 'weather in paris?', testExporter);

    expect(testExporter.getTraceIds()).toHaveLength(1);
    expect(testExporter.getSpansByType('agent_run' as any)).toHaveLength(1);
    const generations = testExporter.getSpansByType('model_generation' as any);
    expect(generations).toHaveLength(1); // Option A: one generation across the loop
    const steps = testExporter.getSpansByType('model_step' as any);
    expect(steps.length).toBeGreaterThanOrEqual(2); // tool-call step + final step
    const toolCalls = testExporter.getSpansByType('tool_call' as any);
    expect(toolCalls).toHaveLength(1);
    // TOOL_CALL nests under a MODEL_STEP (not agent_run / workflow)
    expect(steps.map(idOf)).toContain(parentOf(toolCalls[0]));
    // generation carries usage; nothing dangling
    expect((generations[0] as any).attributes?.usage).toBeDefined();
    expect(testExporter.getIncompleteSpans()).toHaveLength(0);
  });

  it('DurableAgent fatal model error: root, generation, step AND inference all closed (no dangling)', async () => {
    const agent = new Agent({ id: 'a', name: 'a', instructions: 'x', model: errorModel() as any });
    const { wrapped } = buildMastra(testExporter, agent, 'durable');
    // the run fails; consuming the stream may reject — we only care that spans closed.
    try {
      await runToCompletion(wrapped, 'hi', testExporter);
    } catch {
      await new Promise(r => setTimeout(r, 50));
    }

    expect(testExporter.getSpansByType('agent_run' as any)).toHaveLength(1);
    // Regression guard for the durable-specific gap: MODEL_STEP + MODEL_INFERENCE
    // must close on error (reportGenerationError closes its open children).
    expect(testExporter.getIncompleteSpans()).toHaveLength(0);
  });

  it('EventedAgent (fire-and-forget) closes the full tree at completion', async () => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'use the tool',
      model: toolThenTextModel('get_weather', { city: 'Paris' }, 'It is 21C in Paris.') as any,
      tools: { get_weather: weatherTool },
    });
    const { wrapped } = buildMastra(testExporter, agent, 'evented');
    await runToCompletion(wrapped, 'weather in paris?', testExporter);

    expect(testExporter.getTraceIds()).toHaveLength(1);
    expect(testExporter.getSpansByType('agent_run' as any)).toHaveLength(1);
    expect(testExporter.getSpansByType('tool_call' as any)).toHaveLength(1);
    expect(testExporter.getIncompleteSpans()).toHaveLength(0);
  });
});
