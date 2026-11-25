/**
 * What LangSmith receives for real agent runs, read off the wire: real Agent, real
 * Observability and the real LangSmith SDK, with only `fetch` and the model replaced.
 *
 * LangSmith builds a thread's Trajectory view, and the `trajectory` variable of online
 * evaluators, from the messages on the `llm` runs.
 */

import { Agent } from '@mastra/core/agent';
import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import type { AnyExportedSpan } from '@mastra/core/observability';
import type { OutputProcessor } from '@mastra/core/processors';
import { InMemoryStore } from '@mastra/core/storage';
import { createTool } from '@mastra/core/tools';
import { Observability } from '@mastra/observability';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { LangSmithExporter } from './tracing';

const QUESTION = 'What is the weather in Paris?';
const ANSWER = 'It is sunny in Paris.';
const FORECAST = { city: 'Paris', condition: 'sunny' };
const CALL_USAGE = { inputTokens: 10, outputTokens: 5, totalTokens: 15 };

/** Calls getWeather until it has a result, then answers. */
const model = {
  specificationVersion: 'v2',
  provider: 'openai',
  modelId: 'gpt-4o-mini',
  supportedUrls: {},
  doGenerate: async () => ({
    content: [{ type: 'text', text: ANSWER }],
    finishReason: 'stop',
    usage: CALL_USAGE,
    warnings: [],
  }),
  doStream: async ({ prompt }: { prompt: Array<{ role: string }> }) => {
    // A provider call never ends in the tick it started; a resumed run depends on that.
    await new Promise(resolve => setTimeout(resolve, 20));
    const answered = prompt.some(message => message.role === 'tool');
    const parts = answered
      ? [
          { type: 'text-start', id: 't' },
          { type: 'text-delta', id: 't', delta: ANSWER },
          { type: 'text-end', id: 't' },
          { type: 'finish', finishReason: 'stop', usage: CALL_USAGE },
        ]
      : [
          { type: 'tool-call', toolCallId: 'call-1', toolName: 'getWeather', input: '{"city":"Paris"}' },
          { type: 'finish', finishReason: 'tool-calls', usage: CALL_USAGE },
        ];
    return {
      stream: new ReadableStream({
        start(controller) {
          for (const part of [{ type: 'stream-start', warnings: [] }, ...parts]) controller.enqueue(part);
          controller.close();
        },
      }),
    };
  },
} as any;

interface SetupOptions {
  requireApproval?: boolean;
  /** Send each run on its own and wait for LangSmith to answer, slower than the model does. */
  slowUnbatched?: boolean;
  excludeSpanTypes?: SpanType[];
  spanFilter?: (span: AnyExportedSpan) => boolean;
  toModelOutput?: () => unknown;
  outputProcessors?: OutputProcessor[];
}

function setup({
  requireApproval = false,
  slowUnbatched = false,
  excludeSpanTypes,
  spanFilter,
  toModelOutput,
  outputProcessors,
}: SetupOptions = {}) {
  const runs = new Map<string, any>();
  const save = (run: any) => runs.set(run.id, { ...runs.get(run.id), ...run });
  const exporter = new LangSmithExporter({
    apiKey: 'test-key',
    apiUrl: 'https://langsmith.test',
    autoBatchTracing: !slowUnbatched,
    fetchImplementation: async (url, init) => {
      const [, resource, id] = new URL(String(url)).pathname.split('/');
      if (slowUnbatched) await new Promise(resolve => setTimeout(resolve, 60));
      if (resource === 'runs') {
        const body = await new Response(init?.body).json();
        if (id === 'batch') [...(body.post ?? []), ...(body.patch ?? [])].forEach(save);
        else save({ ...body, id: id ?? body.id });
      }
      // `/info` without multipart support, so batches arrive as JSON.
      return Response.json({ batch_ingest_config: { use_multipart_endpoint: false } });
    },
  });
  const agent = new Agent({
    id: 'weather',
    name: 'Weather',
    instructions: 'Use the tools.',
    model,
    tools: {
      getWeather: createTool({
        id: 'getWeather',
        description: 'Get the weather for a city',
        inputSchema: z.object({ city: z.string() }),
        requireApproval,
        execute: async () => FORECAST,
        toModelOutput,
      }),
    },
    outputProcessors,
  });
  const observability = new Observability({
    configs: { default: { serviceName: 'test', exporters: [exporter], excludeSpanTypes, spanFilter } },
  });
  new Mastra({ agents: { agent }, storage: new InMemoryStore(), logger: false, observability });

  /** Runs in the order they started, once everything is exported. */
  const sentRuns = async () => {
    await vi.waitFor(async () => {
      await observability.getDefaultInstance()!.flush();
      expect(runs.size).toBeGreaterThan(0);
      expect([...runs.values()].every(run => run.end_time)).toBe(true);
    });
    return [...runs.values()].sort(
      (a, b) => a.start_time - b.start_time || a.dotted_order.localeCompare(b.dotted_order),
    );
  };
  const llmRuns = async () => (await sentRuns()).filter(run => run.run_type === 'llm');
  return { agent, observability, sentRuns, llmRuns };
}

