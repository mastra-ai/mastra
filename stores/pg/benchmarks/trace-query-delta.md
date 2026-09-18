# Trace-query delta benchmark

Measured on 2026-09-17 with PostgreSQL 16.15 (aarch64), the existing TimescaleDB
Compose service, and its normal indexes/chunks. The fixture contains 100,000
completed roots distributed across 31 days, from 2026-08-17 through 2026-09-16.
A second transaction inserts 10 completed roots after the bootstrap watermark.
All queries use the same 31-day selection and a limit of 100.

Reproduce:

```sh
docker compose -f stores/pg/docker-compose.vnext.yaml up -d
pnpm --filter @mastra/pg exec tsx scripts/benchmark-trace-delta.ts
```

The script writes SQL, parameters, full `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)`
plans, and `summary.json` to `/tmp/pg-trace-delta-benchmark`. Override the output
with `PG_DELTA_BENCHMARK_OUTPUT` or the database with `PG_VNEXT_TIMESCALE_URL`.
It creates an isolated schema and drops it on completion. The before query
reconstructs the previous SQL by moving only the transaction bounds out of
`root_scope` to the final candidate query; predicates, indexes, parameters,
latest-root detection, ordering, and limit remain identical.

| Poll                                          | Execution before / after (ms) | Planning before / after (ms) | Shared buffer hits before / after | Materialized roots before / after |
| --------------------------------------------- | ----------------------------: | ---------------------------: | --------------------------------: | --------------------------------: |
| Empty                                         |              131.823 / 24.750 |               18.933 / 3.917 |                        3,472 / 62 |                       100,000 / 0 |
| 10 new roots                                  |              102.247 / 14.353 |                3.684 / 3.736 |                       3,472 / 693 |                      100,010 / 10 |
| 10 new roots with `spans.some(name = 'root')` |            3,067.053 / 14.808 |                7.088 / 6.086 |                 6,305,838 / 1,953 |                      100,010 / 10 |

Shared read blocks were zero in every measurement (warm cache). These are local
measurements, not latency guarantees. Parallel worker startup and system load
contribute to the absolute timings; materialization counts and buffer usage
show the selectivity improvement directly.

The plan excerpts below omit repeated per-chunk scans:

```text
Before, empty:
  CTE root_scope: Hash Anti Join (actual rows=100000)
    Append: historical root scans (actual rows=100000)
    Hash: unrestricted newer-root scan (actual rows=100000)
  CTE Scan: transaction bounds applied after materialization (actual rows=0)

After, empty:
  CTE root_scope: Gather -> Nested Loop Anti Join (actual rows=0)
    Chunk Index Scans:
      Index Cond: ROW(xactId, cursorId) > ROW(lower, 0) AND xactId < horizon
    Unrestricted newer-root lookup (never executed for an empty interval)

Before, related:
  CTE root_scope: Hash Anti Join (actual rows=100010)
  CTE current_spans: Hash Anti Join (actual rows=100010)
    Related trace index lookups (loops=100010 per chunk)
  Final matching and watermark filter (actual rows=10)

After, related:
  CTE root_scope: Gather -> Nested Loop Anti Join (actual rows=10)
    Chunk cursor-index scans with lower and upper transaction bounds
    Unrestricted newer-root lookups (loops=10 per chunk)
  CTE current_spans: Nested Loop Anti Join (actual rows=10)
    Related trace index lookups (loops=10 per chunk)
  Final predicate, ordering, and limit (actual rows=10)
```

Numbered-page queries retain automatic handoff cursors. At 100,010 roots, the
count plan took 124.950 ms / 3,472 shared hits, and the data plan took 119.170 ms /
3,472 shared hits. Reading the handoff horizon itself took 0.008 ms execution,
0.029 ms planning, and zero shared buffers. After one warmup pair, five
alternating end-to-end samples gave:

| Numbered-page handoff    | Median (ms) | Mean (ms) |      Range (ms) |
| ------------------------ | ----------: | --------: | --------------: |
| Feature disabled         |     176.790 |   178.620 | 173.965–184.748 |
| Automatic cursor enabled |     180.094 |   181.198 | 175.114–189.205 |

The observed median overhead was 3.304 ms (1.87%); the mean difference was
2.577 ms (1.44%). This includes the extra horizon/timeout round trips and cursor
encoding. The small sample and overlapping ranges do not establish a stable
latency difference. Automatic numbered-page cursors remain enabled for workflow
parity.

The live integration suite also guards selectivity with `EXPLAIN ANALYZE`: after
1,000 historical roots, both `root_scope` and `current_spans` must materialize
exactly the two newly inserted candidate roots. Separate regressions cover a
completed root after bootstrap, equal transaction IDs across page boundaries,
recursive predicates before the limit, empty cursor advancement, replacements
outside the candidate interval, and delayed commits.
