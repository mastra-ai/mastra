/**
 * ClickHouse DDL for the Pulse tables. Apply each statement separately (the
 * ClickHouse HTTP interface rejects multi-statement bodies).
 *
 * Nothing derived is stored: flows, trees, durations and status are
 * reconstructed at read time. Correlation columns (trace/span/run/thread/
 * resource ids) mirror `metadata` for query speed.
 */
export const PULSE_TABLES_DDL: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS pulses (
  id             String,
  timestamp      DateTime64(3),
  seq            UInt64,
  type           Enum8('input' = 1, 'output' = 2, 'decision' = 3, 'state' = 4, 'error' = 5, 'progress' = 6, 'system' = 7),
  surface        LowCardinality(String),
  action         String,
  level          LowCardinality(String),
  text           String,
  data           String,
  attributes     String,
  metadata       String,
  trace_id       String,
  span_id        String,
  parent_span_id String,
  run_id         String,
  thread_id      String,
  resource_id    String,
  source         LowCardinality(String)
) ENGINE = MergeTree ORDER BY (trace_id, timestamp, seq)`,
  `CREATE TABLE IF NOT EXISTS relationships (
  id         String,
  timestamp  DateTime64(3),
  seq        UInt64,
  type       LowCardinality(String),
  from_kind  Enum8('pulse' = 1, 'flow' = 2, 'thread' = 3, 'model_input' = 4, 'content' = 5, 'definition' = 6, 'external' = 7),
  from_id    String,
  to_kind    Enum8('pulse' = 1, 'flow' = 2, 'thread' = 3, 'model_input' = 4, 'content' = 5, 'definition' = 6, 'external' = 7),
  to_id      String,
  from_system String DEFAULT '',
  to_system   String DEFAULT '',
  attributes String,
  metadata   String DEFAULT '{}',
  trace_id   String
) ENGINE = MergeTree ORDER BY (trace_id, timestamp, seq)`,
];

/** Apply the Pulse DDL to a database over the ClickHouse HTTP interface. */
export async function ensurePulseTables(opts: {
  url: string;
  database: string;
  username?: string;
  password?: string;
}): Promise<void> {
  const auth = `user=${encodeURIComponent(opts.username ?? 'default')}&password=${encodeURIComponent(opts.password ?? '')}`;
  const base = `${opts.url.replace(/\/$/, '')}/?${auth}`;
  const run = async (query: string) => {
    const res = await fetch(base, { method: 'POST', body: query });
    if (!res.ok) throw new Error(`pulse DDL failed (${res.status}): ${(await res.text()).slice(0, 300)}`);
  };
  await run(`CREATE DATABASE IF NOT EXISTS ${opts.database}`);
  for (const ddl of PULSE_TABLES_DDL) {
    await run(`${ddl.replace('IF NOT EXISTS ', `IF NOT EXISTS ${opts.database}.`)}`);
  }
}
