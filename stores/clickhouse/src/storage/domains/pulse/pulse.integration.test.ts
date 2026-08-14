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
