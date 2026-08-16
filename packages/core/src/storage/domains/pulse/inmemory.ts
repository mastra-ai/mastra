import type {
  FlowDetail,
  FlowIndexRow,
  FlowStatus,
  FlowSummary,
  FlowTimelineEntry,
  FlowTreeNode,
  ListFlowsArgs,
  ListFlowsResult,
  PulseRecord,
  PulseRelationshipRecord,
} from './base';
import { PulseStorage } from './base';

/**
 * In-memory reference implementation of the Pulse domain. Doubles as the
 * executable definition of the derivation rules every adapter must match:
 * - flow membership = group by traceId (span lane)
 * - duration = paired parentless *_started / terminal pulse subtraction
 * - status = aborted (session-layer override) > failed > completed >
 *   stale (quiet past threshold) > running
 * - tree = parentSpanId chain with per-node derived durations
 * - cost = SUM of metric-lane estimated_cost_usd
 */
export class InMemoryPulseStorage extends PulseStorage {
  #pulses: PulseRecord[] = [];
  #relationships: PulseRelationshipRecord[] = [];
  /** Materialized flow index (experimental) — highest version per flow wins. */
  #flowIndex = new Map<string, FlowIndexRow & { updatedAt: Date }>();
  #staleThresholdMs: number;
  #now: () => number;

  constructor(options: { staleThresholdMs?: number; now?: () => number } = {}) {
    super();
    this.#staleThresholdMs = options.staleThresholdMs ?? 30_000;
    this.#now = options.now ?? (() => Date.now());
  }

  async batchCreatePulses(records: PulseRecord[]): Promise<void> {
    this.#pulses.push(...records);
  }

  async batchCreateRelationships(records: PulseRelationshipRecord[]): Promise<void> {
    this.#relationships.push(...records);
  }

  async dangerouslyClearAll(): Promise<void> {
    this.#pulses = [];
    this.#relationships = [];
    this.#flowIndex.clear();
  }

  supportsFlowIndex(): boolean {
    return true;
  }

  async upsertFlowSummaries(rows: FlowIndexRow[]): Promise<void> {
    for (const row of rows) {
      const existing = this.#flowIndex.get(row.flowId);
      // ReplacingMergeTree(version) semantics: highest version wins.
      if (existing && existing.version > row.version) continue;
      this.#flowIndex.set(row.flowId, { ...row, updatedAt: new Date(this.#now()) });
    }
  }

