/**
 * Case catalogue for the trace-query family: queryTraces() (keyset, page, deprecated groups,
 * delta), queryThreads(), querySpans(), getTraceQueryValues() and getTraceQueryObservedFields().
 *
 * Every request is validated and planned by the real core planner and compiled by the merged
 * ClickHouse compiler; the harness only adds project scope after compilation (../shared/scope.ts)
 * and, for labelled variants, a fail-closed what-if rewrite. Nothing here changes compiler behaviour.
 */
import {
  encodeSpanQueryCursor,
  encodeTraceQueryCursor,
  encodeTraceQueryDeltaCursor,
  parseGetTraceQueryFieldsArgs,
  parseGetTraceQueryValuesArgs,
  parseQueryThreadsInput,
  parseTraceQueryRequest,
  planSpanQuery,
  planThreadQuery,
  planTraceQuery,
  planTraceQueryObservedFields,
  planTraceQueryValues,
} from '@mastra/core/storage';
import type { TrustedSpanQueryPlan, TrustedThreadQueryPlan, TrustedTraceQueryPlan } from '@mastra/core/storage';

import { TABLE_TRACE_ROOTS_DELTA } from '../../src/storage/domains/observability/v-next/ddl';
import { compileClickHouseSpanQuery } from '../../src/storage/domains/observability/v-next/span-query';
import {
  compileClickHouseThreadQuery,
  compileClickHouseTraceQuery,
  compileClickHouseTraceQueryObservedFields,
  compileClickHouseTraceQueryValues,
} from '../../src/storage/domains/observability/v-next/trace-query';
import type { CompiledClickHouseTraceQuery } from '../../src/storage/domains/observability/v-next/trace-query';
import type { Literals, ProjectScope } from '../shared/profile';
import type { WindowDef } from '../shared/runner';
import { applyVariant, injectProjectScope, injectSpanProjectScope } from '../shared/scope';
import type { Relation } from '../shared/scope';

const DAY = 86_400_000;
export const WINDOWS: Record<'1d' | '7d' | '30d', WindowDef> = {
  '1d': { id: '1d', ms: DAY },
  '7d': { id: '7d', ms: 7 * DAY },
  '30d': { id: '30d', ms: 30 * DAY },
};
const ALL_WINDOWS = [WINDOWS['1d'], WINDOWS['7d'], WINDOWS['30d']];

/** Per-project literals: the OBS-539 selection plus the trace-query sidecar (discover.ts). */
export interface TraceQueryLiterals extends Literals {
  metadataValue: string | null;
  tag: string | null;
  model: string | null;
  entityName: string | null;
  feedbackType: string | null;
}
export type SidecarKey = 'metadataValue' | 'tag' | 'model' | 'entityName' | 'feedbackType';
export const SIDECAR_KEYS: readonly SidecarKey[] = ['metadataValue', 'tag', 'model', 'entityName', 'feedbackType'];

export type Api = 'traces' | 'page' | 'groups' | 'delta' | 'delta-head' | 'threads' | 'spans' | 'fields' | 'values';
export type Variant = 'base' | 'w1';
/**
 * - `main`: the list/select/discovery statement itself.
 * - `payload` / `payload-scoped`: page-mode root payloads, as compiled / with org+project scope.
 * - `span-payload` / `span-metrics`: querySpans() hydration, exactly as the store issues it.
 * - `span-payload-scoped` / `span-metrics-scoped`: the same with org/project (+ partition) scope.
 */
export type Stage =
  | 'main'
  | 'payload'
  | 'payload-scoped'
  | 'span-payload'
  | 'span-metrics'
  | 'span-payload-scoped'
  | 'span-metrics-scoped';

export type FilterKind =
  | 'none'
  | 'seeded-prefix'
  | 'seeded-expr'
  | 'unseeded'
  | 'partial'
  | 'sort'
  | 'page'
  | 'discovery';

