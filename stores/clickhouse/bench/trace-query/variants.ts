/**
 * Memory-experiment variants for `queryTraces()` (EXPERIMENTS.md). Each variant is either a settings overlay or a
 * fail-closed rewrite of the project-scoped compiled SQL: every anchor must match exactly once, otherwise the
 * variant throws `RewriteError` and the case is recorded as not applicable. Variants compose with `+`
 * (`nh+rs+pf8`), applied left to right.
 */
import { TupleParam } from '@clickhouse/client';
import type { ClickHouseSettings } from '@clickhouse/client';

import { PROJECT_PARAM, RewriteError } from '../shared/scope';
import type { Statement } from './stages';

const PROJECT = `{${PROJECT_PARAM}:String}`;
export const KEYS_PARAM = 'bench_payload_keys';

/** A variant's output: one statement, or two that run back to back (the second needs the first's keys). */
export interface VariantPlan {
  statements: Statement[];
  settings: ClickHouseSettings;
  /** Settings for stage 2 only (`<id>@2` overlays), merged over `settings`. */
  hydrateSettings: ClickHouseSettings;
  /** Two-stage variants: builds stage 2 from the keys stage 1 returned (startedAt, traceId, dedupeKey). */
  hydrate?: (keys: Array<[string, string, string]>) => Statement;
}

interface VariantDef {
  id: string;
  note: string;
  settings?: ClickHouseSettings;
  rewrite?: (statement: Statement) => Statement;
  /** Turns the plan into a two-stage plan; only one per composition. */
  split?: (statement: Statement) => Required<Pick<VariantPlan, 'hydrate'>> & { first: Statement };
}

function once(query: string, anchor: string | RegExp, replacement: string, variant: string): string {
  const count =
    typeof anchor === 'string'
      ? query.split(anchor).length - 1
      : (query.match(new RegExp(anchor.source, anchor.flags.includes('g') ? anchor.flags : `${anchor.flags}g`)) ?? [])
          .length;
  if (count !== 1) throw new RewriteError(`Variant ${variant}: expected 1 match for ${String(anchor)}, found ${count}`);
  return query.replace(anchor, () => replacement);
}

function match(query: string, pattern: RegExp, variant: string, what: string): RegExpExecArray {
  const m = pattern.exec(query);
  if (!m) throw new RewriteError(`Variant ${variant}: ${what} not found`);
  return m;
}

/** Tenant + window parameters of a project-scoped trace query. */
export function traceScopeParams(query: string, variant: string) {
  const org = match(
    query,
    /AND organizationId = (\{trace_query_\d+:String\}) AND projectId = \{bench_project_id:String\}/,
    variant,
    'project scope',
  )[1]!;
  const from = match(query, /WHERE startedAt >= (\{trace_query_\d+:DateTime64\(3, 'UTC'\)\})/, variant, 'from')[1]!;
  const to = match(query, /AND startedAt < (\{trace_query_\d+:DateTime64\(3, 'UTC'\)\})/, variant, 'to')[1]!;
  return { org, from, to };
}

const STATUS_LINE = "  if(isNotNull(r.error), 'error', 'success') AS status\n    FROM root_scope r";
const KEYSET_TAIL =
  /\n {2}\)\nSELECT \*\nFROM candidates\n([^\n]*)\nORDER BY ([^\n]+)\nLIMIT (\{trace_query_\d+:UInt64\})\s*$/;
const DELTA_TAIL =
  /\nSELECT c\.\*, toString\(d\.latestCursorId\) AS __delta_cursor\nFROM candidates c\nINNER JOIN delta_candidates d ON c\.traceId = d\.traceId\nORDER BY d\.latestCursorId ASC, c\.traceId ASC\nLIMIT (\{trace_query_\d+:UInt64\})\s*$/;

const NARROW_OR_KEYSET_TAIL =
  /\n {2}\)\nSELECT \*( EXCEPT \(metadata, input\))?\nFROM candidates\n([^\n]*)\nORDER BY ([^\n]+)\nLIMIT (\{trace_query_\d+:UInt64\})\s*$/;

