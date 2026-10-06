/**
 * Case catalogue. Every case is a public request built here, validated and planned by the real
 * core planner, compiled by the merged ClickHouse compiler, then project-scoped and optionally
 * rewritten into a labelled variant (see ../shared/scope.ts). Nothing here changes compiler behaviour.
 */
import {
  parseTraceAggregateRequest,
  parseTraceQueryRequest,
  planTraceAggregate,
  planTraceQuery,
} from '@mastra/core/storage';

import { compileClickHouseTraceAggregate } from '../../src/storage/domains/observability/v-next/trace-aggregate';
import {
  compileClickHouseTraceQuery,
  compileClickHouseTraceRootPayloads,
} from '../../src/storage/domains/observability/v-next/trace-query';
import type { CompiledClickHouseTraceQuery } from '../../src/storage/domains/observability/v-next/trace-query';
import { DOC_LITERALS } from '../shared/profile';
import type { Literals, ProjectScope } from '../shared/profile';
import { applyVariant, injectProjectScope, scopePayloadQuery } from '../shared/scope';
import type { Relation, Variant } from '../shared/scope';

export { DOC_LITERALS };
export type { Literals, ProjectScope };

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export interface WindowDef {
  id: string;
  ms: number;
}

export const STANDARD_WINDOWS = {
  '1d': { id: '1d', ms: DAY },
  '7d': { id: '7d', ms: 7 * DAY },
  '30d': { id: '30d', ms: 30 * DAY },
} satisfies Record<string, WindowDef>;

const W = STANDARD_WINDOWS;

export type CaseGroup = 'canonical' | 'highcard' | 'interval' | 'pushdown' | 'distinct' | 'percentile' | 'baseline';

export interface CaseDef {
  id: string;
  group: CaseGroup;
  title: string;
  kind: 'aggregate' | 'traces';
  windows: WindowDef[];
  relations: Relation[];
  variants: Variant[];
  /** Runs on every project in a bucket rather than one representative. */
  core: boolean;
  /** Literals come from the decision doc instead of per-project discovery. */
  docLiterals?: boolean;
  /** Relative cost used to order cases cheap → expensive within a window. */
  cost: number;
  request(literals: Literals): Record<string, unknown>;
}

type Json = Record<string, unknown>;

const eq = (path: string, literal: string): Json => ({ op: 'eq', left: { path }, right: { literal } });
const and = (...args: Json[]): Json => ({ op: 'and', args });
const or = (...args: Json[]): Json => ({ op: 'or', args });
const spansSome = (predicate: Json): Json => ({ spans: { some: predicate } });

const envEq = (l: Literals) => eq('environment', l.environment);
const toolCalled = (l: Literals) => spansSome(eq('name', l.tool));

const PERCENTILES = ['duration.p50', 'duration.p95', 'duration.p99'];

function intervalWindow(id: string, buckets: number, intervalMs: number): WindowDef {
  return { id, ms: buckets * intervalMs };
}