export interface CaseDef {
  id: string;
  api: Api;
  title: string;
  kind: FilterKind;
  windows: WindowDef[];
  relations: Relation[];
  variants: Variant[];
  stages: Stage[];
  /** Runs on every selected project of a bucket; otherwise only on the representative one. */
  core: boolean;
  /** High-cardinality: needs Gate B approval on p99/largest. */
  hc: boolean;
  /** Orders execution cheap → expensive within a phase. */
  cost: number;
  /** Rows (or threads) to skip with real cursors before the measured page. */
  depth?: number;
  /** Sidecar literals the request needs; the case is skipped (and recorded) when one is missing. */
  needs?: SidecarKey[];
  /** Only runs when `mastra_trace_roots_delta` exists. */
  delta?: boolean;
  request(l: TraceQueryLiterals): Record<string, unknown>;
}

type Json = Record<string, unknown>;
const eq = (path: string, literal: string | number): Json => ({ op: 'eq', left: { path }, right: { literal } });
const gt = (path: string, literal: number): Json => ({ op: 'gt', left: { path }, right: { literal } });
const and = (...args: Json[]): Json => ({ op: 'and', args });
const or = (...args: Json[]): Json => ({ op: 'or', args });
const includes = (path: string, value: string): Json => ({ op: 'includes', path, value });
const spansSome = (p: Json): Json => ({ spans: { some: p } });
const spansNone = (p: Json): Json => ({ spans: { none: p } });
const feedbackSome = (p: Json): Json => ({ feedback: { some: p } });
const tracesSome = (p: Json): Json => ({ traces: { some: p } });
const tracesNone = (p: Json): Json => ({ traces: { none: p } });
const envEq = (l: TraceQueryLiterals) => eq('environment', l.environment);
const toolCalled = (l: TraceQueryLiterals) => spansSome(eq('name', l.tool));
const must = (value: string | null, key: SidecarKey): string => {
  if (value === null) throw new Error(`missing literal ${key}`);
  return value;
};

/** Public enums, not discovered. */
export const SPAN_TYPE = 'model_generation';
export const ERROR_STATUS = 'error';
export const SLOW_MS = 5_000;

const base = {
  windows: ALL_WINDOWS,
  relations: [] as Relation[],
  variants: ['base'] as Variant[],
  core: false,
  hc: false,
};
const traceStages: Stage[] = ['main'];
const pageStages: Stage[] = ['main', 'payload', 'payload-scoped'];
const spanStages: Stage[] = ['main', 'span-payload', 'span-metrics'];
const keyset = (extra: Json = {}): Json => ({ page: { limit: 100 }, ...extra });