/** Adds the root's `dedupeKey` to `candidates`, so a narrow winner can be joined back to the exact root row. */
function withDedupeKey(query: string, variant: string): string {
  return once(
    query,
    STATUS_LINE,
    `  r.dedupeKey AS __dedupeKey,\n  if(isNotNull(r.error), 'error', 'success') AS status\n    FROM root_scope r`,
    variant,
  );
}

function payloadLookup(org: string, keys: string): string {
  return `SELECT traceId AS __t, dedupeKey AS __d, metadataRaw AS __m, input AS __i
  FROM mastra_trace_roots
  WHERE organizationId = ${org} AND projectId = ${PROJECT}
    AND (startedAt, traceId, dedupeKey) IN ${keys.startsWith('{') ? keys : `(${keys})`}
  LIMIT 1 BY __t, __d`;
}

/** QX03a: sort/limit on narrow columns, then join `metadata`/`input` for the winners only, in one statement. */
function narrowHydrate(statement: Statement): Statement {
  const v = 'nh';
  const { org } = traceScopeParams(statement.query, v);
  let query = withDedupeKey(statement.query, v);
  const keyset = KEYSET_TAIL.exec(query);
  const delta = keyset ? null : DELTA_TAIL.exec(query);
  if (keyset) {
    const [, where, order, limit] = keyset;
    query = query.replace(
      KEYSET_TAIL,
      () => `
  ),
__winners AS (
  SELECT * EXCEPT (metadata, input)
  FROM candidates
  ${where}
  ORDER BY ${order}
  LIMIT ${limit}
),
__payload AS (
  ${payloadLookup(org, 'SELECT startedAt, traceId, __dedupeKey FROM __winners')}
)
SELECT w.* EXCEPT (__dedupeKey), p.__m AS metadata, p.__i AS input
FROM __winners w
LEFT JOIN __payload p ON w.traceId = p.__t AND w.__dedupeKey = p.__d
ORDER BY ${order}`,
    );
  } else if (delta) {
    const [, limit] = delta;
    query = query.replace(
      DELTA_TAIL,
      () => `,
__winners AS (
  SELECT c.* EXCEPT (metadata, input), d.latestCursorId AS __lc
  FROM candidates c
  INNER JOIN delta_candidates d ON c.traceId = d.traceId
  ORDER BY d.latestCursorId ASC, c.traceId ASC
  LIMIT ${limit}
),
__payload AS (
  ${payloadLookup(org, 'SELECT startedAt, traceId, __dedupeKey FROM __winners')}
)
SELECT w.* EXCEPT (__dedupeKey, __lc), p.__m AS metadata, p.__i AS input, toString(w.__lc) AS __delta_cursor
FROM __winners w
LEFT JOIN __payload p ON w.traceId = p.__t AND w.__dedupeKey = p.__d
ORDER BY w.__lc ASC, w.traceId ASC`,
    );
  } else {
    throw new RewriteError(`Variant ${v}: not a keyset or delta query`);
  }
  return { ...statement, query };
}

/** QX03b: stage 1 is the narrow list (plus `__dedupeKey`), stage 2 looks up blobs for its keys. */
function narrowSplit(statement: Statement) {
  const v = 'nh2';
  const { org } = traceScopeParams(statement.query, v);
  const query = withDedupeKey(statement.query, v);
  const keyset = KEYSET_TAIL.exec(query);
  if (!keyset) throw new RewriteError(`Variant ${v}: not a keyset query`);
  const [, where, order, limit] = keyset;
  const first: Statement = {
    ...statement,
    query: query.replace(
      KEYSET_TAIL,
      () => `
  )
SELECT * EXCEPT (metadata, input)
FROM candidates
${where}
ORDER BY ${order}
LIMIT ${limit}`,
    ),
  };
  const hydrate = (keys: Array<[string, string, string]>): Statement => ({
    query: payloadLookup(org, `{${KEYS_PARAM}:Array(Tuple(DateTime64(3, 'UTC'), String, String))}`),
    query_params: {
      [org.slice(1, org.indexOf(':'))]: statement.query_params[org.slice(1, org.indexOf(':'))],
      [PROJECT_PARAM]: statement.query_params[PROJECT_PARAM],
      [KEYS_PARAM]: keys.map(([s, t, d]) => new TupleParam([s.replace('T', ' ').replace(/Z$/, ''), t, d])),
    },
  });
  return { first, hydrate };
}

