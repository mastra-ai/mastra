import { describe, expect, it } from 'vitest';
import { TracingEventType } from '../observability';
import { InMemoryPulseStorage } from '../storage/domains/pulse/inmemory';
import { PulseBridge } from './bridge';
import { PulseBus } from './bus';
import { registerPulseEmitter, unregisterPulseEmitter } from './emitter';
import { emitSpanFact } from './lifecycle';
import type { PulseBusEvent } from './types';

function collect(bus: PulseBus) {
  const pulses: any[] = [];
  const edges: any[] = [];
  bus.subscribe((e: PulseBusEvent) => {
    if (e.type === 'pulse') pulses.push(e.record);
    else edges.push(e.record);
  });
  return { pulses, edges };
}

const flush = () => new Promise<void>(r => setTimeout(r, 0));

function span(overrides: Record<string, any> = {}) {
  return {
    id: 'root-span',
    traceId: 'flow-lc',
    type: 'agent_run',
    name: "agent run: 'lc'",
    isRootSpan: true,
    startTime: new Date('2026-08-18T10:00:00Z'),
    metadata: { runId: 'run-lc', threadId: 't-lc', resourceId: 'u-lc' },
    attributes: {},
    ...overrides,
  };
}

describe('span lifecycle facts (native lane)', () => {
  it('mirrors the bridge translation exactly — same ids, vocabulary, edges; only the lane differs', async () => {
    // Bridge lane
    const bridgeBus = new PulseBus();
    const b = collect(bridgeBus);
    const bridge = new PulseBridge({ bus: bridgeBus });
    const s1 = span();
    await bridge.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: s1 as any });
    const ended = span({ endTime: new Date('2026-08-18T10:00:01Z'), output: { text: 'done' } });
    await bridge.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: ended as any });

    // Native lane
    const nativeBus = new PulseBus();
    const n = collect(nativeBus);
    registerPulseEmitter(nativeBus);
    try {
      emitSpanFact(s1 as any, 'started');
      emitSpanFact(ended as any, 'ended');
      await flush();
    } finally {
      unregisterPulseEmitter(nativeBus);
    }

    expect(n.pulses).toHaveLength(2);
    expect(b.pulses).toHaveLength(2);
    for (let i = 0; i < 2; i++) {
      const bp = b.pulses[i]!;
      const np = n.pulses[i]!;
      expect(np.id, `pulse ${i} id`).toBe(bp.id); // deterministic collapse key
      expect({ surface: np.surface, action: np.action, type: np.type }).toEqual({
        surface: bp.surface,
        action: bp.action,
        type: bp.type,
      });
      expect(np.runId).toBe(bp.runId);
      expect(np.threadId).toBe(bp.threadId);
      expect(np.spanId).toBe(bp.spanId);
      expect(np.source).toBe('native');
      expect(bp.source).toBe('span');
    }
    // Structure edges match by (type, from, to). The bridge also emits
    // flow_contains bookkeeping edges; the native lane leaves membership to
    // trace_id (the readers never require flow_contains).
    const key = (e: any) => `${e.type}|${e.from.kind}:${e.from.id}|${e.to.kind}:${e.to.id}`;
    const bKeys = b.edges.map(key).filter(k => !k.startsWith('flow_contains'));
    const nKeys = n.edges.map(key);
    expect(nKeys.sort()).toEqual(bKeys.sort());
  });

  it('dual emission collapses in the idempotent store', async () => {
    const store = new InMemoryPulseStorage();
    const bus = new PulseBus();
    const rows = collect(bus);
    const bridge = new PulseBridge({ bus });
    registerPulseEmitter(bus);
    try {
      const s1 = span();
      const ended = span({ endTime: new Date('2026-08-18T10:00:01Z'), output: { text: 'done' } });
      await bridge.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: s1 as any });
      emitSpanFact(s1 as any, 'started');
      await bridge.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: ended as any });
      emitSpanFact(ended as any, 'ended');
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }

    await store.batchCreatePulses(rows.pulses);
    const { flows } = await store.listFlows();
    expect(flows).toHaveLength(1);
    expect(flows[0]!.status).toBe('completed');
    // 4 rows written (2 per lane) but only 2 logical pulses counted.
    expect(rows.pulses).toHaveLength(4);
    expect(flows[0]!.pulseCount).toBe(2);
  });

  it('error ends become *_failed error facts', async () => {
    const bus = new PulseBus();
    const n = collect(bus);
    registerPulseEmitter(bus);
    try {
      emitSpanFact(span({ endTime: new Date(), errorInfo: { message: 'boom' }, output: undefined }) as any, 'ended');
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    expect(n.pulses[0]).toMatchObject({ action: 'run_failed', type: 'error', level: 'error', source: 'native' });
  });
});
