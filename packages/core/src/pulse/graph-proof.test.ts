import { describe, expect, it } from 'vitest';
import { TracingEventType } from '../observability';
import type { PulseRecord, PulseRelationshipRecord } from '../storage/domains/pulse';
import { PulseBridge } from './bridge';
import { PulseBus } from './bus';
import type { PulseBusEvent } from './types';

/**
 * PROOF that the relationship graph is real: flow membership and the tree can
 * be reconstructed from edges alone, joining edges to pulses BY PULSE RECORD
 * ID ONLY — no traceId / spanId / parentSpanId column reads. The result must
 * equal what the column-based derivation sees. This is the property Eric's
 * spec demands of the graph ("flow_contains links Flow id to member Pulse",
 * "parent_of — execution parentage only").
 */

function span(overrides: Record<string, any> = {}) {
  return {
    id: 'root',
    name: 'agent',
    type: 'agent_run',
    traceId: 'flow-1',
    startTime: new Date('2026-08-16T10:00:00.000Z'),
    endTime: new Date('2026-08-16T10:00:02.000Z'),
    isRootSpan: false,
    isEvent: false,
    metadata: {},
    attributes: {},
    ...overrides,
  };
}

async function runScenario() {
  const bus = new PulseBus();
  const pulses: PulseRecord[] = [];
  const relationships: PulseRelationshipRecord[] = [];
  bus.subscribe((e: PulseBusEvent) => {
    if (e.type === 'pulse') pulses.push(e.record);
    else relationships.push(e.record);
  });
  const bridge = new PulseBridge({ bus });
  const root = span({ id: 'root', isRootSpan: true });
  const child = span({ id: 'child', parentSpanId: 'root', type: 'model_generation' });
  const grandchild = span({ id: 'grand', parentSpanId: 'child', type: 'model_step' });
  await bridge.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: root } as any);
  await bridge.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: child } as any);
  await bridge.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: grandchild } as any);
  await bridge.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: grandchild } as any);
  await bridge.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: child } as any);
  bridge.onLogEvent({
    type: 'log',
    log: { timestamp: new Date(), level: 'warn', message: 'careful', traceId: 'flow-1' },
  } as any);
  await bridge.exportTracingEvent({ type: TracingEventType.SPAN_ENDED, exportedSpan: root } as any);
  return { pulses, relationships };
}

describe('graph proof: edges alone reconstruct the read model', () => {
  it('flow membership from flow_contains equals the column-derived membership', async () => {
    const { pulses, relationships } = await runScenario();

    // Edge walk (pulse ids only): every member of flow-1 via flow_contains.
    const edgeMembers = new Set(
      relationships
        .filter(r => r.type === 'flow_contains' && r.from.kind === 'flow' && r.from.id === 'flow-1')
        .map(r => r.to.id),
    );
    // Column derivation: every pulse whose traceId column says flow-1.
    const columnMembers = new Set(pulses.filter(p => p.traceId === 'flow-1').map(p => p.id));

    expect(edgeMembers).toEqual(columnMembers);
    expect(edgeMembers.size).toBe(7); // 3 starts + 3 ends + 1 log
  });

  it('the tree from parent_of equals the column-derived tree, joined by pulse id only', async () => {
    const { pulses, relationships } = await runScenario();
    const byId = new Map(pulses.map(p => [p.id, p]));

    // Edge walk: parent_of over started pulses, resolved through pulses.id.
    const edgeTree = relationships
      .filter(r => r.type === 'parent_of')
      .map(r => {
        const parent = byId.get(r.from.id);
        const child = byId.get(r.to.id);
        expect(parent, `parent endpoint ${r.from.id} must be a real pulse id`).toBeDefined();
        expect(child, `child endpoint ${r.to.id} must be a real pulse id`).toBeDefined();
        return `${parent!.spanId}->${child!.spanId}`;
      })
      .sort();

    // Column derivation: parentSpanId over the started pulses.
    const columnTree = pulses
      .filter(p => p.action.endsWith('_started') && p.parentSpanId)
      .map(p => `${p.parentSpanId}->${p.spanId}`)
      .sort();

    expect(edgeTree).toEqual(columnTree);
    expect(edgeTree).toEqual(['child->grand', 'root->child']);
  });

  it('origin_of appears at flow START (running flows have structure)', async () => {
    const bus = new PulseBus();
    const relationships: PulseRelationshipRecord[] = [];
    const pulses: PulseRecord[] = [];
    bus.subscribe((e: PulseBusEvent) => {
      if (e.type === 'relationship') relationships.push(e.record);
      else pulses.push(e.record);
    });
    const bridge = new PulseBridge({ bus });
    // Only a START — the run is in flight. The graph must already know the
    // flow's origin and membership (the old end-gated emission left running
    // flows with zero edges).
    await bridge.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: span({ id: 'live-root', isRootSpan: true, traceId: 'flow-live' }) as any,
    } as any);

    expect(relationships.map(r => r.type).sort()).toEqual(['flow_contains', 'origin_of']);
    const origin = relationships.find(r => r.type === 'origin_of')!;
    expect(origin.from).toEqual({ kind: 'pulse', id: pulses[0]!.id });
    expect(origin.to).toEqual({ kind: 'flow', id: 'flow-live' });
  });
});

