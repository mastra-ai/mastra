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
  /** Capture lane: span | session | runtime | log | metric | score | feedback | drop. */
  source: string;
}

/** One link between endpoints. Carries no payload bodies. */
export interface PulseRelationshipRecord {
  id: string;
  timestamp: Date;
  seq: number;
  type: string;
  from: { kind: PulseEndpointKind; id: string };
  to: { kind: PulseEndpointKind; id: string };
  attributes?: Record<string, unknown>;
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
  /** SUM of metric pulses' estimated_cost_usd, when present. */
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

  /** All pulses of a flow (plus session/runtime lanes joined by thread) in order. */
  abstract getFlowTimeline(flowId: string): Promise<FlowTimelineEntry[]>;

  /** Remove everything (test/dev helper). */
  abstract dangerouslyClearAll(): Promise<void>;
}
