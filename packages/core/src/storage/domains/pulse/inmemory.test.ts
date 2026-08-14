import { describe, expect, it } from 'vitest';
import type { PulseRecord } from './base';
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

  it('sums cost from metric-lane pulses', async () => {
    const s = store();
    await s.batchCreatePulses(completedFlow('flow-1'));
    await s.batchCreatePulses([
      pulse({
        source: 'metric',
        surface: 'model',
        action: 'mastra_output_tokens',
        data: { estimated_cost_usd: 0.0002 },
      }),
      pulse({
        source: 'metric',
        surface: 'model',
        action: 'mastra_input_tokens',
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
