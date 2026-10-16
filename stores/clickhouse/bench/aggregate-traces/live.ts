/**
 * X43 (OBS-516): real `POST /traces/aggregate` traffic on Platform, from `system.query_log` on every
 * replica. mobs-query sets no `log_comment` or `query_id`, so aggregate statements are found by the
 * compiler's fingerprint (a `facts` CTE over `mastra_trace_roots`) and the request shape is parsed
 * back out of the logged SQL, where ClickHouse has substituted the parameters.
 *
 * The SQL is parsed in-process and dropped. Tenants come out as the selection's opaque hash (or a
 * salted hash for tenants outside it); dimension names, measure names and numbers are all that is
 * written. No ids, metadata keys, filter literals or rows leave the replica.
 *
 *   npx tsx live.ts scan [--since '2026-10-15 16:24:00']
 *   npx tsx live.ts report
 *   npx tsx live.ts recheck [--n 3]   re-run the latest statement of the n costliest shapes, compare read_rows
 */
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseArgs } from 'node:util';

import { BenchClient, TIERS } from './client';
import { installOutputRedaction, loadCredentials, registerSensitive } from './env';
import { loadSelection } from './profile';
import { PREFLIGHT_FILE, RESULTS_DIR } from './run';

const OUT = join(RESULTS_DIR, 'live-aggregate.jsonl');
const LOG = `clusterAllReplicas('all_groups.default', system.query_log)`;

const INTERVALS: Record<number, string> = {
  60_000: '1m',
  300_000: '5m',
  900_000: '15m',
  3_600_000: '1h',
  86_400_000: '1d',
};
const TOKEN_COLUMNS: Record<string, string> = {
  inputTokens: 'input',
  outputTokens: 'output',
  reasoningTokens: 'reasoning',
  cacheReadTokens: 'cached',
};

export interface AggregateShape {
  dimensions: string[];
  measures: string[];
  interval?: string;
  windowDays?: number;
  scope: 'project' | 'org';
  organizationId?: string;
  projectId?: string;
  /** `spans.some/none` in `where` (a `current_spans` CTE). */
  spans: boolean;
  /** Any root predicate beyond the tenant and window (`where`, or a Platform stand-in filter). */
  rootFilter: boolean;
  having: boolean;
  orderBy?: string;
  limit?: number;
  /** Token/cost source: `usage` table only, or `usage+fallback` to `mastra_metric_events`. */
  usage: 'none' | 'usage' | 'usage+fallback';
}

/** A finished aggregate statement from mobs-query's compiler, not a harness or other read. */
export function isAggregateStatement(sql: string): boolean {
  return /\bfacts AS \(/.test(sql) && /\bFROM mastra_trace_roots\b/.test(sql) && /\bFROM (facts|expanded)\b/.test(sql);
}

/** Top-level comma-separated items of a SELECT list. */
export function splitItems(list: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (let i = 0; i < list.length; i++) {
    const ch = list[i]!;
    if (ch === "'" && list[i - 1] !== '\\') quoted = !quoted;
    if (!quoted && ch === '(') depth++;
    if (!quoted && ch === ')') depth--;
    if (!quoted && ch === ',' && depth === 0) {
      items.push(current.trim());
      current = '';
    } else current += ch;
  }
  if (current.trim()) items.push(current.trim());
  return items;
}

/** `alias → expression` for one SELECT list, from `SELECT ` up to its top-level `FROM`. */
function selectList(text: string): Map<string, string> {
  const body = text.slice(text.indexOf('SELECT ') + 7);
  let depth = 0;
  let end = body.length;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '(') depth++;
    else if (body[i] === ')') depth--;
    else if (depth === 0 && /\sFROM\s/.test(body.slice(i, i + 6))) {
      end = i;
      break;
    }
  }
  const out = new Map<string, string>();
  for (const item of splitItems(body.slice(0, end))) {
    const m = /^(.*) AS (\w+)$/s.exec(item);
    if (m) out.set(m[2]!, m[1]!.trim());
  }
  return out;
}

/** `CAST(expr, 'Nullable(String)') AS d0` (logged) or `CAST(expr AS Nullable(String)) AS d0` (compiled). */
function castColumns(columns: Map<string, string>, prefix: 'd' | 'cd'): Map<string, string> {
  const out = new Map<string, string>();
  for (const [alias, expr] of columns) {
    if (!new RegExp(`^${prefix}\\d+$`).test(alias)) continue;
    const m = /^CAST\((.*?)(?:, 'Nullable\(String\)'| AS Nullable\(String\))\)$/s.exec(expr);
    out.set(alias, dimensionName(m ? m[1]! : expr));
  }
  return out;
}

