/**
 * Unit tests for OtelBridge
 *
 * Note: Full integration tests with real OTEL infrastructure are in
 * observability/_examples/agent-hub/src/integration.test.ts
 *
 * These unit tests focus on the bridge's core logic and API surface.
 */

import type { CreateSpanOptions, LogEvent } from '@mastra/core/observability';
import { InternalSpans, SamplingStrategyType, SpanType, TracingEventType } from '@mastra/core/observability';
import { DefaultObservabilityInstance } from '@mastra/observability';
import { context, isSpanContextValid, trace } from '@opentelemetry/api';
import { logs as otelLogs, SeverityNumber } from '@opentelemetry/api-logs';
import { InMemoryLogRecordExporter, LoggerProvider, SimpleLogRecordProcessor } from '@opentelemetry/sdk-logs';
import { node, tracing } from '@opentelemetry/sdk-node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OtelBridge } from './bridge.js';

// OTEL invalid (no-op) IDs, returned when no SDK / tracer provider is registered
const INVALID_SPAN_ID = '0000000000000000';
const INVALID_TRACE_ID = '00000000000000000000000000000000';

describe('OtelBridge', () => {
  // Register a real (in-memory) tracer provider for tests that need the bridge
  // to produce valid span contexts. Without this, the OTEL API falls back to a
  // no-op tracer whose spans carry all-zero IDs (see issue #15589 regression
  // tests below).
  let tracerProvider: tracing.BasicTracerProvider;
  let loggerProvider: LoggerProvider;
  let logExporter: InMemoryLogRecordExporter;

  beforeAll(() => {
    tracerProvider = new tracing.BasicTracerProvider();
    trace.setGlobalTracerProvider(tracerProvider);

    logExporter = new InMemoryLogRecordExporter();
    loggerProvider = new LoggerProvider({
      processors: [new SimpleLogRecordProcessor({ exporter: logExporter })],
    });
    otelLogs.setGlobalLoggerProvider(loggerProvider);
  });

  afterAll(async () => {
    await tracerProvider.shutdown();
    await loggerProvider.shutdown();
    trace.disable();
    otelLogs.disable();
  });

  describe('createSpan', () => {
    it('should return spanIds with valid format when creating root span', () => {
      const bridge = new OtelBridge();

      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      const result = bridge.createSpan(options);

      expect(result).toBeDefined();
      expect(result?.spanId).toBeDefined();
      expect(result?.traceId).toBeDefined();
      // OTEL span IDs are 16 hex chars, trace IDs are 32 hex chars
      expect(result?.spanId).toMatch(/^[0-9a-f]{16}$/);
      expect(result?.traceId).toMatch(/^[0-9a-f]{32}$/);
      // The all-zero IDs also match the hex regex above, so assert explicitly
      // that we got a valid (non-no-op) span context.
      expect(result?.spanId).not.toBe(INVALID_SPAN_ID);
      expect(result?.traceId).not.toBe(INVALID_TRACE_ID);

      bridge.shutdown();
    });

    it('preserves a resumed Mastra parent instead of treating it as external', async () => {
      const bridge = new OtelBridge();
      const tracing = new DefaultObservabilityInstance({
        serviceName: 'resume-parent',
        name: 'resume-parent-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        bridge,
      });

      const span = tracing.startSpan({
        type: SpanType.GENERIC,
        name: 'resumed-agent',
        parentSpanId: '1234567890abcdef',
      })!;

      expect(span.exportSpan().parentSpanId).toBe('1234567890abcdef');
      expect(span.exportSpan().externalParentSpanId).toBeUndefined();

      span.end();
      await tracing.flush();
      await bridge.shutdown();
    });

    describe('with an ambient OTel span active', () => {
      // The suite-level BasicTracerProvider has no context manager, so
      // context.with() is a no-op there. Register a NodeTracerProvider for
      // its AsyncLocalStorage context manager; the global tracer provider
      // set in beforeAll stays in place (first registration wins).
      let nodeProvider: InstanceType<typeof node.NodeTracerProvider>;

      beforeAll(() => {
        nodeProvider = new node.NodeTracerProvider();
        nodeProvider.register();
      });

      afterAll(async () => {
        context.disable();
        await nodeProvider.shutdown();
      });

      it('keeps a resumed Mastra parent instead of adopting the ambient span', async () => {
        const bridge = new OtelBridge();
        const instance = new DefaultObservabilityInstance({
          serviceName: 'resume-under-ambient',
          name: 'resume-under-ambient-instance',
          sampling: { type: SamplingStrategyType.ALWAYS },
          bridge,
        });

        const ambient = trace.getTracer('ambient').startSpan('ambient-request');
        const span = context.with(trace.setSpan(context.active(), ambient), () =>
          instance.startSpan({
            type: SpanType.GENERIC,
            name: 'resumed-run',
            parentSpanId: '1234567890abcdef',
          }),
        )!;
        ambient.end();

        const exported = span.exportSpan();
        expect(exported.parentSpanId).toBe('1234567890abcdef');
        expect(exported.parentSpanId).not.toBe(ambient.spanContext().spanId);
        expect(exported.externalParentSpanId).toBe(ambient.spanContext().spanId);

        span.end();
        await instance.flush();
        await bridge.shutdown();
      });

      it('reports an ambient parent as external on a bridged root', async () => {
        const bridge = new OtelBridge();
        const instance = new DefaultObservabilityInstance({
          serviceName: 'bridged-root',
          name: 'bridged-root-instance',
          sampling: { type: SamplingStrategyType.ALWAYS },
          bridge,
        });

        const ambient = trace.getTracer('ambient').startSpan('ambient-request');
        const span = context.with(trace.setSpan(context.active(), ambient), () =>
          instance.startSpan({
            type: SpanType.GENERIC,
            name: 'bridged-root-run',
          }),
        )!;
        ambient.end();

        const exported = span.exportSpan();
        expect(exported.parentSpanId).toBeUndefined();
        expect(exported.externalParentSpanId).toBe(ambient.spanContext().spanId);

        span.end();
        await instance.flush();
        await bridge.shutdown();
      });

      it('classifies a Mastra-created ambient span as an internal parent', async () => {
        // executeInContext runs code inside a Mastra span's OTel context. A
        // root created there inherits that span as its ambient parent — but
        // it IS in Mastra storage, so it must not be reported as external.
        const bridge = new OtelBridge();
        const instance = new DefaultObservabilityInstance({
          serviceName: 'nested-root',
          name: 'nested-root-instance',
          sampling: { type: SamplingStrategyType.ALWAYS },
          bridge,
        });

        const outerSpan = instance.startSpan({
          type: SpanType.GENERIC,
          name: 'outer-mastra-span',
        })!;

        const nestedRoot = bridge.executeInContextSync(outerSpan.id, () =>
          instance.startSpan({
            type: SpanType.GENERIC,
            name: 'nested-root-run',
          }),
        )!;

        const exported = nestedRoot.exportSpan();
        expect(exported.parentSpanId).toBe(outerSpan.id);
        expect(exported.externalParentSpanId).toBeUndefined();

        nestedRoot.end();
        outerSpan.end();
        await instance.flush();
        await bridge.shutdown();
      });
    });

    it('should handle errors gracefully and return undefined on failure', () => {
      const bridge = new OtelBridge();

      // Pass invalid options to trigger error path
      const result = bridge.createSpan(null as any);

      expect(result).toBeUndefined();

      bridge.shutdown();
    });

    // Regression tests for https://github.com/mastra-ai/mastra/issues/20771
    //
    // A workflow resumed after suspend restores traceId + parentSpanId from the
    // persisted snapshot, but the parent OTEL span ended when the run suspended
    // (possibly in another process) so it is not in the bridge's span map. The
    // bridge must parent the span under a remote span context built from the
    // persisted IDs instead of dropping them and starting a new trace.
    describe('when restoring a persisted trace context', () => {
      it('continues the persisted trace when the parent span is no longer live', () => {
        const bridge = new OtelBridge();

        const persistedTraceId = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
        const persistedParentSpanId = '1a2b3c4d5e6f7081';

        const result = bridge.createSpan({
          type: SpanType.WORKFLOW_RUN,
          name: 'workflow run (resumed)',
          attributes: {},
          traceId: persistedTraceId,
          parentSpanId: persistedParentSpanId,
        });

        expect(result?.traceId).toBe(persistedTraceId);
        expect(result?.parentSpanId).toBe(persistedParentSpanId);
        expect(result?.spanId).toMatch(/^[0-9a-f]{16}$/);
        expect(result?.spanId).not.toBe(persistedParentSpanId);

        bridge.shutdown();
      });

      it('prefers a live parent span over the persisted IDs', () => {
        const bridge = new OtelBridge();

        const parentIds = bridge.createSpan({
          type: SpanType.WORKFLOW_RUN,
          name: 'live parent',
          attributes: {},
        });
        expect(parentIds).toBeDefined();

        const liveParent = {
          id: parentIds!.spanId,
          traceId: parentIds!.traceId,
          isInternal: false,
        };

        const result = bridge.createSpan({
          type: SpanType.WORKFLOW_STEP,
          name: 'child of live parent',
          attributes: {},
          parent: liveParent as any,
          traceId: 'a1b2c3d4e5f60718293a4b5c6d7e8f90',
          parentSpanId: '1a2b3c4d5e6f7081',
        });

        expect(result?.traceId).toBe(parentIds!.traceId);
        expect(result?.parentSpanId).toBe(parentIds!.spanId);

        bridge.shutdown();
      });

      it('ignores malformed persisted IDs and falls back to the active context', () => {
        const bridge = new OtelBridge();

        const result = bridge.createSpan({
          type: SpanType.WORKFLOW_RUN,
          name: 'workflow run (resumed)',
          attributes: {},
          traceId: 'not-a-valid-trace-id',
          parentSpanId: 'nope',
        });

        // Falls back to a fresh trace rather than emitting garbage trace links
        expect(result?.traceId).toMatch(/^[0-9a-f]{32}$/);
        expect(result?.traceId).not.toBe('not-a-valid-trace-id');
        expect(result?.parentSpanId).toBeUndefined();

        bridge.shutdown();
      });
    });

    // Regression tests for https://github.com/mastra-ai/mastra/issues/15589
    //
    // When no OTEL SDK / tracer provider is registered, `trace.getTracer(...)`
    // returns a no-op tracer whose spans have INVALID_SPAN_ID / INVALID_TRACE_ID.
    // The bridge must NOT hand those zero IDs back to core — doing so causes all
    // spans to collapse onto the same ID, which breaks TrackingExporter's
    // parent-matching queue and pegs CPU at ~100% via setImmediate reschedules.
    describe('when no OTEL SDK is registered', () => {
      // Tear down the suite-level provider so the OTEL API falls back to its
      // no-op tracer, exactly reproducing a user who forgot to wire up sdk-node.
      beforeAll(() => {
        trace.disable();
      });

      afterAll(() => {
        trace.setGlobalTracerProvider(tracerProvider);
      });

      it('should return undefined (not zero IDs) so core can generate valid IDs', () => {
        // In this test environment, no SDK / tracer provider is registered,
        // so the OTEL API is in its no-op state. This mirrors a real user
        // who configures OtelBridge without also wiring up @opentelemetry/sdk-node.
        const bridge = new OtelBridge();

        const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
          type: SpanType.AGENT_RUN,
          name: 'test-agent',
          attributes: { agentId: 'test' },
        };

        const result = bridge.createSpan(options);

        // Expected: bridge detects invalid span context and returns undefined,
        // letting DefaultSpan fall through to its own ID generator.
        expect(result).toBeUndefined();

        bridge.shutdown();
      });

      it('should not return the invalid (all-zero) OTEL span/trace IDs', () => {
        const bridge = new OtelBridge();

        const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
          type: SpanType.AGENT_RUN,
          name: 'test-agent',
          attributes: { agentId: 'test' },
        };

        const result = bridge.createSpan(options);

        // If the bridge does return something, it must be a valid span context.
        if (result) {
          expect(result.spanId).not.toBe(INVALID_SPAN_ID);
          expect(result.traceId).not.toBe(INVALID_TRACE_ID);
          expect(
            isSpanContextValid({
              spanId: result.spanId,
              traceId: result.traceId,
              traceFlags: 0,
            }),
          ).toBe(true);
        }

        bridge.shutdown();
      });

      it('should consistently return undefined across multiple createSpan calls', () => {
        // With the bug, every span shared spanId "0000000000000000" and
        // traceId "00...00", which is what caused TrackingExporter to
        // infinite-loop trying to match children to parents. The fix makes
        // every call return undefined so core generates unique IDs itself.
        const bridge = new OtelBridge();

        const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
          type: SpanType.AGENT_RUN,
          name: 'test-agent',
          attributes: { agentId: 'test' },
        };

        const a = bridge.createSpan(options);
        const b = bridge.createSpan(options);

        expect(a).toBeUndefined();
        expect(b).toBeUndefined();

        bridge.shutdown();
      });
    });
  });

  describe('executeInContext', () => {
    it('should execute function when span exists', async () => {
      const bridge = new OtelBridge();

      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      const spanIds = bridge.createSpan(options);
      expect(spanIds).toBeDefined();

      let executed = false;
      const result = await bridge.executeInContext(spanIds!.spanId, async () => {
        executed = true;
        return 'test-result';
      });

      expect(executed).toBe(true);
      expect(result).toBe('test-result');

      bridge.shutdown();
    });

    it('should execute function even when span not found', async () => {
      const bridge = new OtelBridge();

      let executed = false;
      const result = await bridge.executeInContext('non-existent-span', async () => {
        executed = true;
        return 'still-works';
      });

      expect(executed).toBe(true);
      expect(result).toBe('still-works');

      bridge.shutdown();
    });
  });

  describe('executeInContextSync', () => {
    it('should execute sync function when span exists', () => {
      const bridge = new OtelBridge();

      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      const spanIds = bridge.createSpan(options);
      expect(spanIds).toBeDefined();

      let executed = false;
      const result = bridge.executeInContextSync(spanIds!.spanId, () => {
        executed = true;
        return 42;
      });

      expect(executed).toBe(true);
      expect(result).toBe(42);

      bridge.shutdown();
    });

    it('should execute sync function even when span not found', () => {
      const bridge = new OtelBridge();

      let executed = false;
      const result = bridge.executeInContextSync('non-existent-span', () => {
        executed = true;
        return 42;
      });

      expect(executed).toBe(true);
      expect(result).toBe(42);

      bridge.shutdown();
    });
  });

  describe('shutdown', () => {
    it('should complete successfully', async () => {
      const bridge = new OtelBridge();

      // Create a span
      const options: CreateSpanOptions<SpanType.AGENT_RUN> = {
        type: SpanType.AGENT_RUN,
        name: 'test-agent',
        attributes: { agentId: 'test' },
      };

      bridge.createSpan(options);

      // Shutdown should not throw
      await expect(bridge.shutdown()).resolves.toBeUndefined();
    });
  });

  describe('bridge name', () => {
    it('should have name "otel"', () => {
      const bridge = new OtelBridge();
      expect(bridge.name).toBe('otel');
      bridge.shutdown();
    });
  });

  describe('Tags Support', () => {
    it('should include tags as mastra.tags attribute for root spans with tags', async () => {
      // This test verifies that tags are included in the OTEL span attributes
      // OtelBridge uses SpanConverter which should set mastra.tags on root spans
      const { SpanConverter } = await import('@mastra/otel-exporter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      const rootSpanWithTags = {
        id: 'root-with-tags',
        traceId: 'trace-with-tags',
        type: SpanType.AGENT_RUN,
        name: 'tagged-agent',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        attributes: { agentId: 'agent-123' },
        tags: ['production', 'experiment-v2', 'user-request'],
      } as any;

      const readableSpan = await converter.convertSpan(rootSpanWithTags);

      // Tags should be present as mastra.tags attribute (JSON-stringified for backend compatibility)
      expect(readableSpan.attributes['mastra.tags']).toBeDefined();
      expect(readableSpan.attributes['mastra.tags']).toBe(
        JSON.stringify(['production', 'experiment-v2', 'user-request']),
      );
    });

    it('should not include mastra.tags attribute for child spans', async () => {
      const { SpanConverter } = await import('@mastra/otel-exporter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      const childSpanWithTags = {
        id: 'child-with-tags',
        traceId: 'trace-parent',
        parentSpanId: 'root-span-id',
        type: SpanType.TOOL_CALL,
        name: 'child-tool',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: false,
        attributes: { toolId: 'calculator' },
        tags: ['should-not-appear'],
      } as any;

      const readableSpan = await converter.convertSpan(childSpanWithTags);

      // Tags should NOT be present on child spans
      expect(readableSpan.attributes['mastra.tags']).toBeUndefined();
    });

    it('should not include mastra.tags attribute when tags is empty or undefined', async () => {
      const { SpanConverter } = await import('@mastra/otel-exporter');
      const converter = new SpanConverter({
        format: 'GenAI_v1_38_0',
        packageName: 'test',
      });

      const rootSpanNoTags = {
        id: 'root-no-tags',
        traceId: 'trace-no-tags',
        type: SpanType.AGENT_RUN,
        name: 'agent-no-tags',
        startTime: new Date(),
        endTime: new Date(),
        isRootSpan: true,
        attributes: { agentId: 'agent-123' },
        tags: [],
      } as any;

      const readableSpan = await converter.convertSpan(rootSpanNoTags);

      // Tags should NOT be present when array is empty
      expect(readableSpan.attributes['mastra.tags']).toBeUndefined();
    });
  });

  describe('onLogEvent', () => {
    function makeLogEvent(overrides: Partial<LogEvent['log']> = {}): LogEvent {
      return {
        type: 'log',
        log: {
          logId: 'log-1',
          timestamp: new Date(),
          level: 'info',
          message: 'hello',
          ...overrides,
        },
      };
    }

    it('emits a log record through the global LoggerProvider with mapped severity and body', async () => {
      logExporter.reset();
      const bridge = new OtelBridge();

      await bridge.onLogEvent(makeLogEvent({ level: 'warn', message: 'something happened' }));

      const records = logExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(records[0]!.body).toBe('something happened');
      expect(records[0]!.severityNumber).toBe(SeverityNumber.WARN);
      expect(records[0]!.severityText).toBe('WARN');
    });

    it('attaches mastra.traceId / mastra.spanId attributes when the log carries trace context', async () => {
      logExporter.reset();
      const bridge = new OtelBridge();

      await bridge.onLogEvent(
        makeLogEvent({
          traceId: '0af7651916cd43dd8448eb211c80319c',
          spanId: 'b7ad6b7169203331',
        }),
      );

      const records = logExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(records[0]!.attributes['mastra.traceId']).toBe('0af7651916cd43dd8448eb211c80319c');
      expect(records[0]!.attributes['mastra.spanId']).toBe('b7ad6b7169203331');
    });

    it('emits the OTEL log record with the trace context for the matching Mastra span', async () => {
      logExporter.reset();
      const bridge = new OtelBridge();

      const ids = bridge.createSpan({
        type: SpanType.AGENT_RUN,
        name: 'agent',
        attributes: {},
      } as CreateSpanOptions<SpanType.AGENT_RUN>);
      expect(ids).toBeDefined();

      await bridge.onLogEvent(makeLogEvent({ traceId: ids!.traceId, spanId: ids!.spanId, message: 'inside agent' }));

      const records = logExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      // The OTEL SDK populates spanContext on the log record from the emit-time Context.
      const spanContext = records[0]!.spanContext;
      expect(spanContext?.traceId).toBe(ids!.traceId);
      expect(spanContext?.spanId).toBe(ids!.spanId);
    });

    it('falls back to a SpanContext built from raw IDs when the span is not in the local map', async () => {
      logExporter.reset();
      const bridge = new OtelBridge();

      const traceId = '11111111111111111111111111111111';
      const spanId = '2222222222222222';
      await bridge.onLogEvent(makeLogEvent({ traceId, spanId, message: 'orphan' }));

      const records = logExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(records[0]!.spanContext?.traceId).toBe(traceId);
      expect(records[0]!.spanContext?.spanId).toBe(spanId);
    });

    it('emits without a spanContext when the log carries no trace IDs', async () => {
      logExporter.reset();
      const bridge = new OtelBridge();

      await bridge.onLogEvent(makeLogEvent({ message: 'no trace context' }));

      const records = logExporter.getFinishedLogRecords();
      expect(records).toHaveLength(1);
      expect(records[0]!.spanContext).toBeUndefined();
    });

    it('is a silent no-op when no global LoggerProvider is registered', async () => {
      // Tear down the suite-level LoggerProvider so otelLogs.getLogger(...)
      // resolves to a NoopLogger via the api-logs proxy. This mirrors a real
      // user who configures OtelBridge without also wiring up sdk-logs.
      otelLogs.disable();
      try {
        const bridge = new OtelBridge();
        logExporter.reset();

        await expect(bridge.onLogEvent(makeLogEvent({ message: 'dropped silently' }))).resolves.toBeUndefined();

        // The in-memory exporter is not on the registered provider any more,
        // so it should never receive the record either.
        expect(logExporter.getFinishedLogRecords()).toHaveLength(0);
      } finally {
        otelLogs.setGlobalLoggerProvider(loggerProvider);
      }
    });
  });

  describe('custom providers', () => {
    it('should use a custom tracerProvider to create spans without touching the global', async () => {
      trace.disable();
      try {
        const customProvider = new tracing.BasicTracerProvider();
        const bridge = new OtelBridge({ tracerProvider: customProvider });

        const result = bridge.createSpan({
          type: SpanType.AGENT_RUN,
          name: 'custom-provider-agent',
          attributes: { agentId: 'test' },
        } as CreateSpanOptions<SpanType.AGENT_RUN>);

        expect(result).toBeDefined();
        expect(result?.spanId).toMatch(/^[0-9a-f]{16}$/);
        expect(result?.traceId).toMatch(/^[0-9a-f]{32}$/);
        expect(result?.spanId).not.toBe(INVALID_SPAN_ID);
        expect(result?.traceId).not.toBe(INVALID_TRACE_ID);

        await bridge.shutdown();
        await customProvider.shutdown();
      } finally {
        trace.setGlobalTracerProvider(tracerProvider);
      }
    });

    it('should use a custom loggerProvider to emit logs without touching the global', async () => {
      otelLogs.disable();
      try {
        const customLogExporter = new InMemoryLogRecordExporter();
        const customLoggerProvider = new LoggerProvider({
          processors: [new SimpleLogRecordProcessor({ exporter: customLogExporter })],
        });
        const bridge = new OtelBridge({ loggerProvider: customLoggerProvider });

        await bridge.onLogEvent({
          type: 'log',
          log: {
            logId: 'custom-log-1',
            timestamp: new Date(),
            level: 'info',
            message: 'routed to custom provider',
          },
        });

        const records = customLogExporter.getFinishedLogRecords();
        expect(records).toHaveLength(1);
        expect(records[0]!.body).toBe('routed to custom provider');

        logExporter.reset();
        expect(logExporter.getFinishedLogRecords()).toHaveLength(0);

        await bridge.shutdown();
        await customLoggerProvider.shutdown();
      } finally {
        otelLogs.setGlobalLoggerProvider(loggerProvider);
      }
    });

    it('should flush the custom provider, not the global', async () => {
      const customProvider = new tracing.BasicTracerProvider();
      let flushed = false;
      const originalFlush = customProvider.forceFlush.bind(customProvider);
      customProvider.forceFlush = async () => {
        flushed = true;
        return originalFlush();
      };

      const bridge = new OtelBridge({ tracerProvider: customProvider });
      await bridge.flush();

      expect(flushed).toBe(true);

      await bridge.shutdown();
      await customProvider.shutdown();
    });

    it('should use both custom providers simultaneously with trace correlation', async () => {
      trace.disable();
      otelLogs.disable();
      try {
        const customTracerProvider = new tracing.BasicTracerProvider();
        const customLogExporter = new InMemoryLogRecordExporter();
        const customLoggerProvider = new LoggerProvider({
          processors: [new SimpleLogRecordProcessor({ exporter: customLogExporter })],
        });

        const bridge = new OtelBridge({ tracerProvider: customTracerProvider, loggerProvider: customLoggerProvider });

        const ids = bridge.createSpan({
          type: SpanType.AGENT_RUN,
          name: 'both-providers-test',
          attributes: { agentId: 'test' },
        } as CreateSpanOptions<SpanType.AGENT_RUN>);

        expect(ids).toBeDefined();

        await bridge.onLogEvent({
          type: 'log',
          log: {
            logId: 'both-log-1',
            timestamp: new Date(),
            level: 'info',
            message: 'both-test',
            traceId: ids?.traceId,
            spanId: ids?.spanId,
          },
        });

        const logs = customLogExporter.getFinishedLogRecords();
        expect(logs).toHaveLength(1);
        expect(logs[0]?.spanContext?.traceId).toBe(ids?.traceId);
        expect(logs[0]?.spanContext?.spanId).toBe(ids?.spanId);

        await bridge.shutdown();
        await customTracerProvider.shutdown();
        await customLoggerProvider.shutdown();
      } finally {
        trace.setGlobalTracerProvider(tracerProvider);
        otelLogs.setGlobalLoggerProvider(loggerProvider);
      }
    });

    it('should export span attributes correctly through custom provider', async () => {
      trace.disable();
      try {
        const spanExporter = new tracing.InMemorySpanExporter();
        const customProvider = new tracing.BasicTracerProvider({
          spanProcessors: [new tracing.SimpleSpanProcessor(spanExporter)],
        });

        const bridge = new OtelBridge({ tracerProvider: customProvider });
        bridge.init({ config: { serviceName: 'attr-test' } });

        const ids = bridge.createSpan({
          type: SpanType.AGENT_RUN,
          name: 'attr-test-agent',
          attributes: { agentId: 'attr-test' },
        } as CreateSpanOptions<SpanType.AGENT_RUN>);

        expect(ids).toBeDefined();

        await bridge.exportTracingEvent({
          type: TracingEventType.SPAN_ENDED,
          exportedSpan: {
            id: ids!.spanId,
            traceId: ids!.traceId,
            parentSpanId: ids!.parentSpanId,
            type: SpanType.AGENT_RUN,
            name: 'attr-test-agent',
            startTime: new Date(),
            endTime: new Date(),
            isRootSpan: true,
            attributes: { agentId: 'attr-test' },
          } as any,
        });

        const spans = spanExporter.getFinishedSpans();
        expect(spans.length).toBe(1);
        expect(spans[0]!.spanContext().spanId).toBe(ids!.spanId);

        await bridge.shutdown();
        await customProvider.shutdown();
      } finally {
        trace.setGlobalTracerProvider(tracerProvider);
      }
    });
  });

  describe('span map cleanup', () => {
    const mapSize = (bridge: OtelBridge) => bridge['otelSpanMap'].size;

    const makeInstance = (bridge: OtelBridge, config: Record<string, unknown> = {}) =>
      new DefaultObservabilityInstance({
        serviceName: 'map-cleanup',
        name: 'map-cleanup-instance',
        sampling: { type: SamplingStrategyType.ALWAYS },
        bridge,
        ...config,
      } as any);

    const runWorkflow = (tracing: DefaultObservabilityInstance, steps = 5) => {
      const run = tracing.startSpan({
        type: SpanType.WORKFLOW_RUN,
        name: 'workflow',
        attributes: { workflowId: 'wf-1' },
        tracingPolicy: { internal: InternalSpans.NONE },
      })!;

      for (let i = 0; i < steps; i++) {
        const step = run.createChildSpan({
          type: SpanType.WORKFLOW_STEP,
          name: `step-${i}`,
          attributes: { stepId: `step-${i}` },
          tracingPolicy: { internal: InternalSpans.NONE },
        });
        step.end();
      }

      run.end();
    };

    it('does not retain entries for exported spans', async () => {
      const bridge = new OtelBridge();
      const tracing = makeInstance(bridge);

      for (let run = 0; run < 4; run++) runWorkflow(tracing);
      await tracing.flush();

      expect(mapSize(bridge)).toBe(0);
      await bridge.shutdown();
    });

    it('does not retain entries for spans dropped by excludeSpanTypes', async () => {
      const bridge = new OtelBridge();
      const tracing = makeInstance(bridge, { excludeSpanTypes: [SpanType.WORKFLOW_STEP] });

      for (let run = 0; run < 4; run++) runWorkflow(tracing);
      await tracing.flush();

      expect(mapSize(bridge)).toBe(0);
      await bridge.shutdown();
    });

    it('does not retain entries for spans dropped by spanFilter', async () => {
      const bridge = new OtelBridge();
      const tracing = makeInstance(bridge, {
        spanFilter: (span: { type: SpanType }) => span.type !== SpanType.WORKFLOW_STEP,
      });

      for (let run = 0; run < 4; run++) runWorkflow(tracing);
      await tracing.flush();

      expect(mapSize(bridge)).toBe(0);
      await bridge.shutdown();
    });

    it('does not retain entries for spans dropped by an output processor', async () => {
      const bridge = new OtelBridge();
      const tracing = makeInstance(bridge, {
        spanOutputProcessors: [
          {
            name: 'drop-steps',
            process: (span: { type: SpanType }) => (span.type === SpanType.WORKFLOW_STEP ? undefined : span),
            shutdown: async () => {},
          },
        ],
      });

      for (let run = 0; run < 4; run++) runWorkflow(tracing);
      await tracing.flush();

      expect(mapSize(bridge)).toBe(0);
      await bridge.shutdown();
    });
  });
});