const toolSteps = [
  {
    role: 'assistant',
    content: '',
    tool_calls: [{ id: 'call-1', type: 'function', function: { name: 'getWeather', arguments: '{"city":"Paris"}' } }],
  },
  { role: 'tool', tool_call_id: 'call-1', name: 'getWeather', content: JSON.stringify(FORECAST) },
];

describe('LangSmith trajectory of an agent turn', () => {
  it('shows the question, the tool call, its result and the answer', async () => {
    const { agent, llmRuns } = setup();
    const stream = await agent.stream(QUESTION);
    await stream.consumeStream();

    const calls = await llmRuns();
    expect(calls.map(run => run.name)).toEqual(['inference: 0', 'inference: 1']);

    const [first, second] = calls.map(run => run.inputs.messages);
    expect(first).toMatchObject([
      { role: 'system', content: 'Use the tools.' },
      { role: 'user', content: [{ type: 'text', text: QUESTION }] },
    ]);
    expect(second).toEqual([...first, ...toolSteps]);
    expect(calls[1].outputs).toMatchObject({ role: 'assistant', content: ANSWER });
    for (const run of calls) {
      expect(run.extra.metadata).toMatchObject({ ls_message_format: 'completions', ls_model_name: 'gpt-4o-mini' });
      expect(run.extra.metadata).not.toHaveProperty('ls_message_view_exclude');
    }
  });

  it('shows what toModelOutput gave the model instead of the raw tool result', async () => {
    const { agent, llmRuns } = setup({ toModelOutput: () => ({ type: 'text', value: 'sunny' }) });
    const stream = await agent.stream(QUESTION);
    await stream.consumeStream();

    expect((await llmRuns())[1].inputs.messages.at(-1)).toMatchObject({ role: 'tool', content: 'sunny' });
  });

  it('leaves an answer that a processor rejected out of the retry, and keeps the tool call before it', async () => {
    const { agent, llmRuns } = setup({
      outputProcessors: [
        {
          id: 'quality',
          processOutputStep: ({ text, retryCount, abort, messageList }) => {
            if (text === ANSWER && retryCount === 0) abort('Say it differently.', { retry: true });
            return messageList;
          },
        },
      ],
    });
    const stream = await agent.stream(QUESTION, { maxProcessorRetries: 1 });
    await stream.consumeStream();

    const calls = await llmRuns();
    expect(calls).toHaveLength(3);
    expect(calls[2].inputs.messages).toEqual(calls[1].inputs.messages);
  });

  it.each<[string, SetupOptions]>([
    ['by default', {}],
    ['when runs are sent one by one over a slow connection', { slowUnbatched: true }],
    ['when a filter drops one of the calls', { spanFilter: span => span.name !== 'inference: 0' }],
    ['when a filter drops all of them', { excludeSpanTypes: [SpanType.MODEL_INFERENCE] }],
  ])('counts every token once %s', async (_, options) => {
    const { agent, llmRuns } = setup(options);
    const stream = await agent.stream(QUESTION);
    await stream.consumeStream();

    const counts = (await llmRuns()).map(run => run.extra.metadata.usage_metadata?.total_tokens ?? 0);
    expect(counts.reduce((sum, count) => sum + count, 0)).toBe((await stream.totalUsage).totalTokens);
  });

  it('shows the approved tool call after the run is resumed, without counting the suspended call again', async () => {
    const { agent, llmRuns } = setup({ requireApproval: true });
    const suspended = await agent.stream(QUESTION);
    await suspended.consumeStream();
    const resumed = await agent.approveToolCall({ runId: suspended.runId, toolCallId: 'call-1' });
    await resumed.consumeStream();

    const calls = await llmRuns();
    expect(calls.map(run => run.extra.metadata.usage_metadata.total_tokens)).toEqual([15, 15]);
    expect(calls[1].outputs).toMatchObject({ role: 'assistant', content: ANSWER });
    expect(calls[1].inputs.messages).toEqual(expect.arrayContaining(toolSteps));
  });

  it('shows the answer of a generation whose calls are not exported', async () => {
    const { agent, llmRuns } = setup({ excludeSpanTypes: [SpanType.MODEL_INFERENCE] });
    const stream = await agent.stream(QUESTION);
    await stream.consumeStream();

    expect(await llmRuns()).toMatchObject([
      { name: "llm: 'gpt-4o-mini'", outputs: { role: 'assistant', content: ANSWER } },
    ]);
  });

  it('leaves out the model call that names the thread', async () => {
    const { agent, observability, llmRuns } = setup();
    const span = observability.getDefaultInstance()!.startSpan({ type: SpanType.AGENT_RUN, name: 'agent run' });
    await agent.generateTitleFromUserMessage({ message: QUESTION, tracingContext: { currentSpan: span } });
    span.end();

    const calls = await llmRuns();
    expect(calls).toHaveLength(1);
    expect(calls[0].extra.metadata).toMatchObject({ ls_message_view_exclude: true });
  });
});