  async listFlowsFromIndex(args: ListFlowsArgs = {}): Promise<ListFlowsResult> {
    const { filter, pagination } = args;
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 40;

    // Stale is presented at READ time: the index cannot self-expire, so a
    // `running` row whose last upsert is older than the threshold is stale.
    let flows: FlowSummary[] = [...this.#flowIndex.values()].map(row => ({
      flowId: row.flowId,
      threadId: row.threadId,
      startedAt: row.startedAt,
      durationMs: row.durationMs ?? null,
      status:
        row.status === 'running' && this.#now() - row.updatedAt.getTime() > this.#staleThresholdMs
          ? 'stale'
          : row.status,
      pulseCount: row.pulseCount,
      costUsd: row.costUsd,
      entityName: row.entityName,
    }));
    if (filter?.status) flows = flows.filter(f => f.status === filter.status);
    if (filter?.threadId) flows = flows.filter(f => f.threadId === filter.threadId);
    if (filter?.entityName) flows = flows.filter(f => f.entityName === filter.entityName);
    if (filter?.fromDate) flows = flows.filter(f => f.startedAt >= filter.fromDate!);
    if (filter?.toDate) flows = flows.filter(f => f.startedAt <= filter.toDate!);
    flows.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return { flows: flows.slice(page * perPage, (page + 1) * perPage), total: flows.length };
  }

  #spanPulsesByFlow(): Map<string, PulseRecord[]> {
    const byFlow = new Map<string, PulseRecord[]>();
    for (const p of this.#pulses) {
      if (p.source !== 'span' || !p.traceId) continue;
      const list = byFlow.get(p.traceId) ?? [];
      list.push(p);
      byFlow.set(p.traceId, list);
    }
    return byFlow;
  }

  #deriveSummary(flowId: string, pulses: PulseRecord[]): FlowSummary {
    const sorted = [...pulses].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.seq - b.seq);
    const first = sorted[0]!;
    const last = sorted[sorted.length - 1]!;
    const threadId = sorted.find(p => p.threadId)?.threadId;

    const rootStart = sorted.find(p => !p.parentSpanId && p.action.endsWith('_started'));
    const rootEnd = [...sorted]
      .reverse()
      .find(p => !p.parentSpanId && (p.action.endsWith('_completed') || p.action.endsWith('_failed')));

    // Session-layer abort override: the span layer records aborted runs as
    // completed; the session's run_control.abort_completed fact wins. Aborts
    // that carry a runId join EXACTLY (the abort belongs to this flow iff the
    // flow contains that run); legacy rows without one fall back to the
    // thread + 2s-window heuristic.
    const flowRunIds = new Set(sorted.map(p => p.runId).filter(Boolean));
    const aborted = this.#pulses.some(p => {
      if (p.source !== 'session' || p.surface !== 'run_control' || p.action !== 'abort_completed') return false;
      if (p.runId) return flowRunIds.has(p.runId);
      return Boolean(
        p.threadId &&
        p.threadId === threadId &&
        p.timestamp.getTime() >= first.timestamp.getTime() &&
        p.timestamp.getTime() <= last.timestamp.getTime() + 2_000,
      );
    });

    let status: FlowStatus;
    if (aborted) status = 'aborted';
    else if (sorted.some(p => p.type === 'error')) status = 'failed';
    else if (rootEnd?.action.endsWith('_completed')) status = 'completed';
    else if (this.#now() - last.timestamp.getTime() > this.#staleThresholdMs) status = 'stale';
    else status = 'running';

    const durationMs =
      rootStart && rootEnd && (status === 'completed' || status === 'failed' || status === 'aborted')
        ? rootEnd.timestamp.getTime() - rootStart.timestamp.getTime()
        : null;

    // Cost dual-read: the core bridge folds cost into semantic model pulses
    // (data.cost_usd); legacy captures carried it on metric-lane rows
    // (data.estimated_cost_usd). Sum both so old databases keep reading.
    let costUsd: number | undefined;
    for (const p of this.#pulses) {
      if (p.traceId !== flowId) continue;
      const c = p.source === 'span' ? p.data?.cost_usd : p.source === 'metric' ? p.data?.estimated_cost_usd : undefined;
      if (typeof c === 'number') costUsd = (costUsd ?? 0) + c;
    }

    return {
      flowId,
      threadId,
      startedAt: first.timestamp,
      durationMs,
      status,
      pulseCount: pulses.length,
      costUsd,
      entityName: sorted.find(p => p.metadata?.entityName)?.metadata?.entityName,
    };
  }

  async listFlows(args: ListFlowsArgs = {}): Promise<ListFlowsResult> {
    const { filter, pagination } = args;
    const page = pagination?.page ?? 0;
    const perPage = pagination?.perPage ?? 40;

    let flows = [...this.#spanPulsesByFlow().entries()].map(([flowId, pulses]) => this.#deriveSummary(flowId, pulses));
    if (filter?.status) flows = flows.filter(f => f.status === filter.status);
    if (filter?.threadId) flows = flows.filter(f => f.threadId === filter.threadId);
    if (filter?.entityName) flows = flows.filter(f => f.entityName === filter.entityName);
    if (filter?.fromDate) flows = flows.filter(f => f.startedAt >= filter.fromDate!);
    if (filter?.toDate) flows = flows.filter(f => f.startedAt <= filter.toDate!);
    flows.sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime());

    return { flows: flows.slice(page * perPage, (page + 1) * perPage), total: flows.length };
  }

  async getFlow(flowId: string): Promise<FlowDetail | null> {
    const pulses = this.#spanPulsesByFlow().get(flowId);
    if (!pulses?.length) return null;
    const summary = this.#deriveSummary(flowId, pulses);

    const bySpan = new Map<string, PulseRecord[]>();
    for (const p of pulses) {
      if (!p.spanId) continue;
      const list = bySpan.get(p.spanId) ?? [];
      list.push(p);
      bySpan.set(p.spanId, list);
    }
    const tree: FlowTreeNode[] = [...bySpan.entries()]
      .map(([spanId, spanPulses]) => {
        const ordered = [...spanPulses].sort((a, b) => a.seq - b.seq);
        const start = ordered[0]!;
        const end = ordered.find(p => p.action.endsWith('_completed') || p.action.endsWith('_failed'));
        const base = start.action.replace(/_(started|completed|failed)$/, '');
        return {
          spanId,
          parentSpanId: start.parentSpanId || undefined,
          label: `${start.surface}.${base}`,
          startedAt: start.timestamp,
          endedAt: end?.timestamp,
          durationMs: end ? end.timestamp.getTime() - start.timestamp.getTime() : null,
          hasError: ordered.some(p => p.type === 'error'),
        };
      })
      .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());

    const definitions = [
      ...new Set(
        this.#relationships
          .filter(r => r.traceId === flowId && r.to.kind === 'definition' && r.type.startsWith('uses_'))
          .map(r => r.to.id),
      ),
    ];

    return { ...summary, tree, definitions };
  }

  async getFlowTimeline(flowId: string): Promise<FlowTimelineEntry[]> {
    const spanPulses = this.#spanPulsesByFlow().get(flowId);
    if (!spanPulses?.length) return [];
    const threadId = spanPulses.find(p => p.threadId)?.threadId;

    return this.#pulses
      .filter(
        p => p.traceId === flowId || (threadId != null && p.threadId === threadId && p.source !== 'span' && !p.traceId),
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime() || a.seq - b.seq)
      .map(p => ({
        timestamp: p.timestamp,
        seq: p.seq,
        source: p.source,
        type: p.type,
        surface: p.surface,
        action: p.action,
        runId: p.runId,
      }));
  }
}
