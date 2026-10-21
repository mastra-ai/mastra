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

| ID  | Env        | Question                                                                                                                                                                                                                                                                                                          | Result (short)                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Status |
| --- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| X01 | prod       | Baseline: latency/bytes/memory by project size                                                                                                                                                                                                                                                                    | Peak 592 MiB (non-token), 991 MiB (token/cost); ~160 MiB even for 25-trace projects                                                                                                                                                                                                                                                                                                                                                                                                     | done   |
| X02 | prod       | W1: tenant-scope the outer re-read                                                                                                                                                                                                                                                                                | Bytes ×0.13–0.5 (small–p99), ×0.84 largest; memory ×0.9–1.4                                                                                                                                                                                                                                                                                                                                                                                                                             | done   |
| X03 | prod       | `quantileExact` vs `quantileDeterministic`; `uniq` vs `uniqExact`                                                                                                                                                                                                                                                 | No material difference                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | done   |
| X04 | prod       | `max_threads = 2` (t2)                                                                                                                                                                                                                                                                                            | Memory ×0.91–1.02, often slower                                                                                                                                                                                                                                                                                                                                                                                                                                                         | done   |
| X05 | prod       | External GROUP BY/sort at 256 MiB (spill)                                                                                                                                                                                                                                                                         | E4 largest ×0.65 memory but ×3.8 latency; elsewhere no gain                                                                                                                                                                                                                                                                                                                                                                                                                             | done   |
| X06 | prod       | Dedupe token rows on `metricId` only (mkey)                                                                                                                                                                                                                                                                       | Memory ×0.98–1.03                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | done   |
| X07 | prod       | Diagnostic: no retry dedupe (nodedupe) / no `costMetadata` parse (nocm)                                                                                                                                                                                                                                           | nodedupe ×0.47 largest, ×0.86 p99; nocm ×0.96–0.98                                                                                                                                                                                                                                                                                                                                                                                                                                      | done   |
| X08 | prod       | `FINAL` instead of manual dedupe                                                                                                                                                                                                                                                                                  | Worse: 986–1209 MiB largest                                                                                                                                                                                                                                                                                                                                                                                                                                                             | done   |
| X09 | prod       | Is the floor tied to parts/granules selected?                                                                                                                                                                                                                                                                     | 30d scoped count selects 268/268 parts before PK; `endedAt` bound cuts to 19 parts, 156 → 55 MiB                                                                                                                                                                                                                                                                                                                                                                                        | done   |
| X10 | prod       | What sets the ~160 MiB floor? (meter, columns, settings)                                                                                                                                                                                                                                                          | `SELECT 1` 7.5 MiB; floor independent of columns/threads/blocks/buffers; prefetch off → 8.5 MiB                                                                                                                                                                                                                                                                                                                                                                                         | done   |
| X11 | prod       | Which prefetch setting? Effect on full queries                                                                                                                                                                                                                                                                    | Prefetched read pool is the floor; both off is best (small F0 10, E4 28, F3 16 MiB)                                                                                                                                                                                                                                                                                                                                                                                                     | done   |
| X12 | prod       | Cold (object-storage) latency with prefetch off                                                                                                                                                                                                                                                                   | Small: no cost. p99 +30–40%, largest F0 times out (>30 s vs 22 s). Prefetch limit 8 sits between                                                                                                                                                                                                                                                                                                                                                                                        | done   |
| X13 | local      | Stage-by-stage CTE breakdown                                                                                                                                                                                                                                                                                      | Memory jumps at the span dedupe (F3) and the token usage dedupe (E4); root stages are cheap                                                                                                                                                                                                                                                                                                                                                                                             | done   |
| X17 | local      | Query-shape rewrites (`rs`, `r1`, `sp`, `shape`): equivalence and memory                                                                                                                                                                                                                                          | 0 mismatches in 3,096 comparisons; `r1` does nothing; `sp`/`shape` cut p99 F3 128 → 48 MiB                                                                                                                                                                                                                                                                                                                                                                                              | done   |
| X18 | prod       | Shape rewrites ± prefetch limit vs the 32–64 / 256 MiB budget                                                                                                                                                                                                                                                     | Small and p99 F0/F3 within budget; E4 p99 139 MiB; largest 242–432 MiB, still over 256 for F3/E4                                                                                                                                                                                                                                                                                                                                                                                        | done   |
| X14 | local      | Lab calibration: does local reproduce shape memory?                                                                                                                                                                                                                                                               | Yes, within ~10–20% of prod with prefetch off (small/p99 F0, E4, F3; largest E4 820 vs ~930 MiB)                                                                                                                                                                                                                                                                                                                                                                                        | done   |
| X15 | prod       | Duplicate rate of token metric rows (does the retry dedupe ever fire?)                                                                                                                                                                                                                                            | 0 duplicate `metricId`s in 30 days for all 15 projects (up to 2.06M token rows)                                                                                                                                                                                                                                                                                                                                                                                                         | done   |
| X16 | prod       | Keep prefetch but bound it (`filesystem_prefetch_max_memory_usage`, `filesystem_prefetches_limit`, `prefetch_buffer_size`)                                                                                                                                                                                        | Only `filesystem_prefetches_limit = 8` works: small count 12 MiB, F0 23–27, E4 42; p99 F0 52                                                                                                                                                                                                                                                                                                                                                                                            | done   |
| X19 | local      | Root dedupe in sort-key order (`rio`); join algorithms                                                                                                                                                                                                                                                            | `rio` cuts largest E3 ~42%, F0 ~17%, 0 mismatches; only `partial_merge` join helps E4 (×0.87)                                                                                                                                                                                                                                                                                                                                                                                           | done   |
| X20 | local      | Usage rollup + span-name index (`urollup`, `snidx`, `arch`) on pulled data                                                                                                                                                                                                                                        | 0 mismatches in 1,320 comparisons; `arch` largest E4 294, F3 115, E1 134 MiB                                                                                                                                                                                                                                                                                                                                                                                                            | done   |
| X21 | local      | Rollup keyed by `cityHash64(traceId)`; FINAL read; dropping the `IN candidates` filter                                                                                                                                                                                                                            | UInt64 key ×0.75–0.85 memory; FINAL no gain; dropping the filter changes results                                                                                                                                                                                                                                                                                                                                                                                                        | done   |
| X22 | local      | `traceId` bloom filters                                                                                                                                                                                                                                                                                           | No memory change; bytes drop only for small tenants on the unscoped base re-read                                                                                                                                                                                                                                                                                                                                                                                                        | done   |
| X23 | local      | Retries vs write-time rollups; per-metric ReplacingMergeTree + FINAL; insert dedup tokens                                                                                                                                                                                                                         | Rollup double-counts retries; per-metric FINAL exact at ~355 MiB; dedup keeps the MV exact                                                                                                                                                                                                                                                                                                                                                                                              | done   |
| X24 | local      | Concurrency: 10/25/50 parallel non-largest queries, base vs `arch`                                                                                                                                                                                                                                                | Server peak at 50: +722 MiB → +392 MiB; no failures                                                                                                                                                                                                                                                                                                                                                                                                                                     | done   |
| X25 | prod       | Cold reads for `shape` and `shape + limit 8`                                                                                                                                                                                                                                                                      | `shape` lets small/p99 F3/E4 finish cold; limit 8 pushes p99 F3/E4 over 30 s; largest F3/E4 time out cold                                                                                                                                                                                                                                                                                                                                                                               | done   |
| X26 | local      | Hourly token/cost rollup for dashboard queries (`hourly`)                                                                                                                                                                                                                                                         | 8–14 MiB at every size; largest E4 882 → 12 MiB; 0 mismatches in 264 comparisons                                                                                                                                                                                                                                                                                                                                                                                                        | done   |
| X27 | local      | Integer trace keys, no root dedupe, usage on the root row (`hk`, `nord`, `arch2`, `arch3`)                                                                                                                                                                                                                        | `arch3` largest 23–35 MiB for every measured case; 0 mismatches (2,880 + 960)                                                                                                                                                                                                                                                                                                                                                                                                           | done   |
| X28 | local      | One day of a 30-day query (per-day split)                                                                                                                                                                                                                                                                         | Largest `shape` 1-day 17–25 MiB vs 228–315 MiB for 30 days                                                                                                                                                                                                                                                                                                                                                                                                                              | done   |
| X29 | prod       | mid and p90 with `shape` and `shape + limit 8`, warm and cold                                                                                                                                                                                                                                                     | Warm F0/F3 20–28 MiB, E4 36–42 MiB; cold all finish, 8–30 s                                                                                                                                                                                                                                                                                                                                                                                                                             | done   |
| X30 | prod       | Prefetch limit 4/8/16/32, warm and cold, small–p99                                                                                                                                                                                                                                                                | Memory rises with the limit (8 ≈ 4 < 16 < 32); cold latency about the same for every limit; p99 F3/E4 cold time out at all four                                                                                                                                                                                                                                                                                                                                                         | done   |
| X31 | prod       | Compiler rewrites that keep every dedupe (`sk`, `safe` = sk + sort-order dedupe + integer keys), ± limit 8, warm and cold                                                                                                                                                                                         | Non-token small–p90 18–43 MiB; token/cost stays 34–49 / 293–302 / 866 MiB (p90 / p99 / largest); 0 mismatches in 2,880                                                                                                                                                                                                                                                                                                                                                                  | done   |
| X32 | local      | Trace-ordered projection / copy of token rows so the `(traceId, metricId)` dedupe streams                                                                                                                                                                                                                         | Projection never chosen; sorted copy alone 806–875 MiB, in-order aggregation worse; the dedupe alone is ~470 MiB                                                                                                                                                                                                                                                                                                                                                                        | done   |
| X33 | prod       | Write-side facts for schema proposals (`prechecks.ts`, all tenants, 7 days)                                                                                                                                                                                                                                       | Roots rewritten (0.08% of traces, up to 263 copies); 0 duplicate token rows; span names never change; 4.3% of token rows after the root ends                                                                                                                                                                                                                                                                                                                                            | done   |
| X34 | prod+local | Integer keys for the token retry dedupe; what the dedupe costs                                                                                                                                                                                                                                                    | Dedupe memory follows the number of token rows, not key type or aggregate: −11% at largest                                                                                                                                                                                                                                                                                                                                                                                              | done   |
| X35 | local      | One usage row per model call: separate table, span columns, `FINAL` read                                                                                                                                                                                                                                          | Per-call table ×0.41 at largest; `FINAL` read adds a ~160 MiB floor (rejected)                                                                                                                                                                                                                                                                                                                                                                                                          | done   |
| X36 | prod       | Real Platform read traffic from `query_log` across compute groups (`traffic.ts`, 2.3 days)                                                                                                                                                                                                                        | Cold reads are rare (≤5% of reads touch object storage, p99 1.6 s); the read-ahead floor makes 8% of 256 MiB-capped span reads fail                                                                                                                                                                                                                                                                                                                                                     | done   |
| X37 | prod       | mobs-query's own read paths, today's settings vs platform#3407 (`mobs-ab.ts`, 33 operations, 15 projects)                                                                                                                                                                                                         | Warm: same latency, 3–4× less memory, no failures. Forced-cold: 2–4× slower; 43 of 230 cold reads hit the 9 s limit, 39 already took > 9 s                                                                                                                                                                                                                                                                                                                                              | done   |
| X38 | prod       | Where cold `spans.some` time goes; span and root time bounds under one root per trace                                                                                                                                                                                                                             | Span scan was never the bottleneck; the unscoped root re-read is. `w1` gives most of the cold win, `rs` more at 7d, `spb` nothing                                                                                                                                                                                                                                                                                                                                                       | done   |
| X39 | prod       | Largest-project `spans.some` memory across #26327, OBS-589 and OBS-613, stage by stage (`floor.ts` `mr-*` probes)                                                                                                                                                                                                 | No rise from #26327 on the same project; the reported 204→362 MiB compared two projects. OBS-613 is ~10% lower; memory is spans + semi-join                                                                                                                                                                                                                                                                                                                                             | done   |
| X40 | prod       | OBS-591 read caps (1 GiB memory, 256 MiB result, 16 GiB read) replayed: `query_log` what-if, mobs-query A/B, source reads, heavy reads                                                                                                                                                                            | 58 of 82,819 reads stopped, all giant-payload trace reads; mobs-query unchanged; a 3.8 GiB read stops at 1 GiB in 0.4 s; raw E4 at the cap                                                                                                                                                                                                                                                                                                                                              | done   |
| X41 | prod       | OBS-515 `aggregateTraces()` on mobs-query (`mobs-aggregate.ts`): 4 projects × 7/30 d, project and org-wide, token fallback D0/D1/D2, 7–180 d sweep                                                                                                                                                                | All cells but one under 1 GiB; `spans.some` on the largest org at 30 d hits 241 before #3540 and 810 MiB on `main` after it; token fallback 400 MiB window-bounded                                                                                                                                                                                                                                                                                                                      | done   |
| X42 | prod       | OBS-666 group-by dimension audit (`mobs-dimensions.ts`): cardinality and fill of per-trace root columns, one grouped request per dimension, p99/largest × 7/30 d, project and org-wide                                                                                                                            | The dimension is never the cost: every cell within 0–15% of ungrouped (max 468 MiB, 4.1 s). Most context columns are empty on Platform                                                                                                                                                                                                                                                                                                                                                  | done   |
| X44 | prod       | OBS-667 root `name`/`spanType` filters and value suggestions (`root-filters.ts`): OSS ClickHouse compiler from mastra#27321, largest project and its org × 7/30 d, each request vs the same request on `entityName`                                                                                               | No cell above 410 MiB / 0.9 s; memory within ±5% except whole-population `spanType` lists (+26–27%, selectivity not field); every count matches hand-written SQL                                                                                                                                                                                                                                                                                                                        | done   |
| X45 | prod       | OBS-664 `spans.some` aggregate time on the largest org: request C stage breakdown, span-filter variants, then the prefilter fix (platform#3585) vs `main`                                                                                                                                                         | Span dedupe was ~3.4 of 4.4 s and ~800 MiB; filtering shared span fields before the collapse: org 30 d 2.1–2.6 s / ~380 MiB, project 180 d 2.3–3.2 s, results identical in 8/8 cells                                                                                                                                                                                                                                                                                                    | done   |
| X46 | prod       | OBS-390 `aggregateSpans()` contract affordability (`mobs-span-aggregate.ts`): prototype SQL, 10 span shapes, p99 + largest project and largest org × 1–180 d, `querySpans()` collapse vs trace-scope-style collapse                                                                                               | Projects fit 1 GiB/9 s to 180 d (≤ 860 MiB) with window-bounded usage and spanType prefilter; largest org fits 7 d, fails from 30 d (1.1–1.3 GiB), fits to ~14 d; `model` grouping reads `attributes` (23 GiB at 7 d). Decided: window = retention for all scopes, OBS-392 must fit org scope; model/provider dropped (OBS-693)                                                                                                                                                         | done   |
| X48 | prod       | OBS-696 Metrics page on `aggregateTraces()` (`mobs-metrics-page.ts`): 7 org card shapes + 5 project card shapes, p99/largest × project/org × 24 h/7 d/30 d, whole-page concurrent loads, `metrics` vs `aggregateTraces()` parity                                                                                  | Every card fits alone (max 452 MiB / 3.8 s). The org page at 30 d on the largest org does not: fired together, the 6 token/cost cards time out at 9 s every load. Project page fits to 30 d, at the edge (6.6–9.3 s). Runs/failure cards stay on `metrics` (nested runs); tokens can move, cost/threads/usage-over-time cannot yet                                                                                                                                                      | done   |
| X49 | prod       | OBS-696 org Metrics page fit at 30 d (`mobs-org-page-fit.ts`): usageId adoption, fallback statement split + rewrites, fallback off, token/cost from `metrics` by project, shared statement, load shapes, concurrency caps, `mastra_model_usage` back-fill assessment                                              | Fits with `c2m` (token/cost from `metrics` grouped by `projectId`, O3s+O3f merged, KPIs from `metrics`) capped at 3 in flight: 24 h ≤ 0.75 s, 7 d ≤ 2 s, 30 d statements ≤ 3.5 s in 14/16 loads; the rest hit replication fetch bursts on the 3-vCPU bench node. Rewrites/load shapes alone don't fit; fallback off loses ≤ 72% of 30 d tokens. Back-fill `mastra_model_usage` (`'m:'                                                                                                   |        | metricId`, + `spanId`) recommended for Platform | done |
| X51 | prod       | OBS-698 project Metrics page as shipped in mastra#27908–#27910 (`mobs-obs698-page.ts`): 9 `aggregateTraces()` requests through the page's 3-in-flight limiter + the 15 `metrics` requests that stay, p99/largest × 24 h/7 d/30 d, cold ×1 + warm ×3, vs today's page                                              | Memory fits (≤ 404 MiB/statement). 24 h and 7 d fit warm; 30 d does not (3 of 6 warm loads lose cards at 9 s, pages 8–21 s vs ~2 s today). Cold at 7 d it also fails 7 of today's cards. Cause: 6 of 9 requests read the token/cost fallback (~2 GiB each, largest project 30 d). PRs stay drafts                                                                                                                                                                                       |
| X52 | prod       | OBS-392 review (platform#3633, mastra#27857): bound the per-span usage read of `aggregateSpans()` (`mobs-span-usage-bound.ts`): which spans carry usage, usage lag after span start, unbounded vs `to + 30 d` vs `traceId` semi-joins, largest project + org, 7 d now/14 d back/90 d back + org 180 d branch path | Usage lands on branch spans too (3.9% of rows on `processor_run`, 6 h sample). Longest usage lag 8.9 d, longest span 27.8 d. `to + 30 d` returns the same rows and reads 2–100× less 90 d back (largest project `model_generation` 3.7 → 1.4 GiB), nothing extra near now. Semi-joins help only small selections, read more for `model_generation`, fail 1 GiB at org 180 d. Branch path with tokens/cost at org 180 d: 3.7–4.0 s / ≤ 876 MiB bounded. Shipped as a Platform host limit | done   |
| X53 | prod       | OBS-698 project Metrics page at 14 d, the range the page is now capped at (`mobs-obs698-page.ts`, X51's method), p99/largest, cold ×1 + warm ×3, vs today's page                                                                                                                                                  | Memory fits (≤ 211 MiB/statement). Warm #2/#3 fit (slowest statement ≤ 5.1 s, pages 4.6–5.3 s vs ~1.3 s today); both warm #1 loads (right after an all-failed cold load) lose the Tokens KPI's previous-window request at 9.0–9.5 s, which reads 5× the current window on the largest project. Cold, both pages fail every request. Does not fit by the gate; PRs stay drafts                                                                                                           |
| X54 | prod       | OBS-698 project Metrics page with the Tokens KPI left on `metrics` and no 14-day cap (`mobs-obs698-page.ts`, X51's method), p99/largest × 24h/7d/30d, cold ×1 + warm ×3, per card                                                                                                                                 | Memory fits (≤ 419 MiB/statement). Every card fits at 24 h and 7 d. At 30 d on the largest project, Top entities and the environment Trace breakdown lose 2 of 3 warm loads at 9 s and Trace latency loses 1 (contention; it reads 111 MiB). Users and sessions and Cost coverage fit (≤ 4.7 s). The 4 `cost.sum` requests read ~2 GiB each there. No card dropped yet                                                                                                                  |

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

### X48: Metrics page on `aggregateTraces()` (prod replica, read-only, 2026-10-19)

**Question.** Phase 1 of custom dashboards (OBS-696) adds `aggregateTraces()` cards to the project Metrics page and a new org-wide Metrics page. Two questions: (1) does every proposed card, and each page as the browser fires it, fit mobs-query's 1 GiB / 9 s per statement at org scope on the largest org? (2) For cards that could move off `metrics`, does `aggregateTraces()` give the same number for the same project, window and filter?

**Method.** `mobs-metrics-page.ts`, against Platform `main` 7ba265249 at `/tmp/platform-x48`. New cards compile with `planPlatformTraceAggregate()` + `compileClickHouseTraceAggregate()` and run through `aggregateTraces()`. Today's cards call `metrics-aggregations.ts` directly (`getMetricAggregate()` with `comparePeriod: 'previous_period'`, `getMetricTimeSeries()`, `getMetricBreakdown()`, `getMetricPercentiles()`), one call per HTTP request the playground-ui hooks make. Guarded client and project selection as X41, `max_threads=16`. Every shape plans and compiles offline (`dry`, 54/54) before it runs.

- `grid`: one card at a time. Per cell: cold ×1 (filesystem cache off), warm-up, warm ×3 under a 4 GiB / 30 s ceiling, then one `aggregateTraces()` call under mobs-query's read limits (1 GiB, 9 s, 256 MiB result, 16 GiB read; "svc" column). Roles: p99 and largest project; org scope is each project's org. The p99 project's org has one project, so "p99 org" is a single-project org; the largest org has 22 projects with roots in 7 d.
- `page`: every card on a page fired at once through the service functions, with mobs-query's pool of 10 sockets and its read limits. Variants: `agg` (new cards only) and `both` (new cards + today's 17 `metrics` requests, which stay on the page). Largest org (org page) and largest project (project page), 24 h and 30 d, cold ×1 + warm ×3. "concurrent" = the largest sum of statement peaks among statements that overlapped on one replica (an upper bound on what the page held at once).
- `parity`: project scope, p99 and largest project, 24 h and 7 d, window closed at the last full hour, hourly buckets. Today's values vs `aggregateTraces()`, plus hand-written diagnostics that split each difference by cause.
- `check`: O1, O3s and O3f against hand-written SQL (latest root copy by `argMax`), both orgs at 7 d.

Raw rows: `results/mobs-metrics-page*.jsonl`; tables: `mobs-metrics-page.ts report`.

Card shapes (window, `timeRange`; series use the page's own interval rule: `1h` to 14 d, `1d` beyond; 30 d cells ran both; series limit 20 groups or fewer to stay under 10,000 rows):

| Card                                      | Shape                                                                                                            |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| O1 projects table                         | by `projectId`: count, errorRate, duration.p95, tokens.total.sum, cost.sum; order count desc, limit 50           |
| O1s projects table sparklines             | O1 measures by `projectId` × interval                                                                            |
| O2 cost/tokens by project over time       | by `projectId` × interval: tokens.input/output/cached.sum, cost.sum                                              |
| O3s / O3f slowest / most-failing entities | by `projectId` × `entityName`: count, errorRate, duration.p95; order p95 (O3s) or errorRate (O3f) desc, limit 20 |
| O4 environment health                     | by `environment` × interval: errorRate, duration.p95                                                             |
| O5 active users/threads                   | by `projectId`: countDistinct.userId, countDistinct.threadId                                                     |
| O6 cost coverage                          | by `projectId`: cost.sum (+ coverage)                                                                            |
| O7 biggest movers                         | O3s on the previous period                                                                                       |
| P1 KPIs: runs, active threads             | `entityType = agent`: count, countDistinct.threadId (+ previous period on the page)                              |
| P2 KPIs: tokens, cost                     | tokens.total.sum, cost.sum (+ previous period on the page)                                                       |
| P3 token usage over time                  | × interval: tokens.input/output/cached.sum, cost.sum                                                             |
| P4 agent runs over time                   | `entityType = agent`, by `status` × interval: count                                                              |
| P5 failure rate over time                 | `entityType = agent` × interval: count, errorRate                                                                |

Org page = O1–O7 + P1/P2 with their previous periods (13 requests). Project page = P1, P2 (+ previous periods), P3, P4 (6 requests; the failure-rate card derives from P4, as it does from today's runs series).

**Correctness.** `check --windows 7d`: O1, O3s and O3f match hand-written SQL in every group, counts and error counts (p99 org 1 + 19 + 19 groups, largest org 22 + 20 + 20, 0 mismatches). No project with more roots than O1's smallest row is missing from O1.

**Part 1: one card at a time** (warm median / max MiB, svc = the `aggregateTraces()` call at 1 GiB / 9 s). No svc call failed in 108 cells.

| Role / scope        | 24 h worst             | 7 d worst               | 30 d worst               | 30 d forced-cold timeouts (30 s) |
| ------------------- | ---------------------- | ----------------------- | ------------------------ | -------------------------------- |
| p99 project         | 83 MiB / 0.1 s (P2)    | 149 MiB / 0.3 s (P2/P3) | 185 MiB / 1.2 s (P3)     | 0 / 8 (max 29.2 s)               |
| largest project     | 96 MiB / 0.2 s (P2/P3) | 125 MiB / 0.3 s (P3)    | 373 MiB / 2.4 s (P2/P3)  | 3 / 8                            |
| p99 org (1 project) | 97 MiB / 0.3 s (O2)    | 166 MiB / 1.1 s (O1)    | 232 MiB / 1.5 s (O1s)    | 7 / 14                           |
| largest org         | 109 MiB / 0.3 s (P2)   | 208 MiB / 0.9 s (O1s)   | 452 MiB / 3.8 s (O2, O6) | 13 / 14                          |

Largest org at 30 d, warm median ms / max MiB / read MiB: O1 3,630 / 423 / 3,847 · O1s 3,704–3,746 / 431 / 3,848 · O2 3,527–3,706 / 452 / 3,818 · O6 3,242 / 384 / 3,785 · P2 3,460 / 403 / 3,825 · O3s/O3f 848–1,036 / 131 / 470 · O4 1,029–1,045 / 289 / 448 · O5 743 / 167 / 438 · O7 447 / 79 / 112 · P1 773 / 137 / 426. Every card with a token or cost measure reads ~3.8 GiB (the `mastra_metric_events` fallback; `mastra_model_usage` is nearly empty, X43); the others read ≤ 470 MiB. Forced-cold reps (filesystem cache off) exceed 9 s from 7 d on most cells and 30 s on 30 d token cards, as in X43.

**Part 1: whole page** (warm ×3; slowest = slowest card's wall time, including the service's own handling).

| Page                     | Window | Variant | Page ms       | Concurrent MiB (one replica) | Failed cards (each warm load)                      |
| ------------------------ | ------ | ------- | ------------- | ---------------------------- | -------------------------------------------------- |
| org, largest org         | 24 h   | agg     | 1,499–1,806   | 326–397                      | none                                               |
| org, largest org         | 24 h   | both    | 1,406–1,565   | 332–423                      | none                                               |
| org, largest org         | 30 d   | agg     | 15,118–18,332 | 1,293–2,442                  | O1, O1s, O2, O6, + P2 or P2prev (load 1: 12 of 13) |
| org, largest org         | 30 d   | both    | 15,775–17,400 | 1,950–2,080                  | O1, O1s, O2, O6, P2, P2prev                        |
| project, largest project | 24 h   | agg     | 426–524       | 215–310                      | none                                               |
| project, largest project | 24 h   | both    | 538–728       | 171–188                      | none                                               |
| project, largest project | 30 d   | agg     | 6,637–8,726   | 1,629–1,651                  | none                                               |
| project, largest project | 30 d   | both    | 8,167–9,302   | 1,899–2,009                  | load 3: P2, P2prev, P3                             |

- Every failure is the server stopping the statement at 9 s (code 159), not memory: no statement in any page load exceeded 566 MiB. All statements of a load landed on one replica (the pool reuses keep-alive sockets to one host).
- At 30 d on the largest org, 13 aggregate statements start together and each token/cost card, 3.5 s alone, runs past 9 s. The cards without tokens (O3s, O3f, O4, O5, P1) finish in 6–8 s, also close.
- Today's 17 `metrics` requests on the same pages never failed: statements ≤ 2.6 s at 30 d, ≤ 0.2 s at 24 h. Their card wall times (up to 14 s on the org page at 30 d) are mostly waiting for a socket behind the aggregate statements.
- Forced-cold page loads: every aggregate card timed out at 24 h and 30 d on the org page, the previous-period tokens card at 24 h and all six at 30 d on the project page. This is the pessimistic case (no filesystem cache for any statement); X43's live traffic did not see it.

**Part 2: parity** (project scope; today's `metrics` value → `aggregateTraces()` value).

| Card                   | p99 24 h                                  | p99 7 d                            | largest 24 h      | largest 7 d           | Explained by                                                                                                                                                                                                                                                                                                                 |
| ---------------------- | ----------------------------------------- | ---------------------------------- | ----------------- | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI agent runs         | 897 → 356                                 | 16,466 → 5,407                     | 346 → 190         | 2,908 → 2,206         | `metrics` counts every agent run; the aggregate counts traces whose root is an agent. Difference = nested agent runs (541; 11,056; 156; 687) + runs whose root is outside the window or missing (0; 3; 0; 15). Every root agent run has a metric row                                                                         |
| Agent runs by status   | ok 866 / error 31 → success 354 / error 2 | ok 15,542 / error 924 → 5,346 / 61 | 346 / 0 → 190 / 0 | 2,904 / 4 → 2,204 / 2 | Same split; nested runs carry most failures (p99 7 d: 924 failed runs, 61 failed root traces)                                                                                                                                                                                                                                |
| Failure rate over time | derived from the above                    | derived                            | derived           | derived               | Same                                                                                                                                                                                                                                                                                                                         |
| KPI active threads     | 78 → 77                                   | 1,276 → 1,235                      | 134 → 134         | 637 → 637             | Threads seen only on nested agents (under a workflow root). `uniq` vs exact did not matter (`uniq` = exact in all four)                                                                                                                                                                                                      |
| KPI tokens (in / out)  | equal                                     | −0.002% / −0.003%                  | +0.11% / +0.50%   | −0.28% / −1.1%        | Window attribution only: `metrics` takes rows by event time, the aggregate takes every row of traces that started in the window. Minus: rows of traces started before the window (p99 7 d: 42,853 input tokens). Plus: rows written after the window for traces started in it (largest: 25,155 input tokens). No row is lost |
| KPI cost               | $18.36 → $15.20                           | $229.27 → $171.06                  | $0.0355 → $0.0327 | $1.121 → $1.028       | The aggregate drops priced rows whose `costMetadata` has an `error` and counts them in coverage; `metrics` sums them. Difference = those rows to the cent (p99 7 d: 41.69 + 16.52 = 58.21), plus the window attribution above. Aggregate coverage is 22–52% of usage-bearing traces                                          |
| Token usage over time  | totals equal                              | totals as KPI                      | totals as KPI     | totals as KPI         | Buckets differ: rows land in the bucket of their trace's start, not their own timestamp. Hourly, 6.5% (p99 24 h) to 7.6% (p99 7 d) of tokens move to another bucket; worst single bucket 6.8 M of 113.6 M                                                                                                                    |

**Verdicts.**

| Card                   | Verdict                         | Why                                                                                                                                                         |
| ---------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| KPI agent runs         | keep (needs `aggregateSpans()`) | Decision (Daniel, 2026-10-19): agent-run counts must include nested runs; root counts are not a replacement                                                 |
| Agent runs over time   | keep (needs `aggregateSpans()`) | Same decision                                                                                                                                               |
| Failure rate over time | keep (needs `aggregateSpans()`) | Same decision; most failures are on nested runs                                                                                                             |
| KPI active threads     | keep                            | Loses threads that appear only on nested agents (3% at p99 7 d); the same nested-run gap                                                                    |
| KPI tokens             | move                            | Same rows, attributed by trace start; ≤ 1.1% at the window edges, every difference explained                                                                |
| KPI cost               | keep (decide the error rows)    | Up to 25% lower because rows with a pricing error are excluded. Moving it needs a decision on which number is right; coverage is new information either way |
| Token usage over time  | keep                            | Totals match but ~7% of tokens shift buckets; the shape of the chart changes                                                                                |
| Org-only cards (O1–O7) | new                             | No `metrics` equivalent; counts verified against hand-written SQL                                                                                           |

**Conclusions.**

1. Every proposed card fits 1 GiB / 9 s on its own at every scope and window tested, with ≥ 2× memory headroom (largest org 30 d: 452 MiB / 3.8 s).
2. The org page does not fit at 30 d on the largest org as designed: its 13 statements run together on one replica and the token/cost cards (O1, O1s, O2, O6, P2 and its previous period) time out every load. At 24 h it fits (≤ 1.8 s). Memory is not the limit; time under contention is. Each of those cards reads ~3.8 GiB of `mastra_metric_events`. Options before shipping: fewer token/cost requests (O1, O1s, O2, O6 and P2 share the same usage scan), firing them in sequence, or a cheaper usage source.
3. The project page fits at 30 d on the largest project, at the edge: 6.6–8.7 s alone, and one of three loads timed out when today's cards ran alongside.
4. Only the tokens KPI can move off `metrics` without losing anything. Runs, runs over time and failure rate stay until `aggregateSpans()`; cost needs a decision on pricing-error rows; threads and usage over time change values.

**Follow-up: the org page with the verdicts applied** (largest org, 30 d, warm ×3). KPIs served from `metrics`, so the page's aggregate requests are the org-only cards.

| Variant       | Requests                                                                                   | Page ms       | Failed cards (each warm load)                           |
| ------------- | ------------------------------------------------------------------------------------------ | ------------- | ------------------------------------------------------- |
| `verdict`     | O1–O7 + today's 5 KPI requests                                                             | 9,186–11,399  | O1, O1s, O2, O6 every load (+ O7; load 1: all of O1–O7) |
| `verdict-all` | O1–O7 + all 17 of today's requests                                                         | 10,292–10,778 | O1, O1s, O2, O6                                         |
| `merged`      | O1 (also serves O6), O12s = O1s + O2 as one request, O3s, O3f, O4, O5, O7 + 5 KPI requests | 9,165–9,531   | O12s every load, O1 in 2 of 3                           |

The verdicts do not make the org page fit: the token/cost cards are what time out, and they have no `metrics` equivalent. Merging them down to two requests still leaves both past 9 s alongside the other cards; each reads ~3.8 GiB of `mastra_metric_events`. At 30 d on the largest org the org page needs a cheaper usage source (`mastra_model_usage` filled, or a rollup) or token/cost cards limited to a shorter window.

### X49: making the org Metrics page fit at 30 d (prod replica, read-only, 2026-10-20)

**Question.** X48's org page (largest org, 30 d) times out: its token/cost cards (O1, O1s, O2, O6, P2 + previous period) each take ~3.5 s alone but pass 9 s together. Which change makes the whole page fit 1 GiB / 9 s per statement with headroom (target: every warm statement ≤ 6 s and ≤ 700 MiB) at 24 h / 7 d / 30 d, without hiding data, and with values that match X48 or differ for a stated reason?

**Method.** `mobs-org-page-fit.ts` (reuses `mobs-metrics-page.ts`: same guard, `max_threads=16`, measure arm 4 GiB / 30 s, service arm under mobs-query's read limits, pool of 10 sockets) against Platform `main` 7ba265249 at `/tmp/platform-x48`. Candidate 2 needs one local, unshipped patch: `projectId` added to `METRIC_TYPED_COLUMNS` in `servers/mobs-query/src/services/metrics-aggregations.ts`. Subcommands: `facts` (usageId adoption), `stmt` (one statement split into parts and rewritten; exact rewrites checked by result digest), `c2` (token/cost from `metrics` vs `aggregateTraces()` + parity), `page` (whole org page per candidate), `c2check` (reshaped requests vs X48's, row by row), `c6` (read-only back-fill assessment), `nodes` (what the replica node did during each load). Largest org throughout; warm = median of 3 unless stated, plus 1 forced-cold.

**Facts.**

- `usageId` (mastra#26461, `@mastra/core` 1.76.0 / `@mastra/observability` 1.19.0) appears on 2026-10-09. By 2026-10-20, 41% of all token rows and 91% of the largest org's carry one; 47 of 140 orgs send it. Before 2026-10-09 the largest org wrote ~10× more token rows per day than after, so a 30 d window is still dominated by rows without `usageId`.
- `usageId IS NULL` is not in `mastra_metric_events`' sort key (`organizationId, projectId, name, timestamp, metricId`), so the fallback reads every token row in the window whatever the adoption rate. Its cost does not shrink as SDKs upgrade; only removing the fallback removes it.
- The 7 d org page also fails as X48 designed it: token/cost cards timed out in 2 of 3 warm loads.
- **The bench node is small.** Every connection lands on one node with 3 vCPU / 12 GiB (thread-slot soft limit 6). The other two nodes in the cluster have 16 vCPU / 64 GiB; the user that inserts observability data also runs its observability reads there (`query_log`, last hour). If mobs-query reads that service, X41–X49 latencies are pessimistic (memory per statement is not affected). Not verified which service mobs-query uses.

**Where the time goes** (`stmt`, O6 at 30 d, warm):

| Part                                 | MiB | ms    | Read rows | Read MiB |
| ------------------------------------ | --- | ----- | --------- | -------- |
| Full compiled statement              | 367 | 2,480 | 25.4 M    | 3,866    |
| Trace-root selection                 | 134 | 504   | 3.4 M     | 438      |
| `table_usage` (`mastra_model_usage`) | 20  | 21    | 57 K      | 9        |
| `fallback_usage`                     | 237 | 1,599 | 21.9 M    | 3,247    |
| Repeated-`metricId` set              | 218 | 313   | 5.4 M     | 698      |

The fallback is 84% of the bytes: it reads the window's token rows four times (main scan, repeated-`metricId` set twice, anti-join), and `EXPLAIN indexes=1` shows weak pruning (684 of 3,434 granules) because `projectId` sits between `organizationId` and `name` in the key.

**Candidates.**

| #   | Change                                                                                     | Cost (largest org, 30 d, warm)                                                                              | Parity                                                                                  | Verdict                                         |
| --- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------- |
| 1   | Fallback off, `mastra_model_usage` only                                                    | O6 209 MiB / 0.6 s / 448 MiB read; P2 174 MiB / 1.0 s                                                       | Loses tokens: 2–3% at 24 h, 4–7% at 7 d, 69–72% at 30 d (cost coverage 13% / 20% / 64%) | No (until back-filled, #6)                      |
| 2   | Org token/cost cards from `metrics`: one series grouped by `projectId` × `name`            | 127 MiB / 0.39 s / 505 MiB read (vs `aggregateTraces()` 437 MiB / 3.0 s / 3.9 GiB)                          | See below: differences are X48's known ones                                             | **Yes** (as `c2m`)                              |
| 3   | One shared `aggregateTraces()` statement for all token/cost cards + previous period        | Page warm 6.7–6.8 s, shared statement 6.6–6.8 s                                                             | Exact (same compiler)                                                                   | No: no headroom                                 |
| 4a  | Fallback in one grouped pass (`1pass`)                                                     | 751–778 MiB / 1.8–1.95 s / 1.56 GiB read                                                                    | Exact (digest; an early mismatch was live ingestion between runs, re-run interleaved)   | No: trades reads for memory                     |
| 4b  | Fallback in two passes (`2pass`)                                                           | 755 MiB / 3.1 s / 2.4 GiB read                                                                              | Exact to ~1e-16                                                                         | No: worse at 30 d                               |
| 5   | Load shape on X48's requests: staged, sequential, one connection per card, concurrency cap | All variants fail O1/O1s/O2/O6 warm; sequential pages take 21–31 s; `-spread` lands on the same node anyway | n/a                                                                                     | No (alone)                                      |
| 6   | Back-fill + fill-forward `mastra_model_usage`, fallback removed                            | Estimated below                                                                                             | Assessed below                                                                          | Recommended (Platform), not needed for the page |

At 7 d both rewrites win cleanly (`1pass` 158 MiB / 0.28 s vs full 170 MiB / 0.46 s), but 7 d was never the problem once the page is reshaped.

**Candidate 2 parity** (`metrics` minus `aggregateTraces()`, per project, largest org): the series and the breakdown agree exactly (0%). Against `aggregateTraces()`, input/output/cache-read totals are 6.3–7.5% higher at 24 h, 3.1–3.6% at 7 d, 0.6–1.2% at 30 d: the same absolute amount over a longer window, i.e. X48's window-edge attribution (`metrics` counts a token row by its own timestamp; `aggregateTraces()` by its trace's start, and drops traces still running). Cost is 6.9% higher at 30 d: most of it is the pricing-error rows `aggregateTraces()` excludes (`CLEAN_COST_SQL` splits the two). This is the cost question X48 left open; on the org page it now matches today's project-page KPI.

**The page that fits: `c2m`.** Token/cost from `metrics` (candidate 2), O1/O1s without token measures, O3s + O3f merged into one request (`groupBy projectId × entityName`, limit 1000, ranked client-side), KPIs from `metrics`: 12 requests. `c2check`: the reshaped O1, O1s, O3s and O3f match X48's requests in every row at 24 h / 7 d / 30 d (15 / 22 / 30, 156 / 1,006 / 381, 20, 20 rows; same order; the 1000-entity request never truncated).

Whole page, largest org, warm (all runs: `x49`, `x49-confirm`, `x49-repeat`, `x49-cap3`):

| Window | Variant                  | Loads | Failed loads | Page ms, median / max | Slowest statement, median / max | Statements > 6 s | Max MiB |
| ------ | ------------------------ | ----- | ------------ | --------------------- | ------------------------------- | ---------------- | ------- |
| 24 h   | `c2m` (all at once)      | 3     | 0            | 636 / 728             | 455 / 486                       | 0                | 116     |
| 24 h   | `c2m-cap3`               | 8     | 0            | 718 / 742             | 163 / 223                       | 0                | 171     |
| 7 d    | `c2m`                    | 3     | 0            | 1,571 / 1,899         | 1,413 / 1,756                   | 0                | 188     |
| 7 d    | `c2m-cap3`               | 8     | 0            | 1,473 / 1,985         | 489 / 703                       | 0                | 182     |
| 30 d   | `c2m`                    | 14    | 2            | 5,709 / 12,048        | 5,541 / 9,220                   | 2                | 374     |
| 30 d   | `c2m-cap6`               | 14    | 0            | 4,964 / 9,801         | 4,374 / 8,973                   | 1                | 380     |
| 30 d   | `c2m-cap3` (3 at a time) | 16    | 1            | 5,390 / 13,907        | 2,331 / 9,079                   | 2                | 357     |
| 30 d   | X48 `base`               | 3     | 3            | 13,950 / 14,062       | 9,048 / 9,052                   | 3                | 501     |

Cold (filesystem cache off) fails at every window for every variant, as in X43/X48.

**Why some 30 d loads still fail** (`nodes`). No other heavy query ran on the node during any failed load. Two causes, both on the 3-vCPU node:

1. _Uncapped concurrency._ 12 statements share 6 thread slots (`concurrent_threads_scheduler = max_min_fair`); the node runs ~2.1 cores busy and some statements get starved past 9 s (`x49-repeat` `c2m` load 1: no fetches, 8 queries in flight, 4 cards failed). Capping the page at 3 requests in flight keeps the page time (median 5.4 s vs 5.7 s) and cuts the slowest statement from ~5.5 s to ~2.3 s (median).
2. _Replication fetch bursts._ While the node fetches parts (13–30 concurrent fetch tasks vs ~0.5 normally), its query CPU halves (2.1 → 0.8–1.0 cores) and every statement takes 2–3× longer. All three remaining slow or failed loads coincide with one (`x49-confirm` `c2m` load 3: 30 fetches; `x49-cap3` loads 3 and 8: 24 and 13). Over the last 4 h about 3% of the node's seconds were in such a burst. No load shape survives a burst on this node size.

So: with `c2m-cap3`, 14 of 16 30 d loads kept every statement ≤ 3.5 s (headroom ≥ 2.5×); the 2 others fell in fetch bursts. Memory is never close (≤ 380 MiB/statement).

**Candidate 6: back-fill + fill-forward `mastra_model_usage`** (`c6`, read-only; recommendation for Platform). Key token rows without a `usageId` by `'m:' || metricId` in `mastra_mv_model_usage` (`coalesce(nullIf(trimBoth(usageId), ''), concat('m:', metricId))`), back-fill history with `INSERT … SELECT`, then remove the fallback.

- **(a) Correctness vs the fallback.** Same dedup rule: one value per key, `max()` (the fallback dedups by `cityHash64(metricId)`, equal barring a hash collision). Facts: 0 token rows without `usageId` lack `organizationId`/`projectId`/`traceId` (the MV's filter drops none); 0 repeated `metricId`s among them; 0 of 5.0 M `metricId`s (30 d) appear in more than one trace, and the key is scoped by `(organizationId, projectId, traceId)` anyway, so no cross-tenant collision; 0 real `usageId`s start with `m:`. Cost and `pricingFailure` come from the same columns with the MV's existing per-row rules. One intended divergence: today a trace with any `usageId` row drops all its rows without one (trace-level anti-join); derived keys count them. That is 6 of 345 K traces since 2026-10-08, 0.0014% of tokens. One shape change: an untagged model call becomes 4 usage rows (one per token metric) instead of 1; sums are unchanged, but anything counting usage rows (if cost coverage is weighted by rows) must be checked during parity.
- **(b) Size.** ~7.3 M token rows without `usageId` across retention (Aug 0.7 M, Sep 3.7 M, Oct 2.9 M; nothing earlier but a few hundred). `mastra_model_usage` today: 59 K rows, 3.1 MiB on disk. Back-filled: ~7.3 M rows, ~0.4 GiB on disk (token rows are 18% of `mastra_metric_events`' 2.3 GiB; same density as today's table). Back-fill read for the busiest month: 3.2 GiB / 14 M rows read, 322 MiB, 1.4 s on the 3-vCPU node; the writes (3.7 M rows/month) must run on the primary service.
- **(c) Query cost, fallback off, back-filled table.** Proxied from `mastra_metric_events` grouped by the derived key (its reads are an upper bound: those rows are wider and keyed differently): largest org 7 d 129 MiB / 0.1 s / 161 MiB read; 30 d 520 MiB / 0.7 s / 0.94 GiB read, 1.54 M usage keys from 1.59 M token rows. With the selection (134 MiB / 0.5 s / 438 MiB) that puts a 30 d org token statement at roughly 1.2 s and ≤ 1.4 GiB read (vs 2.5–3.6 s / 3.9 GiB today), but memory near ~650 MiB, above today's 367–434 MiB, because per-row keys mean ~1.5 M groups instead of ~0.06 M. The lower bound (table holding only today's rows) is candidate 1's 209 MiB / 0.6 s. Measure on a lab copy with `optimize_aggregation_in_order` before relying on it; the memory will shrink as the back-filled rows age out (6-month TTL on both tables).
- **(d) `spanId` for OBS-392.** `mastra_model_usage` has no `spanId` (X46), so `aggregateSpans()` per-span usage reads `mastra_metric_events`. All rows of one emission share a span (rolled-up calls share their ancestor's), so a non-key `spanId` column (`SimpleAggregateFunction(any, Nullable(String))`) is correct for both real and derived keys; key stays `usageId` (keying by span drops rolled-up calls, X35). Add it in the same migration: the back-fill rewrites history once; adding it later needs a second back-fill.
- **(e) Rollout.** (1) Create the new MV alongside the old one, then drop the old: while both run, duplicate rows have the same key and values and collapse under `max()`, so no gap and no double count. (2) Back-fill oldest month first up to the switch time plus a margin (idempotent, overlap harmless), on the primary service. Keep the fallback on throughout: the anti-join is per trace, so double counting is impossible; the risk is a transient *under*count for traces straddling a batch boundary or the switch time, until their other rows land, so run the batches back to back. (3) Parity: fallback on vs off over 24 h / 7 d / 30 d / retention, expect equality. (4) Turn the fallback off (`TRACE_AGGREGATE_USAGE_FALLBACK`), later delete it. TTLs already match (6 months on `timestamp`; back-filled rows keep their original timestamp).

**Conclusions.**

1. Ship `c2m` for the org page: token/cost cards from `metrics` grouped by project (needs `projectId` groupable on `metrics`, a one-line mobs-query change), O1/O1s without token measures, O3s/O3f as one request ranked client-side, KPIs from `metrics`. Values match X48 exactly for the reshaped `aggregateTraces()` requests; token/cost values are today's `metrics` values (X48's attribution differences, cost includes pricing-error rows).
2. Cap the org page at 3 requests in flight in playground-ui. Same page time, slowest statement ~2.3 s instead of ~5.5 s at 30 d (median).
3. With both, the page fits at 24 h (≤ 0.75 s), 7 d (≤ 2 s) and 30 d (page median 5.4 s, statements ≤ 3.5 s) on the 3-vCPU bench node, except during its replication fetch bursts (~3% of the time), when 1 of 16 loads failed. Cold loads fail everywhere, as before.
4. Statement rewrites and load shapes alone do not fix X48's design; removing the fallback without a back-fill loses up to 72% of 30 d tokens.
5. Candidate 6 is worth doing on Platform for `aggregateTraces()` token measures in general (project page, Traces aggregates, OBS-392), with `spanId` in the same migration; the org page does not depend on it.

**Follow-ups (not filed).** `projectId` is not in `METRIC_TYPED_COLUMNS` (`servers/mobs-query/src/services/metrics-aggregations.ts:30`), so `groupBy: ['projectId']` on `metrics` falls through to the label lookup and returns empty groups today; add it (with a test) before the org page ships. Confirm which ClickHouse service mobs-query reads in production; if it is the 16-vCPU service, re-run `c2m` there or treat these latencies as an upper bound.

**Addendum: `usageId` in mobs-collector for older SDKs (2026-10-20, code + `collector` subcommand, all orgs, token rows since 2026-09-20).** Goal: once `mastra_model_usage` is back-filled, stop new untagged rows piling up by having `formatAiMetricRecord` (`servers/mobs-collector/src/lib/ai-signals.ts`, `usageId: metric.usageId ?? null`) fill a key, so the fallback can go for good. `mastra_mv_model_usage` already takes any row with a `usageId`, so no MV change is needed.

What older SDKs send (mastra before #26461, `@mastra/observability` < 1.19.0): `emitUsageMetrics` emits one row per token metric; `MetricsContextImpl.emit` gives each row its own `metricId` and its own `timestamp: new Date()` (ms). Nothing ties a call's rows together except the span's `traceId`/`spanId`. Since #16434 (2026-05-18) `applyUsageRollup` re-emits every hidden `MODEL_GENERATION`'s usage under the visible ancestor's span, so one span carries any number of calls, emitted synchronously inside `end()`, often back to back. `metricId` is created at emit time, before export, so export retries resend it; the collector already dedups by it.

Measured (rows that carry a real `usageId` are ground truth for "one call"):

| Key                            | Rows              | What happens                                                                                                                                                            |
| ------------------------------ | ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `(traceId, spanId)`            | tagged / untagged | Merges calls: 32 tagged spans hold more than one call (up to 285, rolled up); 12,964 untagged spans repeat a metric name                                                |
| `(traceId, spanId, timestamp)` | tagged            | 0 of 67,896 keys merge two calls, 0 tokens lost; but 6,436 of 61,414 calls (10%) spread their rows over several ms (up to 149 ms), so it is not one key per call either |
| `(traceId, spanId, timestamp)` | untagged          | 20 keys repeat a metric name, i.e. hold two calls: under `max()` per key, 50 rows / 1.56 M tokens are silently dropped (0.001%). 1.88 M keys for 4.89 M rows            |
| `'m:' \|\| metricId`           | untagged          | One key per row, 4.89 M keys; never merges anything (0 repeated `metricId`s, 0 shared across traces, X49 c6)                                                            |

All 4.89 M untagged rows have `traceId`, `spanId` and `projectId`.

1. **Simplest key, `'m:' || metricId`.** Exact parity with the fallback (same one-value-per-`metricId` rule; the only difference is mixed traces, 0.0014%, which it counts and the fallback drops). Cost is the c6 estimate: ~4 usage rows per untagged call, ~650 MiB for a 30 d largest-org token statement, falling as SDKs upgrade (91% of the largest org's new rows are already tagged) and as old rows age out under the 6-month TTL.
2. **Per-call key.** Not provable, and disproved on real data: no field separates two rolled-up calls on one span that end in the same millisecond, and 20 keys in 30 days did exactly that. Because `mastra_model_usage` keeps `max()` per key, a merge drops tokens silently instead of doubling them. A hybrid ("use the span key unless a name repeats") cannot work in the collector: it sees one export batch at a time and nothing guarantees a call's rows share one, and two calls with disjoint metric names would still merge. The saving it would buy is ≤ 2.6× fewer keys on untagged rows only, a shrinking population.
3. **Retries.** `'m:' || metricId` is stable: `metricId` is fixed before export and resent on retry; duplicates collapse under `max()` (same value) as they do today.
4. **Rows without `traceId`/`spanId`.** None in 30 days. If one arrives, `mastra_mv_model_usage` skips it (`traceId IS NOT NULL`), and `aggregateTraces()` never counted it (usage joins to trace roots), so nothing changes; `metrics` still sees it in `mastra_metric_events`.
5. **Rollout.** (1) Collector sets `usageId = 'm:' || metricId` when missing, from time _T_ (exact string, no trimming, so the back-fill reproduces it). From _T_ every new row has a `usageId` in `mastra_metric_events` too, so the fallback (which reads only rows without one) stops seeing new rows and the MV picks them up: a row is in exactly one path, no double count. (2) Back-fill `mastra_model_usage` from `mastra_metric_events` for rows with no `usageId` and `timestamp < T + margin`, with the **same** key (it must: any other key for the same row double-counts it, since `max()` only collapses identical keys). Overlap with the collector's rows is harmless. Until the back-fill reaches them, traces straddling _T_ lose their pre-_T_ untagged rows (the fallback's anti-join is per trace): a transient undercount, so back-fill right after the deploy. (3) Parity fallback on vs off at 24 h / 7 d / 30 d / retention, expect equality. (4) Fallback off, then delete it. With the key set in the collector, the MV `coalesce(...)` change from c6 is unnecessary; keep only the `spanId` column.

**Recommendation (superseded by addendum 2):** `'m:' || metricId` in mobs-collector and in the back-fill. Do not derive a per-call key; consumers must not read `usageId` as "one model call" for `m:` keys (count calls by real ids only).

**Addendum 2: one usage row per span, vs fallback off (2026-10-20, `stmt --shape P2` + `collector`).** Decision: approximate usage for older SDKs is acceptable. A back-fill or collector fill is only worth doing if each span collapses to one usage row, and that row must _sum_ the span's calls. `'m:' || metricId` is dropped: it just copies the token rows. Two options compared against today (`full`, fallback on), on P2 (org token/cost KPI) for the largest org, warm median of 3:

- **(a)** One usage row per `(traceId, spanId)` for untagged rows, fallback off.
- **(b)** Fallback off, no back-fill or collector fill: untagged rows drop out.

How (a) was measured. The replica is read-only, so no table could be built.

- **Memory and time:** `syn` feeds the compiled fallback-off statement a merged usage table generated in memory (`numbers()`), with the real cardinalities: the real table's rows plus one row per untagged span, and the real number of traces. Calibration: with today's table cardinality (22 K rows / 7.1 K traces at 30 d) `syn` uses 148.5 MiB vs the real fallback-off statement's 152.6 MiB. Its `usageId`s are shorter than real ones, so it slightly understates memory.
- **Reads:** `syn` reads only the selection. Add the table at ~218 B/row uncompressed (today's table: 12.3 MiB / 59 K rows).
- **Cross-check:** `bf-span` emulates the same table as the MV's unmerged per-row output read from `mastra_metric_events`. Its reads and memory are upper bounds.

| Window | Today (`full`)                  | (b) fallback off           | (a) per-span table (`syn`)      | (a) upper bound (`bf-span`) |
| ------ | ------------------------------- | -------------------------- | ------------------------------- | --------------------------- |
| 24 h   | 111 MiB / 0.26 s / 153 MiB read | 50 MiB / 0.08 s / 31 MiB   | 58 MiB / 0.07 s / ~28 MiB       | 102 MiB / 0.22 s / 63 MiB   |
| 7 d    | 176 MiB / 0.68 s / 662 MiB      | 97 MiB / 0.19 s / 77 MiB   | 93 MiB / 0.13 s / ~70 MiB       | 147 MiB / 0.44 s / 241 MiB  |
| 30 d   | 410 MiB / 3.5 s / 3,916 MiB     | 153 MiB / 0.62 s / 456 MiB | **454 MiB** / 0.85 s / ~565 MiB | 523 MiB / 1.4 s / 1,531 MiB |

Per-span cardinality, largest org: 1,148 / 4,966 / 541,087 untagged spans (2.8–3.0 token rows each) over 866 / 3,831 / 510,003 traces. At 30 d nearly all of them predate `usageId` (2026-10-09).

What goes missing:

| Option                | Largest org, tokens / cost lost                         | All orgs, tokens / cost lost                                                                                              |
| --------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| (a) per span, `sum`   | 0                                                       | 0                                                                                                                         |
| (a) per span, `max()` | 0 / 0                                                   | 0.060% / 0.032% (24 h), 0.018% / 0.006% (7 d), 0.011% / 0.011% (30 d): spans holding several calls                        |
| (b) fallback off      | 2.5% / 4.2% (24 h), 4.1% / 7.5% (7 d), 68% / 71% (30 d) | 27% / 37% (24 h), 56% / 56% (7 d), 84% / 87% (30 d); 124 of the 203 orgs active in the last 24 h still send untagged rows |

Can the per-span row sum, yet count a retried export (same `metricId`) once?

- **Not in the table engine or MV.** `mastra_mv_model_usage` fires once per insert. `mastra_metric_events` drops duplicate `metricId`s only when it merges (ReplacingMergeTree), so a re-delivered row reaches the MV again. A summing engine (SummingMergeTree or `SimpleAggregateFunction(sum)`) would add it twice, and no engine dedups on a column outside its key. That leaves `max()`, with the loss above.
- **Safe in the collector, per request.** The SDK retries by resending the identical body: `CloudExporter.batchUpload` reuses one `JSON.stringify` (3 retries), and a batch that still fails is dropped, not re-batched. So the collector can:
  - dedup the request's untagged token rows by `metricId` and sum them per `(traceId, spanId)`;
  - key the row `'s:' || spanId || ':' || hash(sorted metricIds)` and write it straight to `mastra_model_usage`, outside the MV;
  - leave the `mastra_metric_events` rows untagged.

  A retry produces the same key and value, which collapse under `max()`. A span whose rows arrive in two requests gets two keys, which the query already sums per trace. While the fallback is still on, its trace-level anti-join keeps the two paths exclusive.

  Whether anything between the collector and ClickHouse can resend a _subset_ of a request is answered in addendum 3: it can, so the row must be built in the collector and published as its own message.

- **Safe in the back-fill.** Take `any()` per `metricId` (to drop unmerged duplicates), then sum per `(organizationId, projectId, traceId, spanId)` with key `'s:' || spanId`, inserted directly. Re-running is safe: a span's sum only grows as late rows land, and `max()` keeps the larger. Two conditions:
  - Batch by trace (e.g. `cityHash64(traceId) % N` over the whole retention), never by time. Otherwise a span split across batches leaves two partial sums under one key, and `max()` keeps only one.
  - Take only rows before the collector switch time _T_. A span straddling _T_ then gets one back-fill row and one collector row, under different keys, summed by the query.

Earlier figures corrected:

- **X49 c6's "~650 MiB" was too low.** Its 520 MiB was measured on keys derived on the fly from `mastra_metric_events`, for the usage part only, and the 650 added the selection by hand. On the fly overstates _reads_, not memory. With the real cardinality of an `'m:'` table (1.54 M keys / 517 K traces), `syn` puts the whole 30 d statement at 901 MiB / 1.45 s.
- **Memory is driven by both keys and traces.** The per-span table has 2.7× fewer keys than `'m:'` but the same number of traces, which is why it still needs 454 MiB.

**Verdict.** Don't do (a) now: at 30 d it doesn't beat today's memory (454 vs 410 MiB, +11%), though it cuts time 4× and reads ~7×. At 24 h / 7 d it halves memory, but those windows already fit, and (b) costs the same there. The 30 d cost is the backlog from before 2026-10-09. It leaves the 6-month TTL by ~April 2027, after which a per-span table is about as cheap as (b) (the largest org adds ~700–1,100 untagged spans a day now, ~30 K per 30 d). (b) is the memory floor at every window, but today it drops 27–87% of all orgs' tokens and cost. It is acceptable only once older SDKs are rare; track that with the adoption query in mobs-query's README. Keep the fallback until then. If (a) is revisited, use `sum` in the collector (per request) and in the back-fill, keyed as above. `max()` would lose ≤ 0.06% of tokens and is the fallback if per-request summing can't be guaranteed.

#### Addendum 3: does the collector per-span row survive Platform redelivery? (code reading, 2026-10-20)

Question: the collector→writer Pub/Sub path is at-least-once. Addendum 2's collector row (key `'s:' || spanId || ':' || hash(sorted metricIds)`, value = per-request sum) is safe only if every redelivery carries the same set of rows. Where can a span's rows be regrouped on retry?

Method: read the path end to end on Platform `origin/main` (f5e7df76a; the collector and writer differ from the X48 checkout only by dependency bumps and one comment) and mastra `main`. No replica queries.

| Stage                                                                          | Unit of retry / redelivery                                                                                                                                                                                                                                                                                                                                                                                                  | Can a span's rows be regrouped?                                                                                                           |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| SDK export (`CloudExporter.batchUpload`, `MastraPlatformExporter.batchUpload`) | One request. The body string is built once and `fetchWithRetry` resends the same `RequestInit` (3 attempts, exponential back-off). A batch that still fails is dropped, never re-buffered; 402 drops without retry. Since the metrics export began (`a0a516db7e5`, 2026-04-07) no version re-batches.                                                                                                                       | **No.** A span's rows can land in two _different_ requests (a size flush at 1,000 events mid-emit), but each request resends identically. |
| Collector (`routes/ai.ts` `publishAiSignal`)                                   | The whole request: validated and formatted all-or-nothing (400 on any bad record), then **one Pub/Sub message per metric row** (`formattedRecords.map(JSON.stringify)` → `batchPublish`). Publishes race a 10 s timeout; any failure returns 500, but the messages already published stay published, and the SDK resends the whole body.                                                                                    | Not within the collector, but a 500 leaves a partial set in the queue followed by the full set.                                           |
| Collector ids (`prepareItemsWithGeneratedIds`)                                 | Rows without `metricId` get `platform-generated:<randomUUID>`, a different id on every retry. SDKs exported metrics without `metricId` from 2026-04-07 until `8f1b280b7fe` (2026-04-21).                                                                                                                                                                                                                                    | The rows don't move, but their identity changes, so `hash(sorted metricIds)` would differ on retry.                                       |
| Pub/Sub (`ai-metrics` topic; ch-writer and autumn-writer subscriptions)        | Per message. The publisher batches up to 100 messages / 100 ms per RPC (transport only). No ordering keys. The writer uses unary `pull` and never extends ack deadlines, so a slow insert lets messages expire and go to another writer pod (HPA 2–15 replicas). The ack deadline and any dead-letter policy for the prod subscription are not in the repo; locally only the autumn subscriptions have a DLQ (10 attempts). | **Yes.** Messages of one request are redelivered individually, in any mix, any number of times.                                           |
| mobs-ch-writer (`Ingester.processBatch`)                                       | Pulls ≤ 1,000 messages from any requests, inserts them as one `JSONEachRow` block, and acks only rows that transformed; rows that fail to transform stay unacked and come back alone. A failed insert (after 2 retries in `withInsertRetry`) acks nothing, so the whole pull is redelivered, regrouped. A retry after a timed-out-but-committed insert writes the block twice.                                              | **Yes.** Every insert block is an arbitrary subset of many requests.                                                                      |
| `mastra_mv_model_usage`                                                        | Fires once per insert block, i.e. on the writer's arbitrary subsets.                                                                                                                                                                                                                                                                                                                                                        | **Yes**, as above.                                                                                                                        |

Conclusions:

- **The request is the last point where a span's rows are a fixed set.** After the collector splits it into one message per row, Pub/Sub and the writer regroup freely. So the sum must be computed in the collector, before publishing.
- **The writer can't do it "per message":** a message is one row. It would only work if the collector published a whole request as one message, which changes the writer, the autumn-writer and message sizes for every signal. Not worth it.
- **Stamping the key on the raw rows doesn't work.** If the collector set `usageId = 's:…'` on each untagged token row and let the existing MV build the usage row, a span holding two calls would have two `mastra_model_total_input_tokens` rows under one key, and the MV's `max()` keeps one. That's addendum 2's `max()` loss, not a sum.
- **Rewriting raw rows into summed rows would work but changes billing.** autumn-writer bills metric messages on the same topic at 20 : 1 (`METRIC_TO_OBSERVABILITY_RATIO`). Collapsing rows, or adding usage rows to `ai-metrics`, changes what orgs are billed. It would also put the summed rows in `mastra_metric_events`, which the `metrics` endpoint reads.

What makes the collector row safe:

1. Build it in the collector from the formatted request: untagged token rows only (rows with a real `usageId` stay on the MV path), deduplicated by `metricId`, summed per `(traceId, spanId)`. Key `'s:' || spanId || ':' || sha256(sorted metricIds)`; the table's `traceId` key column already separates traces.
2. Leave out rows whose `metricId` the collector generated (`platform-generated:` prefix), or hash their content (trace, span, name, value, timestamp) instead of the id. Otherwise each SDK retry produces a new key. These rows already double count today, because the fallback dedups by `metricId`; X49 c6 found none in retention (no token rows before June), so it's a guard, not a measured case.
3. Publish each usage row as **its own message on a new topic** (e.g. `ai-usage`) with its own subscription and a ch-writer deployment where `CLICKHOUSE_TABLE_NAME=mastra_model_usage` (plus a row transformer). The raw rows on `ai-metrics` stay unchanged, so billing and the `metrics` endpoint are unaffected. Each message is then a complete row: redelivery, pod hand-off, regrouped inserts and double-committed blocks all repeat identical `(key, values)` and collapse under `max()`.
4. Publish usage rows in the same `batchPublish` as the raw rows, before returning 200. A failure returns 500 and the SDK resends the whole request, which rebuilds the same rows. If the SDK gives up, that span loses its usage row the same way the raw rows are lost today.
5. Set a dead-letter policy and alert on the new subscription. A message that never transforms is lost when retention expires; today's ch-writer subscriptions don't show one in the repo, so check prod.

Unverified: the prod ack deadline, message retention and dead-letter settings of `prod.platform.ai-metrics-sub` (managed outside this repo). They affect how often duplicates and losses happen, not whether the per-message row stays correct.

### X51: the project Metrics page as OBS-698 ships it (prod replica, read-only, 2026-10-20)

**Question.** OBS-698 (mastra#27908–#27910, drafts) moves the project page's Tokens KPI to `aggregateTraces()` and adds five `aggregateTraces()` cards. Does one whole page load, fired the way the browser fires it, keep every statement within mobs-query's 1 GiB / 9 s on the p99 and largest project at 24 h / 7 d / 30 d?

**Method.** `mobs-obs698-page.ts` (reuses `mobs-metrics-page.ts`: same guard, project picks, `max_threads=16`, pool of 10 sockets, mobs-query service functions under its read limits) against Platform `main` 9a9bb051d at `/tmp/platform-obs698` (includes OBS-688, root `spanType` grouping). All 60 request bodies plan and compile offline first (`dry`). Per load, the 9 aggregate requests go through a 3-slot FIFO limiter in render order (as `MAX_TRACE_AGGREGATES_IN_FLIGHT` does) and the 15 `metrics` requests that stay (today's 17 minus the tokens KPI pair) fire at once, no page filter:

| Request             | Body                                                                                                                   | Reads the token/cost fallback |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------- | ----------------------------- |
| `a:kpi-tokens`      | `tokens.input.sum`, `tokens.output.sum`                                                                                | yes                           |
| `a:kpi-tokens-prev` | same, previous window                                                                                                  | yes                           |
| `a:latency`         | `duration.p50/p90/p99` by `spanType`, `interval`, limit 10                                                             | no                            |
| `a:top-entities`    | `count, errorRate, errorCount, duration.p95, cost.sum` by `entityType × entityName`, limit 500                         | yes                           |
| `a:breakdown-*`     | `count, errorRate, cost.sum` by `environment` (on load) or `executionSource` (tab, measured alone as `exec`), limit 50 | yes                           |
| `a:distinct-series` | `countDistinct.userId/sessionId`, `interval`, limit 10                                                                 | no                            |
| `a:distinct-totals` | same, no interval                                                                                                      | no                            |
| `a:cost-total`      | `cost.sum`                                                                                                             | yes                           |
| `a:cost-series`     | `cost.sum`, `interval`, limit 10                                                                                       | yes                           |

Variants: `obs698` (the new page), `today` (main's page, 17 `metrics` requests), `exec` (the breakdown tab alone). Cold ×1 (filesystem cache off) then warm ×3, 72 loads plus one cold recheck (`x50-recheck`). Interval is `1h` to 14 d, else `1d`, as the page picks.

**Results, warm** (3 loads each; page and slowest-statement are median / max):

| Project | Window | New page ms     | Today's page ms | Slowest statement ms | Statements > 6 s | Loads with a failed card | Max MiB | Max concurrent MiB | Read per load |
| ------- | ------ | --------------- | --------------- | -------------------- | ---------------- | ------------------------ | ------- | ------------------ | ------------- |
| p99     | 24 h   | 1,058 / 2,690   | 427             | 416 / 1,989          | 0                | 0                        | 96      | 244                | 0.5 GiB       |
| p99     | 7 d    | 3,409 / 9,688   | 820             | 3,158 / 9,540        | 1                | 1 (warm #1)              | 145     | 366                | 2.3 GiB       |
| p99     | 30 d   | 11,722 / 13,895 | 2,007           | 9,308 / 9,404        | 5                | 2 (warm #1, #2)          | 187     | 764                | 7.2 GiB       |
| largest | 24 h   | 1,241 / 2,286   | 539             | 271 / 370            | 0                | 0                        | 80      | 192                | 0.3 GiB       |
| largest | 7 d    | 2,624 / 3,399   | 936             | 1,758 / 3,250        | 0                | 0                        | 122     | 353                | 1.8 GiB       |
| largest | 30 d   | 15,624 / 21,329 | 2,383           | 7,590 / 9,457        | 9                | 1 (warm #1)              | 404     | 1,150              | 14.2 GiB      |

Today's page never has a statement over 1.8 s warm. The `exec` tab alone fits warm everywhere (≤ 2.8 s, ≤ 338 MiB).

Largest project, 30 d, per aggregate card (warm median of the slowest statement / read): tokens 5.9 s / 1.9 GiB, tokens previous 7.6 s / 1.9 GiB, top entities 6.3 s / 2.0 GiB, breakdown 5.9 s / 2.0 GiB, cost series 5.0 s / 2.0 GiB, cost total 4.1 s / 2.0 GiB, latency 4.3 s / 111 MiB, distinct series 2.0 s / 120 MiB, distinct totals 1.8 s / 120 MiB. Alone, X48 measured the tokens shape (P2) at 2.3 s on this project and 1.0 s on the p99 one; on the page the six fallback readers (~12 of 14 GiB read per load) slow every card, including the three that don't read it.

**Results, cold.** 24 h: 0–1 of 24 requests fail (excluding the stalled load below). 7 d: 14–16 of 24 fail, 7–9 aggregates (each statement hits 9 s at 17–65 MiB; cold is object-storage time, not memory) **and 7 of today's `metrics` requests, which never fail cold at 7 d on today's page**. 30 d: 24 of 24 fail; today's page also fails all 17 there, as in X43/X48. The first warm load after a failed cold load is part-cold (the aborted statements left the cache partly filled), which is where the p99 7 d and both 30 d warm #1 failures land.

**Unexplained.** The first load of the run (p99, 24 h, cold) stalled client-side: the first three aggregate statements finished on the server in 4.5–9.4 s but their calls hit mobs-query's 20 s deadline (`2 × 9 s + 2 s`, counted from the call, so it includes socket wait), the queued six timed out at 40 s and 60 s without reaching the server, and the `metrics` calls whose statements finished by ~5 s resolved at ~80 s. A fresh-process repeat (`x50-recheck`) loaded every card cold in 20 s (slowest statement 8.7 s). Not reproduced; recorded as a one-off.

**Verdict.** Memory fits with ≥ 2.5× headroom everywhere. 24 h and 7 d fit on time (7 d's one failure follows a failed cold load). **30 d does not fit**: 3 of 6 warm loads lose cards at 9 s; of the other three, the largest project's two have 2–3 statements over 6 s and finish in 15.5 s, and only the p99 project's third stays under 6 s (8.4 s page). Today's page takes ~2 s there. Cold, the new page also takes down existing cards at 7 d. The cause is the token/cost fallback read six times per load, as on the org page in X49. The OBS-698 PRs stay drafts.

**Options (not run; each removes fallback readers from the initial load).**

1. Keep the Tokens KPI on `metrics` (today's `m:kpi-tokens-*` ≤ 1.7 s at 30 d). Removes the two slowest requests; same direction as X49's org-page verdict (KPIs from `metrics`). Reverses part of the X48 decision.
2. Request `cost.sum` in Top entities only when the "Most expensive" tab opens, and drop the cost column from Trace breakdown (or fetch it on demand). Removes two more.
3. Back-fill `mastra_model_usage` and turn the fallback off (X49 candidate 6); makes every remaining usage read ~10× cheaper but is a Platform change with its own rollout.

With 1 + 2 the initial load keeps two fallback readers (cost total and cost series). Re-run `mobs-obs698-page.ts page --windows 30d` on the changed page before the PRs leave draft.

Reproduce: `npx tsx mobs-obs698-page.ts dry`, then `page --label x50 --windows 24h,7d,30d --variants obs698,today,exec --reps 3`, then `report --label x50` (results in `results/mobs-obs698-page.jsonl`). Run before renumbering, so the results keep the label `x50`.

### X52: bounding the per-span usage read of `aggregateSpans()` (prod replica, read-only, 2026-10-21)

**Question.** Review of platform#3633 and mastra#27857 (OBS-392). The span aggregate reads usage rows from `mastra_metric_events` with tenant + `timestamp >= from` only, so its cost grows with how far back `from` is, not with the window's length. Which spans carry usage, how late does usage arrive after a span starts, and which bound keeps the read affordable without changing results: an upper bound `timestamp < to + LAG`, or a `traceId IN (…)` semi-join? Also: does a branch-path (`mastra_trace_branches`) request with token/cost measures fit at org scope over full retention? No X50 branch shape (A1, A2, S1, S3, S9) had a usage measure.

**Method.** `mobs-span-usage-bound.ts`. It compiles each request with platform#3633's own `planPlatformSpanAggregate()` + `compileClickHouseSpanAggregate()` (`/tmp/platform-obs392` at f642fc541, before the bound shipped) and splices each variant into the four usage-row filters of the compiled SQL (asserted by count, so a compiler change fails loudly). Variants:

- `current`: tenant + `timestamp >= from` (as reviewed);
- `upper`: + `timestamp < to + 30 d` (`--lag-hours 720`);
- `semi`: + `traceId IN usage_traces`, a light CTE of distinct trace IDs of spans starting in the window (same table, tenant and positive `spanType` prefilter as the selection, no copy collapse);
- `semiSel`: + `traceId IN (SELECT traceId FROM selected)` (re-runs the full selection);
- `semiUpper`: `semi` + `upper`.

Shapes: U1 = `spanType = model_generation` grouped by `rootEntityName`; U2 = `spanType = agent_run` (branch path) grouped by `entityName`. Both measure `count`, `tokens.input.sum`, `tokens.output.sum`, `tokens.total.avg`, `cost.sum`. Cells: `now7` (7 d ending now), `past7` (7 d ending 14 d ago), `hist7` (7 d ending 90 d ago), `branch180` (U2 only, org, 180 d ending now). Largest project and largest org (`profile.ts` selection). Per cell and variant: cold ×1, warm ×2 at `max_threads = 16` without limits, then one call at mobs-query's 1 GiB / 9 s. Results compared by digest of the rows (floats rounded to 9 significant digits; sum order isn't deterministic). Facts queries first (`facts`), sampled by day so they stay under the replica's limits.

**Facts.**

- Extents (active partitions): `mastra_metric_events` 2026-06-03 → 2026-10-21 (2.4 GiB), `mastra_span_events` and `mastra_trace_branches` 2026-05-01 → 2026-10-21 (312.4 / 189.6 GiB).
- **Usage on branch spans.** 6 h of usage rows, all tenants, by the type of the span they point at: `model_generation` 57,239 rows (96.0%), `processor_run` 2,309 (3.9%, 542 spans), `generic` 52, `agent_run` 10. When a model call's span isn't exported, the exporter records its usage on the nearest exported ancestor (`applyUsageRollup` in `observability/mastra/src/instances/base.ts`), mostly processors that run internal agents. No usage row lacked a `spanId` (192,808 rows, one day).
- **Usage lag after span start** (usage rows of 7 days, 390,114 spans): p50 / p90 / p99 / p99.9 = 7 / 277 / 1,184 / 4,168 s; max 765,101 s (8.9 d); 50 spans over 1 h, 2 over 1 d; none before the span started.
- **Span duration** (spans ending in 30 days): max 2,405,589 s (27.8 d); 204 non-branch and 200 branch spans over 1 d, 191 each over 7 d (of 16.5 M and 13.6 M).
- **Branch rows vs span events** (branch-type rows ending on a day, all tenants): 53 / 53 on 2026-05-02, 760 / 760 on 2026-07-29, 699,244 / 699,063 on 2026-10-19. The 0.026% gap is retried copies already merged in `trace_branches`; on Platform the table has existed alongside the others, so no spans are missing from it.

**Results** (warm, median of 2, `past7` one warm run: time / peak memory / read):

| Cell      | Scope   | Shape | `current`                 | `upper`                    | `semi`                                        | `semiSel`                                     | `semiUpper`                                   |
| --------- | ------- | ----- | ------------------------- | -------------------------- | --------------------------------------------- | --------------------------------------------- | --------------------------------------------- |
| hist7     | project | U1    | 2.9 s / 544 MiB / 3.7 GiB | 1.3 s / 172 MiB / 1.4 GiB  | 4.4 s / 434 MiB / 3.5 GiB                     | 6.7 s / 545 MiB / 7.4 GiB, prod fails (159)   | 4.1 s / 399 MiB / 3.0 GiB                     |
| hist7     | project | U2    | 3.2 s / 511 MiB / 2.3 GiB | 0.3 s / 107 MiB / 0.03 GiB | 1.4 s / 294 MiB / 0.6 GiB                     | 1.6 s / 287 MiB / 0.6 GiB                     | 1.0 s / 152 MiB / 0.1 GiB                     |
| hist7     | org     | U1    | 5.8 s / 592 MiB / 9.8 GiB | 3.0 s / 259 MiB / 5.2 GiB  | 5.9 s / 361 MiB / 12.2 GiB                    | 13.1 s / 599 MiB / 26.7 GiB, prod fails (159) | 6.1 s / 326 MiB / 11.2 GiB                    |
| hist7     | org     | U2    | 3.5 s / 546 MiB / 4.7 GiB | 0.5 s / 119 MiB / 0.1 GiB  | 2.2 s / 373 MiB / 1.3 GiB                     | 2.6 s / 368 MiB / 1.3 GiB                     | 1.7 s / 270 MiB / 0.2 GiB                     |
| past7     | project | U1    | 1.9 s / 386 MiB / 1.9 GiB | 2.0 s / 382 MiB / 1.9 GiB  | 3.3 s / 547 MiB / 2.5 GiB                     | –                                             | –                                             |
| past7     | project | U2    | 1.2 s / 381 MiB / 1.2 GiB | 1.2 s / 358 MiB / 1.2 GiB  | 2.4 s / 476 MiB / 1.1 GiB                     | –                                             | –                                             |
| past7     | org     | U1    | 3.2 s / 805 MiB / 7.1 GiB | 3.2 s / 800 MiB / 7.1 GiB  | 4.5 s / 980 MiB / 10.3 GiB                    | –                                             | –                                             |
| past7     | org     | U2    | 1.5 s / 369 MiB / 2.4 GiB | 1.9 s / 391 MiB / 2.4 GiB  | 2.4 s / 538 MiB / 1.8 GiB                     | –                                             | –                                             |
| now7      | project | U1    | 0.6 s / 247 MiB / 0.2 GiB | 0.6 s / 223 MiB / 0.2 GiB  | 0.8 s / 258 MiB / 0.3 GiB                     | –                                             | –                                             |
| now7      | org     | U1    | 2.1 s / 566 MiB / 3.4 GiB | 2.0 s / 528 MiB / 3.4 GiB  | 3.3 s / 569 MiB / 5.6 GiB                     | –                                             | –                                             |
| now7      | org     | U2    | 0.6 s / 286 MiB / 0.7 GiB | 0.6 s / 268 MiB / 0.7 GiB  | 1.0 s / 304 MiB / 0.7 GiB                     | –                                             | –                                             |
| branch180 | org     | U2    | 4.1 s / 871 MiB / 4.8 GiB | 3.9 s / 863 MiB / 4.8 GiB  | 6.8 s / 1,328 MiB / 5.2 GiB, prod fails (241) | 9.4 s / 1,331 MiB / 5.4 GiB, prod fails (241) | 6.6 s / 1,363 MiB / 5.2 GiB, prod fails (241) |

- **Results match.** Every variant returns `current`'s digest in `past7` (all four scope × shape cells, non-empty) and in `hist7` and `branch180`. In `hist7` all cells share one digest, so these tenants have no matching spans 90 days back; that cell measures scan cost only. `now7` digests drift between runs because spans keep reporting usage after the fixed "now" (`current` drifts too).
- **`upper` costs nothing near now** (`now7`, `past7`, `branch180` within noise) and cuts the historical read 2–100× (`hist7`: 3.7 → 1.4 GiB, 2.3 → 0.03 GiB, 9.8 → 5.2 GiB, 4.7 → 0.1 GiB).
- **Semi-joins are not a general fix.** `traceId` isn't in `mastra_metric_events`' sort key `(org, project, name, timestamp, metricId)`, so the `IN` set prunes only through granule skipping. It cuts reads when the selection has few traces (`agent_run`: 2.3 → 0.6 GiB), reads more than `current` for `model_generation` (org `hist7` 12.2 vs 9.8 GiB; `semiSel` 26.7 GiB and fails 9 s), and at 180 d org-wide the trace-ID set alone exceeds 1 GiB (code 241). `upper` was faster and used less memory than every semi-join variant in every cell; only for `agent_run` in `past7` did `semi` read slightly less (1.8 vs 2.4 GiB org, 1.1 vs 1.2 GiB project).
- **The branch path with tokens/cost fits** at org scope over full retention: `branch180` U2 3.7–4.0 s / ≤ 876 MiB with `upper` (prod call: 3.7 s / 845 MiB). That is 10× X50 A1's read (4.8 GiB vs 437–468 MiB) because usage is read for every `agent_run`; memory headroom is ~150 MiB.
- **What `upper` doesn't fix.** `hist7` org U1 still reads 5.2 GiB: the selection reads `mastra_span_events` with `endedAt >= from` and no upper bound (as `querySpans()` does), so it reads every span ended since `from`. Not changed here; follow-up.
- Cold calls exceed 9 s in nearly every cell and variant (codes 159), as in X43 / OBS-664; not specific to this read.

**Verdict.** Bound the usage read above at `to + 30 d`: the largest lag seen is 8.9 d and the longest span 27.8 d, it returns the same rows, and it is never slower. Keep token/cost measures on the branch path, since branch spans carry real usage. Decision (Daniel, 2026-10-21): ship the bound as a Platform host limit (platform#3633, `SPAN_AGGREGATE_USAGE_MAX_LAG_DAYS`, documented in the mobs-query README). Core, PostgreSQL, DuckDB and OSS ClickHouse keep the unbounded contract; mastra#27857 documents the cost in its `usageBound` comment.

X50 here refers to the `aggregateSpans()` org-scope entry on `daniel/obs-539-aggregate-benchmark` (2b16604aca0), not this file's OBS-698 entry, which was renumbered to X51.

Reproduce: `npx tsx mobs-span-usage-bound.ts facts --platform <mobs-query dir>`, then `run --platform <mobs-query dir> --variants current,upper,semi,semiSel,semiUpper --cells hist7,branch180 --lag-hours 720 --reps 2` and `--variants current,upper,semi --cells now7,past7` (results in `results/mobs-span-usage-bound.jsonl`). Use the mobs-query commit above: later commits compile the bound in, so `current` there is `upper`.

### X53: the project Metrics page at 14 d, the range OBS-698 now caps it at (prod replica, read-only, 2026-10-21)

**Question.** X51 showed the OBS-698 page doesn't fit at 30 d, so the page now allows at most 14 days (mastra#27908). Does a whole load fit mobs-query's 1 GiB / 9 s at 14 d on the p99 and largest project?

**Method.** X51's harness and method, unchanged: `mobs-obs698-page.ts page --label x53 --windows 14d --variants obs698,today,exec --reps 3`, against Platform `main` 47b476843 at `/tmp/platform-obs698`. The interval is `1h` (337 buckets × limit 10 ≤ 10 k), as the page picks; all 20 bodies plan and compile offline first (`dry --windows 14d`). Cold ×1 then warm ×3 per project and variant, 24 loads. Run after w73's span-aggregate matrix and parity run on the replica had finished, with no other benchmark running.

**Results** (warm columns: median / max over 3 loads):

| Project | Variant | Cold page ms | Cold failed | Warm page ms   | Warm slowest statement ms | Warm loads with a failed card    | Max MiB | Max concurrent MiB | Warm read per load |
| ------- | ------- | ------------ | ----------- | -------------- | ------------------------- | -------------------------------- | ------- | ------------------ | ------------------ |
| p99     | obs698  | 35,931       | 24 of 24    | 5,267 / 11,227 | 5,085 / 9,462             | 1 (warm #1: `a:kpi-tokens-prev`) | 154     | 503                | 3.9 GiB            |
| p99     | today   | 24,758       | 17 of 17    | 1,269 / 1,295  | 625 / 642                 | 0                                | 57      | 342                | 1.2 GiB            |
| p99     | exec    | 9,313        | 1 of 1      | 750 / 855      | 698 / 797                 | 0                                | 147     | 147                | 0.4 GiB            |
| largest | obs698  | 29,521       | 24 of 24    | 4,857 / 9,149  | 4,502 / 9,001             | 1 (warm #1: `a:kpi-tokens-prev`) | 211     | 643                | 4.5 GiB            |
| largest | today   | 26,527       | 17 of 17    | 1,325 / 1,784  | 723 / 1,042               | 0                                | 61      | 371                | 1.4 GiB            |
| largest | exec    | 9,424        | 1 of 1      | 467 / 665      | 418 / 615                 | 0                                | 122     | 122                | 0.3 GiB            |

- **The one failing request is `a:kpi-tokens-prev`**, the Tokens KPI's previous window (days 14–28 back). On the largest project it reads 1.7 GiB per load vs 332 MiB for the current window, and 745–751 MiB vs 418 MiB on the p99 project. Its statement, per warm load: p99 9,462 (failed) / 5,085 / 2,718 ms; largest 9,001 (failed) / 4,332 / 4,502 ms. The current window takes 6.2 / 1.9 / 1.9 s and 5.6 / 1.4 / 1.6 s. Not investigated why the earlier window reads more; both go through the token/cost fallback.
- **Warm #2 and #3 fit on both projects**: no failed card, slowest statement ≤ 5.1 s, pages 4.6–5.3 s (today's page: 1.1–1.8 s).
- **Warm #1 is the first load after a cold load whose statements were all aborted at 9 s**, so its cache is only partly filled (as in X51). Every other card succeeds on it; the next slowest statements are `a:kpi-tokens` at 6.2 s and 5.6 s.
- **Cold, both pages fail every request at 14 d.** Unlike X51's 7 d, today's page fails cold here too (all 17 at 9 s), so the new page takes nothing down that would have loaded.
- Memory fits everywhere: ≤ 211 MiB per statement, ≤ 643 MiB at once.

**Verdict.** **Does not fit by this run's gate** (every warm load keeps every card and no statement over 9 s). Both projects' first warm load loses the Tokens KPI's previous-window request at 9.0–9.5 s; the KPI then shows its error state while every other card loads. Steady warm loads (#2, #3) fit with ≥ 3.9 s to spare. The OBS-698 PRs stay drafts.

**Options (not run).** Each removes or shrinks the previous-window request:

1. Drop the Tokens KPI's comparison ("vs previous 14d") while the cap is in place. One fewer fallback read; the KPI shows the total only.
2. Read the previous window from `metrics` (today's `m:kpi-tokens-*`, ≤ 1.8 s at 14 d here) and the current window from `aggregateTraces()`. The two windows would then count different records (X48: ≤ 1.1% apart).
3. Back-fill `mastra_model_usage` and turn the fallback off (X49 candidate 6).

Reproduce: `npx tsx mobs-obs698-page.ts dry --windows 14d`, then `page --label x53 --windows 14d --variants obs698,today,exec --reps 3`, then `report --label x53` (results in `results/mobs-obs698-page.jsonl`).

### X54: the project Metrics page with the Tokens KPI left on `metrics`, per card (prod replica, read-only, 2026-10-21)

**Question.** After X53, the Tokens KPI stays on `metrics` (today's request, with its previous-period comparison) until OBS-709 back-fills per-call usage, and the 14-day cap is dropped: the page keeps every window Studio offers today, up to 30 d. Rule: only `aggregateTraces()` cards that fit at every window ship; the rest wait for OBS-709. Which cards fit mobs-query's 1 GiB / 9 s at 24 h, 7 d and 30 d on the p99 and largest project?

**Method.** X51's harness and method: `mobs-obs698-page.ts page --label x54 --windows 24h,7d,30d --variants obs698-kpim,today,exec --reps 3`, against Platform `main` 6f62964d1 at `/tmp/platform-obs698`. The new `obs698-kpim` variant is the OBS-698 page as it now stands: the 7 card requests (`a:latency`, `a:top-entities`, `a:breakdown-environment`, `a:distinct-series`, `a:distinct-totals`, `a:cost-total`, `a:cost-series`) through the page's 3-in-flight limiter, plus all 17 of today's `metrics` requests including `m:kpi-tokens-in/out`. Same 10-socket pool, `max_threads=16`, 1 GiB / 9 s per statement, cold ×1 then warm ×3. All 60 bodies plan and compile offline first (`dry`). The run started once w73 had moved on to local test suites, with no other benchmark on the replica (checked with `herdr agent list` and `ps`). `report` gained a per-card table for every source, with warm and cold kept separate.

**Page** (warm columns: median / max over 3 loads):

| Project | Window | Warm page ms    | Warm slowest statement ms | Warm loads with a failed card                                         | Max MiB | Max concurrent MiB | Warm read per load | Today's page, warm ms |
| ------- | ------ | --------------- | ------------------------- | --------------------------------------------------------------------- | ------- | ------------------ | ------------------ | --------------------- |
| p99     | 24 h   | 703 / 1,205     | 340 / 886                 | 0                                                                     | 97      | 224                | 0.4 GiB            | 334 / 457             |
| p99     | 7 d    | 2,004 / 2,945   | 1,110 / 2,378             | 0                                                                     | 129     | 401                | 1.8 GiB            | 949 / 1,952           |
| p99     | 30 d   | 8,556 / 19,973  | 3,825 / 7,594             | 0                                                                     | 183     | 775                | 5.6 GiB            | 1,891 / 1,912         |
| largest | 24 h   | 655 / 852       | 304 / 462                 | 0                                                                     | 95      | 215                | 0.3 GiB            | 670 / 898             |
| largest | 7 d    | 2,591 / 3,630   | 1,435 / 1,534             | 0                                                                     | 112     | 433                | 1.4 GiB            | 1,132 / 1,340         |
| largest | 30 d   | 13,811 / 15,548 | 9,001 / 9,530             | 2 (#1: latency, top entities, breakdown; #3: top entities, breakdown) | 419     | 1,299              | 10.9 GiB           | 2,371 / 2,878         |

**Per card, warm** (worst over 3 loads: slowest statement ms / peak MiB; failed loads in brackets):

| Card (request)                          | p99 24 h | p99 7 d     | p99 30 d    | largest 24 h | largest 7 d | largest 30 d        | Reads cost |
| --------------------------------------- | -------- | ----------- | ----------- | ------------ | ----------- | ------------------- | ---------- |
| Trace latency (`a:latency`)             | 568 / 52 | 734 / 53    | 3,737 / 89  | 197 / 44     | 398 / 53    | **9,530 / 242 [1]** | no         |
| Top entities (`a:top-entities`)         | 886 / 50 | 2,378 / 124 | 7,594 / 180 | 462 / 47     | 1,534 / 86  | **9,443 / 340 [2]** | `cost.sum` |
| Trace breakdown, environment            | 708 / 51 | 2,362 / 129 | 7,026 / 170 | 342 / 84     | 1,435 / 90  | **9,454 / 342 [2]** | `cost.sum` |
| Trace breakdown, execution source (tab) | 209 / 96 | 408 / 129   | 1,238 / 170 | 152 / 94     | 627 / 113   | 4,653 / 326         | `cost.sum` |
| Users and sessions, series              | 135 / 19 | 360 / 21    | 2,498 / 142 | 88 / 11      | 402 / 13    | 2,157 / 327         | no         |
| Users and sessions, totals              | 72 / 18  | 177 / 19    | 408 / 141   | 27 / 50      | 238 / 48    | 2,467 / 323         | no         |
| Cost coverage, total                    | 144 / 91 | 607 / 123   | 1,876 / 165 | 157 / 89     | 512 / 112   | 4,572 / 396         | `cost.sum` |
| Cost coverage, series                   | 176 / 97 | 542 / 127   | 1,547 / 183 | 169 / 95     | 609 / 110   | 4,693 / 419         | `cost.sum` |

The execution-source tab fires only when opened, so it runs alone (the `exec` variant). All 17 `metrics` requests, `m:kpi-tokens-in/out` included, keep their data on every warm load at every window; the slowest is `m:kpi-runs` at 3.9 s (p99, 30 d), and the Tokens KPI's `m:kpi-tokens-out` takes at most 3.6 s.

- **Every failure is at 30 d on the largest project.** At 24 h and 7 d every card fits on both projects with ≥ 6.6 s to spare. At 30 d on the p99 project nothing fails, but top entities and the environment breakdown reach 7.6 s and 7.0 s.
- **The four requests that ask for `cost.sum` read the token/cost fallback**, about 2 GiB each at the largest project over 30 d (top entities 2.0 GiB, breakdown 2.0 GiB, cost total and series 2.0 GiB each). Latency reads 111 MiB, users and sessions 121 MiB. Those four account for ~8 of the page's 10.9 GiB, against 2.8 GiB for today's whole page.
- **Which card times out depends on the order it runs in, not only on its own cost.** Latency, top entities and breakdown take the limiter's first three slots, and they run alongside all 17 `metrics` requests. Latency reads little but still timed out once there. The cost coverage requests start only after a slot frees up, so they ran with less contention and stayed under 4.7 s. Alone, the 30 d breakdown takes 4.7 s on the largest project (the `exec` row).
- **p99 30 d warm #3 took 20 s with no statement over 2.4 s**: the last cards waited 17–19 s for a statement that ran in under 1 s, so the time went to the client side (pool or connection), not to the server. Unexplained, as was the 88 s first cold load. A fresh-process recheck of that cold load (`x54-recheck`) took 18.6 s.
- **Memory fits everywhere**: ≤ 419 MiB per statement. At most 1,299 MiB is held across all of the replica's statements at once; the 1 GiB limit is per statement.
- **Cold** (not part of the gate): the new page loses 7 of 24 requests at p99 24 h, 5 at p99 7 d, 2 at largest 24 h and 7 at largest 7 d, all of them `aggregateTraces()` cards except one `metrics` card (`m:volume-agents`, largest 7 d). It loses every request at 30 d on both projects. Today's page alone also fails cold at 7 d (1 card on p99, 2 on largest) and at 30 d (all 17).

**Verdict by card**, under the rule "fits at every window":

- **Fit:** Users and sessions; Cost coverage (≤ 4.7 s and ≤ 419 MiB at 30 d, though each request reads 2 GiB and adds to the 30 d contention); Trace breakdown's execution-source tab when it runs alone.
- **Don't fit:** Top entities and Trace breakdown (environment) each lose 2 of 3 warm loads at largest 30 d. Trace latency loses 1 of 3 there, but only as a contention casualty: its own read is 111 MiB.
- Nothing has been dropped yet; the OBS-698 PRs stay drafts.

Reproduce: `npx tsx mobs-obs698-page.ts dry`, then `page --label x54 --windows 24h,7d,30d --variants obs698-kpim,today,exec --reps 3`, then `report --label x54` (results in `results/mobs-obs698-page.jsonl`).

### X46: `aggregateSpans()` contract affordability (prod replica, read-only, 2026-10-19)

**Question.** Can ClickHouse serve the OBS-390 `aggregateSpans()` contract (mastra#27669: `querySpans()` selection, span dimensions, trace measures plus per-span tokens/cost, 365 d window) inside mobs-query's 1 GiB / 9 s budget? Store compilers are OBS-392; this is a prototype to decide whether the contract needs a narrower window before it ships.

**Method.** `mobs-span-aggregate.ts` compiles each shape by hand around mobs-query's own span pieces (Platform `main` 44e35e47491 at `/tmp/platform-x46`: `planSpanQuery()`, `spanQuerySourceFieldSql()`, the trace-query predicate compiler). Guarded client and project selection as X41, `max_threads=16`. Per cell: cold ×1 (filesystem cache off) and warm ×3 under a 4 GiB / 30 s measurement ceiling, then one warm call at 1 GiB / 9 s ("prod" column; the prototype statement, not a service path). Scopes: p99 and largest project, plus the largest org. Windows 1/7/30/90/180 d (hourly buckets only to 30 d: the planner caps at 1,000 buckets); once a shape missed the prod budget, longer windows were skipped. Raw rows: `results/mobs-span-aggregate.jsonl`; table: `mobs-span-aggregate.ts report`.

Shapes: S1 `tool_call` by `name` (count, p95) · S2 by `spanType` (count, errorRate) · S3 `tool_call` by `entityName` · S4 by `rootEntityName` × `spanType` (count, p95) · S5 `model_generation` by `model` (count, input/output token sums, total avg, cost + coverage) · S5r = S5 grouped by `rootEntityName` (isolates `model`) · S6 by `spanType` (count, `countDistinct.traceId`) · S7 by `threadId` (high cardinality) · S8 by `name`, unfiltered · S9 `tool_call` by `name` × `1h`.

Two plans:

- **base**: `querySpans()` verbatim. Latest copy per span by `ORDER BY identity, endedAt DESC LIMIT 1 BY identity` over every span in the window, then `where`; usage from `mastra_metric_events` by `(traceId, spanId)`, deduped on `metricId`, bounded by `spanHash IN (SELECT … FROM selected)`.
- **copies**: a positive `spanType` condition applied before the collapse (span type never differs between copies, OBS-664); only spans with copies are collapsed in order, the rest pass through (`copied` hash set, like trace scope's `copied_spans`); usage bounded by tenant + window instead of a second pass over the selection.

`mastra_model_usage` has no `spanId`, so per-span usage can only come from `mastra_metric_events` (largest org: ~10.9 K usage rows/day, all with `spanId`; cheap).

**Correctness.**

- `check --window 7d`: p99 and largest project match hand-written SQL (latest copy via `argMax`) for total spans, per-type count/distinct traces/errors (S2/S6), model span count and input tokens (S5). The hand-written org check itself needed > 4 GiB.
- `parity --window 7d` (window ending 6 h ago, limit 10,000, `quantileExact`): copies = base row-for-row in all 26 runnable cells; base against itself is identical (control). Two bugs found on the way: (1) 22 spans on the largest org over 7 d have byte-identical copies (same `endedAt` and `dedupeKey`), which a `(span, latest)` match counts twice, so copied spans are collapsed with `LIMIT 1 BY`; (2) `quantile` samples, so two plans can differ on p95 — compare with `quantileExact`.

**Results** (warm median ms / max MiB; prod = 1 GiB / 9 s).

| Cell                          | base                                                           | copies                                                                       |
| ----------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| p99 project 180 d, S1–S8      | 0.7–1.3 s / ≤ 606 MiB, all ok (S5 skipped: failed at 7 d)      | S5 4.5 s / 355 MiB ok                                                        |
| p99 project 7 d, S5           | 2.4 s / 1,135 MiB, **FAIL**                                    | 1.0 s / 290 MiB                                                              |
| largest project 180 d, S1–S8  | 1.1–2.2 s / ≤ 858 MiB, all ok (S5 failed at 30 d)              | 2.1–2.8 s / ≤ 792 MiB, all ok incl. S5                                       |
| largest project 30 d, S5      | 5.2 s / 4,076 MiB, **FAIL**                                    | 4.2 s / 789 MiB ok                                                           |
| largest project 30 d, S9      | 4.6 s / 1,055 MiB, **FAIL**                                    | 4.0 s / 812 MiB ok                                                           |
| largest org 7 d, S1–S9        | 1.0–2.1 s / ≤ 694 MiB ok; S5 **FAIL** (2.8 GiB already at 1 d) | 0.8–1.8 s / ≤ 542 MiB ok; S5 7.5 s / 1,097 MiB **FAIL**; S5r 1.4 s / 451 MiB |
| largest org 30 d, every shape | 3.6–6.2 s / 1.6–2.2 GiB, **FAIL**                              | 4.2–8.8 s / 1.1–1.3 GiB, **FAIL**                                            |

Cold reads: base cold stays under 30 s through 180 d (8–18 s project, 14–27 s largest org at 30 d); copies scans the span table three times and times out at 30 s from 30 d. Neither fits 9 s cold from 30 d, as with traces (X43).

**What it costs.**

- **Copy collapse.** Sorting every span in the window dominates base. On the largest org at 30 d, `candidates` alone is 3.8 s / 1.59 GiB (8.5 M rows, 1.2 GiB read). The copies plan's selection is 0.8–1.25 GiB at 30 d: the `copied` hash set is ~535 MiB and the three scans read ~5 GiB. Neither fits 1 GiB for the largest org at 30 d.
- **`model`/`provider`.** Both live in the `attributes` JSON string (9.2 GiB compressed on the table). Grouping or projecting them reads it for every granule that holds a matching span: S5 reads 23 GiB at 7 d on the largest org (7.5 s / 1.1 GiB) vs 2 GiB for S5r (1.4 s / 451 MiB). This is the one dimension whose cost scales with payload size rather than span count.
- **Usage.** Bounding metric rows by a second pass over the selection (`IN (SELECT spanHash FROM selected)`) runs the selection twice: base S5 on the largest org was 2.8 GiB at 1 d. Bounding by tenant + window is cheap (~10 K rows/day) and, with the join, still only counts selected spans.

**Boundary (largest org, 3 d / 14 d, run before the decision below stopped further work).** 3 d: every shape fits under both plans (≤ 1.3 s / 476 MiB), including S5 (copies: 4.9 s / 986 MiB, prod 904 MiB, just under). 14 d: copies fits every shape except S5 (≤ 2.7 s / 860 MiB; S5 2.3 GiB); base fails S1, S7, S8, S9 (1.04–1.28 GiB) and passes S2–S4, S6 at 0.91–1.03 GiB.

**Conclusions.**

1. The contract is affordable at project scope through 180 d for every shape, given two compiler rules that OBS-392 must adopt: bound usage by tenant + window (not by re-running the selection), and push positive `spanType`/`name` conditions before the copy collapse.
2. Org scope on the largest org fits to ~14 d with the copies plan and fails from 30 d under both plans.
3. `model`/`provider` grouping reads the `attributes` JSON and is the one dimension whose cost scales with payload size.

**Decisions (Daniel, 2026-10-19).**

- No separate org-wide window. The span aggregate window is the trace/span retention window the host advertises (`/capabilities`, e.g. 6 months on Platform), the same for project and org scope. OBS-392 must make org scope fit at full retention (collapse/schema work) before the endpoint ships; X46 shows it over budget from 30 d under both plans.
- `model`/`provider` are removed from span aggregate dimensions for v1 (mastra#27669, commit 242884fb87e); dedicated columns are OBS-693.

**Full matrix** (`mobs-span-aggregate.ts report`; `/copies` = copies plan, otherwise base; "skipped" = a shorter window of the same shape already missed the prod budget, so longer windows were not run; S9 runs only to 30 d because the planner rejects > 1,000 hourly buckets; S5r and 3 d / 14 d were added mid-run, so not every role has them).

| role    | scope   | window | shape      | warm median ms | warm max MiB | read MiB | cold     | prod 1 GiB/9 s          | groups |
| ------- | ------- | ------ | ---------- | -------------- | ------------ | -------- | -------- | ----------------------- | ------ |
| p99     | project | 1d     | S1         | 19             | 58.4         | 2.23     | 1185 ms  | ok 19 ms / 58.6 MiB     | 16     |
| p99     | project | 7d     | S1         | 175            | 132          | 76.43    | 4742 ms  | ok 192 ms / 130.1 MiB   | 66     |
| p99     | project | 30d    | S1         | 475            | 397.4        | 186.35   | 17502 ms | ok 492 ms / 374.3 MiB   | 68     |
| p99     | project | 90d    | S1         | 700            | 546.7        | 300.2    | 15351 ms | ok 738 ms / 568.3 MiB   | 68     |
| p99     | project | 180d   | S1         | 736            | 605.8        | 300.23   | 11292 ms | ok 700 ms / 591.2 MiB   | 68     |
| p99     | project | 1d     | S2         | 20             | 54.7         | 2        | 1022 ms  | ok 20 ms / 54.5 MiB     | 11     |
| p99     | project | 7d     | S2         | 299            | 109.4        | 64.35    | 3687 ms  | ok 273 ms / 108.1 MiB   | 13     |
| p99     | project | 30d    | S2         | 542            | 350.4        | 157.53   | 11512 ms | ok 552 ms / 299.4 MiB   | 15     |
| p99     | project | 90d    | S2         | 956            | 531.3        | 251.15   | 12157 ms | ok 6246 ms / 426.9 MiB  | 15     |
| p99     | project | 180d   | S2         | 828            | 446.2        | 251.21   | 12049 ms | ok 878 ms / 452.6 MiB   | 15     |
| p99     | project | 1d     | S3         | 20             | 56           | 1.17     | 2634 ms  | ok 20 ms / 47.4 MiB     | 16     |
| p99     | project | 7d     | S3         | 278            | 131.4        | 75.11    | 4134 ms  | ok 266 ms / 128.4 MiB   | 66     |
| p99     | project | 30d    | S3         | 608            | 363          | 185.53   | 10414 ms | ok 587 ms / 373.7 MiB   | 68     |
| p99     | project | 90d    | S3         | 951            | 562.4        | 297.63   | 13300 ms | ok 900 ms / 532 MiB     | 68     |
| p99     | project | 180d   | S3         | 957            | 534.4        | 297.64   | 10785 ms | ok 956 ms / 512.1 MiB   | 68     |
| p99     | project | 1d     | S4         | 25             | 41.5         | 1.32     | 1092 ms  | ok 30 ms / 47.6 MiB     | 11     |
| p99     | project | 7d     | S4         | 294            | 154.2        | 66.99    | 3751 ms  | ok 244 ms / 169.8 MiB   | 13     |
| p99     | project | 30d    | S4         | 604            | 324.9        | 164.89   | 9956 ms  | ok 600 ms / 305.8 MiB   | 15     |
| p99     | project | 90d    | S4         | 916            | 488.8        | 264.51   | 11542 ms | ok 830 ms / 471.7 MiB   | 15     |
| p99     | project | 180d   | S4         | 908            | 534.3        | 264.57   | 10857 ms | ok 932 ms / 538.6 MiB   | 15     |
| p99     | project | 1d     | S5         | 128            | 84.8         | 44.23    | 3106 ms  | ok 115 ms / 84.8 MiB    | 3      |
| p99     | project | 7d     | S5         | 2350           | 1134.8       | 1084.45  | 9648 ms  | FAIL 241                | –      |
| p99     | project | 30d    | S5         | –              | –            | –        | –        | skipped                 | –      |
| p99     | project | 90d    | S5         | –              | –            | –        | –        | skipped                 | –      |
| p99     | project | 180d   | S5         | –              | –            | –        | –        | skipped                 | –      |
| p99     | project | 1d     | S6         | 28             | 48.2         | 1.63     | 1515 ms  | ok 46 ms / 40.1 MiB     | 11     |
| p99     | project | 7d     | S6         | 244            | 146.5        | 63.69    | 3448 ms  | ok 257 ms / 137.7 MiB   | 13     |
| p99     | project | 30d    | S6         | 599            | 327.1        | 156.25   | 12224 ms | ok 627 ms / 294.5 MiB   | 15     |
| p99     | project | 90d    | S6         | 826            | 462.2        | 250.44   | 11133 ms | ok 818 ms / 443.9 MiB   | 15     |
| p99     | project | 180d   | S6         | 1030           | 441.6        | 250.47   | 10914 ms | ok 951 ms / 455.4 MiB   | 15     |
| p99     | project | 1d     | S7         | 34             | 29.4         | 2.37     | 1435 ms  | ok 66 ms / 29 MiB       | 8      |
| p99     | project | 7d     | S7         | 327            | 171.8        | 82.3     | 3361 ms  | ok 274 ms / 168.6 MiB   | 101+   |
| p99     | project | 30d    | S7         | 443            | 385.3        | 196.77   | 8523 ms  | ok 442 ms / 434.1 MiB   | 101+   |
| p99     | project | 90d    | S7         | 835            | 559.1        | 307.06   | 8887 ms  | ok 861 ms / 561.7 MiB   | 101+   |
| p99     | project | 180d   | S7         | 814            | 545.2        | 307.12   | 8158 ms  | ok 821 ms / 577.3 MiB   | 101+   |
| p99     | project | 1d     | S8         | 20             | 50.1         | 1.26     | 880 ms   | ok 19 ms / 47.8 MiB     | 91     |
| p99     | project | 7d     | S8         | 274            | 128.8        | 75.44    | 2557 ms  | ok 268 ms / 129.4 MiB   | 101+   |
| p99     | project | 30d    | S8         | 594            | 354.4        | 185.45   | 8546 ms  | ok 589 ms / 381 MiB     | 101+   |
| p99     | project | 90d    | S8         | 848            | 598.9        | 299.27   | 9775 ms  | ok 1254 ms / 574 MiB    | 101+   |
| p99     | project | 180d   | S8         | 1310           | 576.5        | 299.33   | 10005 ms | ok 1072 ms / 541 MiB    | 101+   |
| p99     | project | 1d     | S9         | 40             | 55.2         | 3.05     | 1964 ms  | ok 40 ms / 47.3 MiB     | 31     |
| p99     | project | 7d     | S9         | 456            | 273.3        | 151.49   | 6527 ms  | ok 460 ms / 248.5 MiB   | 2397   |
| p99     | project | 30d    | S9         | 1433           | 598.8        | 371.45   | 15853 ms | ok 1305 ms / 568.9 MiB  | 1720   |
| largest | project | 1d     | S1         | 29             | 43.6         | 3.22     | 989 ms   | ok 26 ms / 44.6 MiB     | 4      |
| largest | project | 7d     | S1         | 88             | 71           | 11.7     | 2524 ms  | ok 80 ms / 64.6 MiB     | 4      |
| largest | project | 30d    | S1         | 2049           | 853.8        | 541.7    | 12040 ms | ok 1838 ms / 837.9 MiB  | 4      |
| largest | project | 90d    | S1         | 2099           | 843.4        | 545.73   | 12577 ms | ok 2016 ms / 826.5 MiB  | 4      |
| largest | project | 180d   | S1         | 2001           | 826.4        | 545.81   | 13075 ms | ok 1889 ms / 825.1 MiB  | 4      |
| largest | project | 1d     | S2         | 32             | 41.5         | 2.94     | 1316 ms  | ok 32 ms / 37.4 MiB     | 7      |
| largest | project | 7d     | S2         | 104            | 66.9         | 10.1     | 3192 ms  | ok 49 ms / 68.4 MiB     | 7      |
| largest | project | 30d    | S2         | 1926           | 708.1        | 467.31   | 12591 ms | ok 2020 ms / 690.5 MiB  | 7      |
| largest | project | 90d    | S2         | 1776           | 715.9        | 470.69   | 13423 ms | ok 2256 ms / 708.4 MiB  | 7      |
| largest | project | 180d   | S2         | 1915           | 714.1        | 470.74   | 13236 ms | ok 2023 ms / 693.5 MiB  | 7      |
| largest | project | 1d     | S3         | 36             | 54.3         | 3.76     | 1928 ms  | ok 56 ms / 48.9 MiB     | 4      |
| largest | project | 7d     | S3         | 91             | 74.5         | 12.16    | 3127 ms  | ok 108 ms / 78.5 MiB    | 4      |
| largest | project | 30d    | S3         | 1831           | 834.3        | 551.19   | 11808 ms | ok 1963 ms / 834.8 MiB  | 4      |
| largest | project | 90d    | S3         | 1944           | 839.1        | 554.56   | 13656 ms | ok 2214 ms / 838.6 MiB  | 4      |
| largest | project | 180d   | S3         | 2053           | 858.2        | 554.6    | 13317 ms | ok 1878 ms / 838.3 MiB  | 4      |
| largest | project | 1d     | S4         | 20             | 51.9         | 2.93     | 682 ms   | ok 20 ms / 51.9 MiB     | 7      |
| largest | project | 7d     | S4         | 71             | 57.1         | 10.48    | 2393 ms  | ok 50 ms / 53.1 MiB     | 7      |
| largest | project | 30d    | S4         | 2001           | 750.3        | 490.97   | 9334 ms  | ok 1785 ms / 718.1 MiB  | 7      |
| largest | project | 90d    | S4         | 2027           | 743.5        | 494.58   | 11947 ms | ok 1919 ms / 729.7 MiB  | 7      |
| largest | project | 180d   | S4         | 2072           | 736.2        | 494.59   | 11307 ms | ok 1908 ms / 743.8 MiB  | 7      |
| largest | project | 1d     | S5         | 101            | 88.2         | 61.94    | 2452 ms  | ok 297 ms / 88.2 MiB    | 4      |
| largest | project | 7d     | S5         | 443            | 292.8        | 211.6    | 7786 ms  | ok 509 ms / 368.3 MiB   | 5      |
| largest | project | 30d    | S5         | 5241           | 4075.9       | 3611.71  | fail 241 | FAIL 241                | –      |
| largest | project | 90d    | S5         | –              | –            | –        | –        | skipped                 | –      |
| largest | project | 180d   | S5         | –              | –            | –        | –        | skipped                 | –      |
| largest | project | 1d     | S6         | 28             | 40.9         | 3.24     | 1297 ms  | ok 27 ms / 40.9 MiB     | 7      |
| largest | project | 7d     | S6         | 97             | 58.7         | 10.38    | 2771 ms  | ok 96 ms / 45.3 MiB     | 7      |
| largest | project | 30d    | S6         | 2075           | 715.7        | 464.67   | 12360 ms | ok 2052 ms / 721.5 MiB  | 7      |
| largest | project | 90d    | S6         | 1978           | 740.3        | 468.09   | 12006 ms | ok 2919 ms / 727.2 MiB  | 7      |
| largest | project | 180d   | S6         | 2202           | 736.2        | 468.1    | 11654 ms | ok 2081 ms / 714.8 MiB  | 7      |
| largest | project | 1d     | S7         | 61             | 33.6         | 4.4      | 1607 ms  | ok 36 ms / 32 MiB       | 101+   |
| largest | project | 7d     | S7         | 1330           | 51.4         | 12.86    | 2593 ms  | ok 85 ms / 66.8 MiB     | 101+   |
| largest | project | 30d    | S7         | 1599           | 764.3        | 513.77   | 8359 ms  | ok 1455 ms / 766 MiB    | 101+   |
| largest | project | 90d    | S7         | 1410           | 799.9        | 517.54   | 9872 ms  | ok 1199 ms / 766.6 MiB  | 101+   |
| largest | project | 180d   | S7         | 1090           | 801.7        | 515.97   | 7426 ms  | ok 1098 ms / 773.6 MiB  | 101+   |
| largest | project | 1d     | S8         | 20             | 51.4         | 2.92     | 683 ms   | ok 22 ms / 48.4 MiB     | 42     |
| largest | project | 7d     | S8         | 98             | 57.8         | 11.36    | 1957 ms  | ok 98 ms / 49.3 MiB     | 44     |
| largest | project | 30d    | S8         | 1499           | 837.2        | 541.31   | 8590 ms  | ok 1415 ms / 840.8 MiB  | 45     |
| largest | project | 90d    | S8         | 1631           | 828.9        | 545.31   | 11293 ms | ok 1675 ms / 839.1 MiB  | 45     |
| largest | project | 180d   | S8         | 1603           | 846.1        | 545.34   | 10726 ms | ok 1631 ms / 816.7 MiB  | 45     |
| largest | project | 1d     | S9         | 103            | 51.7         | 6.34     | 1749 ms  | ok 48 ms / 48.8 MiB     | 96     |
| largest | project | 7d     | S9         | 202            | 91.1         | 23.3     | 4761 ms  | ok 197 ms / 79.9 MiB    | 558    |
| largest | project | 30d    | S9         | 4640           | 1054.9       | 1083.24  | 18329 ms | FAIL 241                | –      |
| largest | org     | 1d     | S1         | 395            | 164.6        | 132.32   | 2654 ms  | ok 342 ms / 165.3 MiB   | 79     |
| largest | org     | 7d     | S1         | 1599           | 694.1        | 553.31   | 5891 ms  | ok 1575 ms / 669.5 MiB  | 101+   |
| largest | org     | 30d    | S1         | 6033           | 1903.2       | 1522.35  | 15913 ms | FAIL 241                | –      |
| largest | org     | 90d    | S1         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S1         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S2         | 351            | 134.3        | 106.65   | 2847 ms  | ok 345 ms / 127.6 MiB   | 24     |
| largest | org     | 7d     | S2         | 1085           | 563.4        | 440.46   | 6042 ms  | ok 1104 ms / 558.4 MiB  | 27     |
| largest | org     | 30d    | S2         | 3613           | 1648.2       | 1261.28  | 17226 ms | FAIL 241                | –      |
| largest | org     | 90d    | S2         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S2         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S3         | 303            | 160.3        | 127.63   | 2882 ms  | ok 287 ms / 151 MiB     | 79     |
| largest | org     | 7d     | S3         | 1240           | 525.3        | 532.27   | 5563 ms  | ok 1132 ms / 516.2 MiB  | 101+   |
| largest | org     | 30d    | S3         | 4939           | 1856.7       | 1495.07  | 16385 ms | FAIL 241                | –      |
| largest | org     | 90d    | S3         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S3         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S4         | 291            | 136.3        | 110.3    | 1860 ms  | ok 285 ms / 132 MiB     | 24     |
| largest | org     | 7d     | S4         | 1493           | 584.3        | 462.38   | 4481 ms  | ok 1180 ms / 457.3 MiB  | 27     |
| largest | org     | 30d    | S4         | 4087           | 1710.4       | 1324.95  | 13725 ms | FAIL 241                | –      |
| largest | org     | 90d    | S4         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S4         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S5         | 6353           | 2779.6       | 3098.15  | 9575 ms  | FAIL 241                | –      |
| largest | org     | 7d     | S5         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 30d    | S5         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 90d    | S5         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S5         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S6         | 289            | 129.5        | 105.45   | 2311 ms  | ok 516 ms / 123.5 MiB   | 24     |
| largest | org     | 7d     | S6         | 1011           | 572          | 437.46   | 5090 ms  | ok 1013 ms / 559.1 MiB  | 27     |
| largest | org     | 30d    | S6         | 4403           | 1648.9       | 1253.04  | 15170 ms | FAIL 241                | –      |
| largest | org     | 90d    | S6         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S6         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S7         | 280            | 150.2        | 124.68   | 1990 ms  | ok 536 ms / 150.8 MiB   | 101+   |
| largest | org     | 7d     | S7         | 1177           | 619.6        | 503.59   | 4426 ms  | ok 1641 ms / 616.4 MiB  | 101+   |
| largest | org     | 30d    | S7         | 4448           | 1817.1       | 1459.58  | 13269 ms | FAIL 241                | –      |
| largest | org     | 90d    | S7         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S7         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S8         | 373            | 169.3        | 132.25   | 2581 ms  | ok 321 ms / 168 MiB     | 101+   |
| largest | org     | 7d     | S8         | 1630           | 672.1        | 553.72   | 5630 ms  | ok 1862 ms / 674.1 MiB  | 101+   |
| largest | org     | 30d    | S8         | 3780           | 1841.6       | 1522.79  | 18460 ms | FAIL 241                | –      |
| largest | org     | 90d    | S8         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S8         | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S9         | 517            | 184          | 261.58   | 3775 ms  | ok 508 ms / 178.7 MiB   | 533    |
| largest | org     | 7d     | S9         | 2072           | 624.2        | 1105.27  | 9147 ms  | ok 2084 ms / 620.2 MiB  | 2955   |
| largest | org     | 30d    | S9         | 6190           | 2203.3       | 3043.32  | 26747 ms | FAIL 241                | –      |
| largest | org     | 1d     | S5/copies  | 2176           | 300.1        | 6131.44  | 11576 ms | ok 2074 ms / 291 MiB    | 21     |
| largest | org     | 7d     | S5/copies  | 7479           | 1097         | 23454.43 | 21424 ms | FAIL 241                | –      |
| largest | org     | 1d     | S5r/copies | 487            | 192.8        | 447.72   | 7227 ms  | ok 575 ms / 175 MiB     | 1      |
| largest | org     | 7d     | S5r/copies | 1400           | 450.7        | 1957.84  | 16813 ms | ok 1428 ms / 462.1 MiB  | 1      |
| largest | org     | 30d    | S5r/copies | 6336           | 1222.6       | 6385.8   | fail 159 | FAIL 241                | –      |
| p99     | project | 1d     | S5/copies  | 297            | 191.4        | 51.2     | 3370 ms  | ok 135 ms / 178.9 MiB   | 4      |
| p99     | project | 7d     | S5/copies  | 1025           | 290.4        | 1152.96  | 10023 ms | ok 1015 ms / 264.8 MiB  | 16     |
| p99     | project | 30d    | S5/copies  | 2567           | 276.7        | 2996.38  | fail 159 | ok 2775 ms / 269.7 MiB  | 25     |
| p99     | project | 90d    | S5/copies  | 4142           | 370.9        | 4845.23  | fail 159 | ok 4072 ms / 346.8 MiB  | 35     |
| p99     | project | 180d   | S5/copies  | 4543           | 355          | 4847.93  | fail 159 | ok 4235 ms / 360 MiB    | 35     |
| largest | project | 1d     | S1/copies  | 150            | 178.6        | 9.94     | 3431 ms  | ok 299 ms / 180.8 MiB   | 4      |
| largest | project | 7d     | S1/copies  | 262            | 179.1        | 32.08    | 7443 ms  | ok 234 ms / 184.4 MiB   | 4      |
| largest | project | 30d    | S1/copies  | 2273           | 781.4        | 2013.22  | fail 159 | ok 2032 ms / 516.9 MiB  | 4      |
| largest | project | 90d    | S1/copies  | 2298           | 661.1        | 2029.84  | fail 159 | ok 2162 ms / 650.1 MiB  | 4      |
| largest | project | 180d   | S1/copies  | 2138           | 726.9        | 2030.11  | fail 159 | ok 3778 ms / 660.4 MiB  | 4      |
| largest | project | 1d     | S2/copies  | 75             | 196.7        | 11.12    | 1175 ms  | ok 102 ms / 165.6 MiB   | 7      |
| largest | project | 7d     | S2/copies  | 186            | 172.2        | 31.77    | 4746 ms  | ok 203 ms / 167.3 MiB   | 7      |
| largest | project | 30d    | S2/copies  | 2383           | 599.7        | 1859.91  | fail 159 | ok 2610 ms / 571.5 MiB  | 7      |
| largest | project | 90d    | S2/copies  | 2406           | 588.3        | 1873.67  | fail 159 | ok 2723 ms / 558.1 MiB  | 7      |
| largest | project | 180d   | S2/copies  | 2804           | 585.9        | 1874.15  | fail 159 | ok 2702 ms / 573.2 MiB  | 7      |
| largest | project | 1d     | S3/copies  | 101            | 188.5        | 12.82    | 2388 ms  | ok 99 ms / 156.6 MiB    | 4      |
| largest | project | 7d     | S3/copies  | 203            | 183.4        | 34.94    | 7653 ms  | ok 196 ms / 180.8 MiB   | 4      |
| largest | project | 30d    | S3/copies  | 2060           | 711.9        | 2035.34  | fail 159 | ok 2346 ms / 587.9 MiB  | 4      |
| largest | project | 90d    | S3/copies  | 2385           | 623.7        | 2050.79  | fail 159 | ok 2635 ms / 621.3 MiB  | 4      |
| largest | project | 180d   | S3/copies  | 2431           | 699.3        | 2051.5   | fail 159 | ok 2336 ms / 549.6 MiB  | 4      |
| largest | project | 1d     | S4/copies  | 113            | 173.2        | 13.75    | 3332 ms  | ok 158 ms / 176.4 MiB   | 7      |
| largest | project | 7d     | S4/copies  | 170            | 168.8        | 32.24    | 6685 ms  | ok 104 ms / 164.5 MiB   | 7      |
| largest | project | 30d    | S4/copies  | 2219           | 606.8        | 1901.2   | 25444 ms | ok 2530 ms / 574.8 MiB  | 7      |
| largest | project | 90d    | S4/copies  | 2727           | 602.9        | 1915.55  | 28494 ms | ok 2490 ms / 598.3 MiB  | 7      |
| largest | project | 180d   | S4/copies  | 2671           | 607.9        | 1915.88  | fail 159 | ok 2625 ms / 576.9 MiB  | 7      |
| largest | project | 1d     | S5/copies  | 181            | 150.7        | 54.49    | 1713 ms  | ok 186 ms / 147.8 MiB   | 4      |
| largest | project | 7d     | S5/copies  | 410            | 240.4        | 207.98   | 6854 ms  | ok 369 ms / 240.1 MiB   | 5      |
| largest | project | 30d    | S5/copies  | 4220           | 788.9        | 6697.36  | fail 159 | ok 4111 ms / 774 MiB    | 5      |
| largest | project | 90d    | S5/copies  | 4438           | 788.6        | 6776.65  | fail 159 | ok 6892 ms / 778.9 MiB  | 5      |
| largest | project | 180d   | S5/copies  | 4275           | 791.7        | 6780.14  | fail 159 | ok 4329 ms / 771.8 MiB  | 5      |
| largest | project | 1d     | S5r/copies | 198            | 232.9        | 23.55    | 3962 ms  | ok 202 ms / 167 MiB     | 1      |
| largest | project | 7d     | S5r/copies | 358            | 223.4        | 90.16    | 6827 ms  | ok 319 ms / 206 MiB     | 1      |
| largest | project | 30d    | S5r/copies | 2631           | 818.2        | 2149.47  | fail 159 | ok 2306 ms / 788.1 MiB  | 1      |
| largest | project | 90d    | S5r/copies | 2696           | 785.5        | 2196.72  | fail 159 | ok 2718 ms / 793.6 MiB  | 1      |
| largest | project | 180d   | S5r/copies | 2794           | 767.8        | 2197.85  | fail 159 | ok 8576 ms / 771.1 MiB  | 1      |
| largest | project | 1d     | S6/copies  | 153            | 161.9        | 9.1      | 2854 ms  | ok 146 ms / 158.3 MiB   | 7      |
| largest | project | 7d     | S6/copies  | 268            | 182.1        | 29.53    | 5431 ms  | ok 201 ms / 175.3 MiB   | 7      |
| largest | project | 30d    | S6/copies  | 2559           | 765.5        | 1848     | 26284 ms | ok 2324 ms / 565.9 MiB  | 7      |
| largest | project | 90d    | S6/copies  | 2644           | 814.1        | 1861.78  | fail 159 | ok 2637 ms / 761.8 MiB  | 7      |
| largest | project | 180d   | S6/copies  | 2811           | 781.4        | 1862.25  | fail 159 | ok 2903 ms / 782.3 MiB  | 7      |
| largest | project | 1d     | S7/copies  | 103            | 160          | 7.77     | 1098 ms  | ok 117 ms / 157.8 MiB   | 101+   |
| largest | project | 7d     | S7/copies  | 231            | 175          | 29.85    | 4662 ms  | ok 244 ms / 166.7 MiB   | 101+   |
| largest | project | 30d    | S7/copies  | 2289           | 623.5        | 1946.1   | 21923 ms | ok 2496 ms / 590 MiB    | 101+   |
| largest | project | 90d    | S7/copies  | 2466           | 594.9        | 1961.51  | 27148 ms | ok 2585 ms / 626.7 MiB  | 101+   |
| largest | project | 180d   | S7/copies  | 2553           | 585.1        | 1961.94  | 27514 ms | ok 2326 ms / 658.1 MiB  | 101+   |
| largest | project | 1d     | S8/copies  | 144            | 202.3        | 9.17     | 2645 ms  | ok 167 ms / 153 MiB     | 42     |
| largest | project | 7d     | S8/copies  | 273            | 190.2        | 31.23    | 4996 ms  | ok 213 ms / 193.7 MiB   | 44     |
| largest | project | 30d    | S8/copies  | 2294           | 696          | 2006.32  | 25068 ms | ok 2342 ms / 606.2 MiB  | 45     |
| largest | project | 90d    | S8/copies  | 2493           | 594.9        | 2018.09  | 29653 ms | ok 2273 ms / 605.7 MiB  | 45     |
| largest | project | 180d   | S8/copies  | 2344           | 646.9        | 2018.46  | 26942 ms | ok 6502 ms / 573.8 MiB  | 45     |
| largest | project | 1d     | S9/copies  | 232            | 194.3        | 15.99    | 3180 ms  | ok 211 ms / 155.7 MiB   | 96     |
| largest | project | 7d     | S9/copies  | 447            | 189.8        | 60.45    | 12669 ms | ok 470 ms / 189.8 MiB   | 558    |
| largest | project | 30d    | S9/copies  | 4021           | 812.2        | 4018.87  | fail 159 | ok 4298 ms / 714.5 MiB  | 1935   |
| largest | org     | 1d     | S1/copies  | 300            | 140.9        | 325.71   | 4837 ms  | ok 304 ms / 142.5 MiB   | 82     |
| largest | org     | 7d     | S1/copies  | 828            | 299.2        | 1416.09  | 10193 ms | ok 838 ms / 274.5 MiB   | 101+   |
| largest | org     | 30d    | S1/copies  | 4445           | 1197.4       | 5553.72  | fail 159 | FAIL 241                | –      |
| largest | org     | 90d    | S1/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S1/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S2/copies  | 520            | 159.1        | 400.42   | 6133 ms  | ok 510 ms / 160.8 MiB   | 24     |
| largest | org     | 7d     | S2/copies  | 1497           | 541.1        | 1736.18  | 13122 ms | ok 1383 ms / 527.8 MiB  | 27     |
| largest | org     | 30d    | S2/copies  | 5059           | 1238         | 5016.21  | fail 159 | FAIL 241                | –      |
| largest | org     | 90d    | S2/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S2/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S3/copies  | 267            | 142.5        | 320.5    | 9209 ms  | ok 310 ms / 135.5 MiB   | 82     |
| largest | org     | 7d     | S3/copies  | 869            | 278.1        | 1396.18  | 15697 ms | ok 790 ms / 288.5 MiB   | 101+   |
| largest | org     | 30d    | S3/copies  | 4217           | 1111.2       | 5500.5   | fail 159 | FAIL 241                | –      |
| largest | org     | 90d    | S3/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S3/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S4/copies  | 489            | 158.5        | 410.88   | 5563 ms  | ok 509 ms / 157.3 MiB   | 24     |
| largest | org     | 7d     | S4/copies  | 1322           | 542.4        | 1784.04  | 10511 ms | ok 1258 ms / 516.8 MiB  | 27     |
| largest | org     | 30d    | S4/copies  | 4598           | 1215.4       | 5147.4   | fail 159 | FAIL 241                | –      |
| largest | org     | 90d    | S4/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S4/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 30d    | S5/copies  | 21050          | 3508.3       | 66068.48 | fail 159 | FAIL 241                | –      |
| largest | org     | 90d    | S5/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S5/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 90d    | S5r/copies | 6407           | 1276.7       | 7481.53  | fail 159 | FAIL 241                | –      |
| largest | org     | 180d   | S5r/copies | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S6/copies  | 422            | 154.9        | 399.51   | 3995 ms  | ok 417 ms / 149.2 MiB   | 24     |
| largest | org     | 7d     | S6/copies  | 1468           | 538.3        | 1730.02  | 10244 ms | ok 1594 ms / 520.8 MiB  | 27     |
| largest | org     | 30d    | S6/copies  | 5505           | 1316.1       | 4998.88  | fail 159 | FAIL 241                | –      |
| largest | org     | 90d    | S6/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S6/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S7/copies  | 485            | 180.5        | 435.38   | 4159 ms  | ok 521 ms / 185.1 MiB   | 101+   |
| largest | org     | 7d     | S7/copies  | 1468           | 521.1        | 1862.37  | 9242 ms  | ok 1486 ms / 518.2 MiB  | 101+   |
| largest | org     | 30d    | S7/copies  | 5034           | 1221.8       | 5414.56  | fail 159 | FAIL 241                | –      |
| largest | org     | 90d    | S7/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S7/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S8/copies  | 510            | 175.3        | 454.47   | 4360 ms  | ok 557 ms / 151.4 MiB   | 101+   |
| largest | org     | 7d     | S8/copies  | 1627           | 530          | 1963.72  | 10869 ms | ok 1720 ms / 526.1 MiB  | 101+   |
| largest | org     | 30d    | S8/copies  | 5054           | 1217.3       | 5542.83  | fail 159 | FAIL 241                | –      |
| largest | org     | 90d    | S8/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 180d   | S8/copies  | –              | –            | –        | –        | skipped                 | –      |
| largest | org     | 1d     | S9/copies  | 731            | 148.2        | 659.77   | 14018 ms | ok 720 ms / 150.2 MiB   | 568    |
| largest | org     | 7d     | S9/copies  | 1753           | 278.6        | 2842.53  | 23018 ms | ok 1904 ms / 280.2 MiB  | 2967   |
| largest | org     | 30d    | S9/copies  | 8818           | 1243.5       | 11122.2  | fail 159 | FAIL 241                | –      |
| largest | org     | 3d     | S1/copies  | 747            | 204          | 1073.37  | 6737 ms  | ok 730 ms / 185.3 MiB   | 101+   |
| largest | org     | 14d    | S1/copies  | 1413           | 237.5        | 2139.76  | 20213 ms | ok 1357 ms / 234.6 MiB  | 101+   |
| largest | org     | 3d     | S2/copies  | 1233           | 425.1        | 1312.87  | 8825 ms  | ok 1199 ms / 446 MiB    | 24     |
| largest | org     | 14d    | S2/copies  | 2690           | 794.4        | 2639.26  | 23724 ms | ok 2895 ms / 848.1 MiB  | 27     |
| largest | org     | 3d     | S3/copies  | 741            | 201.3        | 1059.08  | 7550 ms  | ok 780 ms / 199.6 MiB   | 101+   |
| largest | org     | 14d    | S3/copies  | 1376           | 242.3        | 2115.1   | 20386 ms | ok 1327 ms / 231.5 MiB  | 101+   |
| largest | org     | 3d     | S4/copies  | 1238           | 431.1        | 1347.27  | 8243 ms  | ok 1352 ms / 442.2 MiB  | 24     |
| largest | org     | 14d    | S4/copies  | 2489           | 805.5        | 2708.1   | 23021 ms | ok 2860 ms / 693.3 MiB  | 27     |
| largest | org     | 3d     | S5/copies  | 4913           | 986.2        | 14665.59 | 14561 ms | ok 5813 ms / 904.3 MiB  | 24     |
| largest | org     | 14d    | S5/copies  | 11872          | 2275.5       | 44934.75 | fail 159 | FAIL 241                | –      |
| largest | org     | 3d     | S5r/copies | 654            | 216          | 1425.79  | 7367 ms  | ok 678 ms / 191.2 MiB   | 1      |
| largest | org     | 14d    | S5r/copies | 1802           | 645.6        | 3113.3   | fail 159 | ok 1804 ms / 597.1 MiB  | 1      |
| largest | org     | 3d     | S6/copies  | 918            | 444.7        | 1308.24  | 7272 ms  | ok 801 ms / 442 MiB     | 24     |
| largest | org     | 14d    | S6/copies  | 2143           | 859.6        | 2630.2   | 20794 ms | ok 2040 ms / 778.7 MiB  | 27     |
| largest | org     | 3d     | S7/copies  | 930            | 441.2        | 1392.42  | 5658 ms  | ok 991 ms / 406.7 MiB   | 101+   |
| largest | org     | 14d    | S7/copies  | 2685           | 820.4        | 2864.18  | 23495 ms | ok 2679 ms / 747.2 MiB  | 101+   |
| largest | org     | 3d     | S8/copies  | 1166           | 427          | 1486.93  | 7323 ms  | ok 1202 ms / 436.4 MiB  | 101+   |
| largest | org     | 14d    | S8/copies  | 2697           | 759.5        | 2952.44  | 21447 ms | ok 2705 ms / 739.9 MiB  | 101+   |
| largest | org     | 3d     | S9/copies  | 1293           | 209.6        | 2148.47  | 12541 ms | ok 1129 ms / 205.3 MiB  | 1282   |
| largest | org     | 14d    | S9/copies  | 2746           | 254.1        | 4273.02  | fail 159 | ok 2551 ms / 256.3 MiB  | 4634   |
| largest | org     | 3d     | S1         | 904            | 443.7        | 415.7    | 2751 ms  | ok 898 ms / 439.2 MiB   | 101+   |
| largest | org     | 14d    | S1         | 2006           | 1070.7       | 819.48   | 7446 ms  | FAIL 241                | –      |
| largest | org     | 3d     | S2         | 906            | 346.4        | 328.17   | 3645 ms  | ok 828 ms / 352.3 MiB   | 24     |
| largest | org     | 14d    | S2         | 2072           | 909.9        | 663.23   | 10433 ms | ok 1675 ms / 916.6 MiB  | 27     |
| largest | org     | 3d     | S3         | 1093           | 414.6        | 400.11   | 3243 ms  | ok 1023 ms / 406.8 MiB  | 101+   |
| largest | org     | 14d    | S3         | 2234           | 1026.6       | 793.96   | 10248 ms | ok 2106 ms / 1001.5 MiB | 101+   |
| largest | org     | 3d     | S4         | 967            | 363.4        | 345.17   | 3013 ms  | ok 1027 ms / 367.4 MiB  | 24     |
| largest | org     | 14d    | S4         | 2074           | 935.6        | 697.41   | 8619 ms  | ok 2164 ms / 936.3 MiB  | 27     |
| largest | org     | 3d     | S6         | 909            | 351.7        | 326.85   | 4234 ms  | ok 978 ms / 349 MiB     | 24     |
| largest | org     | 14d    | S6         | 1913           | 921          | 659.34   | 8804 ms  | ok 1828 ms / 917.2 MiB  | 27     |
| largest | org     | 3d     | S7         | 697            | 385.1        | 368.87   | 2482 ms  | ok 671 ms / 378.3 MiB   | 101+   |
| largest | org     | 14d    | S7         | 2112           | 1040.3       | 775.37   | 7226 ms  | FAIL 241                | –      |
| largest | org     | 3d     | S8         | 1124           | 434.6        | 414.88   | 2425 ms  | ok 989 ms / 438.7 MiB   | 101+   |
| largest | org     | 14d    | S8         | 2148           | 1079.6       | 819.58   | 7628 ms  | FAIL 241                | –      |
| largest | org     | 3d     | S9         | 2005           | 476.1        | 830.09   | 6268 ms  | ok 1782 ms / 478.5 MiB  | 1269   |
| largest | org     | 14d    | S9         | 3756           | 1283.8       | 1639.59  | 19010 ms | FAIL 241                | –      |

### X45: `spans.some` aggregate time on the largest org (prod replica, read-only, 2026-10-16)

**Question.** OBS-664: request C (`spans.some(spanType = tool_call AND durationMs > 1000)`, grouped by entity) on the largest org at 30 d ran 4.4–7.3 s warm against mobs-query's 9 s limit. Where does the time go, and what brings it under ~5 s without raising memory?

**Method.** Platform `main` at 775c54666 (`/tmp/platform-664`), same guarded client and selection as X41, `max_threads=16`, 4 GiB/60 s ceiling. Run alone on the replica after X43/X44 finished (other users' traffic still moves warm times by 1–3 s). `mobs-aggregate-stages.ts --request C` cut the compiled statement at each CTE; scratch scripts (`/tmp/obs664-*.ts`, not committed) rewrote `current_spans` for the variants and compared full results against `main`.

**Stages, largest org, 30 d, warm (3 reps, cumulative).**

| ends at         | ms          | MiB     | read     |
| --------------- | ----------- | ------- | -------- |
| `copied_roots`  | 130         | 100–120 | 103 MiB  |
| `current_roots` | 510         | 126–133 | 406 MiB  |
| `copied_spans`  | 1,390–1,735 | 790–822 | 1.35 GiB |
| `current_spans` | 3,900–4,290 | 803–806 | 4.05 GiB |
| `candidates`    | 4,440–4,650 | 814–825 | 4.39 GiB |
| full            | 4,300–4,430 | 805–823 | 4.40 GiB |

The span dedupe is the query: `copied_spans` builds a hash set over every span of the org (~800 MiB) and the span table is read three times (once for the set, once per reference to it). The `tool_call` condition only applies after the dedupe. `spanType` agreed across stored copies for every copied span (0 of 9,202, org-wide, 30 d).

**Variants (alternating with `main`, warm).**

| variant                                                 | ms          | MiB         | read     | result                    |
| ------------------------------------------------------- | ----------- | ----------- | -------- | ------------------------- |
| `main`                                                  | 5,590–7,460 | 784–847     | 4.4 GiB  | 12,891 traces / 79 groups |
| `spanType` before the dedupe, `copied_spans` kept       | 4,630–6,840 | 385–451     | 4.3 GiB  | same                      |
| one-pass collapse of every span (`argMax` by span)      | 3,890–4,650 | 3,400–3,720 | 1.8 GiB  | same                      |
| one-pass collapse after the `spanType` filter           | 2,260–3,030 | 326–355     | 1.77 GiB | same                      |
| `copied_spans` read once (stale copies by `ARRAY JOIN`) | 4,740       | 1,504       | 3.1 GiB  | –                         |

Cold, both `main` and the filtered one-pass variant hit the 60 s ceiling (~25 MB/s from object storage): not a SQL problem; X43's server-side retry follow-up.

**Fix (platform#3585).** When every `spans` relation in the query has conditions on fields all copies share (anything but `endedAt`/`durationMs`), `current_spans` applies their OR first, then collapses the remaining spans in order (`ORDER BY … endedAt DESC LIMIT 1 BY span`) when a relation reads a version field. Other queries keep the `copied_spans` plan. `mobs-aggregate.ts --label obs664fix --scopes project,org --windows 30d,180d --projects largest --requests C,E`:

| scope   | window | C warm ms   | C warm MiB | service  | E parity |
| ------- | ------ | ----------- | ---------- | -------- | -------- |
| project | 30 d   | 2,348–2,645 | 396–412    | ok 2.5 s | true     |
| project | 180 d  | 2,675–3,161 | 410–432    | ok 2.6 s | –        |
| org     | 30 d   | 2,143–2,556 | 351–385    | ok 2.1 s | true     |
| org     | 180 d  | 2,017–2,106 | 413–483    | ok 2.0 s | –        |

Against `main`, alternating, full per-entity results for tool calls over 1 s and for errored tool calls, project and org, 30 and 180 d: 8 of 8 identical, 1.1–2.9× faster (the errored-tool-call filter gains least: it reads no version field, so `main` already skipped `copied_spans`).

**Conclusions.**

1. OBS-664's bar is met: largest org 30 d under ~5 s warm on every run (2.1–2.6 s), project 180 d under 9 s on every run (≤ 3.2 s), memory down from ~820 to ~400 MiB, counts unchanged.
2. A span-name index (OBS-595) isn't needed for this shape; it stays parked.
3. Filters with only version-field conditions (`spans.some(durationMs > 1000)`) keep the old plan and cost.

### X44: Root span `name`/`spanType` filters and value suggestions (prod replica, read-only, 2026-10-16)

**Question.** mastra#27321 (OBS-667) makes the root span's `name` and `spanType` filterable at trace scope and adds them to value suggestions. X42 covered grouping by them; does filtering or suggesting values cost more than the same request on `entityName`?

**Method.** `root-filters.ts`, same guarded client, project selection and project-scope rewrite as X41/X42, `max_threads=16`, 4 GiB/60 s ceiling, warm-up then 3 reps, median. Compiled with the **OSS ClickHouse store from the mastra#27321 branch** (`--mastra <worktree>`: Core's planner plus `queryTraces()`, `aggregateTraces()`, `getTraceQueryValues()`), not mobs-query, which does not map these fields yet. Cells: the largest project (`a62771ca`) and its org, 7 d and 30 d. Requests, each paired with the same request on `entityName`:

- (a) `queryTraces()` page with `where name = <most common root name>` and `= <rarest>`, baseline the `entityName` value with the closest trace count;
- (b) `queryTraces()` page with `where spanType = <most common>`, baseline the most common `entityName`;
- (c) `aggregateTraces()` grouped by `entityName` (`count, errorRate, duration.p95`, top 50) with the (a) common-name filter;
- (d) trace-scope value suggestions (limit 50) for `name`, `spanType`, `entityName`.

Equivalence: the page `total`, the summed group counts and the summed value counts must equal a hand-written `uniqExact(traceId)` / `GROUP BY` over `mastra_trace_roots` for the same tenant, window and literal. Peak memory is the max over the request's statements; ms and read MiB are summed over them (`system.query_log`).

**Results (warm median; `sel` = matching share of the window's traces).** Project 7 d has 1,843 traces, project 30 d 500,916, org 7 d 65,177, org 30 d 695,887.

| Cell         | Request         | field      | sel    | MiB | ms  | read MiB | vs `entityName` (mem / ms / read) |
| ------------ | --------------- | ---------- | ------ | --- | --- | -------- | --------------------------------- |
| project 7 d  | (a) list common | `name`     | 0.71   | 187 | 133 | 24.7     | +0% / −21% / +8%                  |
|              | (a) list rare   | `name`     | 0.0005 | 187 | 114 | 10.8     | +0% / −4% / +20%                  |
|              | (b) list        | `spanType` | 1.00   | 187 | 199 | 21.6     | +0% / +1% / −6%                   |
|              | (c) aggregate   | `name`     | 0.71   | 177 | 92  | 15.3     | 0% / +3% / +15%                   |
|              | (d) values      | `name`     |        | 192 | 148 | 36.2     | +0% / +17% / +1%                  |
|              | (d) values      | `spanType` |        | 193 | 123 | 34.8     | +0% / −3% / −3%                   |
| project 30 d | (a) list common | `name`     | 0.74   | 262 | 295 | 134.9    | +4% / −29% / +4%                  |
|              | (a) list rare   | `name`     | 0.0008 | 284 | 321 | 195.1    | +5% / +2% / +3%                   |
|              | (b) list        | `spanType` | 1.00   | 320 | 488 | 115.8    | **+26%** / +7% / −11%             |
|              | (c) aggregate   | `name`     | 0.74   | 186 | 299 | 151.3    | −2% / −9% / +15%                  |
|              | (d) values      | `name`     |        | 282 | 639 | 195.9    | +1% / −9% / +2%                   |
|              | (d) values      | `spanType` |        | 256 | 821 | 176.9    | −8% / **+17%** / −8%              |
| org 7 d      | (a) list common | `name`     | 0.16   | 189 | 200 | 46.6     | +0% / −2% / +11%                  |
|              | (a) list rare   | `name`     | 0.0000 | 189 | 156 | 31.1     | 0% / −16% / +9%                   |
|              | (b) list        | `spanType` | 0.83   | 197 | 220 | 41.8     | +4% / +13% / 0%                   |
|              | (c) aggregate   | `name`     | 0.16   | 177 | 95  | 28.8     | −2% / −5% / **+20%**              |
|              | (d) values      | `name`     |        | 207 | 216 | 50.9     | +0% / +2% / +2%                   |
|              | (d) values      | `spanType` |        | 206 | 223 | 47.6     | 0% / +6% / −5%                    |
| org 30 d     | (a) list common | `name`     | 0.53   | 235 | 406 | 139.2    | −1% / **+17%** / +6%              |
|              | (a) list rare   | `name`     | 0.0000 | 197 | 101 | 49.9     | −2% / −38% / +14%                 |
|              | (b) list        | `spanType` | 0.74   | 306 | 474 | 129.4    | **+27%** / +14% / −1%             |
|              | (c) aggregate   | `name`     | 0.53   | 187 | 307 | 146.9    | −3% / **+16%** / **+18%**         |
|              | (d) values      | `name`     |        | 409 | 784 | 193.8    | +5% / +13% / +3%                  |
|              | (d) values      | `spanType` |        | 366 | 712 | 167.3    | −6% / +2% / −11%                  |

All 132 runs succeeded and every count matched the hand-written SQL. Run concurrently with w3W's X43 load grid on the same replica, so single-digit-ms differences are noise; the ms column flips sign between neighbouring cells.

**Conclusions.**

1. Filtering on root `name`/`spanType` costs the same as filtering on `entityName`. Peak memory is within ±5% in every like-for-like cell; the largest cell is 409 MiB / 0.8 s (org 30 d `name` suggestions vs 390 MiB for `entityName`), under half the 1 GiB / 9 s Platform caps.
2. The two +26–27% memory cells are `spanType` lists whose filter keeps 74–100% of the window against an `entityName` baseline keeping 53–74%: the largest project has a single root `spanType`, so no `entityName` value matches its selectivity. More surviving traces means a bigger page-mode `total` and sort, not a costlier predicate. Absolute peak is 320 MiB.
3. `name` filters read 4–20% more bytes because root names are longer strings than entity names (both are plain `String` columns in `mastra_trace_roots`). It shows as +15–20% read on the aggregate cells (+15–25 MiB) with no memory or time effect.
4. The >15% ms flags (+16–17%, a few hundred ms) are within the replica noise seen across the grid (−38% to +17% on identical shapes); none repeats across cells.
5. No change to mastra#27321 needed on ClickHouse. Every trace-scope root conjunct is pushed into the window-seed CTE automatically, the same path `entityName` takes.

**Postgres and DuckDB (local, not this replica).** Seeded 20k traces × 6 spans and ran `EXPLAIN ANALYZE` on the compiled list, aggregate and value-suggestion SQL. Both produce the same plan for `name`, `spanType` and `entityName`: the root predicate is pushed into the root scan (the `ROOT_PUSHDOWN_FIELDS` addition), Postgres drives through the root `startedAt`/`endedAt`/`traceId` partial indexes and DuckDB through a filtered sequential scan, within ±2 ms of each other (Postgres 7–26 ms, DuckDB 18–21 ms). Postgres compiles `eq` as `NOT (x IS DISTINCT FROM $v)`, which no btree index can serve, so neither the existing `mastra_span_events_name_idx` / `root_spantype_idx` nor a new index would be used; that applies equally to `entityName` today and is not specific to these fields. No index added.

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
