import { describe, expect, it } from 'vitest';
import { TracingEventType } from '../observability';
import { InMemoryPulseStorage } from '../storage/domains/pulse/inmemory';
import { PulseBridge } from './bridge';
import { PulseBus } from './bus';
import { registerPulseEmitter, unregisterPulseEmitter } from './emitter';
import { mintFactId } from './identity';
import { emitSpanFact } from './lifecycle';
import { withPulseRun } from './run-context';
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

  it('a flow derives identically from the native lane alone (bridge off)', async () => {
    const bridgeStore = new InMemoryPulseStorage();
    const nativeStore = new InMemoryPulseStorage();
    const bridgeBus = new PulseBus();
    const b = collect(bridgeBus);
    const bridge = new PulseBridge({ bus: bridgeBus });
    const nativeBus = new PulseBus();
    const n = collect(nativeBus);
    registerPulseEmitter(nativeBus);
    try {
      const s1 = span();
      const ended = span({ endTime: new Date('2026-08-18T10:00:01Z'), output: { text: 'done' } });
      await bridge.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: s1 as any });
      await bridge.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: ended as any });
      emitSpanFact(s1 as any, 'started');
      emitSpanFact(ended as any, 'ended');
      await flush();
    } finally {
      unregisterPulseEmitter(nativeBus);
    }
    await bridgeStore.batchCreatePulses(b.pulses);
    await nativeStore.batchCreatePulses(n.pulses);
    const [fromBridge, fromNative] = [await bridgeStore.listFlows(), await nativeStore.listFlows()];
    expect(fromNative.flows).toEqual(fromBridge.flows); // field-by-field
    expect(fromNative.flows[0]).toMatchObject({ status: 'completed', pulseCount: 2, threadId: 't-lc' });
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

describe('site context extras', () => {
  it('span path carries site attributes (model/provider survive dual mode)', async () => {
    const bus = new PulseBus();
    const c = collect(bus);
    registerPulseEmitter(bus);
    try {
      emitSpanFact(
        span({
          type: 'model_generation',
          id: 'm1',
          endTime: new Date('2026-08-18T10:00:01Z'),
          output: { t: 1 },
        }) as any,
        'ended',
        {
          runId: 'run-lc',
          surface: 'model',
          base: 'generate',
          attributes: { model: 'gpt-4o-mini', provider: 'openai.responses' },
        },
      );
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    expect(c.pulses[0]?.attributes).toMatchObject({ model: 'gpt-4o-mini', provider: 'openai.responses' });
  });

  it('a terminal status names its action: aborted ends as run_aborted on both paths', async () => {
    const bus = new PulseBus();
    const c = collect(bus);
    registerPulseEmitter(bus);
    try {
      emitSpanFact(span({ endTime: new Date('2026-08-18T10:00:01Z'), output: { status: 'aborted' } }) as any, 'ended', {
        runId: 'run-lc',
        surface: 'agent',
        base: 'run',
        status: 'aborted',
      });
      emitSpanFact(undefined, 'ended', { runId: 'run-m', surface: 'agent', base: 'run', status: 'aborted' });
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    expect(c.pulses.map(p => p.action)).toEqual(['run_aborted', 'run_aborted']);
    // A suspended run is NOT terminal — the action says so and readers keep the flow open.
    expect(c.pulses.every(p => p.type === 'state')).toBe(true);
  });

  it('span-less emission falls back to the ambient run context', async () => {
    const bus = new PulseBus();
    const c = collect(bus);
    registerPulseEmitter(bus);
    try {
      await withPulseRun({ runId: 'ambient-run', threadId: 'amb-t' }, async () => {
        emitSpanFact(undefined, 'started', {
          runId: undefined,
          surface: 'memory',
          base: 'operation',
          occurrence: 'recall',
          name: 'memory: recall',
        });
      });
      await flush();
    } finally {
      unregisterPulseEmitter(bus);
    }
    expect(c.pulses[0]).toMatchObject({
      surface: 'memory',
      action: 'operation_started',
      runId: 'ambient-run',
      traceId: 'ambient-run',
      threadId: 'amb-t',
    });
  });

  it('string occurrences mint distinct deterministic ids', () => {
    expect(mintFactId('r', 'tool', 'call', 'started', 'call-1')).toBe(
      mintFactId('r', 'tool', 'call', 'started', 'call-1'),
    );
    expect(mintFactId('r', 'tool', 'call', 'started', 'call-1')).not.toBe(
      mintFactId('r', 'tool', 'call', 'started', 'call-2'),
    );
  });
});
