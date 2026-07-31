/**
 * Provider-tool observability integration tests.
 *
 * Drives a real Observability instance + ModelSpanTracker through a TestExporter
 * and asserts where PROVIDER_TOOL_CALL spans land in the exported tree:
 * - a result that resolves in the calling step nests under that MODEL_STEP,
 * - a result that resolves in a later step nests under the step that delivered it,
 *   with the start time backdated to the call,
 * - a call whose result never arrives falls back to the AGENT_RUN anchor,
 * for both the regular and durable agent loops.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { Observability } from './default';
import { TestExporter } from './exporters';

const testUsage = { inputTokens: 10, outputTokens: 20, totalTokens: 30 };

/** Provider tool-call and tool-result resolve within a single model step. */
function sameStepProviderToolModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallId: 'srvtoolu_1',
          toolName: 'web_search',
          input: '{"query":"AI news"}',
          providerExecuted: true,
        },
        {
          type: 'tool-result',
          toolCallId: 'srvtoolu_1',
          toolName: 'web_search',
          result: { answer: 'search results' },
          providerExecuted: true,
        },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'done' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: testUsage },
      ]),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/**
 * Step 1: provider tool-call (no result) + client tool-call forcing a second step.
 * Step 2: the provider tool-result arrives, then final text.
 */
function crossStepProviderToolModel() {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const first = call++ === 0;
      return {
        stream: convertArrayToReadableStream(
          first
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallId: 'srvtoolu_2',
                  toolName: 'web_search',
                  input: '{"query":"deferred"}',
                  providerExecuted: true,
                },
                {
                  type: 'tool-call',
                  toolCallId: 'call-client-1',
                  toolName: 'get_weather',
                  input: '{"city":"Paris"}',
                  providerExecuted: false,
                },
                { type: 'finish', finishReason: 'tool-calls', usage: testUsage },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'resp-2', modelId: 'mock-model', timestamp: new Date(0) },
                {
                  type: 'tool-result',
                  toolCallId: 'srvtoolu_2',
                  toolName: 'web_search',
                  result: { answer: 'late results' },
                  providerExecuted: true,
                },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'done' },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage: testUsage },
              ],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });
}

