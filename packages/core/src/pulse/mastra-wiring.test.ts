import { describe, expect, it, vi } from 'vitest';
import { Mastra } from '../mastra';
import { MastraCompositeStore } from '../storage/base';
import type { PulseRecord, PulseRelationshipRecord } from '../storage/domains/pulse';
import { PulseStorage } from '../storage/domains/pulse';
import { InMemoryStore } from '../storage/mock';
import { PulseStorageExporter } from './storage-exporter';
import type { PulseBusEvent, PulseBusExporter } from './types';

/** Minimal recording pulse storage (reads are not under test here). */
class RecordingPulseStorage extends PulseStorage {
  pulses: PulseRecord[] = [];
  relationships: PulseRelationshipRecord[] = [];

  async batchCreatePulses(records: PulseRecord[]): Promise<void> {
    this.pulses.push(...records);
  }
  async batchCreateRelationships(records: PulseRelationshipRecord[]): Promise<void> {
    this.relationships.push(...records);
  }
  async listFlows(): Promise<any> {
    return { flows: [], total: 0 };
  }
  async getFlow(): Promise<any> {
    return null;
  }
  async getFlowTimeline(): Promise<any> {
    return [];
  }
  async dangerouslyClearAll(): Promise<void> {
    this.pulses = [];
    this.relationships = [];
  }
}

function pulseEvent(id = 'p1'): PulseBusEvent {
  return {
    type: 'pulse',
    record: {
      id,
      timestamp: new Date(),
      seq: 1,
      type: 'state',
      surface: 'agent',
      action: 'run_started',
      traceId: 'flow-1',
      source: 'span',
    },
  };
}

describe('Mastra pulse wiring', () => {
  it('constructs NOTHING pulse-related without a pulse config (stock behavior)', () => {
    const mastra = new Mastra({});
    expect(mastra.pulseBus).toBeUndefined();
  });

  it('constructs the bus with a storage exporter when pulse is configured', async () => {
    const storage = new RecordingPulseStorage();
    const mastra = new Mastra({ pulse: { storage } });

    const bus = mastra.pulseBus;
    expect(bus).toBeDefined();
    expect(bus!.getExporters().some(e => e instanceof PulseStorageExporter)).toBe(true);

    bus!.emit(pulseEvent());
    await bus!.flush();
    expect(storage.pulses.map(p => p.id)).toEqual(['p1']);

    await mastra.shutdown();
  });

  it('registers additional configured exporters on the bus', () => {
    const events: PulseBusEvent[] = [];
    const custom: PulseBusExporter = {
      name: 'custom',
      onPulseEvent: e => {
        events.push(e);
      },
      flush: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
    };
    const mastra = new Mastra({ pulse: { storage: new RecordingPulseStorage(), exporters: [custom] } });
    mastra.pulseBus!.emit(pulseEvent());
    expect(events).toHaveLength(1);
  });

  it('defaults to the composite store pulse domain, resolved lazily via getStore', async () => {
    const pulseDomain = new RecordingPulseStorage();
    const storage = new MastraCompositeStore({
      id: 'composite-with-pulse',
      default: new InMemoryStore(),
      domains: { pulse: pulseDomain },
    });
    const mastra = new Mastra({ storage, pulse: {} });

    mastra.pulseBus!.emit(pulseEvent());
    await mastra.pulseBus!.flush();
    expect(pulseDomain.pulses.map(p => p.id)).toEqual(['p1']);
    await mastra.shutdown();
  });

  it('flushes cleanly when the configured store has no pulse domain (records drop, nothing throws)', async () => {
    const mastra = new Mastra({ pulse: {} }); // default InMemoryStore ships no pulse domain
    expect(mastra.pulseBus).toBeDefined();
    mastra.pulseBus!.emit(pulseEvent());
    await expect(mastra.pulseBus!.flush()).resolves.toBeUndefined();
    await mastra.shutdown();
  });

  it('shutdown drains buffered pulse records into storage', async () => {
    const storage = new RecordingPulseStorage();
    const mastra = new Mastra({ pulse: { storage } });
    mastra.pulseBus!.emit(pulseEvent('late'));
    await mastra.shutdown();
    expect(storage.pulses.map(p => p.id)).toEqual(['late']);
  });
});

describe('Mastra shutdown ordering for pulse', () => {
  /**
   * The final pulse batch must be written BEFORE the app storage closes —
   * otherwise a lazily-resolved `getStore('pulse')` writes into a closed
   * store and the last batch of a short-lived process dies.
   */
  it('drains pulse writers before closing storage', async () => {
    const order: string[] = [];
    const pulseDomain = new RecordingPulseStorage();
    const origWrite = pulseDomain.batchCreatePulses.bind(pulseDomain);
    pulseDomain.batchCreatePulses = async records => {
      order.push('pulse-write');
      await origWrite(records);
    };
    const app = new InMemoryStore();
    const origClose = app.close?.bind(app);
    (app as any).close = async () => {
      order.push('storage-close');
      await origClose?.();
    };

    const mastra = new Mastra({ storage: app, pulse: { storage: pulseDomain } });
    mastra.pulseBus!.emit(pulseEvent('late'));
    await mastra.shutdown();

    expect(pulseDomain.pulses.map(p => p.id)).toContain('late');
    expect(order.indexOf('pulse-write')).toBeGreaterThanOrEqual(0);
    expect(order.indexOf('storage-close')).toBeGreaterThan(order.indexOf('pulse-write'));
  });
});

describe('custom-exporter-only configuration (no storage anywhere)', () => {
  /**
   * `new Mastra({ pulse: { exporters: [custom] } })` with NO pulse storage
   * is a legitimate setup (ship facts to your own sink). It must not
   * register a storage writer whose lazy resolve fails and reports every
   * batch as "dropped: no pulse storage" — false alarms for a healthy
   * config (external review finding).
   */
  it('delivers to the custom exporter with zero false drops', async () => {
    const events: PulseBusEvent[] = [];
    const drops: unknown[] = [];
    const custom: PulseBusExporter = {
      name: 'custom-sink',
      onPulseEvent: e => {
        events.push(e);
      },
      onDroppedEvent: d => {
        drops.push(d);
      },
      flush: async () => {},
      shutdown: async () => {},
    };
    const mastra = new Mastra({ pulse: { exporters: [custom] } });
    mastra.pulseBus!.emit(pulseEvent('only-custom'));
    await mastra.pulseBus!.flush();

    expect(events.map(e => (e as any).record.id)).toEqual(['only-custom']);
    expect(drops, 'no false "missing storage" drops').toHaveLength(0);
    await mastra.shutdown();
  });
});
