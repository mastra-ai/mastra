import type { MetricsCollector, MetricsLogger } from '../metrics.js';
import { createProbe, errorText } from './probe.js';

/** The subset of `pg.Pool` the collectors read. */
export interface PoolLike {
  totalCount: number;
  idleCount: number;
  waitingCount: number;
  query(sql: string): Promise<{ rows: Array<Record<string, unknown>> }>;
}

/** `value` when it looks like a `pg.Pool` (e.g. `PostgresStore.pool`, `PgVector.pool`). */
export function asPool(value: unknown): PoolLike | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const pool = value as Partial<PoolLike>;
  return typeof pool.totalCount === 'number' &&
    typeof pool.idleCount === 'number' &&
    typeof pool.waitingCount === 'number' &&
    typeof pool.query === 'function'
    ? (pool as PoolLike)
    : undefined;
}

/**
 * Pool usage plus a `SELECT 1` round trip for each Postgres pool. `waiting` above 0 means queries
 * are queued for a connection: the pool is too small or queries hold connections too long.
 * The gauges are read after the probe, so a pool that had closed its idle connections shows the
 * connection the probe just opened; the probe's duration then includes connecting.
 */
export function postgresPoolCollector(pools: Record<string, PoolLike>, timeoutMs: number): MetricsCollector {
  const probe = createProbe();
  return {
    async collect(sink) {
      await Promise.all(
        Object.entries(pools).map(async ([name, pool]) => {
          await probe(sink, `db_${name}`, timeoutMs, () => pool.query('SELECT 1'));
          sink.emit('mastra_factory_db_pool', pool.totalCount, { pool: name, state: 'total' });
          sink.emit('mastra_factory_db_pool', pool.idleCount, { pool: name, state: 'idle' });
          sink.emit('mastra_factory_db_pool', pool.waitingCount, { pool: name, state: 'waiting' });
        }),
      );
    },
  };
}

// Sessions of this database, from the server's point of view. Locks and long-open transactions
// slow every query, and the pool stats can't see them.
const ACTIVITY_SQL = `
SELECT
  count(*) FILTER (WHERE state = 'active') AS active,
  count(*) FILTER (WHERE state = 'idle in transaction') AS idle_in_transaction,
  count(*) FILTER (WHERE wait_event_type = 'Lock') AS waiting_on_lock,
  coalesce(max(extract(epoch FROM now() - query_start)) FILTER (WHERE state = 'active'), 0) AS longest_query_s,
  coalesce(max(extract(epoch FROM now() - xact_start)) FILTER (WHERE state = 'idle in transaction'), 0) AS longest_idle_transaction_s
FROM pg_stat_activity
WHERE datname = current_database() AND backend_type = 'client backend' AND pid <> pg_backend_pid()`;

// Lifetime totals of every statement of this database, one row per query ID. pg_stat_statements
// keeps a row per user (and top-level flag) for the same query ID, so they are summed. Without
// `pg_read_all_stats`, other users' query IDs read as null; those rows are skipped rather than lumped together. No limit:
// the slowest are picked from the change since the previous sample, which a statement with a small
// lifetime total can still lead. The extension caps its rows (`pg_stat_statements.max`, 5000 by default).
const STATEMENTS_SQL = `
SELECT queryid::text AS id, sum(calls) AS calls, sum(total_exec_time) AS total_exec_time
FROM pg_stat_statements
WHERE dbid = (SELECT oid FROM pg_database WHERE datname = current_database()) AND queryid IS NOT NULL
GROUP BY queryid`;

const SLOW_STATEMENTS_LOGGED = 5;

/**
 * Server-wide Postgres stats, collected by one process per deployment. Every tick:
 * `pg_stat_activity` session counts and the age of the longest running query and longest idle
 * transaction. Every `statementsEveryTicks` ticks: the statements that used the most time since the
 * previous sample, from `pg_stat_statements`, written as one log line with their query IDs and
 * timings. Statement text is left out: pg_stat_statements can keep literal values in it, which
 * mustn't reach application logs. Skipped when the extension isn't installed.
 */
export function postgresStatsCollector(
  pool: PoolLike,
  timeoutMs: number,
  statementsEveryTicks: number,
  getLogger: () => MetricsLogger | undefined,
): MetricsCollector {
  const probe = createProbe();
  let tick = 0;
  let previous: Map<string, { calls: number; time: number }> | undefined;
  let failing = false;
  const number = (value: unknown) => Number(value ?? 0);

  async function logSlowStatements(): Promise<void> {
    const { rows: installed } = await pool.query(`SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`);
    if (installed.length === 0) return;
    const { rows } = await pool.query(STATEMENTS_SQL);
    const current = new Map(
      rows.map(row => [String(row.id), { calls: number(row.calls), time: number(row.total_exec_time) }]),
    );
    if (previous) {
      const before = previous;
      const slowest = [...current]
        .map(([id, now]) => {
          const then = before.get(id);
          // Not in the previous sample: no baseline yet (the totals are lifetime), so skip it.
          if (!then) return { id, calls: 0, time: 0 };
          // Fewer calls than before means the stats were reset: everything counted is new.
          const reset = then.calls > now.calls;
          return {
            id,
            calls: reset ? now.calls : now.calls - then.calls,
            time: reset ? now.time : now.time - then.time,
          };
        })
        .filter(statement => statement.calls > 0)
        .sort((a, b) => b.time - a.time)
        .slice(0, SLOW_STATEMENTS_LOGGED)
        .map(statement => ({
          queryId: statement.id,
          calls: statement.calls,
          totalMs: Math.round(statement.time),
          meanMs: Math.round((statement.time / statement.calls) * 10) / 10,
        }));
      if (slowest.length > 0) {
        getLogger()?.info('[factory:metrics] Slowest Postgres statements since last sample.', { statements: slowest });
      }
    }
    previous = current;
  }

  return {
    async collect(sink) {
      const sampleStatements = tick % statementsEveryTicks === 0;
      tick++;
      let row: Record<string, unknown> | undefined;
      const result = await probe(sink, 'db_stats', timeoutMs, async () => {
        row = (await pool.query(ACTIVITY_SQL)).rows[0] ?? {};
      });
      if (result.ok && row) {
        sink.emit('mastra_factory_db_sessions', number(row.active), { state: 'active' });
        sink.emit('mastra_factory_db_sessions', number(row.idle_in_transaction), { state: 'idle_in_transaction' });
        sink.emit('mastra_factory_db_sessions', number(row.waiting_on_lock), { state: 'waiting_on_lock' });
        sink.emit('mastra_factory_db_longest_ms', number(row.longest_query_s) * 1000, { kind: 'query' });
        sink.emit('mastra_factory_db_longest_ms', number(row.longest_idle_transaction_s) * 1000, {
          kind: 'idle_transaction',
        });
        if (failing) getLogger()?.info('[factory:metrics] Postgres stats sampling recovered.');
        failing = false;
      } else if (!result.ok) {
        // Log on the transition only; the probe failure counter counts each failure.
        if (!failing)
          getLogger()?.warn('[factory:metrics] Postgres stats sampling failed.', { error: errorText(result.error) });
        failing = true;
      }
      // Its own probe, so a slow pg_stat_statements read never costs the activity sample.
      if (sampleStatements) await probe(sink, 'db_statements', timeoutMs, logSlowStatements);
    },
  };
}
