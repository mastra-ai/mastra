/**
 * Dual-export integration test: OtelBridge + DefaultExporter
 *
 * Reproduces the user-reported issue where configuring both an OtelBridge
 * and a DefaultExporter causes neither system to produce output.
 *
 * Tests the exact config pattern:
 *   new Observability({
 *     configs: {
 *       default: {
 *         sampling: { type: SamplingStrategyType.ALWAYS },
 *         serviceName: "engine-manager",
 *         bridge: new OtelBridge(),
 *         exporters: [new DefaultExporter()]
 *       }
 *     }
 *   });
 */

import { Mastra } from '@mastra/core/mastra';
import { SpanType } from '@mastra/core/observability';
import { MockStore } from '@mastra/core/storage';
import { Observability, DefaultExporter, SamplingStrategyType } from '@mastra/observability';
import { trace as otelTrace } from '@opentelemetry/api';
import { BasicTracerProvider, SimpleSpanProcessor, InMemorySpanExporter } from '@opentelemetry/sdk-trace-base';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { OtelBridge } from './bridge.js';

function registerTracerProvider() {
  const exporter = new InMemorySpanExporter();
  const provider = new BasicTracerProvider({
    spanProcessors: [new SimpleSpanProcessor(exporter)],
  });
  otelTrace.setGlobalTracerProvider(provider);
  return {
    otelExporter: exporter,
    cleanup: async () => {
      await provider.shutdown();
      otelTrace.disable();
    },
  };
}

