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
        timestamp: at(900),
      }),
      p({ spanId: 'root', threadId: 't-1', action: 'run_completed', type: 'output', timestamp: at(1000) }),
      // metric lane carries cost; session lane carries an approval fact
      p({
        source: 'metric',
        surface: 'model',
        action: 'mastra_output_tokens',
        data: { estimated_cost_usd: 0.0003 },
        timestamp: at(1100),
      }),
      p({
        traceId: '',
        threadId: 't-1',
        source: 'session',
        surface: 'tool_approval',
        action: 'required',
        type: 'decision',
        timestamp: at(500),
      }),
      // a second flow, aborted via the session-layer override
      p({ traceId: 'flow-2', spanId: 'root2', threadId: 't-2', timestamp: at(0) }),
      p({
        traceId: 'flow-2',
        spanId: 'root2',
        threadId: 't-2',
        action: 'run_completed',
        type: 'output',
        timestamp: at(800),
      }),
      p({
        traceId: '',
        threadId: 't-2',
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
      'metric:mastra_output_tokens',
    ]);

    const filtered = await store.listFlows({ filter: { status: 'aborted' } });
    expect(filtered.flows).toHaveLength(1);
  });

  /**
   * Flow-index experiment (behind `pulse.flowIndex`): the same rows written
   * once through the real exporter land in the raw tables AND the versioned
   * `flows` index. The FINAL index read must match the derived read
   * (status/duration/cost), and running → completed must be visible across
   * two flushes.
   */
  it('maintains the flows index through the exporter and matches derived reads', async ctx => {
    if (!available) return ctx.skip();
    const store = makeStore();
    await store.init();
    await store.dangerouslyClearAll();
    expect(store.supportsFlowIndex()).toBe(true);

    // Recent timestamps so unterminated flows read as running (not stale)
    // on BOTH paths — derived staleness keys off pulse timestamps.
    const B = Date.now() - 15_000;
    const ts = (ms: number) => new Date(B + ms);
    const exporter = new PulseStorageExporter({ storage: store, flowIndex: true, flushIntervalMs: 600_000 });
    let n = 0;
    const emit = (o: Partial<PulseRecord>) =>
      exporter.onPulseEvent({
        type: 'pulse',
        record: {
          id: `x${++n}`,
          timestamp: ts(0),
          seq: n,
          type: 'state',
          surface: 'agent',
          action: 'run_started',
          traceId: 'flow-a',
          threadId: 't-a',
          spanId: 'root',
          source: 'span',
          metadata: { entityName: 'support' },
          ...o,
        } as PulseRecord,
      });

    // Flush 1: flow-a has only its root start → the index says running.
    emit({ timestamp: ts(0) });
    await exporter.flush();
    const mid = await store.listFlowsFromIndex();
    expect(mid.flows.map(f => `${f.flowId}:${f.status}`)).toEqual(['flow-a:running']);

    // Flush 2: flow-a completes (bridge-folded cost), flow-b fails,
    // flow-c completes then a session abort overrides it.
    emit({
      spanId: 'gen',
      parentSpanId: 'root',
      surface: 'model',
      action: 'generate_completed',
      type: 'output',
      data: { total_output_tokens: 42, cost_usd: 0.0004 },
      timestamp: ts(400),
    });
    emit({ action: 'run_completed', type: 'output', timestamp: ts(1000) });
    emit({ traceId: 'flow-b', threadId: 't-b', metadata: undefined, timestamp: ts(2000) });
    emit({
      traceId: 'flow-b',
      threadId: 't-b',
      metadata: undefined,
      action: 'run_failed',
      type: 'error',
      level: 'error',
      timestamp: ts(2500),
    });
    emit({ traceId: 'flow-c', threadId: 't-c', metadata: undefined, timestamp: ts(3000) });
    emit({
      traceId: 'flow-c',
      threadId: 't-c',
      metadata: undefined,
      action: 'run_completed',
      type: 'output',
      timestamp: ts(3600),
    });
    emit({
      traceId: '',
      threadId: 't-c',
      spanId: undefined,
      source: 'session',
      surface: 'run_control',
      action: 'abort_completed',
      metadata: undefined,
      timestamp: ts(3800),
    });
    await exporter.shutdown();

    const derived = await store.listFlows();
    const indexed = await store.listFlowsFromIndex();
    expect(indexed.total).toBe(derived.total);
    expect(derived.flows.map(f => `${f.flowId}:${f.status}`)).toEqual([
      'flow-c:aborted',
      'flow-b:failed',
      'flow-a:completed',
    ]);
    for (const d of derived.flows) {
      const i = indexed.flows.find(f => f.flowId === d.flowId)!;
      expect(i, `index row for ${d.flowId}`).toBeDefined();
      expect(`${i.flowId}:${i.status}`).toBe(`${d.flowId}:${d.status}`);
      expect(i.durationMs).toBe(d.durationMs);
      expect(i.threadId).toBe(d.threadId);
      expect(i.pulseCount).toBe(d.pulseCount);
      expect(i.entityName).toBe(d.entityName);
      expect(i.startedAt.getTime()).toBe(d.startedAt.getTime());
      if (d.costUsd == null) expect(i.costUsd).toBeUndefined();
      else expect(i.costUsd).toBeCloseTo(d.costUsd, 8);
    }

    const aborted = await store.listFlowsFromIndex({ filter: { status: 'aborted' } });
    expect(aborted.flows.map(f => f.flowId)).toEqual(['flow-c']);
    expect(aborted.total).toBe(1);
  });
});

