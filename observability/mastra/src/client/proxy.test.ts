import { SpanType } from '@mastra/core/observability';
import type { AnySpan, ObservabilityEvent, ObservabilityInstance } from '@mastra/core/observability';
import { describe, expect, it, vi } from 'vitest';

import { BaseObservabilityInstance } from '../instances/base';
import { createClientObservabilityProxy } from './proxy';
import { formatTraceparent } from './w3c';

const TRACE_ID = '11111111111111111111111111111111';
const PARENT_SPAN_ID = 'aaaaaaaaaaaaaaaa';
const CHILD_SPAN_ID = 'bbbbbbbbbbbbbbbb';
const SECOND_CHILD_SPAN_ID = 'cccccccccccccccc';

interface FakeBus {
  events: ObservabilityEvent[];
}

function createFakeInstance(): { instance: ObservabilityInstance; bus: FakeBus } {
  const bus: FakeBus = { events: [] };
  // We rely on `instanceof BaseObservabilityInstance` for the
  // ingest path to forward through. Build a minimal subclass.
  class FakeInstance extends BaseObservabilityInstance {
    constructor() {
      super({ name: 'fake', serviceName: 'test' });
    }
    override __receiveExternalEvent(event: ObservabilityEvent): void {
      bus.events.push(event);
    }
  }
  return { instance: new FakeInstance(), bus };
}

function carrier(traceId = TRACE_ID, spanId = PARENT_SPAN_ID) {
  return { traceparent: formatTraceparent(traceId, spanId, true) };
}

function spansPayload(spans: unknown[]) {
  return { resourceSpans: [{ scopeSpans: [{ spans }] }] };
}

function logsPayload(logs: unknown[]) {
  return { resourceLogs: [{ scopeLogs: [{ logRecords: logs }] }] };
}

function makeSpan(overrides: Record<string, unknown> = {}) {
  return {
    traceId: TRACE_ID,
    spanId: CHILD_SPAN_ID,
    parentSpanId: PARENT_SPAN_ID,
    name: 'child',
    startTimeUnixNano: '0',
    endTimeUnixNano: '1000000',
    attributes: [],
    status: { code: 1 },
    ...overrides,
  };
}

describe('inject', () => {
  it('produces a sampled traceparent from a parent span', () => {
    const { instance } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    const span = { traceId: TRACE_ID, id: PARENT_SPAN_ID } as unknown as AnySpan;
    const ctx = proxy.inject(span);
    expect(ctx.traceparent).toBe(`00-${TRACE_ID}-${PARENT_SPAN_ID}-01`);
  });
});

describe('ingest validation', () => {
  it('rejects payloads with mismatched traceIds', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    proxy.receive({ spans: spansPayload([makeSpan({ traceId: '99999999999999999999999999999999' })]) }, carrier());
    expect(bus.events).toHaveLength(0);
  });

  it('rejects payloads with orphan parent spanIds', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    proxy.receive({ spans: spansPayload([makeSpan({ parentSpanId: 'deadbeefdeadbeef' })]) }, carrier());
    expect(bus.events).toHaveLength(0);
  });

  it('rejects spans missing parentSpanId entirely', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    proxy.receive({ spans: spansPayload([makeSpan({ parentSpanId: undefined })]) }, carrier());
    expect(bus.events).toHaveLength(0);
  });

  it('rejects payloads exceeding span count limit', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({
      resolveInstance: () => instance,
      limits: { maxSpans: 1 },
    });
    proxy.receive(
      {
        spans: spansPayload([makeSpan(), makeSpan({ spanId: SECOND_CHILD_SPAN_ID })]),
      },
      carrier(),
    );
    expect(bus.events).toHaveLength(0);
  });

  it('rejects payloads exceeding byte limit', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({
      resolveInstance: () => instance,
      limits: { maxPayloadBytes: 10 },
    });
    proxy.receive({ spans: spansPayload([makeSpan()]) }, carrier());
    expect(bus.events).toHaveLength(0);
  });

  it('drops payloads when no instance is registered', () => {
    const proxy = createClientObservabilityProxy({ resolveInstance: () => undefined });
    // Should not throw.
    proxy.receive({ spans: spansPayload([makeSpan()]) }, carrier());
  });

  it('drops payloads with malformed parentContext', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    proxy.receive({ spans: spansPayload([makeSpan()]) }, { traceparent: 'garbage' });
    expect(bus.events).toHaveLength(0);
  });
});