describe('Dual Export: OtelBridge + DefaultExporter', () => {
  let otelExporter: InMemorySpanExporter;
  let cleanup: () => Promise<void>;

  beforeEach(() => {
    const tp = registerTracerProvider();
    otelExporter = tp.otelExporter;
    cleanup = tp.cleanup;
  });

  afterEach(async () => {
    await cleanup();
  });

  it('should export spans to both OTEL and storage when both bridge and DefaultExporter are configured', async () => {
    const bridge = new OtelBridge();
    const defaultExporter = new DefaultExporter();

    const observability = new Observability({
      configs: {
        default: {
          sampling: { type: SamplingStrategyType.ALWAYS },
          serviceName: 'engine-manager',
          bridge,
          exporters: [defaultExporter],
        },
      },
    });

    const storage = new MockStore();
    const mastra = new Mastra({
      storage,
      observability,
    });

    // Get the observability instance and create spans
    const instance = observability.getDefaultInstance()!;
    expect(instance).toBeDefined();

    // Create a root span
    const rootSpan = instance.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'test-agent-run',
      attributes: { agentId: 'test-agent' },
    });

    expect(rootSpan.isValid).toBe(true);
    expect(rootSpan.id).toBeDefined();
    expect(rootSpan.traceId).toBeDefined();

    // Verify span IDs are NOT all zeros (the noop tracer bug)
    expect(rootSpan.id).not.toBe('0000000000000000');
    expect(rootSpan.traceId).not.toBe('00000000000000000000000000000000');

    // Create a child span
    const childSpan = rootSpan.createChildSpan({
      type: SpanType.TOOL_CALL,
      name: 'test-tool',
      attributes: { toolId: 'calculator', success: true },
    });

    expect(childSpan.isValid).toBe(true);
    expect(childSpan.id).not.toBe(rootSpan.id); // Unique IDs

    // End spans (child first, then parent)
    childSpan.end({ output: { result: 42 } });
    rootSpan.end({ output: { text: 'done' } });

    // Flush the observability system to ensure all events are exported
    await instance.flush();

    // === Check OTEL output ===
    const otelSpans = otelExporter.getFinishedSpans();
    expect(otelSpans.length).toBe(2);

    // === Check DefaultExporter output (storage) ===
    // DefaultExporter writes to observability storage via batch operations.
    const observabilityStorage = await storage.getStore('observability');
    expect(observabilityStorage).toBeDefined();

    const trace = await observabilityStorage!.getTrace({ traceId: rootSpan.traceId });
    expect(trace).not.toBeNull();
    expect(trace!.spans.length).toBe(2);

    // Verify span details in storage
    const storedRoot = trace!.spans.find(s => s.spanId === rootSpan.id);
    const storedChild = trace!.spans.find(s => s.spanId === childSpan.id);
    expect(storedRoot).toBeDefined();
    expect(storedChild).toBeDefined();
    expect(storedRoot!.name).toBe('test-agent-run');
    expect(storedChild!.name).toBe('test-tool');

    await mastra.shutdown();
  });

  it('should produce unique span IDs when bridge is present', async () => {
    const bridge = new OtelBridge();
    const defaultExporter = new DefaultExporter();

    const observability = new Observability({
      configs: {
        default: {
          sampling: { type: SamplingStrategyType.ALWAYS },
          serviceName: 'engine-manager',
          bridge,
          exporters: [defaultExporter],
        },
      },
    });

    const storage = new MockStore();
    const mastra = new Mastra({
      storage,
      observability,
    });

    const instance = observability.getDefaultInstance()!;

    // Create multiple root spans
    const span1 = instance.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent-1',
      attributes: { agentId: 'a1' },
    });
    const span2 = instance.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'agent-2',
      attributes: { agentId: 'a2' },
    });

    // All spans must have unique IDs — if the bridge returns all-zeros
    // from a noop tracer, this would fail
    expect(span1.id).not.toBe(span2.id);
    expect(span1.traceId).not.toBe(span2.traceId);

    span1.end();
    span2.end();

    await instance.flush();
    await mastra.shutdown();
  });

  it('should work when TracerProvider is registered after bridge creation', async () => {
    // Disable any existing provider first
    otelTrace.disable();

    // Create bridge BEFORE registering the TracerProvider
    // (simulates apps where OTEL SDK init is in a different module)
    const bridge = new OtelBridge();
    const defaultExporter = new DefaultExporter();

    const observability = new Observability({
      configs: {
        default: {
          sampling: { type: SamplingStrategyType.ALWAYS },
          serviceName: 'late-provider-test',
          bridge,
          exporters: [defaultExporter],
        },
      },
    });

    const storage = new MockStore();
    const mastra = new Mastra({
      storage,
      observability,
    });

    // NOW register the TracerProvider (late registration)
    const lateExporter = new InMemorySpanExporter();
    const lateProvider = new BasicTracerProvider({
      spanProcessors: [new SimpleSpanProcessor(lateExporter)],
    });
    otelTrace.setGlobalTracerProvider(lateProvider);

    const instance = observability.getDefaultInstance()!;

    const span = instance.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'late-provider-agent',
      attributes: { agentId: 'late' },
    });

    expect(span.isValid).toBe(true);
    expect(span.id).not.toBe('0000000000000000');

    span.end({ output: { text: 'ok' } });
    await instance.flush();

    // OTEL should get spans via the late-registered provider
    const otelSpans = lateExporter.getFinishedSpans();
    expect(otelSpans.length).toBe(1);

    // DefaultExporter should also work
    const observabilityStorage = await storage.getStore('observability');
    const trace = await observabilityStorage!.getTrace({ traceId: span.traceId });
    expect(trace).not.toBeNull();

    await mastra.shutdown();
    await lateProvider.shutdown();
  });

  it('should work correctly when bridge returns undefined (noop tracer fallback)', async () => {
    // Disable the global provider to simulate noop tracer
    otelTrace.disable();

    const bridge = new OtelBridge();
    const defaultExporter = new DefaultExporter();

    const observability = new Observability({
      configs: {
        default: {
          sampling: { type: SamplingStrategyType.ALWAYS },
          serviceName: 'engine-manager',
          bridge,
          exporters: [defaultExporter],
        },
      },
    });

    const storage = new MockStore();
    const mastra = new Mastra({
      storage,
      observability,
    });

    const instance = observability.getDefaultInstance()!;

    // With no TracerProvider, the bridge should return undefined
    // and DefaultSpan should generate its own IDs
    const span = instance.startSpan({
      type: SpanType.AGENT_RUN,
      name: 'fallback-test',
      attributes: { agentId: 'test' },
    });

    expect(span.isValid).toBe(true);
    // IDs should be valid (not all zeros)
    expect(span.id).not.toBe('0000000000000000');
    expect(span.traceId).not.toBe('00000000000000000000000000000000');
    expect(span.id).toMatch(/^[0-9a-f]{16}$/);

    span.end({ output: { text: 'ok' } });
    await instance.flush();

    // DefaultExporter should still work
    const observabilityStorage = await storage.getStore('observability');
    const trace = await observabilityStorage!.getTrace({ traceId: span.traceId });
    expect(trace).not.toBeNull();
    expect(trace!.spans.length).toBe(1);

    await mastra.shutdown();
  });
});
