/**
 * X51: the project Metrics page as OBS-698 ships it (mastra#27908–#27910), against the read-only replica.
 *
 * Fires every request of one page load the way the browser does: today's `metrics` requests that stay
 * (the tokens KPI pair moves off them) at once, plus the 9 `aggregateTraces()` requests through the
 * page's limiter (at most 3 in flight, first come first served, in render order). Each request goes
 * through mobs-query's own service functions with its pool of 10 sockets and its read limits
 * (1 GiB / 9 s per statement). Same guarded client, `max_threads=16` and project picks as X48.
 *
 *   dry    plan and compile every aggregate request offline.
 *   page   cold ×1 then warm ×reps per role, window and variant.
 *          variants: obs698 (the new page), today (main's page, baseline), exec (the breakdown card's
 *          "Execution source" tab, which fires only when opened).
 *   report tables from results/mobs-obs698-page.jsonl.
 *
 *   npx tsx mobs-obs698-page.ts dry --platform /tmp/platform-obs698/servers/mobs-query
 *   npx tsx mobs-obs698-page.ts page --platform ... --label x50 --windows 24h,7d,30d --variants obs698,today,exec
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import type { ClickHouseClient } from '@clickhouse/client';

import { installOutputRedaction } from './env';
import {
  connect,
  fetchStats,
  measured,
  metricsCards,
  pageInterval,
  pickProjects,
  PROD,
  rangeOf,
  scopeOf,
  sleep,
  summarizePage,
  timeRange,
} from './mobs-metrics-page';
import type { Card, Mods, PageRecord, Range, Scope } from './mobs-metrics-page';
import { loadSelection } from './profile';
import { RESULTS_DIR } from './run';

const OUT = join(RESULTS_DIR, 'mobs-obs698-page.jsonl');

/** `MAX_TRACE_AGGREGATES_IN_FLIGHT` in playground-ui's request limiter. */
const IN_FLIGHT = 3;
/** `TRACE_AGGREGATE_SERIES_LIMIT`, `TOP_ENTITIES_REQUEST_LIMIT`, `TRACE_BREAKDOWN_LIMIT`. */
const SERIES_LIMIT = 10;
const TOP_LIMIT = 500;
const BREAKDOWN_LIMIT = 50;

/** The aggregate requests one load of the new page sends, in render order, with no page filter. */
export function obs698Bodies(to: Date, window: string, breakdown: 'environment' | 'executionSource' = 'environment') {
  const r = rangeOf(to, window);
  const tr = { timeRange: timeRange(r) };
  const interval = pageInterval(window);
  const prev: Range = rangeOf(to, window, 1);
  const tokens = ['tokens.input.sum', 'tokens.output.sum'];
  const distinct = ['countDistinct.userId', 'countDistinct.sessionId'];
  return [
    ['a:kpi-tokens', { ...tr, measures: tokens }],
    ['a:kpi-tokens-prev', { timeRange: timeRange(prev), measures: tokens }],
    [
      'a:latency',
      {
        ...tr,
        interval,
        groupBy: ['spanType'],
        measures: ['duration.p50', 'duration.p90', 'duration.p99'],
        limit: SERIES_LIMIT,
      },
    ],
    [
      'a:top-entities',
      {
        ...tr,
        groupBy: ['entityType', 'entityName'],
        measures: ['count', 'errorRate', 'errorCount', 'duration.p95', 'cost.sum'],
        orderBy: { field: 'count', direction: 'desc' },
        limit: TOP_LIMIT,
      },
    ],
    [
      `a:breakdown-${breakdown}`,
      {
        ...tr,
        groupBy: [breakdown],
        measures: ['count', 'errorRate', 'cost.sum'],
        orderBy: { field: 'count', direction: 'desc' },
        limit: BREAKDOWN_LIMIT,
      },
    ],
    ['a:distinct-series', { ...tr, interval, measures: distinct, limit: SERIES_LIMIT }],
    ['a:distinct-totals', { ...tr, measures: distinct }],
    ['a:cost-total', { ...tr, measures: ['cost.sum'] }],
    ['a:cost-series', { ...tr, interval, measures: ['cost.sum'], limit: SERIES_LIMIT }],
  ] as Array<[string, Record<string, unknown>]>;
}

