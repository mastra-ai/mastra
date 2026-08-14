import { describe, expect, it } from 'vitest';
import { PulseStorageExporter } from '../../../pulse/storage-exporter';
import type { FlowIndexRow, PulseRecord } from './base';
import { InMemoryPulseStorage } from './inmemory';

const T0 = new Date('2026-08-14T10:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

let seq = 0;
function pulse(overrides: Partial<PulseRecord>): PulseRecord {
  return {
    id: `p${++seq}`,
    timestamp: T0,
    seq,
    type: 'state',
    surface: 'agent',
    action: 'run_started',
    traceId: 'flow-1',
    source: 'span',
    ...overrides,
  };
}

/** A minimal completed agent flow: root start/end + one child model span. */
function completedFlow(traceId: string, threadId?: string): PulseRecord[] {
  return [
    pulse({ traceId, threadId, spanId: 'root', action: 'run_started', timestamp: at(0) }),
    pulse({
      traceId,
      threadId,
      spanId: 'gen',
      parentSpanId: 'root',
      surface: 'model',
      action: 'generate_started',
      timestamp: at(100),
    }),
    pulse({
      traceId,
      threadId,
      spanId: 'gen',
      parentSpanId: 'root',
      surface: 'model',
      action: 'generate_completed',
      type: 'output',
      timestamp: at(900),
    }),
    pulse({ traceId, threadId, spanId: 'root', action: 'run_completed', type: 'output', timestamp: at(1000) }),
  ];
}

function store(nowMs = T0.getTime() + 5_000) {
  return new InMemoryPulseStorage({ now: () => nowMs });
}

describe('InMemoryPulseStorage (derivation rules)', () => {
  it('derives a completed flow with duration from paired root pulses', async () => {
    const s = store();
    await s.batchCreatePulses(completedFlow('flow-1', 't-1'));
    const { flows, total } = await s.listFlows();
    expect(total).toBe(1);
    expect(flows[0]).toMatchObject({ flowId: 'flow-1', threadId: 't-1', status: 'completed', durationMs: 1000 });
  });

  it('derives failed when any error pulse exists', async () => {
    const s = store();
    const rows = completedFlow('flow-1');
    rows[2] = { ...rows[2]!, type: 'error', action: 'generate_failed' };
    await s.batchCreatePulses(rows);
    const { flows } = await s.listFlows();
    expect(flows[0]!.status).toBe('failed');
  });

  it('lets the session-layer abort fact override a completed span outcome', async () => {
    const s = store();
    await s.batchCreatePulses(completedFlow('flow-1', 't-1'));
    await s.batchCreatePulses([
      pulse({
        traceId: '',
        threadId: 't-1',
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: at(1100),
      }),
    ]);
    const { flows } = await s.listFlows();
    expect(flows[0]!.status).toBe('aborted');
    expect(flows[0]!.durationMs).toBe(1000);
  });

  it('marks unterminated quiet flows stale, fresh ones running', async () => {
    const stale = store(T0.getTime() + 60_000);
    await stale.batchCreatePulses([pulse({ spanId: 'root', timestamp: at(0) })]);
    expect((await stale.listFlows()).flows[0]!.status).toBe('stale');

    const running = store(T0.getTime() + 5_000);
    await running.batchCreatePulses([pulse({ spanId: 'root', timestamp: at(0) })]);
    const flow = (await running.listFlows()).flows[0]!;
    expect(flow.status).toBe('running');
    expect(flow.durationMs).toBeNull();
  });

  it('rebuilds the tree with per-node durations and definitions', async () => {
    const s = store();
    await s.batchCreatePulses(completedFlow('flow-1'));
    await s.batchCreateRelationships([
      {
        id: 'r1',
        timestamp: at(900),
        seq: 99,
        type: 'uses_model_settings',
        from: { kind: 'pulse', id: 'gen' },
        to: { kind: 'definition', id: 'model:openai/gpt-4o-mini' },
        traceId: 'flow-1',
      },
    ]);
    const detail = await s.getFlow('flow-1');
    expect(detail!.tree).toHaveLength(2);
    const gen = detail!.tree.find(n => n.spanId === 'gen')!;
    expect(gen).toMatchObject({ parentSpanId: 'root', label: 'model.generate', durationMs: 800, hasError: false });
    expect(detail!.definitions).toEqual(['model:openai/gpt-4o-mini']);
  });

  it('sums cost dual-read: bridge-folded span pulses AND legacy metric-lane rows', async () => {
    const s = store();
    const rows = completedFlow('flow-1');
    // New shape: the bridge folds cost onto the semantic model pulse.
    rows[2] = { ...rows[2]!, data: { total_output_tokens: 42, cost_usd: 0.0002 } };
    await s.batchCreatePulses(rows);
    // Legacy shape: metric-lane row (old databases).
    await s.batchCreatePulses([
      pulse({
        source: 'metric',
        surface: 'model',
        action: 'mastra_output_tokens',
        data: { estimated_cost_usd: 0.0001 },
      }),
    ]);
    const { flows } = await s.listFlows();
    expect(flows[0]!.costUsd).toBeCloseTo(0.0003);
  });

  it('interleaves session-lane facts into the timeline by thread', async () => {
    const s = store();
    await s.batchCreatePulses(completedFlow('flow-1', 't-1'));
    await s.batchCreatePulses([
      pulse({
        traceId: '',
        threadId: 't-1',
        source: 'session',
        surface: 'tool_approval',
        action: 'required',
        type: 'decision',
        timestamp: at(500),
      }),
    ]);
    const timeline = await s.getFlowTimeline('flow-1');
    expect(timeline.map(t => `${t.source}:${t.action}`)).toEqual([
      'span:run_started',
      'span:generate_started',
      'session:required',
      'span:generate_completed',
      'span:run_completed',
    ]);
  });

  it('filters and paginates flow lists', async () => {
    const s = store();
    for (let i = 0; i < 5; i++) {
      const rows = completedFlow(`flow-${i}`, `t-${i}`).map(p => ({
        ...p,
        timestamp: at(i * 10_000 + (p.timestamp.getTime() - T0.getTime())),
      }));
      await s.batchCreatePulses(rows);
    }
    const page = await s.listFlows({ pagination: { page: 0, perPage: 2 } });
    expect(page.total).toBe(5);
    expect(page.flows).toHaveLength(2);
    expect(page.flows[0]!.flowId).toBe('flow-4'); // most recent first
    const filtered = await s.listFlows({ filter: { threadId: 't-2' } });
    expect(filtered.flows).toHaveLength(1);
  });
});

function indexRow(overrides: Partial<FlowIndexRow> = {}): FlowIndexRow {
  return {
    flowId: 'flow-1',
    version: 1,
    startedAt: T0,
    status: 'completed',
    durationMs: 1000,
    threadId: 't-1',
    pulseCount: 4,
    costUsd: 0.0002,
    ...overrides,
  };
}

describe('InMemoryPulseStorage flow index', () => {
  it('supports the flow index and lists upserted rows', async () => {
    const s = store();
    expect(s.supportsFlowIndex()).toBe(true);
    await s.upsertFlowSummaries([indexRow()]);
    const { flows, total } = await s.listFlowsFromIndex();
    expect(total).toBe(1);
    expect(flows[0]).toMatchObject({
      flowId: 'flow-1',
      threadId: 't-1',
      status: 'completed',
      durationMs: 1000,
      pulseCount: 4,
      costUsd: 0.0002,
    });
  });

  it('keeps only the highest version per flow (replacing semantics)', async () => {
    const s = store();
    await s.upsertFlowSummaries([indexRow({ version: 1, status: 'running', durationMs: null })]);
    await s.upsertFlowSummaries([indexRow({ version: 2, status: 'completed', durationMs: 1000 })]);
    // A stale lower version arriving late must not win.
    await s.upsertFlowSummaries([indexRow({ version: 1, status: 'running', durationMs: null })]);
    const { flows } = await s.listFlowsFromIndex();
    expect(flows).toHaveLength(1);
    expect(flows[0]).toMatchObject({ status: 'completed', durationMs: 1000 });
  });

  it('presents quiet running rows as stale at read time', async () => {
    let now = T0.getTime();
    const s = new InMemoryPulseStorage({ now: () => now });
    await s.upsertFlowSummaries([indexRow({ status: 'running', durationMs: null })]);
    expect((await s.listFlowsFromIndex()).flows[0]!.status).toBe('running');

    now = T0.getTime() + 60_000; // quiet past the 30s threshold
    expect((await s.listFlowsFromIndex()).flows[0]!.status).toBe('stale');

    // terminal rows never go stale
    await s.upsertFlowSummaries([indexRow({ flowId: 'flow-2', version: 2, status: 'completed' })]);
    now = T0.getTime() + 600_000;
    const { flows } = await s.listFlowsFromIndex({ filter: { status: 'completed' } });
    expect(flows.map(f => f.flowId)).toEqual(['flow-2']);
  });

  it('filters and paginates the index like listFlows', async () => {
    const s = store();
    await s.upsertFlowSummaries(
      Array.from({ length: 5 }, (_, i) =>
        indexRow({
          flowId: `flow-${i}`,
          version: i + 1,
          startedAt: at(i * 10_000),
          threadId: `t-${i}`,
          entityName: i % 2 ? 'support' : 'triage',
        }),
      ),
    );
    const page = await s.listFlowsFromIndex({ pagination: { page: 0, perPage: 2 } });
    expect(page.total).toBe(5);
    expect(page.flows.map(f => f.flowId)).toEqual(['flow-4', 'flow-3']); // most recent first
    expect((await s.listFlowsFromIndex({ filter: { threadId: 't-2' } })).flows).toHaveLength(1);
    expect((await s.listFlowsFromIndex({ filter: { entityName: 'support' } })).total).toBe(2);
    expect((await s.listFlowsFromIndex({ filter: { fromDate: at(20_000), toDate: at(30_000) } })).total).toBe(2);
  });

  /**
   * The correctness A/B: the same records fed once through a real
   * PulseStorageExporter (flowIndex on) land in BOTH the raw tables (derived
   * path) and the index. The two reads must agree. Legitimate differences,
   * excluded by construction here and documented in the experiment verdict:
   * - legacy metric-lane cost (data.estimated_cost_usd) is summed by the
   *   derived read but not indexed (the index is for the new pipeline where
   *   cost is folded onto span pulses as data.cost_usd);
   * - index staleness keys off the last UPSERT time, derived staleness off
   *   the last pulse timestamp — equal whenever upserts follow pulses
   *   promptly, as they do in the real writer;
   * - pulseCount is a writer-side approximation (late pulses after the
   *   terminal eviction bump nothing).
   */
  it('index results equal derived results for identical inputs through a real exporter', async () => {
    let now = T0.getTime() + 5_000;
    const s = new InMemoryPulseStorage({ now: () => now });
    const exporter = new PulseStorageExporter({ storage: s, flowIndex: true, flushIntervalMs: 600_000 });
    const emit = (records: PulseRecord[]) =>
      records.forEach(record => exporter.onPulseEvent({ type: 'pulse', record }));

    // stale flow: a lone root start that then goes quiet
    emit([pulse({ traceId: 'flow-stale', threadId: 't-s', spanId: 'root', timestamp: at(0) })]);
    // completed flow with bridge-folded cost on the model pulse
    const done = completedFlow('flow-done', 't-1').map(p =>
      p.action === 'generate_completed' ? { ...p, data: { total_output_tokens: 42, cost_usd: 0.0002 } } : p,
    );
    emit(done.map(p => ({ ...p, timestamp: at(2_000 + (p.timestamp.getTime() - T0.getTime())) })));
    // failed flow: child model span errors
    const failed = completedFlow('flow-failed', 't-2').map(p =>
      p.action === 'generate_completed' ? { ...p, type: 'error' as const, action: 'generate_failed' } : p,
    );
    emit(failed.map(p => ({ ...p, timestamp: at(4_000 + (p.timestamp.getTime() - T0.getTime())) })));
    // aborted flow: span layer completes, session abort fact overrides
    emit(
      completedFlow('flow-aborted', 't-3').map(p => ({
        ...p,
        timestamp: at(6_000 + (p.timestamp.getTime() - T0.getTime())),
      })),
    );
    emit([
      pulse({
        traceId: '',
        threadId: 't-3',
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: at(7_500),
      }),
    ]);
    await exporter.flush();

    // running flow: written close to the read time, still fresh
    now = T0.getTime() + 58_000;
    emit([pulse({ traceId: 'flow-live', threadId: 't-l', spanId: 'root', timestamp: at(55_000) })]);
    await exporter.flush();
    await exporter.shutdown();

    now = T0.getTime() + 60_000; // stale flow is 60s quiet; live flow 5s
    const derived = await s.listFlows();
    const indexed = await s.listFlowsFromIndex();

    expect(indexed.total).toBe(derived.total);
    expect(indexed.flows).toEqual(derived.flows);
    expect(derived.flows.map(f => `${f.flowId}:${f.status}`)).toEqual([
      'flow-live:running',
      'flow-aborted:aborted',
      'flow-failed:failed',
      'flow-done:completed',
      'flow-stale:stale',
    ]);
    // and the filters see the same world
    expect(await s.listFlowsFromIndex({ filter: { status: 'aborted' } })).toEqual(
      await s.listFlows({ filter: { status: 'aborted' } }),
    );
  });
});
