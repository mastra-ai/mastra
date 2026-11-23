/**
 * Datadog LLM-Observability COMPLIANCE test (no cloud).
 *
 * Unlike the other suites, this file uses the REAL `dd-trace` SDK — not a mock.
 * It drives the real `DatadogExporter` end-to-end and intercepts dd-trace's own
 * span writer (`LLMObsSpanWriter.append`) to capture the exact wire event that
 * dd-trace produces from our annotations. That event is built by dd-trace's
 * authoritative `LLMObsSpanProcessor.format()`, so asserting on it verifies our
 * payloads are *Datadog-spec compliant* (correct `meta.span.kind`, `model_name`,
 * `meta.metadata`, `meta.input/output.messages`, `tool_calls`, …) without ever
 * calling Datadog's cloud.
 *
 * The writer's network flush is neutralized, so nothing leaves the machine.
 *
 * Each case covers a specific span-mapping behavior: span-kind mapping, model
 * parameters in metadata, tool calls in input/output messages, blank-message
 * filtering, input-wrapper unwrapping, and MCP tool kind mapping. The feedback
 * cases intercept dd-trace's evaluation writer (`LLMObsEvalMetricsWriter.append`)
 * the same way.
 */

/// <reference types="node" />

import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import type { AnyExportedSpan, ExportedFeedback, TracingEvent } from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { DatadogBridge } from './bridge';
import { __setObservabilityFeaturesForTest } from './features';
import type { DatadogExporter } from './tracing';

const require = createRequire(import.meta.url);

// The real dd-trace span writer, reached via the package's own internal path.
// This is intentionally an internal path: it lets us capture dd-trace's own
// formatted, spec-compliant event. If a dd-trace upgrade moves this module, this
// require throws — update the path to match the new internals.
const SPAN_WRITER_PATH = 'dd-trace/packages/dd-trace/src/llmobs/writers/spans.js';
const EVAL_WRITER_PATH = 'dd-trace/packages/dd-trace/src/llmobs/writers/evaluations.js';
let SpanWriter: any;
let EvalWriter: any;
try {
  SpanWriter = require(SPAN_WRITER_PATH);
  EvalWriter = require(EVAL_WRITER_PATH);
} catch (e) {
  throw new Error(
    `Could not load dd-trace's LLMObs span writer at "${SPAN_WRITER_PATH}". ` +
      `dd-trace likely moved this internal module; update SPAN_WRITER_PATH in compliance.test.ts. ` +
      `Original error: ${(e as Error).message}`,
  );
}

/** Compliant LLM-Obs span events captured straight out of dd-trace's formatter. */
let captured: any[] = [];
let capturedFeedback: any[] = [];
let origAppend: any;
let origFlush: any;
let origEvalAppend: any;
let origEvalFlush: any;

// A single shared exporter for the whole file. The exporter enables dd-trace's
// global LLMObs span processor lazily and `shutdown()` would `disable()` it —
// tearing it down for every later test — so we create it once and never shut it
// down between tests.
let exporter: DatadogExporter | undefined;

beforeAll(async () => {
  origAppend = SpanWriter.prototype.append;
  origFlush = SpanWriter.prototype.flush;
  // Capture the formatted, spec-compliant event and skip all network I/O.
  SpanWriter.prototype.append = function (event: any) {
    captured.push(event);
    return true;
  };
  SpanWriter.prototype.flush = function () {};
  origEvalAppend = EvalWriter.prototype.append;
  origEvalFlush = EvalWriter.prototype.flush;
  EvalWriter.prototype.append = function (event: any) {
    capturedFeedback.push(event);
    return true;
  };
  EvalWriter.prototype.flush = function () {};

  __setObservabilityFeaturesForTest(new Set(['model-inference-span']));
  const { DatadogExporter } = await import('./tracing');
  exporter = new DatadogExporter({ mlApp: 'compliance', apiKey: 'fake-key', agentless: true });
  // dd-trace is a large module and this is its first load in the worker, so a
  // cold, contended CI runner can take much longer than the default hook
  // timeout to resolve the import above.
}, 60_000);

afterAll(async () => {
  // The prototype patches are process-wide: restore them even if setup failed
  // part-way or shutdown throws, or every later file sharing this worker
  // inherits our append/flush stubs. Guarding the exporter also keeps a failed
  // `beforeAll` visible instead of masking it with a teardown TypeError.
  try {
    await exporter?.shutdown();
  } finally {
    SpanWriter.prototype.append = origAppend;
    SpanWriter.prototype.flush = origFlush;
    EvalWriter.prototype.append = origEvalAppend;
    EvalWriter.prototype.flush = origEvalFlush;
  }
});