describe('ingest happy path', () => {
  it('forwards a single child span as start + end events', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    proxy.receive({ spans: spansPayload([makeSpan()]) }, carrier());
    expect(bus.events).toHaveLength(2);
    expect(bus.events[0]).toMatchObject({ type: 'span_started' });
    expect(bus.events[1]).toMatchObject({ type: 'span_ended' });
    const exported = (bus.events[0] as { exportedSpan: { id: string; parentSpanId: string; type: SpanType } })
      .exportedSpan;
    expect(exported.id).toBe(CHILD_SPAN_ID);
    expect(exported.parentSpanId).toBe(PARENT_SPAN_ID);
    expect(exported.type).toBe(SpanType.GENERIC);
  });

  it('forwards multi-level span trees when parents resolve internally', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    proxy.receive(
      {
        spans: spansPayload([
          makeSpan(),
          makeSpan({ spanId: SECOND_CHILD_SPAN_ID, parentSpanId: CHILD_SPAN_ID, name: 'grandchild' }),
        ]),
      },
      carrier(),
    );
    // 2 spans -> start + end each = 4 events
    expect(bus.events).toHaveLength(4);
  });

  it('emits a duration metric when executionDurationMs is present', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    proxy.receive(
      {
        spans: spansPayload([makeSpan()]),
        executionDurationMs: 234,
        toolName: 'fetchUser',
      },
      carrier(),
    );
    // 1 span -> start + end = 2 events, plus 1 metric
    expect(bus.events).toHaveLength(3);
    const metric = bus.events.find(e => (e as { type: string }).type === 'metric') as
      | {
          metric: {
            name: string;
            value: number;
            labels: Record<string, string>;
            correlationContext: Record<string, unknown>;
          };
        }
      | undefined;
    expect(metric).toBeDefined();
    expect(metric!.metric.name).toBe('mastra_tool_duration_ms');
    expect(metric!.metric.labels).toMatchObject({ toolType: 'client' });
    expect(metric!.metric.value).toBe(234);
    expect(metric!.metric.labels).toEqual({ status: 'ok', toolType: 'client' });
    expect(metric!.metric.correlationContext).toMatchObject({
      traceId: TRACE_ID,
      spanId: PARENT_SPAN_ID,
      entityName: 'fetchUser',
    });
  });

  it('emits the duration metric with status=error when any span errored', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    proxy.receive(
      {
        spans: spansPayload([makeSpan({ status: { code: 2, message: 'boom' } })]),
        executionDurationMs: 99,
        toolName: 'fetchUser',
      },
      carrier(),
    );
    const metric = bus.events.find(e => (e as { type: string }).type === 'metric') as
      | { metric: { labels: Record<string, string> } }
      | undefined;
    expect(metric?.metric.labels.status).toBe('error');
  });

  it('emits the duration metric even when no spans are sent', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    proxy.receive({ executionDurationMs: 42, toolName: 'fetchUser' }, carrier());
    expect(bus.events).toHaveLength(1);
    expect((bus.events[0] as { type: string }).type).toBe('metric');
  });

  it('forwards log records as log events', () => {
    const { instance, bus } = createFakeInstance();
    const proxy = createClientObservabilityProxy({ resolveInstance: () => instance });
    proxy.receive(
      {
        logs: logsPayload([
          {
            traceId: TRACE_ID,
            spanId: PARENT_SPAN_ID,
            timeUnixNano: '0',
            severityText: 'INFO',
            body: { stringValue: 'hello' },
          },
        ]),
      },
      carrier(),
    );
    expect(bus.events).toHaveLength(1);
    expect(bus.events[0]).toMatchObject({ type: 'log' });
  });

  it('logs warnings via the provided logger when validation fails', () => {
    const { instance } = createFakeInstance();
    const warn = vi.fn();
    const proxy = createClientObservabilityProxy({
      resolveInstance: () => instance,
      logger: { warn } as never,
    });
    proxy.receive({ spans: spansPayload([makeSpan({ traceId: 'ffffffffffffffffffffffffffffffff' })]) }, carrier());
    expect(warn).toHaveBeenCalled();
  });
});