/** QX02 diagnostic: the list without `metadata`/`input` at all. Not shippable. */
function noBlob(statement: Statement): Statement {
  let query = once(
    statement.query,
    '  r.metadataRaw AS metadata,\n',
    "  CAST(NULL, 'Nullable(String)') AS metadata,\n",
    'noblob',
  );
  query = once(query, '  r.input AS input,\n', "  CAST(NULL, 'Nullable(String)') AS input,\n", 'noblob');
  return { ...statement, query };
}

/**
 * QX04 (aggregate `rs`): tenant- and window-scope the outer `current_roots` re-read and bound both root scans by
 * `endedAt >= from` (the table is partitioned by `toDate(endedAt)`; a root that starts in the window ends after it).
 */
function scopedReread(statement: Statement): Statement {
  const v = 'rs';
  const { org, from, to } = traceScopeParams(statement.query, v);
  let query = once(
    statement.query,
    /(SELECT \*\s+FROM mastra_trace_roots\s+WHERE )(traceId IN \()/,
    `SELECT *\n      FROM mastra_trace_roots\n      WHERE organizationId = ${org} AND projectId = ${PROJECT}\n        AND startedAt >= ${from} AND startedAt < ${to} AND endedAt >= ${from}\n        AND traceId IN (`,
    v,
  );
  query = once(
    query,
    /FROM mastra_trace_roots r\n(\s+)WHERE startedAt >= /,
    `FROM mastra_trace_roots r\n        WHERE endedAt >= ${from}\n          AND startedAt >= `,
    v,
  );
  return { ...statement, query };
}

/**
 * QX05: default-order keyset as a streaming top-N over the root table in sort-key order. Dedupe happens in the same
 * order (`LIMIT 1 BY traceId` after `startedAt, traceId, dedupeKey`), so the first `limit` traces end the read.
 * Equivalent only when a trace's root copies share `startedAt` and content (duplicate census).
 */
function topN(statement: Statement): Statement {
  const v = 'topn';
  const { org, from, to } = traceScopeParams(statement.query, v);
  const keyset = match(statement.query, KEYSET_TAIL, v, 'keyset tail');
  const [, where, order, limit] = keyset;
  const dir = /^startedAt (ASC|DESC), traceId ASC$/.exec(order!)?.[1];
  if (!dir) throw new RewriteError(`Variant ${v}: order ${order} is not startedAt-first`);
  const candidates = match(
    statement.query,
    /candidates AS \(\n\s+SELECT ([\s\S]*?)\n\s+FROM root_scope r\n\s+WHERE ([\s\S]*?)\n {2}\)\nSELECT \*/,
    v,
    'candidates',
  );
  const [, columns, predicate] = candidates;
  const cursor = where!.trim() ? `\n  AND (${where!.trim().replace(/^WHERE /, '')})` : '';
  const head = statement.query.slice(0, keyset.index);
  const query = `${head}
  )
SELECT ${columns}
FROM mastra_trace_roots r
WHERE r.organizationId = ${org} AND r.projectId = ${PROJECT}
  AND r.startedAt >= ${from} AND r.startedAt < ${to}
  AND (${predicate})${cursor}
ORDER BY r.startedAt ${dir}, r.traceId ASC, r.dedupeKey ASC
LIMIT 1 BY r.traceId
LIMIT ${limit}`;
  return { ...statement, query };
}

/**
 * QX05b: like `topn`, but exact for every `startedAt`-first order. A first pass reads the sort key only (in order,
 * stopping after `limit` distinct traces) to find the boundary `startedAt`; the second pass reads just the roots at
 * or inside that boundary, so mixed sort directions (`startedAt DESC, traceId ASC`) no longer need read-in-order.
 * Equivalent only when a trace's root copies share `startedAt` and content (duplicate census).
 */
function topNThreshold(statement: Statement): Statement {
  const v = 'topn2';
  const { org, from, to } = traceScopeParams(statement.query, v);
  // Also accepts nh2's narrow tail (`nh2+topn2`): then the blobs stay out of the list and come from the lookup.
  const keyset = match(statement.query, NARROW_OR_KEYSET_TAIL, v, 'keyset tail');
  const [, narrow, where, order, limit] = keyset;
  const dir = /^startedAt (ASC|DESC), traceId ASC$/.exec(order!)?.[1];
  if (!dir) throw new RewriteError(`Variant ${v}: order ${order} is not startedAt-first`);
  const candidates = match(
    statement.query,
    /candidates AS \(\n\s+SELECT ([\s\S]*?)\n\s+FROM root_scope r\n\s+WHERE ([\s\S]*?)\n {2}\)\nSELECT \*/,
    v,
    'candidates',
  );
  const [, all, predicate] = candidates;
  const columns = narrow
    ? all!.replace('  r.metadataRaw AS metadata,\n', '').replace('  r.input AS input,\n', '')
    : all;
  if (narrow && /AS (metadata|input),/.test(columns!)) throw new RewriteError(`Variant ${v}: blob columns not found`);
  const cursor = where!.trim() ? `\n  AND (${where!.trim().replace(/^WHERE /, '')})` : '';
  const filter = `r.organizationId = ${org} AND r.projectId = ${PROJECT}
  AND r.startedAt >= ${from} AND r.startedAt < ${to}
  AND (${predicate})${cursor}`;
  const head = statement.query.slice(0, keyset.index);
  const query = `${head}
  )
SELECT ${columns}
FROM mastra_trace_roots r
WHERE ${filter}
  AND r.startedAt ${dir === 'DESC' ? '>=' : '<='} (
    SELECT ${dir === 'DESC' ? 'min' : 'max'}(__s) FROM (
      SELECT DISTINCT r.startedAt AS __s, r.traceId AS __t
      FROM mastra_trace_roots r
      WHERE ${filter}
      ORDER BY __s ${dir}
      LIMIT ${limit}
    )
  )
ORDER BY r.startedAt ${dir}, r.traceId ASC, r.dedupeKey ASC
LIMIT 1 BY r.traceId
LIMIT ${limit}`;
  return { ...statement, query };
}

const CANDIDATES = /candidates AS \(\n\s+SELECT ([\s\S]*?)\n\s+FROM root_scope r\n\s+WHERE ([\s\S]*?)\n {2}\)/;

/** Scope + window + the case's own predicate, against the raw root table aliased `r`. */
function rootFilter(query: string, variant: string) {
  const { org, from, to } = traceScopeParams(query, variant);
  const [, columns, predicate] = match(query, CANDIDATES, variant, 'candidates');
  const filter = `r.organizationId = ${org} AND r.projectId = ${PROJECT}
  AND r.startedAt >= ${from} AND r.startedAt < ${to}
  AND (${predicate})`;
  return { columns: columns!, filter };
}

function withoutBlobs(columns: string, variant: string): string {
  const narrow = columns.replace('  r.metadataRaw AS metadata,\n', '').replace('  r.input AS input,\n', '');
  if (/AS (metadata|input),/.test(narrow) || narrow === columns) {
    throw new RewriteError(`Variant ${variant}: blob columns not found`);
  }
  return narrow;
}

const PAGE_TAIL =
  /,\npage_rows AS \(\n {2}SELECT\n([\s\S]*?),\n {4}row_number\(\) OVER \(ORDER BY ([^)]+)\) AS __row_position,\n {4}count\(\) OVER \(\) AS total\n {2}FROM candidates\n\)\n(SELECT \*, if\(__row_position > \{trace_query_\d+:UInt64\} AND __row_position <= (\{trace_query_\d+:UInt64\}), 0, 1\) AS __metadata[\s\S]*)$/;