function limiter(max: number) {
  let active = 0;
  const queue: Array<() => void> = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= max) await new Promise<void>(resolve => queue.push(resolve));
    active++;
    try {
      return await task();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

function aggCardsFor(
  mods: Mods,
  client: ClickHouseClient,
  scope: Scope,
  bodies: Array<[string, Record<string, unknown>]>,
) {
  const run = limiter(IN_FLIGHT);
  return bodies.map(([card, body]): Card => {
    const plan = mods.plan.planPlatformTraceAggregate(body, scope, []);
    return { card, source: 'agg', fn: () => run(() => mods.run.aggregateTraces(client, plan)) };
  });
}

function dry(mods: Mods) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  let n = 0;
  for (const [role, project] of pickProjects(selection.projects)) {
    const scope = scopeOf(project, 'project');
    for (const window of ['24h', '7d', '30d']) {
      const bodies = [
        ...obs698Bodies(new Date(), window),
        ...obs698Bodies(new Date(), window, 'executionSource').filter(([card]) => card.startsWith('a:breakdown')),
      ];
      for (const [, body] of bodies) {
        const plan = mods.plan.planPlatformTraceAggregate(body, scope, []);
        mods.sql.compileClickHouseTraceAggregate(plan, mods.sql.traceAggregateUsageOptions());
        n++;
      }
      console.log(`dry ${role}/${project.hash} ${window}: ok`);
    }
  }
  console.log(`dry: ${n} plans compiled`);
}

async function page(options: {
  platform: string;
  label: string;
  roles: Set<string>;
  windows: string[];
  variants: string[];
  reps: number;
}) {
  const selection = loadSelection();
  if (!selection) throw new Error('No project selection; run the profile phase first');
  const { raw, client, mods } = await connect(options.platform, 10);
  const runId = randomUUID().slice(0, 8);
  try {
    for (const [role, project] of pickProjects(selection.projects)) {
      if (!options.roles.has(role)) continue;
      const scope = scopeOf(project, 'project');
      for (const window of options.windows) {
        for (const variant of options.variants) {
          for (const phase of ['cold', 'warm'] as const) {
            for (let rep = phase === 'cold' ? 0 : 1; rep <= (phase === 'cold' ? 0 : options.reps); rep++) {
              const to = new Date();
              const r = rangeOf(to, window);
              const today = metricsCards(mods, client, scope, r, window);
              const cards =
                variant === 'today'
                  ? today
                  : variant === 'exec'
                    ? aggCardsFor(
                        mods,
                        client,
                        scope,
                        obs698Bodies(to, window, 'executionSource').filter(([c]) => c.startsWith('a:breakdown')),
                      )
                    : [
                        ...aggCardsFor(mods, client, scope, obs698Bodies(to, window)),
                        ...today.filter(c => !c.card.startsWith('m:kpi-tokens')),
                      ];
              const started = performance.now();
              const results = await Promise.all(cards.map(c => measured(phase === 'cold', PROD, c.fn)));
              const wallMs = Math.round(performance.now() - started);
              const stats = await fetchStats(
                raw,
                results.flatMap(x => x.queryIds),
              );
              const record: PageRecord = {
                runId,
                label: options.label,
                page: 'project',
                role,
                hash: project.hash,
                window,
                variant,
                phase,
                rep,
                wallMs,
                cards: cards.map((c, i) => ({
                  card: c.card,
                  source: c.source,
                  ok: results[i]!.ok,
                  ...(results[i]!.errorCode ? { errorCode: results[i]!.errorCode } : {}),
                  wallMs: Math.round(results[i]!.wallMs),
                  queries: results[i]!.queryIds.map(id => stats.get(id)).filter(s => !!s),
                })),
              };
              appendFileSync(OUT, `${JSON.stringify(record)}\n`);
              const s = summarizePage(record);
              const aggQs = record.cards.filter(c => c.source === 'agg').flatMap(c => c.queries);
              console.log(
                `${options.label} ${role}/${project.hash} ${window} ${variant} ${phase}#${rep}: ${cards.length} requests, ${s.statements} stmts, page ${wallMs} ms, slowest ${s.slowest}, max ${s.maxPeak} MiB, slowest stmt ${Math.max(0, ...record.cards.flatMap(c => c.queries).map(q => Number(q.durationMs)))} ms, agg max ${Math.max(0, ...aggQs.map(q => Number(q.memMiB)))} MiB, concurrent ${s.concurrent} MiB, failed ${s.failed.join(',') || '-'}`,
              );
              await sleep(2000);
            }
          }
        }
      }
    }
  } finally {
    await raw.close();
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor((s.length - 1) / 2)]! : 0;
};