describe('deterministic pulse ids (cross-process identity)', () => {
  /**
   * A resumed run lives in a NEW process; the suspended span's pulse was
   * written by a process that is dead. With deterministic ids the new
   * process COMPUTES that pulse's id — no `span:` IOU, no map lookup.
   */
  it('a second bridge (new process) emits resume_of pointing at the exact pulse id the first bridge wrote', async () => {
    // Process 1: the original run, suspends.
    const bus1 = new PulseBus();
    const pulses1: PulseRecord[] = [];
    bus1.subscribe((e: PulseBusEvent) => {
      if (e.type === 'pulse') pulses1.push(e.record);
    });
    const bridge1 = new PulseBridge({ bus: bus1 });
    const suspended = span({ id: 'susp-root', isRootSpan: true, traceId: 'flow-r' });
    await bridge1.exportTracingEvent({ type: TracingEventType.SPAN_STARTED, exportedSpan: suspended } as any);
    const suspendedStartPulse = pulses1.find(p => p.spanId === 'susp-root' && p.action.endsWith('_started'))!;

    // Process 2: fresh bridge (no shared memory), resumes the run.
    const bus2 = new PulseBus();
    const rels2: PulseRelationshipRecord[] = [];
    bus2.subscribe((e: PulseBusEvent) => {
      if (e.type === 'relationship') rels2.push(e.record);
    });
    const bridge2 = new PulseBridge({ bus: bus2 });
    await bridge2.exportTracingEvent({
      type: TracingEventType.SPAN_STARTED,
      exportedSpan: span({
        id: 'resumed-root',
        isRootSpan: true,
        traceId: 'flow-r',
        parentSpanId: 'susp-root',
        metadata: { resumed: true, resumedFromSpanId: 'susp-root' },
      }) as any,
    } as any);
    await bridge2.exportTracingEvent({
      type: TracingEventType.SPAN_ENDED,
      exportedSpan: span({
        id: 'resumed-root',
        isRootSpan: true,
        traceId: 'flow-r',
        parentSpanId: 'susp-root',
        metadata: { resumed: true, resumedFromSpanId: 'susp-root' },
      }) as any,
    } as any);

    const resume = rels2.find(r => r.type === 'resume_of');
    expect(resume).toBeDefined();
    // The whole point: the NEW process addressed the OLD process's pulse
    // by its real record id — computed, not remembered.
    expect(resume!.to.id).toBe(suspendedStartPulse.id);
    expect(resume!.to.id.startsWith('span:')).toBe(false);
  });
});