/**
 * QX06: page mode without a window function over the whole window. The total is `uniqExact(traceId)` over the
 * window's roots; the page is `topn2` with the boundary at `offset + perPage` distinct traces, numbered in the
 * same order. Equivalent only when a trace's root copies share `startedAt` and content (duplicate census).
 */
function pageTopN(statement: Statement): Statement {
  const v = 'pg';
  const { columns, filter } = rootFilter(statement.query, v);
  const page = match(statement.query, PAGE_TAIL, v, 'page tail');
  const [, pageColumns, order, tail, upper] = page;
  const dir = /^startedAt (ASC|DESC), traceId ASC$/.exec(order!)?.[1];
  if (!dir) throw new RewriteError(`Variant ${v}: order ${order} is not startedAt-first`);
  const head = statement.query.slice(0, page.index);
  const query = `${head},
__total AS (
  SELECT uniqExact(r.traceId) AS total
  FROM mastra_trace_roots r
  WHERE ${filter}
),
page_rows AS (
  SELECT
${pageColumns},
    row_number() OVER (ORDER BY ${order}) AS __row_position,
    (SELECT total FROM __total) AS total
  FROM (
    SELECT ${withoutBlobs(columns, v)}
    FROM mastra_trace_roots r
    WHERE ${filter}
      AND r.startedAt ${dir === 'DESC' ? '>=' : '<='} (
        SELECT ${dir === 'DESC' ? 'min' : 'max'}(__s) FROM (
          SELECT DISTINCT r.startedAt AS __s, r.traceId AS __t
          FROM mastra_trace_roots r
          WHERE ${filter}
          ORDER BY __s ${dir}
          LIMIT ${upper}
        )
      )
    ORDER BY r.startedAt ${dir}, r.traceId ASC, r.dedupeKey ASC
    LIMIT 1 BY r.traceId
  )
)
${tail}`;
  return { ...statement, query };
}

