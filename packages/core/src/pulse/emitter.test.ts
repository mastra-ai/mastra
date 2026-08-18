import { describe, expect, it } from 'vitest';
import { PulseBus } from './bus';
import { emitPulseFact, isRunIncomplete, registerPulseEmitter, unregisterPulseEmitter } from './emitter';
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

const flushMicrotasks = () => new Promise<void>(r => setTimeout(r, 0));

describe('native fact ingress (Gate 1 experiment)', () => {
  it('is a strict no-op without a sink (pulse off = zero cost, zero effects)', async () => {
    expect(() =>
      emitPulseFact({ runId: 'r1', surface: 'signal', action: 'delivery_decided', type: 'decision' }),
    ).not.toThrow();
    await flushMicrotasks();
    expect(isRunIncomplete('r1')).toBe(false);
  });

  it('delivers facts and their edges off the source stack (microtask drain)', async () => {
    const bus = new PulseBus();
    const { pulses, edges } = collect(bus);
    registerPulseEmitter(bus);

    emitPulseFact({
      runId: 'r2',
      surface: 'signal',
      action: 'delivery_decided',
      type: 'decision',
      attributes: { signalId: 's1', routing: 'pending' },
      edges: [{ type: 'queued_signal', to: { kind: 'content', id: 'signal:s1' } }],
    });
    // Synchronously: nothing delivered yet — the seam paid only a push.
    expect(pulses).toHaveLength(0);
    await flushMicrotasks();

    expect(pulses).toHaveLength(1);
    expect(pulses[0]).toMatchObject({ surface: 'signal', action: 'delivery_decided', runId: 'r2', source: 'native' });
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ type: 'queued_signal', to: { kind: 'content', id: 'signal:s1' } });
    expect(edges[0].from).toEqual({ kind: 'pulse', id: pulses[0].id });
    unregisterPulseEmitter(bus);
  });

  it('enforces the per-run record budget with ONE sticky incomplete marker', async () => {
    const bus = new PulseBus();
    const { pulses } = collect(bus);
    registerPulseEmitter(bus);

    for (let i = 0; i < 300; i++) {
      emitPulseFact({ runId: 'r3', surface: 'signal', action: 'delivery_decided', type: 'decision' });
    }
    await flushMicrotasks();

    const markers = pulses.filter(p => p.action === 'native_capture_incomplete');
    expect(markers).toHaveLength(1); // sticky: one marker, not 6
    expect(pulses.filter(p => p.action === 'delivery_decided')).toHaveLength(256);
    expect(isRunIncomplete('r3')).toBe(true);
    unregisterPulseEmitter(bus);
  });

  it('rejects an oversized record without harming the run beyond the marker', async () => {
    const bus = new PulseBus();
    const { pulses } = collect(bus);
    registerPulseEmitter(bus);

    emitPulseFact({
      runId: 'r4',
      surface: 'signal',
      action: 'delivery_decided',
      type: 'decision',
      attributes: { blob: 'x'.repeat(4000) },
    });
    await flushMicrotasks();
    expect(pulses.filter(p => p.action === 'delivery_decided')).toHaveLength(0);
    expect(pulses.filter(p => p.action === 'native_capture_incomplete')).toHaveLength(1);
    unregisterPulseEmitter(bus);
  });
});
