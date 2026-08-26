import { createClient } from '@clickhouse/client';
import { PulseStorageExporter } from '@mastra/core/pulse';
import type { PulseRecord } from '@mastra/core/storage';
import { beforeAll, describe, expect, it } from 'vitest';
import { PulseStorageClickhouse } from './index';

/**
 * Integration test against a live ClickHouse (the dedicated pulse-clickhouse
 * dev container on :8124). Skips when unreachable so CI without the container
 * stays green. Mirrors the InMemoryPulseStorage derivation tests — the two
 * adapters must agree on the rules.
 */

const URL = process.env.PULSE_TEST_CH_URL ?? 'http://localhost:8124';
const USER = process.env.PULSE_TEST_CH_USER ?? 'pulse';
const PASSWORD = process.env.PULSE_TEST_CH_PASSWORD ?? 'pulse';
const DATABASE = 'pulse_domain_test';

let available = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${URL}/ping`);
    available = res.ok;
  } catch {
    available = false;
  }
  if (!available) return;
  const admin = createClient({ url: URL, username: USER, password: PASSWORD });
  await admin.command({ query: `CREATE DATABASE IF NOT EXISTS ${DATABASE}` });
  await admin.close();
});

const T0 = new Date('2026-08-14T10:00:00.000Z');
const at = (ms: number) => new Date(T0.getTime() + ms);

function makeStore() {
  const client = createClient({ url: URL, username: USER, password: PASSWORD, database: DATABASE });
  return new PulseStorageClickhouse({ client });
}

describe('PulseStorageClickhouse (live)', () => {
  it('derives flows, status, tree, timeline and cost from appended rows', async ctx => {
    if (!available) return ctx.skip();
    const store = makeStore();
    await store.init();
    await store.dangerouslyClearAll();

    let seq = 0;
    const p = (o: Record<string, any>) => ({
      id: `p${++seq}`,
      timestamp: T0,
      seq,
      type: 'state' as const,
      surface: 'agent',
      action: 'run_started',
      traceId: 'flow-1',
      runId: 'run-1',
      source: 'span',
      ...o,
    });

    await store.batchCreatePulses([
      p({ spanId: 'root', threadId: 't-1', timestamp: at(0) }),
      p({
        spanId: 'gen',
        parentSpanId: 'root',
        threadId: 't-1',
        surface: 'model',
        action: 'generate_started',
        timestamp: at(100),
      }),
      p({
        spanId: 'gen',
        parentSpanId: 'root',
        threadId: 't-1',
        surface: 'model',
        action: 'generate_completed',
        type: 'output',
        data: { total_output_tokens: 9, cost_usd: 0.0003 },
        timestamp: at(900),
      }),
      p({ spanId: 'root', threadId: 't-1', action: 'run_completed', type: 'output', timestamp: at(1000) }),
      // non-span lanes carry no flow cost; session lane carries an approval fact
      p({
        source: 'metric',
        surface: 'model',
        action: 'metric_recorded',
        data: { value: 9 },
        timestamp: at(1100),
      }),
      p({
        traceId: '',
        threadId: 't-1',
        runId: 'run-1',
        source: 'session',
        surface: 'tool_approval',
        action: 'required',
        type: 'decision',
        timestamp: at(500),
      }),
      // ANOTHER run's fact on the same thread: timelines join by exact runId,
      // so this must never leak into flow-1's timeline.
      p({
        traceId: '',
        threadId: 't-1',
        runId: 'run-other',
        source: 'session',
        surface: 'session',
        action: 'config_changed',
        timestamp: at(510),
      }),
      // a second flow, aborted via the session-layer override (exact runId join)
      p({ traceId: 'flow-2', spanId: 'root2', threadId: 't-2', runId: 'run-2', timestamp: at(0) }),
      p({
        traceId: 'flow-2',
        spanId: 'root2',
        threadId: 't-2',
        runId: 'run-2',
        action: 'run_completed',
        type: 'output',
        timestamp: at(800),
      }),
      p({
        traceId: '',
        threadId: 't-2',
        runId: 'run-2',
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: at(900),
      }),
    ]);
    await store.batchCreateRelationships([
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

    const { flows, total } = await store.listFlows();
    expect(total).toBe(2);
    const flow1 = flows.find(f => f.flowId === 'flow-1')!;
    expect(flow1).toMatchObject({ threadId: 't-1', status: 'completed', durationMs: 1000 });
    expect(flow1.costUsd).toBeCloseTo(0.0003);
    expect(flows.find(f => f.flowId === 'flow-2')!.status).toBe('aborted');

    const detail = await store.getFlow('flow-1');
    expect(detail!.tree).toHaveLength(2);
    expect(detail!.tree.find(n => n.spanId === 'gen')).toMatchObject({
      parentSpanId: 'root',
      label: 'model.generate',
      durationMs: 800,
    });
    expect(detail!.definitions).toEqual(['model:openai/gpt-4o-mini']);

    const timeline = await store.getFlowTimeline('flow-1');
    expect(timeline.map(t => `${t.source}:${t.action}`)).toEqual([
      'span:run_started',
      'span:generate_started',
      'session:required',
      'span:generate_completed',
      'span:run_completed',
      'metric:metric_recorded',
    ]);

    const filtered = await store.listFlows({ filter: { status: 'aborted' } });
    expect(filtered.flows).toHaveLength(1);
  });

  /**
   * (flow-index experiment removed — flows are always derived at read)
   * once through the real exporter land in the raw tables AND the versioned
   * `flows` index. The FINAL index read must match the derived read
   * (status/duration/cost), and running → completed must be visible across
   * two flushes.
   */
});

describe('exact abort attribution (runId join, live)', () => {
  it('aborts only the flow containing the abort runId; never guesses without one', async ctx => {
    if (!available) return ctx.skip();
    const store = makeStore();
    await store.init();
    await store.dangerouslyClearAll();

    let n = 100;
    const p = (o: Record<string, any>) => ({
      id: `q${++n}`,
      timestamp: T0,
      seq: n,
      type: 'state' as const,
      surface: 'agent',
      action: 'run_started',
      traceId: 'x',
      source: 'span',
      threadId: 't-1',
      ...o,
    });

    await store.batchCreatePulses([
      // Two runs, one thread, inside the legacy 2s window.
      p({ traceId: 'flow-a', runId: 'run-1', spanId: 'ra', timestamp: at(0) }),
      p({
        traceId: 'flow-a',
        runId: 'run-1',
        spanId: 'ra',
        action: 'run_completed',
        type: 'output',
        timestamp: at(500),
      }),
      p({ traceId: 'flow-b', runId: 'run-2', spanId: 'rb', timestamp: at(700) }),
      p({
        traceId: 'flow-b',
        runId: 'run-2',
        spanId: 'rb',
        action: 'run_completed',
        type: 'output',
        timestamp: at(1200),
      }),
      // The abort names run-1 → only flow-a may flip.
      p({
        traceId: '',
        runId: 'run-1',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: at(1400),
      }),
      // No runId → no attribution, ever (the guess is gone).
      p({ traceId: 'flow-l', threadId: 't-9', spanId: 'rl', timestamp: at(0) }),
      p({
        traceId: 'flow-l',
        threadId: 't-9',
        spanId: 'rl',
        action: 'run_completed',
        type: 'output',
        timestamp: at(400),
      }),
      p({
        traceId: '',
        threadId: 't-9',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: at(800),
      }),
    ]);

    const { flows } = await store.listFlows();
    const status = Object.fromEntries(flows.map(f => [f.flowId, f.status]));
    expect(status['flow-a']).toBe('aborted');
    expect(status['flow-b']).toBe('completed');
    expect(status['flow-l']).toBe('completed');
  });
});

describe('status rule parity: ClickHouse must match the in-memory oracle', () => {
  it('produces identical statuses and durations on the edge-case fixture', async ctx => {
    if (!available) return ctx.skip();
    const { InMemoryPulseStorage } = await import('@mastra/core/storage');
    const ch = makeStore();
    await ch.init();
    await ch.dangerouslyClearAll();

    // Recent timestamps: un-terminated flows read as running (not stale) on
    // both adapters — CH staleness uses wall-clock now().
    const B = Date.now() - 15_000;
    const bt = (ms: number) => new Date(B + ms);
    let n = 500;
    const p = (o: Record<string, any>) => ({
      id: `e${++n}`,
      timestamp: bt(0),
      seq: n,
      type: 'state' as const,
      surface: 'agent',
      action: 'run_started',
      traceId: 'x',
      source: 'span',
      ...o,
    });

    const fixture = [
      // (1) Two flows, one thread, TWO aborts — each names its own run and
      // must flip exactly its own flow (exact runId join, no windows).
      p({ traceId: 'flow-w1', threadId: 't-w', runId: 'run-w1', spanId: 'w1', timestamp: bt(0) }),
      p({
        traceId: 'flow-w1',
        threadId: 't-w',
        runId: 'run-w1',
        spanId: 'w1',
        action: 'run_completed',
        type: 'output',
        timestamp: bt(400),
      }),
      p({
        traceId: '',
        threadId: 't-w',
        runId: 'run-w1',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: bt(600),
      }),
      p({ traceId: 'flow-w2', threadId: 't-w', runId: 'run-w2', spanId: 'w2', timestamp: bt(5_000) }),
      p({
        traceId: 'flow-w2',
        threadId: 't-w',
        runId: 'run-w2',
        spanId: 'w2',
        action: 'run_completed',
        type: 'output',
        timestamp: bt(5_400),
      }),
      p({
        traceId: '',
        threadId: 't-w',
        runId: 'run-w2',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: bt(5_600),
      }),
      // (2) completed then a later parentless _failed WITHOUT error type —
      // the LAST terminal decides (countIf(completed) says completed).
      p({ traceId: 'flow-cf', threadId: 't-c', spanId: 'c1', timestamp: bt(0) }),
      p({
        traceId: 'flow-cf',
        threadId: 't-c',
        spanId: 'c1',
        action: 'run_completed',
        type: 'output',
        timestamp: bt(300),
      }),
      p({ traceId: 'flow-cf', threadId: 't-c', spanId: 'c1', action: 'run_failed', type: 'state', timestamp: bt(500) }),
      // (3) unescaped LIKE wildcard: 'restarted' is NOT a *_started action —
      // it must not become the duration's root start.
      p({ traceId: 'flow-x', threadId: 't-x', spanId: 'x1', action: 'restarted', timestamp: bt(0) }),
      p({ traceId: 'flow-x', threadId: 't-x', spanId: 'x1', action: 'run_started', timestamp: bt(1_000) }),
      p({
        traceId: 'flow-x',
        threadId: 't-x',
        spanId: 'x1',
        action: 'run_completed',
        type: 'output',
        timestamp: bt(2_000),
      }),
      // (4) child error + completed root → completed (root terminal law).
      p({ traceId: 'flow-ch', threadId: 't-h', runId: 'run-h', spanId: 'h-root', timestamp: bt(0) }),
      p({
        traceId: 'flow-ch',
        threadId: 't-h',
        runId: 'run-h',
        spanId: 'h-tool',
        parentSpanId: 'h-root',
        surface: 'tool',
        action: 'call_failed',
        type: 'error',
        timestamp: bt(300),
      }),
      p({
        traceId: 'flow-ch',
        threadId: 't-h',
        runId: 'run-h',
        spanId: 'h-root',
        action: 'run_completed',
        type: 'output',
        timestamp: bt(900),
      }),
      // (5) empty-thread abort row must match nothing.
      p({ traceId: 'flow-e', threadId: '', spanId: 'e1', timestamp: bt(0) }),
      p({
        traceId: '',
        threadId: '',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: bt(100),
      }),
    ];

    const mem = new InMemoryPulseStorage();
    await mem.batchCreatePulses(fixture as any);
    await ch.batchCreatePulses(fixture as any);

    const memFlows = (await mem.listFlows()).flows;
    const chFlows = (await ch.listFlows()).flows;
    const shape = (flows: any[]) => Object.fromEntries(flows.map(f => [f.flowId, `${f.status}|dur=${f.durationMs}`]));
    expect(shape(chFlows)).toEqual(shape(memFlows));
    // Pin the oracle's own answers so BOTH adapters are checked, not just parity.
    expect(shape(memFlows)).toEqual({
      'flow-w1': 'aborted|dur=400',
      'flow-w2': 'aborted|dur=400',
      'flow-cf': 'failed|dur=500',
      'flow-x': 'completed|dur=1000',
      'flow-ch': 'completed|dur=900',
      'flow-e': 'running|dur=null',
    });
  });
});

describe('read-time cost derivation (live)', () => {
  it('derives from usage × latest price version; retroactive corrections recompute', async ctx => {
    if (!available) return ctx.skip();
    const store = makeStore();
    await store.init();
    await store.dangerouslyClearAll();

    let seq = 0;
    const p = (o: Record<string, any>) => ({
      id: `pc${++seq}`,
      timestamp: at(seq * 100),
      seq,
      type: 'state' as const,
      surface: 'agent',
      action: 'run_started',
      traceId: 'flow-cost',
      runId: 'run-cost',
      spanId: `s${seq}`,
      source: 'native',
      ...o,
    });
    await store.batchCreatePulses([
      p({ spanId: 'root' }),
      p({
        spanId: 'gen',
        parentSpanId: 'root',
        surface: 'model',
        action: 'generate_completed',
        type: 'output',
        data: { total_input_tokens: 1000, total_output_tokens: 500 },
        attributes: { model: 'gpt-4o-mini', provider: 'openai' },
      }),
      p({ spanId: 'root', action: 'run_completed', type: 'output' }),
    ] as any);

    await store.upsertModelPrices([
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        currency: 'USD',
        version: 1,
        validFrom: T0,
        tiers: [{ rates: { input_tokens: 0.00001, output_tokens: 0.00002 } }],
      },
    ]);
    let { flows } = await store.listFlows();
    expect(flows[0]!.costUsd).toBeCloseTo(1000 * 0.00001 + 500 * 0.00002, 10);

    await store.upsertModelPrices([
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        currency: 'USD',
        version: 2,
        validFrom: T0,
        tiers: [{ rates: { input_tokens: 0.0001, output_tokens: 0.0002 } }],
      },
    ]);
    ({ flows } = await store.listFlows());
    expect(flows[0]!.costUsd).toBeCloseTo(1000 * 0.0001 + 500 * 0.0002, 10);
  });
});

describe('flow list pushdown (live)', () => {
  it('filters by resourceId and reports true totals past 1000 flows', async ctx => {
    if (!available) return ctx.skip();
    const store = makeStore();
    await store.init();
    await store.dangerouslyClearAll();

    // 1005 tiny flows: totals must come from SQL, not an in-memory page
    // over a capped scan (the old FLOW_SCAN_CAP=1000 silently truncated).
    const rows = [];
    for (let i = 0; i < 1005; i++) {
      rows.push({
        id: `bulk-${i}`,
        timestamp: at(i),
        seq: i + 1,
        type: 'state' as const,
        surface: 'agent',
        action: 'run_started',
        traceId: `bulk-flow-${i}`,
        spanId: `root-${i}`,
        resourceId: i % 2 === 0 ? 'user-even' : 'user-odd',
        source: 'span',
      });
    }
    await store.batchCreatePulses(rows);

    const all = await store.listFlows({ pagination: { page: 0, perPage: 10 } });
    expect(all.total).toBe(1005);
    expect(all.flows).toHaveLength(10);

    const even = await store.listFlows({ filter: { resourceId: 'user-even' }, pagination: { page: 0, perPage: 5 } });
    expect(even.total).toBe(503);
    expect(even.flows).toHaveLength(5);
    expect(even.flows.every(f => f.resourceId === 'user-even')).toBe(true);
  });
});

describe('graph proof (live): native arrows join to pulses by id in SQL', () => {
  it('membership via trace_id columns (the pulse stance); tree via parent_of JOIN pulses', async ctx => {
    if (!available) return ctx.skip();
    const { mintFactId } = await import('@mastra/core/pulse');
    const store = makeStore();
    await store.init();
    await store.dangerouslyClearAll();

    // Native facts, exactly as emitLifecycleFact mints them: computed ids,
    // trace_id = runId, synthetic node keys, parent_of arrows between fact ids.
    const runId = 'run-g';
    const runStartId = mintFactId(runId, 'agent', 'run', 'started');
    const genStartId = mintFactId(runId, 'model', 'generate', 'started');
    let seq = 0;
    const p = (o: Record<string, any>) => ({
      timestamp: at(seq * 100),
      seq: ++seq,
      type: 'state' as const,
      traceId: runId,
      runId,
      source: 'native',
      ...o,
    });
    await store.batchCreatePulses([
      p({ id: runStartId, surface: 'agent', action: 'run_started', spanId: 'agent.run.0' }),
      p({
        id: genStartId,
        surface: 'model',
        action: 'generate_started',
        spanId: 'model.generate.0',
        parentSpanId: 'agent.run.0',
      }),
      p({
        id: mintFactId(runId, 'model', 'generate', 'ended'),
        surface: 'model',
        action: 'generate_completed',
        type: 'output',
        spanId: 'model.generate.0',
        parentSpanId: 'agent.run.0',
      }),
      p({
        id: mintFactId(runId, 'agent', 'run', 'ended'),
        surface: 'agent',
        action: 'run_completed',
        type: 'output',
        spanId: 'agent.run.0',
      }),
    ] as any);
    await store.batchCreateRelationships([
      {
        id: 'r-origin',
        timestamp: at(0),
        seq: 100,
        type: 'origin_of',
        from: { kind: 'pulse', id: runStartId },
        to: { kind: 'flow', id: runId },
        traceId: runId,
      },
      {
        id: 'r-parent',
        timestamp: at(0),
        seq: 101,
        type: 'parent_of',
        from: { kind: 'pulse', id: runStartId },
        to: { kind: 'pulse', id: genStartId },
        traceId: runId,
      },
    ] as any);

    const client = createClient({ url: URL, username: USER, password: PASSWORD, database: DATABASE });
    // MEMBERSHIP STANCE: pulse derives flow membership from the trace_id
    // column (flow = run), not from flow_contains rows — the native lane
    // deliberately emits no membership edges. (Escalated design decision:
    // columns vs authoritative relationships.)
    const membership = await client.query({
      query: `SELECT count() AS n FROM pulses WHERE trace_id = 'run-g'`,
      format: 'JSONEachRow',
    });
    expect(Number(((await membership.json()) as { n: string | number }[])[0]!.n)).toBe(4);

    // The flow is still DECLARED by an arrow: origin_of from the run fact.
    const origin = await client.query({
      query: `SELECT count() AS n FROM relationships r INNER JOIN pulses p ON p.id = r.from_id
              WHERE r.type = 'origin_of' AND r.to_kind = 'flow' AND r.to_id = 'run-g'`,
      format: 'JSONEachRow',
    });
    expect(Number(((await origin.json()) as { n: string | number }[])[0]!.n)).toBe(1);

    // Tree via parent_of joined to pulses on BOTH endpoints — pure fact ids.
    const tree = await client.query({
      query: `SELECT pp.span_id AS parent, pc.span_id AS child
              FROM relationships r
              INNER JOIN pulses pp ON pp.id = r.from_id
              INNER JOIN pulses pc ON pc.id = r.to_id
              WHERE r.type = 'parent_of'`,
      format: 'JSONEachRow',
    });
    const treeRows = (await tree.json()) as { parent: string; child: string }[];
    expect(treeRows.map(t => `${t.parent}->${t.child}`)).toEqual(['agent.run.0->model.generate.0']);
    await client.close();
  });
});

describe('write idempotency by stable id (ack-lost retries, live)', () => {
  it('duplicate delivery of the same batch changes no derived answer', async ctx => {
    if (!available) return ctx.skip();
    const store = makeStore();
    await store.init();
    await store.dangerouslyClearAll();

    let n = 700;
    const p = (o: Record<string, any>) => ({
      id: `dup${++n}`,
      timestamp: at(0),
      seq: n,
      type: 'state' as const,
      surface: 'agent',
      action: 'run_started',
      traceId: 'flow-dup',
      threadId: 't-d',
      runId: 'run-d',
      spanId: 'root',
      source: 'span',
      ...o,
    });
    const batchP = [
      p({ timestamp: at(0) }),
      p({
        spanId: 'gen',
        parentSpanId: 'root',
        surface: 'model',
        action: 'generate_completed',
        type: 'output',
        data: { cost_usd: 0.0005 },
        timestamp: at(400),
      }),
      p({ action: 'run_completed', type: 'output', timestamp: at(1000) }),
    ];
    const batchR = [
      {
        id: 'r-dup-1',
        timestamp: at(400),
        seq: 990,
        type: 'uses_model_settings',
        from: { kind: 'pulse' as const, id: 'px' },
        to: { kind: 'definition' as const, id: 'model:openai/gpt-4o-mini' },
        traceId: 'flow-dup',
      },
    ];
    await store.batchCreatePulses(batchP);
    await store.batchCreatePulses(batchP); // retry after lost ack
    await store.batchCreateRelationships(batchR);
    await store.batchCreateRelationships(batchR);

    const { flows } = await store.listFlows();
    const f = flows.find(x => x.flowId === 'flow-dup')!;
    expect(f.pulseCount).toBe(3);
    expect(f.costUsd).toBeCloseTo(0.0005);
    expect(f.durationMs).toBe(1000);

    const detail = await store.getFlow('flow-dup');
    expect(detail!.tree).toHaveLength(2);
    expect(detail!.definitions).toEqual(['model:openai/gpt-4o-mini']);

    const timeline = await store.getFlowTimeline('flow-dup');
    expect(timeline).toHaveLength(3);
  });

  it('a root run_aborted terminal derives status aborted (same rule as in-memory)', async ctx => {
    if (!available) return ctx.skip();
    const store = makeStore();
    await store.init();
    await store.dangerouslyClearAll();

    let seq = 0;
    const p = (o: Record<string, any>) => ({
      id: `ab${++seq}`,
      timestamp: T0,
      seq,
      type: 'state' as const,
      surface: 'agent',
      action: 'run_started',
      traceId: 'flow-ab',
      runId: 'run-ab',
      source: 'native',
      ...o,
    });
    await store.batchCreatePulses([
      p({ spanId: 'agent.run.0', timestamp: at(0) }),
      p({ spanId: 'agent.run.0', action: 'run_aborted', timestamp: at(700) }),
    ] as PulseRecord[]);

    const { flows } = await store.listFlows();
    const f = flows.find(x => x.flowId === 'flow-ab');
    expect(f).toMatchObject({ status: 'aborted' });
    expect(f!.durationMs).toBe(700);
  });
});
