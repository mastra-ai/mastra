# Memory experiments: `aggregateTraces()` on ClickHouse

Running log of every experiment and candidate improvement for OBS-539 / OBS-515. `FINDINGS.md` holds the
benchmark tables; this file tracks what we tried, where, and what it showed.

**Budget** (agreed 2026-10-06): typical tenant 32–64 MiB peak per query, largest tenant ≤ 256 MiB. Multi-tenant
cluster, so per-query memory multiplies with concurrency.

**Where experiments run**

| Env       | What it is                                                                      | Use it for                                                                                                       |
| --------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `prod`    | Platform's read-only replica (ClickHouse Cloud 26.4), shared with other benches | Read path, prefetch/cache, cold reads, multi-tenant scan effects, final validation of anything that ships        |
| `local`   | ClickHouse 26.4 in docker, synthetic data calibrated to the replica's profile   | Query-shape and schema iteration (hash tables, dedupe, joins, MVs, skip indexes), correctness/equivalence checks |
| `scratch` | Writable ClickHouse Cloud service (pending)                                     | Schema/write-path changes where Cloud storage behaviour matters, concurrency tests                               |

Numbers are warm medians on the representative project per bucket, 30-day window, unless stated. Bucket sizes
(traces / 30d): small ≈ 25, p99 ≈ 41k, largest ≈ 430k (≈ 2.5M token rows).

## Improvements

