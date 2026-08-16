import { describe, expect, it, vi } from 'vitest';
import type { FlowIndexRow, PulseRecord, PulseRelationshipRecord, PulseStorage } from '../storage/domains/pulse';
import { PulseStorageExporter } from './storage-exporter';
import type { PulseBusEvent, PulseDropEvent } from './types';

function pulseEvent(id: string): PulseBusEvent {
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

function relationshipEvent(id: string): PulseBusEvent {
  return {
    type: 'relationship',
    record: {
      id,
      timestamp: new Date(),
      seq: 2,
      type: 'origin_of',
      from: { kind: 'pulse', id: 'span-1' },
      to: { kind: 'flow', id: 'flow-1' },
      traceId: 'flow-1',
    },
  };
}

function fakeStorage(overrides: Partial<PulseStorage> = {}) {
  const pulses: PulseRecord[][] = [];
  const relationships: PulseRelationshipRecord[][] = [];
  const upserts: FlowIndexRow[][] = [];
  const storage = {
    batchCreatePulses: vi.fn(async (records: PulseRecord[]) => {
      pulses.push(records);
    }),
    batchCreateRelationships: vi.fn(async (records: PulseRelationshipRecord[]) => {
      relationships.push(records);
    }),
    supportsFlowIndex: () => true,
    upsertFlowSummaries: vi.fn(async (rows: FlowIndexRow[]) => {
      upserts.push(rows);
    }),
    ...overrides,
  } as unknown as PulseStorage;
  return { storage, pulses, relationships, upserts };
}

describe('PulseStorageExporter', () => {
  it('buffers events and writes both tables on flush', async () => {
    const { storage, pulses, relationships } = fakeStorage();
    const exporter = new PulseStorageExporter({ storage });
    exporter.onPulseEvent(pulseEvent('p1'));
    exporter.onPulseEvent(relationshipEvent('r1'));
    expect(pulses).toHaveLength(0);

    await exporter.flush();
    expect(pulses[0]!.map(r => r.id)).toEqual(['p1']);
    expect(relationships[0]!.map(r => r.id)).toEqual(['r1']);
    await exporter.shutdown();
  });

  it('flushes when the batch size is reached', async () => {
    const { storage, pulses } = fakeStorage();
    const exporter = new PulseStorageExporter({ storage, batchSize: 2 });
    exporter.onPulseEvent(pulseEvent('p1'));
    expect(pulses).toHaveLength(0);
    exporter.onPulseEvent(pulseEvent('p2'));
    await exporter.flush();
    expect(pulses[0]!.map(r => r.id)).toEqual(['p1', 'p2']);
    await exporter.shutdown();
  });

  it('retries a failed batch once, then succeeds without dropping', async () => {
    const { storage, pulses } = fakeStorage();
    (storage.batchCreatePulses as any).mockRejectedValueOnce(new Error('transient'));
    const drops: PulseDropEvent[] = [];
    const exporter = new PulseStorageExporter({ storage, onDrop: e => drops.push(e) });
    exporter.onPulseEvent(pulseEvent('p1'));
    await exporter.flush();
    expect(pulses).toHaveLength(1);
    expect(drops).toHaveLength(0);
    expect(exporter.dropped).toBe(0);
    await exporter.shutdown();
  });

  it('drops only what individually fails after retry exhaustion, reported via onDrop', async () => {
    // Pulse writes are down; relationship writes are healthy. The per-record
    // fallback keeps the relationship and drops only the pulse row.
    const { storage, relationships } = fakeStorage({
      batchCreatePulses: vi.fn().mockRejectedValue(new Error('down')) as any,
    });
    const drops: PulseDropEvent[] = [];
    const exporter = new PulseStorageExporter({ storage, onDrop: e => drops.push(e) });
    exporter.onPulseEvent(pulseEvent('p1'));
    exporter.onPulseEvent(relationshipEvent('r1'));
    await exporter.flush();
    expect(exporter.dropped).toBe(1);
    expect(relationships.flat().map(r => r.id)).toEqual(['r1']);
    expect(drops).toHaveLength(1);
    expect(drops[0]).toMatchObject({ type: 'drop', signal: 'pulse', count: 1, exporterName: 'pulse-storage' });
    await exporter.shutdown();
  });

  it('resolves an async storage provider lazily, once, and writes pre-resolution rows', async () => {
    const { storage, pulses } = fakeStorage();
    const provider = vi.fn(async () => storage);
    const exporter = new PulseStorageExporter({ storage: provider });
    exporter.onPulseEvent(pulseEvent('p1'));
    expect(provider).not.toHaveBeenCalled(); // lazy — nothing resolved until flush

    await exporter.flush();
    exporter.onPulseEvent(pulseEvent('p2'));
    await exporter.flush();
    expect(provider).toHaveBeenCalledTimes(1); // memoized
    expect(pulses.flat().map(r => r.id)).toEqual(['p1', 'p2']);
    await exporter.shutdown();
  });

  it('drops with a clear reason when no storage resolves', async () => {
    const drops: PulseDropEvent[] = [];
    const exporter = new PulseStorageExporter({ storage: async () => undefined, onDrop: e => drops.push(e) });
    exporter.onPulseEvent(pulseEvent('p1'));
    await exporter.flush();
    expect(exporter.dropped).toBe(1);
    expect(drops[0]!.reason).toContain('no pulse storage');
    await exporter.shutdown();
  });

  it('shutdown drains remaining buffered records', async () => {
    const { storage, pulses } = fakeStorage();
    const exporter = new PulseStorageExporter({ storage });
    exporter.onPulseEvent(pulseEvent('p1'));
    await exporter.shutdown();
    expect(pulses.flat().map(r => r.id)).toEqual(['p1']);
  });
});

const T0 = new Date('2026-08-14T10:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);
let flowSeq = 0;
function span(traceId: string, overrides: Partial<PulseRecord> = {}): PulseBusEvent {
  return {
    type: 'pulse',
    record: {
      id: `f${++flowSeq}`,
      timestamp: T0,
      seq: flowSeq,
      type: 'state',
      surface: 'agent',
      action: 'run_started',
      traceId,
      threadId: 't-1',
      spanId: 'root',
      source: 'span',
      ...overrides,
    },
  };
}

describe('PulseStorageExporter flow index', () => {
  it('never upserts when flowIndex is off (the default)', async () => {
    const { storage } = fakeStorage();
    const exporter = new PulseStorageExporter({ storage });
    exporter.onPulseEvent(span('flow-1', { timestamp: at(0) }));
    exporter.onPulseEvent(span('flow-1', { action: 'run_completed', type: 'output', timestamp: at(1000) }));
    await exporter.shutdown();
    expect(storage.upsertFlowSummaries).not.toHaveBeenCalled();
  });

  it('upserts running then completed across two flushes with rising versions', async () => {
    const { storage, upserts } = fakeStorage();
    const exporter = new PulseStorageExporter({ storage, flowIndex: true });
    exporter.onPulseEvent(span('flow-1', { timestamp: at(0), metadata: { entityName: 'support' } }));
    await exporter.flush();
    expect(upserts).toHaveLength(1);
    expect(upserts[0]![0]).toMatchObject({
      flowId: 'flow-1',
      status: 'running',
      durationMs: null,
      threadId: 't-1',
      entityName: 'support',
      pulseCount: 1,
      startedAt: at(0),
    });

    exporter.onPulseEvent(
      span('flow-1', {
        action: 'run_completed',
        type: 'output',
        timestamp: at(1000),
        data: { total_output_tokens: 42, cost_usd: 0.0002 },
      }),
    );
    await exporter.flush();
    expect(upserts).toHaveLength(2);
    expect(upserts[1]![0]).toMatchObject({
      flowId: 'flow-1',
      status: 'completed',
      durationMs: 1000,
      endedAt: at(1000),
      pulseCount: 2,
      costUsd: 0.0002,
    });
    expect(upserts[1]![0]!.version).toBeGreaterThan(upserts[0]![0]!.version);
    await exporter.shutdown();
  });

  it('lets a session abort in the next batch override a completed flow', async () => {
    const { storage, upserts } = fakeStorage();
    const exporter = new PulseStorageExporter({ storage, flowIndex: true });
    exporter.onPulseEvent(span('flow-1', { timestamp: at(0) }));
    exporter.onPulseEvent(span('flow-1', { action: 'run_completed', type: 'output', timestamp: at(1000) }));
    await exporter.flush();
    expect(upserts[0]![0]!.status).toBe('completed');

    exporter.onPulseEvent(
      span('', {
        traceId: '',
        threadId: 't-1',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: at(1500), // inside the [start, last + 2s] window
      }),
    );
    await exporter.flush();
    expect(upserts[1]![0]).toMatchObject({ flowId: 'flow-1', status: 'aborted', durationMs: 1000 });
    await exporter.shutdown();
  });

  it('ignores aborts outside the flow window or for other threads', async () => {
    const { storage, upserts } = fakeStorage();
    const exporter = new PulseStorageExporter({ storage, flowIndex: true });
    exporter.onPulseEvent(span('flow-1', { timestamp: at(0) }));
    exporter.onPulseEvent(span('flow-1', { action: 'run_completed', type: 'output', timestamp: at(1000) }));
    exporter.onPulseEvent(
      span('', {
        traceId: '',
        threadId: 't-other',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: at(1500),
      }),
    );
    exporter.onPulseEvent(
      span('', {
        traceId: '',
        threadId: 't-1',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: at(5000), // past the +2s window
      }),
    );
    await exporter.shutdown();
    expect(upserts).toHaveLength(1);
    expect(upserts[0]![0]!.status).toBe('completed');
  });

  it('marks a flow failed as soon as an error pulse arrives', async () => {
    const { storage, upserts } = fakeStorage();
    const exporter = new PulseStorageExporter({ storage, flowIndex: true });
    exporter.onPulseEvent(span('flow-1', { timestamp: at(0) }));
    exporter.onPulseEvent(
      span('flow-1', {
        spanId: 'gen',
        parentSpanId: 'root',
        surface: 'model',
        action: 'generate_failed',
        type: 'error',
        timestamp: at(500),
      }),
    );
    await exporter.flush();
    // failed even without a root terminal — mirrors the derived precedence
    expect(upserts[0]![0]).toMatchObject({ status: 'failed', durationMs: null });
    await exporter.shutdown();
  });

  it('skips upserts for adapters without flow-index support', async () => {
    const upsert = vi.fn();
    const { storage, pulses } = fakeStorage({
      supportsFlowIndex: () => false,
      upsertFlowSummaries: upsert,
    } as Partial<PulseStorage>);
    const exporter = new PulseStorageExporter({ storage, flowIndex: true });
    exporter.onPulseEvent(span('flow-1', { timestamp: at(0) }));
    await exporter.shutdown();
    expect(pulses.flat()).toHaveLength(1); // raw write still happens
    expect(upsert).not.toHaveBeenCalled();
  });

  it('evicts terminal flows one flush after their terminal upsert; late pulses bump nothing', async () => {
    const { storage, upserts } = fakeStorage();
    const exporter = new PulseStorageExporter({ storage, flowIndex: true });
    exporter.onPulseEvent(span('flow-1', { timestamp: at(0) }));
    exporter.onPulseEvent(span('flow-1', { action: 'run_completed', type: 'output', timestamp: at(1000) }));
    await exporter.flush(); // terminal upserted
    await exporter.flush(); // evicted

    exporter.onPulseEvent(
      span('flow-1', { spanId: 'late', parentSpanId: 'root', action: 'step_started', timestamp: at(3000) }),
    );
    await exporter.shutdown();
    // the late pulse must not re-open the flow as running
    expect(upserts).toHaveLength(1);
    expect(upserts[0]![0]!.status).toBe('completed');
  });
});

describe('exact abort attribution in the accumulators (runId join)', () => {
  it('marks only the flow whose runId the abort names', async () => {
    const { storage, upserts } = fakeStorage();
    const exporter = new PulseStorageExporter({ storage, flowIndex: true });
    // Two completed runs on one thread, inside the 2s legacy window.
    exporter.onPulseEvent(span('flow-a', { runId: 'run-1', timestamp: at(0) }));
    exporter.onPulseEvent(
      span('flow-a', { runId: 'run-1', action: 'run_completed', type: 'output', timestamp: at(500) }),
    );
    exporter.onPulseEvent(span('flow-b', { runId: 'run-2', timestamp: at(700) }));
    exporter.onPulseEvent(
      span('flow-b', { runId: 'run-2', action: 'run_completed', type: 'output', timestamp: at(1200) }),
    );
    exporter.onPulseEvent({
      type: 'pulse',
      record: {
        id: 'ab1',
        timestamp: at(1400),
        seq: 999,
        type: 'state',
        surface: 'run_control',
        action: 'abort_completed',
        traceId: '',
        threadId: 't-1',
        runId: 'run-1',
        source: 'session',
      },
    });
    await exporter.shutdown();

    const rows = upserts.flat();
    const last = (id: string) =>
      rows
        .filter(r => r.flowId === id)
        .sort((a, b) => a.version - b.version)
        .at(-1)!;
    expect(last('flow-a').status).toBe('aborted');
    expect(last('flow-b').status).toBe('completed');
  });
});

describe('poison-record resilience', () => {
  /**
   * A ClickHouse-style adapter JSON.stringifies each record; ONE record with
   * an unserializable attribute must not take the other records in the batch
   * down with it. Batch fails → fall back to per-record writes → drop only
   * the poison row.
   */
  it('one unserializable record drops 1 row, not the batch', async () => {
    const serialized: string[] = [];
    const { storage } = fakeStorage({
      batchCreatePulses: vi.fn(async (records: PulseRecord[]) => {
        // Atomic like a real insert: serialize everything, then commit.
        const rows = records.map(r => JSON.stringify(r.attributes ?? {}));
        serialized.push(...rows);
      }) as any,
    });
    const exporter = new PulseStorageExporter({ storage });

    const cyclic: any = { name: 'x' };
    cyclic.self = cyclic;
    exporter.onPulseEvent(pulseEvent('good-1'));
    exporter.onPulseEvent({
      type: 'pulse',
      record: { ...pulseEvent('poison').record, attributes: { boom: 10n as any, cyclic } },
    });
    exporter.onPulseEvent(pulseEvent('good-2'));
    await exporter.flush();

    expect(serialized.length).toBe(2); // both good rows landed
    expect(exporter.dropped).toBe(1); // only the poison row was dropped
  });
});

describe('drop visibility', () => {
  it('records an events_dropped pulse row after storage recovers', async () => {
    let failing = true;
    const written: PulseRecord[][] = [];
    const { storage } = fakeStorage({
      batchCreatePulses: vi.fn(async (records: PulseRecord[]) => {
        if (failing) throw new Error('storage down');
        written.push(records);
      }) as any,
    });
    const exporter = new PulseStorageExporter({
      storage,
      onDrop: e => exporter.onDroppedEvent?.(e),
    });

    exporter.onPulseEvent(pulseEvent('lost-1'));
    exporter.onPulseEvent(pulseEvent('lost-2'));
    await exporter.flush(); // both write attempts fail → batch dropped
    expect(exporter.dropped).toBe(2);

    failing = false;
    exporter.onPulseEvent(pulseEvent('after'));
    await exporter.flush();

    const all = written.flat();
    const dropRow = all.find(r => r.action === 'events_dropped');
    expect(dropRow, 'a drop pulse row must record the hole').toBeDefined();
    expect(dropRow!.data?.count).toBe(2);
    expect(dropRow!.source).toBe('drop');
  });
});
