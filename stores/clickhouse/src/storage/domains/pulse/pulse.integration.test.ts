import { createClient } from '@clickhouse/client';
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
});
