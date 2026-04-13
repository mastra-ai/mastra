import { describe, expect, it } from 'vitest';

import { createObservabilityCollector, getCurrentObservabilityCollector } from './collector';

const TRACE_ID = '11111111111111111111111111111111';
const PARENT_SPAN_ID = 'aaaaaaaaaaaaaaaa';

function makeCarrier() {
  return { traceparent: `00-${TRACE_ID}-${PARENT_SPAN_ID}-01` };
}

interface OtlpSpan {
  traceId: string;
  spanId: string;
  parentSpanId: string;
  name: string;
  startTimeUnixNano: string;
  endTimeUnixNano: string;
  status: { code: number; message?: string };
  attributes: unknown[];
}

interface OtlpLogRecord {
  traceId: string;
  spanId: string;
  severityText: string;
  body: { stringValue: string };
  attributes: unknown[];
}

function flushSpans(payload: ReturnType<ReturnType<typeof createObservabilityCollector>['flush']>) {
  const spans = (payload.spans as { resourceSpans: { scopeSpans: { spans: OtlpSpan[] }[] }[] } | undefined)
    ?.resourceSpans?.[0]?.scopeSpans?.[0]?.spans;
  return spans ?? [];
}

function flushLogs(payload: ReturnType<ReturnType<typeof createObservabilityCollector>['flush']>) {
  const logs = (payload.logs as { resourceLogs: { scopeLogs: { logRecords: OtlpLogRecord[] }[] }[] } | undefined)
    ?.resourceLogs?.[0]?.scopeLogs?.[0]?.logRecords;
  return logs ?? [];
}