describe('exact abort attribution (runId join, live)', () => {
  it('aborts only the flow containing the abort runId; window fallback for legacy rows', async ctx => {
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
      // Legacy shape on another thread: no runId → window fallback still works.
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
    expect(status['flow-l']).toBe('aborted');
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
      // (1) Two flows, one thread, TWO legacy aborts (no runId) — each abort
      // must be able to match its own flow (min-per-thread loses the 2nd).
      p({ traceId: 'flow-w1', threadId: 't-w', spanId: 'w1', timestamp: bt(0) }),
      p({
        traceId: 'flow-w1',
        threadId: 't-w',
        spanId: 'w1',
        action: 'run_completed',
        type: 'output',
        timestamp: bt(400),
      }),
      p({
        traceId: '',
        threadId: 't-w',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: bt(600),
      }),
      p({ traceId: 'flow-w2', threadId: 't-w', spanId: 'w2', timestamp: bt(5_000) }),
      p({
        traceId: 'flow-w2',
        threadId: 't-w',
        spanId: 'w2',
        action: 'run_completed',
        type: 'output',
        timestamp: bt(5_400),
      }),
      p({
        traceId: '',
        threadId: 't-w',
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
      // (4) empty-thread abort row must match nothing.
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
      'flow-cf': 'running|dur=null',
      'flow-x': 'completed|dur=1000',
      'flow-e': 'running|dur=null',
    });
  });
});

describe('graph proof (live): edges join to pulses by id in SQL', () => {
  it('reconstructs membership and tree via relationships JOIN pulses ON id', async ctx => {
    if (!available) return ctx.skip();
    const { PulseBridge, PulseBus } = await import('@mastra/core/pulse');
    const store = makeStore();
    await store.init();
    await store.dangerouslyClearAll();

    const bus = new PulseBus();
    const exporter = new PulseStorageExporter({ storage: store, flushIntervalMs: 600_000 });
    bus.registerExporter(exporter);
    const bridge = new PulseBridge({ bus });

    const mkSpan = (o: Record<string, any>) => ({
      name: 'x',
      type: 'agent_run',
      traceId: 'flow-g',
      startTime: at(0),
      endTime: at(1000),
      isRootSpan: false,
      isEvent: false,
      metadata: {},
      attributes: {},
      ...o,
    });
    const root = mkSpan({ id: 'root', isRootSpan: true });
    const child = mkSpan({ id: 'child', parentSpanId: 'root', type: 'model_generation' });
    await bridge.exportTracingEvent({ type: 'span_started', exportedSpan: root } as any);
    await bridge.exportTracingEvent({ type: 'span_started', exportedSpan: child } as any);
    await bridge.exportTracingEvent({ type: 'span_ended', exportedSpan: child } as any);
    await bridge.exportTracingEvent({ type: 'span_ended', exportedSpan: root } as any);
    await exporter.shutdown();

    const client = createClient({ url: URL, username: USER, password: PASSWORD, database: DATABASE });
    // Membership via SQL join on PULSE IDS — no trace_id column on the edge walk.
    const membership = await client.query({
      query: `SELECT count() AS n FROM relationships r INNER JOIN pulses p ON p.id = r.to_id
              WHERE r.type = 'flow_contains' AND r.from_kind = 'flow' AND r.from_id = 'flow-g'`,
      format: 'JSONEachRow',
    });
    const memRows = (await membership.json()) as { n: string | number }[];
    expect(Number(memRows[0]!.n)).toBe(4); // 2 starts + 2 ends

    // Tree via parent_of joined to pulses on BOTH endpoints.
    const tree = await client.query({
      query: `SELECT pp.span_id AS parent, pc.span_id AS child
              FROM relationships r
              INNER JOIN pulses pp ON pp.id = r.from_id
              INNER JOIN pulses pc ON pc.id = r.to_id
              WHERE r.type = 'parent_of'`,
      format: 'JSONEachRow',
    });
    const treeRows = (await tree.json()) as { parent: string; child: string }[];
    expect(treeRows.map(t => `${t.parent}->${t.child}`)).toEqual(['root->child']);
    await client.close();
  });
});