export const CASES: CaseDef[] = [
  // --- Pushdown (1d / 7d / 30d) ---
  {
    id: 'F0',
    group: 'pushdown',
    title: 'no where, count',
    kind: 'aggregate',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: [],
    variants: ['base', 'w1'],
    core: true,
    cost: 1,
    request: () => ({ measures: ['count'] }),
  },
  {
    id: 'F1',
    group: 'pushdown',
    title: 'environment eq (pushed into seed)',
    kind: 'aggregate',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: [],
    variants: ['base', 'w1'],
    core: true,
    cost: 2,
    request: l => ({ measures: ['count'], where: envEq(l) }),
  },
  {
    id: 'F2',
    group: 'pushdown',
    title: 'entityType eq AND environment eq (pushed)',
    kind: 'aggregate',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: [],
    variants: ['base'],
    core: false,
    cost: 3,
    request: l => ({ measures: ['count'], where: and(eq('entityType', l.entityType), envEq(l)) }),
  },
  {
    id: 'F3',
    group: 'pushdown',
    title: 'spans.some(name eq) (not pushed)',
    kind: 'aggregate',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: ['spans'],
    variants: ['base'],
    core: true,
    cost: 20,
    request: l => ({ measures: ['count'], where: toolCalled(l) }),
  },
  {
    id: 'F4',
    group: 'pushdown',
    title: 'environment eq AND spans.some (partially pushed)',
    kind: 'aggregate',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: ['spans'],
    variants: ['base'],
    core: false,
    cost: 19,
    request: l => ({ measures: ['count'], where: and(envEq(l), toolCalled(l)) }),
  },
  {
    id: 'F5',
    group: 'pushdown',
    title: 'environment eq OR spans.some (nothing pushed)',
    kind: 'aggregate',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: ['spans'],
    variants: ['base'],
    core: false,
    cost: 21,
    request: l => ({ measures: ['count'], where: or(envEq(l), toolCalled(l)) }),
  },

  // --- Baseline queryTraces() (1d / 7d / 30d) ---
  {
    id: 'Q0',
    group: 'baseline',
    title: 'queryTraces, no where (same selection as F0)',
    kind: 'traces',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: [],
    variants: ['base'],
    core: true,
    cost: 4,
    request: () => ({}),
  },
  {
    id: 'Q1',
    group: 'baseline',
    title: 'queryTraces, environment eq (same selection as F1)',
    kind: 'traces',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: [],
    variants: ['base'],
    core: false,
    cost: 5,
    request: l => ({ where: envEq(l) }),
  },
  {
    id: 'Q3',
    group: 'baseline',
    title: 'queryTraces, spans.some(name eq) (same selection as F3)',
    kind: 'traces',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: ['spans'],
    variants: ['base'],
    core: false,
    cost: 22,
    request: l => ({ where: toolCalled(l) }),
  },

  // --- Canonical decision-doc examples (1d / 7d / 30d) ---
  {
    id: 'E1',
    group: 'canonical',
    title: 'Ex.1 runs per agent per day, env eq top env',
    kind: 'aggregate',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: [],
    variants: ['base'],
    core: true,
    cost: 6,
    request: l => ({
      where: envEq(l),
      groupBy: ['entityName'],
      interval: '1d',
      measures: ['count', 'errorRate'],
      limit: 100,
    }),
  },
  {
    id: 'E2',
    group: 'canonical',
    title: 'Ex.2 slowest agents by p95 > 5s',
    kind: 'aggregate',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: [],
    variants: ['base'],
    core: true,
    cost: 7,
    request: () => ({
      groupBy: ['entityName'],
      measures: ['count', 'duration.p95'],
      having: { op: 'gt', left: { path: 'duration.p95' }, right: { literal: 5000 } },
      orderBy: { field: 'duration.p95', direction: 'desc' },
      limit: 10,
    }),
  },
  {
    id: 'E3',
    group: 'canonical',
    title: 'Ex.3 traces calling top tool, by top metadata key',
    kind: 'aggregate',
    windows: [W['1d'], W['7d'], W['30d']],
    relations: ['spans'],
    variants: ['base'],
    core: true,
    cost: 23,
    request: l => ({
      where: toolCalled(l),
      groupBy: [`metadata.${l.metadataKey}`],
      measures: ['count', 'countDistinct.threadId'],
    }),
  },
  {
    id: 'E1-doc',
    group: 'canonical',
    title: "Ex.1 with the doc's literal (environment = production)",
    kind: 'aggregate',
    windows: [W['7d']],
    relations: [],
    variants: ['base'],
    core: false,
    docLiterals: true,
    cost: 6,
    request: l => ({
      where: envEq(l),
      groupBy: ['entityName'],
      interval: '1d',
      measures: ['count', 'errorRate'],
      limit: 100,
    }),
  },
  {
    id: 'E3-doc',
    group: 'canonical',
    title: "Ex.3 with the doc's literals (medication_lookup, metadata.tenant)",
    kind: 'aggregate',
    windows: [W['7d']],
    relations: ['spans'],
    variants: ['base'],
    core: false,
    docLiterals: true,
    cost: 23,
    request: l => ({
      where: toolCalled(l),
      groupBy: [`metadata.${l.metadataKey}`],
      measures: ['count', 'countDistinct.threadId'],
    }),
  },

  // --- countDistinct (7d / 30d) ---
  {
    id: 'C1',
    group: 'distinct',
    title: 'countDistinct.traceId, ungrouped',
    kind: 'aggregate',
    windows: [W['7d'], W['30d']],
    relations: [],
    variants: ['base', 'uniq'],
    core: false,
    cost: 8,
    request: () => ({ measures: ['count', 'countDistinct.traceId'] }),
  },
  {
    id: 'C2',
    group: 'distinct',
    title: 'countDistinct.threadId, ungrouped',
    kind: 'aggregate',
    windows: [W['7d'], W['30d']],
    relations: [],
    variants: ['base', 'uniq'],
    core: false,
    cost: 9,
    request: () => ({ measures: ['count', 'countDistinct.threadId'] }),
  },
  {
    id: 'C3',
    group: 'distinct',
    title: 'countDistinct.userId by entityName',
    kind: 'aggregate',
    windows: [W['7d'], W['30d']],
    relations: [],
    variants: ['base', 'uniq'],
    core: false,
    cost: 10,
    request: () => ({ groupBy: ['entityName'], measures: ['count', 'countDistinct.userId'] }),
  },

  // --- Percentiles (7d / 30d) ---
  {
    id: 'P1',
    group: 'percentile',
    title: 'p50/p95/p99, ungrouped',
    kind: 'aggregate',
    windows: [W['7d'], W['30d']],
    relations: [],
    variants: ['base', 'exact'],
    core: false,
    cost: 11,
    request: () => ({ measures: PERCENTILES }),
  },
  {
    id: 'P2',
    group: 'percentile',
    title: 'p50/p95/p99 by entityName',
    kind: 'aggregate',
    windows: [W['7d'], W['30d']],
    relations: [],
    variants: ['base', 'exact'],
    core: false,
    cost: 12,
    request: () => ({ groupBy: ['entityName'], measures: PERCENTILES }),
  },
  {
    id: 'P3',
    group: 'percentile',
    title: 'p50/p95/p99 by threadId, limit 100',
    kind: 'aggregate',
    windows: [W['7d'], W['30d']],
    relations: [],
    variants: ['base', 'exact'],
    core: false,
    cost: 30,
    request: () => ({ groupBy: ['threadId'], measures: PERCENTILES, limit: 100 }),
  },

  // --- High-cardinality groupBy (7d / 30d) ---
  ...(
    [
      ['H1', 'threadId', 10, 31],
      ['H2', 'threadId', 100, 32],
      ['H3', 'threadId', 1000, 33],
      ['H4', 'userId', 100, 34],
      ['H5', 'userId', 1000, 35],
    ] as const
  ).map(
    ([id, dimension, limit, cost]): CaseDef => ({
      id,
      group: 'highcard',
      title: `groupBy ${dimension}, limit ${limit}`,
      kind: 'aggregate',
      windows: [W['7d'], W['30d']],
      relations: [],
      variants: ['base'],
      core: false,
      cost,
      request: () => ({ groupBy: [dimension], measures: ['count'], limit }),
    }),
  ),
  {
    id: 'H6',
    group: 'highcard',
    title: 'groupBy [threadId, userId], limit 100',
    kind: 'aggregate',
    windows: [W['7d'], W['30d']],
    relations: [],
    variants: ['base'],
    core: false,
    cost: 36,
    request: () => ({ groupBy: ['threadId', 'userId'], measures: ['count'], limit: 100 }),
  },
  {
    id: 'H7',
    group: 'highcard',
    title: 'groupBy threadId, having count > 1, order by p95',
    kind: 'aggregate',
    windows: [W['7d'], W['30d']],
    relations: [],
    variants: ['base'],
    core: false,
    cost: 37,
    request: () => ({
      groupBy: ['threadId'],
      measures: ['count', 'duration.p95'],
      having: { op: 'gt', left: { path: 'count' }, right: { literal: 1 } },
      orderBy: { field: 'duration.p95', direction: 'desc' },
    }),
  },

  // --- Interval path at the bucket / row caps (fixed windows) ---
  {
    id: 'I1',
    group: 'interval',
    title: '15m × 1000 buckets (~10.4d), by entityName, limit 10',
    kind: 'aggregate',
    windows: [intervalWindow('1000x15m', 1000, 15 * MINUTE)],
    relations: [],
    variants: ['base'],
    core: false,
    cost: 40,
    request: () => ({ groupBy: ['entityName'], interval: '15m', measures: ['count', 'errorRate'], limit: 10 }),
  },
  {
    id: 'I2',
    group: 'interval',
    title: '1h × 720 buckets (30d), by entityName, limit 13',
    kind: 'aggregate',
    windows: [intervalWindow('720x1h', 720, HOUR)],
    relations: [],
    variants: ['base'],
    core: false,
    cost: 41,
    request: () => ({ groupBy: ['entityName'], interval: '1h', measures: ['count', 'errorRate'], limit: 13 }),
  },
  {
    id: 'I3',
    group: 'interval',
    title: '1m × 1000 buckets (~16.7h), by entityName, limit 10',
    kind: 'aggregate',
    windows: [intervalWindow('1000x1m', 1000, MINUTE)],
    relations: [],
    variants: ['base'],
    core: false,
    cost: 39,
    request: () => ({ groupBy: ['entityName'], interval: '1m', measures: ['count', 'errorRate'], limit: 10 }),
  },
  {
    id: 'I4',
    group: 'interval',
    title: '1h × 168 buckets (7d), by threadId, limit 50',
    kind: 'aggregate',
    windows: [intervalWindow('168x1h', 168, HOUR)],
    relations: [],
    variants: ['base'],
    core: false,
    cost: 42,
    request: () => ({ groupBy: ['threadId'], interval: '1h', measures: ['count', 'errorRate'], limit: 50 }),
  },
];

