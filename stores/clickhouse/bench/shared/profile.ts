/**
 * Per-project volume profile, bucket selection and literal discovery. Every query here is
 * aggregate-only. Real org/project ids and discovered literals stay in memory and in the 0600
 * selection file outside the repo; everything written to results/ uses bucket + opaque hash.
 */
import { createHmac, randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import type { BenchClient, Tier } from './client';
import { CACHE_DIR, registerSensitive, SELECTION_FILE } from './env';

export interface ProjectScope {
  organizationId: string;
  projectId: string;
}

/** Literals that drive selectivity. Discovered per project (kept out of all output), or the doc's values. */
export interface Literals {
  environment: string;
  tool: string;
  metadataKey: string;
  entityType: string;
}

export const DOC_LITERALS: Literals = {
  environment: 'production',
  tool: 'medication_lookup',
  metadataKey: 'tenant',
  entityType: 'agent',
};

export const BUCKETS = ['small', 'mid', 'p90', 'p99', 'largest'] as const;
export type Bucket = (typeof BUCKETS)[number];

/** Smallest project worth measuring at all. */
export const MIN_TRACES = 10;
/** Floor for the mid bucket, so it stays distinct from `small` on a skewed distribution. */
export const MIN_MID_TRACES = 100;
export const PROJECTS_PER_BUCKET = 3;

export interface Distribution {
  windowDays: number;
  projects: number;
  traces: number;
  p25: number;
  p75: number;
  p50: number;
  p90: number;
  p99: number;
  max: number;
  nullProjectTraces: number;
}

export interface ProjectStats {
  traces30d: number;
  spans30d: number | null;
  threads30d: number | null;
  users30d: number | null;
  tokenRows30d: number | null;
}

export interface SelectedProject extends ProjectScope {
  bucket: Bucket;
  hash: string;
  /** Representative project of its bucket; non-core cases run only on this one. */
  representative: boolean;
  stats: ProjectStats;
  literals: Literals;
  literalSource: Partial<Record<keyof Literals, 'discovered' | 'doc'>>;
}

export interface Selection {
  version: 1;
  salt: string;
  database: string;
  profiledAt: string;
  anchorTo: string;
  distribution: Distribution;
  projects: SelectedProject[];
}

export function projectHash(salt: string, scope: ProjectScope): string {
  return createHmac('sha256', salt).update(`${scope.organizationId}/${scope.projectId}`).digest('hex').slice(0, 8);
}

export function newSalt(): string {
  return randomBytes(16).toString('hex');
}

/**
 * Bucket targets from the distribution. Production is heavily skewed (most projects have a handful of
 * traces), so `small` is the typical project (p50) and `mid` is p75 with a floor that keeps it apart.
 */
export function bucketTargets(d: Distribution): Record<Bucket, number> {
  return {
    small: Math.max(d.p50, MIN_TRACES),
    mid: Math.max(d.p75, MIN_MID_TRACES),
    p90: d.p90,
    p99: d.p99,
    largest: d.max,
  };
}

export interface Candidate extends ProjectScope {
  bucket: Bucket;
  traces: number;
  representative?: boolean;
}

/**
 * Picks up to `perBucket` projects per bucket, nearest to the target first. Larger buckets pick
 * first so the tail keeps its few projects; a project is never used twice.
 */
export function pickProjects(candidates: Candidate[], perBucket = PROJECTS_PER_BUCKET): Candidate[] {
  const used = new Set<string>();
  const picked: Candidate[] = [];
  for (const bucket of [...BUCKETS].reverse()) {
    let count = 0;
    for (const candidate of candidates.filter(c => c.bucket === bucket)) {
      const key = `${candidate.organizationId}\u0000${candidate.projectId}`;
      if (count >= perBucket || used.has(key)) continue;
      used.add(key);
      picked.push({ ...candidate, representative: count === 0 });
      count += 1;
    }
  }
  return picked.sort((a, b) => BUCKETS.indexOf(a.bucket) - BUCKETS.indexOf(b.bucket) || a.traces - b.traces);
}

// ---------------------------------------------------------------------------
// SQL (aggregate-only)
// ---------------------------------------------------------------------------

const ROOTS_WINDOW = "startedAt >= {from:DateTime64(3, 'UTC')} AND startedAt < {to:DateTime64(3, 'UTC')}";

export const GAUGE_SQL = `SELECT count() AS projects, sum(c) AS traces
FROM (SELECT organizationId, projectId, count() AS c FROM mastra_trace_roots WHERE ${ROOTS_WINDOW} GROUP BY organizationId, projectId)`;

export const DISTRIBUTION_SQL = `SELECT
  countIf(p IS NOT NULL) AS projects,
  sum(c) AS traces,
  quantilesExactIf(0.25, 0.5, 0.75, 0.9, 0.99)(c, p IS NOT NULL) AS q,
  maxIf(c, p IS NOT NULL) AS max,
  sumIf(c, p IS NULL) AS null_project_traces
FROM (SELECT organizationId AS o, projectId AS p, count() AS c FROM mastra_trace_roots WHERE ${ROOTS_WINDOW} GROUP BY o, p)`;

export const CANDIDATES_SQL = `WITH per AS (
  SELECT organizationId AS o, assumeNotNull(projectId) AS p, count() AS c
  FROM mastra_trace_roots
  WHERE ${ROOTS_WINDOW} AND projectId IS NOT NULL
  GROUP BY o, p
  HAVING c >= {min:UInt64}
)
SELECT bucket, o, p, c FROM per
ARRAY JOIN {buckets:Array(String)} AS bucket, {targets:Array(Float64)} AS target
ORDER BY bucket, abs(c - target), o, p
LIMIT {spare:UInt32} BY bucket`;

const SCOPE = 'organizationId = {o:String} AND projectId = {p:String}';

export const STATS_SQL = {
  roots: `SELECT uniq(threadId) AS threads, uniq(userId) AS users FROM mastra_trace_roots WHERE ${SCOPE} AND ${ROOTS_WINDOW}`,
  spans: `SELECT count() AS n FROM mastra_span_events WHERE ${SCOPE} AND endedAt >= {from:DateTime64(3, 'UTC')} AND endedAt < {to:DateTime64(3, 'UTC')}`,
  tokens: `SELECT count() AS n FROM mastra_metric_events WHERE ${SCOPE} AND timestamp >= {from:DateTime64(3, 'UTC')} AND timestamp < {to:DateTime64(3, 'UTC')} AND name LIKE 'mastra_model_%'`,
};

export const DISCOVERY_SQL: Record<keyof Literals, string> = {
  environment: `SELECT environment AS v FROM mastra_trace_roots WHERE ${SCOPE} AND ${ROOTS_WINDOW} AND environment IS NOT NULL AND environment != '' GROUP BY v ORDER BY count() DESC, v LIMIT 1`,
  entityType: `SELECT entityType AS v FROM mastra_trace_roots WHERE ${SCOPE} AND ${ROOTS_WINDOW} AND entityType IS NOT NULL GROUP BY v ORDER BY count() DESC, v LIMIT 1`,
  tool: `SELECT name AS v FROM mastra_span_events WHERE ${SCOPE} AND endedAt >= {from:DateTime64(3, 'UTC')} AND endedAt < {to:DateTime64(3, 'UTC')} AND spanType = 'tool_call' AND name != '' GROUP BY v ORDER BY count() DESC, v LIMIT 1`,
  metadataKey: `SELECT k AS v FROM mastra_trace_roots ARRAY JOIN mapKeys(metadataSearch) AS k WHERE ${SCOPE} AND ${ROOTS_WINDOW} GROUP BY v ORDER BY count() DESC, v LIMIT 1`,
};

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export interface ProfileContext {
  client: BenchClient;
  tier: Tier;
  /** Extra settings for profile scans (the plan allows 60 s here). */
  logComment: (step: string) => string;
  pause: () => Promise<void>;
}

/** Same textual format the compiler's ParameterBuilder binds for DateTime64(3, 'UTC'). */
const chTime = (d: Date) => d.toISOString().replace('T', ' ').replace(/Z$/, '');

function range(to: Date, days: number) {
  return { from: chTime(new Date(to.getTime() - days * 86_400_000)), to: chTime(to) };
}

async function one<Row>(
  ctx: ProfileContext,
  step: string,
  sql: string,
  params: Record<string, unknown>,
  timeoutS = 60,
) {
  await ctx.pause();
  const outcome = await ctx.client.rows<Row>(sql, params, {
    tier: ctx.tier,
    logComment: ctx.logComment(step),
    settings: { max_execution_time: timeoutS, max_result_rows: '200' },
  });
  if (!outcome.ok) {
    throw new Error(`Profile step ${step} failed (code ${outcome.errorCode ?? '?'}, ${outcome.errorCategory})`);
  }
  return outcome;
}

export async function gauge(ctx: ProfileContext, to: Date) {
  const outcome = await one<{ projects: number; traces: number }>(ctx, 'gauge-1d', GAUGE_SQL, range(to, 1));
  return {
    projects: Number(outcome.rows![0]!.projects),
    traces: Number(outcome.rows![0]!.traces),
    wallMs: outcome.wallMs,
  };
}

export async function distribution(ctx: ProfileContext, to: Date): Promise<Distribution> {
  const outcome = await one<{
    projects: number;
    traces: number;
    q: number[];
    max: number;
    null_project_traces: number;
  }>(ctx, 'distribution-30d', DISTRIBUTION_SQL, range(to, 30));
  const row = outcome.rows![0]!;
  const [p25, p50, p75, p90, p99] = row.q.map(Number);
  return {
    windowDays: 30,
    projects: Number(row.projects),
    traces: Number(row.traces),
    p25: p25!,
    p75: p75!,
    p50: p50!,
    p90: p90!,
    p99: p99!,
    max: Number(row.max),
    nullProjectTraces: Number(row.null_project_traces),
  };
}

export async function candidates(ctx: ProfileContext, to: Date, d: Distribution): Promise<Candidate[]> {
  const targets = bucketTargets(d);
  const outcome = await one<{ bucket: Bucket; o: string; p: string; c: number }>(
    ctx,
    'candidates-30d',
    CANDIDATES_SQL,
    {
      ...range(to, 30),
      min: MIN_TRACES,
      buckets: [...BUCKETS],
      targets: BUCKETS.map(bucket => targets[bucket]),
      spare: PROJECTS_PER_BUCKET * BUCKETS.length,
    },
  );
  const rows = outcome.rows!;
  registerSensitive(rows.flatMap(row => [row.o, row.p]));
  return rows.map(row => ({ bucket: row.bucket, organizationId: row.o, projectId: row.p, traces: Number(row.c) }));
}

export interface TableColumns {
  /** Column names per table, from preflight. Used to skip stats a table cannot answer. */
  [table: string]: Set<string>;
}

export async function projectStats(
  ctx: ProfileContext,
  to: Date,
  candidate: Candidate,
  columns: TableColumns,
): Promise<ProjectStats> {
  const params = { ...range(to, 30), o: candidate.organizationId, p: candidate.projectId };
  const roots = await one<{ threads: number; users: number }>(ctx, 'stats-roots', STATS_SQL.roots, params);
  const scoped = (table: string) => columns[table]?.has('organizationId') && columns[table]?.has('projectId');
  const spans = scoped('mastra_span_events')
    ? Number((await one<{ n: number }>(ctx, 'stats-spans', STATS_SQL.spans, params)).rows![0]!.n)
    : null;
  const tokens = scoped('mastra_metric_events')
    ? Number((await one<{ n: number }>(ctx, 'stats-tokens', STATS_SQL.tokens, params)).rows![0]!.n)
    : null;
  return {
    traces30d: candidate.traces,
    spans30d: spans,
    threads30d: Number(roots.rows![0]!.threads),
    users30d: Number(roots.rows![0]!.users),
    tokenRows30d: tokens,
  };
}

/** Discovers the project's top values over 7 days. Values stay in memory and the selection file. */
export async function discoverLiterals(ctx: ProfileContext, to: Date, scope: ProjectScope) {
  const params = { ...range(to, 7), o: scope.organizationId, p: scope.projectId };
  const literals: Literals = { ...DOC_LITERALS };
  const literalSource: SelectedProject['literalSource'] = {};
  for (const key of Object.keys(DISCOVERY_SQL) as Array<keyof Literals>) {
    const outcome = await one<{ v: string }>(ctx, `discover-${key}`, DISCOVERY_SQL[key], params);
    const value = outcome.rows?.[0]?.v;
    if (value) {
      registerSensitive([value]);
      literals[key] = value;
      literalSource[key] = 'discovered';
    } else {
      literalSource[key] = 'doc';
    }
  }
  return { literals, literalSource };
}

// ---------------------------------------------------------------------------
// Selection file (outside the repo, 0600)
// ---------------------------------------------------------------------------

export function saveSelection(selection: Selection): void {
  mkdirSync(CACHE_DIR, { recursive: true, mode: 0o700 });
  writeFileSync(SELECTION_FILE, JSON.stringify(selection, null, 2), { mode: 0o600 });
  chmodSync(SELECTION_FILE, 0o600);
}

export function loadSelection(): Selection | undefined {
  if (!existsSync(SELECTION_FILE)) return undefined;
  const selection = JSON.parse(readFileSync(SELECTION_FILE, 'utf8')) as Selection;
  registerSelectionSecrets(selection);
  return selection;
}

export function registerSelectionSecrets(selection: Selection): void {
  registerSensitive([selection.salt]);
  for (const project of selection.projects) {
    registerSensitive([project.organizationId, project.projectId]);
    for (const key of Object.keys(project.literalSource) as Array<keyof Literals>) {
      if (project.literalSource[key] === 'discovered') registerSensitive([project.literals[key]]);
    }
  }
}

/** The shareable view of a selection: buckets, hashes and rounded volumes only. */
export function publicProfile(selection: Selection) {
  const round = (n: number | null) => (n === null ? null : Number(n.toPrecision(2)));
  return {
    profiledAt: selection.profiledAt,
    anchorTo: selection.anchorTo,
    distribution: selection.distribution,
    projects: selection.projects.map(p => ({
      bucket: p.bucket,
      hash: p.hash,
      representative: p.representative,
      traces30d: round(p.stats.traces30d),
      spans30d: round(p.stats.spans30d),
      threads30d: round(p.stats.threads30d),
      users30d: round(p.stats.users30d),
      tokenRows30d: round(p.stats.tokenRows30d),
      literalSource: p.literalSource,
    })),
  };
}