export function dimensionName(expr: string): string {
  if (/metadataSearch/.test(expr)) return 'metadata';
  if (/^if\(isNotNull\(r\.error\)/.test(expr)) return 'status';
  const column = /^r\.([A-Za-z]+)$/.exec(expr.trim());
  return column ? column[1]! : 'other';
}

/** The text of a top-level `name AS (...)` CTE, by balanced parentheses. */
export function cte(sql: string, name: string): string | undefined {
  const start = sql.search(new RegExp(`\\b${name} AS \\(`));
  if (start < 0) return undefined;
  let depth = 0;
  for (let i = sql.indexOf('(', start); i < sql.length; i++) {
    if (sql[i] === '(') depth++;
    else if (sql[i] === ')' && --depth === 0) return sql.slice(start, i + 1);
  }
  return undefined;
}

function stringLiteral(fragment: string | undefined): string | undefined {
  if (!fragment) return undefined;
  return /^(?:_CAST\()?'((?:[^'\\]|\\.)*)'/.exec(fragment)?.[1];
}

function epochLiteral(sql: string, re: RegExp): number | undefined {
  const m = re.exec(sql);
  if (!m) return undefined;
  const value = m[1]!;
  return /^\d{4}-/.test(value) ? Date.parse(`${value.replace(' ', 'T')}Z`) / 1000 : Number(value);
}

