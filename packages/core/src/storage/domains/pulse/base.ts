import { z } from 'zod';
import { StorageDomain } from '../base';

/**
 * Pulse storage domain (experimental) — persistence for event-first
 * observability. Stores append-only pulse and relationship records; every
 * "smart" read (flows, trees, durations, status) is DERIVED by the adapter at
 * read time — nothing derived is ever written.
 */

export type PulseSemanticType = 'input' | 'output' | 'decision' | 'state' | 'error' | 'progress' | 'system';

export type PulseEndpointKind = 'pulse' | 'flow' | 'thread' | 'model_input' | 'content' | 'definition' | 'external';

/** One instant fact. No duration, no embedded tree. */
export interface PulseRecord {
  id: string;
  timestamp: Date;
  /** Per-process monotonic lane — orders same-millisecond records. */
  seq: number;
  type: PulseSemanticType;
  surface: string;
  action: string;
  level?: string;
  text?: string;
  /** Numeric-only measurements (tokens, cost, counts). */
  data?: Record<string, number>;
  attributes?: Record<string, unknown>;
  metadata?: Record<string, string>;
  traceId: string;
  spanId?: string;
  parentSpanId?: string;
  runId?: string;
  threadId?: string;
  resourceId?: string;
  /** Capture lane: span | session | log | metric | score | feedback | drop. */
  source: string;
}

/**
 * A relationship endpoint. `system` is meaningful only for `kind: 'external'`
 * (which platform owns the id — Slack C123 vs Discord C123), mirroring the
 * spec's `{ kind: 'external'; id: string; system?: string }` variant.
 */
export interface PulseEndpoint {
  kind: PulseEndpointKind;
  id: string;
  system?: string;
}

/** One link between endpoints. Carries no payload bodies. */
export interface PulseRelationshipRecord {
  id: string;
  timestamp: Date;
  seq: number;
  type: string;
  from: PulseEndpoint;
  to: PulseEndpoint;
  attributes?: Record<string, unknown>;
  /** External/correlation string fields (spec parity with the Pulse record). */
  metadata?: Record<string, string>;
  traceId: string;
}

export type FlowStatus = 'running' | 'completed' | 'failed' | 'aborted' | 'stale';

/** Derived, per trace — never stored. */
export interface FlowSummary {
  flowId: string;
  threadId?: string;
  startedAt: Date;
  /** Derived from paired root start/terminal pulses; null while running/stale. */
  durationMs: number | null;
  status: FlowStatus;
  pulseCount: number;
  /** SUM of bridge-folded cost_usd on span pulses, when present. */
  costUsd?: number;
  entityName?: string;
}

export interface FlowTreeNode {
  spanId: string;
  parentSpanId?: string;
  label: string;
  startedAt: Date;
  endedAt?: Date;
  durationMs: number | null;
  hasError: boolean;
}

export interface FlowDetail extends FlowSummary {
  tree: FlowTreeNode[];
  /** definition endpoint ids referenced via uses_* edges. */
  definitions: string[];
}

export interface FlowTimelineEntry {
  timestamp: Date;
  seq: number;
  source: string;
  type: PulseSemanticType;
  surface: string;
  action: string;
  runId?: string;
}

export const pulseFlowsFilterSchema = z
  .object({
    status: z.enum(['running', 'completed', 'failed', 'aborted', 'stale']).optional(),
    threadId: z.string().optional(),
    resourceId: z.string().optional(),
    entityName: z.string().optional(),
    fromDate: z.coerce.date().optional(),
    toDate: z.coerce.date().optional(),
  })
  .optional();

export const pulsePaginationSchema = z
  .object({
    page: z.coerce.number().int().min(0).default(0),
    perPage: z.coerce.number().int().min(1).max(200).default(40),
  })
  .default({ page: 0, perPage: 40 });

export type PulseFlowsFilter = z.infer<typeof pulseFlowsFilterSchema>;
export type PulsePagination = z.infer<typeof pulsePaginationSchema>;

export interface ListFlowsArgs {
  filter?: PulseFlowsFilter;
  pagination?: PulsePagination;
}

export interface ListFlowsResult {
  flows: FlowSummary[];
  total: number;
}

export interface PulseStorageFeatures {
  /** Adapter write mode; pulse is append-only by design. */
  writeMode: 'insert-only';
}

/**
 * Stored statuses for the materialized flow index. `stale` is intentionally
 * excluded: an index row cannot self-expire, so staleness is always presented
 * at READ time (a `running` row whose last upsert is older than the stale
 * threshold is served as `stale`).
 */
export type FlowIndexStatus = Exclude<FlowStatus, 'stale'>;

/**
 * One versioned row of the materialized flow-summary index (experimental,
 * behind `pulse.flowIndex`). The writer upserts these; adapters keep only the
 * highest `version` per `flowId` (ReplacingMergeTree semantics).
 */
export interface FlowIndexRow {
  flowId: string;
  /** Monotonically increasing per upsert; highest version wins per flow. */
  version: number;
  startedAt: Date;
  endedAt?: Date;
  status: FlowIndexStatus;
  durationMs?: number | null;
  threadId?: string;
  entityName?: string;
  /** Writer-side counter — an approximation (late pulses after eviction are missed). */
  pulseCount: number;
  costUsd?: number;
}

/**
 * Base class every pulse storage adapter extends. Methods throw until an
 * adapter overrides them, mirroring the other storage domains' convention.
 */
export abstract class PulseStorage extends StorageDomain {
  constructor() {
    super({
      component: 'STORAGE',
      name: 'PULSE',
    });
  }

  getFeatures(): PulseStorageFeatures {
    return { writeMode: 'insert-only' };
  }

  /** Append pulse records (append-only; adapters must not update in place). */
  abstract batchCreatePulses(records: PulseRecord[]): Promise<void>;

  /** Append relationship records. */
  abstract batchCreateRelationships(records: PulseRelationshipRecord[]): Promise<void>;

  /** List derived flows, most recent first. */
  abstract listFlows(args?: ListFlowsArgs): Promise<ListFlowsResult>;

  /** One derived flow with its tree and referenced definitions. */
  abstract getFlow(flowId: string): Promise<FlowDetail | null>;

  /** All pulses of a flow (plus session-lane rows joined by thread) in order. */
  abstract getFlowTimeline(flowId: string): Promise<FlowTimelineEntry[]>;

  /** Remove everything (test/dev helper). */
  abstract dangerouslyClearAll(): Promise<void>;

  /**
   * Whether this adapter maintains a materialized flow-summary index
   * (experimental). When false, `upsertFlowSummaries`/`listFlowsFromIndex`
   * are absent and flows are always derived at read time.
   */
  supportsFlowIndex(): boolean {
    return false;
  }

  /** Upsert versioned flow-index rows; highest version per flow wins. */
  upsertFlowSummaries?(rows: FlowIndexRow[]): Promise<void>;

  /**
   * List flows from the materialized index (same filter/pagination semantics
   * as `listFlows`; staleness presented at read time).
   */
  listFlowsFromIndex?(args?: ListFlowsArgs): Promise<ListFlowsResult>;
}
