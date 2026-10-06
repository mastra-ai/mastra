# Trace-query family benchmark

Benchmarks the merged ClickHouse trace-query APIs — `queryTraces()` (keyset, page + payload, deprecated groups, delta), `queryThreads()`, `querySpans()` (select + payload + cost-metrics stages), `getTraceQueryValues()` and `getTraceQueryObservedFields()` — against Platform's production observability data on the same **read-only** ClickHouse Cloud replica, projects and buckets as the [aggregateTraces() benchmark](../aggregate-traces/README.md). Results and recommendations are in [FINDINGS.md](./FINDINGS.md).

This directory is not part of the package and never runs in CI. Safety-critical code (host guard, read-only allowlist, limits, redaction, leak-check, concurrency pool) lives in [../shared](../shared).

## How it works

Each case in [cases.ts](./cases.ts) is a public request, validated and planned by the real core planner and compiled by the merged compiler:

| API                             | planner                                                         | compiler                                                            |
| ------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------- |
| `queryTraces()`                 | `parseTraceQueryRequest` + `planTraceQuery`                     | `compileClickHouseTraceQuery`, `compileClickHouseTraceRootPayloads` |
| `queryThreads()`                | `parseQueryThreadsInput` + `planThreadQuery`                    | `compileClickHouseThreadQuery`                                      |
| `querySpans()`                  | `planSpanQuery`                                                 | `compileClickHouseSpanQuery` + captured hydration (below)           |
| `getTraceQueryObservedFields()` | `parseGetTraceQueryFieldsArgs` + `planTraceQueryObservedFields` | `compileClickHouseTraceQueryObservedFields`                         |
| `getTraceQueryValues()`         | `parseGetTraceQueryValuesArgs` + `planTraceQueryValues`         | `compileClickHouseTraceQueryValues`                                 |

The harness then:

1. **Scopes to one project** ([scope.ts](../shared/scope.ts)), exactly as the aggregate suite does; `querySpans()` uses its own matcher (two `span_N` tenant fragments). Every rewrite asserts its match count and fails closed.
2. **Optionally applies a labelled what-if**: `w1` (scope the outer `current_roots` re-read), `payload-scoped` (org/project scope on the page-mode root-payload lookup), `span-payload-scoped` / `span-metrics-scoped` (org/project scope, plus a partition bound on payloads, on `querySpans()` hydration).
3. **Builds later stages from the store's own code.** Page-mode payload keys and deep cursors come from key-only reads (ids and timestamps only, held in memory, never persisted) and the real cursor encoders. `querySpans()` hydration SQL is built inline in the store, so [stages.ts](./stages.ts) runs the real `querySpans()` against a capture client that returns the select rows and records — without executing — the payload and cost-metric statements.
4. **Executes** through the bounded-concurrency pool ([pool.ts](../shared/pool.ts)) with the aggregate suite's limits, `log_comment` tagging and streamed-and-discarded results.

## Running

```sh
cd stores/clickhouse

# Offline
npx vitest run --config bench/trace-query/vitest.config.ts
npx tsc --noEmit -p bench/trace-query/tsconfig.json
docker compose up -d --wait && npx tsx bench/trace-query/smoke.ts   # local end-to-end run

# Replica (reuses ~/.cache/aqa-bench/selection.json from the aggregate suite)
npx tsx bench/trace-query/run.ts preflight              # metadata + capacity check
npx tsx bench/trace-query/run.ts discover               # sidecar literals
npx tsx bench/trace-query/run.ts probe                  # concurrency A/B proof → results/concurrency.json
npx tsx bench/trace-query/run.ts run --buckets small,mid,p90
npx tsx bench/trace-query/run.ts run --buckets p99 --windows 1d,7d
npx tsx bench/trace-query/run.ts run --buckets largest --windows 1d
npx tsx bench/trace-query/run.ts run --buckets p99,largest --gate-b-approved   # only after review
npx tsx bench/trace-query/run.ts report
npx tsx bench/shared/leak-check.ts [pr-body.md]
```

`run` refuses to start without a probe decision, and is resumable (skips keys already in `results/runs.jsonl`). `--dry-run` lists the phases and units.

## Concurrency

A scheduling unit is one case × variant × window × project; its stages and reps run in order in one slot, and different units run in parallel (default 4, max 8). Phases (bucket × window, smallest first) are barriers, so the aggregate suite's escalation rule stays exact. Each slot keeps the 2 s gap between its own queries, and query starts are at least 250 ms apart.

Concurrency must be earned before any result counts: `probe` runs the probe cases sequentially (arm A) and concurrently (arm B) in alternating order and accepts a level only if memory, rows/bytes read and latency match the plan's criteria; otherwise it falls back to 2, then to sequential. During `run`, sentinel cases re-run sequentially after every phase; drift halves concurrency and re-runs the phase (the old records are marked superseded). Cold reps on the largest bucket always run alone.

Server-busy errors (`TOO_MANY_SIMULTANEOUS_QUERIES`, server-total memory, socket/network/HTTP 429/503) halve concurrency, pause all slots 60 s and retry once; 3 at concurrency 1, or 5 within 10 minutes, abort the run.

## Safety model

Same as the [aggregate suite](../aggregate-traces/README.md#safety-model): host guard before any I/O, read-only session re-verified every session, single `SELECT`/`WITH`/`EXPLAIN` allowlist (also applied to every captured store statement), Tier limits on every query, redacted output, no customer content persisted. The extra literals this suite needs (top metadata value, tag, model, entityName, feedbackType per project) are discovered with aggregate-only reads into `~/.cache/aqa-bench/trace-query-literals.json` (mode 0600) and are leak-check needles. With 4 concurrent queries the bench uses at most 16 threads and 16 GiB on the replica.