/** Provider tool-call whose result never arrives before the run finishes. */
function abandonedProviderToolModel() {
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream([
        { type: 'stream-start', warnings: [] },
        { type: 'response-metadata', id: 'resp-1', modelId: 'mock-model', timestamp: new Date(0) },
        {
          type: 'tool-call',
          toolCallId: 'srvtoolu_3',
          toolName: 'web_search',
          input: '{"query":"lost"}',
          providerExecuted: true,
        },
        { type: 'text-start', id: 'text-1' },
        { type: 'text-delta', id: 'text-1', delta: 'done' },
        { type: 'text-end', id: 'text-1' },
        { type: 'finish', finishReason: 'stop', usage: testUsage },
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

function buildAgent(model: MockLanguageModelV2) {
  const testExporter = new TestExporter();
  const agent = new Agent({
    id: 'provider-tool-agent',
    name: 'provider-tool-agent',
    instructions: 'test',
    model,
    tools: { get_weather: weatherTool },
  });
  const mastra = new Mastra({
    agents: { agent },
    observability: new Observability({
      configs: { test: { serviceName: 'provider-tool-tracing-it', exporters: [testExporter] } },
    }),
  });
  return { agent: mastra.getAgent('agent'), testExporter };
}

function buildDurableAgent(model: MockLanguageModelV2) {
  const testExporter = new TestExporter();
  const agent = new Agent({
    id: 'provider-tool-agent',
    name: 'provider-tool-agent',
    instructions: 'test',
    model,
    tools: { get_weather: weatherTool },
  });
  const wrapped = createDurableAgent({ agent });
  const mastra = new Mastra({
    agents: { wrapped } as any,
    storage: new MockStore(),
    observability: new Observability({
      configs: { test: { serviceName: 'provider-tool-tracing-it', exporters: [testExporter] } },
    }),
  });
  return { agent: mastra.getAgent('wrapped') as any, testExporter };
}

/** Wait until span delivery to the exporter quiesces (count stable across several checks). */
async function settle(testExporter: TestExporter, maxMs = 2000) {
  let prev = -1;
  let stable = 0;
  for (let waited = 0; waited < maxMs; waited += 20) {
    const n = testExporter.getAllSpans().length;
    if (n > 0 && n === prev) {
      stable++;
      if (stable >= 3) return;
    } else {
      stable = 0;
    }
    prev = n;
    await new Promise(r => setTimeout(r, 20));
  }
}

async function runToCompletion(agent: any, testExporter: TestExporter) {
  const res = await agent.stream('Search for AI news');
  for await (const _ of res.fullStream) {
    // drain
  }
  await settle(testExporter);
}

describe('PROVIDER_TOOL_CALL span placement', () => {
  it('nests under the MODEL_STEP when the result resolves in the calling step', async () => {
    const { agent, testExporter } = buildAgent(sameStepProviderToolModel());
    await runToCompletion(agent, testExporter);

    const [providerSpan] = testExporter.getSpansByType('provider_tool_call' as any);
    expect(providerSpan).toBeDefined();
    const [stepSpan] = testExporter.getSpansByType('model_step' as any);
    expect(providerSpan.parentSpanId).toBe(stepSpan.id);
    expect(providerSpan.input).toEqual({ query: 'AI news' });
    expect(providerSpan.output).toEqual({ answer: 'search results' });
    expect(testExporter.getIncompleteSpans()).toHaveLength(0);
  });

  it('nests under the step that delivers a deferred result, backdated to the call', async () => {
    const { agent, testExporter } = buildAgent(crossStepProviderToolModel());
    await runToCompletion(agent, testExporter);

    const [providerSpan] = testExporter.getSpansByType('provider_tool_call' as any);
    expect(providerSpan).toBeDefined();
    const stepSpans = testExporter.getSpansByType('model_step' as any);
    expect(stepSpans).toHaveLength(2);
    const resultStep = stepSpans.find(s => s.id === providerSpan.parentSpanId);
    expect(resultStep).toBeDefined();
    // The call was recorded during the first step, so the span starts before
    // the second (delivering) step does.
    expect(new Date(providerSpan.startTime!).getTime()).toBeLessThanOrEqual(new Date(resultStep!.startTime!).getTime());
    expect(providerSpan.output).toEqual({ answer: 'late results' });
    expect(testExporter.getIncompleteSpans()).toHaveLength(0);
  });

  it('anchors to AGENT_RUN when the result never arrives', async () => {
    const { agent, testExporter } = buildAgent(abandonedProviderToolModel());
    await runToCompletion(agent, testExporter);

    const [providerSpan] = testExporter.getSpansByType('provider_tool_call' as any);
    expect(providerSpan).toBeDefined();
    const [agentRunSpan] = testExporter.getSpansByType('agent_run' as any);
    expect(providerSpan.parentSpanId).toBe(agentRunSpan.id);
    expect(providerSpan.input).toEqual({ query: 'lost' });
    expect(providerSpan.output).toBeUndefined();
    expect(testExporter.getIncompleteSpans()).toHaveLength(0);
  });

  it('nests under the MODEL_STEP in the durable agent loop', async () => {
    const { agent, testExporter } = buildDurableAgent(sameStepProviderToolModel());
    await runToCompletion(agent, testExporter);

    const [providerSpan] = testExporter.getSpansByType('provider_tool_call' as any);
    expect(providerSpan).toBeDefined();
    const [stepSpan] = testExporter.getSpansByType('model_step' as any);
    expect(providerSpan.parentSpanId).toBe(stepSpan.id);
    expect(providerSpan.input).toEqual({ query: 'AI news' });
    expect(providerSpan.output).toEqual({ answer: 'search results' });
  });

  it('creates a single span for a deferred result in the durable agent loop', async () => {
    const { agent, testExporter } = buildDurableAgent(crossStepProviderToolModel());
    await runToCompletion(agent, testExporter);

    const providerSpans = testExporter.getSpansByType('provider_tool_call' as any);
    expect(providerSpans).toHaveLength(1);
    expect(providerSpans[0].output).toEqual({ answer: 'late results' });
  });
});