export const CASES: CaseDef[] = [
  // --- queryTraces(), keyset mode ---
  {
    ...base,
    id: 'T0',
    api: 'traces',
    title: 'no where',
    kind: 'none',
    stages: traceStages,
    variants: ['base', 'w1'],
    core: true,
    cost: 10,
    request: () => keyset(),
  },
  {
    ...base,
    id: 'T1',
    api: 'traces',
    title: 'environment eq',
    kind: 'seeded-prefix',
    stages: traceStages,
    variants: ['base', 'w1'],
    core: true,
    cost: 11,
    request: l => keyset({ where: envEq(l) }),
  },
  {
    ...base,
    id: 'T2',
    api: 'traces',
    title: 'entityType eq AND entityName eq',
    kind: 'seeded-expr',
    stages: traceStages,
    cost: 12,
    needs: ['entityName'],
    request: l =>
      keyset({ where: and(eq('entityType', l.entityType), eq('entityName', must(l.entityName, 'entityName'))) }),
  },
  {
    ...base,
    id: 'T3',
    api: 'traces',
    title: 'status eq error',
    kind: 'seeded-expr',
    stages: traceStages,
    cost: 13,
    request: l => keyset({ where: eq('status', ERROR_STATUS) }),
  },
  {
    ...base,
    id: 'T4',
    api: 'traces',
    title: 'metadata.<key> eq <top value>',
    kind: 'seeded-expr',
    stages: traceStages,
    cost: 14,
    needs: ['metadataValue'],
    request: l => keyset({ where: eq(`metadata.${l.metadataKey}`, must(l.metadataValue, 'metadataValue')) }),
  },
  {
    ...base,
    id: 'T5',
    api: 'traces',
    title: 'tags includes <top tag>',
    kind: 'seeded-expr',
    stages: traceStages,
    cost: 15,
    needs: ['tag'],
    request: l => keyset({ where: includes('tags', must(l.tag, 'tag')) }),
  },
  {
    ...base,
    id: 'T6',
    api: 'traces',
    title: `durationMs gt ${SLOW_MS}`,
    kind: 'seeded-expr',
    stages: traceStages,
    cost: 16,
    request: l => keyset({ where: gt('durationMs', SLOW_MS) }),
  },
  {
    ...base,
    id: 'T7',
    api: 'traces',
    title: 'spans.some(name eq tool)',
    kind: 'unseeded',
    relations: ['spans'],
    stages: traceStages,
    variants: ['base', 'w1'],
    core: true,
    cost: 40,
    request: l => keyset({ where: toolCalled(l) }),
  },
  {
    ...base,
    id: 'T8',
    api: 'traces',
    title: 'spans.some(spanType eq model_generation AND status eq error)',
    kind: 'unseeded',
    relations: ['spans'],
    stages: traceStages,
    cost: 41,
    request: l => keyset({ where: spansSome(and(eq('spanType', SPAN_TYPE), eq('status', ERROR_STATUS))) }),
  },
  {
    ...base,
    id: 'T9',
    api: 'traces',
    title: 'spans.none(status eq error)',
    kind: 'unseeded',
    relations: ['spans'],
    stages: traceStages,
    cost: 42,
    request: l => keyset({ where: spansNone(eq('status', ERROR_STATUS)) }),
  },
  {
    ...base,
    id: 'T10',
    api: 'traces',
    title: 'environment eq OR spans.some(name eq tool)',
    kind: 'unseeded',
    relations: ['spans'],
    stages: traceStages,
    cost: 43,
    request: l => keyset({ where: or(envEq(l), toolCalled(l)) }),
  },
  {
    ...base,
    id: 'T11',
    api: 'traces',
    title: 'feedback.some(feedbackType eq top)',
    kind: 'unseeded',
    relations: ['feedback'],
    stages: traceStages,
    cost: 30,
    needs: ['feedbackType'],
    request: l => keyset({ where: feedbackSome(eq('feedbackType', must(l.feedbackType, 'feedbackType'))) }),
  },
  {
    ...base,
    id: 'T12',
    api: 'traces',
    title: 'environment eq AND spans.some(model eq top)',
    kind: 'partial',
    relations: ['spans'],
    stages: traceStages,
    cost: 44,
    needs: ['model'],
    request: l => keyset({ where: and(envEq(l), spansSome(eq('model', must(l.model, 'model')))) }),
  },
  {
    ...base,
    id: 'O1',
    api: 'traces',
    title: 'orderBy startedAt asc',
    kind: 'sort',
    stages: traceStages,
    cost: 17,
    request: l => keyset({ orderBy: [{ field: 'startedAt', direction: 'asc' }] }),
  },
  {
    ...base,
    id: 'O2',
    api: 'traces',
    title: 'orderBy endedAt desc',
    kind: 'sort',
    stages: traceStages,
    cost: 18,
    request: l => keyset({ orderBy: [{ field: 'endedAt', direction: 'desc' }] }),
  },
  {
    ...base,
    id: 'O3',
    api: 'traces',
    title: 'orderBy endedAt asc',
    kind: 'sort',
    stages: traceStages,
    cost: 19,
    request: l => keyset({ orderBy: [{ field: 'endedAt', direction: 'asc' }] }),
  },
  {
    ...base,
    id: 'K1',
    api: 'traces',
    title: 'limit 1000',
    kind: 'page',
    stages: traceStages,
    hc: true,
    cost: 20,
    request: () => ({ page: { limit: 1000 } }),
  },
  {
    ...base,
    id: 'K2',
    api: 'traces',
    title: 'cursor at row 1000',
    kind: 'page',
    stages: traceStages,
    hc: true,
    cost: 21,
    depth: 1_000,
    request: () => keyset(),
  },
  {
    ...base,
    id: 'K3',
    api: 'traces',
    title: 'cursor at row 10000',
    kind: 'page',
    stages: traceStages,
    hc: true,
    cost: 22,
    depth: 10_000,
    request: () => keyset(),
  },

  // --- queryTraces(), page mode and other modes ---
  {
    ...base,
    id: 'P0',
    api: 'page',
    title: 'page 0, perPage 25',
    kind: 'none',
    stages: pageStages,
    core: true,
    cost: 25,
    request: () => ({ pagination: { page: 0, perPage: 25 } }),
  },
  {
    ...base,
    id: 'P1',
    api: 'page',
    title: 'page 40 (offset 1000)',
    kind: 'page',
    stages: pageStages,
    cost: 26,
    request: () => ({ pagination: { page: 40, perPage: 25 } }),
  },
  {
    ...base,
    id: 'P2',
    api: 'page',
    title: 'page 400 (offset 10000)',
    kind: 'page',
    stages: pageStages,
    hc: true,
    cost: 27,
    request: () => ({ pagination: { page: 400, perPage: 25 } }),
  },
  {
    ...base,
    id: 'P3',
    api: 'page',
    title: 'environment eq, page 0',
    kind: 'seeded-prefix',
    stages: pageStages,
    cost: 28,
    request: l => ({ where: envEq(l), pagination: { page: 0, perPage: 25 } }),
  },
  {
    ...base,
    id: 'G0',
    api: 'groups',
    title: 'deprecated group by threadId, limit 100',
    kind: 'none',
    stages: traceStages,
    cost: 29,
    request: () => ({ group: { by: ['threadId'] }, page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'D0',
    api: 'delta-head',
    title: 'delta-head statement (unscoped by design)',
    kind: 'none',
    stages: traceStages,
    delta: true,
    cost: 1,
    request: () => ({}),
  },
  {
    ...base,
    id: 'D1',
    api: 'delta',
    title: 'delta from watermark 0, limit 100',
    kind: 'none',
    stages: traceStages,
    delta: true,
    cost: 31,
    request: () => ({ mode: 'delta', limit: 100 }),
  },
  {
    ...base,
    id: 'D2',
    api: 'delta',
    title: 'delta from a recent watermark, limit 100',
    kind: 'none',
    stages: traceStages,
    delta: true,
    cost: 32,
    depth: 10_000,
    request: () => ({ mode: 'delta', limit: 100 }),
  },

  // --- queryThreads() ---
  {
    ...base,
    id: 'TH0',
    api: 'threads',
    title: 'no where',
    kind: 'none',
    stages: traceStages,
    variants: ['base', 'w1'],
    core: true,
    cost: 12,
    request: () => ({ page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'TH1',
    api: 'threads',
    title: 'traces.where: environment eq (not seeded)',
    kind: 'seeded-prefix',
    stages: traceStages,
    cost: 13,
    request: l => ({ traces: { where: envEq(l) }, page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'TH2',
    api: 'threads',
    title: 'where: traces.some(status eq error)',
    kind: 'seeded-expr',
    stages: traceStages,
    cost: 14,
    request: () => ({ where: tracesSome(eq('status', ERROR_STATUS)), page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'TH3',
    api: 'threads',
    title: 'traces.where: spans.some(name eq tool)',
    kind: 'unseeded',
    relations: ['spans'],
    stages: traceStages,
    cost: 45,
    request: l => ({ traces: { where: toolCalled(l) }, page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'TH4',
    api: 'threads',
    title: 'where: traces.some(environment eq) AND traces.none(status eq error)',
    kind: 'seeded-expr',
    stages: traceStages,
    cost: 15,
    request: l => ({ where: and(tracesSome(envEq(l)), tracesNone(eq('status', ERROR_STATUS))), page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'TH5',
    api: 'threads',
    title: 'limit 1000',
    kind: 'page',
    stages: traceStages,
    hc: true,
    cost: 16,
    request: () => ({ page: { limit: 1000 } }),
  },
  {
    ...base,
    id: 'TH6',
    api: 'threads',
    title: 'cursor at thread 1000',
    kind: 'page',
    stages: traceStages,
    hc: true,
    cost: 17,
    depth: 1_000,
    request: () => ({ page: { limit: 100 } }),
  },

  // --- querySpans() ---
  {
    ...base,
    id: 'S0',
    api: 'spans',
    title: 'no where',
    kind: 'none',
    stages: [...spanStages, 'span-payload-scoped', 'span-metrics-scoped'],
    core: true,
    cost: 33,
    request: () => ({ page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'S1',
    api: 'spans',
    title: 'spanType eq model_generation',
    kind: 'seeded-expr',
    stages: spanStages,
    cost: 34,
    request: () => ({ where: eq('spanType', SPAN_TYPE), page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'S2',
    api: 'spans',
    title: 'name eq tool',
    kind: 'seeded-expr',
    stages: spanStages,
    cost: 35,
    request: l => ({ where: eq('name', l.tool), page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'S3',
    api: 'spans',
    title: 'status eq error',
    kind: 'seeded-expr',
    stages: spanStages,
    cost: 36,
    request: () => ({ where: eq('status', ERROR_STATUS), page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'S4',
    api: 'spans',
    title: 'model eq top',
    kind: 'seeded-expr',
    stages: spanStages,
    cost: 37,
    needs: ['model'],
    request: l => ({ where: eq('model', must(l.model, 'model')), page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'S5',
    api: 'spans',
    title: `durationMs gt ${SLOW_MS}`,
    kind: 'seeded-expr',
    stages: spanStages,
    cost: 38,
    request: () => ({ where: gt('durationMs', SLOW_MS), page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'S6',
    api: 'spans',
    title: 'orderBy endedAt asc',
    kind: 'sort',
    stages: spanStages,
    cost: 39,
    request: () => ({ orderBy: [{ field: 'endedAt', direction: 'asc' }], page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'S7',
    api: 'spans',
    title: 'limit 1000',
    kind: 'page',
    stages: spanStages,
    hc: true,
    cost: 46,
    request: () => ({ page: { limit: 1000 } }),
  },
  {
    ...base,
    id: 'S8',
    api: 'spans',
    title: 'cursor at row 1000',
    kind: 'page',
    stages: spanStages,
    hc: true,
    cost: 47,
    depth: 1_000,
    request: () => ({ page: { limit: 100 } }),
  },
  {
    ...base,
    id: 'S9',
    api: 'spans',
    title: 'cursor at row 10000',
    kind: 'page',
    stages: spanStages,
    hc: true,
    cost: 48,
    depth: 10_000,
    request: () => ({ page: { limit: 100 } }),
  },

  // --- discovery ---
  {
    ...base,
    id: 'OF0',
    api: 'fields',
    title: 'observed fields, trace scope, limit 25',
    kind: 'discovery',
    stages: traceStages,
    variants: ['base', 'w1'],
    core: true,
    cost: 23,
    request: () => ({ predicateScope: 'trace', limit: 25 }),
  },
  {
    ...base,
    id: 'OF1',
    api: 'fields',
    title: "observed fields, limit 100, search 'id'",
    kind: 'discovery',
    stages: traceStages,
    cost: 24,
    request: () => ({ predicateScope: 'trace', limit: 100, search: 'id' }),
  },
  {
    ...base,
    id: 'V1',
    api: 'values',
    title: 'values: trace environment',
    kind: 'discovery',
    stages: traceStages,
    core: true,
    cost: 2,
    request: () => ({ predicateScope: 'trace', path: 'environment' }),
  },
  {
    ...base,
    id: 'V2',
    api: 'values',
    title: 'values: trace entityName',
    kind: 'discovery',
    stages: traceStages,
    cost: 3,
    request: () => ({ predicateScope: 'trace', path: 'entityName' }),
  },
  {
    ...base,
    id: 'V3',
    api: 'values',
    title: 'values: trace status',
    kind: 'discovery',
    stages: traceStages,
    cost: 4,
    request: () => ({ predicateScope: 'trace', path: 'status' }),
  },
  {
    ...base,
    id: 'V4',
    api: 'values',
    title: 'values: trace tags',
    kind: 'discovery',
    stages: traceStages,
    hc: true,
    cost: 5,
    request: () => ({ predicateScope: 'trace', path: 'tags' }),
  },
  {
    ...base,
    id: 'V5',
    api: 'values',
    title: 'values: trace metadata.<key>',
    kind: 'discovery',
    stages: traceStages,
    hc: true,
    cost: 6,
    request: l => ({ predicateScope: 'trace', path: `metadata.${l.metadataKey}` }),
  },
  {
    ...base,
    id: 'V6',
    api: 'values',
    title: 'values: spans name',
    kind: 'discovery',
    relations: ['spans'],
    stages: traceStages,
    core: true,
    hc: true,
    cost: 50,
    request: () => ({ predicateScope: 'spans', path: 'name' }),
  },
  {
    ...base,
    id: 'V7',
    api: 'values',
    title: 'values: spans model',
    kind: 'discovery',
    relations: ['spans'],
    stages: traceStages,
    hc: true,
    cost: 51,
    request: () => ({ predicateScope: 'spans', path: 'model' }),
  },
  {
    ...base,
    id: 'V8',
    api: 'values',
    title: "values: spans name, search 'a', limit 100",
    kind: 'discovery',
    relations: ['spans'],
    stages: traceStages,
    hc: true,
    cost: 52,
    request: () => ({ predicateScope: 'spans', path: 'name', search: 'a', limit: 100 }),
  },
  {
    ...base,
    id: 'V9',
    api: 'values',
    title: 'values: feedback feedbackType',
    kind: 'discovery',
    relations: ['feedback'],
    stages: traceStages,
    cost: 7,
    request: () => ({ predicateScope: 'feedback', path: 'feedbackType' }),
  },
];

export function caseById(id: string): CaseDef {
  const def = CASES.find(c => c.id === id);
  if (!def) throw new Error(`Unknown case ${id}`);
  return def;
}

/** Selection anchor (OBS-539), so cells line up with the aggregate benchmark. */
export function timeRangeFor(window: WindowDef, to: Date): { from: string; to: string } {
  return { from: new Date(to.getTime() - window.ms).toISOString(), to: to.toISOString() };
}

/** The statement queryTraces() issues for the delta head, verbatim from the store (asserted by a test). */
export const DELTA_HEAD_SQL = `SELECT toString(cursorId) AS cursorId, traceId FROM ${TABLE_TRACE_ROOTS_DELTA} ORDER BY cursorId DESC, traceId DESC LIMIT 1`;

/** Cursor position for deep pages: the values of the row the previous page ended on. */
export type CursorAt =
  | { kind: 'traces'; sortValue: string; traceId: string }
  | { kind: 'threads'; threadId: string }
  | {
      kind: 'spans';
      organizationId: string | null;
      resourceId: string | null;
      traceId: string;
      spanId: string;
      sortValue: string;
    }
  | { kind: 'delta'; cursorId: string; traceId: string };

export type Plan =
  | { api: 'traces' | 'page' | 'groups' | 'delta'; plan: TrustedTraceQueryPlan }
  | { api: 'threads'; plan: TrustedThreadQueryPlan }
  | { api: 'spans'; plan: TrustedSpanQueryPlan }
  | { api: 'fields' | 'values' | 'delta-head'; plan: undefined };

export interface CompiledCase {
  plan: Plan;
  compiled: CompiledClickHouseTraceQuery;
}

/**
 * Builds the request, plans it through the real planner (a deep cursor is encoded with the real
 * encoder and fed back through the request so the planner decodes and binds it), compiles it,
 * project-scopes it, and applies the variant.
 */
export function compileCase(
  def: CaseDef,
  variant: Variant,
  literals: TraceQueryLiterals,
  timeRange: { from: string; to: string },
  scope: ProjectScope,
  options: { cursor?: CursorAt; limit?: number; deltaHead?: { cursorId: string; traceId: string } } = {},
): CompiledCase {
  if (!def.variants.includes(variant)) throw new Error(`Case ${def.id} has no variant ${variant}`);
  const planScope = { scope: { organizationId: scope.organizationId } };
  const request = def.request(literals);
  let plan: Plan;
  let compiled: CompiledClickHouseTraceQuery;

  switch (def.api) {
    case 'delta-head':
      if (variant !== 'base') throw new Error('delta head has no variants');
      return { plan: { api: 'delta-head', plan: undefined }, compiled: { query: DELTA_HEAD_SQL, query_params: {} } };
    case 'traces':
    case 'page':
    case 'groups':
    case 'delta': {
      const body: Json = { timeRange, ...request };
      if (options.limit !== undefined) body.page = { ...(body.page as Json), limit: options.limit };
      let traced = planTraceQuery(parseTraceQueryRequest(body), planScope);
      if (options.cursor?.kind === 'traces') {
        const after = encodeTraceQueryCursor(traced as Parameters<typeof encodeTraceQueryCursor>[0], {
          result: 'traces',
          sortValue: options.cursor.sortValue,
          traceId: options.cursor.traceId,
        });
        traced = planTraceQuery(
          parseTraceQueryRequest({ ...body, page: { ...(body.page as Json), after } }),
          planScope,
        );
      } else if (options.cursor?.kind === 'delta') {
        if (traced.paginationMode !== 'delta') throw new Error(`Case ${def.id}: delta cursor on non-delta plan`);
        const watermark = JSON.stringify({ cursorId: options.cursor.cursorId, traceId: options.cursor.traceId });
        const after = encodeTraceQueryDeltaCursor(traced, 'clickhouse', watermark);
        traced = planTraceQuery(parseTraceQueryRequest({ ...body, after }), planScope);
      } else if (options.cursor) {
        throw new Error(`Case ${def.id}: cursor kind ${options.cursor.kind} does not apply`);
      }
      plan = { api: def.api, plan: traced };
      compiled = compileClickHouseTraceQuery(traced, options.deltaHead);
      break;
    }
    case 'threads': {
      const body: Json = { ...request, traces: { timeRange, ...((request.traces as Json | undefined) ?? {}) } };
      if (options.limit !== undefined) body.page = { ...(body.page as Json), limit: options.limit };
      let threads = planThreadQuery(parseQueryThreadsInput(body), planScope);
      if (options.cursor?.kind === 'threads') {
        const after = encodeTraceQueryCursor(threads, { result: 'threads', threadId: options.cursor.threadId });
        threads = planThreadQuery(
          parseQueryThreadsInput({ ...body, page: { ...(body.page as Json), after } }),
          planScope,
        );
      } else if (options.cursor) {
        throw new Error(`Case ${def.id}: cursor kind ${options.cursor.kind} does not apply`);
      }
      plan = { api: 'threads', plan: threads };
      compiled = compileClickHouseThreadQuery(threads);
      break;
    }
    case 'spans': {
      const body: Json = { timeRange, ...request };
      if (options.limit !== undefined) body.page = { ...(body.page as Json), limit: options.limit };
      let spans = planSpanQuery(body, planScope);
      if (options.cursor?.kind === 'spans') {
        const { kind: _kind, ...values } = options.cursor;
        const after = encodeSpanQueryCursor(spans, values);
        spans = planSpanQuery({ ...body, page: { ...(body.page as Json), after } }, planScope);
      } else if (options.cursor) {
        throw new Error(`Case ${def.id}: cursor kind ${options.cursor.kind} does not apply`);
      }
      if (variant !== 'base') throw new Error('span cases have no SQL variants');
      return {
        plan: { api: 'spans', plan: spans },
        compiled: injectSpanProjectScope(compileClickHouseSpanQuery(spans), scope.projectId),
      };
    }
    case 'fields': {
      const fields = planTraceQueryObservedFields(parseGetTraceQueryFieldsArgs({ timeRange, ...request }), planScope);
      plan = { api: 'fields', plan: undefined };
      compiled = compileClickHouseTraceQueryObservedFields(fields);
      break;
    }
    case 'values': {
      const values = planTraceQueryValues(parseGetTraceQueryValuesArgs({ timeRange, ...request }), planScope);
      plan = { api: 'values', plan: undefined };
      compiled = compileClickHouseTraceQueryValues(values);
      break;
    }
  }
  return { plan, compiled: applyVariant(injectProjectScope(compiled, scope.projectId, def.relations), variant) };
}
