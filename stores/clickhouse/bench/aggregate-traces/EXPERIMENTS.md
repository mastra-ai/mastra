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

| ID  | Env        | Question                                                                                                                                                                               | Result (short)                                                                                                                                                     | Status |
| --- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ |
| X01 | prod       | Baseline: latency/bytes/memory by project size                                                                                                                                         | Peak 592 MiB (non-token), 991 MiB (token/cost); ~160 MiB even for 25-trace projects                                                                                | done   |
| X02 | prod       | W1: tenant-scope the outer re-read                                                                                                                                                     | Bytes ×0.13–0.5 (small–p99), ×0.84 largest; memory ×0.9–1.4                                                                                                        | done   |
| X03 | prod       | `quantileExact` vs `quantileDeterministic`; `uniq` vs `uniqExact`                                                                                                                      | No material difference                                                                                                                                             | done   |
| X04 | prod       | `max_threads = 2` (t2)                                                                                                                                                                 | Memory ×0.91–1.02, often slower                                                                                                                                    | done   |
| X05 | prod       | External GROUP BY/sort at 256 MiB (spill)                                                                                                                                              | E4 largest ×0.65 memory but ×3.8 latency; elsewhere no gain                                                                                                        | done   |
| X06 | prod       | Dedupe token rows on `metricId` only (mkey)                                                                                                                                            | Memory ×0.98–1.03                                                                                                                                                  | done   |
| X07 | prod       | Diagnostic: no retry dedupe (nodedupe) / no `costMetadata` parse (nocm)                                                                                                                | nodedupe ×0.47 largest, ×0.86 p99; nocm ×0.96–0.98                                                                                                                 | done   |
| X08 | prod       | `FINAL` instead of manual dedupe                                                                                                                                                       | Worse: 986–1209 MiB largest                                                                                                                                        | done   |
| X09 | prod       | Is the floor tied to parts/granules selected?                                                                                                                                          | 30d scoped count selects 268/268 parts before PK; `endedAt` bound cuts to 19 parts, 156 → 55 MiB                                                                   | done   |
| X10 | prod       | What sets the ~160 MiB floor? (meter, columns, settings)                                                                                                                               | `SELECT 1` 7.5 MiB; floor independent of columns/threads/blocks/buffers; prefetch off → 8.5 MiB                                                                    | done   |
| X11 | prod       | Which prefetch setting? Effect on full queries                                                                                                                                         | Prefetched read pool is the floor; both off is best (small F0 10, E4 28, F3 16 MiB)                                                                                | done   |
| X12 | prod       | Cold (object-storage) latency with prefetch off                                                                                                                                        | Small: no cost. p99 +30–40%, largest F0 times out (>30 s vs 22 s). Prefetch limit 8 sits between                                                                   | done   |
| X13 | local      | Stage-by-stage CTE breakdown                                                                                                                                                           | Memory jumps at the span dedupe (F3) and the token usage dedupe (E4); root stages are cheap                                                                        | done   |
| X17 | local      | Query-shape rewrites (`rs`, `r1`, `sp`, `shape`): equivalence and memory                                                                                                               | 0 mismatches in 3,096 comparisons; `r1` does nothing; `sp`/`shape` cut p99 F3 128 → 48 MiB                                                                         | done   |
| X18 | prod       | Shape rewrites ± prefetch limit vs the 32–64 / 256 MiB budget                                                                                                                          | Small and p99 F0/F3 within budget; E4 p99 139 MiB; largest 242–432 MiB, still over 256 for F3/E4                                                                   | done   |
| X14 | local      | Lab calibration: does local reproduce shape memory?                                                                                                                                    | Yes, within ~10–20% of prod with prefetch off (small/p99 F0, E4, F3; largest E4 820 vs ~930 MiB)                                                                   | done   |
| X15 | prod       | Duplicate rate of token metric rows (does the retry dedupe ever fire?)                                                                                                                 | 0 duplicate `metricId`s in 30 days for all 15 projects (up to 2.06M token rows)                                                                                    | done   |
| X16 | prod       | Keep prefetch but bound it (`filesystem_prefetch_max_memory_usage`, `filesystem_prefetches_limit`, `prefetch_buffer_size`)                                                             | Only `filesystem_prefetches_limit = 8` works: small count 12 MiB, F0 23–27, E4 42; p99 F0 52                                                                       | done   |
| X19 | local      | Root dedupe in sort-key order (`rio`); join algorithms                                                                                                                                 | `rio` cuts largest E3 ~42%, F0 ~17%, 0 mismatches; only `partial_merge` join helps E4 (×0.87)                                                                      | done   |
| X20 | local      | Usage rollup + span-name index (`urollup`, `snidx`, `arch`) on pulled data                                                                                                             | 0 mismatches in 1,320 comparisons; `arch` largest E4 294, F3 115, E1 134 MiB                                                                                       | done   |
| X21 | local      | Rollup keyed by `cityHash64(traceId)`; FINAL read; dropping the `IN candidates` filter                                                                                                 | UInt64 key ×0.75–0.85 memory; FINAL no gain; dropping the filter changes results                                                                                   | done   |
| X22 | local      | `traceId` bloom filters                                                                                                                                                                | No memory change; bytes drop only for small tenants on the unscoped base re-read                                                                                   | done   |
| X23 | local      | Retries vs write-time rollups; per-metric ReplacingMergeTree + FINAL; insert dedup tokens                                                                                              | Rollup double-counts retries; per-metric FINAL exact at ~355 MiB; dedup keeps the MV exact                                                                         | done   |
| X24 | local      | Concurrency: 10/25/50 parallel non-largest queries, base vs `arch`                                                                                                                     | Server peak at 50: +722 MiB → +392 MiB; no failures                                                                                                                | done   |
| X25 | prod       | Cold reads for `shape` and `shape + limit 8`                                                                                                                                           | `shape` lets small/p99 F3/E4 finish cold; limit 8 pushes p99 F3/E4 over 30 s; largest F3/E4 time out cold                                                          | done   |
| X26 | local      | Hourly token/cost rollup for dashboard queries (`hourly`)                                                                                                                              | 8–14 MiB at every size; largest E4 882 → 12 MiB; 0 mismatches in 264 comparisons                                                                                   | done   |
| X27 | local      | Integer trace keys, no root dedupe, usage on the root row (`hk`, `nord`, `arch2`, `arch3`)                                                                                             | `arch3` largest 23–35 MiB for every measured case; 0 mismatches (2,880 + 960)                                                                                      | done   |
| X28 | local      | One day of a 30-day query (per-day split)                                                                                                                                              | Largest `shape` 1-day 17–25 MiB vs 228–315 MiB for 30 days                                                                                                         | done   |
| X29 | prod       | mid and p90 with `shape` and `shape + limit 8`, warm and cold                                                                                                                          | Warm F0/F3 20–28 MiB, E4 36–42 MiB; cold all finish, 8–30 s                                                                                                        | done   |
| X30 | prod       | Prefetch limit 4/8/16/32, warm and cold, small–p99                                                                                                                                     | Memory rises with the limit (8 ≈ 4 < 16 < 32); cold latency about the same for every limit; p99 F3/E4 cold time out at all four                                    | done   |
| X31 | prod       | Compiler rewrites that keep every dedupe (`sk`, `safe` = sk + sort-order dedupe + integer keys), ± limit 8, warm and cold                                                              | Non-token small–p90 18–43 MiB; token/cost stays 34–49 / 293–302 / 866 MiB (p90 / p99 / largest); 0 mismatches in 2,880                                             | done   |
| X32 | local      | Trace-ordered projection / copy of token rows so the `(traceId, metricId)` dedupe streams                                                                                              | Projection never chosen; sorted copy alone 806–875 MiB, in-order aggregation worse; the dedupe alone is ~470 MiB                                                   | done   |
| X33 | prod       | Write-side facts for schema proposals (`prechecks.ts`, all tenants, 7 days)                                                                                                            | Roots rewritten (0.08% of traces, up to 263 copies); 0 duplicate token rows; span names never change; 4.3% of token rows after the root ends                       | done   |
| X34 | prod+local | Integer keys for the token retry dedupe; what the dedupe costs                                                                                                                         | Dedupe memory follows the number of token rows, not key type or aggregate: −11% at largest                                                                         | done   |
| X35 | local      | One usage row per model call: separate table, span columns, `FINAL` read                                                                                                               | Per-call table ×0.41 at largest; `FINAL` read adds a ~160 MiB floor (rejected)                                                                                     | done   |
| X36 | prod       | Real Platform read traffic from `query_log` across compute groups (`traffic.ts`, 2.3 days)                                                                                             | Cold reads are rare (≤5% of reads touch object storage, p99 1.6 s); the read-ahead floor makes 8% of 256 MiB-capped span reads fail                                | done   |
| X37 | prod       | mobs-query's own read paths, today's settings vs platform#3407 (`mobs-ab.ts`, 33 operations, 15 projects)                                                                              | Warm: same latency, 3–4× less memory, no failures. Forced-cold: 2–4× slower; 43 of 230 cold reads hit the 9 s limit, 39 already took > 9 s                         | done   |
| X38 | prod       | Where cold `spans.some` time goes; span and root time bounds under one root per trace                                                                                                  | Span scan was never the bottleneck; the unscoped root re-read is. `w1` gives most of the cold win, `rs` more at 7d, `spb` nothing                                  | done   |
| X39 | prod       | Largest-project `spans.some` memory across #26327, OBS-589 and OBS-613, stage by stage (`floor.ts` `mr-*` probes)                                                                      | No rise from #26327 on the same project; the reported 204→362 MiB compared two projects. OBS-613 is ~10% lower; memory is spans + semi-join                        | done   |
| X40 | prod       | OBS-591 read caps (1 GiB memory, 256 MiB result, 16 GiB read) replayed: `query_log` what-if, mobs-query A/B, source reads, heavy reads                                                 | 58 of 82,819 reads stopped, all giant-payload trace reads; mobs-query unchanged; a 3.8 GiB read stops at 1 GiB in 0.4 s; raw E4 at the cap                         | done   |
| X41 | prod       | OBS-515 `aggregateTraces()` on mobs-query (`mobs-aggregate.ts`): 4 projects × 7/30 d, project and org-wide, token fallback D0/D1/D2, 7–180 d sweep                                     | All cells but one under 1 GiB; `spans.some` on the largest org at 30 d hits 241 before #3540 and 810 MiB on `main` after it; token fallback 400 MiB window-bounded | done   |
| X42 | prod       | OBS-666 group-by dimension audit (`mobs-dimensions.ts`): cardinality and fill of per-trace root columns, one grouped request per dimension, p99/largest × 7/30 d, project and org-wide | The dimension is never the cost: every cell within 0–15% of ungrouped (max 468 MiB, 4.1 s). Most context columns are empty on Platform                             | done   |
| X43 | prod       | OBS-516 un-flagging check: live `/traces/aggregate` traffic (`live.ts`) and 150 cells (`mobs-live.ts`): A grid, Ex1–4, 365 d, high-cardinality, `interval`, exact percentiles          | No failures (max 424 MiB / 3.6 s; live 593 MiB). Org-wide `spans.some` on largest 816–855 MiB, 8.4 s at 365 d. Cold timeouts = the list's floor                    | done   |

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

