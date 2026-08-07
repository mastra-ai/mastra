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
 * filtering, input-wrapper unwrapping, and MCP tool kind mapping.
 */

/// <reference types="node" />

import { createRequire } from 'node:module';
import type { AnyExportedSpan, TracingEvent } from '@mastra/core/observability';
import { SpanType, TracingEventType } from '@mastra/core/observability';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { __setObservabilityFeaturesForTest } from './features';
import type { DatadogExporter } from './tracing';

const require = createRequire(import.meta.url);

// The real dd-trace span writer, reached via the package's own internal path.
// This is intentionally an internal path: it lets us capture dd-trace's own
// formatted, spec-compliant event. If a dd-trace upgrade moves this module, this
// require throws — update the path to match the new internals.
const SPAN_WRITER_PATH = 'dd-trace/packages/dd-trace/src/llmobs/writers/spans.js';
let SpanWriter: any;
try {
  SpanWriter = require(SPAN_WRITER_PATH);
} catch (e) {
  throw new Error(
    `Could not load dd-trace's LLMObs span writer at "${SPAN_WRITER_PATH}". ` +
      `dd-trace likely moved this internal module; update SPAN_WRITER_PATH in compliance.test.ts. ` +
      `Original error: ${(e as Error).message}`,
  );
}

/** Compliant LLM-Obs span events captured straight out of dd-trace's formatter. */
let captured: any[] = [];
let origAppend: any;
let origFlush: any;

// A single shared exporter for the whole file. The exporter enables dd-trace's
// global LLMObs span processor lazily and `shutdown()` would `disable()` it —
// tearing it down for every later test — so we create it once and never shut it
// down between tests.
let exporter: DatadogExporter;

beforeAll(async () => {
  origAppend = SpanWriter.prototype.append;
  origFlush = SpanWriter.prototype.flush;
  // Capture the formatted, spec-compliant event and skip all network I/O.
  SpanWriter.prototype.append = function (event: any) {
    captured.push(event);
    return true;
  };
  SpanWriter.prototype.flush = function () {};

  __setObservabilityFeaturesForTest(new Set(['model-inference-span']));
  const { DatadogExporter } = await import('./tracing');
  exporter = new DatadogExporter({ mlApp: 'compliance', apiKey: 'fake-key', agentless: true });
});

afterAll(() => {
  SpanWriter.prototype.append = origAppend;
  SpanWriter.prototype.flush = origFlush;
});

beforeEach(() => {
  captured = [];
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