const DELTA_CANDIDATES =
  /delta_candidates AS \(\n {2}SELECT traceId, max\(cursorId\) AS latestCursorId\n {2}FROM mastra_trace_roots_delta\n {2}WHERE ([^\n]*)\n {2}GROUP BY traceId\n\)/;
const ROOT_SEED_END =
  '      AND organizationId = {trace_query_3:String} AND projectId = {bench_project_id:String}\n      )\n      ORDER BY dedupeKey';

/**
 * QX07: delta mode picks its page from the delta table first (scoped to the project's matching roots, ordered by
 * cursor, limited), then dedupes only those traces' roots. Today it dedupes the whole window and joins every delta
 * row since the cursor, across tenants. Equivalent only when root copies share `startedAt` and content.
 */
function deltaTopN(statement: Statement): Statement {
  const v = 'dtop';
  const { filter } = rootFilter(statement.query, v);
  const [, limit] = match(statement.query, DELTA_TAIL, v, 'delta tail');
  const [, cursor] = match(statement.query, DELTA_CANDIDATES, v, 'delta candidates');
  const page = `SELECT traceId, max(cursorId) AS latestCursorId
  FROM mastra_trace_roots_delta
  WHERE ${cursor!.trim()}
    AND traceId IN (SELECT r.traceId FROM mastra_trace_roots r WHERE ${filter})
  GROUP BY traceId
  ORDER BY latestCursorId ASC, traceId ASC
  LIMIT ${limit}`;
  let query = once(statement.query, DELTA_CANDIDATES, `delta_candidates AS (\n  ${page}\n)`, v);
  query = once(
    query,
    ROOT_SEED_END,
    ROOT_SEED_END.replace('\n      )\n', `\n        AND traceId IN (SELECT traceId FROM (${page}))\n      )\n`),
    v,
  );
  return { ...statement, query };
}

