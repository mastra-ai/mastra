import { describe, expect, it } from 'vitest';
import { PulseStorageExporter } from '../../../pulse/storage-exporter';
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
  const runId = `run-${traceId}`;
  return [
    pulse({ traceId, threadId, runId, spanId: 'root', action: 'run_started', timestamp: at(0) }),
    pulse({
      traceId,
      threadId,
      runId,
      spanId: 'gen',
      parentSpanId: 'root',
      surface: 'model',
      action: 'generate_started',
      timestamp: at(100),
    }),
    pulse({
      traceId,
      threadId,
      runId,
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

  it('derives failed only from the ROOT terminal', async () => {
    const s = store();
    const rows = completedFlow('flow-1');
    // Root run_completed → run_failed: the root's terminal decides.
    rows[3] = { ...rows[3]!, type: 'error', action: 'run_failed' };
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
        runId: 'run-flow-1',
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
    // Non-span lanes never carry flow cost — only the folded span data does.
    await s.batchCreatePulses([
      pulse({
        source: 'metric',
        surface: 'model',
        action: 'metric_recorded',
        data: { value: 42 },
      }),
    ]);
    const { flows } = await s.listFlows();
    expect(flows[0]!.costUsd).toBeCloseTo(0.0002);
  });

  it('interleaves non-span facts into the timeline by exact run membership', async () => {
    const s = store();
    await s.batchCreatePulses(completedFlow('flow-1', 't-1'));
    await s.batchCreatePulses([
      pulse({
        traceId: '',
        threadId: 't-1',
        runId: 'run-flow-1',
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

  it("never leaks another run's thread-scoped facts into a flow timeline", async () => {
    const s = store();
    // Two runs share thread t-1. Each flow's timeline must contain ONLY its
    // own run's non-span facts — membership is by exact runId, never by
    // thread (two concurrent runs on one thread would otherwise inherit each
    // other's approvals/follow-ups). RunId-less thread facts stay thread-level.
    await s.batchCreatePulses(completedFlow('flow-1', 't-1'));
    await s.batchCreatePulses(completedFlow('flow-2', 't-1'));
    await s.batchCreatePulses([
      pulse({
        traceId: '',
        threadId: 't-1',
        runId: 'run-flow-2',
        source: 'session',
        surface: 'tool_approval',
        action: 'required',
        type: 'decision',
        timestamp: at(500),
      }),
      pulse({
        traceId: '',
        threadId: 't-1',
        source: 'session',
        surface: 'session',
        action: 'config_changed',
        type: 'state',
        timestamp: at(510),
      }),
    ]);
    const t1 = await s.getFlowTimeline('flow-1');
    expect(t1.every(e => e.source === 'span')).toBe(true);
    const t2 = await s.getFlowTimeline('flow-2');
    expect(t2.map(e => `${e.source}:${e.action}`)).toContain('session:required');
    expect(t2.map(e => `${e.source}:${e.action}`)).not.toContain('session:config_changed');
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

  it('derives cost at read time from usage × the latest price version', async () => {
    const s = store();
    const rows = completedFlow('flow-c1', 't-1');
    // Model end fact carries first-hand usage + model identity — no stored cost.
    rows[2] = {
      ...rows[2]!,
      data: { total_input_tokens: 1000, total_output_tokens: 500 },
      attributes: { model: 'gpt-4o-mini', provider: 'openai' },
    };
    await s.batchCreatePulses(rows);
    await s.upsertModelPrices([
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        currency: 'USD',
        version: 1,
        validFrom: T0,
        tiers: [{ rates: { input_tokens: 0.00001, output_tokens: 0.00002 } }],
      },
    ]);
    let { flows } = await s.listFlows();
    expect(flows[0]!.costUsd).toBeCloseTo(1000 * 0.00001 + 500 * 0.00002, 10);

    // Retroactive correction: append version 2 → the SAME historical flow's
    // cost recomputes at read. Write-time folding could never do this.
    await s.upsertModelPrices([
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        currency: 'USD',
        version: 2,
        validFrom: T0,
        tiers: [{ rates: { input_tokens: 0.0001, output_tokens: 0.0002 } }],
      },
    ]);
    ({ flows } = await s.listFlows());
    expect(flows[0]!.costUsd).toBeCloseTo(1000 * 0.0001 + 500 * 0.0002, 10);
  });

  it('stored folded cost stays readable when no price row matches (older data)', async () => {
    const s = store();
    const rows = completedFlow('flow-c2', 't-2');
    rows[2] = { ...rows[2]!, data: { total_output_tokens: 42, cost_usd: 0.0002 } };
    await s.batchCreatePulses(rows);
    const { flows } = await s.listFlows();
    expect(flows[0]!.costUsd).toBeCloseTo(0.0002, 10);
  });

  it('filters flows by resourceId', async () => {
    const s = store();
    await s.batchCreatePulses(completedFlow('flow-a', 't-1').map(p => ({ ...p, resourceId: 'user-a' })));
    await s.batchCreatePulses(completedFlow('flow-b', 't-2').map(p => ({ ...p, resourceId: 'user-b' })));
    const { flows, total } = await s.listFlows({ filter: { resourceId: 'user-a' } });
    expect(total).toBe(1);
    expect(flows.map(f => f.flowId)).toEqual(['flow-a']);
    expect(flows[0]!.resourceId).toBe('user-a');
  });
});

describe('exact abort attribution (runId join)', () => {
  /**
   * Two runs on ONE thread inside the legacy 2s window; the abort names the
   * FIRST run. The thread+window heuristic marks both flows aborted — the
   * runId join must mark exactly the right one.
   */
  it('aborts only the flow containing the abort pulse runId', async () => {
    const s = new InMemoryPulseStorage();
    const runFlow = (traceId: string, runId: string, startMs: number): PulseRecord[] => [
      pulse({
        traceId,
        threadId: 't-1',
        runId,
        spanId: `root-${runId}`,
        action: 'run_started',
        timestamp: at(startMs),
      }),
      pulse({
        traceId,
        threadId: 't-1',
        runId,
        spanId: `root-${runId}`,
        action: 'run_completed',
        type: 'output',
        timestamp: at(startMs + 500),
      }),
    ];
    await s.batchCreatePulses([
      ...runFlow('flow-a', 'run-1', 0),
      ...runFlow('flow-b', 'run-2', 700),
      pulse({
        traceId: '',
        threadId: 't-1',
        runId: 'run-1',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: at(1_400),
      }),
    ]);

    const { flows } = await s.listFlows();
    const status = Object.fromEntries(flows.map(f => [f.flowId, f.status]));
    expect(status['flow-a']).toBe('aborted');
    expect(status['flow-b']).toBe('completed');
  });

  it('ignores abort facts without a runId — attribution is never guessed', async () => {
    const s = new InMemoryPulseStorage();
    await s.batchCreatePulses([
      pulse({ traceId: 'flow-l', threadId: 't-9', spanId: 'root', action: 'run_started', timestamp: at(0) }),
      pulse({
        traceId: 'flow-l',
        threadId: 't-9',
        spanId: 'root',
        action: 'run_completed',
        type: 'output',
        timestamp: at(500),
      }),
      pulse({
        traceId: '',
        threadId: 't-9',
        spanId: undefined,
        source: 'session',
        surface: 'run_control',
        action: 'abort_completed',
        timestamp: at(900),
      }),
    ]);
    const { flows } = await s.listFlows();
    expect(flows[0]!.status).toBe('completed');
  });
});

describe('root lifecycle controls flow failure (child errors are not fatal)', () => {
  /**
   * A tool that errored and was retried inside a run that COMPLETED fine
   * must not mark the whole flow failed — the error stays visible on the
   * node (hasError), the flow status follows the ROOT terminal (external
   * review finding: handled child failures flipped flows to failed).
   */
  it('child error + root completed → completed', async () => {
    const s = store();
    await s.batchCreatePulses([
      pulse({
        traceId: 'flow-ce',
        threadId: 't-1',
        runId: 'run-ce',
        spanId: 'root',
        action: 'run_started',
        timestamp: at(0),
      }),
      pulse({
        traceId: 'flow-ce',
        threadId: 't-1',
        runId: 'run-ce',
        spanId: 'tool1',
        parentSpanId: 'root',
        surface: 'tool',
        action: 'call_failed',
        type: 'error',
        level: 'error',
        timestamp: at(200),
      }),
      pulse({
        traceId: 'flow-ce',
        threadId: 't-1',
        runId: 'run-ce',
        spanId: 'root',
        action: 'run_completed',
        type: 'output',
        timestamp: at(1000),
      }),
    ]);
    const { flows } = await s.listFlows();
    expect(flows[0]!.status).toBe('completed');

    // …but the error stays visible on the tree node.
    const detail = await s.getFlow('flow-ce');
    expect(detail!.tree.find(n => n.spanId === 'tool1')!.hasError).toBe(true);
  });

  it('root run_failed → failed', async () => {
    const s = store();
    await s.batchCreatePulses([
      pulse({ traceId: 'flow-rf', spanId: 'root', action: 'run_started', timestamp: at(0) }),
      pulse({
        traceId: 'flow-rf',
        spanId: 'root',
        action: 'run_failed',
        type: 'error',
        level: 'error',
        timestamp: at(500),
      }),
    ]);
    expect((await s.listFlows()).flows[0]!.status).toBe('failed');
  });
});

describe('write idempotency by stable id (ack-lost retries)', () => {
  /**
   * A write can succeed while its acknowledgement is lost — the writer
   * retries and the SAME records (same ids) arrive twice. Storage must
   * converge to one logical row per id: counts, costs and durations must
   * be identical to a single delivery (external review finding).
   */
  it('duplicate delivery of the same batch changes nothing', async () => {
    const s = store();
    const rows = completedFlow('flow-1', 't-1');
    rows[2] = { ...rows[2]!, data: { total_output_tokens: 42, cost_usd: 0.0002 } };
    await s.batchCreatePulses(rows);
    await s.batchCreatePulses(rows); // ← the retry after a lost ack

    const { flows } = await s.listFlows();
    expect(flows).toHaveLength(1);
    expect(flows[0]!.pulseCount).toBe(rows.length);
    expect(flows[0]!.costUsd).toBeCloseTo(0.0002);

    await s.batchCreateRelationships([
      {
        id: 'r-dup',
        timestamp: at(0),
        seq: 900,
        type: 'origin_of',
        from: { kind: 'pulse', id: 'p-x' },
        to: { kind: 'flow', id: 'flow-1' },
        traceId: 'flow-1',
      },
    ]);
    await s.batchCreateRelationships([
      {
        id: 'r-dup',
        timestamp: at(0),
        seq: 900,
        type: 'origin_of',
        from: { kind: 'pulse', id: 'p-x' },
        to: { kind: 'flow', id: 'flow-1' },
        traceId: 'flow-1',
      },
    ]);
    const detail = await s.getFlow('flow-1');
    // definitions derive from relationships — no double effects anywhere.
    expect(detail!.pulseCount).toBe(rows.length);
  });

  it('a root run_aborted terminal derives status aborted', async () => {
    const s = store();
    await s.batchCreatePulses([
      pulse({ traceId: 'flow-ab', runId: 'run-ab', spanId: 'root', action: 'run_started', timestamp: at(0) }),
      pulse({ traceId: 'flow-ab', runId: 'run-ab', spanId: 'root', action: 'run_aborted', timestamp: at(700) }),
    ]);
    const { flows } = await s.listFlows();
    expect(flows[0]).toMatchObject({ flowId: 'flow-ab', status: 'aborted', durationMs: 700 });
  });

  it('a root run_suspended is NOT terminal — the flow stays open', async () => {
    const s = store(T0.getTime() + 1_000); // well inside the stale threshold
    await s.batchCreatePulses([
      pulse({ traceId: 'flow-su', runId: 'run-su', spanId: 'root', action: 'run_started', timestamp: at(0) }),
      pulse({ traceId: 'flow-su', runId: 'run-su', spanId: 'root', action: 'run_suspended', timestamp: at(500) }),
    ]);
    const { flows } = await s.listFlows();
    expect(flows[0]!.status).toBe('running');
  });
});