/** `to` is the start of the UTC hour, so every interval window starts on a bucket boundary. */
export function anchorTo(now: Date): Date {
  const to = new Date(now);
  to.setUTCMinutes(0, 0, 0);
  return to;
}

export function timeRangeFor(window: WindowDef, to: Date): { from: string; to: string } {
  return { from: new Date(to.getTime() - window.ms).toISOString(), to: to.toISOString() };
}

/** Compiles one case/variant/window for one project. For `traces` cases this is the list+total stage. */
export function compileCase(
  def: CaseDef,
  variant: Variant,
  literals: Literals,
  timeRange: { from: string; to: string },
  scope: ProjectScope,
): CompiledClickHouseTraceQuery {
  if (!def.variants.includes(variant)) throw new Error(`Case ${def.id} has no variant ${variant}`);
  const body = { timeRange, ...def.request(def.docLiterals ? DOC_LITERALS : literals) };
  const planScope = { scope: { organizationId: scope.organizationId } };
  const compiled =
    def.kind === 'aggregate'
      ? compileClickHouseTraceAggregate(planTraceAggregate(parseTraceAggregateRequest(body), planScope))
      : compileClickHouseTraceQuery(
          planTraceQuery(parseTraceQueryRequest({ ...body, pagination: { page: 0, perPage: 25 } }), planScope),
        );
  return applyVariant(injectProjectScope(compiled, scope.projectId, def.relations), variant);
}

export interface PageKey {
  traceId: string;
  rootSpanId: string;
  startedAt: string;
  endedAt: string;
}

/** Payload stage of `queryTraces()` page mode, as compiled (unscoped) or with the org/project scope added. */
export function compilePayloadStage(
  keys: PageKey[],
  scope: ProjectScope,
  scoped: boolean,
): CompiledClickHouseTraceQuery {
  const compiled = compileClickHouseTraceRootPayloads(keys);
  return scoped ? scopePayloadQuery(compiled, scope.organizationId, scope.projectId) : compiled;
}

export function caseById(id: string): CaseDef {
  const def = CASES.find(candidate => candidate.id === id);
  if (!def) throw new Error(`Unknown case ${id}`);
  return def;
}