const SPAN_DEDUPE = /\n {4}ORDER BY dedupeKey\n {4}LIMIT 1 BY dedupeKey\n {2}\),\ncandidates AS/;

/**
 * QX08 (aggregate X17 `sp`): span relations here are existence checks (`traceId IN (… FROM current_spans s …)`),
 * which copies of a span can't change, so skip the span dedupe; seed spans from the project's window roots (no
 * root dedupe) and bound them by `endedAt >= from` (a span ends after its trace starts).
 */
function spanExistence(statement: Statement): Statement {
  const v = 'sp';
  const { org, from, to } = traceScopeParams(statement.query, v);
  const uses = statement.query.match(/current_spans/g)?.length ?? 0;
  const existence = statement.query.match(/\(\n\s+SELECT s\.traceId FROM current_spans s\n/g)?.length ?? 0;
  if (!existence || uses !== existence + 1) throw new RewriteError(`Variant ${v}: spans not used for existence only`);
  let query = once(statement.query, SPAN_DEDUPE, '\n  ),\ncandidates AS', v);
  query = once(
    query,
    '      AND traceId IN (SELECT traceId FROM root_scope)\n',
    `      AND traceId IN (
        SELECT r.traceId FROM mastra_trace_roots r
        WHERE r.organizationId = ${org} AND r.projectId = ${PROJECT}
          AND r.startedAt >= ${from} AND r.startedAt < ${to}
      )
      AND endedAt >= ${from}\n`,
    v,
  );
  return { ...statement, query };
}

const GROUP_TAIL =
  /\nSELECT threadId\nFROM candidates\nWHERE isNotNull\(threadId\) *\nGROUP BY threadId\nORDER BY threadId ASC\nLIMIT (\{trace_query_\d+:UInt64\})\s*$/;

/** QX07 (groups): distinct thread ids straight from the window's matching roots, without the root dedupe. */
function groupsDirect(statement: Statement): Statement {
  const v = 'g2';
  const { filter } = rootFilter(statement.query, v);
  const [, limit] = match(statement.query, GROUP_TAIL, v, 'groups tail');
  const query = statement.query.replace(
    GROUP_TAIL,
    () => `
SELECT r.threadId AS threadId
FROM mastra_trace_roots r
WHERE ${filter}
  AND isNotNull(r.threadId)
GROUP BY threadId
ORDER BY threadId ASC
LIMIT ${limit}`,
  );
  return { ...statement, query };
}

const PREFETCH_OFF: ClickHouseSettings = {
  allow_prefetched_read_pool_for_remote_filesystem: 0,
  remote_filesystem_read_prefetch: 0,
};

export const VARIANTS: Record<string, VariantDef> = {
  base: { id: 'base', note: 'as compiled' },
  nopf: { id: 'nopf', note: 'remote prefetch and prefetched read pool off', settings: PREFETCH_OFF },
  pf8: { id: 'pf8', note: 'filesystem_prefetches_limit = 8', settings: { filesystem_prefetches_limit: '8' } },
  pf16: { id: 'pf16', note: 'filesystem_prefetches_limit = 16', settings: { filesystem_prefetches_limit: '16' } },
  pg: { id: 'pg', note: 'page: uniqExact total + topn2 page, no window function', rewrite: pageTopN },
  dtop: { id: 'dtop', note: 'delta: scoped, limited delta page first, then its roots', rewrite: deltaTopN },
  sp: { id: 'sp', note: 'span existence: no span dedupe, window-seeded, endedAt-bounded', rewrite: spanExistence },
  g2: { id: 'g2', note: 'groups: distinct threads from raw window roots', rewrite: groupsDirect },
  t1: { id: 't1', note: 'max_threads = 1', settings: { max_threads: 1 } },
  t2: { id: 't2', note: 'max_threads = 2', settings: { max_threads: 2 } },
  t3: { id: 't3', note: 'max_threads = 3', settings: { max_threads: 3 } },
  t4: { id: 't4', note: 'max_threads = 4', settings: { max_threads: 4 } },
  bs: {
    id: 'bs',
    note: 'max_block_size = 1024, preferred_block_size_bytes = 1 MiB',
    settings: { max_block_size: '1024', preferred_block_size_bytes: '1048576' },
  },
  rb: {
    id: 'rb',
    note: 'read buffers 128 KiB (max_read_buffer_size, max_read_buffer_size_remote_fs)',
    settings: { max_read_buffer_size: '131072', max_read_buffer_size_remote_fs: '131072' },
  },
  noblob: { id: 'noblob', note: 'diagnostic: metadata/input replaced by NULL', rewrite: noBlob },
  nh: { id: 'nh', note: 'narrow sort/limit, then join blobs for the winners (one statement)', rewrite: narrowHydrate },
  nh2: { id: 'nh2', note: 'narrow list, then a second query for the winners’ blobs', split: narrowSplit },
  rs: { id: 'rs', note: 'scope + window + endedAt bound on the current_roots re-read', rewrite: scopedReread },
  topn: { id: 'topn', note: 'streaming top-N over the root table in sort-key order', rewrite: topN },
  topn2: {
    id: 'topn2',
    note: 'sort-key-only pass finds the page boundary, then reads only those roots',
    rewrite: topNThreshold,
  },
};

/** `<id>@2` applies a settings overlay to stage 2 (the lookup) only. */
const STAGE2 = '@2';

export function variantIds(spec: string): string[] {
  const ids = spec.split('+');
  for (const id of ids) {
    const def = VARIANTS[id.endsWith(STAGE2) ? id.slice(0, -STAGE2.length) : id];
    if (!def) throw new Error(`Unknown variant ${id}`);
    if (id.endsWith(STAGE2) && (def.rewrite || def.split || !def.settings)) {
      throw new Error(`Variant ${id}: only settings overlays can target stage 2`);
    }
  }
  return ids;
}

/** Applies a (possibly composed) variant to the project-scoped base statement. Throws `RewriteError` if N/A. */
export function planVariant(spec: string, base: Statement): VariantPlan {
  let statement = base;
  let settings: ClickHouseSettings = {};
  let stage2: ClickHouseSettings = {};
  let hydrate: VariantPlan['hydrate'];
  for (const id of variantIds(spec)) {
    if (id.endsWith(STAGE2)) {
      stage2 = { ...stage2, ...VARIANTS[id.slice(0, -STAGE2.length)]!.settings };
      continue;
    }
    const def = VARIANTS[id]!;
    if (def.rewrite) statement = def.rewrite(statement);
    if (def.split) {
      if (hydrate) throw new RewriteError(`Variant ${spec}: more than one split`);
      const split = def.split(statement);
      statement = split.first;
      hydrate = split.hydrate;
    }
    settings = { ...settings, ...def.settings };
  }
  if (Object.keys(stage2).length && !hydrate) throw new RewriteError(`Variant ${spec}: @2 overlay without a stage 2`);
  return { statements: [statement], settings, hydrateSettings: { ...settings, ...stage2 }, hydrate };
}

/** Columns the API returns for a trace-list query, read from its `candidates` block (for equivalence hashes). */
export function resultColumns(query: string): string[] {
  if (GROUP_TAIL.test(query)) return ['threadId'];
  const page = PAGE_TAIL.exec(query)?.[1];
  if (page) return [...page.split(',').map(c => c.trim()), '__row_position', 'total', '__metadata'];
  const block = /candidates AS \(\n\s+SELECT ([\s\S]*?)\n\s+FROM root_scope r/.exec(query)?.[1];
  if (!block) throw new RewriteError('No candidates block');
  const columns = [...block.matchAll(/ AS (\w+)(?:,|$)/gm)].map(m => m[1]!).filter(c => !c.startsWith('__'));
  if (/__delta_cursor/.test(query)) columns.push('__delta_cursor');
  return columns;
}