beforeEach(() => {
  captured = [];
  capturedFeedback = [];
  __setObservabilityFeaturesForTest(new Set(['model-inference-span']));
});

let spanCounter = 0;

function makeSpan(overrides: Partial<AnyExportedSpan> = {}): AnyExportedSpan {
  const now = Date.now();
  // Unique IDs per span so per-trace buffers in the shared exporter never collide.
  const n = ++spanCounter;
  return {
    id: `span-${n}`,
    traceId: `trace-${n}`,
    name: 'test-span',
    type: SpanType.GENERIC,
    startTime: new Date(now - 100),
    endTime: new Date(now),
    isEvent: false,
    isRootSpan: true,
    ...overrides,
  } as AnyExportedSpan;
}

function ended(span: AnyExportedSpan): TracingEvent {
  return { type: TracingEventType.SPAN_ENDED, exportedSpan: span } as TracingEvent;
}

/** Runs a single span through the real exporter + dd-trace and returns the compliant event. */
async function emit(span: AnyExportedSpan): Promise<any> {
  if (!exporter) throw new Error('Exporter was never constructed — beforeAll failed.');
  await exporter.exportTracingEvent(ended(span));
  expect(captured.length).toBeGreaterThan(0);
  return captured[captured.length - 1];
}

describe('Datadog compliance — payloads validated by the real dd-trace formatter', () => {
  // MODEL_INFERENCE maps to an `llm`-kind span with the standard top-level
  // Datadog LLM-Obs fields.
  it('emits a spec-compliant llm-kind event for MODEL_INFERENCE', async () => {
    const e = await emit(
      makeSpan({
        type: SpanType.MODEL_INFERENCE,
        name: 'llm gpt-5-mini',
        attributes: { model: 'gpt-5-mini', provider: 'openai' } as any,
        input: { messages: [{ role: 'user', content: 'hi' }] },
        output: 'hello there',
      }),
    );

    // Top-level wire shape Datadog requires.
    expect(e).toMatchObject({
      name: 'llm gpt-5-mini',
      status: 'ok',
      meta: { 'span.kind': 'llm', model_name: 'gpt-5-mini', model_provider: 'openai' },
    });
    expect(typeof e.trace_id).toBe('string');
    expect(typeof e.span_id).toBe('string');
    expect(typeof e.start_ns).toBe('number');
    expect(typeof e.duration).toBe('number');
    expect(Array.isArray(e.tags)).toBe(true);
    // dd-trace normalizes string output into an assistant message under meta.output.
    expect(e.meta.output.messages).toEqual([{ role: 'assistant', content: 'hello there' }]);
  });

  // Model request options reach Datadog. The compliant location is meta.metadata
  // — Datadog has no dedicated request-params field, so nesting under metadata is
  // the correct shape.
  //
  // These mirror how core stamps the MODEL_INFERENCE span: `parameters` carries
  // generic call settings (temperature, maxOutputTokens, …) while provider-specific
  // options like OpenAI's reasoningEffort live under `providerOptions.<provider>`.
  it('forwards model parameters and providerOptions to meta.metadata', async () => {
    const e = await emit(
      makeSpan({
        type: SpanType.MODEL_INFERENCE,
        name: 'llm with params',
        attributes: {
          model: 'gpt-5-mini',
          provider: 'openai',
          availableTools: ['getWeather'],
          toolChoice: 'auto',
          parameters: { temperature: 0.2, maxOutputTokens: 1024 },
          providerOptions: { openai: { reasoningEffort: 'high' } },
        } as any,
        input: { messages: [{ role: 'user', content: 'hi' }] },
      }),
    );

    expect(e.meta.metadata.parameters).toEqual({ temperature: 0.2, maxOutputTokens: 1024 });
    expect(e.meta.metadata.providerOptions).toEqual({ openai: { reasoningEffort: 'high' } });
    expect(e.meta.metadata.availableTools).toEqual(['getWeather']);
    expect(e.meta.metadata.toolChoice).toBe('auto');
  });

  // Tool calls and tool results survive in the LLM input messages.
  it('preserves tool-call and tool-result messages in meta.input', async () => {
    const e = await emit(
      makeSpan({
        type: SpanType.MODEL_INFERENCE,
        name: 'llm tool history',
        attributes: { model: 'gpt-5-mini', provider: 'openai' } as any,
        input: {
          messages: [
            { role: 'user', content: 'weather?' },
            {
              role: 'assistant',
              content: '',
              toolCalls: [{ toolName: 'getWeather', toolCallId: 'call_1', args: { city: 'NYC' } }],
            },
            { role: 'tool', content: [{ type: 'tool-result', toolName: 'getWeather', result: { tempF: 70 } }] },
          ],
        },
      }),
    );

    const msgs = e.meta.input.messages;
    const assistant = msgs.find((m: any) => m.role === 'assistant');
    // dd-trace emits tool calls under `tool_calls`. The call must be populated —
    // a raw Mastra shape would be dropped to an empty object by dd-trace's tagger.
    expect(assistant.tool_calls).toHaveLength(1);
    expect(assistant.tool_calls[0]).toMatchObject({ name: 'getWeather', tool_id: 'call_1' });
    const tool = msgs.find((m: any) => m.role === 'tool');
    expect(JSON.stringify(tool)).toContain('getWeather');
  });

  // A tool call in the output renders as a Datadog tool-call block, not escaped
  // JSON. dd-trace emits these under message.tool_calls.
  it('renders output tool calls as a Datadog tool-call block', async () => {
    const e = await emit(
      makeSpan({
        type: SpanType.MODEL_INFERENCE,
        name: 'llm tool output',
        attributes: { model: 'gpt-5-mini', provider: 'openai' } as any,
        input: { messages: [{ role: 'user', content: 'weather?' }] },
        output: {
          text: '',
          toolCalls: [{ toolName: 'getWeather', toolCallId: 'call_1', args: { city: 'NYC' } }],
        },
      }),
    );

    const out = e.meta.output.messages[0];
    expect(out.tool_calls).toHaveLength(1);
    expect(out.tool_calls[0]).toMatchObject({ name: 'getWeather', tool_id: 'call_1', type: 'function' });
  });

  // Empty user messages are dropped before they reach Datadog.
  it('drops blank user messages from meta.input', async () => {
    const e = await emit(
      makeSpan({
        type: SpanType.MODEL_INFERENCE,
        name: 'llm blank filter',
        attributes: { model: 'gpt-5-mini', provider: 'openai' } as any,
        input: {
          messages: [
            { role: 'system', content: 'be helpful' },
            { role: 'user', content: '' },
            { role: 'user', content: '   ' },
            { role: 'user', content: 'real question' },
          ],
        },
      }),
    );

    const users = e.meta.input.messages.filter((m: any) => m.role === 'user');
    expect(users).toHaveLength(1);
    expect(users[0].content).toBe('real question');
  });

  // A Mastra { messages } wrapper is unwrapped, not double-encoded into a single
  // stringified user message.
  it('unwraps a { messages } input wrapper', async () => {
    const e = await emit(
      makeSpan({
        type: SpanType.MODEL_GENERATION,
        name: 'llm: gpt-5-mini',
        attributes: { model: 'gpt-5-mini', provider: 'openai' } as any,
        input: { messages: [{ role: 'user', content: 'hello' }], schema: { type: 'object' } },
      }),
    );

    // MODEL_GENERATION maps to a `workflow` kind, so dd-trace serializes input
    // under meta.input.value rather than meta.input.messages. The { messages,
    // schema } wrapper must be UNWRAPPED to the message array, not buried or
    // double-encoded with the schema.
    const value = e.meta.input.value;
    expect(value).toContain('hello');
    expect(value).not.toContain('schema');
  });

  // MCP tool spans carry the correct LLM-Obs kind.
  it('maps MCP_TOOL_CALL → tool kind', async () => {
    const e = await emit(
      makeSpan({
        type: SpanType.MCP_TOOL_CALL,
        name: 'mcp getWeather',
        attributes: { mcpServer: 'weather-mcp' } as any,
        input: { city: 'NYC' },
        output: { tempF: 70 },
      }),
    );
    expect(e.meta['span.kind']).toBe('tool');
  });
});

