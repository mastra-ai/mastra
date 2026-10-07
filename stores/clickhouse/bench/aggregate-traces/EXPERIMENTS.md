# Memory experiments: `aggregateTraces()` on ClickHouse

Running log of every experiment and candidate improvement for OBS-539 / OBS-515. `FINDINGS.md` holds the
benchmark tables; this file tracks what we tried, where, and what it showed.

**Budget** (agreed 2026-10-06): typical tenant 32–64 MiB peak per query, largest tenant ≤ 256 MiB. Multi-tenant
cluster, so per-query memory multiplies with concurrency.

**Where experiments run**

| Env       | What it is                                                                                                                                                                 | Use it for                                                                                                       |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `prod`    | Platform's read-only replica (ClickHouse Cloud 26.4), shared with other benches                                                                                            | Read path, prefetch/cache, cold reads, multi-tenant scan effects, final validation of anything that ships        |
| `local`   | ClickHouse 26.4 in docker: the 15 benchmark projects pulled from the replica (ids and free text hashed on the replica, payloads regenerated) plus synthetic filler tenants | Query-shape and schema iteration (hash tables, dedupe, joins, MVs, skip indexes), correctness/equivalence checks |
| `scratch` | Writable ClickHouse Cloud service (not available; Track 3 ran in `local` instead)                                                                                          | Schema/write-path changes where Cloud storage behaviour matters, concurrency tests                               |

Numbers are warm medians on the representative project per bucket, 30-day window, unless stated. Bucket sizes
(traces / 30d): small ≈ 25, p99 ≈ 41k, largest ≈ 430k (≈ 2.5M token rows).

## Improvements

