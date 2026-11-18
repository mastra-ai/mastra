/**
 * MODEL_STEP span input for workflow tools (#30219).
 *
 * An agent that calls a workflow through `new Agent({ workflows })` (tool name
 * `workflow-<name>`) sends the workflow result to the model on the next step,
 * but the MODEL_STEP span input showed only `[tool-result: workflow-<name>]`.
 * Exporters such as Langfuse read that span, so the traced conversation lost
 * what the model was given. Regular tools can opt in with `toModelOutput`;
 * workflow tools had no way to.
 *
 * These tests drive a real Agent, a real workflow and the real ModelSpanTracker
 * through a TestExporter. Only the LLM is mocked.
 */
import { MockLanguageModelV2, convertArrayToReadableStream } from '@internal/ai-sdk-v5/test';
import { Agent } from '@mastra/core/agent';
import type { AgentExecutionOptions } from '@mastra/core/agent';
import { createDurableAgent } from '@mastra/core/agent/durable';
import { Mastra } from '@mastra/core/mastra';
import { MockMemory } from '@mastra/core/memory';
import { SpanType } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { createStep, createWorkflow } from '@mastra/core/workflows';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod/v4';
import { Observability } from './default';
import { TestExporter } from './exporters';

const forecast = { city: 'Paris', condition: 'sunny', highC: 24 };

function createWeatherWorkflow() {
  const lookup = createStep({
    id: 'lookup-forecast',
    inputSchema: z.object({ city: z.string() }),
    outputSchema: z.object({ city: z.string(), condition: z.string(), highC: z.number() }),
    execute: async ({ inputData }) => ({ ...forecast, city: inputData.city }),
  });

  return createWorkflow({
    id: 'weatherWorkflow',
    description: 'Look up the forecast for a city',
    inputSchema: z.object({ city: z.string() }),
    outputSchema: z.object({ city: z.string(), condition: z.string(), highC: z.number() }),
  })
    .then(lookup)
    .commit();
}

const getWeather = createTool({
  id: 'getWeather',
  description: 'Look up the forecast for a city',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ city: z.string(), condition: z.string(), highC: z.number() }),
  execute: async ({ city }) => ({ ...forecast, city }),
});

type ToolResultPromptPart = { type: 'tool-result'; toolName: string; output: unknown };

/**
 * Calls `toolName` once, then answers. Records every prompt it receives so a
 * test can compare the MODEL_STEP span input with what the model was sent.
 */
function toolThenAnswerModel(toolName: string, toolInput: unknown) {
  const prompts: unknown[][] = [];
  let call = 0;
  const model = new MockLanguageModelV2({
    doGenerate: async ({ prompt }) => {
      prompts.push(structuredClone(prompt) as unknown[]);
      const turn = call++;
      return {
        content:
          turn === 0
            ? [{ type: 'tool-call', toolCallId: 'call-1', toolName, input: JSON.stringify(toolInput) }]
            : [{ type: 'text', text: 'Sunny in Paris, 24C.' }],
        finishReason: turn === 0 ? 'tool-calls' : 'stop',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        response: { id: `id-${turn}`, modelId: 'mock-model-id', timestamp: new Date(0) },
        warnings: [],
      };
    },
    doStream: async ({ prompt }) => {
      prompts.push(structuredClone(prompt) as unknown[]);
      const turn = call++;
      return {
        stream: convertArrayToReadableStream(
          turn === 0
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallId: 'call-1',
                  toolName,
                  input: JSON.stringify(toolInput),
                  providerExecuted: false,
                },
                {
                  type: 'finish',
                  finishReason: 'tool-calls',
                  usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
                },
              ]
            : [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
                { type: 'text-start', id: 'text-1' },
                { type: 'text-delta', id: 'text-1', delta: 'Sunny in Paris, 24C.' },
                { type: 'text-end', id: 'text-1' },
                { type: 'finish', finishReason: 'stop', usage: { inputTokens: 20, outputTokens: 5, totalTokens: 25 } },
              ],
        ),
        rawCall: { rawPrompt: null, rawSettings: {} },
        warnings: [],
      };
    },
  });

  /** The tool-result part the model received on a call (by default the answering call). */
  const receivedToolResult = (callIndex = 1): ToolResultPromptPart | undefined => {
    const answerPrompt = prompts[callIndex] ?? [];
    for (const message of answerPrompt as Array<{ role?: string; content?: unknown }>) {
      if (message.role !== 'tool' || !Array.isArray(message.content)) continue;
      const part = message.content.find((p: { type?: string }) => p?.type === 'tool-result');
      if (part) return part as ToolResultPromptPart;
    }
    return undefined;
  };

  return { model, receivedToolResult };
}

