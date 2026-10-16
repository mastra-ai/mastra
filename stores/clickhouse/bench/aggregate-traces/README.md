# aggregateTraces() benchmark (OBS-539)

Benchmarks the merged ClickHouse `aggregateTraces()` compiler (and the `queryTraces()` baseline that shares its trace selection) against Platform's production observability data on a dedicated **read-only** ClickHouse Cloud replica. Results and recommendations for OBS-515 are in [FINDINGS.md](./FINDINGS.md).

This directory is not part of the package: it isn't in `tsconfig` `include`, the tsdown entry, the published `files`, or the package's vitest config. It never runs in CI.

## How it works

Each case is a public request built in [cases.ts](./cases.ts), validated and planned by the real core planner (`parseTraceAggregateRequest` + `planTraceAggregate`, or `planTraceQuery` for the baseline), and compiled by the merged compiler (`compileClickHouseTraceAggregate` / `compileClickHouseTraceQuery`). The harness then:

1. **Scopes to one project** ([scope.ts](./scope.ts)). Every compiled tenant fragment `AND organizationId = {p:String}` becomes `AND organizationId = {p:String} AND projectId = {bench_project_id:String}`. That is exactly where Platform would add `projectId` (inside `compileTenantScope`), it sits on the sort-key prefix, and it stays a bound parameter. The rewrite asserts the number of scoped scans (roots seed + root scope + one per related collection) and fails closed otherwise.
2. **Optionally applies a labelled variant**, a string rewrite of the compiled SQL that must match its pattern:
   - `w1`: also tenant- and project-scope the outer `current_roots` re-read (unscoped as compiled).
   - `uniq`: `uniqExact` → `uniq`.
   - `exact`: `quantileDeterministic(p)(durationMs, traceSeed)` → `quantileExact(p)(durationMs)`.
   - `payload-scoped` (baseline only): org/project scope on the `queryTraces()` root-payload lookup.
3. **Executes** it sequentially with explicit limits, a `log_comment` of `aqa-bench:<run>:<case>:<window>:<bucket>:<hash>:<rep>` and a random `query_id`. Results are streamed and discarded (counted, never parsed).
4. **Collects metrics** from `system.query_log` (metric columns only), falling back to the `X-ClickHouse-Summary` header.

## Running

Credentials live in `~/.config/aqa-bench/clickhouse.env` (`BENCH_CLICKHOUSE_URL`, `BENCH_CLICKHOUSE_USER`, `BENCH_CLICKHOUSE_PASSWORD`, optional `BENCH_CLICKHOUSE_DATABASE`). The harness parses the file in-process; nothing reads it into the shell environment.

```sh
cd stores/clickhouse

# Offline
npx vitest run --config bench/aggregate-traces/vitest.config.ts
npx tsc --noEmit -p bench/aggregate-traces/tsconfig.json
docker compose up -d --wait && npx tsx bench/aggregate-traces/smoke.ts   # local end-to-end run

# Replica
npx tsx bench/aggregate-traces/run.ts preflight
npx tsx bench/aggregate-traces/run.ts profile
npx tsx bench/aggregate-traces/run.ts run --buckets small,mid,p90
npx tsx bench/aggregate-traces/run.ts run --buckets p99 --windows 1d,7d
npx tsx bench/aggregate-traces/run.ts run --buckets p99,largest --gate-b-approved   # only after review
npx tsx bench/aggregate-traces/run.ts report
npx tsx bench/aggregate-traces/leak-check.ts [pr-body.md]
```

`run` is resumable: it skips case keys already in `results/runs.jsonl`. `--dry-run` lists what would run.

### Memory experiments

[EXPERIMENTS.md](./EXPERIMENTS.md) logs the follow-up work on per-query memory (experiment IDs, environment, result).