function report(label: string) {
  if (!existsSync(OUT)) throw new Error(`${OUT} missing`);
  const records = readFileSync(OUT, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map(l => JSON.parse(l) as PageRecord)
    .filter(r => r.label === label);
  const key = (r: PageRecord) => `${r.role}|${r.window}|${r.variant}|${r.phase}`;
  const groups = new Map<string, PageRecord[]>();
  for (const r of records) groups.set(key(r), [...(groups.get(key(r)) ?? []), r]);
  console.log(
    'role | window | variant | phase | n | page ms | slowest card ms | slowest stmt ms | max stmt MiB | concurrent MiB | read MiB | failed',
  );
  console.log('--|--|--|--|--|--|--|--|--|--|--|--');
  for (const [k, list] of groups) {
    const [role, window, variant, phase] = k.split('|');
    const stmts = (r: PageRecord) => r.cards.flatMap(c => c.queries);
    const s = list.map(summarizePage);
    // Worst over the reps for the per-statement limits; median for page and card time.
    console.log(
      [
        role,
        window,
        variant,
        phase,
        list.length,
        median(list.map(r => r.wallMs)),
        median(list.map(r => Math.max(...r.cards.map(c => c.wallMs)))),
        Math.max(...list.flatMap(r => stmts(r).map(q => Number(q.durationMs)))),
        Math.max(...s.map(x => x.maxPeak)),
        Math.max(...s.map(x => x.concurrent)),
        median(s.map(x => x.readMiB)),
        [...new Set(s.flatMap(x => x.failed))].join(',') || '-',
      ].join(' | '),
    );
  }
  console.log(
    '\nper aggregate card (worst over all reps and phases): role | window | card | warm median ms | max stmt ms | max MiB | read MiB',
  );
  const cardKey = new Map<string, Array<{ phase: string; wallMs: number; ms: number; mem: number; read: number }>>();
  for (const r of records) {
    if (r.variant === 'today') continue;
    for (const c of r.cards.filter(x => x.source === 'agg')) {
      const k = `${r.role} | ${r.window} | ${c.card}`;
      cardKey.set(k, [
        ...(cardKey.get(k) ?? []),
        {
          phase: r.phase,
          wallMs: c.wallMs,
          ms: Math.max(0, ...c.queries.map(q => Number(q.durationMs))),
          mem: Math.max(0, ...c.queries.map(q => Number(q.memMiB))),
          read: c.queries.reduce((a, q) => a + Number(q.readMiB), 0),
        },
      ]);
    }
  }
  for (const [k, list] of cardKey) {
    const warm = list.filter(x => x.phase === 'warm');
    console.log(
      `${k} | ${median(warm.map(x => x.ms))} | ${Math.max(...list.map(x => x.ms))} | ${Math.max(...list.map(x => x.mem))} | ${Math.round(Math.max(...list.map(x => x.read)))}`,
    );
  }
}

installOutputRedaction();
const { positionals, values } = parseArgs({
  allowPositionals: true,
  options: {
    platform: { type: 'string', default: '/tmp/platform-obs698/servers/mobs-query' },
    label: { type: 'string', default: 'x50' },
    roles: { type: 'string', default: 'p99,largest' },
    windows: { type: 'string', default: '24h,7d,30d' },
    variants: { type: 'string', default: 'obs698,today,exec' },
    reps: { type: 'string', default: '3' },
  },
});
switch (positionals[0]) {
  case 'dry': {
    const { raw, mods } = await connect(values.platform, 1);
    try {
      dry(mods);
    } finally {
      await raw.close();
    }
    break;
  }
  case 'page':
    await page({
      platform: values.platform,
      label: values.label,
      roles: new Set(values.roles.split(',')),
      windows: values.windows.split(','),
      variants: values.variants.split(','),
      reps: Number(values.reps),
    });
    break;
  case 'report':
    report(values.label);
    break;
  default:
    console.error('usage: mobs-obs698-page.ts dry|page|report');
    process.exit(1);
}
