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
import { SpanType } from '@mastra/core/observability';
import type { Processor, ProcessOutputStreamArgs } from '@mastra/core/processors';
import { MockStore } from '@mastra/core/storage';
import type { ChunkType } from '@mastra/core/stream';
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

/** The first `toolTurns` calls request a tool, the next returns final text — an agentic loop. */
function toolThenTextModel(toolName: string, toolArgs: object, finalText: string, toolTurns = 1) {
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => {
      const turn = call++;
      return {
        stream: convertArrayToReadableStream(
          turn < toolTurns
            ? [
                { type: 'stream-start', warnings: [] },
                { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
                {
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: `call-${turn + 1}`,
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

/**
 * Tool call then final text, where 900 of every 1000 input tokens come from the
 * prompt cache. Covers both deferred step closes: the tool-call step (closed
 * after the tools ran) and the final step (closed in the LLM step itself).
 */
function cachedToolThenTextModel() {
  const usage = { inputTokens: 1000, outputTokens: 10, totalTokens: 1010, cachedInputTokens: 900 };
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async () => ({
      stream: convertArrayToReadableStream(
        call++ === 0
          ? [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-0', modelId: 'mock-model-id', timestamp: new Date(0) },
              {
                type: 'tool-call',
                toolCallType: 'function',
                toolCallId: 'call-1',
                toolName: 'get_weather',
                input: JSON.stringify({ city: 'Paris' }),
                providerExecuted: false,
              },
              { type: 'finish', finishReason: 'tool-calls', usage },
            ]
          : [
              { type: 'stream-start', warnings: [] },
              { type: 'response-metadata', id: 'id-1', modelId: 'mock-model-id', timestamp: new Date(0) },
              { type: 'text-start', id: 'text-1' },
              { type: 'text-delta', id: 'text-1', delta: 'It is 21C in Paris.' },
              { type: 'text-end', id: 'text-1' },
              { type: 'finish', finishReason: 'stop', usage },
            ],
      ),
      rawCall: { rawPrompt: null, rawSettings: {} },
      warnings: [],
    }),
  });
}

/** An error the AI SDK retry ladder treats like a provider 5xx (`APICallError` markers + `isRetryable`). */
function retryableError(message: string): Error {
  const error = new Error(message) as Error & Record<symbol | string, unknown>;
  error[Symbol.for('vercel.ai.error')] = true;
  error[Symbol.for('vercel.ai.error.AI_APICallError')] = true;
  error.isRetryable = true;
  error.statusCode = 503;
  return error;
}

/** The first call fails after `failAfterMs` without streaming anything; later calls stream `text`. */
function failOnceThenTextModel(text: string, failAfterMs: number) {
  const answer = textModel(text);
  let call = 0;
  return new MockLanguageModelV2({
    doStream: async options => {
      if (call++ === 0) {
        await new Promise(resolve => setTimeout(resolve, failAfterMs));
        throw retryableError('provider unavailable');
      }
      return answer.doStream(options);
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

/** Pass-through output processor that runs per-chunk via processOutputStream. */
class PassThroughStreamProcessor implements Processor {
  readonly id: string;
  readonly name: string;

  constructor(id: string) {
    this.id = id;
    this.name = `Stream: ${id}`;
  }

  async processOutputStream(args: ProcessOutputStreamArgs): Promise<ChunkType | null | undefined> {
    return args.part;
  }
}

/**
 * Same per-chunk processor, but declaring the span type it should be traced
 * as. The durable path builds this span in the `ProcessorState` constructor
 * rather than at a runner call site, so it is the one place a declaration
 * could be dropped while every other phase honours it.
 */
class DeclaringStreamProcessor implements Processor {
  readonly id = 'declaring-stream';
  readonly name = 'Declaring Stream';
  readonly spanType = SpanType.MEMORY_OPERATION;
  readonly spanName = 'memory: stream';
  readonly spanAttributes = { operationType: 'recall' } as const;

  async processOutputStream(args: ProcessOutputStreamArgs): Promise<ChunkType | null | undefined> {
    return args.part;
  }
}

const weatherTool = createTool({
  id: 'get_weather',
  description: 'Get the weather for a city',
  inputSchema: z.object({ city: z.string() }),
  outputSchema: z.object({ city: z.string(), tempC: z.number() }),
  execute: async ({ city }: { city: string }) => ({ city, tempC: 21 }),
});

function buildMastra(testExporter: TestExporter, agent: Agent, variant: 'durable' | 'evented' | 'plain') {
  const wrapped =
    variant === 'plain' ? agent : variant === 'durable' ? createDurableAgent({ agent }) : createEventedAgent({ agent });
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
const clockOf = (s: any) =>
  s?.attributes?.completionStartTime ? +new Date(s.attributes.completionStartTime) : undefined;
const inferenceClockOf = (s: any) =>
  s?.attributes?.inferenceStartTime ? +new Date(s.attributes.inferenceStartTime) : undefined;
const startOf = (s: any) => +new Date(s.startTime);
const byStart = (spans: any[]) => [...spans].sort((a, b) => +new Date(a.startTime) - +new Date(b.startTime));

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

  it('DurableAgent tool call: step, generation and AGENT_RUN carry the first inference clock', async () => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'use the tool',
      model: toolThenTextModel('get_weather', { city: 'Paris' }, 'It is 21C in Paris.') as any,
      tools: { get_weather: weatherTool },
    });
    const { wrapped } = buildMastra(testExporter, agent, 'durable');
    await runToCompletion(wrapped, 'weather in paris?', testExporter);

    // The final step ends the generation and AGENT_RUN from snapshots taken at
    // run start, so the clock must survive the loop state. The first step's only
    // provider chunk is a whole tool-call, which counts as the first chunk.
    const inferences = byStart(testExporter.getSpansByType('model_inference' as any));
    const steps = byStart(testExporter.getSpansByType('model_step' as any));
    expect(inferences).toHaveLength(2);
    const first = clockOf(inferences[0]);
    expect(first).toBeTypeOf('number');
    expect(clockOf(inferences[1])).toBeGreaterThan(first!);
    expect(steps.map(clockOf)).toEqual(inferences.map(clockOf));
    expect(clockOf(testExporter.getSpansByType('model_generation' as any)[0])).toBe(first);
    expect(clockOf(testExporter.getSpansByType('agent_run' as any)[0])).toBe(first);
    expect(steps.map(inferenceClockOf)).toEqual(inferences.map(startOf));

    // Later iterations rebuild the generation and AGENT_RUN from the run-start
    // snapshot; the second step's chunk must not overwrite the clocks mid-run,
    // so every exported update and end carries the first ones.
    for (const type of ['model_generation', 'agent_run']) {
      const span = testExporter.getSpansByType(type as any)[0] as any;
      expect(inferenceClockOf(span)).toBe(startOf(inferences[0]));
      expect(span.timeToFirstTokenMs).toBe(inferences[0].timeToFirstTokenMs);
      const { events } = testExporter.getBySpanId(idOf(span));
      for (const [read, expected] of [
        [clockOf, first],
        [inferenceClockOf, startOf(inferences[0])],
      ] as const) {
        const clocks = events.map(e => read((e as any).exportedSpan)).filter(c => c !== undefined);
        expect(clocks.length).toBeGreaterThan(0);
        expect(new Set(clocks)).toEqual(new Set([expected]));
      }
    }
  });

  it('DurableAgent suspend and resume twice: every segment carries its own clock', async () => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'use the tool',
      model: toolThenTextModel('get_weather', { city: 'Paris' }, 'It is 21C in Paris.', 2) as any,
      tools: {
        get_weather: createTool({
          id: 'get_weather',
          description: 'Get the weather',
          inputSchema: z.object({ city: z.string() }),
          requireApproval: true,
          execute: async ({ city }) => ({ forecast: `Sunny in ${city}` }),
        }),
      },
    });
    const { wrapped } = buildMastra(testExporter, agent, 'durable');
    const drainUntilApproval = async (out: { fullStream: AsyncIterable<{ type: string }> }) => {
      for await (const chunk of out.fullStream) {
        if (chunk.type === 'tool-call-approval') break;
      }
      await settle(testExporter);
    };
    const res = await wrapped.stream('weather in paris?');
    await drainUntilApproval(res);
    await drainUntilApproval(await wrapped.approveToolCall({ runId: res.runId }));
    await drainUntilApproval(await wrapped.approveToolCall({ runId: res.runId }));

    // Each suspension ends its spans as `suspended` and each resume opens fresh
    // ones with a later start, so every pair must carry its own first inference
    // clock, never one from before it started.
    const runs = byStart(testExporter.getSpansByType('agent_run' as any));
    const generations = byStart(testExporter.getSpansByType('model_generation' as any));
    const inferences = byStart(testExporter.getSpansByType('model_inference' as any));
    expect(runs).toHaveLength(3);
    expect(generations).toHaveLength(3);
    expect(inferences).toHaveLength(3);
    expect(runs.slice(1).every(run => (run as any).name.includes('(resumed)'))).toBe(true);
    const clocks = inferences.map(clockOf);
    clocks.forEach((clock, i) => {
      expect(clock).toBeGreaterThanOrEqual(+new Date((runs[i] as any).startTime));
      expect([clockOf(runs[i]), clockOf(generations[i])]).toEqual([clock, clock]);
      const inferenceStart = startOf(inferences[i]);
      expect([inferenceClockOf(runs[i]), inferenceClockOf(generations[i])]).toEqual([inferenceStart, inferenceStart]);
    });
    for (const span of [...runs, ...generations]) {
      const { events } = testExporter.getBySpanId(idOf(span));
      for (const read of [clockOf, inferenceClockOf]) {
        const spanClocks = events.map(e => read((e as any).exportedSpan)).filter(c => c !== undefined);
        expect(new Set(spanClocks)).toEqual(new Set([read(span)]));
      }
    }
  });

  it('DurableAgent simple run: generation and AGENT_RUN carry the inference clock', async () => {
    const agent = new Agent({ id: 'a', name: 'a', instructions: 'x', model: textModel('Hello') as any });
    const { wrapped } = buildMastra(testExporter, agent, 'durable');
    await runToCompletion(wrapped, 'hi', testExporter);

    const inference = testExporter.getSpansByType('model_inference' as any)[0] as any;
    const first = clockOf(inference);
    expect(first).toBeTypeOf('number');
    for (const type of ['model_step', 'model_generation', 'agent_run']) {
      const span = testExporter.getSpansByType(type as any)[0] as any;
      expect(clockOf(span)).toBe(first);
      expect(inferenceClockOf(span)).toBe(startOf(inference));
      expect(span.timeToFirstTokenMs).toBe(inference.timeToFirstTokenMs);
    }
    expect(inference.timeToFirstTokenMs).toBe(first! - startOf(inference));
  });

  it('DurableAgent retry: time to first token counts from the attempt that streamed, not the failed one', async () => {
    const failAfterMs = 200;
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'x',
      model: failOnceThenTextModel('Hello', failAfterMs) as any,
      maxRetries: 1,
    });
    const { wrapped } = buildMastra(testExporter, agent, 'durable');
    await runToCompletion(wrapped, 'hi', testExporter);

    const streamed = testExporter.getSpansByType('model_inference' as any).filter(span => clockOf(span) !== undefined);
    expect(streamed).toHaveLength(1);
    const inference = streamed[0] as any;
    for (const type of ['model_generation', 'agent_run']) {
      // The failed attempt ends its rebuilt generation too, so read the run's last end.
      const { events } = testExporter.getBySpanId(idOf(testExporter.getSpansByType(type as any)[0]));
      const ended = events.findLast(e => e.type === 'span_ended')!.exportedSpan as any;
      expect(inferenceClockOf(ended)).toBe(startOf(inference));
      expect(ended.timeToFirstTokenMs).toBe(clockOf(inference)! - startOf(inference));
      expect(ended.timeToFirstTokenMs).toBeLessThan(failAfterMs);
      const clocks = events.map(e => inferenceClockOf((e as any).exportedSpan)).filter(c => c !== undefined);
      expect(new Set(clocks)).toEqual(new Set([startOf(inference)]));
    }
  });

  // Not at parity yet: the in-process Agent retries inside the AI SDK call (p-retry in
  // execute()), so one MODEL_INFERENCE covers the failed attempt and the backoff, and its
  // time to first token includes both. DurableAgent owns its retry loop and opens one
  // inference per attempt.
  it.fails('Agent retry: time to first token counts from the attempt that streamed, as on DurableAgent', async () => {
    const failAfterMs = 200;
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'x',
      model: failOnceThenTextModel('Hello', failAfterMs) as any,
      maxRetries: 1,
    });
    const { wrapped } = buildMastra(testExporter, agent, 'plain');
    await (await wrapped.stream('hi')).consumeStream();
    await settle(testExporter);

    const agentRun = testExporter.getSpansByType('agent_run' as any)[0] as any;
    expect(agentRun.timeToFirstTokenMs).toBeLessThan(failAfterMs);
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

  it('DurableAgent output stream processors: PROCESSOR_RUN spans parent under AGENT_RUN, never orphan roots', async () => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'x',
      model: textModel('Hello') as any,
      outputProcessors: [new PassThroughStreamProcessor('stream-a'), new PassThroughStreamProcessor('stream-b')],
    });
    const { wrapped } = buildMastra(testExporter, agent, 'durable');
    await runToCompletion(wrapped, 'hi', testExporter);

    // one trace, and the agent_run is the only span without a parentSpanId —
    // processor spans must not export as extra root rows (stores label the
    // trace by its latest parentless row)
    expect(testExporter.getTraceIds()).toHaveLength(1);
    const agentRuns = testExporter.getSpansByType('agent_run' as any);
    expect(agentRuns).toHaveLength(1);
    const parentless = testExporter.getAllSpans().filter((s: any) => !s.parentSpanId);
    expect(parentless.map(idOf)).toEqual([idOf(agentRuns[0])]);

    const processorSpans = testExporter
      .getAllSpans()
      .filter((s: any) => typeof s.name === 'string' && s.name.startsWith('output stream processor:'));
    expect(processorSpans.map((s: any) => s.name).sort()).toEqual([
      'output stream processor: stream-a',
      'output stream processor: stream-b',
    ]);
    for (const span of processorSpans) {
      expect(parentOf(span)).toBe(idOf(agentRuns[0]));
      expect((span as any).traceId).toBe((agentRuns[0] as any).traceId);
    }
    expect(testExporter.getIncompleteSpans()).toHaveLength(0);
  });

  it('DurableAgent output stream processors honour a declared span type', async () => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'x',
      model: textModel('Hello') as any,
      outputProcessors: [new DeclaringStreamProcessor()],
    });
    const { wrapped } = buildMastra(testExporter, agent, 'durable');
    await runToCompletion(wrapped, 'hi', testExporter);

    const declared = testExporter.getAllSpans().filter((s: any) => s.name === 'memory: stream');
    expect(declared.length).toBeGreaterThan(0);
    for (const span of declared) {
      expect((span as any).type).toBe(SpanType.MEMORY_OPERATION);
      expect((span as any).attributes?.operationType).toBe('recall');
      expect((span as any).entityId).toBe('declaring-stream');
      // The executor's own pipeline facts still survive the retyping. These
      // spans come from the processor workflow, so the executor reads
      // 'workflow'; the legacy ProcessorState path is covered by a unit test
      // in @mastra/core, since no agent-level run reaches it.
      expect((span as any).attributes?.processorExecutor).toBe('workflow');
    }

    // The default label must be gone, not merely supplemented.
    const defaults = testExporter
      .getAllSpans()
      .filter((s: any) => typeof s.name === 'string' && s.name.startsWith('output stream processor:'));
    expect(defaults).toHaveLength(0);
    expect(testExporter.getIncompleteSpans()).toHaveLength(0);
  });

  it('DurableAgent tool call with output stream processors: every PROCESSOR_RUN span has a parent on the agent trace', async () => {
    const agent = new Agent({
      id: 'a',
      name: 'a',
      instructions: 'use the tool',
      model: toolThenTextModel('get_weather', { city: 'Paris' }, 'It is 21C in Paris.') as any,
      tools: { get_weather: weatherTool },
      outputProcessors: [new PassThroughStreamProcessor('stream-a')],
    });
    const { wrapped } = buildMastra(testExporter, agent, 'durable');
    await runToCompletion(wrapped, 'weather in paris?', testExporter);

    expect(testExporter.getTraceIds()).toHaveLength(1);
    const agentRuns = testExporter.getSpansByType('agent_run' as any);
    expect(agentRuns).toHaveLength(1);
    const parentless = testExporter.getAllSpans().filter((s: any) => !s.parentSpanId);
    expect(parentless.map(idOf)).toEqual([idOf(agentRuns[0])]);

    // the tool-call step runs the same processors through its own state map, so
    // more than one span per processor may exist — all must be parented on this trace
    const processorSpans = testExporter
      .getAllSpans()
      .filter((s: any) => typeof s.name === 'string' && s.name.startsWith('output stream processor:'));
    expect(processorSpans.length).toBeGreaterThanOrEqual(1);
    for (const span of processorSpans) {
      expect(parentOf(span)).toBe(idOf(agentRuns[0]));
      expect((span as any).traceId).toBe((agentRuns[0] as any).traceId);
    }
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

  // Deferred step closes used to copy the raw provider usage onto model_step, so
  // inputDetails.cacheRead was missing and cache dashboards showed 0% for these engines.
  it.each(['durable', 'evented'] as const)(
    '%s agent: every model_step reports prompt-cache reads the same way as the regular agent',
    async variant => {
      const agent = new Agent({
        id: 'a',
        name: 'a',
        instructions: 'use the tool',
        model: cachedToolThenTextModel() as any,
        tools: { get_weather: weatherTool },
      });
      const { wrapped } = buildMastra(testExporter, agent, variant);
      await runToCompletion(wrapped, 'weather in paris?', testExporter);

      const steps = byStart(testExporter.getSpansByType('model_step' as any));
      expect(steps).toHaveLength(2);
      for (const step of steps) {
        expect((step as any).attributes?.usage).toEqual({
          inputTokens: 1000,
          outputTokens: 10,
          inputDetails: { cacheRead: 900, text: 100 },
          outputDetails: { text: 10 },
        });
      }
    },
  );
});