| #   | Improvement                                                                                                            | Kind     | Evidence           | Effect                                                                                                                                                                                | Status                          |
| --- | ---------------------------------------------------------------------------------------------------------------------- | -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| I1  | Limit remote prefetch for trace aggregate queries (`filesystem_prefetches_limit = 8`, or the prefetched read pool off) | setting  | X10, X11, X12, X16 | Removes the ~155 MiB per-query floor (small F0 166 → 23 MiB, E4 225 → 42 MiB). Cold reads: no cost for small projects; +20–60% for p99/largest with the pool off, less with the limit | measured; pick per project size |
| I2  | Add `endedAt >= from` to root and span scans (tables are partitioned by `toDate(endedAt)`)                             | compiler | X09, X17, X18      | Shipped inside I3's variant (`rs`); see I3                                                                                                                                            | measured (with I3)              |
| I3  | Tenant- and time-scope the outer `current_roots` re-read, with I2 (`rs`)                                               | compiler | X02, X17, X18      | Prod F0: bytes 98 → 7 MB small, 118 → 27 MB p99, 233 → 155 MB largest; latency ×0.3–0.7. Memory only drops once I1 removes the floor                                                  | measured; equivalent in lab     |
| I4  | Remove query-time retry dedupe of token metrics (move to write path)                                                   | schema   | X07, X15           | Largest E4 976 → 462 MiB (×0.47), latency ×0.68. The replica has **zero** duplicate token rows in 30 days                                                                             | needs write-path design         |
| I5  | Drop the span dedupe in `current_spans` for `spans.some` (existence doesn't change with duplicates), with I2 (`sp`)    | compiler | X13, X17, X18      | Prod F3: p99 189 → 185 MiB alone, largest 548 → 381 MiB; with I3 largest 337 MiB                                                                                                      | measured; equivalent in lab     |
| I6  | All of the above together (`shape` + `filesystem_prefetches_limit = 8`)                                                | combined | X18                | Prod: small 15–28 MiB, p99 48–139 MiB, largest 242–432 MiB (from 166–944 MiB)                                                                                                         | measured warm; cold pending     |

## Experiment register

| ID  | Env   | Question                                                                                                                   | Result (short)                                                                                   | Status |
| --- | ----- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | ------ |
| X01 | prod  | Baseline: latency/bytes/memory by project size                                                                             | Peak 592 MiB (non-token), 991 MiB (token/cost); ~160 MiB even for 25-trace projects              | done   |
| X02 | prod  | W1: tenant-scope the outer re-read                                                                                         | Bytes ×0.13–0.5 (small–p99), ×0.84 largest; memory ×0.9–1.4                                      | done   |
| X03 | prod  | `quantileExact` vs `quantileDeterministic`; `uniq` vs `uniqExact`                                                          | No material difference                                                                           | done   |
| X04 | prod  | `max_threads = 2` (t2)                                                                                                     | Memory ×0.91–1.02, often slower                                                                  | done   |
| X05 | prod  | External GROUP BY/sort at 256 MiB (spill)                                                                                  | E4 largest ×0.65 memory but ×3.8 latency; elsewhere no gain                                      | done   |
| X06 | prod  | Dedupe token rows on `metricId` only (mkey)                                                                                | Memory ×0.98–1.03                                                                                | done   |
| X07 | prod  | Diagnostic: no retry dedupe (nodedupe) / no `costMetadata` parse (nocm)                                                    | nodedupe ×0.47 largest, ×0.86 p99; nocm ×0.96–0.98                                               | done   |
| X08 | prod  | `FINAL` instead of manual dedupe                                                                                           | Worse: 986–1209 MiB largest                                                                      | done   |
| X09 | prod  | Is the floor tied to parts/granules selected?                                                                              | 30d scoped count selects 268/268 parts before PK; `endedAt` bound cuts to 19 parts, 156 → 55 MiB | done   |
| X10 | prod  | What sets the ~160 MiB floor? (meter, columns, settings)                                                                   | `SELECT 1` 7.5 MiB; floor independent of columns/threads/blocks/buffers; prefetch off → 8.5 MiB  | done   |
| X11 | prod  | Which prefetch setting? Effect on full queries                                                                             | Prefetched read pool is the floor; both off is best (small F0 10, E4 28, F3 16 MiB)              | done   |
| X12 | prod  | Cold (object-storage) latency with prefetch off                                                                            | Small: no cost. p99 +30–40%, largest F0 times out (>30 s vs 22 s). Prefetch limit 8 sits between | done   |
| X13 | local | Stage-by-stage CTE breakdown                                                                                               | Memory jumps at the span dedupe (F3) and the token usage dedupe (E4); root stages are cheap      | done   |
| X17 | local | Query-shape rewrites (`rs`, `r1`, `sp`, `shape`): equivalence and memory                                                   | 0 mismatches in 3,096 comparisons; `r1` does nothing; `sp`/`shape` cut p99 F3 128 → 48 MiB       | done   |
| X18 | prod  | Shape rewrites ± prefetch limit vs the 32–64 / 256 MiB budget                                                              | Small and p99 F0/F3 within budget; E4 p99 139 MiB; largest 242–432 MiB, still over 256 for F3/E4 | done   |
| X14 | local | Lab calibration: does local reproduce shape memory?                                                                        | Yes, within ~10–20% of prod with prefetch off (small/p99 F0, E4, F3; largest E4 820 vs ~930 MiB) | done   |
| X15 | prod  | Duplicate rate of token metric rows (does the retry dedupe ever fire?)                                                     | 0 duplicate `metricId`s in 30 days for all 15 projects (up to 2.06M token rows)                  | done   |
| X16 | prod  | Keep prefetch but bound it (`filesystem_prefetch_max_memory_usage`, `filesystem_prefetches_limit`, `prefetch_buffer_size`) | Only `filesystem_prefetches_limit = 8` works: small count 12 MiB, F0 23–27, E4 42; p99 F0 52     | done   |

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

## Track 3 plan (scratch service, writable, pending)

Goal: bring the largest tenant under 256 MiB for F3 and E4, and keep the small-tenant result under concurrency.

| ID  | Experiment                                                                                                     | Measures                                                                    |
| --- | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| S1  | Calibrate: load the lab generator's data into the scratch service; reproduce X18 base and shape numbers        | Within ~15% of prod, or the rest isn't trustworthy                          |
| S2  | Trace usage rollup: token sums and cost per trace on a narrow `(org, project, traceId)` table, filled by an MV | E4 largest memory and bytes; correctness vs base; write amplification       |
| S3  | Span signals on the root row (`spanNames Array(LowCardinality(String))`, `hasError`) + set/bloom skip index    | F3 as `has(spanNames, ?)`, no span scan; storage cost                       |
| S4  | `traceId` bloom filter on trace_roots and span_events                                                          | Whether the re-read and span semi-join stop reading other granules          |
| S5  | Idempotent token writes (stable `metricId` + ReplacingMergeTree) to make I4 safe                               | Duplicates after forced writer retries; whether query-time dedupe is needed |
| S6  | Concurrency: 20–50 parallel small-tenant queries, base vs `shape + limit 8`                                    | Aggregate memory and failure point, p95 latency                             |
| S7  | Cold reads for `shape + limit 8` across sizes (needs cache control)                                            | Cold latency vs X12                                                         |
