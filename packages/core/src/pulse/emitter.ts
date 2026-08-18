import { randomUUID } from 'node:crypto';
import type { PulseBus } from './bus';
import { nextPulseSeq } from './seq';

/**
 * THE pulse emitter — first-hand facts from source call sites (the
 * 'native' lane). Tiny hooks at truth boundaries (agent lifecycle, model
 * requests, tools, memory, signals) call emitPulseFact. Design rules,
 * enforced here so the seams stay 1-line:
 * - Zero work when no sink is registered (pulse off ⇒ a null check).
 * - Source stacks never run exporter/subscriber code: facts are queued and
 *   drained on a microtask, so the agent's hot path only pays an array push.
 * - Bounded per run (records, bytes) — overflow sets a sticky INCOMPLETE
 *   state, emits one marker fact, and drops further facts for that run.
 *   The agent run itself is never affected.
 * - No payload bodies: identities and small attribute bags only.
 */

/** Per-run capture limits (prototype defaults). */
const MAX_RECORDS_PER_RUN = 256;
const MAX_BYTES_PER_RECORD = 2_048;
const MAX_BYTES_PER_RUN = 131_072;
const MAX_QUEUE = 256;

export interface PulseFactInput {
  /** Run this fact belongs to (join key; '' when genuinely unknown). */
  runId: string;
  /** Flow identity when known at the seam ('' when genuinely unknown). */
  traceId?: string;
  /** Deterministic pulse id (span lifecycle facts reuse spanPulseId so the
   * native and bridge lanes collapse under idempotent reads); random when
   * omitted. */
  id?: string;
  /** Fact time (span start/end for lifecycle facts); emit time when omitted. */
  timestamp?: Date;
  spanId?: string;
  parentSpanId?: string;
  text?: string;
  level?: 'error';
  metadata?: Record<string, string>;
  surface: string;
  action: string;
  type: 'input' | 'output' | 'decision' | 'state' | 'error' | 'progress' | 'system';
  attributes?: Record<string, unknown>;
  data?: Record<string, number>;
  threadId?: string;
  resourceId?: string;
  /** Optional edges anchored on this fact's pulse id (or `from` override). */
  edges?: Array<{
    type:
      | 'queued_signal'
      | 'drained_signal'
      | 'introduced_content'
      | 'included_in_model_input'
      | 'origin_of'
      | 'parent_of'
      | 'resume_of'
      | 'uses_model_settings'
      | 'uses_tool_definition'
      | 'uses_definition';
    from?: { kind: 'pulse' | 'flow'; id: string };
    to: { kind: 'content' | 'model_input' | 'pulse' | 'flow' | 'definition'; id: string };
    attributes?: Record<string, string | number>;
  }>;
}

interface RunBudget {
  records: number;
  bytes: number;
  incomplete: boolean;
}

let sink: PulseBus | null = null;
const budgets = new Map<string, RunBudget>();
const queue: Array<{ fact: PulseFactInput; at: Date }> = [];
let drainScheduled = false;

export function registerPulseEmitter(bus: PulseBus): void {
  sink = bus;
}

export function unregisterPulseEmitter(bus: PulseBus): void {
  if (sink === bus) {
    sink = null;
    budgets.clear();
    queue.length = 0;
    drainScheduled = false;
  }
}

/** True when a sink is registered (pulse on). Seams that would otherwise
 * alter data shapes (e.g. lineage stamps) must gate on this so pulse-off
 * runs stay byte-identical. */
export function hasPulseEmitter(): boolean {
  return sink != null;
}

/** Test/diagnostic visibility: runs that hit a limit (facts incomplete). */
export function isRunIncomplete(runId: string): boolean {
  return budgets.get(runId)?.incomplete ?? false;
}

function budgetFor(runId: string): RunBudget {
  let b = budgets.get(runId);
  if (!b) {
    if (budgets.size >= 10_000) budgets.delete(budgets.keys().next().value as string);
    b = { records: 0, bytes: 0, incomplete: false };
    budgets.set(runId, b);
  }
  return b;
}

function markIncomplete(runId: string, reason: string, at: Date): void {
  const b = budgetFor(runId);
  if (b.incomplete) return;
  b.incomplete = true;
  // One marker fact per run — the sticky incomplete state, visible in data.
  sink?.emit({
    type: 'pulse',
    record: {
      id: randomUUID(),
      timestamp: at,
      seq: nextPulseSeq(),
      type: 'system',
      surface: 'execution',
      action: 'native_capture_incomplete',
      attributes: { reason },
      traceId: '',
      runId: runId || undefined,
      source: 'native',
    },
  });
}

function drain(): void {
  drainScheduled = false;
  const bus = sink;
  if (!bus) {
    queue.length = 0;
    return;
  }
  while (queue.length) {
    const { fact, at } = queue.shift()!;
    const pulseId = fact.id ?? randomUUID();
    bus.emit({
      type: 'pulse',
      record: {
        id: pulseId,
        timestamp: at,
        seq: nextPulseSeq(),
        type: fact.type,
        surface: fact.surface,
        action: fact.action,
        level: fact.level,
        text: fact.text,
        attributes: fact.attributes,
        data: fact.data,
        metadata: fact.metadata,
        traceId: fact.traceId ?? '',
        spanId: fact.spanId,
        parentSpanId: fact.parentSpanId,
        runId: fact.runId || undefined,
        threadId: fact.threadId,
        resourceId: fact.resourceId,
        source: 'native',
      },
    });
    for (const edge of fact.edges ?? []) {
      bus.emit({
        type: 'relationship',
        record: {
          id: randomUUID(),
          timestamp: at,
          seq: nextPulseSeq(),
          type: edge.type,
          from: edge.from ?? { kind: 'pulse', id: pulseId },
          to: edge.to,
          ...(edge.attributes ? { attributes: edge.attributes } : {}),
          traceId: fact.traceId ?? '',
        },
      });
    }
  }
}

/**
 * The single ingress. Called from truth-boundary seams — must stay cheap:
 * validate, budget, push, schedule a microtask. No I/O, no callbacks.
 */
export function emitPulseFact(fact: PulseFactInput): void {
  if (!sink) return;
  const at = new Date();
  // Budget per run when known, else per flow: without the fallback every
  // runId-less fact (e.g. tool spans) would share one '' budget and go
  // permanently sticky-incomplete after the cap.
  const budgetKey = fact.runId || fact.traceId || '';
  const budget = budgetFor(budgetKey);
  if (budget.incomplete) return;

  let size: number;
  try {
    size = JSON.stringify(fact).length;
  } catch {
    markIncomplete(budgetKey, 'unserializable fact', at);
    return;
  }
  if (size > MAX_BYTES_PER_RECORD) {
    markIncomplete(budgetKey, 'record over 2KiB', at);
    return;
  }
  if (budget.records + 1 > MAX_RECORDS_PER_RUN || budget.bytes + size > MAX_BYTES_PER_RUN) {
    markIncomplete(budgetKey, 'per-run budget exceeded', at);
    return;
  }
  if (queue.length >= MAX_QUEUE) {
    markIncomplete(budgetKey, 'ingress queue full', at);
    return;
  }
  budget.records += 1;
  budget.bytes += size;
  queue.push({ fact, at: fact.timestamp ?? at });
  if (!drainScheduled) {
    drainScheduled = true;
    queueMicrotask(drain);
  }
}
