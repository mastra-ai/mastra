# OBS-539 findings: ClickHouse `aggregateTraces()` on production-scale data

Benchmark of the merged ClickHouse `aggregateTraces()` compiler (#25842) and the shared trace-query selection against Platform's production observability data, to inform OBS-515 (`aggregateTraces()` on mobs-query). The harness and safety model are described in [README.md](./README.md); the tables below the marker are generated from the raw results.

## Summary

- **Memory is not a concern at any project size.** Peak memory across 4 198 queries is **592 MiB** (largest bucket, `queryTraces()` with `spans.some` over 30 days). Every case at every size stays under the 1 GiB comfortable budget and far under the 4 GiB hard cap. Per bucket, peak memory is small 195 MiB, mid 218 MiB, p90 206 MiB, p99 273 MiB, largest 592 MiB.
- **Warm latency is fine.** 3 384 warm runs had 1 failure (F5, `or(env, spans.some)`, largest bucket 7d timeout). The slowest warm median is 2.5 s (E3 on the largest bucket at 30d). Single warm outliers reach 13.5 s (root-only, 8 of 2 736 runs over 7 s) and 21.9 s (span cases); their bytes read don't change, which points to replica load rather than query shape.
- **Cold reads are the latency risk.** With the filesystem cache disabled, every `spans.some` case (F3/F4/F5/E3/Q3) takes 25–30 s or times out at **every** project size, including projects with ~25 traces. Root-only cases at 7d+ take 12–24 s cold.
- **Cost barely depends on project size.** From 25 to 430 k traces (17 000×), warm latency rises 2–5× and bytes read 2–5×. Log-log slopes against trace count are about 0.1–0.2 for latency and 0.5 for bytes. The fixed cost dominates.
- **The fixed cost is the unscoped `current_roots` re-read.** Its `WHERE traceId IN (…)` has no tenant predicate, and the replica has no `traceId` skip index. So whenever the candidate set is non-empty, it reads ~2.6 M rows (the whole of `mastra_trace_roots`, all tenants) for ~90 MB. The `W1` what-if (same re-read plus `organizationId`/`projectId`) cuts bytes read 4–25× and latency about 2× for small–p99 projects. For the largest projects the gain narrows (×0.4–0.6 bytes, ×0.55–0.7 time) because their own data starts to dominate.
- **`spans.some` adds a second fixed scan.** Span cases read ~5 M rows / 185 MB even for tiny projects, rising to ~1 GB at the largest bucket over 30d.
- **The percentile and distinct-count functions don't matter at this scale.** `quantileExact` vs `quantileDeterministic` and `uniq` vs `uniqExact` are within noise in time, bytes and memory, up to the largest bucket.
- **High-cardinality grouping is safe within planner caps.** groupBy threadId/userId with limit up to 1000, `[threadId, userId]`, and I4 (threadId × 168 hourly buckets) stay under 1.1 s warm and 311 MiB on the largest projects (up to ~23 k threads in 30 days). The sample has few distinct `userId` values (most projects have none), so the userId cases understate worst-case cardinality.

## Method

- **Replica:** Platform's dedicated read-only ClickHouse Cloud service (ClickHouse 26.4). Session `readonly=0` was accepted by explicit decision (the service compute is read-only). The harness additionally allows only `SELECT`/`WITH`/`EXPLAIN`. The bench user cannot read `system.query_log`, so metrics come from the `X-ClickHouse-Summary` header with `wait_end_of_query=1`. Durations are server elapsed time; memory is the query's peak `memory_usage`.
- **Schema differences from OSS:** no skip indexes on any table, and `mastra_score_events_current` is absent, so no case uses the scores relation.
- **Scoping:** the merged compiler's SQL is used unchanged, except that every tenant-scoped scan also gets `AND projectId = ?` next to `organizationId = ?`. That's what Platform would add in `compileTenantScope`. Labelled variants (`w1`, `exact`, `uniq`, `payload-scoped`) are string rewrites of the compiled SQL and are reported separately.
- **Buckets:** the 30-day distribution is heavily right-skewed (884 projects; p50 25, p75 180, p90 1.3 k, p99 41 k, max 434 k traces). Buckets are small = p50, mid = p75, p90, p99 and largest, with 3 projects each. Core cases run on all 3 projects; the rest run on one representative.
- **Repetitions:** 1 cold run (`enable_filesystem_cache=0`) plus 5 warm runs (3 for p99/largest). Queries ran one at a time, 2 s apart, under Tier 1 limits: 30 s, 4 GiB, 4 threads, 50 GB read, 20 k result rows. Tier 2 was never needed. A limit hit on a warm run skips that case's larger windows (escalation rule), which is why F5 30d is missing for the largest bucket.
- **Windows** all end at the same anchor (`2026-10-05T17:00Z`). The largest bucket's 7d/30d runs executed about a day later than the rest, so the oldest day of their 30d window may have partially aged out under the 30-day TTL.
- **Token and cost measures (E4) are pending** OBS-389's ClickHouse PR (#25970), which was not merged when the runs happened.

## Recommendations for OBS-515

1. **Tenant-scope the `current_roots` re-read first.** Add `organizationId`/`projectId` to the outer `SELECT * FROM mastra_trace_roots WHERE traceId IN (…)` (and to the root payload lookup, for consistency). It is the dominant fixed cost for nearly every project on Platform, and it reads every tenant's roots. This is a compiler change, so it needs its own ticket.
2. **Treat `spans.some` filters as the expensive shape.** They're safe warm (median ≤2.5 s, ≤600 MiB at the largest size), but cold they hit 25–30 s at any size. Either budget a timeout above the 15 s default for queries with relation filters, or prefer pushed-down root filters (environment, entityType, etc.) in product surfaces.
3. **Memory limits:** a per-query `max_memory_usage` of 1–2 GiB gives more than 3× headroom over the observed 592 MiB peak. There's no evidence that window or cardinality caps are needed for memory reasons.
4. **Timeouts:** keep the 15 s default for root-only shapes. Expect cold-cache outliers of 12–24 s on 7d+ windows until (1) lands. Warm root-only medians stay under 2 s; rare warm outliers (up to 13.5 s) track replica load, not query shape.
5. **Limits and caps:** the planner's existing caps (limit ≤ 1000, limit × buckets ≤ 10 000, ≤ 2 group dimensions) are sufficient up to 430 k traces per project over 30 days. No extra per-size limits are needed.
6. **No change needed for the percentile/distinct functions.** `quantileDeterministic` and `uniqExact` cost the same as the alternatives here.
7. **Consider a `traceId` bloom-filter skip index** on `mastra_trace_roots` (OSS has one) as a cheaper alternative or complement to (1).

<!-- report:start -->

_Generated by `run.ts report` from `results/runs.jsonl`. Do not edit by hand._

### Replica

ClickHouse 26.4.1.2359; metrics from X-ClickHouse-Summary.

| table                  | sorting key                                                      | partition key       | rows   |
| ---------------------- | ---------------------------------------------------------------- | ------------------- | ------ |
| mastra_feedback_events | `organizationId, projectId, traceId, timestamp, feedbackId`      | `toDate(timestamp)` | 831    |
| mastra_metric_events   | `organizationId, projectId, name, timestamp, metricId`           | `toDate(timestamp)` | 26.2 M |
| mastra_span_events     | `organizationId, projectId, traceId, endedAt, spanId, dedupeKey` | `toDate(endedAt)`   | 26.2 M |
| mastra_trace_roots     | `organizationId, projectId, startedAt, traceId, dedupeKey`       | `toDate(endedAt)`   | 2.5 M  |

Skip indexes: none.

### Project size profile (last 30 days, traces per project)

884 projects. p25 5, p50 25, p75 180, p90 1 k, p99 41 k, max 434 k. Windows end at 2026-10-05T17:00:00.000Z.

| bucket  | project    | traces | spans  | threads | users | token rows |
| ------- | ---------- | ------ | ------ | ------- | ----- | ---------- |
| small   | `cea62916` | ~25    | ~93    | ~0      | ~0    | ~40        |
| small   | `0a6b8929` | ~25    | ~75    | ~0      | ~0    | ~0         |
| small   | `4359cb10` | ~25    | ~150   | ~1      | ~0    | ~75        |
| mid     | `a6ed493f` | ~180   | ~1 k   | ~0      | ~0    | ~1 k       |
| mid     | `d9177738` | ~180   | ~3 k   | ~79     | ~0    | ~720       |
| mid     | `b0b172ed` | ~180   | ~700   | ~0      | ~0    | ~1 k       |
| p90     | `370e104f` | ~1 k   | ~13 k  | ~48     | ~0    | ~8 k       |
| p90     | `c7ceaa64` | ~1 k   | ~11 k  | ~0      | ~0    | ~0         |
| p90     | `13eebeb8` | ~1 k   | ~1 k   | ~0      | ~0    | ~0         |
| p99     | `774958d5` | ~36 k  | ~270 k | ~10 k   | ~0    | ~200 k     |
| p99     | `bdd9d9fe` | ~41 k  | ~470 k | ~2 k    | ~11   | ~530 k     |
| p99     | `62b01951` | ~42 k  | ~1.1 M | ~11 k   | ~0    | ~510 k     |
| largest | `6e270364` | ~140 k | ~960 k | ~18 k   | ~0    | ~540 k     |
| largest | `40b45a96` | ~290 k | ~860 k | ~30     | ~0    | ~1 k       |
| largest | `a62771ca` | ~430 k | ~2.5 M | ~23 k   | ~0    | ~2.5 M     |

### Results

Cells: warm median / warm max (cold) latency, then median read rows · read bytes · peak memory across the bucket. `✗` marks limit or error categories.

### Canonical decision-doc examples

| case   | window | small                                                                   | mid                                                                     | p90                                                                   | p99                                                                     | largest                                                                 |
| ------ | ------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| E1     | 1d     | 54 ms / 301 ms (cold 3.11 s)<br>87 k rows · 866 kB · 176 MiB            | 56 ms / 230 ms (cold 3.81 s)<br>91 k rows · 1 MB · 192 MiB              | 76 ms / 329 ms (cold 6.22 s)<br>109 k rows · 1 MB · 190 MiB           | 157 ms / 183 ms (cold 13.4 s)<br>2.6 M rows · 93 MB · 192 MiB           | 286 ms / 6.78 s (cold 14.5 s)<br>2.6 M rows · 96 MB · 188 MiB           |
| E1     | 7d     | 158 ms / 225 ms (cold 13.9 s)<br>2.6 M rows · 90 MB · 176 MiB           | 143 ms / 161 ms (cold 14.6 s)<br>2.6 M rows · 92 MB · 192 MiB           | 54 ms / 200 ms (cold 3.48 s)<br>109 k rows · 2 MB · 188 MiB           | 185 ms / 227 ms (cold 16.0 s)<br>2.6 M rows · 103 MB · 196 MiB          | 395 ms / 574 ms (cold 23.6 s)<br>2.8 M rows · 125 MB · 207 MiB          |
| E1     | 30d    | 184 ms / 308 ms (cold 13.7 s)<br>2.6 M rows · 90 MB · 177 MiB           | 230 ms / 2.52 s (cold 16.4 s)<br>2.6 M rows · 97 MB · 192 MiB           | 160 ms / 189 ms (cold 15.2 s)<br>2.6 M rows · 101 MB · 190 MiB        | 339 ms / 513 ms (cold 17.8 s)<br>2.6 M rows · 121 MB · 192 MiB          | 575 ms / 1.29 s (cold 21.6 s)<br>3.0 M rows · 161 MB · 340 MiB ✗timeout |
| E2     | 1d     | 61 ms / 229 ms (cold 1.99 s)<br>87 k rows · 911 kB · 167 MiB            | 46 ms / 69 ms (cold 2.13 s)<br>91 k rows · 1 MB · 180 MiB               | 56 ms / 2.70 s (cold 2.17 s)<br>109 k rows · 1 MB · 179 MiB           | 144 ms / 162 ms (cold 12.3 s)<br>2.6 M rows · 93 MB · 183 MiB           | 248 ms / 303 ms (cold 14.5 s)<br>2.6 M rows · 96 MB · 185 MiB           |
| E2     | 7d     | 134 ms / 2.00 s (cold 14.4 s)<br>2.6 M rows · 91 MB · 172 MiB           | 131 ms / 232 ms (cold 12.0 s)<br>2.6 M rows · 92 MB · 180 MiB           | 43 ms / 157 ms (cold 1.95 s)<br>109 k rows · 2 MB · 180 MiB           | 167 ms / 218 ms (cold 13.5 s)<br>2.6 M rows · 103 MB · 184 MiB          | 240 ms / 371 ms (cold 17.9 s)<br>2.8 M rows · 124 MB · 197 MiB          |
| E2     | 30d    | 176 ms / 534 ms (cold 14.3 s)<br>2.6 M rows · 94 MB · 166 MiB           | 209 ms / 325 ms (cold 13.9 s)<br>2.6 M rows · 97 MB · 180 MiB           | 153 ms / 287 ms (cold 13.4 s)<br>2.6 M rows · 99 MB · 180 MiB         | 299 ms / 740 ms (cold 15.0 s)<br>2.6 M rows · 122 MB · 184 MiB          | 520 ms / 2.20 s (cold 20.6 s)<br>3.0 M rows · 214 MB · 327 MiB          |
| E3     | 1d     | 144 ms / 2.25 s (cold 3.98 s)<br>175 k rows · 2 MB · 181 MiB            | 142 ms / 190 ms (cold 4.65 s)<br>182 k rows · 2 MB · 188 MiB            | 140 ms / 2.80 s (cold 6.71 s)<br>218 k rows · 2 MB · 182 MiB ✗timeout | 645 ms / 1.10 s (cold 27.8 s)<br>5.6 M rows · 250 MB · 199 MiB ✗timeout | 724 ms / 1.59 s (cold 28.9 s)<br>6.6 M rows · 253 MB · 200 MiB ✗timeout |
| E3     | 7d     | 342 ms / 397 ms (cold 29.3 s)<br>5.2 M rows · 184 MB · 180 MiB          | 322 ms / 394 ms (cold 25.0 s)<br>5.2 M rows · 185 MB · 195 MiB          | 129 ms / 415 ms (cold 3.87 s)<br>217 k rows · 4 MB · 193 MiB          | 840 ms / 3.03 s<br>6.1 M rows · 273 MB · 189 MiB ✗timeout               | 1.28 s / 1.88 s<br>6.9 M rows · 334 MB · 369 MiB ✗timeout               |
| E3     | 30d    | 507 ms / 732 ms (cold 29.4 s)<br>5.2 M rows · 189 MB · 178 MiB ✗timeout | 512 ms / 11.0 s (cold 28.7 s)<br>5.3 M rows · 200 MB · 185 MiB ✗timeout | 568 ms / 976 ms<br>5.3 M rows · 206 MB · 184 MiB ✗timeout             | 652 ms / 800 ms<br>6.2 M rows · 372 MB · 273 MiB ✗timeout               | 2.50 s / 5.54 s<br>7.3 M rows · 631 MB · 577 MiB ✗timeout               |
| E1-doc | 7d     | 83 ms / 102 ms (cold 5.07 s)<br>88 k rows · 2 MB · 176 MiB              | 146 ms / 152 ms (cold 13.5 s)<br>2.6 M rows · 92 MB · 185 MiB           | 156 ms / 198 ms (cold 14.4 s)<br>2.6 M rows · 93 MB · 186 MiB         | 190 ms / 209 ms (cold 15.0 s)<br>2.6 M rows · 100 MB · 190 MiB          | 416 ms / 427 ms (cold 23.8 s)<br>2.9 M rows · 169 MB · 203 MiB          |
| E3-doc | 7d     | 547 ms / 673 ms (cold 28.0 s)<br>5.2 M rows · 185 MB · 179 MiB          | 348 ms / 404 ms (cold 28.3 s)<br>5.3 M rows · 185 MB · 183 MiB          | 510 ms / 683 ms (cold 28.1 s)<br>5.3 M rows · 189 MB · 191 MiB        | 457 ms / 600 ms<br>6.1 M rows · 262 MB · 185 MiB ✗timeout               | 1.78 s / 2.19 s<br>8.5 M rows · 674 MB · 369 MiB ✗timeout               |

### High-cardinality groupBy

| case | window | small                                                         | mid                                                           | p90                                                           | p99                                                            | largest                                                        |
| ---- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| H1   | 7d     | 167 ms / 211 ms (cold 13.4 s)<br>2.6 M rows · 91 MB · 166 MiB | 135 ms / 146 ms (cold 12.2 s)<br>2.6 M rows · 92 MB · 171 MiB | 210 ms / 228 ms (cold 13.0 s)<br>2.6 M rows · 93 MB · 187 MiB | 272 ms / 282 ms (cold 13.4 s)<br>2.6 M rows · 98 MB · 189 MiB  | 434 ms / 470 ms (cold 20.9 s)<br>2.9 M rows · 160 MB · 186 MiB |
| H1   | 30d    | 198 ms / 803 ms (cold 13.6 s)<br>2.6 M rows · 94 MB · 166 MiB | 206 ms / 6.23 s (cold 13.6 s)<br>2.6 M rows · 98 MB · 170 MiB | 229 ms / 271 ms (cold 14.8 s)<br>2.6 M rows · 99 MB · 184 MiB | 267 ms / 316 ms (cold 15.4 s)<br>2.6 M rows · 116 MB · 183 MiB | 850 ms / 921 ms (cold 24.6 s)<br>3.1 M rows · 234 MB · 300 MiB |
| H2   | 7d     | 217 ms / 325 ms (cold 14.3 s)<br>2.6 M rows · 91 MB · 172 MiB | 134 ms / 144 ms (cold 12.5 s)<br>2.6 M rows · 92 MB · 171 MiB | 214 ms / 236 ms (cold 14.0 s)<br>2.6 M rows · 93 MB · 179 MiB | 242 ms / 279 ms (cold 14.3 s)<br>2.6 M rows · 98 MB · 185 MiB  | 495 ms / 638 ms (cold 20.0 s)<br>2.9 M rows · 160 MB · 201 MiB |
| H2   | 30d    | 166 ms / 701 ms (cold 17.6 s)<br>2.6 M rows · 94 MB · 166 MiB | 217 ms / 259 ms (cold 13.2 s)<br>2.6 M rows · 98 MB · 171 MiB | 171 ms / 215 ms (cold 14.8 s)<br>2.6 M rows · 99 MB · 181 MiB | 285 ms / 348 ms (cold 15.3 s)<br>2.6 M rows · 116 MB · 183 MiB | 773 ms / 806 ms (cold 25.9 s)<br>3.1 M rows · 234 MB · 283 MiB |
| H3   | 7d     | 206 ms / 217 ms (cold 14.0 s)<br>2.6 M rows · 91 MB · 170 MiB | 132 ms / 148 ms (cold 12.0 s)<br>2.6 M rows · 92 MB · 172 MiB | 213 ms / 262 ms (cold 14.5 s)<br>2.6 M rows · 93 MB · 182 MiB | 242 ms / 245 ms (cold 13.7 s)<br>2.6 M rows · 98 MB · 182 MiB  | 460 ms / 521 ms (cold 19.7 s)<br>2.9 M rows · 160 MB · 187 MiB |
| H3   | 30d    | 231 ms / 273 ms (cold 17.0 s)<br>2.6 M rows · 94 MB · 166 MiB | 220 ms / 237 ms (cold 12.8 s)<br>2.6 M rows · 98 MB · 170 MiB | 156 ms / 156 ms (cold 14.2 s)<br>2.6 M rows · 99 MB · 182 MiB | 319 ms / 330 ms (cold 14.9 s)<br>2.6 M rows · 116 MB · 184 MiB | 722 ms / 807 ms (cold 28.3 s)<br>3.1 M rows · 234 MB · 298 MiB |
| H4   | 7d     | 175 ms / 215 ms (cold 14.1 s)<br>2.6 M rows · 91 MB · 172 MiB | 134 ms / 141 ms (cold 12.4 s)<br>2.6 M rows · 92 MB · 170 MiB | 1.95 s / 8.93 s (cold 13.4 s)<br>2.6 M rows · 93 MB · 184 MiB | 262 ms / 278 ms (cold 13.6 s)<br>2.6 M rows · 98 MB · 181 MiB  | 543 ms / 761 ms (cold 23.6 s)<br>2.9 M rows · 159 MB · 188 MiB |
| H4   | 30d    | 241 ms / 346 ms (cold 16.7 s)<br>2.6 M rows · 94 MB · 166 MiB | 197 ms / 233 ms (cold 13.0 s)<br>2.6 M rows · 98 MB · 171 MiB | 151 ms / 172 ms (cold 14.7 s)<br>2.6 M rows · 99 MB · 180 MiB | 253 ms / 480 ms (cold 15.6 s)<br>2.6 M rows · 115 MB · 197 MiB | 744 ms / 813 ms (cold 26.1 s)<br>3.1 M rows · 233 MB · 299 MiB |
| H5   | 7d     | 182 ms / 274 ms (cold 14.6 s)<br>2.6 M rows · 91 MB · 166 MiB | 134 ms / 152 ms (cold 11.8 s)<br>2.6 M rows · 92 MB · 174 MiB | 163 ms / 237 ms (cold 13.3 s)<br>2.6 M rows · 93 MB · 184 MiB | 163 ms / 8.44 s (cold 17.1 s)<br>2.6 M rows · 98 MB · 179 MiB  | 450 ms / 501 ms (cold 20.7 s)<br>2.9 M rows · 159 MB · 188 MiB |
| H5   | 30d    | 190 ms / 221 ms (cold 14.1 s)<br>2.6 M rows · 94 MB · 166 MiB | 182 ms / 204 ms (cold 12.5 s)<br>2.6 M rows · 98 MB · 174 MiB | 141 ms / 158 ms (cold 14.4 s)<br>2.6 M rows · 99 MB · 179 MiB | 201 ms / 251 ms (cold 16.4 s)<br>2.6 M rows · 115 MB · 185 MiB | 526 ms / 562 ms (cold 25.6 s)<br>3.1 M rows · 233 MB · 296 MiB |
| H6   | 7d     | 185 ms / 206 ms (cold 14.4 s)<br>2.6 M rows · 91 MB · 170 MiB | 141 ms / 147 ms (cold 12.6 s)<br>2.6 M rows · 92 MB · 170 MiB | 142 ms / 151 ms (cold 13.0 s)<br>2.6 M rows · 93 MB · 179 MiB | 156 ms / 204 ms (cold 13.5 s)<br>2.6 M rows · 99 MB · 182 MiB  | 1.05 s / 1.59 s (cold 20.3 s)<br>2.9 M rows · 162 MB · 188 MiB |
| H6   | 30d    | 183 ms / 211 ms (cold 13.1 s)<br>2.6 M rows · 94 MB · 168 MiB | 252 ms / 4.14 s (cold 12.9 s)<br>2.6 M rows · 99 MB · 172 MiB | 158 ms / 179 ms (cold 14.7 s)<br>2.6 M rows · 99 MB · 179 MiB | 209 ms / 216 ms (cold 15.1 s)<br>2.6 M rows · 116 MB · 186 MiB | 839 ms / 1.22 s (cold 25.3 s)<br>3.1 M rows · 238 MB · 311 MiB |
| H7   | 7d     | 179 ms / 204 ms (cold 13.9 s)<br>2.6 M rows · 91 MB · 166 MiB | 138 ms / 154 ms (cold 12.4 s)<br>2.6 M rows · 92 MB · 172 MiB | 152 ms / 164 ms (cold 12.8 s)<br>2.6 M rows · 93 MB · 181 MiB | 157 ms / 634 ms (cold 13.2 s)<br>2.6 M rows · 99 MB · 181 MiB  | 370 ms / 402 ms (cold 19.6 s)<br>2.9 M rows · 163 MB · 187 MiB |
| H7   | 30d    | 198 ms / 1.81 s (cold 12.9 s)<br>2.6 M rows · 94 MB · 167 MiB | 175 ms / 9.43 s (cold 13.1 s)<br>2.6 M rows · 99 MB · 174 MiB | 155 ms / 157 ms (cold 14.5 s)<br>2.6 M rows · 99 MB · 179 MiB | 209 ms / 224 ms (cold 15.9 s)<br>2.6 M rows · 116 MB · 184 MiB | 767 ms / 845 ms (cold 24.4 s)<br>3.1 M rows · 238 MB · 308 MiB |

### Interval path at the bucket cap

| case | window   | small                                                         | mid                                                           | p90                                                            | p99                                                            | largest                                                        |
| ---- | -------- | ------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| I1   | 1000x15m | 212 ms / 376 ms (cold 13.2 s)<br>2.6 M rows · 92 MB · 167 MiB | 219 ms / 282 ms (cold 12.9 s)<br>2.6 M rows · 92 MB · 171 MiB | 145 ms / 148 ms (cold 13.7 s)<br>2.6 M rows · 94 MB · 181 MiB  | 177 ms / 226 ms (cold 14.1 s)<br>2.6 M rows · 100 MB · 183 MiB | 594 ms / 607 ms (cold 22.5 s)<br>2.9 M rows · 194 MB · 239 MiB |
| I2   | 720x1h   | 215 ms / 224 ms (cold 14.0 s)<br>2.6 M rows · 94 MB · 171 MiB | 231 ms / 254 ms (cold 13.4 s)<br>2.6 M rows · 99 MB · 171 MiB | 146 ms / 155 ms (cold 13.8 s)<br>2.6 M rows · 101 MB · 181 MiB | 248 ms / 249 ms (cold 15.2 s)<br>2.6 M rows · 121 MB · 185 MiB | 764 ms / 782 ms (cold 25.9 s)<br>3.1 M rows · 250 MB · 334 MiB |
| I3   | 1000x1m  | 61 ms / 1.60 s (cold 2.81 s)<br>88 k rows · 840 kB · 167 MiB  | 52 ms / 71 ms (cold 1.92 s)<br>103 k rows · 1 MB · 176 MiB    | 206 ms / 231 ms (cold 12.9 s)<br>2.6 M rows · 91 MB · 180 MiB  | 190 ms / 209 ms (cold 11.7 s)<br>2.6 M rows · 91 MB · 180 MiB  | 228 ms / 270 ms (cold 12.2 s)<br>2.6 M rows · 96 MB · 181 MiB  |
| I4   | 168x1h   | 152 ms / 159 ms (cold 17.7 s)<br>2.6 M rows · 91 MB · 169 MiB | 137 ms / 151 ms (cold 12.4 s)<br>2.6 M rows · 92 MB · 173 MiB | 177 ms / 438 ms (cold 13.1 s)<br>2.6 M rows · 93 MB · 180 MiB  | 170 ms / 199 ms (cold 12.9 s)<br>2.6 M rows · 99 MB · 182 MiB  | 355 ms / 356 ms (cold 19.7 s)<br>2.9 M rows · 165 MB · 192 MiB |

### Pushed-down vs non-pushed `where`

| case  | window | small                                                                   | mid                                                            | p90                                                                     | p99                                                                     | largest                                                                 |
| ----- | ------ | ----------------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| F0    | 1d     | 46 ms / 462 ms (cold 2.51 s)<br>88 k rows · 900 kB · 168 MiB            | 40 ms / 95 ms (cold 2.52 s)<br>91 k rows · 1 MB · 180 MiB      | 43 ms / 251 ms (cold 1.96 s)<br>109 k rows · 1 MB · 180 MiB             | 130 ms / 160 ms (cold 12.1 s)<br>2.6 M rows · 93 MB · 184 MiB           | 151 ms / 169 ms (cold 12.4 s)<br>2.6 M rows · 96 MB · 187 MiB           |
| F0    | 7d     | 166 ms / 696 ms (cold 13.9 s)<br>2.6 M rows · 91 MB · 172 MiB           | 159 ms / 454 ms (cold 14.6 s)<br>2.6 M rows · 91 MB · 180 MiB  | 43 ms / 176 ms (cold 2.12 s)<br>109 k rows · 2 MB · 179 MiB             | 244 ms / 325 ms (cold 13.8 s)<br>2.6 M rows · 102 MB · 192 MiB          | 405 ms / 13.0 s (cold 20.8 s)<br>2.8 M rows · 121 MB · 189 MiB          |
| F0    | 30d    | 154 ms / 2.15 s (cold 13.6 s)<br>2.6 M rows · 94 MB · 173 MiB           | 139 ms / 154 ms (cold 13.6 s)<br>2.6 M rows · 97 MB · 181 MiB  | 218 ms / 284 ms (cold 13.6 s)<br>2.6 M rows · 99 MB · 180 MiB           | 227 ms / 279 ms (cold 14.5 s)<br>2.6 M rows · 119 MB · 187 MiB          | 517 ms / 965 ms (cold 22.0 s)<br>3.0 M rows · 204 MB · 303 MiB          |
| F0-w1 | 1d     | 73 ms / 168 ms (cold 2.40 s)<br>88 k rows · 900 kB · 187 MiB            | 42 ms / 69 ms (cold 1.71 s)<br>91 k rows · 1 MB · 181 MiB      | 50 ms / 160 ms (cold 1.95 s)<br>109 k rows · 1 MB · 204 MiB             | 62 ms / 80 ms (cold 3.46 s)<br>234 k rows · 7 MB · 213 MiB              | 82 ms / 108 ms (cold 4.67 s)<br>623 k rows · 23 MB · 222 MiB            |
| F0-w1 | 7d     | 98 ms / 112 ms (cold 4.06 s)<br>149 k rows · 4 MB · 195 MiB             | 70 ms / 159 ms (cold 2.95 s)<br>112 k rows · 4 MB · 194 MiB    | 45 ms / 1.80 s (cold 2.09 s)<br>109 k rows · 2 MB · 206 MiB             | 122 ms / 156 ms (cold 6.18 s)<br>244 k rows · 16 MB · 217 MiB           | 222 ms / 654 ms (cold 9.76 s)<br>695 k rows · 46 MB · 245 MiB           |
| F0-w1 | 30d    | 62 ms / 123 ms (cold 4.18 s)<br>148 k rows · 7 MB · 187 MiB             | 65 ms / 87 ms (cold 4.28 s)<br>184 k rows · 8 MB · 218 MiB     | 88 ms / 132 ms (cold 5.29 s)<br>186 k rows · 12 MB · 204 MiB            | 119 ms / 127 ms (cold 7.53 s)<br>270 k rows · 32 MB · 224 MiB           | 346 ms / 497 ms (cold 15.2 s)<br>903 k rows · 119 MB · 271 MiB          |
| F1    | 1d     | 76 ms / 732 ms (cold 3.08 s)<br>87 k rows · 867 kB · 175 MiB            | 47 ms / 74 ms (cold 3.34 s)<br>91 k rows · 1 MB · 187 MiB      | 94 ms / 235 ms (cold 3.36 s)<br>109 k rows · 1 MB · 185 MiB             | 194 ms / 238 ms (cold 13.5 s)<br>2.6 M rows · 93 MB · 191 MiB           | 163 ms / 300 ms (cold 13.7 s)<br>2.6 M rows · 95 MB · 193 MiB           |
| F1    | 7d     | 149 ms / 1.33 s (cold 14.9 s)<br>2.6 M rows · 90 MB · 175 MiB           | 137 ms / 318 ms (cold 14.5 s)<br>2.6 M rows · 92 MB · 195 MiB  | 73 ms / 235 ms (cold 3.38 s)<br>109 k rows · 2 MB · 185 MiB             | 252 ms / 502 ms (cold 15.1 s)<br>2.6 M rows · 101 MB · 191 MiB          | 366 ms / 1.21 s (cold 19.9 s)<br>2.8 M rows · 121 MB · 186 MiB          |
| F1    | 30d    | 161 ms / 233 ms (cold 13.8 s)<br>2.6 M rows · 90 MB · 178 MiB           | 146 ms / 165 ms (cold 15.0 s)<br>2.6 M rows · 96 MB · 191 MiB  | 263 ms / 13.5 s (cold 16.7 s)<br>2.6 M rows · 99 MB · 193 MiB           | 280 ms / 331 ms (cold 17.7 s)<br>2.6 M rows · 115 MB · 191 MiB          | 398 ms / 960 ms (cold 22.3 s)<br>3.0 M rows · 150 MB · 277 MiB ✗timeout |
| F1-w1 | 1d     | 66 ms / 206 ms (cold 3.31 s)<br>87 k rows · 866 kB · 185 MiB            | 53 ms / 118 ms (cold 3.39 s)<br>91 k rows · 1 MB · 191 MiB     | 66 ms / 2.05 s (cold 3.23 s)<br>109 k rows · 1 MB · 203 MiB             | 94 ms / 121 ms (cold 5.21 s)<br>234 k rows · 8 MB · 203 MiB             | 96 ms / 132 ms (cold 6.25 s)<br>623 k rows · 23 MB · 210 MiB            |
| F1-w1 | 7d     | 106 ms / 4.03 s (cold 4.12 s)<br>149 k rows · 4 MB · 189 MiB            | 66 ms / 234 ms (cold 3.91 s)<br>111 k rows · 4 MB · 197 MiB    | 49 ms / 190 ms (cold 3.89 s)<br>109 k rows · 2 MB · 204 MiB             | 138 ms / 154 ms (cold 7.12 s)<br>244 k rows · 15 MB · 205 MiB           | 254 ms / 452 ms (cold 12.3 s)<br>696 k rows · 45 MB · 233 MiB           |
| F1-w1 | 30d    | 67 ms / 3.21 s (cold 3.94 s)<br>148 k rows · 3 MB · 185 MiB             | 71 ms / 73 ms (cold 5.99 s)<br>184 k rows · 8 MB · 200 MiB     | 132 ms / 2.73 s (cold 7.41 s)<br>185 k rows · 12 MB · 205 MiB           | 187 ms / 225 ms (cold 10.5 s)<br>270 k rows · 28 MB · 227 MiB           | 287 ms / 905 ms (cold 18.7 s)<br>903 k rows · 65 MB · 261 MiB           |
| F2    | 1d     | 46 ms / 51 ms (cold 2.12 s)<br>87 k rows · 178 kB · 179 MiB             | 53 ms / 82 ms (cold 4.35 s)<br>103 k rows · 1 MB · 183 MiB     | 211 ms / 235 ms (cold 17.4 s)<br>2.6 M rows · 91 MB · 195 MiB           | 208 ms / 630 ms (cold 15.8 s)<br>2.6 M rows · 92 MB · 200 MiB           | 182 ms / 246 ms (cold 15.9 s)<br>2.6 M rows · 99 MB · 217 MiB           |
| F2    | 7d     | 191 ms / 269 ms (cold 14.7 s)<br>2.6 M rows · 90 MB · 179 MiB           | 221 ms / 266 ms (cold 16.9 s)<br>2.6 M rows · 92 MB · 183 MiB  | 219 ms / 567 ms (cold 16.5 s)<br>2.6 M rows · 92 MB · 191 MiB           | 247 ms / 276 ms (cold 16.9 s)<br>2.6 M rows · 98 MB · 195 MiB           | 513 ms / 1.48 s<br>2.9 M rows · 160 MB · 206 MiB ✗timeout               |
| F2    | 30d    | 144 ms / 153 ms (cold 15.1 s)<br>2.6 M rows · 90 MB · 179 MiB           | 159 ms / 164 ms (cold 16.6 s)<br>2.6 M rows · 96 MB · 183 MiB  | 166 ms / 203 ms (cold 16.8 s)<br>2.6 M rows · 97 MB · 199 MiB           | 400 ms / 434 ms (cold 20.5 s)<br>2.6 M rows · 115 MB · 195 MiB          | 704 ms / 2.05 s<br>3.1 M rows · 234 MB · 283 MiB ✗timeout               |
| F3    | 1d     | 125 ms / 2.03 s (cold 3.45 s)<br>175 k rows · 2 MB · 180 MiB ✗timeout   | 156 ms / 307 ms (cold 4.88 s)<br>181 k rows · 2 MB · 193 MiB   | 112 ms / 359 ms (cold 3.32 s)<br>218 k rows · 2 MB · 193 MiB            | 638 ms / 978 ms (cold 27.6 s)<br>5.6 M rows · 236 MB · 196 MiB          | 645 ms / 798 ms (cold 28.0 s)<br>6.6 M rows · 248 MB · 198 MiB          |
| F3    | 7d     | 331 ms / 433 ms (cold 28.0 s)<br>5.2 M rows · 184 MB · 179 MiB          | 308 ms / 435 ms (cold 26.3 s)<br>5.2 M rows · 185 MB · 195 MiB | 112 ms / 408 ms (cold 3.89 s)<br>217 k rows · 4 MB · 192 MiB            | 757 ms / 896 ms (cold 28.1 s)<br>6.1 M rows · 252 MB · 190 MiB ✗timeout | 1.58 s / 2.77 s<br>6.9 M rows · 324 MB · 374 MiB ✗timeout               |
| F3    | 30d    | 346 ms / 432 ms (cold 29.1 s)<br>5.2 M rows · 189 MB · 180 MiB ✗timeout | 350 ms / 696 ms (cold 29.3 s)<br>5.3 M rows · 195 MB · 193 MiB | 572 ms / 907 ms (cold 27.9 s)<br>5.3 M rows · 200 MB · 184 MiB ✗timeout | 794 ms / 1.06 s<br>6.2 M rows · 343 MB · 267 MiB ✗timeout               | 1.52 s / 3.52 s<br>7.3 M rows · 593 MB · 548 MiB ✗timeout               |
| F4    | 1d     | 136 ms / 733 ms (cold 9.14 s)<br>175 k rows · 357 kB · 179 MiB          | 158 ms / 225 ms (cold 10.8 s)<br>206 k rows · 2 MB · 187 MiB   | 362 ms / 638 ms<br>5.3 M rows · 185 MB · 192 MiB ✗timeout               | 624 ms / 836 ms<br>5.5 M rows · 196 MB · 190 MiB ✗timeout               | 785 ms / 4.25 s<br>7.9 M rows · 331 MB · 200 MiB ✗timeout               |
| F4    | 7d     | 345 ms / 623 ms<br>5.2 M rows · 182 MB · 178 MiB ✗timeout               | 353 ms / 583 ms<br>5.3 M rows · 185 MB · 187 MiB ✗timeout      | 509 ms / 837 ms<br>5.3 M rows · 188 MB · 192 MiB ✗timeout               | 481 ms / 946 ms<br>6.1 M rows · 252 MB · 194 MiB ✗timeout               | 1.66 s / 21.9 s<br>8.5 M rows · 632 MB · 369 MiB ✗timeout               |
| F4    | 30d    | 364 ms / 403 ms<br>5.2 M rows · 182 MB · 178 MiB ✗timeout               | 367 ms / 523 ms<br>5.3 M rows · 195 MB · 187 MiB ✗timeout      | 678 ms / 1.24 s<br>5.3 M rows · 200 MB · 196 MiB ✗timeout               | 1.04 s / 1.66 s<br>6.2 M rows · 344 MB · 204 MiB ✗timeout               | 1.76 s / 5.78 s<br>9.0 M rows · 970 MB · 551 MiB ✗timeout               |
| F5    | 1d     | 138 ms / 216 ms (cold 3.00 s)<br>175 k rows · 2 MB · 169 MiB            | 136 ms / 143 ms (cold 3.89 s)<br>206 k rows · 2 MB · 183 MiB   | 547 ms / 638 ms (cold 26.8 s)<br>5.3 M rows · 184 MB · 192 MiB          | 349 ms / 465 ms (cold 29.7 s)<br>5.5 M rows · 195 MB · 192 MiB          | 756 ms / 822 ms (cold 29.3 s)<br>7.9 M rows · 331 MB · 195 MiB          |
| F5    | 7d     | 332 ms / 380 ms (cold 29.3 s)<br>5.2 M rows · 184 MB · 179 MiB          | 521 ms / 563 ms (cold 28.4 s)<br>5.3 M rows · 185 MB · 183 MiB | 358 ms / 442 ms (cold 29.2 s)<br>5.3 M rows · 188 MB · 193 MiB          | 722 ms / 748 ms<br>6.1 M rows · 252 MB · 186 MiB ✗timeout               | ✗ timeout                                                               |
| F5    | 30d    | 344 ms / 504 ms (cold 29.3 s)<br>5.2 M rows · 189 MB · 180 MiB          | 545 ms / 658 ms (cold 28.7 s)<br>5.3 M rows · 199 MB · 184 MiB | 624 ms / 668 ms<br>5.3 M rows · 200 MB · 184 MiB ✗timeout               | 629 ms / 654 ms<br>6.2 M rows · 343 MB · 198 MiB ✗timeout               | –                                                                       |

### countDistinct

| case    | window | small                                                         | mid                                                           | p90                                                           | p99                                                            | largest                                                        |
| ------- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| C1      | 7d     | 155 ms / 158 ms (cold 13.2 s)<br>2.6 M rows · 91 MB · 169 MiB | 193 ms / 234 ms (cold 14.0 s)<br>2.6 M rows · 92 MB · 170 MiB | 141 ms / 162 ms (cold 13.3 s)<br>2.6 M rows · 93 MB · 182 MiB | 221 ms / 235 ms (cold 13.8 s)<br>2.6 M rows · 98 MB · 189 MiB  | 335 ms / 381 ms (cold 19.4 s)<br>2.9 M rows · 157 MB · 192 MiB |
| C1      | 30d    | 206 ms / 7.63 s (cold 13.5 s)<br>2.6 M rows · 94 MB · 166 MiB | 202 ms / 224 ms (cold 13.6 s)<br>2.6 M rows · 98 MB · 171 MiB | 155 ms / 187 ms (cold 13.7 s)<br>2.6 M rows · 99 MB · 179 MiB | 326 ms / 348 ms (cold 15.5 s)<br>2.6 M rows · 114 MB · 187 MiB | 582 ms / 605 ms (cold 24.6 s)<br>3.1 M rows · 228 MB · 269 MiB |
| C1-uniq | 7d     | 155 ms / 230 ms (cold 13.1 s)<br>2.6 M rows · 91 MB · 167 MiB | 184 ms / 213 ms (cold 12.8 s)<br>2.6 M rows · 92 MB · 174 MiB | 136 ms / 248 ms (cold 12.9 s)<br>2.6 M rows · 93 MB · 185 MiB | 215 ms / 226 ms (cold 14.2 s)<br>2.6 M rows · 98 MB · 191 MiB  | 314 ms / 316 ms (cold 19.1 s)<br>2.9 M rows · 157 MB · 188 MiB |
| C1-uniq | 30d    | 153 ms / 221 ms (cold 15.6 s)<br>2.6 M rows · 94 MB · 171 MiB | 153 ms / 924 ms (cold 13.2 s)<br>2.6 M rows · 98 MB · 171 MiB | 152 ms / 1.72 s (cold 13.9 s)<br>2.6 M rows · 99 MB · 179 MiB | 288 ms / 347 ms (cold 15.4 s)<br>2.6 M rows · 114 MB · 184 MiB | 511 ms / 513 ms (cold 22.4 s)<br>3.1 M rows · 228 MB · 289 MiB |
| C2      | 7d     | 143 ms / 147 ms (cold 13.3 s)<br>2.6 M rows · 91 MB · 167 MiB | 215 ms / 3.02 s (cold 14.0 s)<br>2.6 M rows · 92 MB · 173 MiB | 167 ms / 234 ms (cold 13.4 s)<br>2.6 M rows · 93 MB · 180 MiB | 259 ms / 286 ms (cold 14.5 s)<br>2.6 M rows · 98 MB · 179 MiB  | 327 ms / 328 ms (cold 20.8 s)<br>2.9 M rows · 160 MB · 188 MiB |
| C2      | 30d    | 223 ms / 1.30 s (cold 13.9 s)<br>2.6 M rows · 94 MB · 168 MiB | 152 ms / 158 ms (cold 14.3 s)<br>2.6 M rows · 98 MB · 177 MiB | 148 ms / 155 ms (cold 15.4 s)<br>2.6 M rows · 99 MB · 181 MiB | 259 ms / 350 ms (cold 15.3 s)<br>2.6 M rows · 116 MB · 187 MiB | 535 ms / 551 ms (cold 26.2 s)<br>3.1 M rows · 234 MB · 298 MiB |
| C2-uniq | 7d     | 134 ms / 144 ms (cold 13.5 s)<br>2.6 M rows · 91 MB · 166 MiB | 250 ms / 1.13 s (cold 12.9 s)<br>2.6 M rows · 92 MB · 171 MiB | 144 ms / 149 ms (cold 13.0 s)<br>2.6 M rows · 93 MB · 179 MiB | 236 ms / 244 ms (cold 13.7 s)<br>2.6 M rows · 98 MB · 184 MiB  | 334 ms / 372 ms (cold 20.6 s)<br>2.9 M rows · 160 MB · 187 MiB |
| C2-uniq | 30d    | 156 ms / 219 ms (cold 13.7 s)<br>2.6 M rows · 94 MB · 166 MiB | 220 ms / 475 ms (cold 14.5 s)<br>2.6 M rows · 98 MB · 171 MiB | 150 ms / 153 ms (cold 14.1 s)<br>2.6 M rows · 99 MB · 179 MiB | 261 ms / 336 ms (cold 15.5 s)<br>2.6 M rows · 116 MB · 187 MiB | 502 ms / 524 ms (cold 23.1 s)<br>3.1 M rows · 234 MB · 276 MiB |
| C3      | 7d     | 139 ms / 151 ms (cold 15.8 s)<br>2.6 M rows · 91 MB · 166 MiB | 155 ms / 175 ms (cold 13.5 s)<br>2.6 M rows · 92 MB · 172 MiB | 205 ms / 2.56 s (cold 13.3 s)<br>2.6 M rows · 93 MB · 184 MiB | 238 ms / 242 ms (cold 13.7 s)<br>2.6 M rows · 99 MB · 185 MiB  | 401 ms / 411 ms (cold 23.8 s)<br>2.9 M rows · 166 MB · 196 MiB |
| C3      | 30d    | 196 ms / 932 ms (cold 13.5 s)<br>2.6 M rows · 94 MB · 172 MiB | 209 ms / 227 ms (cold 13.9 s)<br>2.6 M rows · 99 MB · 173 MiB | 151 ms / 160 ms (cold 13.8 s)<br>2.6 M rows · 99 MB · 181 MiB | 297 ms / 333 ms (cold 16.2 s)<br>2.6 M rows · 117 MB · 187 MiB | 552 ms / 751 ms (cold 24.1 s)<br>3.1 M rows · 247 MB · 305 MiB |
| C3-uniq | 7d     | 129 ms / 134 ms (cold 12.7 s)<br>2.6 M rows · 91 MB · 166 MiB | 132 ms / 142 ms (cold 13.5 s)<br>2.6 M rows · 92 MB · 176 MiB | 215 ms / 224 ms (cold 16.5 s)<br>2.6 M rows · 93 MB · 186 MiB | 260 ms / 285 ms (cold 13.3 s)<br>2.6 M rows · 99 MB · 182 MiB  | 336 ms / 345 ms (cold 21.8 s)<br>2.9 M rows · 166 MB · 198 MiB |
| C3-uniq | 30d    | 143 ms / 153 ms (cold 14.1 s)<br>2.6 M rows · 94 MB · 167 MiB | 247 ms / 283 ms (cold 13.1 s)<br>2.6 M rows · 99 MB · 171 MiB | 156 ms / 163 ms (cold 13.8 s)<br>2.6 M rows · 99 MB · 180 MiB | 324 ms / 467 ms (cold 16.1 s)<br>2.6 M rows · 117 MB · 183 MiB | 532 ms / 590 ms (cold 24.1 s)<br>3.1 M rows · 247 MB · 308 MiB |

### Percentiles

| case     | window | small                                                         | mid                                                           | p90                                                           | p99                                                            | largest                                                        |
| -------- | ------ | ------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- |
| P1       | 7d     | 132 ms / 148 ms (cold 13.8 s)<br>2.6 M rows · 91 MB · 168 MiB | 134 ms / 141 ms (cold 13.0 s)<br>2.6 M rows · 92 MB · 172 MiB | 216 ms / 227 ms (cold 14.0 s)<br>2.6 M rows · 93 MB · 182 MiB | 153 ms / 167 ms (cold 15.1 s)<br>2.6 M rows · 98 MB · 183 MiB  | 517 ms / 524 ms (cold 22.1 s)<br>2.9 M rows · 159 MB · 184 MiB |
| P1       | 30d    | 183 ms / 201 ms (cold 13.9 s)<br>2.6 M rows · 94 MB · 168 MiB | 207 ms / 244 ms (cold 14.7 s)<br>2.6 M rows · 98 MB · 172 MiB | 151 ms / 155 ms (cold 13.8 s)<br>2.6 M rows · 99 MB · 180 MiB | 303 ms / 328 ms (cold 16.7 s)<br>2.6 M rows · 115 MB · 183 MiB | 700 ms / 799 ms (cold 23.4 s)<br>3.1 M rows · 232 MB · 306 MiB |
| P1-exact | 7d     | 132 ms / 176 ms (cold 13.6 s)<br>2.6 M rows · 91 MB · 167 MiB | 130 ms / 139 ms (cold 12.3 s)<br>2.6 M rows · 92 MB · 172 MiB | 150 ms / 155 ms (cold 13.8 s)<br>2.6 M rows · 93 MB · 181 MiB | 272 ms / 5.16 s (cold 13.4 s)<br>2.6 M rows · 98 MB · 179 MiB  | 489 ms / 502 ms (cold 23.0 s)<br>2.9 M rows · 159 MB · 184 MiB |
| P1-exact | 30d    | 181 ms / 210 ms (cold 14.9 s)<br>2.6 M rows · 94 MB · 166 MiB | 149 ms / 1.10 s (cold 13.4 s)<br>2.6 M rows · 98 MB · 170 MiB | 230 ms / 259 ms (cold 13.7 s)<br>2.6 M rows · 99 MB · 186 MiB | 313 ms / 404 ms (cold 18.0 s)<br>2.6 M rows · 115 MB · 183 MiB | 688 ms / 741 ms (cold 24.0 s)<br>3.1 M rows · 232 MB · 276 MiB |
| P2       | 7d     | 134 ms / 143 ms (cold 13.4 s)<br>2.6 M rows · 91 MB · 166 MiB | 108 ms / 134 ms (cold 12.5 s)<br>2.6 M rows · 92 MB · 171 MiB | 201 ms / 236 ms (cold 13.2 s)<br>2.6 M rows · 93 MB · 180 MiB | 268 ms / 271 ms (cold 15.3 s)<br>2.6 M rows · 99 MB · 179 MiB  | 580 ms / 609 ms (cold 21.5 s)<br>2.9 M rows · 166 MB · 189 MiB |
| P2       | 30d    | 204 ms / 242 ms (cold 13.4 s)<br>2.6 M rows · 94 MB · 166 MiB | 147 ms / 157 ms (cold 13.3 s)<br>2.6 M rows · 99 MB · 172 MiB | 236 ms / 271 ms (cold 14.5 s)<br>2.6 M rows · 99 MB · 179 MiB | 311 ms / 7.06 s (cold 16.9 s)<br>2.6 M rows · 117 MB · 183 MiB | 592 ms / 662 ms (cold 25.7 s)<br>3.1 M rows · 246 MB · 332 MiB |
| P2-exact | 7d     | 134 ms / 135 ms (cold 13.1 s)<br>2.6 M rows · 91 MB · 166 MiB | 139 ms / 141 ms (cold 12.5 s)<br>2.6 M rows · 92 MB · 173 MiB | 215 ms / 306 ms (cold 14.0 s)<br>2.6 M rows · 93 MB · 179 MiB | 300 ms / 313 ms (cold 16.3 s)<br>2.6 M rows · 99 MB · 187 MiB  | 509 ms / 665 ms (cold 20.6 s)<br>2.9 M rows · 166 MB · 196 MiB |
| P2-exact | 30d    | 143 ms / 162 ms (cold 15.1 s)<br>2.6 M rows · 94 MB · 166 MiB | 147 ms / 151 ms (cold 13.3 s)<br>2.6 M rows · 99 MB · 172 MiB | 263 ms / 338 ms (cold 13.9 s)<br>2.6 M rows · 99 MB · 180 MiB | 202 ms / 227 ms (cold 17.7 s)<br>2.6 M rows · 117 MB · 185 MiB | 621 ms / 645 ms (cold 25.3 s)<br>3.1 M rows · 246 MB · 326 MiB |
| P3       | 7d     | 200 ms / 224 ms (cold 13.7 s)<br>2.6 M rows · 91 MB · 167 MiB | 135 ms / 149 ms (cold 12.6 s)<br>2.6 M rows · 92 MB · 173 MiB | 212 ms / 250 ms (cold 13.1 s)<br>2.6 M rows · 93 MB · 186 MiB | 155 ms / 174 ms (cold 13.8 s)<br>2.6 M rows · 99 MB · 179 MiB  | 526 ms / 587 ms (cold 21.2 s)<br>2.9 M rows · 163 MB · 193 MiB |
| P3       | 30d    | 160 ms / 227 ms (cold 16.4 s)<br>2.6 M rows · 94 MB · 166 MiB | 212 ms / 305 ms (cold 13.6 s)<br>2.6 M rows · 99 MB · 175 MiB | 224 ms / 269 ms (cold 15.2 s)<br>2.6 M rows · 99 MB · 180 MiB | 219 ms / 223 ms (cold 15.7 s)<br>2.6 M rows · 116 MB · 184 MiB | 591 ms / 601 ms (cold 26.4 s)<br>3.1 M rows · 238 MB · 312 MiB |
| P3-exact | 7d     | 179 ms / 214 ms (cold 14.2 s)<br>2.6 M rows · 91 MB · 167 MiB | 130 ms / 137 ms (cold 12.5 s)<br>2.6 M rows · 92 MB · 170 MiB | 219 ms / 223 ms (cold 14.0 s)<br>2.6 M rows · 93 MB · 179 MiB | 163 ms / 188 ms (cold 14.0 s)<br>2.6 M rows · 99 MB · 182 MiB  | 445 ms / 508 ms (cold 21.0 s)<br>2.9 M rows · 163 MB · 190 MiB |
| P3-exact | 30d    | 166 ms / 832 ms (cold 13.6 s)<br>2.6 M rows · 94 MB · 167 MiB | 238 ms / 267 ms (cold 13.7 s)<br>2.6 M rows · 99 MB · 170 MiB | 251 ms / 262 ms (cold 15.5 s)<br>2.6 M rows · 99 MB · 184 MiB | 300 ms / 340 ms (cold 15.4 s)<br>2.6 M rows · 116 MB · 186 MiB | 874 ms / 891 ms (cold 25.3 s)<br>3.1 M rows · 238 MB · 306 MiB |

### `queryTraces()` baseline (same selection)

| case              | window | small                                                          | mid                                                            | p90                                                            | p99                                                            | largest                                                                 |
| ----------------- | ------ | -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Q0                | 1d     | 72 ms / 6.93 s (cold 2.28 s)<br>87 k rows · 910 kB · 171 MiB   | 41 ms / 75 ms (cold 1.61 s)<br>91 k rows · 1 MB · 181 MiB      | 67 ms / 672 ms (cold 1.89 s)<br>109 k rows · 1 MB · 180 MiB    | 152 ms / 1.53 s (cold 14.7 s)<br>2.6 M rows · 94 MB · 187 MiB  | 274 ms / 337 ms (cold 15.3 s)<br>2.6 M rows · 98 MB · 186 MiB           |
| Q0                | 7d     | 154 ms / 5.19 s (cold 14.1 s)<br>2.6 M rows · 92 MB · 171 MiB  | 143 ms / 337 ms (cold 13.7 s)<br>2.6 M rows · 92 MB · 182 MiB  | 61 ms / 1.50 s (cold 2.66 s)<br>109 k rows · 2 MB · 183 MiB    | 282 ms / 456 ms (cold 16.3 s)<br>2.6 M rows · 109 MB · 184 MiB | 481 ms / 997 ms (cold 19.6 s)<br>2.8 M rows · 139 MB · 306 MiB ✗timeout |
| Q0                | 30d    | 146 ms / 172 ms (cold 14.6 s)<br>2.6 M rows · 94 MB · 174 MiB  | 152 ms / 257 ms (cold 14.1 s)<br>2.6 M rows · 101 MB · 182 MiB | 244 ms / 449 ms (cold 15.0 s)<br>2.6 M rows · 104 MB · 180 MiB | 289 ms / 546 ms (cold 19.5 s)<br>2.6 M rows · 140 MB · 188 MiB | 1.38 s / 1.64 s (cold 25.2 s)<br>3.0 M rows · 275 MB · 530 MiB ✗timeout |
| Q0 payload        | 1d     | 9 ms / 58 ms (cold 255 ms)<br>8 k rows · 5 MB · 27 MiB         | –                                                              | 16 ms / 110 ms (cold 607 ms)<br>9 k rows · 5 MB · 32 MiB       | 26 ms / 87 ms (cold 235 ms)<br>11 k rows · 5 MB · 70 MiB       | 13 ms / 39 ms (cold 204 ms)<br>8 k rows · 5 MB · 44 MiB                 |
| Q0 payload        | 7d     | 13 ms / 90 ms (cold 280 ms)<br>12 k rows · 4 MB · 98 MiB       | 12 ms / 875 ms (cold 454 ms)<br>25 k rows · 4 MB · 38 MiB      | 15 ms / 15 ms (cold 306 ms)<br>9 k rows · 5 MB · 32 MiB        | 26 ms / 426 ms (cold 209 ms)<br>11 k rows · 5 MB · 79 MiB      | 35 ms / 144 ms (cold 207 ms)<br>8 k rows · 5 MB · 44 MiB                |
| Q0 payload        | 30d    | 13 ms / 142 ms (cold 263 ms)<br>12 k rows · 4 MB · 107 MiB     | 62 ms / 547 ms (cold 350 ms)<br>44 k rows · 34 MB · 122 MiB    | 15 ms / 273 ms (cold 303 ms)<br>25 k rows · 5 MB · 60 MiB      | 27 ms / 29 ms (cold 170 ms)<br>11 k rows · 5 MB · 75 MiB       | 14 ms / 33 ms (cold 256 ms)<br>8 k rows · 5 MB · 44 MiB                 |
| Q0 payload-scoped | 1d     | 9 ms / 11 ms (cold 64 ms)<br>667 rows · 4 MB · 16 MiB          | –                                                              | 11 ms / 15 ms (cold 75 ms)<br>700 rows · 5 MB · 26 MiB         | 25 ms / 30 ms (cold 84 ms)<br>589 rows · 5 MB · 34 MiB         | 12 ms / 51 ms (cold 91 ms)<br>589 rows · 4 MB · 38 MiB                  |
| Q0 payload-scoped | 7d     | 11 ms / 17 ms (cold 81 ms)<br>811 rows · 3 MB · 41 MiB         | 11 ms / 58 ms (cold 340 ms)<br>476 rows · 2 MB · 15 MiB        | 14 ms / 14 ms (cold 78 ms)<br>700 rows · 5 MB · 26 MiB         | 25 ms / 29 ms (cold 96 ms)<br>589 rows · 5 MB · 30 MiB         | 16 ms / 33 ms (cold 116 ms)<br>589 rows · 4 MB · 38 MiB                 |
| Q0 payload-scoped | 30d    | 12 ms / 20 ms (cold 78 ms)<br>811 rows · 3 MB · 76 MiB         | 31 ms / 133 ms (cold 183 ms)<br>1 k rows · 29 MB · 113 MiB     | 12 ms / 75 ms (cold 58 ms)<br>604 rows · 4 MB · 26 MiB         | 24 ms / 208 ms (cold 91 ms)<br>589 rows · 5 MB · 39 MiB        | 21 ms / 32 ms (cold 74 ms)<br>589 rows · 4 MB · 39 MiB                  |
| Q1                | 1d     | 59 ms / 1.47 s (cold 5.77 s)<br>87 k rows · 178 kB · 176 MiB   | 64 ms / 81 ms (cold 2.89 s)<br>103 k rows · 1 MB · 185 MiB     | 226 ms / 256 ms (cold 20.9 s)<br>2.6 M rows · 92 MB · 189 MiB  | 150 ms / 154 ms (cold 14.2 s)<br>2.6 M rows · 92 MB · 189 MiB  | 262 ms / 346 ms (cold 18.2 s)<br>2.6 M rows · 103 MB · 188 MiB          |
| Q1                | 7d     | 148 ms / 156 ms (cold 13.5 s)<br>2.6 M rows · 90 MB · 176 MiB  | 174 ms / 241 ms (cold 15.5 s)<br>2.6 M rows · 92 MB · 184 MiB  | 160 ms / 163 ms (cold 14.9 s)<br>2.6 M rows · 94 MB · 185 MiB  | 252 ms / 413 ms (cold 17.5 s)<br>2.6 M rows · 104 MB · 190 MiB | 899 ms / 911 ms<br>2.9 M rows · 202 MB · 300 MiB ✗timeout               |
| Q1                | 30d    | 141 ms / 144 ms (cold 14.1 s)<br>2.6 M rows · 90 MB · 176 MiB  | 241 ms / 250 ms (cold 19.1 s)<br>2.6 M rows · 98 MB · 181 MiB  | 196 ms / 208 ms (cold 18.6 s)<br>2.6 M rows · 104 MB · 189 MiB | 440 ms / 537 ms (cold 19.3 s)<br>2.6 M rows · 136 MB · 186 MiB | 1.56 s / 3.11 s<br>3.1 M rows · 324 MB · 488 MiB ✗timeout               |
| Q1 payload        | 1d     | –                                                              | –                                                              | 14 ms / 15 ms (cold 264 ms)<br>9 k rows · 5 MB · 32 MiB        | 26 ms / 27 ms (cold 167 ms)<br>11 k rows · 5 MB · 37 MiB       | 185 ms / 300 ms (cold 292 ms)<br>8 k rows · 14 MB · 52 MiB              |
| Q1 payload        | 7d     | 12 ms / 12 ms (cold 124 ms)<br>12 k rows · 3 MB · 34 MiB       | 11 ms / 11 ms (cold 222 ms)<br>25 k rows · 5 MB · 37 MiB       | 14 ms / 16 ms (cold 263 ms)<br>9 k rows · 5 MB · 32 MiB        | 26 ms / 26 ms (cold 281 ms)<br>11 k rows · 5 MB · 42 MiB       | 31 ms / 34 ms (cold 265 ms)<br>8 k rows · 14 MB · 44 MiB                |
| Q1 payload        | 30d    | 12 ms / 13 ms (cold 165 ms)<br>12 k rows · 3 MB · 33 MiB       | 35 ms / 143 ms (cold 400 ms)<br>87 k rows · 37 MB · 100 MiB    | 15 ms / 17 ms (cold 266 ms)<br>9 k rows · 5 MB · 32 MiB        | 26 ms / 27 ms (cold 177 ms)<br>11 k rows · 5 MB · 36 MiB       | 32 ms / 33 ms (cold 229 ms)<br>8 k rows · 14 MB · 44 MiB                |
| Q1 payload-scoped | 1d     | –                                                              | –                                                              | 11 ms / 14 ms (cold 102 ms)<br>700 rows · 5 MB · 26 MiB        | 24 ms / 26 ms (cold 76 ms)<br>700 rows · 5 MB · 26 MiB         | 29 ms / 163 ms (cold 105 ms)<br>794 rows · 14 MB · 38 MiB               |
| Q1 payload-scoped | 7d     | 10 ms / 35 ms (cold 72 ms)<br>662 rows · 2 MB · 13 MiB         | 10 ms / 11 ms (cold 70 ms)<br>476 rows · 3 MB · 14 MiB         | 10 ms / 14 ms (cold 70 ms)<br>700 rows · 5 MB · 26 MiB         | 23 ms / 27 ms (cold 90 ms)<br>700 rows · 5 MB · 26 MiB         | 28 ms / 30 ms (cold 110 ms)<br>794 rows · 14 MB · 38 MiB                |
| Q1 payload-scoped | 30d    | 10 ms / 11 ms (cold 78 ms)<br>662 rows · 2 MB · 13 MiB         | 31 ms / 99 ms (cold 129 ms)<br>9 k rows · 32 MB · 94 MiB       | 14 ms / 19 ms (cold 71 ms)<br>700 rows · 5 MB · 26 MiB         | 24 ms / 25 ms (cold 97 ms)<br>700 rows · 5 MB · 26 MiB         | 22 ms / 31 ms (cold 93 ms)<br>794 rows · 14 MB · 39 MiB                 |
| Q3                | 1d     | 131 ms / 182 ms (cold 3.77 s)<br>175 k rows · 2 MB · 177 MiB   | 157 ms / 4.12 s (cold 4.25 s)<br>206 k rows · 2 MB · 182 MiB   | 569 ms / 685 ms (cold 28.8 s)<br>5.3 M rows · 185 MB · 193 MiB | 611 ms / 935 ms (cold 25.6 s)<br>5.5 M rows · 196 MB · 192 MiB | 753 ms / 983 ms (cold 29.3 s)<br>7.9 M rows · 336 MB · 197 MiB          |
| Q3                | 7d     | 340 ms / 372 ms (cold 28.5 s)<br>5.2 M rows · 184 MB · 179 MiB | 350 ms / 553 ms (cold 27.7 s)<br>5.3 M rows · 185 MB · 186 MiB | 381 ms / 428 ms (cold 29.3 s)<br>5.3 M rows · 189 MB · 193 MiB | 664 ms / 804 ms<br>6.1 M rows · 259 MB · 188 MiB ✗timeout      | 2.13 s / 2.21 s<br>8.5 M rows · 674 MB · 376 MiB ✗timeout               |
| Q3                | 30d    | 355 ms / 362 ms (cold 28.8 s)<br>5.2 M rows · 189 MB · 180 MiB | 577 ms / 1.42 s<br>5.3 M rows · 203 MB · 178 MiB ✗timeout      | 647 ms / 813 ms<br>5.3 M rows · 206 MB · 185 MiB ✗timeout      | 652 ms / 871 ms<br>6.2 M rows · 364 MB · 199 MiB ✗timeout      | 1.90 s / 2.00 s<br>9.0 M rows · 1.1 GB · 592 MiB ✗timeout               |
| Q3 payload        | 1d     | –                                                              | –                                                              | 15 ms / 229 ms (cold 233 ms)<br>9 k rows · 5 MB · 32 MiB       | 18 ms / 227 ms (cold 578 ms)<br>16 k rows · 7 MB · 46 MiB      | 20 ms / 21 ms (cold 298 ms)<br>8 k rows · 8 MB · 31 MiB                 |
| Q3 payload        | 7d     | –                                                              | –                                                              | 15 ms / 24 ms (cold 224 ms)<br>9 k rows · 5 MB · 32 MiB        | 24 ms / 58 ms (cold 196 ms)<br>22 k rows · 14 MB · 85 MiB      | 20 ms / 21 ms (cold 307 ms)<br>8 k rows · 8 MB · 31 MiB                 |
| Q3 payload        | 30d    | –                                                              | –                                                              | 15 ms / 15 ms (cold 286 ms)<br>9 k rows · 5 MB · 32 MiB        | 23 ms / 23 ms (cold 168 ms)<br>22 k rows · 14 MB · 86 MiB      | 19 ms / 19 ms (cold 266 ms)<br>8 k rows · 8 MB · 31 MiB                 |
| Q3 payload-scoped | 1d     | –                                                              | –                                                              | 11 ms / 12 ms (cold 83 ms)<br>700 rows · 5 MB · 26 MiB         | 19 ms / 329 ms (cold 430 ms)<br>1 k rows · 6 MB · 34 MiB       | 17 ms / 18 ms (cold 86 ms)<br>373 rows · 7 MB · 25 MiB                  |
| Q3 payload-scoped | 7d     | –                                                              | –                                                              | 14 ms / 15 ms (cold 80 ms)<br>700 rows · 5 MB · 26 MiB         | 20 ms / 65 ms (cold 76 ms)<br>2 k rows · 12 MB · 56 MiB        | 19 ms / 20 ms (cold 150 ms)<br>373 rows · 7 MB · 25 MiB                 |
| Q3 payload-scoped | 30d    | –                                                              | –                                                              | 11 ms / 14 ms (cold 68 ms)<br>700 rows · 5 MB · 26 MiB         | 20 ms / 21 ms (cold 81 ms)<br>2 k rows · 12 MB · 56 MiB        | 14 ms / 18 ms (cold 103 ms)<br>373 rows · 7 MB · 25 MiB                 |

### Budget flags (15 s timeout, 1 GiB comfortable / 4 GiB hard memory)

- **F3 1d @ small**: failed: timeout
- **C3 7d @ small**: cold 15.8 s > 15 s
- **F4 7d @ small**: failed: timeout
- **F3 7d @ small**: cold 28.0 s > 15 s
- **F5 7d @ small**: cold 29.3 s > 15 s
- **Q3 7d @ small**: cold 28.5 s > 15 s
- **E3 7d @ small**: cold 29.3 s > 15 s
- **E3-doc 7d @ small**: cold 28.0 s > 15 s
- **I4 168x1h @ small**: cold 17.7 s > 15 s
- **F2 30d @ small**: cold 15.1 s > 15 s
- **C1-uniq 30d @ small**: cold 15.6 s > 15 s
- **P2-exact 30d @ small**: cold 15.1 s > 15 s
- **F4 30d @ small**: failed: timeout
- **F3 30d @ small**: failed: timeout; cold 29.1 s > 15 s
- **F5 30d @ small**: cold 29.3 s > 15 s
- **Q3 30d @ small**: cold 28.8 s > 15 s
- **E3 30d @ small**: failed: timeout; cold 29.4 s > 15 s
- **P3 30d @ small**: cold 16.4 s > 15 s
- **H2 30d @ small**: cold 17.6 s > 15 s
- **H3 30d @ small**: cold 17.0 s > 15 s
- **H4 30d @ small**: cold 16.7 s > 15 s
- **F2 7d @ mid**: cold 16.9 s > 15 s
- **Q1 7d @ mid**: cold 15.5 s > 15 s
- **F4 7d @ mid**: failed: timeout
- **F3 7d @ mid**: cold 26.3 s > 15 s
- **F5 7d @ mid**: cold 28.4 s > 15 s
- **Q3 7d @ mid**: cold 27.7 s > 15 s
- **E3 7d @ mid**: cold 25.0 s > 15 s
- **E3-doc 7d @ mid**: cold 28.3 s > 15 s
- **F1 30d @ mid**: cold 15.0 s > 15 s
- **F2 30d @ mid**: cold 16.6 s > 15 s
- **Q1 30d @ mid**: cold 19.1 s > 15 s
- **E1 30d @ mid**: cold 16.4 s > 15 s
- **F4 30d @ mid**: failed: timeout
- **F3 30d @ mid**: cold 29.3 s > 15 s
- **F5 30d @ mid**: cold 28.7 s > 15 s
- **Q3 30d @ mid**: failed: timeout
- **E3 30d @ mid**: failed: timeout; cold 28.7 s > 15 s
- **F2 1d @ p90**: cold 17.4 s > 15 s
- **Q1 1d @ p90**: cold 20.9 s > 15 s
- **F4 1d @ p90**: failed: timeout
- **F5 1d @ p90**: cold 26.8 s > 15 s
- **Q3 1d @ p90**: cold 28.8 s > 15 s
- **E3 1d @ p90**: failed: timeout
- **F2 7d @ p90**: cold 16.5 s > 15 s
- **C3-uniq 7d @ p90**: cold 16.5 s > 15 s
- **F4 7d @ p90**: failed: timeout
- **F5 7d @ p90**: cold 29.2 s > 15 s
- **Q3 7d @ p90**: cold 29.3 s > 15 s
- **E3-doc 7d @ p90**: cold 28.1 s > 15 s
- **F1 30d @ p90**: cold 16.7 s > 15 s
- **F2 30d @ p90**: cold 16.8 s > 15 s
- **Q1 30d @ p90**: cold 18.6 s > 15 s
- **E1 30d @ p90**: cold 15.2 s > 15 s
- **C2 30d @ p90**: cold 15.4 s > 15 s
- **F4 30d @ p90**: failed: timeout
- **F3 30d @ p90**: failed: timeout; cold 27.9 s > 15 s
- **F5 30d @ p90**: failed: timeout
- **Q3 30d @ p90**: failed: timeout
- **E3 30d @ p90**: failed: timeout
- **P3 30d @ p90**: cold 15.2 s > 15 s
- **P3-exact 30d @ p90**: cold 15.5 s > 15 s
- **F2 1d @ p99**: cold 15.8 s > 15 s
- **F4 1d @ p99**: failed: timeout
- **F3 1d @ p99**: cold 27.6 s > 15 s
- **F5 1d @ p99**: cold 29.7 s > 15 s
- **Q3 1d @ p99**: cold 25.6 s > 15 s
- **E3 1d @ p99**: failed: timeout; cold 27.8 s > 15 s
- **F1 7d @ p99**: cold 15.1 s > 15 s
- **F2 7d @ p99**: cold 16.9 s > 15 s
- **Q0 7d @ p99**: cold 16.3 s > 15 s
- **Q1 7d @ p99**: cold 17.5 s > 15 s
- **E1 7d @ p99**: cold 16.0 s > 15 s
- **E1-doc 7d @ p99**: cold 15.0 s > 15 s
- **P1 7d @ p99**: cold 15.1 s > 15 s
- **P2 7d @ p99**: cold 15.3 s > 15 s
- **P2-exact 7d @ p99**: cold 16.3 s > 15 s
- **F4 7d @ p99**: failed: timeout
- **F3 7d @ p99**: failed: timeout; cold 28.1 s > 15 s
- **F5 7d @ p99**: failed: timeout
- **Q3 7d @ p99**: failed: timeout
- **E3 7d @ p99**: failed: timeout
- **E3-doc 7d @ p99**: failed: timeout
- **H5 7d @ p99**: cold 17.1 s > 15 s
- **F1 30d @ p99**: cold 17.7 s > 15 s
- **F2 30d @ p99**: cold 20.5 s > 15 s
- **Q0 30d @ p99**: cold 19.5 s > 15 s
- **Q1 30d @ p99**: cold 19.3 s > 15 s
- **E1 30d @ p99**: cold 17.8 s > 15 s
- **C1 30d @ p99**: cold 15.5 s > 15 s
- **C1-uniq 30d @ p99**: cold 15.4 s > 15 s
- **C2 30d @ p99**: cold 15.3 s > 15 s
- **C2-uniq 30d @ p99**: cold 15.5 s > 15 s
- **C3 30d @ p99**: cold 16.2 s > 15 s
- **C3-uniq 30d @ p99**: cold 16.1 s > 15 s
- **P1 30d @ p99**: cold 16.7 s > 15 s
- **P1-exact 30d @ p99**: cold 18.0 s > 15 s
- **P2 30d @ p99**: cold 16.9 s > 15 s
- **P2-exact 30d @ p99**: cold 17.7 s > 15 s
- **F4 30d @ p99**: failed: timeout
- **F3 30d @ p99**: failed: timeout
- **F5 30d @ p99**: failed: timeout
- **Q3 30d @ p99**: failed: timeout
- **E3 30d @ p99**: failed: timeout
- **P3 30d @ p99**: cold 15.7 s > 15 s
- **P3-exact 30d @ p99**: cold 15.4 s > 15 s
- **H1 30d @ p99**: cold 15.4 s > 15 s
- **H2 30d @ p99**: cold 15.3 s > 15 s
- **H4 30d @ p99**: cold 15.6 s > 15 s
- **H5 30d @ p99**: cold 16.4 s > 15 s
- **H6 30d @ p99**: cold 15.1 s > 15 s
- **H7 30d @ p99**: cold 15.9 s > 15 s
- **I2 720x1h @ p99**: cold 15.2 s > 15 s
- **F2 1d @ largest**: cold 15.9 s > 15 s
- **Q0 1d @ largest**: cold 15.3 s > 15 s
- **Q1 1d @ largest**: cold 18.2 s > 15 s
- **F4 1d @ largest**: failed: timeout
- **F3 1d @ largest**: cold 28.0 s > 15 s
- **F5 1d @ largest**: cold 29.3 s > 15 s
- **Q3 1d @ largest**: cold 29.3 s > 15 s
- **E3 1d @ largest**: failed: timeout; cold 28.9 s > 15 s
- **F0 7d @ largest**: cold 20.8 s > 15 s
- **F1 7d @ largest**: cold 19.9 s > 15 s
- **F2 7d @ largest**: failed: timeout
- **Q0 7d @ largest**: failed: timeout; cold 19.6 s > 15 s
- **Q1 7d @ largest**: failed: timeout
- **E1 7d @ largest**: cold 23.6 s > 15 s
- **E1-doc 7d @ largest**: cold 23.8 s > 15 s
- **E2 7d @ largest**: cold 17.9 s > 15 s
- **C1 7d @ largest**: cold 19.4 s > 15 s
- **C1-uniq 7d @ largest**: cold 19.1 s > 15 s
- **C2 7d @ largest**: cold 20.8 s > 15 s
- **C2-uniq 7d @ largest**: cold 20.6 s > 15 s
- **C3 7d @ largest**: cold 23.8 s > 15 s
- **C3-uniq 7d @ largest**: cold 21.8 s > 15 s
- **P1 7d @ largest**: cold 22.1 s > 15 s
- **P1-exact 7d @ largest**: cold 23.0 s > 15 s
- **P2 7d @ largest**: cold 21.5 s > 15 s
- **P2-exact 7d @ largest**: cold 20.6 s > 15 s
- **F4 7d @ largest**: failed: timeout; warm max 21.9 s > 15 s
- **F3 7d @ largest**: failed: timeout
- **F5 7d @ largest**: failed: timeout
- **Q3 7d @ largest**: failed: timeout
- **E3 7d @ largest**: failed: timeout
- **E3-doc 7d @ largest**: failed: timeout
- **P3 7d @ largest**: cold 21.2 s > 15 s
- **P3-exact 7d @ largest**: cold 21.0 s > 15 s
- **H1 7d @ largest**: cold 20.9 s > 15 s
- **H2 7d @ largest**: cold 20.0 s > 15 s
- **H3 7d @ largest**: cold 19.7 s > 15 s
- **H4 7d @ largest**: cold 23.6 s > 15 s
- **H5 7d @ largest**: cold 20.7 s > 15 s
- **H6 7d @ largest**: cold 20.3 s > 15 s
- **H7 7d @ largest**: cold 19.6 s > 15 s
- **I4 168x1h @ largest**: cold 19.7 s > 15 s
- **F0 30d @ largest**: cold 22.0 s > 15 s
- **F0-w1 30d @ largest**: cold 15.2 s > 15 s
- **F1 30d @ largest**: failed: timeout; cold 22.3 s > 15 s
- **F1-w1 30d @ largest**: cold 18.7 s > 15 s
- **F2 30d @ largest**: failed: timeout
- **Q0 30d @ largest**: failed: timeout; cold 25.2 s > 15 s
- **Q1 30d @ largest**: failed: timeout
- **E1 30d @ largest**: failed: timeout; cold 21.6 s > 15 s
- **E2 30d @ largest**: cold 20.6 s > 15 s
- **C1 30d @ largest**: cold 24.6 s > 15 s
- **C1-uniq 30d @ largest**: cold 22.4 s > 15 s
- **C2 30d @ largest**: cold 26.2 s > 15 s
- **C2-uniq 30d @ largest**: cold 23.1 s > 15 s
- **C3 30d @ largest**: cold 24.1 s > 15 s
- **C3-uniq 30d @ largest**: cold 24.1 s > 15 s
- **P1 30d @ largest**: cold 23.4 s > 15 s
- **P1-exact 30d @ largest**: cold 24.0 s > 15 s
- **P2 30d @ largest**: cold 25.7 s > 15 s
- **P2-exact 30d @ largest**: cold 25.3 s > 15 s
- **F4 30d @ largest**: failed: timeout
- **F3 30d @ largest**: failed: timeout
- **Q3 30d @ largest**: failed: timeout
- **E3 30d @ largest**: failed: timeout
- **P3 30d @ largest**: cold 26.4 s > 15 s
- **P3-exact 30d @ largest**: cold 25.3 s > 15 s
- **H1 30d @ largest**: cold 24.6 s > 15 s
- **H2 30d @ largest**: cold 25.9 s > 15 s
- **H3 30d @ largest**: cold 28.3 s > 15 s
- **H4 30d @ largest**: cold 26.1 s > 15 s
- **H5 30d @ largest**: cold 25.6 s > 15 s
- **H6 30d @ largest**: cold 25.3 s > 15 s
- **H7 30d @ largest**: cold 24.4 s > 15 s
- **I1 1000x15m @ largest**: cold 22.5 s > 15 s
- **I2 720x1h @ largest**: cold 25.9 s > 15 s

### Scaling with project size (log-log slope vs 30-day trace count)

| case              | window   | latency slope | read-bytes slope | projects |
| ----------------- | -------- | ------------- | ---------------- | -------- |
| F0                | 1d       | 0.12          | 0.48             | 15       |
| F0-w1             | 1d       | 0.03          | 0.33             | 15       |
| F1                | 1d       | 0.13          | 0.52             | 15       |
| F1-w1             | 1d       | 0.06          | 0.36             | 15       |
| F2                | 1d       | 0.16          | 0.64             | 5        |
| Q0                | 1d       | 0.17          | 0.48             | 15       |
| Q0 payload        | 1d       | 0.07          | 0.02             | 8        |
| Q0 payload-scoped | 1d       | 0.07          | 0.02             | 8        |
| Q1                | 1d       | 0.15          | 0.65             | 5        |
| E1                | 1d       | 0.20          | 0.52             | 15       |
| E2                | 1d       | 0.14          | 0.48             | 15       |
| F4                | 1d       | 0.19          | 0.69             | 5        |
| F3                | 1d       | 0.17          | 0.52             | 15       |
| F5                | 1d       | 0.17          | 0.58             | 5        |
| Q3                | 1d       | 0.19          | 0.58             | 5        |
| E3                | 1d       | 0.17          | 0.52             | 15       |
| I3                | 1000x1m  | 0.15          | 0.54             | 5        |
| F0                | 7d       | 0.11          | 0.12             | 15       |
| F0-w1             | 7d       | 0.12          | 0.26             | 15       |
| F1                | 7d       | 0.16          | 0.22             | 15       |
| F1-w1             | 7d       | 0.13          | 0.30             | 15       |
| F2                | 7d       | 0.08          | 0.05             | 5        |
| Q0                | 7d       | 0.15          | 0.13             | 15       |
| Q0 payload        | 7d       | 0.01          | 0.02             | 12       |
| Q0 payload-scoped | 7d       | 0.07          | 0.05             | 12       |
| Q1                | 7d       | 0.16          | 0.07             | 5        |
| Q1 payload        | 7d       | 0.11          | 0.13             | 5        |
| Q1 payload-scoped | 7d       | 0.12          | 0.17             | 5        |
| E1                | 7d       | 0.12          | 0.22             | 15       |
| E1-doc            | 7d       | 0.14          | 0.35             | 5        |
| E2                | 7d       | 0.08          | 0.12             | 15       |
| C1                | 7d       | 0.07          | 0.05             | 5        |
| C1-uniq           | 7d       | 0.07          | 0.05             | 5        |
| C2                | 7d       | 0.07          | 0.05             | 5        |
| C2-uniq           | 7d       | 0.07          | 0.05             | 5        |
| C3                | 7d       | 0.10          | 0.05             | 5        |
| C3-uniq           | 7d       | 0.10          | 0.05             | 5        |
| P1                | 7d       | 0.11          | 0.05             | 5        |
| P1-exact          | 7d       | 0.14          | 0.05             | 5        |
| P2                | 7d       | 0.16          | 0.05             | 5        |
| P2-exact          | 7d       | 0.14          | 0.05             | 5        |
| F4                | 7d       | 0.14          | 0.11             | 5        |
| F3                | 7d       | 0.17          | 0.17             | 15       |
| F5                | 7d       | 0.09          | 0.04             | 4        |
| Q3                | 7d       | 0.18          | 0.12             | 5        |
| E3                | 7d       | 0.16          | 0.17             | 15       |
| E3-doc            | 7d       | 0.11          | 0.12             | 5        |
| P3                | 7d       | 0.08          | 0.05             | 5        |
| P3-exact          | 7d       | 0.08          | 0.05             | 5        |
| H1                | 7d       | 0.11          | 0.05             | 5        |
| H2                | 7d       | 0.09          | 0.05             | 5        |
| H3                | 7d       | 0.09          | 0.05             | 5        |
| H4                | 7d       | 0.10          | 0.05             | 5        |
| H5                | 7d       | 0.08          | 0.05             | 5        |
| H6                | 7d       | 0.15          | 0.05             | 5        |
| H7                | 7d       | 0.07          | 0.05             | 5        |
| I4                | 168x1h   | 0.08          | 0.05             | 5        |
| F0                | 30d      | 0.10          | 0.07             | 15       |
| F0-w1             | 30d      | 0.16          | 0.29             | 15       |
| F1                | 30d      | 0.14          | 0.14             | 15       |
| F1-w1             | 30d      | 0.18          | 0.30             | 15       |
| F2                | 30d      | 0.17          | 0.09             | 5        |
| Q0                | 30d      | 0.21          | 0.10             | 15       |
| Q0 payload        | 30d      | -0.01         | -0.05            | 15       |
| Q0 payload-scoped | 30d      | 0.01          | -0.03            | 15       |
| Q1                | 30d      | 0.22          | 0.12             | 5        |
| Q1 payload        | 30d      | 0.07          | 0.04             | 5        |
| Q1 payload-scoped | 30d      | 0.05          | 0.07             | 5        |
| E1                | 30d      | 0.15          | 0.15             | 15       |
| E2                | 30d      | 0.10          | 0.08             | 15       |
| C1                | 30d      | 0.11          | 0.08             | 5        |
| C1-uniq           | 30d      | 0.13          | 0.08             | 5        |
| C2                | 30d      | 0.10          | 0.08             | 5        |
| C2-uniq           | 30d      | 0.10          | 0.08             | 5        |
| C3                | 30d      | 0.10          | 0.09             | 5        |
| C3-uniq           | 30d      | 0.12          | 0.09             | 5        |
| P1                | 30d      | 0.13          | 0.08             | 5        |
| P1-exact          | 30d      | 0.14          | 0.08             | 5        |
| P2                | 30d      | 0.12          | 0.09             | 5        |
| P2-exact          | 30d      | 0.13          | 0.09             | 5        |
| F4                | 30d      | 0.17          | 0.16             | 5        |
| F3                | 30d      | 0.13          | 0.14             | 15       |
| F5                | 30d      | 0.07          | 0.08             | 4        |
| Q3                | 30d      | 0.14          | 0.17             | 5        |
| E3                | 30d      | 0.12          | 0.15             | 15       |
| P3                | 30d      | 0.11          | 0.08             | 5        |
| P3-exact          | 30d      | 0.14          | 0.08             | 5        |
| H1                | 30d      | 0.13          | 0.08             | 5        |
| H2                | 30d      | 0.14          | 0.08             | 5        |
| H3                | 30d      | 0.11          | 0.08             | 5        |
| H4                | 30d      | 0.11          | 0.08             | 5        |
| H5                | 30d      | 0.09          | 0.08             | 5        |
| H6                | 30d      | 0.12          | 0.08             | 5        |
| H7                | 30d      | 0.12          | 0.08             | 5        |
| I1                | 1000x15m | 0.08          | 0.06             | 5        |
| I2                | 720x1h   | 0.11          | 0.09             | 5        |
| Q1 payload        | 1d       | 0.42          | 0.16             | 3        |
| Q1 payload-scoped | 1d       | 0.18          | 0.17             | 3        |
| Q3 payload        | 1d       | 0.05          | 0.07             | 3        |
| Q3 payload-scoped | 1d       | 0.08          | 0.07             | 3        |
| Q3 payload        | 7d       | 0.05          | 0.08             | 3        |
| Q3 payload-scoped | 7d       | 0.06          | 0.09             | 3        |
| Q3 payload        | 30d      | 0.05          | 0.08             | 3        |
| Q3 payload-scoped | 30d      | 0.06          | 0.09             | 3        |

### Variant comparisons (variant ÷ as-compiled, warm medians)

#### `quantileExact` vs `quantileDeterministic`

| case | window | small                    | mid                      | p90                      | p99                      | largest                  |
| ---- | ------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| P1   | 7d     | ×1.00 time · ×1.00 bytes | ×0.97 time · ×1.00 bytes | ×0.69 time · ×1.00 bytes | ×1.77 time · ×1.00 bytes | ×0.95 time · ×1.00 bytes |
| P2   | 7d     | ×1.00 time · ×1.00 bytes | ×1.29 time · ×1.00 bytes | ×1.07 time · ×1.00 bytes | ×1.12 time · ×1.00 bytes | ×0.88 time · ×1.00 bytes |
| P3   | 7d     | ×0.89 time · ×1.00 bytes | ×0.96 time · ×1.00 bytes | ×1.03 time · ×1.00 bytes | ×1.05 time · ×1.00 bytes | ×0.85 time · ×1.00 bytes |
| P1   | 30d    | ×0.99 time · ×1.00 bytes | ×0.72 time · ×1.00 bytes | ×1.52 time · ×1.00 bytes | ×1.03 time · ×1.00 bytes | ×0.98 time · ×1.00 bytes |
| P2   | 30d    | ×0.70 time · ×1.00 bytes | ×1.00 time · ×1.00 bytes | ×1.11 time · ×1.00 bytes | ×0.65 time · ×1.00 bytes | ×1.05 time · ×1.00 bytes |
| P3   | 30d    | ×1.04 time · ×1.00 bytes | ×1.12 time · ×1.00 bytes | ×1.12 time · ×1.00 bytes | ×1.37 time · ×1.00 bytes | ×1.48 time · ×1.00 bytes |

#### `uniq` vs `uniqExact`

| case | window | small                    | mid                      | p90                      | p99                      | largest                  |
| ---- | ------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| C1   | 7d     | ×1.00 time · ×1.00 bytes | ×0.95 time · ×1.00 bytes | ×0.97 time · ×1.00 bytes | ×0.97 time · ×1.00 bytes | ×0.94 time · ×1.00 bytes |
| C2   | 7d     | ×0.94 time · ×1.00 bytes | ×1.16 time · ×1.00 bytes | ×0.86 time · ×1.00 bytes | ×0.91 time · ×1.00 bytes | ×1.02 time · ×1.00 bytes |
| C3   | 7d     | ×0.93 time · ×1.00 bytes | ×0.85 time · ×1.00 bytes | ×1.05 time · ×1.00 bytes | ×1.09 time · ×1.00 bytes | ×0.84 time · ×1.00 bytes |
| C1   | 30d    | ×0.74 time · ×1.00 bytes | ×0.76 time · ×1.00 bytes | ×0.98 time · ×1.00 bytes | ×0.88 time · ×1.00 bytes | ×0.88 time · ×1.00 bytes |
| C2   | 30d    | ×0.70 time · ×1.00 bytes | ×1.45 time · ×1.00 bytes | ×1.01 time · ×1.00 bytes | ×1.01 time · ×1.00 bytes | ×0.94 time · ×1.00 bytes |
| C3   | 30d    | ×0.73 time · ×1.00 bytes | ×1.18 time · ×1.00 bytes | ×1.03 time · ×1.00 bytes | ×1.09 time · ×1.00 bytes | ×0.96 time · ×1.00 bytes |

#### W1: tenant-scoped `current_roots` re-read vs as compiled

| case | window | small                    | mid                      | p90                      | p99                      | largest                  |
| ---- | ------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| F0   | 1d     | ×1.58 time · ×1.00 bytes | ×1.05 time · ×1.00 bytes | ×1.16 time · ×1.00 bytes | ×0.47 time · ×0.08 bytes | ×0.54 time · ×0.24 bytes |
| F1   | 1d     | ×0.88 time · ×1.00 bytes | ×1.12 time · ×1.00 bytes | ×0.70 time · ×1.00 bytes | ×0.49 time · ×0.08 bytes | ×0.59 time · ×0.24 bytes |
| F0   | 7d     | ×0.59 time · ×0.05 bytes | ×0.44 time · ×0.04 bytes | ×1.05 time · ×1.00 bytes | ×0.50 time · ×0.16 bytes | ×0.55 time · ×0.38 bytes |
| F1   | 7d     | ×0.72 time · ×0.04 bytes | ×0.49 time · ×0.04 bytes | ×0.67 time · ×1.00 bytes | ×0.55 time · ×0.15 bytes | ×0.69 time · ×0.37 bytes |
| F0   | 30d    | ×0.41 time · ×0.07 bytes | ×0.46 time · ×0.08 bytes | ×0.40 time · ×0.12 bytes | ×0.52 time · ×0.27 bytes | ×0.67 time · ×0.58 bytes |
| F1   | 30d    | ×0.42 time · ×0.04 bytes | ×0.49 time · ×0.08 bytes | ×0.50 time · ×0.13 bytes | ×0.67 time · ×0.24 bytes | ×0.72 time · ×0.43 bytes |

#### Payload stage: org/project-scoped vs as compiled

| case | window | small                    | mid                      | p90                      | p99                      | largest                  |
| ---- | ------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ | ------------------------ |
| Q0   | 1d     | ×1.03 time · ×0.91 bytes | –                        | ×0.69 time · ×0.90 bytes | ×0.96 time · ×0.88 bytes | ×0.94 time · ×0.89 bytes |
| Q0   | 7d     | ×0.82 time · ×0.82 bytes | ×0.88 time · ×0.52 bytes | ×0.91 time · ×0.90 bytes | ×0.97 time · ×0.88 bytes | ×0.47 time · ×0.89 bytes |
| Q1   | 7d     | ×0.81 time · ×0.73 bytes | ×0.89 time · ×0.64 bytes | ×0.73 time · ×0.90 bytes | ×0.87 time · ×0.88 bytes | ×0.91 time · ×0.97 bytes |
| Q0   | 30d    | ×0.89 time · ×0.82 bytes | ×0.50 time · ×0.85 bytes | ×0.78 time · ×0.78 bytes | ×0.89 time · ×0.88 bytes | ×1.46 time · ×0.89 bytes |
| Q1   | 30d    | ×0.83 time · ×0.73 bytes | ×0.87 time · ×0.87 bytes | ×0.94 time · ×0.90 bytes | ×0.93 time · ×0.88 bytes | ×0.68 time · ×0.97 bytes |
| Q1   | 1d     | –                        | –                        | ×0.73 time · ×0.90 bytes | ×0.91 time · ×0.88 bytes | ×0.16 time · ×0.97 bytes |
| Q3   | 1d     | –                        | –                        | ×0.72 time · ×0.90 bytes | ×1.05 time · ×0.87 bytes | ×0.85 time · ×0.93 bytes |
| Q3   | 7d     | –                        | –                        | ×0.89 time · ×0.90 bytes | ×0.83 time · ×0.91 bytes | ×0.95 time · ×0.93 bytes |
| Q3   | 30d    | –                        | –                        | ×0.73 time · ×0.90 bytes | ×0.88 time · ×0.91 bytes | ×0.78 time · ×0.93 bytes |

<!-- report:end -->