| #   | Improvement                                                                                                                                                                                  | Kind             | Evidence           | Effect                                                                                                                                                                                                   | Status                                  |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| I1  | Limit remote prefetch for trace aggregate queries (`filesystem_prefetches_limit = 8`, or the prefetched read pool off)                                                                       | setting          | X10, X11, X12, X16 | Removes the ~155 MiB per-query floor (small F0 166 → 15 MiB, E4 225 → 30 MiB; mid/p90 20–42 MiB). Cold reads: +30–60% latency for small–p90, and p99 F3/E4 time out at any limit (X25, X30)              | measured; small–p90 only                |
| I2  | Add `endedAt >= from` to root and span scans (tables are partitioned by `toDate(endedAt)`)                                                                                                   | compiler         | X09, X17, X18      | Shipped inside I3's variant (`rs`); see I3                                                                                                                                                               | measured (with I3)                      |
| I3  | Tenant- and time-scope the outer `current_roots` re-read, with I2 (`rs`)                                                                                                                     | compiler         | X02, X17, X18      | Prod F0: bytes 98 → 7 MB small, 118 → 27 MB p99, 233 → 155 MB largest; latency ×0.3–0.7. Memory only drops once I1 removes the floor                                                                     | measured; equivalent in lab             |
| I4  | Remove query-time retry dedupe of token metrics (move to write path)                                                                                                                         | schema           | X07, X15           | Largest E4 976 → 462 MiB (×0.47), latency ×0.68. The replica has **zero** duplicate token rows in 30 days                                                                                                | needs write-path design                 |
| I5  | Drop the span dedupe in `current_spans` for `spans.some` (existence doesn't change with duplicates), with I2 (`sp`)                                                                          | compiler         | X13, X17, X18      | Prod F3: p99 189 → 185 MiB alone, largest 548 → 381 MiB; with I3 largest 337 MiB                                                                                                                         | measured; equivalent in lab             |
| I6  | All of the above together (`shape` + `filesystem_prefetches_limit = 8`)                                                                                                                      | combined         | X18                | Prod: small 15–28 MiB, p99 48–139 MiB, largest 242–432 MiB (from 166–944 MiB)                                                                                                                            | measured; cold: limit 8 hurts p99 (X25) |
| I7  | Dedupe roots in sort-key order: `ORDER BY startedAt, traceId, dedupeKey LIMIT 1 BY traceId` (`rio`)                                                                                          | compiler         | X19                | Lab largest: E3 284 → 164 MiB, F0 137 → 114 MiB; no effect on E4 (its cost is the usage join). 0 mismatches in 1,920 comparisons                                                                         | measured local; prod pending            |
| I8  | Per-trace token/cost rollup filled at write time (AggregatingMergeTree keyed by `(org, project, cityHash64(traceId))`)                                                                       | schema           | X20, X21, X23      | Lab largest E4 873 → 248 MiB, T1 879 → 247, T3 → 186 MiB; p99 E4 225 → 43 MiB. Exact, but double-counts retried batches unless I11 holds                                                                 | measured local                          |
| I9  | Span-name index table `(org, project, name, traceId)` so `spans.some(name = ?)` is a key lookup                                                                                              | schema           | X20                | Lab p99 F3 94 → 27 MiB (192 → 18 MB read); largest F3 357 → 115 MiB, E3 369 → 165 MiB with I7                                                                                                            | measured local                          |
| I10 | `traceId` bloom-filter skip indexes                                                                                                                                                          | schema           | X22                | Bytes ×0.2 for small tenants on base queries; no memory change anywhere, nothing once I3 scopes the re-read                                                                                              | rejected                                |
| I11 | Idempotent token writes: identical retry batches or a stable `insert_deduplication_token` (dedup window on source and rollup)                                                                | write            | X23                | Retried batches are dropped before the MV fires, so the I8 rollup stays exact. Re-batched or partial retries still double-count                                                                          | measured local                          |
| I12 | Hourly token/cost rollup for dashboards: `(org, project, hour, entityType, entityName, environment, serviceName, executionSource)` with counts, error counts, token and cost sums (`hourly`) | schema           | X26                | Lab: E4/T1/T2/E1/F0 at 8–14 MiB for **every** project size (largest E4 882 → 12 MiB, 436 → 8 MB read). 0 mismatches in 264 comparisons. Only additive measures on those dimensions, hour-aligned windows | measured local                          |
| I13 | Integer trace keys: `cityHash64(traceId)` in every `IN` set and the usage join (`hk`)                                                                                                        | compiler         | X27                | Lab largest ×0.6–0.7 alone (E4 302 → 190, T4 186 → 91 MiB); 0 mismatches                                                                                                                                 | measured local                          |
| I14 | No query-time root dedupe (`nord`); needs idempotent root writes                                                                                                                             | compiler + write | X27                | With I13 (`arch2`): largest F0/F3/E3/E1/T4 23–37 MiB (from 118–186). Usage-join cases stay at 113–186 MiB                                                                                                | **rejected**: roots are rewritten (X33) |
| I15 | Token/cost totals stored on the trace root row at write time (no usage join) (`arch3`)                                                                                                       | schema           | X27                | With I13 + I14: largest E4/T1/T3/T4 29–35 MiB, p99 16–20 MiB. 0 mismatches in 960 comparisons                                                                                                            | **rejected**: late token rows (X33)     |
| I16 | Split a long window into per-day queries and merge (additive measures only)                                                                                                                  | planner          | X28                | Per-query peak follows one day: largest 1-day `shape` 17–25 MiB vs 228–315 MiB for 30 days, no schema change                                                                                             | measured local                          |
| I17 | Token retry dedupe keyed by integers: `GROUP BY cityHash64(traceId), cityHash64(metricId)` (`hkd`, on top of `safe`)                                                                         | compiler         | X34                | Prod largest E4/T1/T3 ~865 → ~765 MiB (−11%), p99 no change. 0 mismatches in 144 comparisons                                                                                                             | measured; small win                     |
| I18 | One token/cost row per model call `(org, project, traceId, spanId)`, deduped per call, latest wins (`mcall`)                                                                                 | schema + writer  | X35                | Lab largest E4/T1/T3 818 → 338 MiB (×0.41), p99 187 → 72 MiB; small–p90 unchanged. 0 mismatches in 288 comparisons                                                                                       | measured local                          |
| I19 | Same per-call usage as typed columns on span rows (`spanu`)                                                                                                                                  | schema + writer  | X35                | Same memory as I18 but reads more bytes and is 1.5–5× slower; couples usage to span rewrites                                                                                                             | measured local; I18 preferred           |

## Experiment register

| ID  | Env        | Question                                                                                                                   | Result (short)                                                                                                                               | Status |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| X01 | prod       | Baseline: latency/bytes/memory by project size                                                                             | Peak 592 MiB (non-token), 991 MiB (token/cost); ~160 MiB even for 25-trace projects                                                          | done   |
| X02 | prod       | W1: tenant-scope the outer re-read                                                                                         | Bytes ×0.13–0.5 (small–p99), ×0.84 largest; memory ×0.9–1.4                                                                                  | done   |
| X03 | prod       | `quantileExact` vs `quantileDeterministic`; `uniq` vs `uniqExact`                                                          | No material difference                                                                                                                       | done   |
| X04 | prod       | `max_threads = 2` (t2)                                                                                                     | Memory ×0.91–1.02, often slower                                                                                                              | done   |
| X05 | prod       | External GROUP BY/sort at 256 MiB (spill)                                                                                  | E4 largest ×0.65 memory but ×3.8 latency; elsewhere no gain                                                                                  | done   |
| X06 | prod       | Dedupe token rows on `metricId` only (mkey)                                                                                | Memory ×0.98–1.03                                                                                                                            | done   |
| X07 | prod       | Diagnostic: no retry dedupe (nodedupe) / no `costMetadata` parse (nocm)                                                    | nodedupe ×0.47 largest, ×0.86 p99; nocm ×0.96–0.98                                                                                           | done   |
| X08 | prod       | `FINAL` instead of manual dedupe                                                                                           | Worse: 986–1209 MiB largest                                                                                                                  | done   |
| X09 | prod       | Is the floor tied to parts/granules selected?                                                                              | 30d scoped count selects 268/268 parts before PK; `endedAt` bound cuts to 19 parts, 156 → 55 MiB                                             | done   |
| X10 | prod       | What sets the ~160 MiB floor? (meter, columns, settings)                                                                   | `SELECT 1` 7.5 MiB; floor independent of columns/threads/blocks/buffers; prefetch off → 8.5 MiB                                              | done   |
| X11 | prod       | Which prefetch setting? Effect on full queries                                                                             | Prefetched read pool is the floor; both off is best (small F0 10, E4 28, F3 16 MiB)                                                          | done   |
| X12 | prod       | Cold (object-storage) latency with prefetch off                                                                            | Small: no cost. p99 +30–40%, largest F0 times out (>30 s vs 22 s). Prefetch limit 8 sits between                                             | done   |
| X13 | local      | Stage-by-stage CTE breakdown                                                                                               | Memory jumps at the span dedupe (F3) and the token usage dedupe (E4); root stages are cheap                                                  | done   |
| X17 | local      | Query-shape rewrites (`rs`, `r1`, `sp`, `shape`): equivalence and memory                                                   | 0 mismatches in 3,096 comparisons; `r1` does nothing; `sp`/`shape` cut p99 F3 128 → 48 MiB                                                   | done   |
| X18 | prod       | Shape rewrites ± prefetch limit vs the 32–64 / 256 MiB budget                                                              | Small and p99 F0/F3 within budget; E4 p99 139 MiB; largest 242–432 MiB, still over 256 for F3/E4                                             | done   |
| X14 | local      | Lab calibration: does local reproduce shape memory?                                                                        | Yes, within ~10–20% of prod with prefetch off (small/p99 F0, E4, F3; largest E4 820 vs ~930 MiB)                                             | done   |
| X15 | prod       | Duplicate rate of token metric rows (does the retry dedupe ever fire?)                                                     | 0 duplicate `metricId`s in 30 days for all 15 projects (up to 2.06M token rows)                                                              | done   |
| X16 | prod       | Keep prefetch but bound it (`filesystem_prefetch_max_memory_usage`, `filesystem_prefetches_limit`, `prefetch_buffer_size`) | Only `filesystem_prefetches_limit = 8` works: small count 12 MiB, F0 23–27, E4 42; p99 F0 52                                                 | done   |
| X19 | local      | Root dedupe in sort-key order (`rio`); join algorithms                                                                     | `rio` cuts largest E3 ~42%, F0 ~17%, 0 mismatches; only `partial_merge` join helps E4 (×0.87)                                                | done   |
| X20 | local      | Usage rollup + span-name index (`urollup`, `snidx`, `arch`) on pulled data                                                 | 0 mismatches in 1,320 comparisons; `arch` largest E4 294, F3 115, E1 134 MiB                                                                 | done   |
| X21 | local      | Rollup keyed by `cityHash64(traceId)`; FINAL read; dropping the `IN candidates` filter                                     | UInt64 key ×0.75–0.85 memory; FINAL no gain; dropping the filter changes results                                                             | done   |
| X22 | local      | `traceId` bloom filters                                                                                                    | No memory change; bytes drop only for small tenants on the unscoped base re-read                                                             | done   |
| X23 | local      | Retries vs write-time rollups; per-metric ReplacingMergeTree + FINAL; insert dedup tokens                                  | Rollup double-counts retries; per-metric FINAL exact at ~355 MiB; dedup keeps the MV exact                                                   | done   |
| X24 | local      | Concurrency: 10/25/50 parallel non-largest queries, base vs `arch`                                                         | Server peak at 50: +722 MiB → +392 MiB; no failures                                                                                          | done   |
| X25 | prod       | Cold reads for `shape` and `shape + limit 8`                                                                               | `shape` lets small/p99 F3/E4 finish cold; limit 8 pushes p99 F3/E4 over 30 s; largest F3/E4 time out cold                                    | done   |
| X26 | local      | Hourly token/cost rollup for dashboard queries (`hourly`)                                                                  | 8–14 MiB at every size; largest E4 882 → 12 MiB; 0 mismatches in 264 comparisons                                                             | done   |
| X27 | local      | Integer trace keys, no root dedupe, usage on the root row (`hk`, `nord`, `arch2`, `arch3`)                                 | `arch3` largest 23–35 MiB for every measured case; 0 mismatches (2,880 + 960)                                                                | done   |
| X28 | local      | One day of a 30-day query (per-day split)                                                                                  | Largest `shape` 1-day 17–25 MiB vs 228–315 MiB for 30 days                                                                                   | done   |
| X29 | prod       | mid and p90 with `shape` and `shape + limit 8`, warm and cold                                                              | Warm F0/F3 20–28 MiB, E4 36–42 MiB; cold all finish, 8–30 s                                                                                  | done   |
| X30 | prod       | Prefetch limit 4/8/16/32, warm and cold, small–p99                                                                         | Memory rises with the limit (8 ≈ 4 < 16 < 32); cold latency about the same for every limit; p99 F3/E4 cold time out at all four              | done   |
| X31 | prod       | Compiler rewrites that keep every dedupe (`sk`, `safe` = sk + sort-order dedupe + integer keys), ± limit 8, warm and cold  | Non-token small–p90 18–43 MiB; token/cost stays 34–49 / 293–302 / 866 MiB (p90 / p99 / largest); 0 mismatches in 2,880                       | done   |
| X32 | local      | Trace-ordered projection / copy of token rows so the `(traceId, metricId)` dedupe streams                                  | Projection never chosen; sorted copy alone 806–875 MiB, in-order aggregation worse; the dedupe alone is ~470 MiB                             | done   |
| X33 | prod       | Write-side facts for schema proposals (`prechecks.ts`, all tenants, 7 days)                                                | Roots rewritten (0.08% of traces, up to 263 copies); 0 duplicate token rows; span names never change; 4.3% of token rows after the root ends | done   |
| X34 | prod+local | Integer keys for the token retry dedupe; what the dedupe costs                                                             | Dedupe memory follows the number of token rows, not key type or aggregate: −11% at largest                                                   | done   |
| X35 | local      | One usage row per model call: separate table, span columns, `FINAL` read                                                   | Per-call table ×0.41 at largest; `FINAL` read adds a ~160 MiB floor (rejected)                                                               | done   |

## Entries

### X09: parts selected and partition pruning (prod, 2026-10-06)

`EXPLAIN indexes = 1` on a scoped `count()` over `mastra_trace_roots`. The table is `PARTITION BY toDate(endedAt)`
and `ORDER BY (organizationId, projectId, startedAt, …)`; the compiler filters on `startedAt` only, so partition
pruning never applies.

| Query                          | Parts after partition key | Granules after PK (small / largest) | Read (small) | Memory (small) |
| ------------------------------ | ------------------------- | ----------------------------------- | ------------ | -------------- |
| scoped, 30d `startedAt`        | 268/268                   | 129 / 1,436                         | 3.8 MB       | 156 MiB        |
| scoped, no time filter         | 268/268                   | 129 / 1,531                         | 4.1 MB       | 164 MiB        |
| scoped, 1d + `endedAt >= from` | 19/268                    | 14 / 75                             | 0.2 MB       | 55 MiB         |

### X10: the per-query floor (prod, 2026-10-06)

| Probe (small project)                                          | Read          | Memory        |
| -------------------------------------------------------------- | ------------- | ------------- |
| `SELECT 1`                                                     | 0             | 7.5 MiB       |
| scoped `count()` on trace_roots                                | 3.8 MB        | 156 MiB       |
| scoped read of 4 columns / all 44 columns                      | 3.9 / 14.3 MB | 179 / 187 MiB |
| `max_threads` 1, 2; `max_block_size` 8192; 64 KiB read buffers | 3.8 MB        | 137–156 MiB   |
| remote prefetch off (both settings)                            | 3.8 MB        | **8.5 MiB**   |
| count on span_events / metric_events                           | 2.2 / 29.8 MB | 48 / 195 MiB  |

Full compiled queries with prefetch off (both settings):

| Query                     | small            | p99                     | largest                 |
| ------------------------- | ---------------- | ----------------------- | ----------------------- |
| F0                        | 166 → **10 MiB** | 174 → **40 MiB**        | 284 → 271 MiB           |
| E4                        | 225 → **28 MiB** | 320 → 260 MiB           | 951 → 930 MiB           |
| `max_threads = 1` instead | F0/E4 unchanged  | E4 → 243 MiB, 2× slower | E4 → 914 MiB, 2× slower |

Conclusion: the floor is read-path buffering, not query shape. Above p99 the memory is real aggregation state.
Warm latency with prefetch off was equal or better except largest E4 (~10% slower).

### X11: which prefetch setting (prod, 2026-10-06)

`nopool` = `allow_prefetched_read_pool_for_remote_filesystem = 0` only; `nopf` = `remote_filesystem_read_prefetch = 0`
only; `both` = both off. Peak memory, warm.

| Query | small: base / nopool / nopf / both | p99: base / nopool / nopf / both |
| ----- | ---------------------------------- | -------------------------------- |
| count | 156 / 8.5 / 154 / 8.5              | — / — / 162 / —                  |
| F0    | 166 / 23 / 157 / 10                | 174 / 51 / 169 / 40              |
| E4    | 225 / 38 / 222 / 28                | 320 / 289 / 310 / 260            |
| F3    | 169 / 32 / — / 16                  | 189 / 157 / — / 150              |

The prefetched read pool is the floor; turning off remote prefetch as well saves another 10–15 MiB. Warm latency is
unchanged within noise. At p99 the remaining memory is real query state (E4 usage aggregation, F3 span scan).

### X12: cold reads with prefetch changed (prod, 2026-10-06)

F0, 30 days, filesystem cache bypassed, 3 runs each (ms; peak memory).

| Bucket  | base                 | prefetch limit 8     | prefetch off (pool + remote) |
| ------- | -------------------- | -------------------- | ---------------------------- |
| small   | 12.1–13.4 s; 160 MiB | 13.0–13.3 s; 22 MiB  | 13.8–15.9 s; 10 MiB          |
| p99     | 14.2–15.8 s; 169 MiB | 18.0–25.0 s; 45 MiB  | 20.1–21.5 s; 34 MiB          |
| largest | 21.2–22.9 s; 280 MiB | 22.8–27.7 s; 264 MiB | timeout (> 30 s); —          |

Earlier pass (2 runs): E4 and F3 cold time out (> 30 s) with and without prefetch at small and p99. Cold latency is
dominated by how much is read (F0 reads ~100 MB even for a 25-trace project because of the unscoped re-read), so
I2/I3 are the cold fix; the prefetch setting only trades memory for cold latency.

Reading: small tenants (the 99%) lose nothing on cold reads with the prefetch limit or pool off. Larger tenants pay
20–60% more cold latency. A size-aware setting (Platform knows a project's volume) is an option; better, cut the
bytes read first.

### X14: local lab calibration (local, 2026-10-06)

`lab.ts`: ClickHouse 26.4.5 in docker, the replica's own DDL (`Shared*` engines → local, TTL dropped), synthetic data
sized from `lab.ts calibrate` (per-project traces/spans/token rows/span names/threads, column widths and compression
from `system.columns`, 884 tenants following the replica's size distribution, 41 days of history). 2.45M roots,
20M spans, 7.7M token rows (non-token metrics omitted: pruned by the sort key). One part per partition after
compaction (replica: ~5–10). Local disk, so it models prod **with prefetch off**.

| Query | small: prod (prefetch off) / lab | p99: prod (prefetch off) / lab | largest: prod / lab |
| ----- | -------------------------------- | ------------------------------ | ------------------- |
| count | 8.5 / 7.7 MiB                    | — / 7.7 MiB                    | — / 7.7 MiB         |
| F0    | 10 / 8.3 MiB                     | 40 / 33 MiB                    | 271 / 220 MiB       |
| E4    | 28 / 20 MiB                      | 260 / 270 MiB                  | 930 / 820 MiB       |
| F3    | 16 / 10 MiB                      | 150 / 122 MiB                  | — / (limit)         |

Good enough to rank query-shape variants locally and confirm the winners on prod. Limits: the docker VM has ~3 GB
free, ClickHouse idles at ~1.2 GiB, so largest-project queries above ~800 MiB fail locally (server limit 2.2 GB);
those run on prod. Cold reads, prefetch and multi-tenant concurrency don't reproduce locally.

### X15: duplicate token metric rows (prod, 2026-10-06)

`count()` vs `uniqExact(metricId)` over token metric names, 30 days, per selected project: equal in all 15 projects
(32 to 2,059,028 rows). Stored rows are counted before merges, so retried writes would show up here. The query-time
`(traceId, metricId)` dedupe, about half of E4's memory on the largest project (X07), removes nothing in practice.

Schema note: the live DDL has a **6-month** TTL on all four tables (the Platform schema file says 30 days).

### X16: bounded prefetch (prod, 2026-10-06)

| Setting                                         | small count / F0 / E4 | p99 count / F0 / E4 |
| ----------------------------------------------- | --------------------- | ------------------- |
| base                                            | 156 / 166 / 225 MiB   | 162 / 174 / 320 MiB |
| `filesystem_prefetch_max_memory_usage = 32 MiB` | 156 / 166 / 225       | 164 / 174 / 314     |
| `prefetch_buffer_size = 256 KiB`                | 156 / 161 / 199       | 164 / 170 / 297     |
| `filesystem_prefetches_limit = 8`               | 12 / 25 / 42          | 15 / 52 / 289       |

The memory cap setting doesn't bound what the meter counts; the prefetch count limit does.

### X13: stage-by-stage CTE breakdown (local, 2026-10-06)

Each stage runs as the compiled `WITH` chain cut off at that CTE, hashing `traceId` for root/span stages and `*`
downstream. Run in the lab (prefetch has no effect there), so numbers are query state, not the Cloud floor.

| Stage (p99, 30d) | F0     | F3     | E4      |
| ---------------- | ------ | ------ | ------- |
| current_roots    | 26 MiB | 26 MiB | 26 MiB  |
| root_scope       | 33     | 34     | 34      |
| current_spans    |        | **99** |         |
| candidates       | 34     | 128    | 34      |
| usage            |        |        | **260** |
| facts / final    | 37     | 121    | 257–273 |

Largest project: current_roots 163–167 MiB, current_spans 379 MiB; the usage stage alone exceeds the lab's 2.2 GB
cap. Two stages carry the cost: the span dedupe (`LIMIT 1 BY dedupeKey` over every span of the candidate traces)
and the token usage retry dedupe.

### X17: query-shape rewrites (local, 2026-10-06)

Variants are string rewrites of the compiled SQL that fail closed when their anchor is missing:

- `rs`: outer `current_roots` re-read gets `organizationId`/`projectId`/`startedAt` window and `endedAt >= from`;
  the seed scan gets `endedAt >= from` (a trace that starts in the window ends after `from`, so it is safe).
- `r1`: one `LIMIT 1 BY traceId` pass instead of dedupeKey then traceId.
- `sp`: no `LIMIT 1 BY dedupeKey` in `current_spans`, plus `endedAt >= from`. Only used for existence checks, so
  duplicate spans can't change the result.
- `shape`: `rs` + `r1`, plus `sp` when there is a span relation and `nodedupe` when there is a usage CTE.

**Equivalence** (`lab.ts equiv`): every case × window × calibrated project below largest, each variant vs base,
rows compared with a 1e-9 relative float tolerance (sum order differs): 3,096 comparisons, 744 not applicable,
0 mismatches. Caveat: lab and replica have no duplicate token rows (X15), so this does not prove `nodedupe` safe
under retries; I4 still needs write-path idempotency.

| Lab, warm, 30d | base    | rs    | r1    | sp   | nodedupe | shape |
| -------------- | ------- | ----- | ----- | ---- | -------- | ----- |
| small F0       | 8.3 MiB | 8.4   | 8.3   |      |          | 8.4   |
| small F3       | 9.4     | 9.6   | 9.3   | 9.3  |          | 11.0  |
| small E4       | 19.6    | 19.9  | 19.6  |      | 16.3     | 16.6  |
| p99 F0         | 34.5    | 29.3  | 33.1  |      |          | 29.2  |
| p99 F3         | 127.5   | 127.9 | 123.6 | 53.1 |          | 48.1  |
| p99 E4         | 258.4   | 257.9 | 257.6 |      | 61.9     | 62.4  |

`r1` changes nothing and is dropped. `rs` cuts bytes read (p99 F0 95 → 15 MB) but not memory on its own.

### X18: shape rewrites on prod, with and without the prefetch limit (prod, 2026-10-06)

Warm, 30d, rep 2 of 3 (memory / bytes read / latency):

| Project | Case | base                     | shape                 | shape + prefetch limit 8  |
| ------- | ---- | ------------------------ | --------------------- | ------------------------- |
| small   | F0   | 166 MiB / 98 MB / 348 ms | 165 / 7 MB / 89 ms    | **15** / 7 MB / 90 ms     |
| small   | F3   | 169 / 198 MB / 685 ms    | 174 / 16 MB / 299 ms  | **21** / 16 MB / 347 ms   |
| small   | E4   | 225 / 222 MB / 782 ms    | 222 / 41 MB / 420 ms  | **28** / 41 MB / 364 ms   |
| p99     | F0   | 174 / 119 MB / 447 ms    | 176 / 27 MB / 186 ms  | **48** / 27 MB / 147 ms   |
| p99     | F3   | 189 / 353 MB / 2.3 s     | 194 / 88 MB / 826 ms  | **70** / 88 MB / 469 ms   |
| p99     | E4   | 315 / 434 MB / 758 ms    | 276 / 219 MB / 488 ms | **139** / 219 MB / 766 ms |
| largest | F0   | 299 / 233 MB / 665 ms    | 255 / 155 MB / 381 ms | 242 / 155 MB / 390 ms     |
| largest | F3   | 548 / 974 MB / 1.6 s     | 337 / 562 MB / 1.1 s  | 343 / 562 MB / 1.1 s      |
| largest | E4   | 944 / 1017 MB / 3.4 s    | 447 / 783 MB / 2.1 s  | 432 / 783 MB / 1.4 s      |

Against the budget: small tenants land at 15–28 MiB (inside 32–64), p99 F0/F3 at 48–70 MiB, p99 E4 at 139 MiB.
The largest project stays at 242–432 MiB: F0 is near 256, F3 and E4 are over. What remains there is real query
state over the project's own rows (spans for F3, ~2.5M token rows for E4), which compiler rewrites can't remove.
Cold latency for `shape + limit 8` is not measured yet; X12 says the limit costs 20–60% cold on large projects,
but `shape` reads 2–13× fewer bytes, which should more than pay for it.

## Track 3 (local, pulled data, 2026-10-06)

No writable Cloud service was available, so the schema experiments ran in the local lab on the 15 benchmark projects
pulled from the replica (`lab.ts pull`). Identifiers, names and free text are replaced on the replica by a salted
SHA-256 (salt kept in memory only); payload columns are never read and are regenerated at their calibrated widths;
timestamps, numbers and enum-like columns are kept. The lab server is capped at 4 GB. The lab has no Cloud prefetch
floor, so compare variants within the lab, not against prod absolutes (X14: lab ≈ prod with prefetch off).

Calibration on pulled data (warm, MiB / MB read):

| Case | small base → shape | p99 base → shape        | largest base → shape      |
| ---- | ------------------ | ----------------------- | ------------------------- |
| F0   | 8.2 → 7.9          | 23.8 / 69 → 23.3 / 8    | 162.6 / 125 → 139.8 / 77  |
| F3   | 8.1 → 8.0          | 93.7 / 192 → 37.2 / 57  | 356.9 / 499 → 220.7 / 373 |
| E4   | 10.8 → 10.8        | 225.4 / 191 → 51.9 / 64 | 839.8 / 436 → 292.7 / 318 |

`shape` is still exact on pulled data: 2,136 comparisons, 0 mismatches.

### X19: root dedupe in sort-key order, join algorithms (local)

Stage breakdown of `arch` at largest (MiB): F0 current_roots 101 → root_scope 139 → facts 156; E4 usage 205 →
facts 307; E3 current_spans 161 → facts 289. The root dedupe sorts every root row by traceId. Ordering it
`startedAt, traceId, dedupeKey` (`rio`, a compiler change) lets ClickHouse dedupe in the table's read order:

| Largest, MiB | arch | arch + rio |
| ------------ | ---- | ---------- |
| F0           | 137  | 114        |
| E3           | 284  | 164        |
| E4           | 301  | 290        |

`rio`, and `arch` (which now includes it): 1,920 comparisons, 0 mismatches. It keeps the lowest dedupeKey among
duplicates that share `startedAt`, which every retried root write does. Join algorithms for E4's usage join:
`partial_merge` 262 MiB (×0.87), `grace_hash` 306, `max_threads = 1` 306, `full_sorting_merge` 350–365 (worse).

### X20: usage rollup and span-name index (local)

`lab.ts derive` builds two tables from the pulled data, inserted day by day as an MV would (left unmerged):

- `mastra_trace_usage`: AggregatingMergeTree `(org, project, traceId)`, one row per trace with token sums, cost,
  priced/failed counts and unit min/max. 1.2M rows / 56 MiB, from 6.9M token rows / 391 MiB.
- `mastra_trace_span_names`: ReplacingMergeTree `(org, project, name, traceId)`, partitioned by `toDate(endedAt)`.
  14.2M rows / 236 MiB, from 19.2M span rows / 3,981 MiB.

`urollup` points the usage CTE at the rollup; `snidx` points span-name predicates at the index (and fails closed for
any predicate other than the span name); `arch` = `shape` + `rio` + both. 1,320 comparisons, 0 mismatches.

| Warm, MiB / MB | p99 base    | p99 arch  | largest base | largest arch |
| -------------- | ----------- | --------- | ------------ | ------------ |
| F0             | 23.8 / 69   | 25.2 / 8  | 162.6 / 125  | 113.6 / 77   |
| F3             | 93.7 / 192  | 26.7 / 18 | 356.9 / 499  | 114.5 / 84   |
| E1             | 28.8 / 71   | 28.3 / 10 | 196.4 / 141  | 133.5 / 93   |
| E3             | —           | 37.0 / 31 | 368.9 / 558  | 165.3 / 146  |
| E4             | 225.4 / 191 | 53.8 / 26 | 839.8 / 436  | 294.0 / 218  |
| T1             | —           | 52.2 / 24 | 878.5 / 425  | 288.9 / 206  |
| T3             | —           | 49.4 / 22 | —            | 243.9 / 189  |
| T4             | 108.8 / 436 | 33.1 / 44 | 420.5 / 1170 | 177.6 / 220  |

Small: every case 8–18 MiB, < 1 MB read.

### X21: rollup key type, FINAL, the candidate filter (local)

- Keying the rollup by `cityHash64(traceId)` (UInt64) instead of the String traceId: largest E4 294 → 248 MiB,
  T1 293 → 247, T3 245 → 186; p99 E4 55 → 43. Same results. Rollup on disk 56 → 39 MiB.
- Reading the rollup with FINAL instead of `GROUP BY`: no gain (p99 64 vs 56 MiB).
- Dropping `traceId IN (SELECT traceId FROM candidates)` from the usage CTE: less memory, but **different results**
  at largest, so the filter stays.

With the UInt64 key, the largest tenant is at ~250 MiB for token/cost and 115–165 MiB for the other cases: inside
the 256 MiB budget, with little headroom for token/cost.

### X22: `traceId` bloom filters (local)

`lab.ts bloom` adds `bloom_filter(0.01)` on `traceId` to roots, spans and metrics (2.7–4 MiB each). With vs without
(`use_skip_indexes = 0`): small base F0 62 → 13 MB, F3 124 → 27 MB read; p99 and largest unchanged; memory
unchanged everywhere; `shape` and `arch` unchanged. It only helps the unscoped re-read, which I3 removes.

### X23: retries vs write-time rollups (local, `retries.ts`)

Re-inserting 1% of the largest project's token rows as a separate batch (a writer retry) into an MV-style rollup
(UInt64 key) and into a per-metric ReplacingMergeTree `(org, project, traceHash, metricId)` read with FINAL:

| Largest, warm MiB | Rollup: clean / retried | Per-metric FINAL: clean / retried | Results after the retry         |
| ----------------- | ----------------------- | --------------------------------- | ------------------------------- |
| E4                | 252 / 255               | 361 / 354                         | rollup changed; FINAL unchanged |
| T1                | 252 / 257               | 359 / 352                         | rollup changed; FINAL unchanged |
| T3                | 187 / 187               | 213 / 221                         | rollup changed; FINAL unchanged |

The rollup double-counts retries. The per-metric table is exact but costs ~40% more (still 2.4× below today's
~870 MiB). Insert deduplication keeps the rollup exact: with `non_replicated_deduplication_window` on both source and
rollup tables and `deduplicate_blocks_in_dependent_materialized_views = 1`, a retried batch with identical content or
the same `insert_deduplication_token` is dropped before the MV fires (checked: rollup totals match accepted batches
only). A retry that re-batches or reorders rows is not caught. On Cloud, block dedup is on by default for
SharedMergeTree; the writer must retry with identical batches or a stable token.

### X24: concurrency (local, relative only)

N parallel queries mixing F0/F3/E1/E3/E4 across the 12 non-largest projects, 30d; server memory sampled every 20 ms:

| N   | base: server peak / sum of query peaks | arch           |
| --- | -------------------------------------- | -------------- |
| 10  | +91 / 196 MiB                          | +56 / 145 MiB  |
| 25  | +397 / 791 MiB                         | +160 / 409 MiB |
| 50  | +722 / 1,512 MiB                       | +392 / 812 MiB |

No failures at 50 either way. Prod adds the ~155 MiB prefetch pool per query (I1) on top, which the lab doesn't
have: 50 concurrent small queries carry ~7.6 GiB of prefetch buffers on prod today.

### X25: cold reads for `shape` and `shape + limit 8` (prod)

Filesystem cache bypassed, 30 s limit, 2 reps (seconds; F = timeout on both reps unless stated):

| Case | small base / shape / + limit 8 | p99 base / shape / + limit 8 | largest base / shape / + limit 8 |
| ---- | ------------------------------ | ---------------------------- | -------------------------------- |
| F0   | 18–21 / 4.8–4.9 / 17–26        | 15.5–15.8 / 8.7–9.9 / 12–14  | 27–28 / 21–22 / 22–23            |
| F3   | F / 12–17 / 16–23              | F / 21–22 / F                | F / F / F                        |
| E4   | F / 13–28 / 14–23              | F / 25–28 / F                | F / F / F                        |

`shape` lets small and p99 F3/E4 finish cold. The prefetch limit undoes that at p99 and adds latency for small F0,
while keeping cold memory low (small 12–29 MiB, p99 F0 46 MiB vs ~170). Largest F3/E4 still time out cold; they need
I8/I9 to read less, and cold numbers for `arch` need a Cloud service with that schema.

## Getting to 10–30 MiB (local, pulled data, 2026-10-07)

Target tightened on 2026-10-07: most projects 10–30 MiB per query, only the largest up to 256 MiB.

### X26: hourly rollup for dashboard token/cost queries (local)

`mastra_usage_hourly`: AggregatingMergeTree, `ORDER BY (organizationId, projectId, hour, entityType, entityName,
environment, serviceName, executionSource)`, sums of trace count, error count, usage-bearing/priced/covered counts,
the four token sums and cost, min/max cost unit. Backfilled from roots (deduped) joined to the per-trace usage
rollup: 688k rows / 12.6 MiB for the whole lab (roots: 2.27M rows / 2.8 GiB). The `hourly` variant answers a query
from this table alone when every measure is additive (count, error count/rate, token/cost sums and averages,
cost coverage), every group-by and filter is one of those five dimensions, buckets are whole hours and the window
is hour-aligned; otherwise it fails closed and the query keeps the per-trace path. Applies to E1, E4, F0, F1, I2, T1,
T2; refuses T3/H4 (thread/user group-by), E2/P2/C3 (percentiles, distinct), F3/T4/I1 (span relations, 15-minute
buckets).

| MiB (MB read) | small     | mid        | p90        | p99        | largest    |
| ------------- | --------- | ---------- | ---------- | ---------- | ---------- |
| E4 base       | 10.9 (27) | 13.2 (107) | 19.8 (131) | 218 (191)  | 882 (436)  |
| E4 `hourly`   | 8.6 (1.1) | 10.7 (2.6) | 12.2 (7.7) | 12.2 (7.7) | 12.3 (8.2) |
| T1 `hourly`   | 7.8       | 10.5       | 11.8       | 11.8       | 11.9       |
| T2 `hourly`   | 7.9       | 10.7       | 12.0       | 12.0       | 12.1       |
| F0 `hourly`   | 7.7       | 7.9        | 9.7        | 9.7        | 9.7        |

0 mismatches in 264 comparisons. Open design point for the write path: the lab attributes usage to the root's
`startedAt` hour and root dimensions (a join at fill time). An MV fed by `mastra_metric_events` alone would need the
metric row's `rootEntity*`/environment columns (present on the replica, not pulled into the lab) and would bucket by
metric timestamp, which differs from the root's hour for traces that cross an hour boundary. Retries need I11.

### X27: integer keys, no root dedupe, usage on the root row (local)

Each step on top of `arch` (I3 + I5 + I7 + I8 + I9), warm MiB:

| Case | p99 `arch` / +`hk` / +`nord` / `arch2` / `arch3` | largest `arch` / +`hk` / +`nord` / `arch2` / `arch3` |
| ---- | ------------------------------------------------ | ---------------------------------------------------- |
| F0   | 27 / 19 / 18 / 12 / 12                           | 118 / 82 / 62 / 23 / 23                              |
| F3   | 28 / 20 / 19 / 12 / –                            | 120 / 79 / 65 / 26 / –                               |
| E1   | 31 / 25 / 21 / 15 / –                            | 137 / 95 / 68 / 30 / –                               |
| E3   | 34 / 30 / 22 / 17 / 17                           | 169 / 130 / 75 / 27 / 27                             |
| E4   | 57 / 36 / 47 / 32 / 20                           | 302 / 190 / 301 / 186 / 35                           |
| T1   | 53 / 33 / 46 / 31 / 18                           | 297 / 190 / 304 / 186 / 29                           |
| T3   | 50 / 32 / 44 / 25 / 16                           | 249 / 154 / 208 / 113 / 29                           |
| T4   | 35 / 22 / 27 / 18 / 18                           | 186 / 91 / 130 / 37 / 29                             |

`hk` and `nord` compound: the root dedupe sort and the string `IN` sets are most of what's left once the scans are
scoped. With both, every case without a usage join is ≤ 30 MiB at the largest project. The usage join then costs
~150 MiB at largest whatever the key type; storing the trace's token/cost totals on the root row
(`mastra_trace_roots_u`, filled from the usage rollup) removes it, and every measured case lands at 16–20 MiB (p99)
and 23–35 MiB (largest). mid/p90 stay 8–18 MiB. 0 mismatches in 2,880 (`hk`, `nord`, `arch2`) + 960 (`arch3`)
comparisons; `nord` is only equivalent because the lab (like the replica) has almost no duplicate roots, so it
needs root writes that never duplicate a trace (or a ReplacingMergeTree read with FINAL, not measured). Usage on the
root row needs the trace's usage known when the root is written, or an update after late token rows arrive.

### X28: per-day split (local)

One day of the 30-day window, as a stand-in for splitting a query into daily sub-queries and merging additive
results (MiB / MB read):

| Case | p99 30d `shape` | p99 1d `shape` | largest 30d `shape` | largest 1d base | largest 1d `shape` |
| ---- | --------------- | -------------- | ------------------- | --------------- | ------------------ |
| F3   | 39 / 57         | 9.0 / 0.7      | 228 / 373           | 45 / 200        | 17 / 27            |
| E4   | 53 / 64         | 12 / 0.8       | 305 / 318           | 60 / 142        | 25 / 18            |
| T1   | 50 / 63         | 9.8 / 0.8      | 315 / 307           | 60 / 142        | 22 / 18            |
| T3   | 48 / 64         | 9.5 / 0.8      | 266 / 311           | 59 / 142        | 22 / 18            |

Without any schema change, a daily split keeps each sub-query at 17–25 MiB on the largest project. Only counts and
sums merge exactly; percentiles and distinct counts need `-State` merging, and limit/order over groups needs the
merged result (T3's top threads can't be cut per day). 30 sequential sub-queries cost more total time and bytes.

### X29: mid and p90 on prod (2026-10-07)

Warm MiB (3 reps) and cold seconds (2 reps, filesystem cache bypassed, 30 s limit; F = timeout):

| Case | mid warm base / `shape` / + limit 8 | p90 warm base / `shape` / + limit 8 | mid cold base / `shape` / + limit 8 | p90 cold base / `shape` / + limit 8 |
| ---- | ----------------------------------- | ----------------------------------- | ----------------------------------- | ----------------------------------- |
| F0   | 170 / 165 / 20                      | 177 / 165 / 22                      | 22–27 / 5.7 / 8.2–8.4               | 16 / 6.8–7.2 / 9.5–9.7              |
| F3   | 174 / 172 / 24                      | 177 / 177 / 28                      | F / 14 / 19                         | F / 17–18 / 25                      |
| E4   | 224 / 222 / 42                      | 227 / 223 / 36                      | F / 12 / 18                         | F / 15 / 28–30                      |

mid and p90 behave like small: the floor dominates, `shape` rescues every cold timeout, and the limit brings warm
memory to 20–42 MiB at the price of cold latency. E4 stays above 30 MiB because of the usage join (X27).

### X30: prefetch limit sweep (prod, 2026-10-07)

Warm MiB, `shape` + `filesystem_prefetches_limit = N`:

| Case | small 4 / 8 / 16 / 32 | mid 4 / 8 / 16 / 32 | p90 4 / 8 / 16 / 32 | p99 4 / 8 / 16 / 32   |
| ---- | --------------------- | ------------------- | ------------------- | --------------------- |
| F0   | 18 / 15 / 21 / 35     | 21 / 20 / 24 / 35   | 24 / 22 / 23 / 35   | 56 / 52 / 52 / 53     |
| F3   | 21 / 20 / 27 / 43     | 22 / 24 / 27 / 43   | 26 / 28 / 33 / 43   | 67 / 72 / 69 / 70     |
| E4   | 29 / 30 / 34 / 50     | 37 / 42 / 38 / 49   | 44 / 36 / 38 / 50   | 155 / 146 / 141 / 140 |

Cold seconds (2 reps):

| Case | small `shape` / 4 / 8 / 16 / 32       | mid `shape` / 4 / 8 / 16 / 32 | p90 `shape` / 4 / 8 / 16 / 32 | p99 `shape` / 4–32 |
| ---- | ------------------------------------- | ----------------------------- | ----------------------------- | ------------------ |
| F0   | 6–9 / 8–9 / 8–9 / 8–10 / 9–10         | 5.7 / 8 / 8 / 8 / 8           | 7 / 9–10 / 9.5 / 9.4 / 10     | 10–13 / 12–16      |
| F3   | 20–21 / 23–25 / 23–24 / 18–20 / 18–23 | 14 / 20 / 19 / 19 / 18–19     | 17–18 / 25 / 25 / 24–25 / 24  | F + 27 / F at all  |
| E4   | 12–15 / 17–18 / 16 / 16–17 / 16       | 12 / 18 / 18 / 18 / 17–18     | 15 / 25 / 28–30 / 23 / 23–25  | F + 27 / F at all  |

- Above 8 the limit only adds memory; below 8 it saves nothing. **8 is the setting.**
- No limit is free when cold: F0 +30–60%, F3/E4 +20–80% for small–p90, and p99 F3/E4 time out at every limit (vs
  one success in two without). The cold cost doesn't shrink with a larger limit, so it is the bounded concurrency of
  remote reads, not the buffer size.
- Cold `spans.some` (F3) takes 14–25 s even on a 25-trace project with `shape`: above the 15 s OSS default whatever
  the prefetch setting. It reads 16 MB, so this is object-storage round trips across many span parts, not volume;
  I9 (span-name index, far fewer parts and marks) is the candidate fix and needs a Cloud service to measure cold.
- Correction: the earlier I1 note ("cold reads: no cost for small projects") came from X12's base queries, whose
  cold time was dominated by the unscoped re-read. With `shape` the limit's cold cost is visible at every size.

### X31: compiler rewrites that keep every dedupe (prod, 2026-10-07)

`shape` (X17/X18/X25/X29/X30) also drops the token retry dedupe (`nodedupe`), which is only safe with retry-safe
token writes. `sk` is `shape` without that; `safe` adds the sort-order root dedupe (I7) and `cityHash64(traceId)`
keys (I13). Both keep the root and token dedupes; `spans.some` skips the span dedupe (existence can't change).
Lab: 0 mismatches in 2,880 comparisons (`sk`, `srio`, `safe`). Prod, 30 days, warm median peak MiB:

| Probe                                      | small          | mid            | p90            | p99             | largest         |
| ------------------------------------------ | -------------- | -------------- | -------------- | --------------- | --------------- |
| F0 as compiled / `safe` / `safe` + limit 8 | 166 / 151 / 18 | 170 / 156 / 20 | 177 / 161 / 27 | 174 / 162 / 56  | 296 / 177 / 173 |
| F3                                         | 169 / 154 / 21 | 174 / 159 / 25 | 177 / 164 / 34 | 189 / 170 / 64  | 549 / 208 / 196 |
| E1                                         | 177 / 157 / 18 | 185 / 157 / 28 | 179 / 161 / 43 | 179 / 159 / 77  | 333 / 219 / 217 |
| E3                                         | 169 / 155 / 24 | 174 / 160 / 43 | 177 / 164 / 40 | 189 / 167 / 121 | 562 / 294 / 287 |
| E4                                         | 225 / 224 / 34 | 224 / 225 / 49 | 227 / 222 / 38 | 321 / 293 / 273 | 956 / 867 / 863 |
| T1                                         | 221 / 219 / 31 | 221 / 219 / 47 | 221 / 219 / 37 | 302 / 302 / 262 | 971 / 866 / 851 |
| T3                                         | 218 / 221 / 31 | 218 / 222 / 47 | 219 / 222 / 36 | 303 / 299 / 258 | 951 / 866 / 861 |

Cold, seconds (2 reps): F0 `safe` 6–7.5 small–p90, 11 p99, 20 largest (limit 8: +1 s). F3 `safe` 16–19 small–p90,
26 p99, timeout largest; with limit 8 21–22 small–p90, timeout p99+. E4 `safe` 13–16.5 small–p90, 26 p99, timeout
largest; with limit 8 15.5–20 small–p90, timeout p99+.

- **Correction:** the E4/T1/T3 numbers in X18/X29 and the earlier "step 1" row (E4 p99 146, largest 432 MiB) used
  `shape`, i.e. without the token dedupe. With every dedupe kept, compiler changes don't move token/cost at p99+.
- Sort-order dedupe + integer keys are the useful additions for non-token cases on large projects (largest, with limit 8: F3
  338 → 196, E3 464 → 287 MiB vs `sk`).

### X32: token rows ordered by trace (local, 2026-10-07)

Idea: a projection on `mastra_metric_events` ordered by `(organizationId, projectId, traceId, metricId)` so the
`(traceId, metricId)` dedupe streams, with no MV. Results:

- ClickHouse never chose the projection: the base table's key `(org, project, name, timestamp)` already reads
  fewer marks for a 30-day token filter (97 vs 291 marks on the largest project). `force_optimize_projection_name`
  only asserts, and `preferred_optimize_projection_name` didn't switch it.
- A sorted narrow copy (what the projection holds) read directly: E4/T1/T3 largest 806–875 MiB (no change);
  `optimize_aggregation_in_order` made it worse (950–1020 MiB).
- The dedupe step alone, on the largest project: ~470 MiB (base or sorted), 360–435 MiB in order, even
  single-threaded. Roots dedupe alone: 58 MiB.
- Conclusion: ordering alone doesn't help; the X23 narrow ReplacingMergeTree read with `FINAL` (361 MiB, exact
  under retries) is the low-risk schema option for token rows. The lab's `traceId` bloom index on
  `mastra_metric_events` (X22) was dropped for this test and not re-added.

### X33: write-side facts (prod, read-only, 2026-10-07)

`prechecks.ts`, all tenants, last 7 days, counts and ratios only:

| Fact                                              | Result                                                                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Roots stored more than once                       | 437 of 542k traces (0.08%), up to 263 copies; 434 with different `endedAt`, 9 with different error state |
| Token rows stored more than once                  | 0 of 1.26M                                                                                               |
| Spans stored more than once                       | 4.4k of 5.3M (0.08%), up to 64 copies; 0 with a different name                                           |
| Token rows after the root ended                   | 4.3% (1.2% more than a minute after); every token row has a root                                         |
| Token rows in another hour than the root's start  | 1.2% of rows, 9.9% of tokens                                                                             |
| Token rows with null / different `rootEntityName` | 2.6% / 0.14%                                                                                             |
| Traces crossing an hour boundary                  | 0.37% (p50 3 s, p99 172 s)                                                                               |
| Hourly rollup rows vs roots                       | 23k vs 545k                                                                                              |
| Span-name index rows vs span rows                 | 3.8M vs 5.3M                                                                                             |
| Insert sizes, part counts                         | not visible from the read-only service                                                                   |

Consequences in [SCHEMA-PROPOSALS.md](./SCHEMA-PROPOSALS.md): I14 and I15 rejected; a roots-fed rollup must
count traces duplicate-safely; the span-name index is exact.

### X34: what the token dedupe costs, integer keys (prod + local, 2026-10-07)

Token/cost is read from `mastra_metric_events`: one row per (model call, token type), four token types, ~6 rows per
trace on the largest project. The query dedupes them on `(traceId, metricId)` before summing per trace.

Isolating that step on prod (largest project, ~2.3M token rows): grouping alone 421 MiB; grouping + `argMax` 296 MiB;

- `argMax` of a tuple 319 MiB; + `any` 296 MiB; summing per trace without the metric dedupe 76 MiB. Memory follows
  the row count being deduped; key type and aggregate choice move it little.

`hkd` (I17) keys the dedupe by `cityHash64`. Prod, warm, 30 days (MiB, reps 1–2):

| Case | p99 `safe` | p99 `hkd` | largest `safe` | largest `hkd` |
| ---- | ---------- | --------- | -------------- | ------------- |
| E4   | 293–298    | 297–304   | 872–875        | 752–771       |
| T1   | 303–305    | 289–292   | 845–854        | 766–768       |
| T3   | 299–300    | 291       | 860–867        | 758–766       |

### X35: one usage row per model call (local, 2026-10-07)

Prod facts (`prechecks.ts`, 1 day): every (span, token type) has exactly one token row (0 of 202k with more), 0 token
rows without a `spanId`; 99.3% of token rows sit on `model_generation` spans, 0.6% on `processor_run`
(rolled-up internal usage), 0.1% have no stored span. Model spans stored twice carry different `usage` (14 of 14):
spans are rewritten as usage finalizes, so per-call storage must keep the latest copy.

Lab tables (`lab.ts derive`): `mastra_model_usage` pivots token rows to one row per (trace, span): 6.9M → 1.3M rows,
391 → 75 MiB. `mastra_span_events_u` puts the same columns on span rows. Variants read them deduped per call with
`argMax(…, timestamp)` (`mcall`, `spanu`) or with `FINAL` (`mcallf`). 0 mismatches against `safe` (288 + 144).

Peak MiB, warm, 30 days (`E1-safe`, the same grouping without tokens: p99 23, largest 98):

| Case | bucket  | `safe` | `hkd` | `mcall` | `spanu` | `mcallf` |
| ---- | ------- | ------ | ----- | ------- | ------- | -------- |
| E4   | p90     | 16     | 16    | 18      | 19      | 173      |
| E4   | p99     | 187    | 174   | 72      | 77      | 169      |
| E4   | largest | 818    | 719   | 338     | 334     | 333      |
| T1   | largest | 782    | 717   | 342     | 330     | 329      |
| T3   | largest | 813    | 703   | 341     | 345     | 284      |
| T4   | largest | 111    | 110   | 111     | 113     | 280      |

Per-call storage removes ~60% of the token cost at p99 and the largest project; what is left at the largest project
is ~100 MiB for roots and grouping and ~240 MiB for the per-call dedupe of ~1M call rows. Span columns match the
table on memory but read 1.5–2× the bytes and run 1.5–5× slower. `FINAL` replaces the hash table with a merge but
costs a ~160 MiB floor at every size. The lab table is pivoted from token rows, so it doesn't model spans rewritten
with different usage; that needs the replay test in SCHEMA-PROPOSALS.md. **Correction:** keyed by span, this table loses usage when several hidden model calls roll up to one exported ancestor (`applyUsageRollup`); it matched only because the pulled data had no such collision. A real table must be keyed by a per-emission id the writer stamps.

## Recommendation (memory track)

See [SCHEMA-PROPOSALS.md](./SCHEMA-PROPOSALS.md) for risks, write-side facts (X33) and how to test the schema
changes before shipping; it supersedes steps 3–4 below where they differ (I14/I15 rejected).

Target: most projects 10–30 MiB per query, largest ≤ 256 MiB. Expected warm peaks (prod for compiler + prefetch,
lab for schema; the lab matches prod once the prefetch floor is gone):

| Step                                                                      | small–p90 (most projects) | p99         | largest     |
| ------------------------------------------------------------------------- | ------------------------- | ----------- | ----------- |
| Today                                                                     | 165–227 MiB               | 174–325 MiB | 299–964 MiB |
| 1. Compiler `safe` + limit 8 for small–p90, every dedupe kept (prod, X31) | 18–49 MiB                 | 159–302 MiB | 177–867 MiB |
| 2. Dashboard token/cost from the hourly rollup (I12)                      | 8–14 MiB                  | 10–12 MiB   | 10–12 MiB   |
| 3. Per-trace path: I8 + I9 + I14 + I15 (`arch3`)                          | 8–18 MiB                  | 12–20 MiB   | 23–35 MiB   |
| 3′. If I14/I15 can't land: I8 + I9 + I13 (`arch` + `hk`)                  | 8–19 MiB                  | 18–36 MiB   | 79–190 MiB  |

1. **Compiler (no schema change):** scope and time-bound the re-read (I2, I3), no span dedupe for `spans.some`
   (I5), root dedupe in sort order (I7), `cityHash64(traceId)` for every trace-id set and the usage join (I13).
   Drop the query-time token dedupe only together with I8 + I11.
2. **Prefetch:** `filesystem_prefetches_limit = 8` for small–p90 tenants (most projects), default above. Accept
   +30–60% cold latency there, or apply it only to queries over a cheap path (rollup hits).
3. **Dashboard rollup (I12):** answer additive token/cost/count/error queries on root dimensions from an hourly
   rollup; fall back to the per-trace path otherwise. Flat ~10 MiB at any project size. Decide hour attribution
   (root `startedAt` vs metric timestamp) and make token writes retry-safe (I11).
4. **Per-trace path:** span-name index (I9); token/cost totals on the root row (I15) or the per-trace rollup (I8);
   idempotent root and token writes so the query can skip dedupe (I14, I11). Without write-side guarantees keep
   I8 + I13 and the per-metric ReplacingMergeTree + FINAL fallback.
5. **Until 3–4 land:** cap long windows for `spans.some`/token-cost on large tenants or split them per day for
   additive measures (I16, 17–25 MiB per sub-query); add a per-query memory cap at ~2× the largest measured peak of
   the shipped path, not a fixed 512 MiB.
6. Skip the bloom filters (I10).

Cold reads remain the open risk: `spans.some` takes 14–25 s cold even for tiny projects, and p99+ F3/E4 time out
cold at 30 s. The schema changes read far less and should help, but need a Cloud service with that schema to verify.
