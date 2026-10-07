/**
 * Track 1 of the memory investigation: where does the ~170 MiB per-query floor come from?
 *
 *   tsx bench/aggregate-traces/floor.ts [--buckets small,p99,largest] [--probes a,b] [--reps 3]
 *
 * Runs read-only probes against the selected projects and appends one JSONL record per execution to
 * `results/floor.jsonl`. Probes are aggregate-only (no row values leave the server) and every query
 * carries the Tier 1 limits plus the probe's own settings.
 */
import { appendFileSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { CASES, compileCase, timeRangeFor } from './cases';
import { BenchClient, TIERS } from './client';
import { installOutputRedaction, loadCredentials } from './env';
import { labCredentials, loadLabSelection } from './lab';
import { loadSelection } from './profile';
import type { Bucket, SelectedProject } from './profile';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';
import { applyVariant } from './scope';
import type { Variant } from './scope';

const FLOOR_FILE = `${RESULTS_DIR}/floor.jsonl`;
const FLOOR_LAB_FILE = `${RESULTS_DIR}/floor-lab.jsonl`;
const PAUSE_MS = 3_000;
const DAY = 86_400_000;

const ALL_ROOT_COLUMNS = '*';
const NARROW = ['traceId', 'startedAt', 'endedAt', 'error'];
const DIMENSIONS = [
  ...NARROW,
  'dedupeKey',
  'entityType',
  'entityName',
  'environment',
  'threadId',
  'userId',
  'resourceId',
  'serviceName',
  'executionSource',
  'sessionId',
  'organizationId',
  'projectId',
];
const WIDE = [
  'input',
  'output',
  'attributes',
  'metadataRaw',
  'requestContext',
  'metadataSearch',
  'tags',
  'links',
  'scope',
];

type Settings = Record<string, string | number>;

export interface Probe {
  id: string;
  /** What the probe isolates; reported alongside the numbers. */
  note: string;
  sql: (p: SelectedProject, to: Date) => { query: string; params: Record<string, unknown> };
  settings?: Settings;
}

const chTime = (d: Date) => d.toISOString().replace('T', ' ').replace(/Z$/, '');

function scoped(p: SelectedProject, to: Date, days: number) {
  return {
    where: `organizationId = {o:String} AND projectId = {p:String}
      AND startedAt >= {from:DateTime64(3, 'UTC')} AND startedAt < {to:DateTime64(3, 'UTC')}`,
    params: { o: p.organizationId, p: p.projectId, from: chTime(new Date(to.getTime() - days * DAY)), to: chTime(to) },
  };
}

/** Forces every listed column to be read while returning a single row. */
function hashRead(columns: string[] | '*', where: string): string {
  const cols = columns === '*' ? '*' : columns.join(', ');
  return `SELECT count() AS n, sum(cityHash64(${cols})) AS h FROM mastra_trace_roots WHERE ${where}`;
}

function compiled(caseId: string, days: number, variant: Variant = 'base') {
  return (p: SelectedProject, to: Date) => {
    const def = CASES.find(c => c.id === caseId)!;
    const c = compileCase(def, variant, p.literals, timeRangeFor({ id: `${days}d`, ms: days * DAY }, to), p);
    return { query: c.query, params: c.query_params };
  };
}

const ROOT_CTES = new Set(['current_roots', 'root_scope', 'current_spans', 'candidates']);

/**
 * Runs the compiled WITH chain but ends at one CTE, so each stage's own cost shows. Root stages hash only traceId,
 * so the analyzer prunes columns the way the full query would; later stages hash every column they produce.
 */
export function stageQuery(compiledSql: string, cte: string): string {
  const lines = compiledSql.split('\n');
  const final = lines.findLastIndex(l => l.startsWith('SELECT '));
  if (final < 0) throw new Error('compiled query has no top-level SELECT');
  const head = lines.slice(0, final).join('\n');
  if (!new RegExp(`(^|\\n)(WITH )?${cte} AS \\(`).test(head)) throw new Error(`no CTE ${cte}`);
  const hashed = ROOT_CTES.has(cte) ? 'traceId' : '*';
  return `${head}\nSELECT count() AS n, sum(cityHash64(${hashed})) AS h FROM ${cte}`;
}

const STAGES: Record<string, string[]> = {
  F0: ['current_roots', 'root_scope', 'candidates', 'facts'],
  F3: ['current_roots', 'root_scope', 'current_spans', 'candidates', 'facts'],
  E4: ['current_roots', 'root_scope', 'candidates', 'usage', 'facts', 'grouped', 'expanded'],
};

const SETTINGS: Array<[string, Settings, string]> = [
  ['t1', { max_threads: 1 }, 'one read thread'],
  ['t2', { max_threads: 2 }, 'two read threads'],
  ['block8k', { max_block_size: 8192 }, 'smaller blocks'],
  ['rbuf64k', { max_read_buffer_size: 65536, max_read_buffer_size_remote_fs: 65536 }, '64 KiB read buffers'],
  [
    'noprefetch',
    { allow_prefetched_read_pool_for_remote_filesystem: 0, remote_filesystem_read_prefetch: 0 },
    'remote prefetch off',
  ],
  ['nopool', { allow_prefetched_read_pool_for_remote_filesystem: 0 }, 'prefetched read pool off'],
  ['nopf', { remote_filesystem_read_prefetch: 0 }, 'remote read prefetch off'],
  ['pfmem32', { filesystem_prefetch_max_memory_usage: '33554432' }, 'prefetch memory capped at 32 MiB'],
  ['pflimit8', { filesystem_prefetches_limit: 8 }, 'at most 8 prefetches'],
  ['pfbuf256k', { prefetch_buffer_size: 262144 }, '256 KiB prefetch buffers'],
  [
    'lean',
    {
      max_threads: 1,
      max_block_size: 8192,
      max_read_buffer_size: 65536,
      max_read_buffer_size_remote_fs: 65536,
      allow_prefetched_read_pool_for_remote_filesystem: 0,
      remote_filesystem_read_prefetch: 0,
    },
    'all of the above',
  ],
];

export const PROBES: Probe[] = [
  { id: 'select1', note: 'no table read', sql: () => ({ query: 'SELECT 1', params: {} }) },
  {
    id: 'count',
    note: 'scoped count(), sort-key columns only',
    sql: (p, to) => {
      const s = scoped(p, to, 30);
      return { query: `SELECT count() AS n FROM mastra_trace_roots WHERE ${s.where}`, params: s.params };
    },
  },
  {
    id: 'count-notime',
    note: 'scoped count(), no time filter',
    sql: p => ({
      query: 'SELECT count() AS n FROM mastra_trace_roots WHERE organizationId = {o:String} AND projectId = {p:String}',
      params: { o: p.organizationId, p: p.projectId },
    }),
  },
  {
    id: 'count-1d-ended',
    note: 'scoped count(), 1 day, plus endedAt bound so partitions prune',
    sql: (p, to) => {
      const s = scoped(p, to, 1);
      return {
        query: `SELECT count() AS n FROM mastra_trace_roots WHERE ${s.where} AND endedAt >= {from:DateTime64(3, 'UTC')}`,
        params: s.params,
      };
    },
  },
  {
    id: 'count-metrics',
    note: 'scoped count() on mastra_metric_events, 30 days',
    sql: (p, to) => {
      const s = scoped(p, to, 30);
      return {
        query: `SELECT count() AS n FROM mastra_metric_events WHERE organizationId = {o:String} AND projectId = {p:String}
          AND timestamp >= {from:DateTime64(3, 'UTC')} AND timestamp < {to:DateTime64(3, 'UTC')}`,
        params: s.params,
      };
    },
  },
  {
    id: 'count-spans',
    note: 'scoped count() on mastra_span_events, 30 days',
    sql: (p, to) => {
      const s = scoped(p, to, 30);
      return {
        query: `SELECT count() AS n FROM mastra_span_events WHERE organizationId = {o:String} AND projectId = {p:String}
          AND endedAt >= {from:DateTime64(3, 'UTC')} AND endedAt < {to:DateTime64(3, 'UTC')}`,
        params: s.params,
      };
    },
  },
  ...SETTINGS.map(
    ([sid, settings, note]): Probe => ({
      id: `count-${sid}`,
      note: `scoped count(), ${note}`,
      sql: (p, to) => {
        const s = scoped(p, to, 30);
        return { query: `SELECT count() AS n FROM mastra_trace_roots WHERE ${s.where}`, params: s.params };
      },
      settings,
    }),
  ),
  ...(
    [
      ['read-narrow', NARROW, '4 columns'],
      ['read-dims', DIMENSIONS, `${DIMENSIONS.length} dimension columns`],
      ['read-wide', [...DIMENSIONS, ...WIDE], `dimensions + ${WIDE.length} wide payload columns`],
      ['read-all', ALL_ROOT_COLUMNS, 'every column (SELECT *)'],
    ] as const
  ).map(
    ([id, cols, note]): Probe => ({
      id,
      note: `scoped read of ${note}`,
      sql: (p, to) => {
        const s = scoped(p, to, 30);
        return { query: hashRead(cols as string[] | '*', s.where), params: s.params };
      },
    }),
  ),
  {
    id: 'reread-all',
    note: 'current_roots shape: unscoped re-read by traceId, SELECT *, dedupe',
    sql: (p, to) => {
      const s = scoped(p, to, 30);
      return {
        query: `SELECT count() AS n FROM (
          SELECT * FROM mastra_trace_roots
          WHERE traceId IN (SELECT traceId FROM mastra_trace_roots WHERE ${s.where})
          ORDER BY dedupeKey LIMIT 1 BY dedupeKey)`,
        params: s.params,
      };
    },
  },
  {
    id: 'reread-narrow',
    note: 'same re-read, only the columns F0 needs',
    sql: (p, to) => {
      const s = scoped(p, to, 30);
      return {
        query: `SELECT count() AS n FROM (
          SELECT traceId, dedupeKey, startedAt, endedAt, error, organizationId, projectId FROM mastra_trace_roots
          WHERE traceId IN (SELECT traceId FROM mastra_trace_roots WHERE ${s.where})
          ORDER BY dedupeKey LIMIT 1 BY dedupeKey)`,
        params: s.params,
      };
    },
  },
  {
    id: 'reread-narrow-scoped',
    note: 'narrow re-read, also tenant-scoped',
    sql: (p, to) => {
      const s = scoped(p, to, 30);
      return {
        query: `SELECT count() AS n FROM (
          SELECT traceId, dedupeKey, startedAt, endedAt, error, organizationId, projectId FROM mastra_trace_roots
          WHERE organizationId = {o:String} AND projectId = {p:String}
            AND traceId IN (SELECT traceId FROM mastra_trace_roots WHERE ${s.where})
          ORDER BY dedupeKey LIMIT 1 BY dedupeKey)`,
        params: s.params,
      };
    },
  },
  { id: 'F0', note: 'F0 as compiled, 30d', sql: compiled('F0', 30) },
  { id: 'E4', note: 'E4 as compiled, 30d', sql: compiled('E4', 30) },
  { id: 'F3', note: 'F3 (spans.some) as compiled, 30d', sql: compiled('F3', 30) },
  ...['F0', 'E4', 'F3'].flatMap(caseId =>
    SETTINGS.map(
      ([sid, settings, note]): Probe => ({
        id: `${caseId}-${sid}`,
        note: `${caseId} as compiled, 30d, ${note}`,
        sql: compiled(caseId, 30),
        settings,
      }),
    ),
  ),
  ...Object.entries(STAGES).flatMap(([caseId, ctes]) =>
    ctes.map(
      (cte): Probe => ({
        id: `stage-${caseId}-${cte}`,
        note: `${caseId} 30d up to ${cte}`,
        sql: (p, to) => {
          const c = compiled(caseId, 30)(p, to);
          return { query: stageQuery(c.query, cte), params: c.params };
        },
      }),
    ),
  ),
  // Query-shape variants (scope.ts), 30 days; `shape-pf8` adds the prefetch limit on top.
  ...['F0', 'F3', 'E4'].flatMap(caseId =>
    (['rs', 'r1', 'sp', 'nodedupe', 'shape'] as const)
      .filter(v => (v === 'sp' ? caseId === 'F3' : v === 'nodedupe' ? caseId === 'E4' : true))
      .map((v): Probe => ({ id: `${caseId}-${v}`, note: `${caseId} 30d, variant ${v}`, sql: compiled(caseId, 30, v) })),
  ),
  ...['F0', 'F3', 'E4'].flatMap(caseId =>
    [4, 8, 16, 32].map(
      (limit): Probe => ({
        id: `${caseId}-shape-pf${limit}`,
        note: `${caseId} 30d, all shape changes + prefetch limit ${limit}`,
        sql: compiled(caseId, 30, 'shape'),
        settings: { filesystem_prefetches_limit: limit },
      }),
    ),
  ),
  // Root dedupe in sort-key order (compiler-only, so it can run on prod), alone and with the prefetch limit.
  ...['F0', 'F3', 'E1', 'E3', 'E4'].flatMap((caseId): Probe[] => [
    { id: `${caseId}-rio`, note: `${caseId} 30d, variant rio`, sql: compiled(caseId, 30, 'rio') },
    {
      id: `${caseId}-shape-rio-pf8`,
      note: `${caseId} 30d, shape + rio + prefetch limit 8`,
      sql: (p, to) => {
        const c = compiled(caseId, 30, 'shape')(p, to);
        const query = c.query.replace(
          /ORDER BY traceId, dedupeKey(\n\s+LIMIT 1 BY traceId)/,
          'ORDER BY startedAt, traceId, dedupeKey$1',
        );
        if (query === c.query) throw new Error('rio anchor missing');
        return { ...c, query };
      },
      settings: { filesystem_prefetches_limit: 8 },
    },
  ]),
  // Strictly exact subset (`ex`) and the prefetch limit alone.
  ...['F0', 'F3', 'E1', 'E3', 'E4', 'T1', 'T3'].flatMap((caseId): Probe[] => [
    { id: `${caseId}-ex`, note: `${caseId} 30d, variant ex`, sql: compiled(caseId, 30, 'ex') },
    ...(['ex', 'base'] as const).map(
      (v): Probe => ({
        id: `${caseId}-${v}-pf8`,
        note: `${caseId} 30d, variant ${v} + prefetch limit 8`,
        sql: compiled(caseId, 30, v),
        settings: { filesystem_prefetches_limit: 8 },
      }),
    ),
  ]),
  // Compiler-only path that keeps every dedupe (`sk`, `safe` = sk + rio + hk), alone and with the prefetch limit.
  ...['F0', 'F3', 'E1', 'E3', 'E4', 'T1', 'T3'].flatMap((caseId): Probe[] =>
    (['sk', 'safe'] as const).flatMap((v): Probe[] => [
      { id: `${caseId}-${v}`, note: `${caseId} 30d, variant ${v}`, sql: compiled(caseId, 30, v) },
      {
        id: `${caseId}-${v}-pf8`,
        note: `${caseId} 30d, variant ${v} + prefetch limit 8`,
        sql: compiled(caseId, 30, v),
        settings: { filesystem_prefetches_limit: 8 },
      },
    ]),
  ),
  // Token retry dedupe keyed by integers (`hkd`), alone and with the prefetch limit.
  ...['E4', 'T1', 'T3', 'T4'].flatMap((caseId): Probe[] => [
    ...(caseId === 'T4' ? [{ id: 'T4-safe', note: 'T4 30d, variant safe', sql: compiled('T4', 30, 'safe') }] : []),
    { id: `${caseId}-hkd`, note: `${caseId} 30d, variant hkd`, sql: compiled(caseId, 30, 'hkd') },
    ...(['mcall', 'mcallf', 'spanu'] as const).map(
      (v): Probe => ({
        id: `${caseId}-${v}`,
        note: `${caseId} 30d, variant ${v}`,
        sql: compiled(caseId, 30, v),
      }),
    ),
    {
      id: `${caseId}-hkd-pf8`,
      note: `${caseId} 30d, variant hkd + prefetch limit 8`,
      sql: compiled(caseId, 30, 'hkd'),
      settings: { filesystem_prefetches_limit: 8 },
    },
  ]),
  // Token rows read through a trace-ordered projection on mastra_metric_events (lab: `usage_by_trace`).
  ...['E4', 'T1', 'T3', 'T4'].flatMap((caseId): Probe[] =>
    (['sk', 'srio', 'safe'] as const).flatMap((v): Probe[] => [
      {
        id: `${caseId}-${v}-noproj`,
        note: `${caseId} 30d, ${v}, projections off`,
        sql: compiled(caseId, 30, v),
        settings: { optimize_use_projections: 0 },
      },
      {
        id: `${caseId}-${v}-proj`,
        note: `${caseId} 30d, ${v}, trace-ordered projection`,
        sql: compiled(caseId, 30, v),
        settings: { preferred_optimize_projection_name: 'usage_by_trace' },
      },
      {
        id: `${caseId}-${v}-projio`,
        note: `${caseId} 30d, ${v}, trace-ordered projection + aggregation in order`,
        sql: compiled(caseId, 30, v),
        settings: { preferred_optimize_projection_name: 'usage_by_trace', optimize_aggregation_in_order: 1 },
      },
    ]),
  ),
  // Same, against a trace-ordered narrow copy of the token rows (lab table `mastra_metric_by_trace`), which is
  // what the projection would hold: tests whether the (traceId, metricId) dedupe streams in sort order.
  ...['E4', 'T1', 'T3', 'T4'].flatMap((caseId): Probe[] =>
    (['sk', 'safe'] as const).flatMap((v): Probe[] =>
      ([0, 1] as const).map(
        (inOrder): Probe => ({
          id: `${caseId}-${v}-bytrace${inOrder ? '-io' : ''}`,
          note: `${caseId} 30d, ${v}, token rows ordered by trace${inOrder ? ', aggregation in order' : ''}`,
          sql: (p, to) => {
            const c = compiled(caseId, 30, v)(p, to);
            const query = c.query.replace(/FROM mastra_metric_events\n/g, 'FROM mastra_metric_by_trace\n');
            if (query === c.query) throw new Error('token read anchor missing');
            return { ...c, query };
          },
          settings: { optimize_aggregation_in_order: inOrder },
        }),
      ),
    ),
  ),
  // Schema variants (lab only, need `lab.ts derive`), and skip indexes off for the bloom-filter comparison.
  ...['F0', 'F3', 'E1', 'E3', 'E4', 'T1', 'T3', 'T4'].flatMap(caseId =>
    (['base', 'shape', 'urollup', 'snidx', 'arch'] as const).flatMap(v => {
      const relations = { F3: 'spans', E3: 'spans', T4: 'both', E4: 'usage', T1: 'usage', T3: 'usage' } as const;
      const r = relations[caseId as keyof typeof relations];
      if (v === 'urollup' && r !== 'usage' && r !== 'both') return [];
      if (v === 'snidx' && r !== 'spans' && r !== 'both') return [];
      const sql = compiled(caseId, 30, v);
      // F0/F3/E4 `-shape` probes are defined above.
      const defined = (v === 'shape' || v === 'base') && ['F0', 'F3', 'E4'].includes(caseId);
      const probes: Probe[] = defined ? [] : [{ id: `${caseId}-${v}`, note: `${caseId} 30d, variant ${v}`, sql }];
      if (v === 'base' || v === 'shape' || v === 'arch') {
        probes.push({
          id: `${caseId}-${v}-noskip`,
          note: `${caseId} 30d, variant ${v}, skip indexes off`,
          sql,
          settings: { use_skip_indexes: 0 },
        });
      }
      return probes;
    }),
  ),
  // Per-trace path after `arch` (lab only): UInt64 trace keys, no root dedupe, both.
  ...['F0', 'F3', 'E1', 'E3', 'E4', 'T1', 'T3', 'T4'].flatMap((caseId): Probe[] => [
    ...(['hk', 'nord'] as const).map(
      (extra): Probe => ({
        id: `${caseId}-arch-${extra}`,
        note: `${caseId} 30d, arch + ${extra}`,
        sql: (p, to) => {
          const c = compiled(caseId, 30, 'arch')(p, to);
          const out = applyVariant({ query: c.query, query_params: c.params }, extra);
          return { query: out.query, params: c.params };
        },
      }),
    ),
    { id: `${caseId}-arch2`, note: `${caseId} 30d, arch + hk + nord`, sql: compiled(caseId, 30, 'arch2') },
    { id: `${caseId}-arch3`, note: `${caseId} 30d, arch2 + usage on the root row`, sql: compiled(caseId, 30, 'arch3') },
  ]),
  // One day of a 30-day query: the per-query peak if the window were split into daily queries and merged.
  ...['F3', 'E4', 'T1', 'T3'].flatMap((caseId): Probe[] =>
    (['base', 'shape'] as const).map(v => ({
      id: `${caseId}-${v}-1d`,
      note: `${caseId} 1d, ${v}`,
      sql: compiled(caseId, 1, v),
    })),
  ),
  // Dashboard rollup (lab only, `lab.ts derive --tables mastra_usage_hourly`).
  ...['F0', 'E1', 'E4', 'T1', 'T2'].flatMap((caseId): Probe[] => [
    ...(caseId !== 'T2'
      ? []
      : [{ id: `${caseId}-base`, note: `${caseId} as compiled, 30d`, sql: compiled(caseId, 30) }]),
    { id: `${caseId}-hourly`, note: `${caseId} 30d from the hourly rollup`, sql: compiled(caseId, 30, 'hourly') },
  ]),
  ...SETTINGS.filter(([sid]) => sid === 'lean' || sid === 't1').map(
    ([sid, settings, note]): Probe => ({
      id: `read-all-${sid}`,
      note: `scoped SELECT * read, ${note}`,
      sql: (p, to) => {
        const s = scoped(p, to, 30);
        return { query: hashRead('*', s.where), params: s.params };
      },
      settings,
    }),
  ),
];

/** Parts/granules selected by the primary key, parsed from EXPLAIN; the plan text itself is never printed. */
async function indexStats(client: BenchClient, query: string, params: Record<string, unknown>, comment: string) {
  const out = await client.rows<{ explain: string }>(`EXPLAIN indexes = 1 ${query}`, params, {
    tier: TIERS[1],
    logComment: comment,
  });
  if (!out.ok) return `explain failed (${out.errorCode})`;
  const counts = (out.rows ?? [])
    .map(r => r.explain.trim())
    .filter(line => /^(Type|Parts|Granules|Ranges):/.test(line) && !line.includes('{'))
    .map(line => line.replace(/\s+/g, ' '));
  return counts.join(' | ');
}

export interface FloorRecord {
  env: 'prod' | 'local';
  probe: string;
  bucket: Bucket;
  hash: string;
  rep: number;
  /** Filesystem cache bypassed for this execution (object-storage read). */
  cold: boolean;
  ts: string;
  ok: boolean;
  errorCode?: string;
  durationMs: number;
  readRows: number;
  readBytes: number;
  memoryBytes: number;
}

async function main(): Promise<void> {
  installOutputRedaction();
  const { values } = parseArgs({
    options: {
      buckets: { type: 'string', default: 'small,p99,largest' },
      cold: { type: 'boolean', default: false },
      lab: { type: 'boolean', default: false },
      explain: { type: 'boolean', default: false },
      probes: { type: 'string' },
      reps: { type: 'string', default: '3' },
    },
  });
  const lab = Boolean(values.lab);
  const selection = lab ? loadLabSelection() : loadSelection();
  if (!selection) throw new Error('No selection; run profile first');
  const client = lab
    ? new BenchClient(labCredentials())
    : new BenchClient({
        ...loadCredentials(),
        database: (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database,
      });
  const outFile = lab ? FLOOR_LAB_FILE : FLOOR_FILE;
  const to = new Date(selection.anchorTo);
  const buckets = (values.buckets as string).split(',');
  const wanted = values.probes ? new Set((values.probes as string).split(',')) : undefined;
  const probes = PROBES.filter(p => !wanted || wanted.has(p.id));
  const reps = Number(values.reps);
  const projects = selection.projects.filter(p => p.representative && buckets.includes(p.bucket));

  try {
    for (const project of projects) {
      for (const probe of probes) {
        const { query, params } = probe.sql(project, to);
        if (values.explain) {
          const stats = await indexStats(client, query, params, `aqa-bench:floor:explain:${probe.id}`);
          process.stdout.write(`${project.bucket}:${project.hash} ${probe.id} index: ${stats}\n`);
          continue;
        }
        for (let rep = 0; rep < reps; rep++) {
          if (!lab) await new Promise(r => setTimeout(r, PAUSE_MS));
          const outcome = await client.discard(query, params, {
            tier: TIERS[1],
            logComment: `aqa-bench:floor:${probe.id}:${project.bucket}:${project.hash}:${rep}`,
            settings: probe.settings,
            cold: values.cold,
          });
          const s = outcome.summary ?? {};
          const record: FloorRecord = {
            env: lab ? 'local' : 'prod',
            probe: probe.id,
            bucket: project.bucket,
            hash: project.hash,
            rep,
            cold: Boolean(values.cold),
            ts: new Date().toISOString(),
            ok: outcome.ok,
            ...(outcome.ok ? {} : { errorCode: outcome.errorCode }),
            durationMs: Number(s.elapsed_ns ?? 0) / 1e6 || outcome.wallMs,
            readRows: Number(s.read_rows ?? 0),
            readBytes: Number(s.read_bytes ?? 0),
            memoryBytes: Number(s.memory_usage ?? 0),
          };
          appendFileSync(outFile, `${JSON.stringify(record)}\n`);
          const status = outcome.ok
            ? `${Math.round(record.durationMs)} ms, ${(record.readBytes / 1e6).toFixed(1)} MB, ${(record.memoryBytes / 2 ** 20).toFixed(1)} MiB`
            : `FAILED code ${outcome.errorCode}`;
          process.stdout.write(
            `${project.bucket}:${project.hash} ${probe.id}${values.cold ? ' cold' : ''} rep${rep}: ${status}\n`,
          );
        }
      }
    }
  } finally {
    await client.close();
  }
}

if (process.argv[1]?.endsWith('floor.ts')) {
  main().catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exit(1);
  });
}