```sh
# Probes on the replica (floor, prefetch settings, CTE stages, query-shape variants), results/floor.jsonl
npx tsx bench/aggregate-traces/floor.ts --buckets small,p99 --probes F0,F0-shape,F0-shape-pf8 [--cold] [--reps 3]

# Local lab: ClickHouse 26.4 in docker, synthetic tenants shaped like the replica (aggregate stats only)
npx tsx bench/aggregate-traces/lab.ts calibrate   # read-only, aggregate-only queries on the replica
npx tsx bench/aggregate-traces/lab.ts up && npx tsx bench/aggregate-traces/lab.ts load
npx tsx bench/aggregate-traces/lab.ts pull        # replace the 15 projects with pseudonymized replica rows (see below)
npx tsx bench/aggregate-traces/lab.ts derive      # usage rollup, span-name index, usage on roots, hourly rollup [--tables ...]
npx tsx bench/aggregate-traces/lab.ts bloom       # traceId bloom-filter skip indexes
npx tsx bench/aggregate-traces/lab.ts equiv       # variants return the same rows as compiled
npx tsx bench/aggregate-traces/floor.ts --lab --buckets small,p99 --probes F3,F3-shape,F3-arch
npx tsx bench/aggregate-traces/retries.ts         # retried token writes vs write-time rollups
npx tsx bench/aggregate-traces/lab.ts down
```

`pull` hashes identifiers, names and free text **on the replica** with a salted SHA-256 (the salt lives only in
memory), never reads payload columns (they are regenerated locally at calibrated widths), and keeps timestamps,
numbers and enum-like columns. Pulled rows stay in the docker volume; only hashed literals reach the gitignored `results/`.

Query-shape variants (`rs`, `r1`, `rio`, `sp`, `shape`, `hk`, `nord`, plus the diagnostic `nodedupe`/`nocm`/`final`)
and schema variants (`urollup`, `snidx`, `arch`, `arch2`, `arch3`, `hourly`; lab tables only) are string rewrites in
[scope.ts](./scope.ts) that fail closed when their anchor is missing; see EXPERIMENTS.md X17–X28.

## Safety model

- **Host guard** ([env.ts](./env.ts)), before any network I/O: `https`, host `gyiixsk9we.us-central1.gcp.clickhouse.cloud`, port `8443`, no path. Any URL mentioning the production primary is refused. The client is built from the bare origin plus separate credentials.
- **Read-only session**: every session starts with `getSetting('readonly')` and aborts unless it is `2` (read-only, per-query settings allowed). A client-side allowlist only sends single `SELECT` / `WITH` / `EXPLAIN` statements.
- **Limits on every query** ([client.ts](./client.ts)):

  | setting              | Tier 1 (default) | Tier 2 | Tier 3 (explicit approval) |
  | -------------------- | ---------------- | ------ | -------------------------- |
  | `max_execution_time` | 30 s             | 60 s   | 120 s                      |
  | `max_memory_usage`   | 4 GiB            | 8 GiB  | 16 GiB                     |
  | `max_threads`        | 4                | 8      | 16                         |
  | `max_bytes_to_read`  | 50 GB            | 200 GB | 500 GB                     |
  | `max_result_rows`    | 20 000           | 20 000 | 20 000                     |

  Overflow modes are `throw`; `use_query_cache = 0`. Cold runs add `enable_filesystem_cache = 0`.

- **Pacing**: one query at a time, 2 s apart; abort after 3 consecutive non-limit errors. After a limit hit, a case skips its larger windows in that bucket and runs only 1-day windows in larger buckets. Gate B cases (p99 at 30 days, largest beyond 1 day, high-cardinality and `I4` on p99/largest) need `--gate-b-approved`.
- **No secrets or customer content in output**: all stdout/stderr is redacted (credentials, URL userinfo, real ids, discovered literals); error messages are never persisted, only the error code and category. Projects appear only as bucket + salted 8-hex HMAC. Real ids, the salt and the per-project "top value" literals live only in `~/.cache/aqa-bench/selection.json` (mode 0600). `results/` is gitignored. `leak-check.ts` scans the write-up, results, staged diff and PR body for any of those values and prints only counts.