### X43: `/traces/aggregate` before un-flagging: live traffic and a controlled load (prod replica, read-only, 2026-10-16)

**Question.** OBS-516: is `POST /traces/aggregate` safe to take out from behind `platform-trace-aggregate-api`? What does real traffic since platform#3547 cost, and what do the requests un-flagging exposes (OBS-666's grouped view, the decisions doc's examples 1–4, 365-day windows, high-cardinality `groupBy`, `interval`, `countDistinct`) cost on the largest tenants? Should duration percentiles stay approximate?

**Method.** Platform code is `/tmp/platform-516` = `origin/main` `c1f79da5d`. The deployed mobs-query revision (`mobs-query-01398-5mz`, `d40fb5638`) is an ancestor with no diff in `services/`, `routes/` or the Core pin. Same guarded client, host guard, read-only check, `max_threads=16` and project selection as X41/X42. One statement at a time.

- `live.ts scan|report|recheck`: Cloud Run request logs for the path, plus `system.query_log` on every replica. mobs-query sets no `log_comment` or `query_id`, so statements are found by the compiler's fingerprint (a `facts` CTE over `mastra_trace_roots`). The request shape (dimensions, measures, `interval`, window, scope, `spans.some`, root filter, `having`/`orderBy`, usage source) is parsed back from the logged SQL, where ClickHouse has substituted the parameters. Tenants are written only as salted hashes. `recheck` re-runs the latest statement of the 3 costliest shapes and compares `read_rows`.
- `mobs-live.ts sizes`: root rows per org over 1/7/30/92/365 d, and token rows (usage table and the fallback's `metric_events`) over 30/92 d.
- `mobs-live.ts run`: 150 cells from `buildCells()`, for p99 and largest, per project and org-wide.
  - A: OBS-666 grouped view by `entityName`/`status`/`environment`/`entityType` (`projectId` org-wide only), `count, errorRate, duration.p50, duration.p95, tokens.input.sum, tokens.output.sum, cost.sum`, top 50, at 1/7/30 d.
  - B: Ex1–Ex4 as written (tenant's real environment, top tool name and top metadata key); `365:entityName` (A at 365 d) and `365:count`; `card:<threadId|userId>:<100|1000>` at 30/365 d; `iv:` two-stage `interval` cells; `cd:` `countDistinct.threadId` + `countDistinct.userId` by `entityName` and by `threadId`; `pct:` percentile cells.
  - Arms as X41: `measure` (compiled SQL, 4 GiB / 60 s, one warm-up + 3 warm reps) and `svc` (`aggregateTraces()` itself, 1 GiB / 9 s, once warm, and once cold with `enable_filesystem_cache = 0` first on cells of 30 d+, and 7 d+ for largest). About 1,070 statements.
  - Percentile cells also run `measure` with `quantileDeterministic(p)(durationMs, traceSeed)` swapped for `quantileExact`, `quantileExactInclusive` and the fused `quantiles*` forms, and record how far each group's p95 is from the approximate one.
- `mobs-live.ts parity` (ungrouped `count` vs the `queryTraces()` page total) and `cold` (forced-cold control, see below). X41's shape C re-run with `mobs-aggregate.ts --label obs516`.
- Thresholds, on the service caps: **fail** = any error, or warm median over 9 s or 1 GiB. **Close** = warm median over 6 s or 768 MiB, or a cold timeout.

**Live traffic, 2026-10-15 16:24 → 2026-10-16 18:25 UTC (US).**

- Cloud Run: 208 requests to `/traces/aggregate`: 176 × 200, 16 × 400, 6 × 422, 3 × 401, 7 × 204 (CORS preflights). **No 404s on this path.**
  - Until 17:00 on the 16th, all came from one IP with user agent `node` (a script).
  - From then on, Studio in browsers also called it: 6 POSTs from `projects.mastra.ai` and 11 from the OBS-666 preview deploy, all 200.
  - Two orgs; every request they made succeeded, so both hold the flag. No request was turned away by the flag (it would show as 404). PostHog wasn't read.
- **The "4 unexplained 404s"** are not on this path. They are `GET /traces/{traceId}` 404s for one trace id at 16:30:42–16:31:45 on the #3547 revision. That was just before the script's first aggregate call at 16:32:19, so it is consistent with a client polling a trace before ingestion caught up. The other 404s in the window are unrelated routes mobs-query doesn't serve (`/api/scores/scorers`, `/api/datasets`, `/api/mcp/v0/servers`).
- **EU is not covered.** EU production deploys are off by default (`_DEPLOY_PRODUCTION_EU = 'false'` in `cloudbuild.yaml`), and this account has no access to `eu-mastra-cloud`.
- `query_log`: **176 aggregate statements, exactly one per 200**, 0 failed.
  - Time p50/p95/max: 232 / 513 / 1,424 ms. Memory p50/max: 269 / 593 MiB. Up to 3.7 GiB read, up to 51 result rows.
  - Every one used the token fallback.
  - The shapes are the A grid: org-wide `projectId` × `entityName`/`entityId`, ≤ 7 d until 17:00, then ≤ 31 d.
  - Only 4 of 176 touched object storage and none was mostly cold (X36's buckets).
- `recheck`: the logged statements re-run with `read_rows` within 0.02–0.03% (rows ingested late into the window).

**Sizes and parity.**

- 1,133 orgs have roots in the last 365 d, 855 in the last 30.
- The X41/X42 picks still hold at 30 d+: largest is #1 with 696,084 roots at 30 d (712,153 at 92 d); p99 is #8. One other org is above half the largest at 30 d; at 7 d it is larger than "largest".
- **92 d and 365 d root counts are identical for every org**: `mastra_trace_roots` holds about 3 months. So a 365-day request reads what a 92-day one does today and will grow until the 6-month TTL.
- `mastra_model_usage` is nearly empty (largest: 8,390 rows / 30 d vs 1.53 M fallback token rows), so the fallback path is what token/cost requests cost.
- Parity: ungrouped `count` equals the `queryTraces()` total in 4/4 checks (largest org-wide 30 d: 695,466).

**Controlled load, warm `measure` median (MiB / s).** `svc` is the service call on the largest org; `rows` is result rows on the largest org (`+` = truncated).

| case                 | days | p99 project | p99 org   | largest project | largest org   | largest org svc s | largest org read MiB | rows  |
| -------------------- | ---- | ----------- | --------- | --------------- | ------------- | ----------------- | -------------------- | ----- |
| `A:entityName`       | 1    | 109 / 0.1   | 112 / 0.1 | 118 / 0.1       | 102 / 0.2     | 0.2               | 114                  | 51+   |
| `A:entityName`       | 7    | 129 / 0.3   | 158 / 0.4 | 102 / 0.2       | 193 / 0.5     | 0.5               | 485                  | 51+   |
| `A:entityName`       | 30   | 179 / 0.6   | 219 / 0.9 | 339 / 2.1       | 379 / 3.2     | 3.1               | 3,714                | 51+   |
| `A:status`           | 30   | 174 / 0.6   | 214 / 0.9 | 339 / 2.1       | 368 / 3.2     | 3.0               | 3,692                | 2     |
| `A:environment`      | 30   | 180 / 0.7   | 222 / 0.8 | 328 / 2.1       | 373 / 3.1     | 3.0               | 3,692                | 4     |
| `A:entityType`       | 30   | 168 / 0.6   | 226 / 0.9 | 342 / 2.1       | 379 / 3.2     | 3.2               | 3,693                | 6     |
| `A:projectId`        | 30   | –           | 210 / 0.9 | –               | 385 / 3.2     | 3.1               | 3,693                | 29    |
| `Ex1`                | 62   | 149 / 0.3   | 214 / 0.3 | 346 / 1.3       | 299 / 1.0     | 1.0               | 484                  | 1278+ |
| `Ex2`                | 31   | 71 / 0.1    | 49 / 0.2  | 190 / 0.6       | 145 / 0.8     | 0.7               | 429                  | 11+   |
| `Ex3`                | 31   | 125 / 0.6   | 153 / 0.8 | 386 / 2.5       | 239 / 2.1     | 3.0               | 1,861                | 101+  |
| `Ex4`                | 92   | 190 / 0.9   | 260 / 1.5 | 336 / 2.2       | **424 / 3.6** | **4.5**           | 4,181                | 369+  |
| `365:entityName`     | 365  | 197 / 0.9   | 259 / 1.5 | 326 / 2.4       | 423 / 3.4     | 3.5               | 4,210                | 51+   |
| `365:count`          | 365  | 81 / 0.1    | 55 / 0.4  | 205 / 0.6       | 115 / 0.8     | 0.8               | 432                  | 1     |
| `card:threadId:1000` | 30   | 77 / 0.2    | 107 / 0.3 | 210 / 0.8       | 166 / 0.7     | 0.7               | 442                  | 1001+ |
| `card:threadId:1000` | 365  | 104 / 0.2   | 112 / 0.4 | 230 / 0.7       | 166 / 0.8     | 0.8               | 472                  | 1001+ |
| `card:userId:1000`   | 365  | 103 / 0.2   | 112 / 0.4 | 234 / 0.6       | 161 / 0.9     | 1.1               | 468                  | 2     |
| `iv:entityName:1h`   | 7    | 55 / 0.0    | 59 / 0.1  | 51 / 0.0        | 129 / 0.2     | 0.2               | 54                   | 3450+ |
| `iv:entityName:1d`   | 30   | 87 / 0.1    | 143 / 0.3 | 202 / 0.7       | 260 / 0.7     | 0.7               | 454                  | 720+  |
| `iv:entityName:1d`   | 365  | 108 / 0.2   | 161 / 0.4 | 222 / 0.7       | 269 / 0.8     | 0.9               | 484                  | 481+  |
| `iv:threadId:1d`     | 30   | 80 / 0.1    | 160 / 0.4 | 184 / 0.7       | 268 / 0.8     | 0.8               | 442                  | 631+  |
| `cd:entityName`      | 365  | 104 / 0.2   | 119 / 0.4 | 201 / 0.7       | 167 / 0.9     | 0.7               | 475                  | 101+  |
| `cd:threadId`        | 365  | 117 / 0.1   | 113 / 0.4 | 206 / 0.6       | 172 / 0.8     | 1.0               | 451                  | 1001+ |

Not shown: the rest of A at 1/7 d (95–195 MiB, ≤ 0.6 s), limit-100 `card:` cells (same as limit 1000), and `pct:` cells (below). Full table: `results/mobs-live-report.txt`.

- **No warm or service call failed in 150 cells.** The highest warm median is 424 MiB / 3.6 s and the slowest service call 4.5 s, both `Ex4` on the largest org: 41% of the memory cap, 50% of the time cap.
- No grid cell is close on warm numbers. High-cardinality `groupBy` (41k threads), 1,000-row limits, `countDistinct` over threads and users, and the `interval` path all stay at 51–286 MiB and ≤ 1.1 s even at 365 d.
- Cost follows the token fallback: A with tokens/cost reads 3.7 GiB at 30 d, while A without them (`card:`, `iv:`, `cd:`) reads under 0.5 GiB.
- Cost stops growing after 30 d because the data stops.

**Against X42 (36 matching A cells).** Memory is within −10% to +14% in every cell. Time is −43% to +12%, the larger drops on sub-second cells. The compiled SQL for these shapes hasn't changed since X42: the compiler diff since platform#3556 is the `entityId` column mapping and type renames. So the faster times are replica load. Spot-check cell (largest project, `entityName`, 30 d): 333 MiB / 2.45 s then, 339 MiB / 2.08 s now.

**Against X41: `spans.some` with a duration threshold.** `Ex3` filters `spans.some(name = <top tool>)` and is cheap (239 MiB org-wide). X41's shape C (`spans.some(spanType = tool_call AND durationMs > 1 s)` by `metadata.<key>` + `countDistinct.threadId`) matches far more spans. Re-run on today's code:

| scope (largest) | window | cold (svc)    | warm MiB med/max | warm s | read MiB | svc                 |
| --------------- | ------ | ------------- | ---------------- | ------ | -------- | ------------------- |
| project         | 30 d   | 159 @ 532 MiB | 570 / 577        | 5.1    | 1,786    | 569 MiB / 5.2 s     |
| org             | 30 d   | 159 @ 725 MiB | **816 / 823**    | 5.9    | 4,456    | 814 MiB / 5.7 s     |
| project         | 365 d  | 159 @ 482 MiB | 564 / 571        | 5.4    | 1,799    | 571 MiB / 5.0 s     |
| org             | 365 d  | 159 @ 864 MiB | **855 / 861**    | 6.4    | 5,030    | **852 MiB / 8.4 s** |

The same as X41 (810 MiB / 7.3 s at 30 d, 858 MiB / 7.8 s at 180 d). This is the only **close** shape on warm numbers, and the only one where the service call came within 10% of a cap: 8.4 s of 9 s on the largest org at 365 d. Only the largest org reaches it today: the next org is 57% of its size at 30 d, and X41 had p99/heavy-p99 org-wide C at 178–203 MiB.

**Cold.** 99 of 121 forced-cold reps timed out at 9 s (159): 10/27 for the p99 project, and 28/28, 28/32 and 33/34 for p99 org, largest project and largest org. The successes took 2.0–8.5 s. That is more than X41's 20/160, so `cold` ran a control on the same tenants, filesystem cache off:

| op (cold, svc)                                   | p99 project 1 / 7 / 30 d | p99 org 1 / 7 / 30 d | largest project 1 / 7 / 30 d | largest org 1 / 7 / 30 d |
| ------------------------------------------------ | ------------------------ | -------------------- | ---------------------------- | ------------------------ |
| `queryTraces()` first page of 25 (live, no flag) | 2.1 / 5.5 / ✗            | 3.9 / ✗ / ✗          | 2.9 / 4.6 / ✗                | 6.4 / ✗ / ✗              |
| aggregate ungrouped `count`                      | 0.8 / 2.2 / 5.8          | 1.6 / 5.3 / ✗        | 0.6 / 1.7 / ✗                | 2.1 / 6.8 / ✗            |
| aggregate A `entityName`                         | 3.2 / 8.4 / ✗            | 4.2 / ✗ / ✗          | 2.5 / ✗ / ✗                  | 5.2 / ✗ / ✗              |

(s; ✗ = 159 at 9 s.) The traces list Studio loads today times out cold wherever the aggregates do. So cold timeouts are the replica's cold-read floor on 7–30 d windows (X37: 43/230 of mobs-query's own reads), not something aggregation adds. Ungrouped `count` is cheaper cold than the list. Live aggregate traffic is warm: 0 of 176 statements were mostly cold. X36 found real reads rarely are.

**Percentiles (`measure` arm, warm median MiB vs approx; p95 drift median/max over groups).**

| cell                                             | `quantileExact`            | `quantileExactInclusive`   | fused `quantilesExact` |
| ------------------------------------------------ | -------------------------- | -------------------------- | ---------------------- |
| p99 project `threadId` 365 d                     | +2.8%; 4.1% / 62%          | −11.6%; 0% / 1.6%          | +8.8%                  |
| largest org `threadId` 365 d (1,001 groups)      | +4.4%; 12.1% / 82%         | +9.5%; 0% / 2.6%           | −6.4%                  |
| largest org `entityName` × `1d` 365 d (481 rows) | −2.2%; 0.8% / 85%          | −0.5%; 0% / 4.7%           | −11.2%                 |
| largest org ungrouped 30 d / 365 d               | +6.4% / −4.6%; 0.3% / 0.9% | −7.2% / −6.8%; 0.3% / 0.8% | +5.1% / −2.5%          |
| p99 project ungrouped 30 d / 365 d               |                            | +0.5% / +2.0%; 6.1% / 2.9% |                        |

- **Memory:** exact percentiles cost the same as approximate (as X03 found for the OSS store) within run-to-run noise (−12% to +10%, all under 290 MiB). Their state is 8 bytes per trace, about 5.7 MB for the largest org's 712k traces.
- **Accuracy:** `quantileExactInclusive` interpolates (R7) the way the sampler does, and agrees with it exactly for every group under the sampler's 8,192 values. The sampling error shows only on big groups: up to 4.7% grouped and 0.3–6.1% ungrouped.
- `quantileExact` (nearest rank, no interpolation) differs by up to 85% on small groups. That is a different definition of a percentile, not error.

**Conclusions.**

1. **Go on performance.**
   - 150 cells covering every case OBS-516 lists, on the two largest representative tenants, per project and org-wide, up to 365 d: no failures; the highest warm median is 424 MiB / 3.6 s.
   - 176 live statements (the script and the first Studio traffic): no failures, max 593 MiB / 1.4 s.
   - Grouping, high-cardinality `groupBy`, `interval`, `countDistinct` and long windows are not where the cost is. The token fallback is, as in X41/X42, and it is bounded.
2. **One named risk: org-wide `spans.some` with a broad span predicate on the largest org.** It is 816–855 MiB, and its service call took 5.7 s at 30 d and 8.4 s at 365 d. It passes today but is close to both caps, and replica load (X42's 7.95 s outlier) could push it to a 504. The 365-day window will grow until the 6-month TTL. It needs a deliberate request (a `spans.some` filter in the body); the grouped view doesn't send one.
3. **Cold timeouts are not an un-flagging risk.** The no-flag traces list times out cold at the same windows. Real aggregate reads are warm.
4. **Percentiles: switching to exact is cheap.** It meets the plan's rule (≤ 10% memory, under the caps on the costliest cell: +9.5%, 287 MiB). `quantileExactInclusive` keeps today's values for groups under 8,192 traces and removes up to ~6% sampling error on larger ones, with no memory cost. This is a product decision against decision 3 ("backend-native approximate"); proposed, not made here.
5. The live script found nothing the controlled load didn't. The 4 "unexplained" 404s are trace-detail polling, not aggregate requests. EU is unmeasured, and its production deploys are off by default.
6. `cases.ts` (the OSS-store cases from X1–X31) had drifted from current `@mastra/clickhouse`: the compiler now reads the window's roots once (mastra#26567/#26912), so `scope.ts`'s fragment count and several what-if variants (`w1`, `rs`, `r1`, `sp`, `hourly`) no longer apply. They now compile against a pinned copy of the store compiler at `6babc6d526f` (`compiler-2026-10-06/`), the base they were measured on. The Platform scripts are unaffected.

**Proposed follow-ups (not filed).** Every warm and service call finished inside its cap. Two things did not, or nearly did not:

- **"Cold 7–30 d trace reads exceed mobs-query's 9 s timeout (list and aggregate alike)."** Evidence: 99 of 121 forced-cold service reps hit 159, every cell of 30 d+ and the largest org at 7 d; the no-flag `queryTraces()` first page fails cold at the same windows (table above), and X37 saw 43/230. The warm reps after each failed cold rep all passed (max 4.5 s). Suggested fix: one server-side retry on 159 for read-only trace queries (the first attempt warms the cache), or a longer timeout on the first read of a window, then re-run `mobs-live.ts cold`. Real traffic is warm (0/176 mostly cold), so this does not gate un-flagging.
- **"Bound org-wide `spans.some` trace aggregates on the largest tenants."** Already tracked as OBS-664. Evidence: X41 shape C re-run, largest org org-wide 816 MiB / 5.7 s at 30 d and 852 MiB / 8.4 s at 365 d (93% of the time cap), growing with the window until the 6-month TTL. Suggested fix: cap `spans.some` aggregate windows (e.g. 31 d, the list's cap) or add X38's root time bound to the span semi-join, then re-run `mobs-aggregate.ts --requests C`.

### X42: Group-by dimensions for the Traces table (prod replica, read-only, 2026-10-15)

**Question.** OBS-666 needs an initial set of "Group by" options. Which per-trace dimensions are populated on Platform, how many distinct values do they have, and does grouping by any of them cost more than the ungrouped request?

**Method.** `mobs-dimensions.ts`, same guarded client and project selection as X41, `max_threads=16`, warm only, 3 reps. Platform code is `/tmp/platform-663` (`main` plus platform#3556, so `projectId` is groupable).

- `cardinality`: per root column, `uniq()` distinct, fill (share of traces with a non-empty value) and the share of traces covered by the top 50 groups, read from `mastra_trace_roots` (one row per trace).
- `run`: one grouped request per dimension through mobs-query's planner and compiler, measures `count, errorRate, duration.p50, duration.p95, tokens.input.sum, tokens.output.sum, cost.sum`, top 50 by count. Two arms as in X41: `measure` (compiled SQL, 4 GiB/60 s ceiling) and `prod` (`aggregateTraces()` under 1 GiB/9 s). Columns outside Core's registry (`entityId`, `spanType`, `name`, `product`) are measured by swapping the column into a compiled `entityName` statement, so they have no `prod` arm. `metadata` groups by the top observed key. `none` is the ungrouped baseline.

**Cardinality (30 d; 7 d is the same or smaller).** The p99 org has one project, so its org and project rows are identical.

| Dimension                                                       | p99 distinct / fill | largest project | largest org    | Notes                                                      |
| --------------------------------------------------------------- | ------------------- | --------------- | -------------- | ---------------------------------------------------------- |
| `entityName`                                                    | 22 / 0.65           | 5 / 1.00        | 198 / 0.98     | top 50 cover ≥ 99.7%                                       |
| `entityType`                                                    | 2 / 0.65            | 1 / 1.00        | 5 / 1.00       |                                                            |
| `status`                                                        | 2 / 1.00            | 2 / 1.00        | 2 / 1.00       |                                                            |
| `environment`                                                   | 2 / 1.00            | 1 / 1.00        | 3 / 0.98       |                                                            |
| `projectId`                                                     | 1                   | 1               | 28 / 1.00      | platform#3556                                              |
| `userId`                                                        | 19 / 0.06           | 0               | 1 / 0.00       | rarely set                                                 |
| `executionSource`                                               | 2 / 0.004           | 0               | 1 / 0.00       | rarely set                                                 |
| `serviceName`                                                   | 0                   | 0               | 1 / 0.00       | empty                                                      |
| `resourceId`, `sessionId`, `experimentId`                       | 0                   | 0               | ≤ 4 / 0.00     | empty                                                      |
| `metadata.<key>`                                                | 16 keys / 0.65      | 2 keys / 0.24   | 18 keys / 0.43 | values: 1,499 / 111,617 / 111,617 (per-request ids)        |
| `threadId`                                                      | 2,942 / 0.15        | 37,561 / 0.08   | 41,706 / 0.08  | OBS-522, out of scope                                      |
| `organizationId`                                                | 1                   | 1               | 1              | always the tenant on Platform                              |
| `entityId`                                                      | 22 / 0.65           | 5 / 1.00        | 205 / 1.00     | not in registry; tracks `entityName` 1:1 almost everywhere |
| `name`                                                          | 27 / 1.00           | 5 / 1.00        | 213 / 1.00     | not in registry; root span name                            |
| `spanType`                                                      | 3 / 1.00            | 1 / 1.00        | 7 / 1.00       | not in registry; root span type                            |
| `product`                                                       | 0                   | 0               | 2 / 0.25       | not in registry; Platform-only                             |
| `entityVersionId`, `rootEntityName`, `parentEntityName`, `tags` | 0                   | 0               | ≤ 2 / 0.00     | empty                                                      |

**Grouped request, 30 d, warm median (MiB / ms).** 7 d cells are 90–220 MiB and under 0.7 s everywhere.

| Dimension         | p99 org     | largest project | largest org |
| ----------------- | ----------- | --------------- | ----------- |
| none (baseline)   | 193 / 1,136 | 337 / 2,195     | 411 / 3,337 |
| `entityName`      | 216 / 1,146 | 333 / 2,449     | 409 / 3,275 |
| `entityType`      | 222 / 1,390 | 341 / 2,505     | 410 / 3,176 |
| `status`          | 214 / 1,176 | 332 / 1,997     | 409 / 3,251 |
| `environment`     | 223 / 1,142 | 329 / 2,378     | 395 / 3,332 |
| `projectId`       | 210 / 1,261 | n/a             | 395 / 3,438 |
| `userId`          | 226 / 898   | 332 / 2,295     | 404 / 3,510 |
| `executionSource` | 235 / 1,235 | 332 / 2,360     | 392 / 3,247 |
| `metadata.<key>`  | 251 / 1,159 | 408 / 3,102     | 466 / 3,853 |
| `entityId` (swap) | 216 / 1,094 | 338 / 2,483     | 405 / 3,619 |
| `name` (swap)     | 216 / 1,295 | 337 / 2,324     | 382 / 3,903 |
| `spanType` (swap) | 234 / 1,351 | 331 / 2,269     | 383 / 3,430 |
| `product` (swap)  | 224 / 1,332 | 327 / 2,372     | 398 / 3,581 |

Every `prod` arm succeeded, highest 441 MiB / 4.1 s (`metadata`, largest org 30 d). One `prod` outlier, `status` on the largest org at 30 d, took 7.95 s against a 3.25 s warm median; replica load, as in X41.

**Conclusions.**

1. The grouping dimension is not where the cost is. Every dimension is within 0–15% of the ungrouped request with the same measures; the cost is selection plus the token fallback (X41 D2). No dimension needs a cap, a top-N-only mode or an exclusion on performance grounds. The whole grid is under half the 1 GiB cap and the 9 s limit.
2. `metadata.<key>` is the only one that costs measurably more (+14–21%), from the `metadataSearch` map lookup and the 111k-value group set. Its values are mostly per-request ids on the largest tenant, so it is a poor default even though it fits.
3. Most context columns are empty on Platform: `serviceName`, `resourceId`, `sessionId`, `experimentId` have no values, and `userId`/`executionSource` are under 7% filled. Offering them would mostly show one "(none)" group.
4. `organizationId` is always one group on Platform, and `threadId` belongs to OBS-522.
5. `name` and `spanType` (root span) are populated and cheap but are not in Core's registry or the trace-scope filter registry; `entityId` adds nothing over `entityName`.

### X41: `aggregateTraces()` on Platform mobs-query (prod replica, read-only, 2026-10-14)

**Question.** Does OBS-515's `POST /traces/aggregate` fit mobs-query's 1 GiB / 9 s budget on real tenants, per
project and org-wide? What does the token/cost fallback to `mastra_metric_events` cost (≈96% of traces have no
`usageId` yet), and how does memory grow with the window up to prod retention (6 months)?

**Method.** `mobs-aggregate.ts` imports the platform-515 worktree's plan, SQL compiler and runner and runs them
through `guardedClient` (read-only, `log_comment`, `query_log` metrics), `max_threads=16`, 1 GiB memory limit.
Projects: p90, p99, heavy-p99 (p99 by span rows per trace), largest; each per project and org-wide for its org.
Requests: A `count, errorRate` by `entityName`, 1 d buckets; B `count, duration.p95` by `entityName` with `having`
and `orderBy p95`, limit 10; C `spans.some(tool_call, durationMs > X)` by `metadata.<top key>` +
`countDistinct.threadId`; D `tokens.input.sum, tokens.output.sum, cost.sum` by `entityName`, 1 d, by cost; E
ungrouped `count` + parity against `queryTraces()` page total. D variants on the largest project and org:
D0 usage table only, D1 fallback semi-joined to the selection, D2 fallback bounded by tenant + `timeRange.from`.
1 cold + 3 warm reps per cell, plus one run through the service (route limits, 9 s timeout). Org-wide runs on
`main` and on a scratch merge of platform#3540 (`ow3540`, the org-wide selection fix). Cells: warm median peak
MiB / seconds; ✗ = the service call failed.

**Cells (D = D1).**

| project   | window | project: A / B / C / D / E              | org `main`: C / D            | org `ow3540`: A / B / C / D / E         |
| --------- | ------ | --------------------------------------- | ---------------------------- | --------------------------------------- |
| p90       | 7d     | 8 / 7 / 10 / 63 / 6                     | 21 / 65                      | 33 / 30 / 65 / 88 / 29                  |
| p90       | 30d    | 24 / 22 / 51 / 97 / 22                  | 50 / 103                     | 41 / 38 / 97 / 178 / 38                 |
| p99       | 7d     | 53 / 42 / 116 / 137 / 37                | 101 / 132                    | 42 / 42 / 154 / 170 / 36                |
| p99       | 30d    | 83 / 67 / 148 (1.7 s) / 195 / 58        | 142 / 216                    | 164 / 55 / 178 (2.5 s) / 305 / 47       |
| heavy-p99 | 7d     | 58 / 47 / 111 / 138 / 40                | 93 / 138                     | 112 / 56 / 167 / 176 / 49               |
| heavy-p99 | 30d    | 85 / 83 / 201 (2.1 s) / 174 / 61        | 203 / 193                    | 164 / 104 / 192 / 258 / 63              |
| largest   | 7d     | 46 / 33 / 66 / 109 / 24                 | 155 / 160                    | 120 / 100 / 189 / 211 / 55              |
| largest   | 30d    | 193 / 203 / **564 (5.3 s)** / 400 / 188 | **1,124 (8.8 s) ✗241** / 598 | 245 / 144 / **820 (4.4 s)** / 588 / 117 |

Count parity with `queryTraces()` held in all 24 E checks. A, B and E stay under 460 MiB and 1 s everywhere.

**Token fallback, largest.**

| scope        | window | D0 usage only | D1 semi-join | D2 window-bounded |
| ------------ | ------ | ------------- | ------------ | ----------------- |
| project      | 7d     | 36 / 0.1 s    | 109 / 0.7 s  | 120 / 0.2 s       |
| project      | 30d    | 190 / 1.2 s   | 400 / 4.2 s  | 334 / 2.1 s       |
| project      | 180d   | 191 / 1.5 s   | 388 / 4.0 s  | 331 / 2.1 s       |
| org `main`   | 30d    | 412 / 1.2 s   | 598 / 4.9 s  | 447 / 3.3 s       |
| org `ow3540` | 30d    | 275 / 1.2 s   | 588 / 4.5 s  | 400 / 2.5 s       |
| org `ow3540` | 180d   | 285 / 1.6 s   | 648 / 6.0 s  | 410 / 3.7 s       |

D1 re-runs the selection for each semi-join (`candidates` is re-executed per reference). D2 reads the tenant's
token rows from `from` (1.9–4.0 GiB read) and lets the final join keep the selected traces; its cost depends on
token volume, not on the selection, and it is lower and faster everywhere except project/7d (+11 MiB). D2 is now
the compiled default. Before the "collapse only repeated `metricId`s" change the fallback alone peaked at
700–1,100 MiB: per-group `costUnit` min/max states over every token row, not the dedupe key type.

**Window sweep, largest (A / B / C / D2 / E).**

| scope        | 7d                 | 30d                 | 90d                         | 180d                        |
| ------------ | ------------------ | ------------------- | --------------------------- | --------------------------- |
| project      | 46/33/66/120/24    | 193/203/564/334/188 | 186/206/551/331/146         | 179/177/561 ✗504/331/155    |
| org `ow3540` | 120/100/189/172/55 | 245/144/820/400/117 | 260/148/839 (6.5 s)/406/117 | 261/154/858 (7.8 s)/410/123 |

Memory flattens after 30 d: the largest tenant's data mostly sits in the last month. Time keeps growing for C.

**Cold.** 20 of 160 cold reps hit the 9 s timeout (159), all C or D on 30 d+ for p99 and up, D0/D2 only at
90–180 d org-wide. Cold successes peak at 528 MiB. Same pattern as X37: cold reads are rare (X36) and the timeout
is the backstop.

**Org-wide rerun on `main` after platform#3540 (2026-10-15, label `main3540`).** #3540 merged as 765810b2f; the
#3547 branch was rebased onto it (no conflicts, `compileClickHouseTraceCandidates`/`Scope` signatures unchanged) and
the org-wide half re-run: p99 and largest orgs, 7/30 d, 16 threads, 1 cold + 3 warm + one service call. Warm
median MiB (seconds where ≥ 1 s):

| org     | window | A   | B   | C               | D0          | D1          | D2          | E   |
| ------- | ------ | --- | --- | --------------- | ----------- | ----------- | ----------- | --- |
| p99     | 7d     | 57  | 42  | 152             | -           | 171         | -           | 34  |
| p99     | 30d    | 159 | 58  | 184 (2.2 s)     | -           | 305 (2.7 s) | -           | 48  |
| largest | 7d     | 123 | 88  | 184 (1.0 s)     | 169         | 209         | 177         | 48  |
| largest | 30d    | 253 | 161 | **810 (7.3 s)** | 282 (1.1 s) | 612 (5.2 s) | 412 (3.1 s) | 121 |

- C on the largest org at 30 d now fits: 810 MiB warm median, 840 MiB max, service call ok (832 MiB, 6.1 s), against
  1,124 MiB and 241 on pre-#3540 `main`. It matches the `ow3540` scratch merge (820 MiB).
- Time is noisier than memory. Largest/30 d C ran 7.3 s here, 6.1 s on a C-only rerun (`main3540r`, 813 MiB) and
  4.4 s on `ow3540`; the p99/30 d C service call timed out once (9 s, 192 MiB) and passed at 2.6 s on the rerun.
  Replica load, not the plan: memory and read bytes are the same across the three runs.
- #3540 costs small orgs a little: p99/30 d C is 184 MiB / 2.2 s against 142 MiB / 1.3 s on pre-#3540 `main` (the
  extra reads the #3540 comment accepts for scopes it doesn't need to collapse).
- Count parity with `queryTraces()` held in all 4 E checks. Cold: C and D on 30 d hit the 9 s timeout (159), as before.

**Conclusions.**

1. Every p90/p99/heavy-p99/largest × 7/30 d cell is under 1 GiB per project. Org-wide, the one failure (C on the
   largest org, 30 d, 241 at 1,124 MiB) is the org-wide selection shape platform#3540 fixes: 820 MiB on the scratch
   merge, 810 MiB on `main` after it merged (rerun above). Org-wide is safe to enable behind the flag.
2. Over 500 MiB: C on the largest project/org (span dedupe + `spans.some` semi-join, the same stages as X39) and
   D1/D2 org-wide on the largest (fallback token rows). Neither grows with the window past 30 d.
3. The fallback is affordable window-bounded (≤ 410 MiB at 180 d org-wide). No token/cost window limit is needed.
4. No Platform window cap: memory is flat from 30 to 180 d; the only 180 d failure is a 9 s timeout on C, which
   returns 504 and leaves the server alone. Making `spans.some` cheaper is the span-dedupe work (OBS-610), not an
   aggregate cap.
5. Done 2026-10-15: rebased on #3540 and re-ran the org-wide half on `main` (above). Largest-org C at 30 d is the
   closest cell to the budget on time (6–7 s warm under load), not memory.

### X40: OBS-591 read guardrails replayed against production (prod replica, read-only, 2026-10-13)

**Question.** Platform's observability reads get per-query caps: `max_memory_usage` 1 GiB, `max_result_bytes`
256 MiB and `max_bytes_to_read` 16 GiB (all throw), plus a server-side `max_execution_time` on source reads. Which
real reads would these stop, do mobs-query's own reads change, and does a runaway read actually get cut short?

**Method.** `guardrails.ts` what-if over every `query_log` read of the observability tables (12.7 h, 82,819
reads, clients told apart by their settings). `mobs-ab.ts run --pair guardrails`: platform#3407 settings (A)
vs those plus the caps (B) through mobs-query's real service functions, 33 operations, 15 projects, 1 cold + 3
warm reps per arm (1,840 calls). `read-ab.ts --source`: platform#3446 source settings vs those plus the caps and a
9 s timeout, on the entity-signals per-trace shapes and the cleanup tenant listing. `read-ab.ts --big-trace`:
the per-trace reads of the heaviest-payload trace in the window where production went over 1 GiB, across
`max_threads`/`max_block_size` and today-vs-caps. `heavy-proof.ts`: Q0, Q3, E4 on the largest project, 30 d.

**What-if (reads the caps would have stopped).**

| client                             | reads  | > 1 GiB memory | > 16 GiB read | > 256 MiB result | max memory |
| ---------------------------------- | ------ | -------------- | ------------- | ---------------- | ---------- |
| agent-learning `traceReadSettings` | 48,066 | 0              | 0             | 0                | 247 MiB    |
| source reads, no settings yet      | 19,742 | 56             | 0             | 0                | 1,655 MiB  |
| mobs-query interactive             | 14,887 | 2              | 0             | 0                | 1,633 MiB  |
| cleanup `/tenants` (exempt)        | 124    | 124            | 0             | 0                | 2,153 MiB  |

All 58 non-cleanup reads over 1 GiB are per-trace span reads that started at 20:06 UTC, while one project ingested
a trace with 1,972 spans and 502 MiB of payload. They return little (≤491 rows, ≤68 MiB; the two mobs-query
reads 64 rows, 2.6 MiB) but read 641–912 MiB of neighbouring rows' payloads. The 56 source reads ran at
read-ahead 200 (platform#3446 not deployed); the same span-stats shape on that data measures 214–340 MiB at
read-ahead 8. Entity-signals is in beta and these reads are allowed to fail.

**The heavy trace itself.**

| read (502 MiB-payload trace)                  | memory                                | time   | result    |
| --------------------------------------------- | ------------------------------------- | ------ | --------- |
| span stats, threads 16 → 1                    | 340 → 214 MiB                         | < 1 s  | 1 row     |
| spans, threads 16 → 1                         | 3.8 → 2.7 GiB                         | ~50 s  | 1,069 MiB |
| trace detail, threads 16 → 1                  | 3.4 → 2.7 GiB                         | ~50 s  | 803 MiB   |
| trace detail, `max_block_size` 128, 4 threads | 1.9 GiB                               | ~50 s  | 803 MiB   |
| trace detail, today                           | 3.8 GiB, 241 at the 4 GiB profile cap | 4.3 s  | —         |
| trace detail, OBS-591 caps                    | 985 MiB, 241                          | 0.37 s | —         |

No thread or block setting brings it under 1 GiB, and its response alone is over the 256 MiB result cap; it
cannot be shown today either (9 s mobs-query timeout). The cap turns a 3.8 GiB, multi-second read into one
stopped at 1 GiB in under 0.4 s.

**mobs-query, A vs B (caps).** 0 limit errors in either arm. Warm latency B/A median 0.996 (p10 0.91, p90 1.05),
memory identical, max peak 610 MiB. The only failures are 9 s timeouts (159) in both arms: cold A 59, B 67 of
230, split both ways per operation; warm A 1, B 2 of 690 (all `branches_page`, small project).

**Source reads.** p99 and largest per-trace shapes (span stats, spans, version) are unchanged within noise
(15–81 MiB). The cleanup tenant listing is stopped at 1,023 MiB after 1.2 s (1,942 MiB, 8.7 GiB read uncapped),
which is why the cleanup client stays exempt.

**Largest project, 30 d.**

| case                        | today               | with caps           |
| --------------------------- | ------------------- | ------------------- |
| Q0 `queryTraces()`          | 528–536 MiB, ok     | 523–524 MiB, ok     |
| Q3 `spans.some`             | 635–640 MiB, ok     | 630–631 MiB, ok     |
| E4 token/cost on raw tables | 1,022–1,040 MiB, ok | 1,019–1,023 MiB, ok |

The aggregate bench's Q0 `queryTraces()` baseline peaks at 528–536 MiB on the largest project; the keyset/delta shapes
measured in the trace-query bench (QX02/QX14) reached 2.9–4 GiB on prod and are what the cap stops. E4 on the raw tables now
sits at the 1 GiB cap (991 MiB in FINDINGS, data has grown): a raw-table token aggregate over 30 d on the largest project will start failing with 422. Token/cost aggregates for large
projects need the per-call usage table (`mastra_model_usage`, 338 MiB in X35) before they ship.

**Conclusions.**

1. 1 GiB stops nothing legitimate in mobs-query's measured paths, and stops the reads that take a third of a
   node: giant-payload trace reads and the reads they drag along while their parts are unmerged.
2. The result and read caps stop nothing in 82,819 production reads; they are backstops.
3. E4-style raw-table token aggregates are at the cap on the largest project; route them through
   `mastra_model_usage` (OBS-593 u4).
4. After deploy: re-run `guardrails.ts` and count 241/422/503 by client.

### X39: largest-project `spans.some` memory, stage by stage (prod replica, 2026-10-13)

**Question.** X38 reported F3 (`spans.some`) warm memory on the largest bucket rising from 204 to ~362 MiB under the
root fixes (#26327 `w1`, `rs`, `rsb`), and a later run reported OBS-613 (`oneRootPerTrace` for aggregates) bringing it
back to 187/289 MiB. Is the rise real, and where does the memory go?

**Correction first.** Both comparisons mixed projects. `run.ts` runs base on all three largest-bucket projects and
variants only on the representative one (`a62771ca`, 434k traces/30d); the 204 MiB was the median of a different,
smaller project (`40b45a96`, 292k). Per project, from the Oct 9 records:

| a62771ca, warm median | 7d      | 30d     |
| --------------------- | ------- | ------- |
| before #26327 (base)  | 364 MiB | 551 MiB |
| #26327 (`w1`)         | 368 MiB | 548 MiB |
| `rsb`                 | 362 MiB | 549 MiB |
| OBS-613               | 320 MiB | 501 MiB |

So there was no rise on the largest project, and OBS-613's "187/289" was also a cross-project median.

**Method.** `floor.ts` `mr-F3-*` probes on the two checkouts (pre-#26327 code with `base`/`w1`, and OBS-613 stacked on
OBS-589): F3 in full, with `filesystem_prefetches_limit = 8`, and cut at each CTE (`stageQuery`). Representative
project of the p99 and largest buckets, 7d and 30d, 4 reps, rep 0 dropped. Memory is the summary header's
`memory_usage`; a `query_log` cross-check (`is_initial_query`, no secondary queries) agrees.

**Results (warm median MiB / MB read).**

| largest                       | pre-#26327 | #26327    | OBS-613   |
| ----------------------------- | ---------- | --------- | --------- |
| 7d full                       | 373 / 678  | 371 / 494 | 334 / 399 |
| 7d, roots stage               | 187 / 175  | 238 / 81  | 184 / 29  |
| 7d, + span dedupe             | 257 / 466  | 258 / 374 | 256 / 320 |
| 7d, + candidates (semi-join)  | 368 / 676  | 371 / 493 | 328 / 387 |
| 30d full                      | 558 / 1015 | 554 / 825 | 504 / 660 |
| 30d, roots stage              | 277 / 246  | 256 / 151 | 183 / 62  |
| 30d, + span dedupe            | 389 / 700  | 390 / 606 | 393 / 516 |
| 30d, + candidates (semi-join) | 550 / 1011 | 556 / 821 | 505 / 638 |
| 30d full, prefetch limit 8    | 553        | 551       | 503       |

| p99                        | pre-#26327 | #26327 | OBS-613 |
| -------------------------- | ---------- | ------ | ------- |
| 7d full                    | 180        | 232    | 192     |
| 30d full                   | 189        | 277    | 192     |
| 30d full, prefetch limit 8 | 155        | 146    | 132     |

**Conclusions.**

1. On the largest project #26327 did not raise memory, and OBS-613 lowers it ~10% (334/504 vs 373/558 MiB).
2. #26327 did raise memory on the p99 project (180→232 at 7d, 189→277 at 30d), at the root and candidate stages.
   OBS-613 takes it back to ~192 MiB.
3. At the largest project the memory is in the span stages, not the roots: the span dedupe (`LIMIT 1 BY dedupeKey`
   over every span of the candidate traces) adds ~70–210 MiB, and the semi-join into candidates adds another
   ~70–110 MiB. No root-selection change touches either.
4. The prefetch limit removes the read-ahead floor at p99 (−60 MiB) but does nothing at the largest project: that
   memory is query data, not buffers.
5. `spans.some` on the largest project needs ~500 MiB at 30d with any of these root strategies. That matters for
   OBS-591 guardrails and is a span-side problem; X38's `spcolsnd` (no span
   dedupe, exact for name-only predicates) cut it 20–30%.

### X38: where cold `spans.some` time goes, and time bounds under one root per trace (prod replica, 2026-10-09)

The team ruled that a trace with more than one root span is a bug, so query shapes may assume one root per trace.
Under that rule a trace's spans start after its root, and the root started at or after the window start.

- **Clock skew** (`span-index.ts --only skew,skew-detail`, single-root traces, 1 day, 73,792 traces): 56 spans in
  26 traces end before their root starts. In single-root traces the gap is always under 1 s. Spans ending an hour
  or more early only occur in multi-root traces.
- **Narrower span columns** (`spcols`/`spcolsnd`, 80 combinations): same bytes as today at every size. ClickHouse
  already skips unread columns. Dropping the span dedupe saves 20–30% only at the largest project.
- **`EXPLAIN indexes = 1`** (`explain-parts.ts`, counts only): the span scan's primary key already narrows it to
  ~220 granules (small) / ~16k (largest) of 157k. The cost is `mastra_trace_roots`: the unscoped outer re-read
  selects 6,534 of 6,568 granules for a 25-trace project. Tenant scope (`w1`, mastra#26327) cuts that to 147. A
  time bound as well (`rs`) cuts it to 74 and prunes parts 297 → 88.
- **Exactness** (`span-bound.ts`, in-SQL digest, F0/F3/Q3 × 7d/30d × 15 projects): `spb` 60/60 match. `rsb`
  86/90 match. The 4 mismatches are all one largest project with 148 multi-root traces whose other root falls
  outside the window (the bug).

Cold s (median over projects; TO = 30 s limit) | warm ms | MB read | warm MiB:

| Case   | Bucket  | base                   | `w1`                   | `rs`                   | `rsb` (= `rs` + `spb`) |
| ------ | ------- | ---------------------- | ---------------------- | ---------------------- | ---------------------- |
| F0 7d  | small   | 14.3 / 203 / 103 / 166 | 4.4 / 115 / 5 / 180    | (= `rsb`)              | 2.8 / 43 / 2 / 184     |
| F0 7d  | largest | 20.8 / 356 / 132 / 180 | 8.1 / 158 / 49 / 215   | (= `rsb`)              | 10.1 / 246 / 72 / 240  |
| F0 30d | largest | 26.0 / 604 / 215 / 202 | 12.6 / 330 / 123 / 255 | (= `rsb`)              | 23.6 / 699 / 155 / 253 |
| F3 7d  | small   | TO / 540 / 209 / 169   | 16.1 / 401 / 12 / 195  | 7.4 / 201 / 7 / 193    | 5.7 / 189 / 6 / 192    |
| F3 7d  | p99     | TO / 647 / 280 / 180   | 15.4 / 336 / 86 / 236  | 8.9 / 251 / 79 / 214   | 8.2 / 276 / 56 / 211   |
| F3 7d  | largest | TO / 805 / 350 / 204   | TO / 851 / 490 / 367   | 25.2 / 812 / 469 / 362 | TO / 993 / 440 / 362   |
| F3 30d | small   | TO / 607 / 213 / 169   | 16.3 / 338 / 17 / 195  | 14.4 / 348 / 17 / 174  | 18.9 / 335 / 18 / 176  |
| F3 30d | p99     | TO / 952 / 371 / 190   | 22.3 / 451 / 174 / 265 | 23.9 / 448 / 174 / 229 | 27.9 / 741 / 167 / 234 |
| F3 30d | largest | TO / 1541 / 619 / 349  | TO / 2260 / 821 / 549  | TO / 2196 / 828 / 549  | TO / 2379 / 852 / 549  |

Q3 tracks F3. Full tables: `results/rsb.jsonl`, `results/w1rs.jsonl`, `results/spb.jsonl`. Cold is one forced-cold
sample per project (filesystem cache off), so treat ±3 s as noise.

Conclusions:

1. **Most of the gain is the tenant scope on the outer root re-read (`w1`, mastra#26327).** Cold F0 drops from
   14–26 s to 4–13 s. Cold `spans.some` goes from timing out to 12–23 s at small–p99.
2. **A root time bound on top (`rs`) halves 7-day cold `spans.some` again (13–17 s → 7–9 s)** but not 30-day
   (14–25 s either way). It is exact under the one-root rule.
3. **The span time bound (`spb`) adds nothing measurable.** It prunes span parts 460 → 112, but the span scan was
   never the bottleneck. A span-name index (OBS-595) targets the same scan, so it isn't justified by this data.
4. **Open:** at the largest project, `w1`/`rs` raise warm `spans.some` memory 204 → ~362 MiB and bytes 350 →
   ~470 MB, and cold still times out. 30-day cold `spans.some` stays above the 15 s API timeout at every size.

### X37: platform#3407 settings on mobs-query's own reads (prod replica, read-only, 2026-10-08)

`mobs-ab.ts` calls mobs-query's real service functions (lists, trace/branch/span detail, logs, metrics, scores,
feedback, discovery, metric aggregates at 24 h and 7 d) with a guarded client, so the SQL is exactly what the service
sends. **A** = today (server defaults: read-ahead pool 200). **B** = the PR (`filesystem_prefetches_limit = 8`,
`max_execution_time = 9`, throw). List and detail operations run on all 15 projects, the rest on one per bucket. Each
operation: one cold call per variant (filesystem cache off), one unmeasured warm-up, then 3 warm calls per variant
alternating A/B. 1,840 calls. The measured shapes match 70.5% of mobs-query's real reads over 3 days by normalized
query hash (83,298 reads, identified by mobs-query's `CLICKHOUSE_SETTINGS`); every uncovered shape is a variant of a
measured family and under 2.4% of reads on its own.

| bucket  | warm ms A → B (median op) | warm MiB A → B | cold ms A → B (median op) | B cold failures | of which A also > 9 s |
| ------- | ------------------------- | -------------- | ------------------------- | --------------- | --------------------- |
| small   | 21 → 17                   | 48 → 13        | 196 → 846                 | 3 / 46          | 3                     |
| mid     | 17 → 17                   | 44 → 10        | 536 → 1,121               | 7 / 46          | 6                     |
| p90     | 16 → 17                   | 49 → 12        | 287 → 1,322               | 5 / 46          | 4                     |
| p99     | 24 → 26                   | 69 → 21        | 808 → 1,018               | 15 / 46         | 13                    |
| largest | 35 → 36                   | 88 → 22        | 484 → 967                 | 13 / 46         | 13                    |

- **Warm reads do not change.** No operation got meaningfully slower (worst: p99 logs page 118 → 165 ms; most within
  ±10%). No warm failures in either variant. Memory drops 3–4× except where real query state dominates (branch list
  at p99/largest ~200/410 MiB in both).
- **Fully cold reads get 2–4× slower**, and every B failure was a cold call hitting the 9 s limit (code 159): branch
  list (15, every bucket), trace list (13), trace detail (4), others (3). In 39 of 43 the same call under A also took
  over 9 s, which in production already exceeds the 10 s socket timeout; 4 calls A finished in 6–9 s.
- **The real behaviour change:** a > 10 s read today is cut by the socket, retried once, and the retry often succeeds
  because the abandoned server query kept filling the cache. Under B the server stops at 9 s with `TIMEOUT_EXCEEDED`,
  which `withRetry` does not retry, so the user sees an error instead of a slow success.
- **How often that happens:** in 3 days mobs-query ran 83,352 reads; 425 (0.5%) were mostly cold, 9 took over 3 s,
  4 over 6 s, 2 over 9 s. At a 2–4× cold slowdown, only reads taking more than ~2–4.5 s today are at risk: about
  3 per day.

### X36: real read traffic (prod, read-only, 2026-10-06 to 2026-10-08)

`traffic.ts` reads `clusterAllReplicas('all_groups.default', system.query_log)`, which covers every compute group on
the shared storage, so it sees the primary service's reads. The primary keeps about 2 days of `query_log`. Output is
counts and percentiles only. Window: 226,523 reads on observability tables, all from one Platform user.

| table read      | reads   | failed      | > 5 s | p50 / p99 ms | p50 / p99 MiB | touch object storage | mostly cold |
| --------------- | ------- | ----------- | ----- | ------------ | ------------- | -------------------- | ----------- |
| spans           | 147,046 | 1,423 (241) | 8     | 44 / 660     | 86 / 409      | 5.4%                 | 1.8%        |
| roots           | 30,003  | 0           | 0     | 27 / 369     | 141 / 227     | 2.2%                 | 0.7%        |
| logs            | 19,215  | 0           | 0     | 13 / 103     | 43 / 178      | 0.4%                 | 0.3%        |
| scores/feedback | 18,720  | 0           | 0     | 5 / 39       | 5 / 88        | 0%                   | 0%          |
| metrics         | 11,544  | 0           | 0     | 7 / 121      | 36 / 205      | 0.4%                 | 0.3%        |

- **Cold reads are rare and short for today's shapes.** Mostly-cold span reads: p50 230 ms, p99 1.6 s; roots p99
  2.2 s. 1 read over 10 s in 2.3 days, 0 timeouts (159). The forced-cold runs (filesystem cache off) overstate
  both how often and how badly reads go cold. Caveat: `aggregateTraces()` is not live yet; 30-day aggregates touch
  older parts, which are less likely to be cached than today's short list reads.
- **The read-ahead floor is visible.** Small reads still sit at 140–200 MiB (roots p50 141 MiB reading ~2 MiB; a
  grouped metrics shape p50 203 MiB reading 29 MiB). The primary runs `filesystem_prefetches_limit = 200`.
- **It causes failures today.** Agent-learning trace reads (`traceReadSettings`: 256 MiB, 5 s, 2 threads) failed
  with 241 (memory limit) 1,350 times out of 16,902 (8%), in bursts of ~400 per hour on 2026-10-07. They read
  p50 2.4k rows. The read-ahead pool uses most of the 256 MiB before any query work, so a lower prefetch limit should
  remove most of these. That is likely, but not yet verified on that query.
- **The largest per-query memory is not observability reads.** The cleanup `/tenants` scan (`SELECT DISTINCT
organizationId, projectId … UNION DISTINCT …`) reads 80–98M span rows and uses 1.5–3.5 GiB per call; it ran 973
  times (~400/day, one identical first page 236 times).
- **Concurrency:** peak 82 reads in one second, p99 26; peak memory in flight 11.4 GiB.

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