export function parseAggregateShape(sql: string): AggregateShape {
  const candidates = cte(sql, 'candidates') ?? '';
  const candidateColumns = selectList(candidates);
  const dims = castColumns(candidateColumns, 'd');
  const distinct = castColumns(candidateColumns, 'cd');
  const usageCte = cte(sql, 'table_usage') ?? '';
  const tokens = new Map<string, string>();
  for (const m of usageCte.matchAll(/max\((\w+)\) AS (t\d)\b/g)) {
    const kind = TOKEN_COLUMNS[m[1]!];
    if (kind) tokens.set(m[2]!, kind);
  }

  // Bucketed requests compute measures in `grouped`; the others in the final SELECT over `facts`.
  const grouped = cte(sql, 'grouped');
  const tailAt = sql.search(/\sFROM (facts|expanded)\s+(WHERE|GROUP|HAVING|ORDER|LIMIT|FORMAT|$)/);
  const finalAt = sql.lastIndexOf('SELECT ', tailAt);
  const tail = sql.slice(tailAt);
  const measureColumns = selectList(grouped ?? sql.slice(finalAt));
  const measures = [...measureColumns]
    .filter(([alias]) => /^m\d+$/.test(alias))
    .map(([, expr]) => measureName(expr, tokens, distinct));

  let orderBy: string | undefined;
  const orderExpr = grouped ? measureColumns.get('__order') : /ORDER BY (.+?) (?:DESC|ASC) NULLS LAST/.exec(tail)?.[1];
  if (orderExpr !== undefined)
    orderBy = /^d\d+$/.test(orderExpr) ? dims.get(orderExpr) : measureName(orderExpr, tokens, distinct);
  if (grouped && orderBy === undefined) {
    const byDim = /ORDER BY __order (?:DESC|ASC) NULLS LAST|ORDER BY (d\d+) (?:DESC|ASC)/.exec(
      cte(sql, 'ranked') ?? '',
    );
    if (byDim?.[1]) orderBy = dims.get(byDim[1]);
  }
  const keep = measureColumns.get('__keep');
  const having = grouped
    ? keep !== undefined && keep !== 'ifNull(count() > 0, 0)'
    : /HAVING .*count\(\) > 0\)? AND/.test(tail);

  const limitMatch = /__rank BETWEEN 1 AND (?:_CAST\()?(\d+)/.exec(sql) ?? /LIMIT (?:_CAST\()?(\d+)/.exec(tail);
  const bucketed = /__rank BETWEEN/.test(sql);
  const intervalMs = /intDiv\(toUnixTimestamp64Milli\(r\.startedAt\), (\d+)\)/.exec(sql)?.[1];
  const from = epochLiteral(sql, /startedAt >= (?:_CAST\()?'([^']+)'/);
  const to = epochLiteral(sql, /startedAt < (?:_CAST\()?'([^']+)'/);
  const roots = cte(sql, 'current_roots') ?? '';
  const project = stringLiteral(/projectId = (.*)/.exec(roots)?.[1]);
  const rootScope = cte(sql, 'root_scope') ?? '';
  const candidateWhere = /WHERE (.*)\)$/s.exec(candidates)?.[1]?.trim();

  return {
    dimensions: [...dims.keys()].sort().map(k => dims.get(k)!),
    measures,
    ...(intervalMs ? { interval: INTERVALS[Number(intervalMs)] ?? `${intervalMs}ms` } : {}),
    ...(from !== undefined && to !== undefined ? { windowDays: Math.round(((to - from) / 86_400) * 100) / 100 } : {}),
    scope: project === undefined ? 'org' : 'project',
    organizationId: stringLiteral(/organizationId = (.*)/.exec(roots)?.[1]),
    ...(project !== undefined ? { projectId: project } : {}),
    spans: /\bcurrent_spans AS \(/.test(sql),
    rootFilter: !/WHERE 1\s*\)?\s*$/.test(rootScope) || (candidateWhere !== undefined && candidateWhere !== '1'),
    having,
    ...(orderBy ? { orderBy } : {}),
    ...(limitMatch ? { limit: Number(limitMatch[1]) - (bucketed ? 0 : 1) } : {}),
    usage: !/\btable_usage AS \(/.test(sql) ? 'none' : /\bfallback_usage AS \(/.test(sql) ? 'usage+fallback' : 'usage',
  };
}

export function measureName(expr: string, tokens: Map<string, string>, distinct: Map<string, string>): string {
  const e = expr.trim();
  if (e === 'toFloat64(count())') return 'count';
  if (e === 'countIf(isError) / count()') return 'errorRate';
  if (e === 'toFloat64(countIf(isError))') return 'errorCount';
  if (/^avg\(durationMs\)$/.test(e)) return 'duration.avg';
  if (/^min\(durationMs\)$/.test(e)) return 'duration.min';
  if (/^max\(durationMs\)$/.test(e)) return 'duration.max';
  const q = /^quantile\w*\(([\d.]+)\)\(durationMs/.exec(e);
  if (q) return `duration.p${Math.round(Number(q[1]) * 100)}`;
  const d = /uniqExact\((cd\d+)\)/.exec(e);
  if (d) return `countDistinct.${distinct.get(d[1]!) ?? 'other'}`;
  const stat = /avgOrNull/.test(e) ? 'avg' : 'sum';
  if (/traceCost/.test(e)) return `cost.${stat}`;
  const t = [...e.matchAll(/\b(t\d)\b/g)].map(m => tokens.get(m[1]!) ?? m[1]!);
  if (t.length === 2 && t.includes('input') && t.includes('output')) return `tokens.total.${stat}`;
  if (t.length === 1) return `tokens.${t[0]}.${stat}`;
  return 'other';
}

/** Canonical key for grouping statements by request shape. */
export function shapeKey(s: AggregateShape): string {
  const window =
    s.windowDays === undefined
      ? '?'
      : s.windowDays <= 1.05
        ? '≤1d'
        : s.windowDays <= 7.05
          ? '≤7d'
          : s.windowDays <= 31.05
            ? '≤31d'
            : s.windowDays <= 92.05
              ? '≤92d'
              : '>92d';
  return [
    s.scope,
    window,
    s.dimensions.join('×') || '(none)',
    s.interval ?? '-',
    s.measures.join(','),
    s.spans ? 'spans' : '',
    s.rootFilter ? 'where' : '',
    s.having ? 'having' : '',
    s.usage,
  ]
    .filter(Boolean)
    .join(' | ');
}

interface LoggedStatement {
  t: string;
  type: string;
  durationMs: number;
  memMiB: number;
  readRows: number;
  readMiB: number;
  resultRows: number;
  exc: number;
  agent: string;
  /** Bytes read from object storage (cache misses) and from the filesystem cache, as in X36. */
  sourceMiB: number;
  cacheMiB: number;
  query: string;
}

export interface LiveRecord extends Omit<AggregateShape, 'organizationId' | 'projectId'> {
  t: string;
  tenant: string;
  /** Salted hash of the organization alone, to count orgs across per-project and org-wide requests. */
  org: string;
  durationMs: number;
  memMiB: number;
  readRows: number;
  readMiB: number;
  resultRows: number;
  exc: number;
  agent: string;
  sourceMiB: number;
  cacheMiB: number;
  shape: string;
}

async function scan(since: string) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const known = new Map<string, string>();
  for (const p of selection.projects) {
    known.set(`${p.organizationId}/${p.projectId}`, `${p.bucket}:${p.hash}`);
    known.set(`${p.organizationId}/*`, known.get(`${p.organizationId}/*`) ?? `${p.bucket}-org:${p.hash}`);
  }
  const tenant = (s: AggregateShape) => {
    const key = `${s.organizationId}/${s.projectId ?? '*'}`;
    return (
      known.get(key) ??
      `other${s.projectId ? '' : '-org'}:${createHmac('sha256', selection.salt).update(key).digest('hex').slice(0, 8)}`
    );
  };

  const client = new BenchClient({
    ...loadCredentials(),
    database: (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database,
  });
  try {
    const out = await client.rows<LoggedStatement>(
      `SELECT toString(event_time) AS t, toString(type) AS type, query_duration_ms AS durationMs,
              round(memory_usage / 1048576, 1) AS memMiB, read_rows AS readRows,
              round(read_bytes / 1048576, 2) AS readMiB, result_rows AS resultRows, exception_code AS exc,
              splitByChar(' ', http_user_agent)[1] AS agent,
              round(ProfileEvents['CachedReadBufferReadFromSourceBytes'] / 1048576, 2) AS sourceMiB,
              round(ProfileEvents['CachedReadBufferReadFromCacheBytes'] / 1048576, 2) AS cacheMiB, query
       FROM ${LOG}
       WHERE event_date >= toDate({since:DateTime}) AND event_time >= {since:DateTime}
         AND type IN ('QueryFinish', 'ExceptionWhileProcessing', 'ExceptionBeforeStart')
         AND is_initial_query AND query_kind = 'Select' AND NOT startsWith(log_comment, 'aqa-bench')
         AND position(query, 'facts AS (') > 0 AND position(query, 'mastra_trace_roots') > 0
       ORDER BY event_time`,
      { since },
      {
        tier: TIERS[1],
        logComment: 'aqa-bench:live:scan',
        settings: { max_execution_time: 120, max_result_rows: '100000' },
      },
    );
    if (!out.ok) throw new Error(`query_log scan failed: ${out.errorCode}`);
    const records: LiveRecord[] = [];
    for (const { query, ...stat } of out.rows ?? []) {
      if (!isAggregateStatement(query)) continue;
      const shape = parseAggregateShape(query);
      if (shape.organizationId) registerSensitive([shape.organizationId]);
      if (shape.projectId) registerSensitive([shape.projectId]);
      const { organizationId: _o, projectId: _p, ...rest } = shape;
      records.push({
        ...stat,
        ...rest,
        tenant: tenant(shape),
        org: createHmac('sha256', selection.salt).update(`${shape.organizationId}`).digest('hex').slice(0, 8),
        shape: shapeKey(shape),
      });
    }
    writeFileSync(OUT, records.map(r => JSON.stringify(r)).join('\n') + (records.length ? '\n' : ''));
    console.log(
      `${records.length} aggregate statements since ${since} (of ${out.rows?.length ?? 0} fingerprint matches) → ${OUT}`,
    );
  } finally {
    await client.close();
  }
}

/**
 * Spot-check: re-run the most recent live statement of each of the `n` costliest shapes and compare its
 * `read_rows` with the logged one. The time range is a literal in the logged SQL, so the re-run reads
 * the same window; only rows ingested late into it can differ. The SQL stays in memory.
 */
async function recheck(n: number) {
  const client = new BenchClient({
    ...loadCredentials(),
    database: (JSON.parse(readFileSync(PREFLIGHT_FILE, 'utf8')) as { database: string }).database,
  });
  try {
    const out = await client.rows<{ t: string; readRows: string; memMiB: number; query: string }>(
      `SELECT toString(event_time) AS t, read_rows AS readRows, round(memory_usage / 1048576, 1) AS memMiB, query
       FROM ${LOG}
       WHERE event_date >= today() - 2 AND type = 'QueryFinish' AND is_initial_query AND query_kind = 'Select'
         AND NOT startsWith(log_comment, 'aqa-bench')
         AND position(query, 'facts AS (') > 0 AND position(query, 'mastra_trace_roots') > 0
       ORDER BY event_time DESC LIMIT 200`,
      {},
      { tier: TIERS[1], logComment: 'aqa-bench:live:recheck-log', settings: { max_execution_time: 120 } },
    );
    if (!out.ok) throw new Error(`query_log read failed: ${out.errorCode}`);
    const latest = new Map<string, (typeof out.rows & {})[number]>();
    for (const row of out.rows ?? []) {
      if (!isAggregateStatement(row.query)) continue;
      const shape = parseAggregateShape(row.query);
      if (shape.organizationId) registerSensitive([shape.organizationId]);
      if (shape.projectId) registerSensitive([shape.projectId]);
      const key = shapeKey(shape);
      if (!latest.has(key)) latest.set(key, row);
    }
    const picked = [...latest.entries()].sort((a, b) => Number(b[1].readRows) - Number(a[1].readRows)).slice(0, n);
    for (const [key, row] of picked) {
      // clickhouse-js appended its FORMAT clause to the logged text; the client adds it again.
      const sql = row.query.replace(/\s+FORMAT\s+\w+\s*$/, '');
      const again = await client.discard(sql, {}, { tier: TIERS[1], logComment: 'aqa-bench:live:recheck' });
      const rerun = Number(again.summary?.read_rows ?? NaN);
      const logged = Number(row.readRows);
      console.log(
        `${key} (logged ${row.t}): read_rows logged ${logged}, re-run ${again.ok ? rerun : `fail ${again.errorCode}`}, Δ ${(((rerun - logged) / logged) * 100).toFixed(2)}%`,
      );
    }
  } finally {
    await client.close();
  }
}

const pct = (xs: number[], p: number) => {
  if (!xs.length) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};

export function summarize(records: LiveRecord[]) {
  const by = <K extends string>(key: (r: LiveRecord) => K) => {
    const groups = new Map<K, LiveRecord[]>();
    for (const r of records) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
    return [...groups.entries()]
      .map(([k, rs]) => ({
        key: k,
        n: rs.length,
        failed: rs.filter(r => r.exc !== 0).length,
        codes: [...new Set(rs.filter(r => r.exc !== 0).map(r => r.exc))].join(','),
        p50ms: pct(
          rs.map(r => r.durationMs),
          0.5,
        ),
        p95ms: pct(
          rs.map(r => r.durationMs),
          0.95,
        ),
        maxMs: Math.max(...rs.map(r => r.durationMs)),
        p50MiB: pct(
          rs.map(r => r.memMiB),
          0.5,
        ),
        maxMiB: Math.max(...rs.map(r => r.memMiB)),
        maxReadMiB: Math.max(...rs.map(r => r.readMiB)),
        maxResultRows: Math.max(...rs.map(r => r.resultRows)),
        tenants: new Set(rs.map(r => r.tenant)).size,
        // X36's buckets: touched object storage at all, and mostly cold (at least half the bytes from it).
        touchedSource: rs.filter(r => Number(r.sourceMiB) > 0).length,
        mostlyCold: rs.filter(r => Number(r.sourceMiB) > 0 && Number(r.sourceMiB) >= Number(r.cacheMiB)).length,
      }))
      .sort((a, b) => b.n - a.n);
  };
  return {
    total: by(() => 'all'),
    byDay: by(r => r.t.slice(0, 10)),
    byHour: by(r => r.t.slice(0, 13)),
    byOrg: by(r => r.org),
    byTenant: by(r => r.tenant),
    byAgent: by(r => r.agent),
    byShape: by(r => r.shape),
  };
}

function report() {
  if (!existsSync(OUT)) throw new Error('Run `scan` first');
  const records = readFileSync(OUT, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l) as LiveRecord);
  const s = summarize(records);
  for (const [name, rows] of Object.entries(s)) {
    console.log(`\n## ${name}`);
    console.log(
      'key | n | failed (codes) | p50/p95/max ms | p50/max MiB | max read MiB | max result rows | tenants | touched object storage | mostly cold',
    );
    for (const r of rows) {
      console.log(
        `${r.key} | ${r.n} | ${r.failed}${r.codes ? ` (${r.codes})` : ''} | ${r.p50ms}/${r.p95ms}/${r.maxMs} | ${r.p50MiB}/${r.maxMiB} | ${r.maxReadMiB} | ${r.maxResultRows} | ${r.tenants} | ${r.touchedSource} | ${r.mostlyCold}`,
      );
    }
  }
}

async function main() {
  installOutputRedaction();
  const { positionals, values } = parseArgs({
    allowPositionals: true,
    options: { since: { type: 'string', default: '2026-10-15 16:24:00' }, n: { type: 'string', default: '3' } },
  });
  if (positionals[0] === 'scan') await scan(values.since!);
  else if (positionals[0] === 'report') report();
  else if (positionals[0] === 'recheck') await recheck(Number(values.n));
  else throw new Error('usage: live.ts scan|report|recheck');
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