describe('Datadog compliance — feedback reaches the trace of the run it rates', () => {
  const hexId = (bytes: number) => randomBytes(bytes).toString('hex');

  function thumbsDown(traceId: string, spanId?: string): { type: 'feedback'; feedback: ExportedFeedback } {
    return {
      type: 'feedback',
      feedback: {
        feedbackId: 'feedback-1',
        timestamp: new Date(),
        traceId,
        spanId,
        feedbackSource: 'user',
        feedbackType: 'thumbs',
        value: 'down',
        comment: 'Wrong answer',
        feedbackUserId: 'user-1',
      },
    };
  }

  it('sends late feedback to the Datadog span or trace with the Mastra IDs', async () => {
    const traceId = hexId(16);
    const spanId = hexId(8);
    const run = await emit(makeSpan({ id: spanId, traceId, type: SpanType.AGENT_RUN, name: 'agent run' }));
    expect(run.trace_id).toBe(traceId);

    const { DatadogExporter } = await import('./tracing');
    const restartedExporter = new DatadogExporter({ mlApp: 'compliance', apiKey: 'fake-key', agentless: true });
    await restartedExporter.onFeedbackEvent(thumbsDown(traceId, spanId));

    expect(capturedFeedback).toHaveLength(1);
    expect(capturedFeedback[0]).toMatchObject({
      event_kind: 'feedback',
      span_id: run.span_id,
      label: 'thumbs',
      metric_type: 'categorical',
      categorical_value: 'down',
      reasoning: 'Wrong answer',
      submitter: { id: 'user-1', type: 'user' },
      ml_app: 'compliance',
    });
    expect(capturedFeedback[0].tags).toContain('feedback_source:user');

    // Studio sends comments as `feedbackType: 'comment'` with the text as the value.
    // A caller that is not signed in sends `feedbackUserId: null`, and the
    // metadata copied from the rated span names the user of the run.
    await restartedExporter.onFeedbackEvent({
      type: 'feedback',
      feedback: {
        ...thumbsDown(traceId).feedback,
        feedbackType: 'comment',
        value: 'Cite a source',
        comment: undefined,
        feedbackUserId: null,
        metadata: { userId: 'run-user' },
      },
    });
    expect(capturedFeedback[1]).toMatchObject({
      metric_type: 'text',
      text_value: 'Cite a source',
      trace_id: traceId,
      submitter: { id: 'anonymous' },
    });

    // dd-trace rejects a feedback label that contains a dot.
    await restartedExporter.onFeedbackEvent({
      type: 'feedback',
      feedback: { ...thumbsDown(traceId).feedback, feedbackType: 'quality.rating', value: 4 },
    });
    expect(capturedFeedback[2]).toMatchObject({ label: 'quality_rating', score_value: 4, trace_id: traceId });
  });

  it('keeps Mastra trace IDs that dd-trace could read differently', async () => {
    // dd-trace reads an ID of only digits as a decimal number, and the Datadog
    // agent drops a span whose 64-bit APM trace ID is 0.
    for (const traceId of ['12345678901234567890123456789012', 'abcdefabcdefabcd0000000000000000']) {
      const run = await emit(makeSpan({ traceId, type: SpanType.AGENT_RUN }));
      expect(run.trace_id).toBe(traceId);
      expect(run._dd.apm_trace_id).not.toMatch(/0{16}$/);
    }

    const tracer = (await import('dd-trace')).default;
    const traceId = '98765432109876543210987654321098';
    const run = await tracer.trace('web.request', () => emit(makeSpan({ traceId, type: SpanType.AGENT_RUN })));
    expect(run.trace_id).toBe(traceId);
  });

  it('keeps the Mastra trace ID when the app extracts only W3C trace headers', async () => {
    const tracer = (await import('dd-trace')).default;
    const styles = (tracer as any)._tracer._config.tracePropagationStyle;
    const extract = styles.extract;
    styles.extract = ['tracecontext'];
    try {
      const traceId = hexId(16);
      expect((await emit(makeSpan({ traceId, type: SpanType.AGENT_RUN }))).trace_id).toBe(traceId);
    } finally {
      styles.extract = extract;
    }
  });

  it('keeps the Mastra trace ID when the app restarts or ignores extracted traces', async () => {
    const config = ((await import('dd-trace')).default as any)._tracer._config;
    const behavior = config.DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT;
    try {
      for (const value of ['restart', 'ignore']) {
        config.DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT = value;
        const traceId = hexId(16);
        expect((await emit(makeSpan({ traceId, type: SpanType.AGENT_RUN }))).trace_id).toBe(traceId);
      }
    } finally {
      config.DD_TRACE_PROPAGATION_BEHAVIOR_EXTRACT = behavior;
    }
  });

  it("keeps each run inside the app's APM trace with its own trace ID", async () => {
    const tracer = (await import('dd-trace')).default;
    const traceId = hexId(16);
    const secondTraceId = hexId(16);
    let appApmTraceId: string | undefined;
    let requestChunkSpanIds: string[] = [];
    let requestTraceTags: Record<string, string> = {};

    await tracer.trace('web.request', async request => {
      appApmTraceId = request.context().toTraceId(true);
      await emit(makeSpan({ id: hexId(8), traceId, type: SpanType.AGENT_RUN, name: 'agent run' }));
      await emit(makeSpan({ traceId: secondTraceId, type: SpanType.AGENT_RUN, name: 'second agent run' }));
      // Spans sent to Datadog APM in the same chunk as the request. A run sent in a
      // chunk of its own shows up in APM as a new service entry span.
      requestChunkSpanIds = (request.context() as any)._trace.started.map((span: any) => span.context().toSpanId());
      requestTraceTags = (request.context() as any)._trace.tags;
    });

    const [run, secondRun] = captured;
    expect(run.trace_id).toBe(traceId);
    expect(secondRun.trace_id).toBe(secondTraceId);
    expect(run._dd.apm_trace_id).toBe(appApmTraceId);
    expect(requestChunkSpanIds).toContain(run.span_id);
    // Datadog joins OpenTelemetry `gen_ai` spans of the request under this span.
    expect(requestTraceTags.llmobs_parent_id).toBe(run.span_id);
  });

  it('sends a late score to the span with the Mastra span ID', async () => {
    const traceId = hexId(16);
    const spanId = hexId(8);
    const run = await emit(makeSpan({ id: spanId, traceId, type: SpanType.AGENT_RUN, name: 'agent run' }));
    expect(run.span_id).toBe(BigInt(`0x${spanId}`).toString(10));

    const { DatadogExporter } = await import('./tracing');
    const restartedExporter = new DatadogExporter({ mlApp: 'compliance', apiKey: 'fake-key', agentless: true });
    await restartedExporter.onScoreEvent({
      type: 'score',
      score: { scoreId: 'score-1', timestamp: new Date(), traceId, spanId, scorerId: 'accuracy', score: 0.4 },
    } as any);

    expect(capturedFeedback).toHaveLength(1);
    expect(capturedFeedback[0]).toMatchObject({
      join_on: { span: { span_id: run.span_id, trace_id: traceId } },
      label: 'accuracy',
      score_value: 0.4,
    });
  });

  it('sends the pass or fail assessment that the app sets on feedback', async () => {
    const { DatadogExporter } = await import('./tracing');
    const { DatadogBridge } = await import('./bridge');
    const config = { mlApp: 'compliance', apiKey: 'fake-key', agentless: true };

    for (const destination of [new DatadogExporter(config), new DatadogBridge(config)]) {
      capturedFeedback = [];
      for (const metadata of [
        { datadog: { assessment: 'pass' } },
        { datadog: { assessment: 'fail' } },
        // dd-trace rejects this value. The rating itself must still reach Datadog.
        { datadog: { assessment: 'bad' } },
        // Feedback can inherit this from the run, so it is not the app's verdict.
        { assessment: 'pass' },
      ]) {
        await destination.onFeedbackEvent({
          type: 'feedback',
          feedback: { ...thumbsDown(hexId(16)).feedback, metadata },
        });
      }
      expect(capturedFeedback.map(feedback => [feedback.categorical_value, feedback.assessment])).toEqual([
        ['down', 'pass'],
        ['down', 'fail'],
        ['down', undefined],
        ['down', undefined],
      ]);
    }
  });

  it('sends bridge feedback to the Datadog trace with the Mastra trace ID', async () => {
    const { DatadogBridge } = await import('./bridge');
    const bridge: DatadogBridge = new DatadogBridge({ mlApp: 'compliance', apiKey: 'fake-key', agentless: true });
    const ids = bridge.createSpan({ name: 'agent run', type: SpanType.AGENT_RUN } as any)!;

    // A tool's HTTP call to another service carries the run's LLM Observability trace ID.
    const tracer = (await import('dd-trace')).default;
    const headers = await bridge.executeInContext(ids.spanId, async () => {
      const carrier: Record<string, string> = {};
      tracer.inject(tracer.scope().active()!, 'text_map', carrier);
      return carrier;
    });
    expect(headers['x-datadog-tags']).toContain(`_dd.p.llmobs_trace_id=${ids.traceId}`);

    await bridge.exportTracingEvent(
      ended(makeSpan({ id: ids.spanId, traceId: ids.traceId, type: SpanType.AGENT_RUN, name: 'agent run' })),
    );
    expect(captured[captured.length - 1].trace_id).toBe(ids.traceId);

    await bridge.onFeedbackEvent(thumbsDown(ids.traceId));

    expect(capturedFeedback).toHaveLength(1);
    expect(capturedFeedback[0]).toMatchObject({ event_kind: 'feedback', trace_id: ids.traceId, label: 'thumbs' });
  });
});