describe('ObservabilityCollector', () => {
  it('exposes the original parentContext on the collector', () => {
    const carrier = makeCarrier();
    const collector = createObservabilityCollector(carrier);
    expect(collector.parentContext).toBe(carrier);
  });

  it('captures a single span parented under the carrier spanId', async () => {
    const collector = createObservabilityCollector(makeCarrier());
    await collector.withContext(async () => {
      await collector.span('inner work', async () => 42);
    });
    const spans = flushSpans(collector.flush());
    expect(spans).toHaveLength(1);
    expect(spans[0]!.traceId).toBe(TRACE_ID);
    expect(spans[0]!.parentSpanId).toBe(PARENT_SPAN_ID);
    expect(spans[0]!.name).toBe('inner work');
    expect(spans[0]!.status.code).toBe(1);
  });

  it('nests spans correctly when called recursively', async () => {
    const collector = createObservabilityCollector(makeCarrier());
    await collector.withContext(async () => {
      await collector.span('outer', async () => {
        await collector.span('inner', async () => 'ok');
      });
    });
    const spans = flushSpans(collector.flush());
    expect(spans).toHaveLength(2);
    const outer = spans.find(s => s.name === 'outer')!;
    const inner = spans.find(s => s.name === 'inner')!;
    expect(outer.parentSpanId).toBe(PARENT_SPAN_ID);
    expect(inner.parentSpanId).toBe(outer.spanId);
  });

  it('records error status when the wrapped function throws', async () => {
    const collector = createObservabilityCollector(makeCarrier());
    await collector.withContext(async () => {
      await expect(
        collector.span('failing', async () => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
    });
    const spans = flushSpans(collector.flush());
    expect(spans).toHaveLength(1);
    expect(spans[0]!.status.code).toBe(2);
    expect(spans[0]!.status.message).toBe('boom');
  });

  it('serializes attributes as OTLP tagged values', async () => {
    const collector = createObservabilityCollector(makeCarrier());
    await collector.withContext(async () => {
      await collector.span('with attrs', async () => null, {
        'http.method': 'GET',
        'http.status_code': 200,
        'cache.hit': true,
        'request.duration_ms': 12.5,
      });
    });
    const spans = flushSpans(collector.flush());
    const attrs = spans[0]!.attributes as Array<{ key: string; value: Record<string, unknown> }>;
    const byKey: Record<string, unknown> = {};
    for (const a of attrs) byKey[a.key] = a.value;
    expect(byKey['http.method']).toEqual({ stringValue: 'GET' });
    expect(byKey['http.status_code']).toEqual({ intValue: 200 });
    expect(byKey['cache.hit']).toEqual({ boolValue: true });
    expect(byKey['request.duration_ms']).toEqual({ doubleValue: 12.5 });
  });

  it('captures logs against the active span', async () => {
    const collector = createObservabilityCollector(makeCarrier());
    await collector.withContext(async () => {
      collector.log('info', 'before span');
      await collector.span('work', async () => {
        collector.log('warn', 'inside span', { extra: 'context' });
      });
    });
    const logs = flushLogs(collector.flush());
    expect(logs).toHaveLength(2);
    expect(logs[0]!.spanId).toBe(PARENT_SPAN_ID);
    expect(logs[0]!.severityText).toBe('INFO');
    expect(logs[0]!.body.stringValue).toBe('before span');
    expect(logs[1]!.severityText).toBe('WARN');
    // The inner log should be parented under the work span, not the carrier.
    expect(logs[1]!.spanId).not.toBe(PARENT_SPAN_ID);
  });

  it('measures wall-clock execution duration in withContext', async () => {
    const collector = createObservabilityCollector(makeCarrier());
    await collector.withContext(async () => {
      await new Promise(resolve => setTimeout(resolve, 25));
    });
    const payload = collector.flush();
    expect(payload.executionDurationMs).toBeDefined();
    // Allow some slack for slow CI; the floor is what matters.
    expect(payload.executionDurationMs!).toBeGreaterThanOrEqual(20);
  });

  it('does not include duration when withContext was never called', () => {
    const collector = createObservabilityCollector(makeCarrier());
    const payload = collector.flush();
    expect(payload.executionDurationMs).toBeUndefined();
  });

  it('flush() returns empty payload after first call', async () => {
    const collector = createObservabilityCollector(makeCarrier());
    await collector.withContext(async () => {
      await collector.span('once', async () => null);
    });
    const first = collector.flush();
    expect(flushSpans(first)).toHaveLength(1);
    const second = collector.flush();
    expect(second).toEqual({});
  });

  it('returns empty payload when no spans or logs were captured', () => {
    const collector = createObservabilityCollector(makeCarrier());
    expect(collector.flush()).toEqual({});
  });

  describe('getCurrentObservabilityCollector', () => {
    it('returns undefined outside withContext', () => {
      expect(getCurrentObservabilityCollector()).toBeUndefined();
    });

    it('returns the active collector inside withContext', async () => {
      const collector = createObservabilityCollector(makeCarrier());
      let observed: ReturnType<typeof getCurrentObservabilityCollector> = undefined;
      await collector.withContext(async () => {
        observed = getCurrentObservabilityCollector();
      });
      expect(observed).toBe(collector);
      // Cleared after withContext returns.
      expect(getCurrentObservabilityCollector()).toBeUndefined();
    });

    it('restores the previous collector after a nested withContext', async () => {
      const outer = createObservabilityCollector(makeCarrier());
      const inner = createObservabilityCollector(makeCarrier());
      await outer.withContext(async () => {
        expect(getCurrentObservabilityCollector()).toBe(outer);
        await inner.withContext(async () => {
          expect(getCurrentObservabilityCollector()).toBe(inner);
        });
        expect(getCurrentObservabilityCollector()).toBe(outer);
      });
      expect(getCurrentObservabilityCollector()).toBeUndefined();
    });
  });

  it('degrades to a synthetic root when traceparent is malformed', async () => {
    const collector = createObservabilityCollector({ traceparent: 'not-a-traceparent' });
    await collector.withContext(async () => {
      await collector.span('orphan', async () => null);
    });
    const spans = flushSpans(collector.flush());
    expect(spans).toHaveLength(1);
    // Synthetic IDs are all zeros so the server-side ingest can detect
    // and reject these (it validates traceId match against the actual
    // parentContext).
    expect(spans[0]!.traceId).toBe('00000000000000000000000000000000');
  });
});
