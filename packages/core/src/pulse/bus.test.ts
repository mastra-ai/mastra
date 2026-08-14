import { describe, expect, it, vi } from 'vitest';
import { PulseBus } from './bus';
import type { PulseBusEvent, PulseBusExporter } from './types';

function pulseEvent(id = 'p1'): PulseBusEvent {
  return {
    type: 'pulse',
    record: {
      id,
      timestamp: new Date('2026-08-14T10:00:00Z'),
      seq: 1,
      type: 'state',
      surface: 'agent',
      action: 'run_started',
      traceId: 'flow-1',
      source: 'span',
    },
  };
}

function makeExporter(overrides: Partial<PulseBusExporter> = {}): PulseBusExporter & {
  events: PulseBusEvent[];
  drops: unknown[];
} {
  const events: PulseBusEvent[] = [];
  const drops: unknown[] = [];
  return {
    name: 'test-exporter',
    events,
    drops,
    onPulseEvent: e => {
      events.push(e);
    },
    onDroppedEvent: e => {
      drops.push(e);
    },
    flush: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('PulseBus', () => {
  it('routes events to exporters and subscribers', () => {
    const bus = new PulseBus();
    const exporter = makeExporter();
    const seen: PulseBusEvent[] = [];
    bus.registerExporter(exporter);
    bus.subscribe(e => seen.push(e));

    bus.emit(pulseEvent());
    expect(exporter.events).toHaveLength(1);
    expect(seen).toHaveLength(1);
  });

  it('dedupes exporter registration by instance and supports unregister', () => {
    const bus = new PulseBus();
    const exporter = makeExporter();
    bus.registerExporter(exporter);
    bus.registerExporter(exporter);
    expect(bus.getExporters()).toHaveLength(1);
    expect(bus.unregisterExporter(exporter)).toBe(true);
    expect(bus.getExporters()).toHaveLength(0);
  });

  it('tracks async handlers and drains them on flush', async () => {
    const bus = new PulseBus();
    let resolved = false;
    bus.registerExporter(
      makeExporter({
        onPulseEvent: async () => {
          await new Promise(r => setTimeout(r, 20));
          resolved = true;
        },
      }),
    );
    bus.emit(pulseEvent());
    expect(resolved).toBe(false);
    await bus.flush();
    expect(resolved).toBe(true);
  });

  it('a throwing exporter does not break others', () => {
    const bus = new PulseBus();
    const good = makeExporter();
    bus.registerExporter(
      makeExporter({
        onPulseEvent: () => {
          throw new Error('boom');
        },
      }),
    );
    bus.registerExporter(good);
    bus.emit(pulseEvent());
    expect(good.events).toHaveLength(1);
  });

  it('routes drop events to exporters only, never subscribers', () => {
    const bus = new PulseBus();
    const exporter = makeExporter();
    const seen: unknown[] = [];
    bus.registerExporter(exporter);
    bus.subscribe(e => seen.push(e));

    bus.emitDropEvent({
      type: 'drop',
      signal: 'pulse',
      reason: 'retry-exhausted',
      count: 3,
      timestamp: new Date(),
      exporterName: 'writer',
    });
    expect(exporter.drops).toHaveLength(1);
    expect(seen).toHaveLength(0);
  });

  it('flush drains exporter buffers and loops when drains emit drops', async () => {
    const bus = new PulseBus();
    let flushes = 0;
    const exporter = makeExporter({
      flush: vi.fn().mockImplementation(async () => {
        flushes++;
        if (flushes === 1) {
          bus.emitDropEvent({
            type: 'drop',
            signal: 'pulse',
            reason: 'retry-exhausted',
            count: 1,
            timestamp: new Date(),
            exporterName: 'writer',
          });
        }
      }),
    });
    bus.registerExporter(exporter);
    await bus.flush();
    expect(flushes).toBeGreaterThanOrEqual(2); // looped after the drop
  });

  it('shutdown flushes, shuts exporters down, and clears subscribers', async () => {
    const bus = new PulseBus();
    const exporter = makeExporter();
    const seen: PulseBusEvent[] = [];
    bus.registerExporter(exporter);
    bus.subscribe(e => seen.push(e));

    await bus.shutdown();
    expect(exporter.shutdown).toHaveBeenCalled();
    bus.emit(pulseEvent());
    expect(seen).toHaveLength(0); // subscribers cleared
    expect(exporter.events).toHaveLength(1); // exporters remain routable by design
  });
});