/** The tool message in the input of the MODEL_STEP that produced the answer. */
function answerStepToolMessage(exporter: TestExporter): string | undefined {
  const steps = exporter.getSpansByType(SpanType.MODEL_STEP);
  for (const step of steps) {
    const input = step.input as Array<{ role: string; content: string }> | undefined;
    const toolMessage = Array.isArray(input) ? input.find(message => message.role === 'tool') : undefined;
    if (toolMessage) return toolMessage.content;
  }
  return undefined;
}

/** Wait until span delivery to the exporter stops changing. */
async function settle(exporter: TestExporter, maxMs = 2000) {
  let previous = -1;
  for (let waited = 0; waited < maxMs; waited += 20) {
    const count = exporter.getAllSpans().length;
    if (count > 0 && count === previous) return;
    previous = count;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
}

const hosts: Mastra[] = [];
afterEach(async () => {
  await Promise.all(hosts.splice(0).map(host => host.shutdown()));
});

function buildMastra(
  exporter: TestExporter,
  agent: Agent,
  engine: 'agent' | 'durable',
  { backgroundTasks = false }: { backgroundTasks?: boolean } = {},
) {
  const registered = engine === 'durable' ? createDurableAgent({ agent }) : agent;
  const mastra = new Mastra({
    agents: { weatherAgent: registered } as Record<string, Agent>,
    storage: new MockStore(),
    observability: new Observability({
      configs: { test: { serviceName: 'workflow-tool-step-input', exporters: [exporter] } },
    }),
    ...(backgroundTasks ? { backgroundTasks: { enabled: true } } : {}),
  });
  hosts.push(mastra);
  return mastra.getAgent('weatherAgent');
}

/** A tool-result chunk as the run returns it in `toolResults`. */
type ToolResultChunk = { payload?: { toolName?: string; providerMetadata?: { mastra?: Record<string, unknown> } } };

type Run = (
  agent: Agent,
  exporter: TestExporter,
  options?: AgentExecutionOptions,
) => Promise<{ text: string; toolResults: ToolResultChunk[] }>;

const runs: Array<{ name: string; engine: 'agent' | 'durable'; run: Run }> = [
  {
    name: 'Agent.generate',
    engine: 'agent',
    run: async (agent, _exporter, options) => {
      const result = await agent.generate('Weather in Paris?', options);
      return { text: result.text, toolResults: result.toolResults as ToolResultChunk[] };
    },
  },
  {
    name: 'Agent.stream',
    engine: 'agent',
    run: async (agent, _exporter, options) => {
      const result = await agent.stream('Weather in Paris?', options);
      return { text: await result.text, toolResults: (await result.toolResults) as ToolResultChunk[] };
    },
  },
  {
    name: 'DurableAgent.stream',
    engine: 'durable',
    run: async (agent, exporter, options) => {
      const result = (await agent.stream('Weather in Paris?', options)) as unknown as {
        output: { consumeStream(): Promise<void>; text: Promise<string>; toolResults: Promise<ToolResultChunk[]> };
        cleanup?: () => void;
      };
      await result.output.consumeStream();
      const text = await result.output.text;
      const toolResults = await result.output.toolResults;
      await settle(exporter);
      result.cleanup?.();
      return { text, toolResults };
    },
  },
];

describe.each(runs)('MODEL_STEP input for tool results ($name)', ({ engine, run }) => {
  let exporter: TestExporter;

  beforeEach(() => {
    exporter = new TestExporter();
  });

  it('shows the workflow result the model received, not a placeholder (#30219)', async () => {
    const { model, receivedToolResult } = toolThenAnswerModel('workflow-weatherWorkflow', {
      inputData: { city: 'Paris' },
    });
    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'Use the weather workflow.',
      model,
      workflows: { weatherWorkflow: createWeatherWorkflow() },
    });

    const { text, toolResults } = await run(buildMastra(exporter, agent, engine), exporter);
    expect(text).toBe('Sunny in Paris, 24C.');

    // What the model was sent is unchanged: the workflow tool's result object.
    const received = receivedToolResult();
    expect(received?.toolName).toBe('workflow-weatherWorkflow');
    expect(received?.output).toEqual({
      type: 'json',
      value: { result: forecast, runId: expect.any(String) },
    });

    // The span shows that same value, in the same form a `toModelOutput` tool gets.
    const toolMessage = answerStepToolMessage(exporter);
    expect(toolMessage).toBe(JSON.stringify(received?.output));
    expect(toolMessage).toContain('"condition":"sunny"');

    // The tool-result the run returns carries the marker. The durable engine
    // emits it from the step that ran the workflow, so the marker survives
    // serialization even when a later step can't resolve the tool.
    expect(toolResults.map(chunk => chunk.payload?.providerMetadata?.mastra?.workflowTool)).toEqual([true]);
  });

  it('shows the workflow result when the answering step no longer offers the workflow tool (#30219)', async () => {
    const { model, receivedToolResult } = toolThenAnswerModel('workflow-weatherWorkflow', {
      inputData: { city: 'Paris' },
    });
    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'Use the weather workflow.',
      model,
      workflows: { weatherWorkflow: createWeatherWorkflow() },
    });

    // The answering step offers no tools, but its prompt still carries the workflow result.
    const { text } = await run(buildMastra(exporter, agent, engine), exporter, {
      prepareStep: ({ stepNumber }) => (stepNumber > 0 ? { tools: {} } : undefined),
    });
    expect(text).toBe('Sunny in Paris, 24C.');

    const received = receivedToolResult();
    expect(received?.output).toEqual({ type: 'json', value: { result: forecast, runId: expect.any(String) } });
    expect(answerStepToolMessage(exporter)).toBe(JSON.stringify(received?.output));
  });

  it('shows the workflow result when tool hooks wrap the workflow tool (#30219)', async () => {
    const { model, receivedToolResult } = toolThenAnswerModel('workflow-weatherWorkflow', {
      inputData: { city: 'Paris' },
    });
    const calls: string[] = [];
    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'Use the weather workflow.',
      model,
      workflows: { weatherWorkflow: createWeatherWorkflow() },
      hooks: { afterToolCall: ({ toolName }) => void calls.push(toolName) },
    });

    const { text } = await run(buildMastra(exporter, agent, engine), exporter);
    expect(text).toBe('Sunny in Paris, 24C.');
    expect(calls).toEqual(['workflow-weatherWorkflow']);
    expect(answerStepToolMessage(exporter)).toBe(JSON.stringify(receivedToolResult()?.output));
  });

  it('shows the result of a workflow that ran as an awaited background task (#30219)', async () => {
    const { model, receivedToolResult } = toolThenAnswerModel('workflow-weatherWorkflow', {
      inputData: { city: 'Paris' },
      _background: { disposition: 'awaited' },
    });
    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'Use the weather workflow.',
      model,
      workflows: { weatherWorkflow: createWeatherWorkflow() },
      backgroundTasks: { tools: { weatherWorkflow: true } },
    });

    const { text, toolResults } = await run(buildMastra(exporter, agent, engine, { backgroundTasks: true }), exporter);
    expect(text).toBe('Sunny in Paris, 24C.');
    // Marked where the task ran, so the marker doesn't depend on a later step resolving the tool.
    expect(toolResults.map(chunk => chunk.payload?.providerMetadata?.mastra?.workflowTool)).toContain(true);

    // The model gets the workflow result once the background task completes.
    const received = receivedToolResult();
    expect(JSON.stringify(received?.output)).toContain('"condition":"sunny"');
    expect(answerStepToolMessage(exporter)).toBe(JSON.stringify(received?.output));
  });

  it('shows a workflow result recalled from memory on the next turn (#30219)', async () => {
    const { model, receivedToolResult } = toolThenAnswerModel('workflow-weatherWorkflow', {
      inputData: { city: 'Paris' },
    });
    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'Use the weather workflow.',
      model,
      workflows: { weatherWorkflow: createWeatherWorkflow() },
      memory: new MockMemory(),
    });
    const registered = buildMastra(exporter, agent, engine);
    const memory = { thread: 'thread-1', resource: 'user-1' };

    await run(registered, exporter, { memory });
    exporter.reset();

    // The second turn answers straight away; its prompt carries the stored workflow result.
    const { text } = await run(registered, exporter, { memory });
    expect(text).toBe('Sunny in Paris, 24C.');
    const recalled = receivedToolResult(2);
    expect(JSON.stringify(recalled?.output)).toContain('"condition":"sunny"');
    expect(answerStepToolMessage(exporter)).toBe(JSON.stringify(recalled?.output));
  });

  it('keeps the placeholder when a regular tool ran under a workflow tool name in that step', async () => {
    const { model, receivedToolResult } = toolThenAnswerModel('workflow-weatherWorkflow', { city: 'Paris' });
    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'Use the weather workflow.',
      model,
      workflows: { weatherWorkflow: createWeatherWorkflow() },
    });

    // The calling step swaps in a regular tool under the workflow's name; the
    // answering step gets the real workflow tool back.
    const { text } = await run(buildMastra(exporter, agent, engine), exporter, {
      prepareStep: ({ stepNumber }) =>
        stepNumber === 0 ? { tools: { 'workflow-weatherWorkflow': getWeather } } : undefined,
    });
    expect(text).toBe('Sunny in Paris, 24C.');
    expect(receivedToolResult()?.output).toEqual({ type: 'json', value: forecast });
    expect(answerStepToolMessage(exporter)).toBe('[tool-result: workflow-weatherWorkflow]');
  });

  it('keeps the placeholder for a regular tool that does not opt in with toModelOutput', async () => {
    const { model, receivedToolResult } = toolThenAnswerModel('getWeather', { city: 'Paris' });
    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'Use the weather tool.',
      model,
      tools: { getWeather },
    });

    const { text } = await run(buildMastra(exporter, agent, engine), exporter);
    expect(text).toBe('Sunny in Paris, 24C.');
    expect(receivedToolResult()?.output).toEqual({ type: 'json', value: forecast });
    expect(answerStepToolMessage(exporter)).toBe('[tool-result: getWeather]');
  });

  it('keeps the placeholder for a regular tool whose name only looks like a workflow tool', async () => {
    const { model, receivedToolResult } = toolThenAnswerModel('workflow-userTool', { city: 'Paris' });
    const agent = new Agent({
      id: 'weather-agent',
      name: 'Weather Agent',
      instructions: 'Use the weather tool.',
      model,
      tools: { 'workflow-userTool': getWeather },
    });

    const { text } = await run(buildMastra(exporter, agent, engine), exporter);
    expect(text).toBe('Sunny in Paris, 24C.');
    expect(receivedToolResult()?.output).toEqual({ type: 'json', value: forecast });
    expect(answerStepToolMessage(exporter)).toBe('[tool-result: workflow-userTool]');
  });
});
