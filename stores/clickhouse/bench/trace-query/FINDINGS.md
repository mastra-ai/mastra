# Trace-query benchmark findings: ClickHouse `queryTraces()` family on production-scale data

Benchmark of the ClickHouse trace-query family (`queryTraces()`, `queryThreads()`, `querySpans()`, `getTraceQueryValues()`, `getTraceQueryObservedFields()`) against Platform's production observability data, for whoever moves these APIs to Platform (mobs-query). It uses the same replica, project buckets, windows, repetitions and Tier 1 limits as the [`aggregateTraces()` benchmark](../aggregate-traces/FINDINGS.md) (OBS-539), so cells line up. The harness and safety model are in [README.md](./README.md). The tables below the marker are generated from the raw results.

## Summary

- **Memory is a real concern for these APIs, unlike `aggregateTraces()`.** Up to p90 (~1.3 k traces in 30 days), every API stays under 700 MiB. At p99 (~40 k traces) and the largest projects (140–430 k), four shapes reach **2–4 GiB** and some fail at the 4 GiB Tier 1 limit **on warm runs**:
  - **Keyset `queryTraces()`** (no filter, root filters, other sort orders, `limit` 1000, deep cursors, delta mode): 2.8–3.5 GiB at p99 30d. It fails at 4 GiB on one p99 project at 30d and on the largest representative at 7d.
  - **`querySpans()` with no filter, over 30 days on the largest project:** 1.1 GiB in its select stage. Filtering on `model` reaches 1.9 GiB at p99 and 2.5 GiB at largest 7d, then fails at 4 GiB at 30d. The store caps each `querySpans()` stage at **512 MiB**, so these requests would fail in the store as shipped.
  - **`getTraceQueryValues()` on span `model`** (V7): 3.3–3.6 GiB at p99/largest, about 13× the store's 256 MiB discovery cap.
  - **Relation filters** (`spans.some` / `spans.none`) on `queryTraces()`: 1.4–2.1 GiB at largest 1d, 3.0–4.1 GiB at p99 30d.
- **Page mode, `queryThreads()` and trace-scope discovery stay small at every size.**
  - Page mode is 174 MiB at p99 30d (vs 2.8 GiB for keyset on the same project) and 482 MiB at largest 30d.
  - `queryThreads()` peaks at 550 MiB.
  - Trace-scope discovery (environment, entityName, status, tags, metadata, observed fields) peaks at 420 MiB.
- **Two compiled-SQL patterns cause the high memory:**
  1. Keyset mode sorts `SELECT * FROM candidates`, which includes `input` and `metadataRaw`. ClickHouse materializes those blobs for every candidate before the top-N. Page mode sorts narrow columns and fetches payloads for 25 rows afterwards; it does the same work in 1/16 of the memory.
  2. `JSONExtractString(attributes, 'model')` parses each span's `attributes` JSON. Filtering or discovering on `model` reads ~6 M span rows on the largest project and holds their attributes.
- **H1 confirmed: the unscoped `current_roots` re-read is a fixed floor on every trace-family API.**
  - Every call except `querySpans()` reads ~2.7 M root rows (the whole table, all tenants) even for a 25-trace project.
  - The W1 what-if (adding `organizationId`/`projectId`) cuts rows read 14× for small–p99 projects. It cuts cold latency from 13–17 s to 4–8 s for `queryTraces()`, `queryThreads()` and observed fields, matching OBS-539.
  - W1 does **not** fix the keyset memory problem (2.9 GiB → 2.9 GiB at p99 30d), because that memory is the project's own blobs.
- **Cold latency exceeds the store's timeouts at every size.**
  - With the filesystem cache off, the trace-family floor alone takes 12–17 s (15 s store default).
  - Every discovery call takes 13–25 s cold against its 5 s default, even on a 25-trace project. Warm, they take 0.1–1.1 s.
  - Cold `spans.some` / `spans.none` (T7–T10, T12) and thread predicates that reach spans (TH2–TH4) hit the 30 s harness timeout from 1d up at p99/largest, and from 7d at small.
- **Warm latency is fine wherever memory is.** The slowest successful warm median is 5.0 s (T12 at p99 30d). Every other shape is under 4.6 s warm, and most are under 1.2 s.
- **H2 confirmed: `queryThreads()` reads roots twice when it has trace predicates.**
  - TH2–TH4 read 5.5–9.6 M rows (two passes of the inlined `current_roots`, plus spans for TH3).
  - TH1 (`traces.where: environment eq`) isn't seeded, so it reads the same 2.7–3.2 M rows as TH0.
  - Memory stays under 550 MiB because thread queries only project ids.
- **H4 split:**
  - The `querySpans()` payload stage is well pruned: ≤ 250 MiB / ≤ 178 MB at any size, and org/project scoping changes nothing.
  - The cost-metrics stage reads ~2.2 M rows at p99 and **7.3 M rows (~926 MB)** at largest, regardless of window, because its lookup has no time bound. Scoping it to org/project cuts rows 33% (7.3 → 4.9 M) and cold latency ~2× (8.0 → 4.1 s at largest 1d). Memory stays ~230–270 MiB.
- **H6:** the delta-head statement reads the whole delta table (~240 k rows, 11 MB) but takes ~60 ms warm / ≤ 0.6 s cold. Its cost doesn't matter. Delta reads (D1/D2) behave like keyset mode: 3.1–3.2 GiB at p99 30d and a 4 GiB failure at largest 7d.
- **Deep pagination costs nothing extra.**
  - K2/K3 (cursor at row 1 000 / 10 000) cost the same as K1/T0, and P1/P2 cost the same as P0, because the fixed floor and candidate materialization dominate.
  - The same holds for `querySpans()` deep cursors (S8/S9 ≈ S7).
  - `querySpans()` at `limit` 1000 hydrated fine on the replica. Against a server with default `http_max_field_value_size`, its tuple-array parameter fails before execution (seen in the local smoke test).

## Method

- **Replica, scoping, buckets, windows, repetitions, limits:** identical to [OBS-539](../aggregate-traces/FINDINGS.md#method): Platform's read-only ClickHouse Cloud replica (26.4), `X-ClickHouse-Summary` metrics, `AND projectId = ?` next to every compiled `organizationId = ?`, 3 projects per bucket (core cases on all 3, the rest on the representative), windows ending at `2026-10-05T17:00Z`, 1 cold + 5 warm reps (3 warm for p99/largest), Tier 1 (30 s, 4 GiB, 4 threads). The p99/largest runs executed about 2 days after the anchor, so the oldest 1–2 days of their 30d windows had aged out under the 30-day TTL.
- **Real code paths:** every request goes through the public parser, planner and compiler. Deep cursors come from the real encoders. `querySpans()` hydration and the delta-head SQL are captured by running the store's own functions against a capture client, so the measured SQL is exactly what the store sends.
- **Escalation:** a warm limit hit skips that case's larger windows in the bucket, and only its 1d window runs in larger buckets. That's why the keyset cases have no largest 7d/30d cells, and why the largest column of the peak-memory table understates them. Their p99 30d and largest 1d cells are the evidence.
- **Not measured:**
  - The replica's `mastra_feedback_events` lacks `writeVersion`, which the store's feedback SQL needs, so the feedback-relation cases (T11, V9) were excluded.
  - `mastra_score_events_current` is absent, so there are no scores cases.
  - T5 (tag filter) was skipped wherever the project had no tags (every representative).
- **Concurrency:**
  - The A/B proof rejected concurrency 4: cold latency ×1.23, warm p90 ×1.22, and 5 cold reads that timed out only under concurrency.
  - It accepted concurrency 2 for small/mid/p90: memory ×1.000, warm ×1.02, cold ×0.96. Only 27% of concurrent queries actually overlapped a neighbour, because of the 2 s pacing.
  - Sentinels re-ran T0/T7/S0 sequentially after every phase. Two phases were re-run sequentially and superseded (p90 30d once on a ±20% T0 memory swing that also occurs sequentially). The latency vs in-flight rank correlation over all warm runs is ρ = 0.08.
  - The re-probe on p99 failed one memory cell (S0 scoped metrics, ×0.88) with everything else passing, so **p99 and largest ran sequentially**. Their numbers carry no concurrency caveat.
  - Two probe criteria were corrected from the plan, both stricter or evidence-based. The `querySpans()` select stage is excluded from exact rows/memory comparisons, because its `endedAt` lower bound has no upper bound, so it also reads spans ingested between reps (its rows track wall-clock time even with no neighbour). Cold reads that time out only under concurrency now fail the cold check.

## Recommendations for mobs-query

1. **Make keyset `queryTraces()` sort narrow columns, then fetch payloads, as page mode does.** This is the main fix. Keyset/delta modes use 2.8–4 GiB at p99/largest and fail at 4 GiB, while page mode on the same data uses 174–482 MiB. Select only sort keys and ids in `candidates`/the final ORDER BY, then look up `input`/`metadataRaw` for the `limit + 1` page by sort-key prefix, the way `compileClickHouseTraceRootPayloads` already does. Apply the same to delta mode and `group` mode.
2. **Tenant-scope the `current_roots` re-read (OBS-539's recommendation, now shown for every API).** It's the 13–17 s cold floor for `queryTraces()`, `queryThreads()` and both discovery calls on most projects, and W1 removes 14× of the rows. It's a compiler change that needs its own ticket. A `traceId` bloom-filter skip index is the alternative.
3. **Don't parse span `attributes` JSON at query time.** `model` filters on `querySpans()` and `model` values discovery read and hold millions of span attributes (1.9–3.6 GiB). Materialize `model`/`provider` as columns (or a `LowCardinality` map) on `mastra_span_events`. Until then, disable or tightly cap `model` discovery on large projects.
4. **Bound the `querySpans()` select and cost-metrics stages in time.**
   - The select stage's `endedAt >= from` needs an upper bound (`endedAt < to + max span duration`), so it stops reading live ingest.
   - The cost-metrics lookup needs org/project scope and a timestamp bound derived from the page. Today it reads 7.3 M metric rows (926 MB) per call on the largest project, whatever the page.
   - The select stage at 30d on the largest project uses 1.1 GiB, so the store's 512 MiB cap would reject an unfiltered 30-day span list there. Either default `querySpans()` to a shorter window or raise its cap to 2 GiB.
5. **Seed `queryThreads()`.** Pass `traces.where` root-only conjuncts as `seedConjuncts` like `queryTraces()` does, and stop referencing `eligible_roots` twice (or materialize it). TH2–TH4 read 2–3.5× the rows of TH0 and time out cold.
6. **Timeouts and memory limits per API**, from the warm medians and peaks here (with fixes 1–3 these drop):

   | API                                         | warm p99/largest | cold    | memory limit                              |
   | ------------------------------------------- | ---------------- | ------- | ----------------------------------------- |
   | `queryTraces()` page mode, `queryThreads()` | ≤ 2.4 s          | 15–30 s | 1 GiB                                     |
   | `queryTraces()` keyset / delta              | ≤ 5 s            | 16–30 s | 4 GiB until fix 1, then 1 GiB             |
   | `querySpans()`                              | ≤ 4.6 s          | 15–18 s | 2 GiB per stage until fix 4               |
   | discovery, trace scope                      | ≤ 1.1 s          | 13–26 s | 512 MiB                                   |
   | discovery, span scope                       | ≤ 4.1 s          | 19–30 s | 512 MiB with `model` disabled, else 4 GiB |

   The store's 5 s discovery timeout only holds warm. Every cold discovery call exceeds it at every project size until fix 2 lands. Prefer 15 s or a warm-cache strategy.

7. **Prefer page mode and root filters in product surfaces.** Relation filters (`spans.some` / `spans.none`) cost 1.4–4 GiB and 30 s cold on large projects whatever the window. Deep pages are as cheap as first pages, so there's no need to cap depth.
8. **Leave the delta head alone.** Its whole-table read is ~60 ms. Delta reads inherit fix 1.
9. **Raise `http_max_field_value_size` or send hydration keys in the body.** The `querySpans()` hydration stages send up to 1 000 identity tuples as one URL parameter, which fails before execution on servers with default limits.

<!-- report:start -->

## Results (generated)

8036 counted query executions (112 failed), 1952 probe and 348 sentinel executions; 1254 superseded executions excluded.

Cells: **peak memory** · warm median / warm max (cold) · median rows and bytes read; ✗ marks failures by category.

### Peak memory per API

| API                                                              | store limit      | small                        | mid                           | p90                           | p99                | largest           |
| ---------------------------------------------------------------- | ---------------- | ---------------------------- | ----------------------------- | ----------------------------- | ------------------ | ----------------- |
| queryTraces(), keyset mode                                       | 15.0 s           | 187 MiB (T2 1d)              | 466 MiB (T7 30d)              | 687 MiB (T1 30d)              | 3.97 GiB (T12 30d) | 2.03 GiB (T9 1d)  |
| queryTraces(), page mode, groups and delta                       | 15.0 s           | 180 MiB (P3 30d)             | 348 MiB (D1 30d)              | 284 MiB (D1 30d)              | 3.14 GiB (D1 30d)  | 1.44 GiB (D1 1d)  |
| queryThreads()                                                   | 15.0 s           | 176 MiB (TH2 1d)             | 183 MiB (TH3 7d)              | 186 MiB (TH2 7d)              | 202 MiB (TH4 30d)  | 550 MiB (TH3 30d) |
| querySpans()                                                     | 15.0 s / 512 MiB | 236 MiB (S0 span-metrics 7d) | 255 MiB (S7 span-metrics 30d) | 320 MiB (S7 span-payload 30d) | 1.86 GiB (S4 30d)  | 2.51 GiB (S4 7d)  |
| Discovery: getTraceQueryObservedFields() / getTraceQueryValues() | 5.00 s / 256 MiB | 171 MiB (V6 7d)              | 189 MiB (V6 1d)               | 183 MiB (V6 7d)               | 3.27 GiB (V7 30d)  | 3.54 GiB (V7 7d)  |

### Over budget or store limit

- **T7 1d @ small**: failed: timeout
- **V1 7d @ small**: cold 15.1 s > store timeout 5.00 s
- **V2 7d @ small**: cold 14.0 s > store timeout 5.00 s
- **V3 7d @ small**: cold 14.1 s > store timeout 5.00 s
- **V4 7d @ small**: cold 14.3 s > store timeout 5.00 s
- **V5 7d @ small**: cold 13.9 s > store timeout 5.00 s
- **T2 7d @ small**: cold 15.4 s > store timeout 15.0 s
- **T4 7d @ small**: cold 16.3 s > store timeout 15.0 s
- **TH2 7d @ small**: cold 26.2 s > store timeout 15.0 s
- **TH4 7d @ small**: cold 27.7 s > store timeout 15.0 s
- **OF0 7d @ small**: cold 14.0 s > store timeout 5.00 s
- **OF1 7d @ small**: cold 14.3 s > store timeout 5.00 s
- **P1 7d @ small**: cold 15.3 s > store timeout 15.0 s
- **D1 7d @ small**: cold 16.1 s > store timeout 15.0 s
- **D2 7d @ small**: cold 15.6 s > store timeout 15.0 s
- **T7 7d @ small**: failed: timeout; cold 29.2 s > store timeout 15.0 s
- **T8 7d @ small**: cold 29.6 s > store timeout 15.0 s
- **T9 7d @ small**: cold 28.8 s > store timeout 15.0 s
- **T10 7d @ small**: cold 29.9 s > store timeout 15.0 s
- **T12 7d @ small**: failed: timeout
- **TH3 7d @ small**: cold 17.9 s > store timeout 15.0 s
- **V6 7d @ small**: cold 16.2 s > store timeout 5.00 s
- **V7 7d @ small**: cold 16.5 s > store timeout 5.00 s
- **V8 7d @ small**: cold 16.3 s > store timeout 5.00 s
- **V1 30d @ small**: cold 14.6 s > store timeout 5.00 s
- **V2 30d @ small**: cold 14.6 s > store timeout 5.00 s
- **V3 30d @ small**: cold 15.0 s > store timeout 5.00 s
- **V4 30d @ small**: cold 15.6 s > store timeout 5.00 s
- **V5 30d @ small**: cold 14.0 s > store timeout 5.00 s
- **T1 30d @ small**: cold 15.2 s > store timeout 15.0 s
- **T2 30d @ small**: cold 15.2 s > store timeout 15.0 s
- **T4 30d @ small**: cold 15.0 s > store timeout 15.0 s
- **TH2 30d @ small**: cold 25.9 s > store timeout 15.0 s
- **TH4 30d @ small**: cold 27.2 s > store timeout 15.0 s
- **OF0 30d @ small**: cold 13.7 s > store timeout 5.00 s
- **OF1 30d @ small**: cold 13.6 s > store timeout 5.00 s
- **T7 30d @ small**: failed: timeout; cold 29.1 s > store timeout 15.0 s
- **T8 30d @ small**: failed: timeout
- **T9 30d @ small**: failed: timeout
- **T10 30d @ small**: failed: timeout
- **T12 30d @ small**: failed: timeout
- **TH3 30d @ small**: cold 23.1 s > store timeout 15.0 s
- **S7 30d @ small**: cold 18.5 s > store timeout 15.0 s
- **V6 30d @ small**: cold 21.1 s > store timeout 5.00 s
- **V7 30d @ small**: cold 21.1 s > store timeout 5.00 s
- **V8 30d @ small**: failed: timeout
- **V1 7d @ mid**: cold 12.6 s > store timeout 5.00 s
- **V2 7d @ mid**: cold 13.1 s > store timeout 5.00 s
- **V3 7d @ mid**: cold 12.6 s > store timeout 5.00 s
- **V4 7d @ mid**: cold 12.7 s > store timeout 5.00 s
- **V5 7d @ mid**: cold 12.4 s > store timeout 5.00 s
- **T2 7d @ mid**: cold 15.6 s > store timeout 15.0 s
- **TH2 7d @ mid**: cold 24.9 s > store timeout 15.0 s
- **TH4 7d @ mid**: failed: timeout
- **T6 7d @ mid**: cold 18.1 s > store timeout 15.0 s
- **O3 7d @ mid**: cold 16.7 s > store timeout 15.0 s
- **OF0 7d @ mid**: cold 12.0 s > store timeout 5.00 s
- **P0 7d @ mid**: cold 18.6 s > store timeout 15.0 s
- **OF1 7d @ mid**: cold 11.9 s > store timeout 5.00 s
- **P1 7d @ mid**: cold 20.9 s > store timeout 15.0 s
- **P2 7d @ mid**: failed: timeout
- **P3 7d @ mid**: cold 19.1 s > store timeout 15.0 s
- **G0 7d @ mid**: cold 22.0 s > store timeout 15.0 s
- **T7 7d @ mid**: cold 28.7 s > store timeout 15.0 s
- **T8 7d @ mid**: cold 26.9 s > store timeout 15.0 s
- **T9 7d @ mid**: cold 26.1 s > store timeout 15.0 s
- **T10 7d @ mid**: cold 27.3 s > store timeout 15.0 s
- **T12 7d @ mid**: cold 29.6 s > store timeout 15.0 s
- **TH3 7d @ mid**: cold 16.8 s > store timeout 15.0 s
- **V6 7d @ mid**: cold 14.9 s > store timeout 5.00 s
- **V7 7d @ mid**: cold 15.3 s > store timeout 5.00 s
- **V8 7d @ mid**: cold 14.4 s > store timeout 5.00 s
- **V1 30d @ mid**: cold 14.2 s > store timeout 5.00 s
- **V2 30d @ mid**: cold 14.2 s > store timeout 5.00 s
- **V3 30d @ mid**: cold 13.2 s > store timeout 5.00 s
- **V4 30d @ mid**: cold 13.6 s > store timeout 5.00 s
- **V5 30d @ mid**: cold 12.9 s > store timeout 5.00 s
- **T1 30d @ mid**: cold 16.3 s > store timeout 15.0 s
- **T2 30d @ mid**: cold 15.4 s > store timeout 15.0 s
- **TH2 30d @ mid**: cold 25.0 s > store timeout 15.0 s
- **TH4 30d @ mid**: cold 26.7 s > store timeout 15.0 s
- **T6 30d @ mid**: cold 15.4 s > store timeout 15.0 s
- **TH5 30d @ mid**: cold 19.6 s > store timeout 15.0 s
- **K1 30d @ mid**: cold 15.2 s > store timeout 15.0 s
- **OF0 30d @ mid**: cold 13.4 s > store timeout 5.00 s
- **OF1 30d @ mid**: cold 19.8 s > store timeout 5.00 s
- **D2 30d @ mid**: cold 16.4 s > store timeout 15.0 s
- **T7 30d @ mid**: cold 27.7 s > store timeout 15.0 s
- **T8 30d @ mid**: cold 28.5 s > store timeout 15.0 s
- **T9 30d @ mid**: cold 28.8 s > store timeout 15.0 s
- **T10 30d @ mid**: cold 28.2 s > store timeout 15.0 s
- **T12 30d @ mid**: cold 29.3 s > store timeout 15.0 s
- **TH3 30d @ mid**: cold 16.4 s > store timeout 15.0 s
- **V6 30d @ mid**: cold 14.5 s > store timeout 5.00 s
- **V7 30d @ mid**: cold 14.7 s > store timeout 5.00 s
- **V8 30d @ mid**: cold 14.5 s > store timeout 5.00 s
- **V2 1d @ p90**: cold 12.8 s > store timeout 5.00 s
- **V3 1d @ p90**: cold 13.1 s > store timeout 5.00 s
- **V4 1d @ p90**: cold 13.3 s > store timeout 5.00 s
- **V5 1d @ p90**: cold 12.3 s > store timeout 5.00 s
- **TH2 1d @ p90**: cold 26.2 s > store timeout 15.0 s
- **TH4 1d @ p90**: cold 26.6 s > store timeout 15.0 s
- **OF1 1d @ p90**: cold 12.5 s > store timeout 5.00 s
- **T8 1d @ p90**: cold 27.8 s > store timeout 15.0 s
- **T9 1d @ p90**: cold 28.5 s > store timeout 15.0 s
- **T10 1d @ p90**: cold 28.2 s > store timeout 15.0 s
- **TH3 1d @ p90**: cold 28.5 s > store timeout 15.0 s
- **V7 1d @ p90**: cold 15.3 s > store timeout 5.00 s
- **V8 1d @ p90**: cold 16.4 s > store timeout 5.00 s
- **V2 7d @ p90**: cold 13.5 s > store timeout 5.00 s
- **V3 7d @ p90**: cold 13.9 s > store timeout 5.00 s
- **V4 7d @ p90**: cold 14.0 s > store timeout 5.00 s
- **V5 7d @ p90**: cold 14.0 s > store timeout 5.00 s
- **T3 7d @ p90**: cold 16.9 s > store timeout 15.0 s
- **TH1 7d @ p90**: cold 17.1 s > store timeout 15.0 s
- **TH2 7d @ p90**: cold 25.1 s > store timeout 15.0 s
- **TH4 7d @ p90**: cold 26.2 s > store timeout 15.0 s
- **OF1 7d @ p90**: cold 12.9 s > store timeout 5.00 s
- **P3 7d @ p90**: cold 15.1 s > store timeout 15.0 s
- **D2 7d @ p90**: cold 15.1 s > store timeout 15.0 s
- **T8 7d @ p90**: cold 28.4 s > store timeout 15.0 s
- **T9 7d @ p90**: failed: timeout
- **T10 7d @ p90**: cold 28.7 s > store timeout 15.0 s
- **TH3 7d @ p90**: cold 28.4 s > store timeout 15.0 s
- **V7 7d @ p90**: cold 15.4 s > store timeout 5.00 s
- **V8 7d @ p90**: cold 16.4 s > store timeout 5.00 s
- **V1 30d @ p90**: cold 15.8 s > store timeout 5.00 s
- **V2 30d @ p90**: cold 15.0 s > store timeout 5.00 s
- **V3 30d @ p90**: cold 15.2 s > store timeout 5.00 s
- **V4 30d @ p90**: cold 15.9 s > store timeout 5.00 s
- **V5 30d @ p90**: cold 15.2 s > store timeout 5.00 s
- **T0 30d @ p90**: cold 16.0 s > store timeout 15.0 s
- **T1 30d @ p90**: cold 18.5 s > store timeout 15.0 s
- **T2 30d @ p90**: cold 16.1 s > store timeout 15.0 s
- **T3 30d @ p90**: cold 15.8 s > store timeout 15.0 s
- **TH2 30d @ p90**: cold 27.9 s > store timeout 15.0 s
- **TH4 30d @ p90**: failed: timeout
- **O1 30d @ p90**: cold 15.5 s > store timeout 15.0 s
- **O2 30d @ p90**: cold 15.9 s > store timeout 15.0 s
- **O3 30d @ p90**: cold 17.0 s > store timeout 15.0 s
- **K1 30d @ p90**: cold 15.2 s > store timeout 15.0 s
- **K2 30d @ p90**: cold 15.9 s > store timeout 15.0 s
- **OF0 30d @ p90**: cold 14.1 s > store timeout 5.00 s
- **OF1 30d @ p90**: cold 14.7 s > store timeout 5.00 s
- **P0 30d @ p90**: cold 15.7 s > store timeout 15.0 s
- **P1 30d @ p90**: cold 16.6 s > store timeout 15.0 s
- **P3 30d @ p90**: cold 22.0 s > store timeout 15.0 s
- **G0 30d @ p90**: cold 19.7 s > store timeout 15.0 s
- **D1 30d @ p90**: cold 16.9 s > store timeout 15.0 s
- **D2 30d @ p90**: cold 17.5 s > store timeout 15.0 s
- **S2 30d @ p90**: cold 15.5 s > store timeout 15.0 s
- **S3 30d @ p90**: cold 15.2 s > store timeout 15.0 s
- **T7 30d @ p90**: failed: timeout
- **T8 30d @ p90**: failed: timeout
- **T9 30d @ p90**: failed: timeout
- **T10 30d @ p90**: failed: timeout
- **TH3 30d @ p90**: failed: timeout
- **V6 30d @ p90**: cold 18.0 s > store timeout 5.00 s
- **V7 30d @ p90**: cold 17.5 s > store timeout 5.00 s
- **V8 30d @ p90**: cold 17.5 s > store timeout 5.00 s
- **V1 1d @ p99**: cold 12.2 s > store timeout 5.00 s
- **V2 1d @ p99**: cold 12.7 s > store timeout 5.00 s
- **V3 1d @ p99**: cold 12.6 s > store timeout 5.00 s
- **V4 1d @ p99**: cold 14.0 s > store timeout 5.00 s
- **V5 1d @ p99**: cold 12.7 s > store timeout 5.00 s
- **TH2 1d @ p99**: cold 25.9 s > store timeout 15.0 s
- **TH4 1d @ p99**: failed: timeout
- **TH5 1d @ p99**: cold 15.6 s > store timeout 15.0 s
- **O1 1d @ p99**: cold 15.1 s > store timeout 15.0 s
- **OF0 1d @ p99**: cold 13.8 s > store timeout 5.00 s
- **OF1 1d @ p99**: cold 14.6 s > store timeout 5.00 s
- **P3 1d @ p99**: cold 15.1 s > store timeout 15.0 s
- **D1 1d @ p99**: cold 15.2 s > store timeout 15.0 s
- **T7 1d @ p99**: failed: timeout; cold 29.4 s > store timeout 15.0 s
- **T8 1d @ p99**: failed: timeout
- **T9 1d @ p99**: failed: timeout
- **T10 1d @ p99**: failed: timeout
- **T12 1d @ p99**: failed: timeout
- **TH3 1d @ p99**: cold 29.6 s > store timeout 15.0 s
- **V6 1d @ p99**: cold 17.4 s > store timeout 5.00 s
- **V7 1d @ p99**: cold 17.5 s > store timeout 5.00 s
- **V8 1d @ p99**: cold 16.8 s > store timeout 5.00 s
- **V1 7d @ p99**: cold 15.7 s > store timeout 5.00 s
- **V2 7d @ p99**: cold 15.4 s > store timeout 5.00 s
- **V3 7d @ p99**: cold 15.5 s > store timeout 5.00 s
- **V4 7d @ p99**: cold 16.8 s > store timeout 5.00 s
- **V5 7d @ p99**: cold 15.9 s > store timeout 5.00 s
- **T0 7d @ p99**: memory 1.46 GiB > 1 GiB; cold 16.7 s > store timeout 15.0 s
- **T1 7d @ p99**: memory 1.51 GiB > 1 GiB; cold 18.0 s > store timeout 15.0 s
- **T2 7d @ p99**: cold 18.4 s > store timeout 15.0 s
- **TH0 7d @ p99**: cold 15.3 s > store timeout 15.0 s
- **T3 7d @ p99**: cold 15.7 s > store timeout 15.0 s
- **TH1 7d @ p99**: cold 15.8 s > store timeout 15.0 s
- **T4 7d @ p99**: cold 15.4 s > store timeout 15.0 s
- **TH2 7d @ p99**: cold 29.4 s > store timeout 15.0 s
- **TH4 7d @ p99**: failed: timeout
- **T6 7d @ p99**: cold 16.7 s > store timeout 15.0 s
- **TH5 7d @ p99**: cold 15.2 s > store timeout 15.0 s
- **O1 7d @ p99**: cold 17.7 s > store timeout 15.0 s
- **O2 7d @ p99**: cold 15.8 s > store timeout 15.0 s
- **O3 7d @ p99**: cold 16.9 s > store timeout 15.0 s
- **K1 7d @ p99**: cold 16.6 s > store timeout 15.0 s
- **K2 7d @ p99**: cold 16.8 s > store timeout 15.0 s
- **OF0 7d @ p99**: cold 14.8 s > store timeout 5.00 s
- **OF1 7d @ p99**: cold 15.7 s > store timeout 5.00 s
- **P0 7d @ p99**: cold 18.7 s > store timeout 15.0 s
- **P1 7d @ p99**: cold 17.5 s > store timeout 15.0 s
- **P2 7d @ p99**: cold 19.8 s > store timeout 15.0 s
- **P3 7d @ p99**: cold 17.3 s > store timeout 15.0 s
- **G0 7d @ p99**: cold 17.0 s > store timeout 15.0 s
- **D1 7d @ p99**: cold 17.2 s > store timeout 15.0 s
- **D2 7d @ p99**: cold 18.2 s > store timeout 15.0 s
- **S4 7d @ p99**: memory 784 MiB > store limit 512 MiB
- **T7 7d @ p99**: failed: timeout; memory 1.46 GiB > 1 GiB
- **T8 7d @ p99**: failed: timeout
- **T9 7d @ p99**: failed: timeout; memory 1.05 GiB > 1 GiB
- **T10 7d @ p99**: failed: timeout
- **T12 7d @ p99**: failed: timeout; memory 1.10 GiB > 1 GiB
- **TH3 7d @ p99**: failed: timeout
- **V6 7d @ p99**: cold 19.7 s > store timeout 5.00 s
- **V7 7d @ p99**: memory 1.14 GiB > 1 GiB; memory 1.14 GiB > store limit 256 MiB; cold 20.0 s > store timeout 5.00 s
- **V8 7d @ p99**: cold 20.3 s > store timeout 5.00 s
- **V1 30d @ p99**: cold 17.5 s > store timeout 5.00 s
- **V2 30d @ p99**: cold 17.1 s > store timeout 5.00 s
- **V3 30d @ p99**: cold 17.0 s > store timeout 5.00 s
- **V4 30d @ p99**: cold 18.0 s > store timeout 5.00 s
- **V5 30d @ p99**: cold 18.0 s > store timeout 5.00 s
- **T0 30d @ p99**: failed: memory; memory 2.84 GiB > 1 GiB; cold 19.6 s > store timeout 15.0 s
- **T1 30d @ p99**: failed: memory; memory 2.84 GiB > 1 GiB; cold 18.9 s > store timeout 15.0 s
- **T2 30d @ p99**: memory 1.50 GiB > 1 GiB; cold 19.2 s > store timeout 15.0 s
- **TH0 30d @ p99**: cold 16.5 s > store timeout 15.0 s
- **T3 30d @ p99**: cold 17.8 s > store timeout 15.0 s
- **TH1 30d @ p99**: cold 18.5 s > store timeout 15.0 s
- **T4 30d @ p99**: cold 16.0 s > store timeout 15.0 s
- **TH2 30d @ p99**: failed: timeout
- **TH4 30d @ p99**: failed: timeout
- **T6 30d @ p99**: memory 2.84 GiB > 1 GiB; cold 21.1 s > store timeout 15.0 s
- **TH5 30d @ p99**: cold 18.5 s > store timeout 15.0 s
- **O1 30d @ p99**: memory 2.96 GiB > 1 GiB; cold 20.2 s > store timeout 15.0 s
- **TH6 30d @ p99**: cold 17.1 s > store timeout 15.0 s
- **O2 30d @ p99**: memory 2.84 GiB > 1 GiB; cold 21.3 s > store timeout 15.0 s
- **O3 30d @ p99**: memory 3.09 GiB > 1 GiB; cold 21.1 s > store timeout 15.0 s
- **K1 30d @ p99**: memory 2.84 GiB > 1 GiB; cold 20.8 s > store timeout 15.0 s
- **K2 30d @ p99**: memory 3.44 GiB > 1 GiB; cold 25.7 s > store timeout 15.0 s
- **K3 30d @ p99**: memory 3.00 GiB > 1 GiB; cold 19.7 s > store timeout 15.0 s
- **OF0 30d @ p99**: cold 15.9 s > store timeout 5.00 s
- **OF1 30d @ p99**: cold 15.9 s > store timeout 5.00 s
- **P0 30d @ p99**: cold 18.3 s > store timeout 15.0 s
- **P1 30d @ p99**: cold 19.6 s > store timeout 15.0 s
- **P2 30d @ p99**: cold 18.7 s > store timeout 15.0 s
- **P3 30d @ p99**: cold 20.2 s > store timeout 15.0 s
- **G0 30d @ p99**: cold 16.5 s > store timeout 15.0 s
- **D1 30d @ p99**: memory 3.14 GiB > 1 GiB; cold 19.6 s > store timeout 15.0 s
- **D2 30d @ p99**: memory 3.09 GiB > 1 GiB; cold 19.9 s > store timeout 15.0 s
- **S0 30d @ p99**: memory 551 MiB > store limit 512 MiB; cold 15.0 s > store timeout 15.0 s
- **S4 30d @ p99**: memory 1.86 GiB > 1 GiB; memory 1.86 GiB > store limit 512 MiB; cold 17.8 s > store timeout 15.0 s
- **S6 30d @ p99**: cold 15.9 s > store timeout 15.0 s
- **T7 30d @ p99**: failed: timeout/memory; memory 3.14 GiB > 1 GiB
- **T8 30d @ p99**: failed: timeout; memory 2.88 GiB > 1 GiB
- **T9 30d @ p99**: failed: timeout; memory 3.23 GiB > 1 GiB
- **T10 30d @ p99**: failed: timeout/memory
- **T12 30d @ p99**: failed: timeout; memory 3.97 GiB > 1 GiB
- **TH3 30d @ p99**: failed: timeout
- **V6 30d @ p99**: cold 21.1 s > store timeout 5.00 s
- **V7 30d @ p99**: memory 3.27 GiB > 1 GiB; memory 3.27 GiB > store limit 256 MiB; cold 24.3 s > store timeout 5.00 s
- **V8 30d @ p99**: cold 23.1 s > store timeout 5.00 s
- **V1 1d @ largest**: cold 14.5 s > store timeout 5.00 s
- **V2 1d @ largest**: cold 13.6 s > store timeout 5.00 s
- **V3 1d @ largest**: cold 13.8 s > store timeout 5.00 s
- **V4 1d @ largest**: cold 14.9 s > store timeout 5.00 s
- **V5 1d @ largest**: cold 14.8 s > store timeout 5.00 s
- **T0 1d @ largest**: memory 1.33 GiB > 1 GiB; cold 16.0 s > store timeout 15.0 s
- **T1 1d @ largest**: memory 1.33 GiB > 1 GiB; cold 16.4 s > store timeout 15.0 s
- **T2 1d @ largest**: memory 1.22 GiB > 1 GiB; cold 18.2 s > store timeout 15.0 s
- **TH1 1d @ largest**: cold 15.6 s > store timeout 15.0 s
- **T4 1d @ largest**: cold 18.2 s > store timeout 15.0 s
- **TH2 1d @ largest**: cold 29.9 s > store timeout 15.0 s
- **TH4 1d @ largest**: failed: timeout
- **T6 1d @ largest**: cold 15.2 s > store timeout 15.0 s
- **O1 1d @ largest**: memory 1.35 GiB > 1 GiB; cold 16.8 s > store timeout 15.0 s
- **O2 1d @ largest**: memory 1.35 GiB > 1 GiB; cold 16.0 s > store timeout 15.0 s
- **O3 1d @ largest**: memory 1.33 GiB > 1 GiB
- **K1 1d @ largest**: memory 1.35 GiB > 1 GiB
- **K2 1d @ largest**: memory 1.98 GiB > 1 GiB; cold 15.8 s > store timeout 15.0 s
- **K3 1d @ largest**: memory 1.54 GiB > 1 GiB; cold 16.5 s > store timeout 15.0 s
- **OF0 1d @ largest**: cold 13.7 s > store timeout 5.00 s
- **OF1 1d @ largest**: cold 14.4 s > store timeout 5.00 s
- **P1 1d @ largest**: cold 18.5 s > store timeout 15.0 s
- **P2 1d @ largest**: cold 18.3 s > store timeout 15.0 s
- **P3 1d @ largest**: cold 21.3 s > store timeout 15.0 s
- **G0 1d @ largest**: cold 18.2 s > store timeout 15.0 s
- **D1 1d @ largest**: memory 1.44 GiB > 1 GiB; cold 17.3 s > store timeout 15.0 s
- **D2 1d @ largest**: memory 1.35 GiB > 1 GiB; cold 17.1 s > store timeout 15.0 s
- **S4 1d @ largest**: memory 526 MiB > store limit 512 MiB
- **T7 1d @ largest**: failed: timeout; memory 1.38 GiB > 1 GiB
- **T8 1d @ largest**: failed: timeout; memory 1.37 GiB > 1 GiB
- **T9 1d @ largest**: failed: timeout; memory 2.03 GiB > 1 GiB
- **T10 1d @ largest**: failed: timeout; memory 1.38 GiB > 1 GiB
- **T12 1d @ largest**: failed: timeout; memory 1.55 GiB > 1 GiB
- **TH3 1d @ largest**: failed: timeout
- **V6 1d @ largest**: cold 19.0 s > store timeout 5.00 s
- **V7 1d @ largest**: memory 802 MiB > store limit 256 MiB; cold 18.9 s > store timeout 5.00 s
- **V8 1d @ largest**: cold 19.7 s > store timeout 5.00 s
- **V1 7d @ largest**: cold 17.2 s > store timeout 5.00 s
- **V2 7d @ largest**: cold 19.3 s > store timeout 5.00 s
- **V3 7d @ largest**: cold 19.0 s > store timeout 5.00 s
- **V4 7d @ largest**: cold 19.8 s > store timeout 5.00 s
- **V5 7d @ largest**: memory 257 MiB > store limit 256 MiB; cold 20.8 s > store timeout 5.00 s
- **T2 7d @ largest**: failed: memory
- **TH0 7d @ largest**: cold 18.1 s > store timeout 15.0 s
- **T3 7d @ largest**: cold 21.7 s > store timeout 15.0 s
- **TH1 7d @ largest**: cold 21.1 s > store timeout 15.0 s
- **T4 7d @ largest**: failed: memory
- **TH2 7d @ largest**: failed: timeout
- **TH4 7d @ largest**: failed: timeout
- **T6 7d @ largest**: failed: memory
- **TH5 7d @ largest**: cold 17.9 s > store timeout 15.0 s
- **O1 7d @ largest**: failed: memory
- **TH6 7d @ largest**: cold 18.2 s > store timeout 15.0 s
- **O2 7d @ largest**: failed: memory
- **O3 7d @ largest**: failed: memory
- **K1 7d @ largest**: failed: memory
- **K2 7d @ largest**: failed: memory
- **K3 7d @ largest**: failed: memory
- **OF0 7d @ largest**: cold 16.8 s > store timeout 5.00 s
- **OF1 7d @ largest**: memory 259 MiB > store limit 256 MiB; cold 19.5 s > store timeout 5.00 s
- **P0 7d @ largest**: cold 18.1 s > store timeout 15.0 s
- **P1 7d @ largest**: cold 22.1 s > store timeout 15.0 s
- **P2 7d @ largest**: cold 21.9 s > store timeout 15.0 s
- **P3 7d @ largest**: cold 24.4 s > store timeout 15.0 s
- **G0 7d @ largest**: cold 19.4 s > store timeout 15.0 s
- **D1 7d @ largest**: failed: memory
- **D2 7d @ largest**: failed: memory
- **S2 7d @ largest**: memory 542 MiB > store limit 512 MiB
- **S4 7d @ largest**: memory 2.51 GiB > 1 GiB; memory 2.51 GiB > store limit 512 MiB
- **T8 7d @ largest**: failed: timeout/memory
- **T9 7d @ largest**: failed: timeout/memory
- **T12 7d @ largest**: failed: timeout/memory
- **TH3 7d @ largest**: failed: timeout
- **V6 7d @ largest**: cold 24.8 s > store timeout 5.00 s
- **V7 7d @ largest**: memory 3.54 GiB > 1 GiB; memory 3.54 GiB > store limit 256 MiB; cold 27.9 s > store timeout 5.00 s
- **V8 7d @ largest**: cold 26.5 s > store timeout 5.00 s
- **V1 30d @ largest**: memory 286 MiB > store limit 256 MiB; cold 23.3 s > store timeout 5.00 s
- **V2 30d @ largest**: memory 303 MiB > store limit 256 MiB; cold 23.7 s > store timeout 5.00 s
- **V3 30d @ largest**: memory 303 MiB > store limit 256 MiB; cold 22.3 s > store timeout 5.00 s
- **V4 30d @ largest**: memory 292 MiB > store limit 256 MiB; cold 24.6 s > store timeout 5.00 s
- **V5 30d @ largest**: memory 448 MiB > store limit 256 MiB; cold 25.6 s > store timeout 5.00 s
- **TH0 30d @ largest**: cold 20.0 s > store timeout 15.0 s
- **T3 30d @ largest**: cold 23.3 s > store timeout 15.0 s
- **TH1 30d @ largest**: cold 24.9 s > store timeout 15.0 s
- **TH2 30d @ largest**: failed: timeout
- **TH4 30d @ largest**: failed: timeout
- **TH5 30d @ largest**: cold 23.1 s > store timeout 15.0 s
- **TH6 30d @ largest**: cold 23.5 s > store timeout 15.0 s
- **OF0 30d @ largest**: memory 411 MiB > store limit 256 MiB; cold 20.1 s > store timeout 5.00 s
- **OF1 30d @ largest**: memory 409 MiB > store limit 256 MiB; cold 22.9 s > store timeout 5.00 s
- **P0 30d @ largest**: cold 22.6 s > store timeout 15.0 s
- **P1 30d @ largest**: cold 29.8 s > store timeout 15.0 s
- **P2 30d @ largest**: cold 29.3 s > store timeout 15.0 s
- **P3 30d @ largest**: failed: timeout
- **G0 30d @ largest**: cold 22.9 s > store timeout 15.0 s
- **S0 30d @ largest**: memory 1.16 GiB > 1 GiB; memory 1.16 GiB > store limit 512 MiB; cold 16.6 s > store timeout 15.0 s
- **S1 30d @ largest**: memory 1.15 GiB > 1 GiB; memory 1.15 GiB > store limit 512 MiB; cold 23.8 s > store timeout 15.0 s
- **S2 30d @ largest**: memory 1.24 GiB > 1 GiB; memory 1.24 GiB > store limit 512 MiB; cold 17.8 s > store timeout 15.0 s
- **S3 30d @ largest**: memory 1.15 GiB > 1 GiB; memory 1.15 GiB > store limit 512 MiB; cold 19.7 s > store timeout 15.0 s
- **S4 30d @ largest**: failed: memory
- **S5 30d @ largest**: memory 1.14 GiB > 1 GiB; memory 1.14 GiB > store limit 512 MiB
- **S6 30d @ largest**: memory 1.16 GiB > 1 GiB; memory 1.16 GiB > store limit 512 MiB
- **TH3 30d @ largest**: failed: timeout
- **S7 30d @ largest**: memory 1.14 GiB > 1 GiB; memory 1.14 GiB > store limit 512 MiB
- **S8 30d @ largest**: memory 1.15 GiB > 1 GiB; memory 1.15 GiB > store limit 512 MiB; cold 15.8 s > store timeout 15.0 s
- **S9 30d @ largest**: memory 1.15 GiB > 1 GiB; memory 1.15 GiB > store limit 512 MiB; cold 16.0 s > store timeout 15.0 s
- **V6 30d @ largest**: failed: timeout; memory 369 MiB > store limit 256 MiB; cold 28.2 s > store timeout 5.00 s
- **V7 30d @ largest**: failed: timeout/memory
- **V8 30d @ largest**: failed: timeout; memory 367 MiB > store limit 256 MiB

### queryTraces(), keyset mode

| case | window | small                                                                       | mid                                                                | p90                                                                | p99                                                                         | largest                                                             |
| ---- | ------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| T0   | 1d     | **166 MiB** · 74 ms / 404 ms (cold 2.09 s)<br>90 k rows · 919 kB            | **180 MiB** · 51 ms / 315 ms (cold 1.67 s)<br>94 k rows · 1 MB     | **174 MiB** · 42 ms / 391 ms (cold 1.45 s)<br>111 k rows · 1 MB    | **406 MiB** · 355 ms / 687 ms (cold 12.7 s)<br>2.7 M rows · 165 MB          | **1.33 GiB** · 314 ms / 912 ms (cold 16.0 s)<br>2.8 M rows · 183 MB |
| T0   | 7d     | **167 MiB** · 243 ms / 934 ms (cold 14.5 s)<br>2.7 M rows · 98 MB           | **182 MiB** · 238 ms / 335 ms (cold 13.4 s)<br>2.7 M rows · 98 MB  | **176 MiB** · 58 ms / 418 ms (cold 2.16 s)<br>112 k rows · 2 MB    | **1.46 GiB** · 751 ms / 1.33 s (cold 16.7 s)<br>2.8 M rows · 509 MB         | –                                                                   |
| T0   | 30d    | **167 MiB** · 254 ms / 405 ms (cold 14.2 s)<br>2.7 M rows · 100 MB          | **453 MiB** · 513 ms / 929 ms (cold 13.9 s)<br>2.7 M rows · 255 MB | **494 MiB** · 468 ms / 755 ms (cold 16.0 s)<br>2.7 M rows · 370 MB | **2.84 GiB** · 1.43 s / 2.13 s (cold 19.6 s)<br>2.8 M rows · 1.2 GB ✗memory | –                                                                   |
| T1   | 1d     | **179 MiB** · 66 ms / 362 ms (cold 3.64 s)<br>90 k rows · 889 kB            | **190 MiB** · 59 ms / 150 ms (cold 2.97 s)<br>94 k rows · 1 MB     | **184 MiB** · 53 ms / 266 ms (cold 2.75 s)<br>111 k rows · 1 MB    | **407 MiB** · 258 ms / 526 ms (cold 13.6 s)<br>2.7 M rows · 153 MB          | **1.33 GiB** · 250 ms / 736 ms (cold 16.4 s)<br>2.8 M rows · 183 MB |
| T1   | 7d     | **175 MiB** · 224 ms / 336 ms (cold 14.7 s)<br>2.7 M rows · 95 MB           | **190 MiB** · 179 ms / 324 ms (cold 14.0 s)<br>2.7 M rows · 98 MB  | **184 MiB** · 94 ms / 362 ms (cold 3.32 s)<br>112 k rows · 2 MB    | **1.51 GiB** · 773 ms / 3.98 s (cold 18.0 s)<br>2.8 M rows · 509 MB         | –                                                                   |
| T1   | 30d    | **179 MiB** · 180 ms / 250 ms (cold 15.2 s)<br>2.7 M rows · 95 MB           | **458 MiB** · 450 ms / 760 ms (cold 16.3 s)<br>2.7 M rows · 189 MB | **687 MiB** · 536 ms / 763 ms (cold 18.5 s)<br>2.7 M rows · 370 MB | **2.84 GiB** · 915 ms / 1.49 s (cold 18.9 s)<br>2.8 M rows · 1.0 GB ✗memory | –                                                                   |
| T2   | 1d     | **187 MiB** · 119 ms / 218 ms (cold 3.87 s)<br>90 k rows · 3 MB             | **180 MiB** · 53 ms / 519 ms (cold 12.5 s)<br>106 k rows · 3 MB    | **198 MiB** · 259 ms / 319 ms (cold 13.4 s)<br>2.7 M rows · 102 MB | **198 MiB** · 57 ms / 661 ms (cold 3.57 s)<br>72 k rows · 2 MB              | **1.22 GiB** · 760 ms / 814 ms (cold 18.2 s)<br>2.8 M rows · 633 MB |
| T2   | 7d     | **184 MiB** · 271 ms / 307 ms (cold 15.4 s)<br>2.7 M rows · 97 MB           | **179 MiB** · 269 ms / 339 ms (cold 15.6 s)<br>2.7 M rows · 99 MB  | **190 MiB** · 232 ms / 240 ms (cold 14.4 s)<br>2.7 M rows · 154 MB | **399 MiB** · 576 ms / 717 ms (cold 18.4 s)<br>2.7 M rows · 337 MB          | ✗ memory                                                            |
| T2   | 30d    | **187 MiB** · 175 ms / 228 ms (cold 15.2 s)<br>2.7 M rows · 97 MB           | **184 MiB** · 326 ms / 427 ms (cold 15.4 s)<br>2.7 M rows · 141 MB | **200 MiB** · 291 ms / 328 ms (cold 16.1 s)<br>2.7 M rows · 369 MB | **1.50 GiB** · 891 ms / 942 ms (cold 19.2 s)<br>2.8 M rows · 1.1 GB         | –                                                                   |
| T3   | 1d     | **180 MiB** · 359 ms / 419 ms (cold 3.45 s)<br>90 k rows · 4 MB             | **185 MiB** · 65 ms / 332 ms (cold 2.60 s)<br>106 k rows · 6 MB    | **179 MiB** · 249 ms / 494 ms (cold 14.3 s)<br>2.7 M rows · 106 MB | **175 MiB** · 51 ms / 484 ms (cold 2.68 s)<br>72 k rows · 4 MB              | **183 MiB** · 72 ms / 159 ms (cold 3.19 s)<br>103 k rows · 4 MB     |
| T3   | 7d     | **180 MiB** · 54 ms / 67 ms (cold 2.87 s)<br>90 k rows · 5 MB               | **185 MiB** · 105 ms / 115 ms (cold 2.59 s)<br>106 k rows · 7 MB   | **177 MiB** · 233 ms / 250 ms (cold 16.9 s)<br>2.7 M rows · 129 MB | **179 MiB** · 372 ms / 376 ms (cold 15.7 s)<br>2.7 M rows · 136 MB          | **502 MiB** · 831 ms / 931 ms (cold 21.7 s)<br>3.0 M rows · 1.4 GB  |
| T3   | 30d    | **185 MiB** · 52 ms / 115 ms (cold 3.23 s)<br>90 k rows · 7 MB              | **270 MiB** · 444 ms / 538 ms (cold 14.6 s)<br>2.7 M rows · 213 MB | **189 MiB** · 271 ms / 313 ms (cold 15.8 s)<br>2.7 M rows · 286 MB | **245 MiB** · 584 ms / 1.16 s (cold 17.8 s)<br>2.8 M rows · 440 MB          | **427 MiB** · 877 ms / 1.55 s (cold 23.3 s)<br>3.2 M rows · 1.6 GB  |
| T4   | 1d     | **171 MiB** · 81 ms / 275 ms (cold 4.87 s)<br>90 k rows · 18 MB             | –                                                                  | –                                                                  | **173 MiB** · 121 ms / 631 ms (cold 4.01 s)<br>72 k rows · 16 MB            | **511 MiB** · 708 ms / 816 ms (cold 18.2 s)<br>2.8 M rows · 648 MB  |
| T4   | 7d     | **176 MiB** · 354 ms / 355 ms (cold 16.3 s)<br>2.7 M rows · 113 MB          | –                                                                  | –                                                                  | **177 MiB** · 371 ms / 420 ms (cold 15.4 s)<br>2.7 M rows · 168 MB          | ✗ memory                                                            |
| T4   | 30d    | **171 MiB** · 201 ms / 257 ms (cold 15.0 s)<br>2.7 M rows · 113 MB          | –                                                                  | –                                                                  | **169 MiB** · 384 ms / 435 ms (cold 16.0 s)<br>2.8 M rows · 176 MB          | –                                                                   |
| T6   | 1d     | **180 MiB** · 46 ms / 115 ms (cold 2.01 s)<br>90 k rows · 2 MB              | **181 MiB** · 48 ms / 95 ms (cold 2.15 s)<br>106 k rows · 2 MB     | **174 MiB** · 314 ms / 1.82 s (cold 13.2 s)<br>2.7 M rows · 97 MB  | **183 MiB** · 278 ms / 406 ms (cold 14.1 s)<br>2.7 M rows · 105 MB          | **743 MiB** · 634 ms / 675 ms (cold 15.2 s)<br>2.8 M rows · 631 MB  |
| T6   | 7d     | **176 MiB** · 56 ms / 174 ms (cold 2.47 s)<br>90 k rows · 2 MB              | **184 MiB** · 435 ms / 652 ms (cold 18.1 s)<br>2.7 M rows · 98 MB  | **179 MiB** · 181 ms / 233 ms (cold 13.4 s)<br>2.7 M rows · 105 MB | **703 MiB** · 639 ms / 865 ms (cold 16.7 s)<br>2.7 M rows · 510 MB          | ✗ memory                                                            |
| T6   | 30d    | **180 MiB** · 51 ms / 52 ms (cold 2.56 s)<br>90 k rows · 5 MB               | **261 MiB** · 439 ms / 644 ms (cold 15.4 s)<br>2.7 M rows · 237 MB | **186 MiB** · 177 ms / 213 ms (cold 14.3 s)<br>2.7 M rows · 107 MB | **2.84 GiB** · 2.22 s / 4.36 s (cold 21.1 s)<br>2.8 M rows · 1.6 GB         | –                                                                   |
| T7   | 1d     | **178 MiB** · 172 ms / 626 ms (cold 5.91 s)<br>180 k rows · 2 MB ✗timeout   | **182 MiB** · 93 ms / 149 ms (cold 4.15 s)<br>189 k rows · 2 MB    | **184 MiB** · 167 ms / 452 ms (cold 6.45 s)<br>222 k rows · 2 MB   | **424 MiB** · 540 ms / 1.95 s (cold 29.4 s)<br>6.0 M rows · 310 MB ✗timeout | **1.38 GiB** · 1.03 s / 2.29 s<br>7.0 M rows · 346 MB ✗timeout      |
| T7   | 7d     | **176 MiB** · 544 ms / 779 ms (cold 29.2 s)<br>5.4 M rows · 195 MB ✗timeout | **184 MiB** · 569 ms / 872 ms (cold 28.7 s)<br>5.4 M rows · 195 MB | **177 MiB** · 158 ms / 1.32 s (cold 5.75 s)<br>223 k rows · 4 MB   | **1.46 GiB** · 1.17 s / 1.84 s<br>6.5 M rows · 672 MB ✗timeout              | –                                                                   |
| T7   | 30d    | **169 MiB** · 609 ms / 828 ms (cold 29.1 s)<br>5.4 M rows · 199 MB ✗timeout | **466 MiB** · 643 ms / 1.08 s (cold 27.7 s)<br>5.5 M rows · 360 MB | **542 MiB** · 1.00 s / 2.59 s<br>5.5 M rows · 476 MB ✗timeout      | **3.14 GiB** · 2.50 s / 3.86 s<br>6.3 M rows · 1.4 GB ✗timeout/memory       | –                                                                   |
| T8   | 1d     | **169 MiB** · 154 ms / 162 ms (cold 3.14 s)<br>180 k rows · 2 MB            | **174 MiB** · 129 ms / 141 ms (cold 3.70 s)<br>211 k rows · 2 MB   | **188 MiB** · 652 ms / 1.23 s (cold 27.8 s)<br>5.5 M rows · 199 MB | **181 MiB** · 683 ms / 706 ms<br>5.8 M rows · 214 MB ✗timeout               | **1.37 GiB** · 1.72 s / 4.81 s<br>8.5 M rows · 874 MB ✗timeout      |
| T8   | 7d     | **178 MiB** · 588 ms / 748 ms (cold 29.6 s)<br>5.4 M rows · 194 MB          | **178 MiB** · 846 ms / 1.43 s (cold 26.9 s)<br>5.5 M rows · 195 MB | **187 MiB** · 673 ms / 751 ms (cold 28.4 s)<br>5.5 M rows · 252 MB | **758 MiB** · 1.28 s / 1.51 s<br>6.5 M rows · 668 MB ✗timeout               | ✗ timeout/memory                                                    |
| T8   | 30d    | **170 MiB** · 751 ms / 775 ms<br>5.5 M rows · 198 MB ✗timeout               | **284 MiB** · 584 ms / 1.75 s (cold 28.5 s)<br>5.5 M rows · 360 MB | **225 MiB** · 945 ms / 959 ms<br>5.5 M rows · 476 MB ✗timeout      | **2.88 GiB** · 2.86 s / 3.21 s<br>6.5 M rows · 1.8 GB ✗timeout              | –                                                                   |
| T9   | 1d     | **173 MiB** · 140 ms / 145 ms (cold 3.63 s)<br>180 k rows · 2 MB            | **180 MiB** · 134 ms / 278 ms (cold 3.83 s)<br>211 k rows · 2 MB   | **177 MiB** · 635 ms / 720 ms (cold 28.5 s)<br>5.5 M rows · 199 MB | **182 MiB** · 664 ms / 1.41 s<br>5.8 M rows · 214 MB ✗timeout               | **2.03 GiB** · 1.43 s / 1.53 s<br>8.5 M rows · 874 MB ✗timeout      |
| T9   | 7d     | **169 MiB** · 572 ms / 577 ms (cold 28.8 s)<br>5.4 M rows · 194 MB          | **174 MiB** · 820 ms / 900 ms (cold 26.1 s)<br>5.5 M rows · 195 MB | **177 MiB** · 757 ms / 832 ms<br>5.5 M rows · 252 MB ✗timeout      | **1.05 GiB** · 1.00 s / 1.26 s<br>6.5 M rows · 667 MB ✗timeout              | ✗ timeout/memory                                                    |
| T9   | 30d    | **169 MiB** · 745 ms / 776 ms<br>5.5 M rows · 198 MB ✗timeout               | **284 MiB** · 525 ms / 546 ms (cold 28.8 s)<br>5.5 M rows · 360 MB | **236 MiB** · 843 ms / 1.04 s<br>5.5 M rows · 476 MB ✗timeout      | **3.23 GiB** · 2.98 s / 3.31 s<br>6.5 M rows · 1.8 GB ✗timeout              | –                                                                   |
| T10  | 1d     | **170 MiB** · 134 ms / 143 ms (cold 3.50 s)<br>180 k rows · 2 MB            | **173 MiB** · 133 ms / 153 ms (cold 3.67 s)<br>211 k rows · 2 MB   | **184 MiB** · 642 ms / 736 ms (cold 28.2 s)<br>5.5 M rows · 199 MB | **179 MiB** · 692 ms / 758 ms<br>5.8 M rows · 214 MB ✗timeout               | **1.38 GiB** · 1.42 s / 1.53 s<br>8.5 M rows · 881 MB ✗timeout      |
| T10  | 7d     | **175 MiB** · 551 ms / 691 ms (cold 29.9 s)<br>5.4 M rows · 194 MB          | **184 MiB** · 693 ms / 843 ms (cold 27.3 s)<br>5.5 M rows · 195 MB | **188 MiB** · 717 ms / 949 ms (cold 28.7 s)<br>5.5 M rows · 252 MB | **771 MiB** · 1.49 s / 2.85 s<br>6.5 M rows · 672 MB ✗timeout               | –                                                                   |
| T10  | 30d    | **169 MiB** · 774 ms / 811 ms<br>5.5 M rows · 198 MB ✗timeout               | **286 MiB** · 524 ms / 569 ms (cold 28.2 s)<br>5.5 M rows · 360 MB | **225 MiB** · 933 ms / 1.06 s<br>5.5 M rows · 477 MB ✗timeout      | ✗ timeout/memory                                                            | –                                                                   |
| T12  | 1d     | **179 MiB** · 128 ms / 194 ms (cold 4.27 s)<br>180 k rows · 374 kB          | **191 MiB** · 156 ms / 232 ms (cold 7.19 s)<br>211 k rows · 2 MB   | –                                                                  | **191 MiB** · 468 ms / 1.69 s<br>5.8 M rows · 229 MB ✗timeout               | **1.55 GiB** · 2.24 s / 2.79 s<br>8.5 M rows · 1.2 GB ✗timeout      |
| T12  | 7d     | **181 MiB** · 717 ms / 1.26 s<br>5.4 M rows · 191 MB ✗timeout               | **191 MiB** · 775 ms / 2.11 s (cold 29.6 s)<br>5.5 M rows · 196 MB | –                                                                  | **1.10 GiB** · 1.38 s / 1.54 s<br>6.5 M rows · 981 MB ✗timeout              | ✗ timeout/memory                                                    |
| T12  | 30d    | **182 MiB** · 432 ms / 756 ms<br>5.5 M rows · 191 MB ✗timeout               | **263 MiB** · 542 ms / 604 ms (cold 29.3 s)<br>5.5 M rows · 294 MB | –                                                                  | **3.97 GiB** · 4.92 s / 5.85 s<br>6.5 M rows · 3.0 GB ✗timeout              | –                                                                   |
| O1   | 1d     | **166 MiB** · 41 ms / 108 ms (cold 1.80 s)<br>90 k rows · 922 kB            | **171 MiB** · 50 ms / 59 ms (cold 1.65 s)<br>106 k rows · 1 MB     | **175 MiB** · 250 ms / 341 ms (cold 13.4 s)<br>2.7 M rows · 101 MB | **183 MiB** · 207 ms / 237 ms (cold 15.1 s)<br>2.7 M rows · 104 MB          | **1.35 GiB** · 727 ms / 769 ms (cold 16.8 s)<br>2.8 M rows · 630 MB |
| O1   | 7d     | **166 MiB** · 236 ms / 353 ms (cold 13.0 s)<br>2.7 M rows · 96 MB           | **171 MiB** · 244 ms / 720 ms (cold 12.4 s)<br>2.7 M rows · 98 MB  | **174 MiB** · 206 ms / 238 ms (cold 13.6 s)<br>2.7 M rows · 153 MB | **743 MiB** · 539 ms / 555 ms (cold 17.7 s)<br>2.7 M rows · 509 MB          | ✗ memory                                                            |
| O1   | 30d    | **167 MiB** · 164 ms / 208 ms (cold 13.1 s)<br>2.7 M rows · 99 MB           | **277 MiB** · 434 ms / 850 ms (cold 14.1 s)<br>2.7 M rows · 255 MB | **195 MiB** · 318 ms / 340 ms (cold 15.5 s)<br>2.7 M rows · 370 MB | **2.96 GiB** · 2.44 s / 2.52 s (cold 20.2 s)<br>2.8 M rows · 1.6 GB         | –                                                                   |
| O2   | 1d     | **166 MiB** · 40 ms / 80 ms (cold 1.70 s)<br>90 k rows · 922 kB             | **171 MiB** · 41 ms / 101 ms (cold 1.77 s)<br>106 k rows · 1 MB    | **175 MiB** · 269 ms / 322 ms (cold 12.5 s)<br>2.7 M rows · 101 MB | **181 MiB** · 202 ms / 302 ms (cold 13.4 s)<br>2.7 M rows · 104 MB          | **1.35 GiB** · 835 ms / 920 ms (cold 16.0 s)<br>2.8 M rows · 630 MB |
| O2   | 7d     | **166 MiB** · 241 ms / 248 ms (cold 14.3 s)<br>2.7 M rows · 96 MB           | **172 MiB** · 443 ms / 558 ms (cold 12.6 s)<br>2.7 M rows · 98 MB  | **174 MiB** · 233 ms / 278 ms (cold 12.5 s)<br>2.7 M rows · 153 MB | **734 MiB** · 579 ms / 687 ms (cold 15.8 s)<br>2.7 M rows · 509 MB          | ✗ memory                                                            |
| O2   | 30d    | **168 MiB** · 166 ms / 230 ms (cold 13.8 s)<br>2.7 M rows · 99 MB           | **275 MiB** · 511 ms / 561 ms (cold 14.6 s)<br>2.7 M rows · 255 MB | **236 MiB** · 292 ms / 348 ms (cold 15.9 s)<br>2.7 M rows · 370 MB | **2.84 GiB** · 2.11 s / 2.26 s (cold 21.3 s)<br>2.8 M rows · 1.6 GB         | –                                                                   |
| O3   | 1d     | **167 MiB** · 41 ms / 42 ms (cold 1.91 s)<br>90 k rows · 922 kB             | **171 MiB** · 41 ms / 60 ms (cold 6.11 s)<br>106 k rows · 1 MB     | **174 MiB** · 220 ms / 234 ms (cold 13.0 s)<br>2.7 M rows · 101 MB | **180 MiB** · 257 ms / 303 ms (cold 13.6 s)<br>2.7 M rows · 104 MB          | **1.33 GiB** · 801 ms / 960 ms (cold 14.9 s)<br>2.8 M rows · 630 MB |
| O3   | 7d     | **167 MiB** · 225 ms / 297 ms (cold 13.4 s)<br>2.7 M rows · 96 MB           | **171 MiB** · 417 ms / 467 ms (cold 16.7 s)<br>2.7 M rows · 98 MB  | **176 MiB** · 206 ms / 300 ms (cold 13.3 s)<br>2.7 M rows · 153 MB | **698 MiB** · 568 ms / 612 ms (cold 16.9 s)<br>2.7 M rows · 509 MB          | ✗ memory                                                            |
| O3   | 30d    | **166 MiB** · 174 ms / 206 ms (cold 13.6 s)<br>2.7 M rows · 99 MB           | **280 MiB** · 518 ms / 1.44 s (cold 14.4 s)<br>2.7 M rows · 255 MB | **212 MiB** · 315 ms / 352 ms (cold 17.0 s)<br>2.7 M rows · 370 MB | **3.09 GiB** · 1.94 s / 1.95 s (cold 21.1 s)<br>2.8 M rows · 1.6 GB         | –                                                                   |
| K1   | 1d     | **166 MiB** · 41 ms / 42 ms (cold 1.68 s)<br>90 k rows · 922 kB             | **171 MiB** · 40 ms / 41 ms (cold 1.54 s)<br>106 k rows · 1 MB     | **174 MiB** · 205 ms / 234 ms (cold 12.4 s)<br>2.7 M rows · 101 MB | **177 MiB** · 188 ms / 207 ms (cold 13.9 s)<br>2.7 M rows · 104 MB          | **1.35 GiB** · 883 ms / 893 ms (cold 14.8 s)<br>2.8 M rows · 630 MB |
| K1   | 7d     | **171 MiB** · 220 ms / 251 ms (cold 14.9 s)<br>2.7 M rows · 96 MB           | **171 MiB** · 260 ms / 473 ms (cold 13.5 s)<br>2.7 M rows · 98 MB  | **174 MiB** · 203 ms / 304 ms (cold 12.6 s)<br>2.7 M rows · 153 MB | **698 MiB** · 762 ms / 766 ms (cold 16.6 s)<br>2.7 M rows · 509 MB          | ✗ memory                                                            |
| K1   | 30d    | **167 MiB** · 174 ms / 220 ms (cold 14.1 s)<br>2.7 M rows · 99 MB           | **276 MiB** · 397 ms / 712 ms (cold 15.2 s)<br>2.7 M rows · 255 MB | **236 MiB** · 293 ms / 418 ms (cold 15.2 s)<br>2.7 M rows · 370 MB | **2.84 GiB** · 2.38 s / 2.76 s (cold 20.8 s)<br>2.8 M rows · 1.6 GB         | –                                                                   |
| K2   | 1d     | –                                                                           | –                                                                  | –                                                                  | –                                                                           | **1.98 GiB** · 989 ms / 1.12 s (cold 15.8 s)<br>2.8 M rows · 630 MB |
| K2   | 7d     | –                                                                           | –                                                                  | –                                                                  | **773 MiB** · 642 ms / 652 ms (cold 16.8 s)<br>2.7 M rows · 509 MB          | ✗ memory                                                            |
| K2   | 30d    | –                                                                           | –                                                                  | **213 MiB** · 275 ms / 340 ms (cold 15.9 s)<br>2.7 M rows · 370 MB | **3.44 GiB** · 2.70 s / 3.41 s (cold 25.7 s)<br>2.8 M rows · 1.6 GB         | –                                                                   |
| K3   | 1d     | –                                                                           | –                                                                  | –                                                                  | –                                                                           | **1.54 GiB** · 760 ms / 855 ms (cold 16.5 s)<br>2.8 M rows · 630 MB |
| K3   | 7d     | –                                                                           | –                                                                  | –                                                                  | –                                                                           | ✗ memory                                                            |
| K3   | 30d    | –                                                                           | –                                                                  | –                                                                  | **3.00 GiB** · 2.35 s / 2.93 s (cold 19.7 s)<br>2.8 M rows · 1.6 GB         | –                                                                   |

### queryTraces(), page mode, groups and delta

| case       | window | small                                                              | mid                                                                | p90                                                                | p99                                                                 | largest                                                             |
| ---------- | ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| P0         | 1d     | **168 MiB** · 312 ms / 324 ms (cold 15.0 s)<br>2.7 M rows · 95 MB  | **181 MiB** · 42 ms / 56 ms (cold 1.68 s)<br>95 k rows · 1 MB      | **175 MiB** · 42 ms / 210 ms (cold 1.61 s)<br>112 k rows · 1 MB    | **183 MiB** · 164 ms / 217 ms (cold 14.6 s)<br>2.8 M rows · 99 MB   | **192 MiB** · 221 ms / 334 ms (cold 14.9 s)<br>2.8 M rows · 104 MB  |
| P0         | 7d     | **173 MiB** · 238 ms / 1.19 s (cold 14.2 s)<br>2.7 M rows · 96 MB  | **180 MiB** · 149 ms / 1.74 s (cold 18.6 s)<br>2.7 M rows · 96 MB  | **174 MiB** · 62 ms / 260 ms (cold 2.14 s)<br>111 k rows · 2 MB    | **179 MiB** · 283 ms / 373 ms (cold 18.7 s)<br>2.8 M rows · 115 MB  | **305 MiB** · 336 ms / 656 ms (cold 18.1 s)<br>2.8 M rows · 142 MB  |
| P0         | 30d    | **167 MiB** · 174 ms / 242 ms (cold 14.0 s)<br>2.7 M rows · 98 MB  | **180 MiB** · 156 ms / 991 ms (cold 14.0 s)<br>2.7 M rows · 105 MB | **182 MiB** · 172 ms / 219 ms (cold 15.7 s)<br>2.7 M rows · 108 MB | **186 MiB** · 271 ms / 342 ms (cold 18.3 s)<br>2.8 M rows · 146 MB  | **520 MiB** · 1.09 s / 1.52 s (cold 22.6 s)<br>3.1 M rows · 278 MB  |
| P0 payload | 1d     | **27 MiB** · 9 ms / 31 ms (cold 199 ms)<br>8 k rows · 5 MB         | –                                                                  | **32 MiB** · 15 ms / 16 ms (cold 213 ms)<br>9 k rows · 5 MB        | **84 MiB** · 26 ms / 89 ms (cold 201 ms)<br>11 k rows · 5 MB        | **44 MiB** · 13 ms / 31 ms (cold 167 ms)<br>8 k rows · 5 MB         |
| P0 payload | 7d     | **94 MiB** · 13 ms / 96 ms (cold 240 ms)<br>12 k rows · 4 MB       | **37 MiB** · 12 ms / 124 ms (cold 206 ms)<br>25 k rows · 4 MB      | **32 MiB** · 14 ms / 16 ms (cold 228 ms)<br>9 k rows · 5 MB        | **80 MiB** · 25 ms / 28 ms (cold 225 ms)<br>11 k rows · 5 MB        | **44 MiB** · 13 ms / 32 ms (cold 164 ms)<br>8 k rows · 5 MB         |
| P0 payload | 30d    | **107 MiB** · 13 ms / 80 ms (cold 303 ms)<br>12 k rows · 4 MB      | **126 MiB** · 33 ms / 309 ms (cold 301 ms)<br>44 k rows · 34 MB    | **57 MiB** · 15 ms / 17 ms (cold 200 ms)<br>25 k rows · 5 MB       | **84 MiB** · 26 ms / 29 ms (cold 176 ms)<br>11 k rows · 5 MB        | **44 MiB** · 13 ms / 31 ms (cold 198 ms)<br>8 k rows · 5 MB         |
| P1         | 1d     | –                                                                  | **171 MiB** · 42 ms / 46 ms (cold 2.10 s)<br>106 k rows · 1 MB     | **174 MiB** · 145 ms / 163 ms (cold 12.6 s)<br>2.7 M rows · 96 MB  | **177 MiB** · 149 ms / 153 ms (cold 14.0 s)<br>2.7 M rows · 97 MB   | **180 MiB** · 292 ms / 314 ms (cold 18.5 s)<br>2.8 M rows · 108 MB  |
| P1         | 7d     | **167 MiB** · 208 ms / 224 ms (cold 15.3 s)<br>2.7 M rows · 95 MB  | **178 MiB** · 311 ms / 352 ms (cold 20.9 s)<br>2.7 M rows · 96 MB  | **174 MiB** · 220 ms / 311 ms (cold 13.9 s)<br>2.7 M rows · 98 MB  | **184 MiB** · 315 ms / 1.22 s (cold 17.5 s)<br>2.7 M rows · 110 MB  | **303 MiB** · 639 ms / 657 ms (cold 22.1 s)<br>3.0 M rows · 205 MB  |
| P1         | 30d    | **167 MiB** · 150 ms / 162 ms (cold 13.9 s)<br>2.7 M rows · 98 MB  | **172 MiB** · 175 ms / 295 ms (cold 13.7 s)<br>2.7 M rows · 106 MB | **180 MiB** · 187 ms / 233 ms (cold 16.6 s)<br>2.7 M rows · 108 MB | **179 MiB** · 288 ms / 298 ms (cold 19.6 s)<br>2.8 M rows · 141 MB  | **529 MiB** · 1.55 s / 1.59 s (cold 29.8 s)<br>3.2 M rows · 326 MB  |
| P1 payload | 1d     | –                                                                  | –                                                                  | –                                                                  | –                                                                   | **33 MiB** · 22 ms / 22 ms (cold 505 ms)<br>9 k rows · 7 MB         |
| P1 payload | 7d     | –                                                                  | –                                                                  | –                                                                  | **31 MiB** · 37 ms / 313 ms (cold 365 ms)<br>24 k rows · 10 MB      | **33 MiB** · 22 ms / 22 ms (cold 708 ms)<br>9 k rows · 7 MB         |
| P1 payload | 30d    | –                                                                  | –                                                                  | **74 MiB** · 44 ms / 46 ms (cold 291 ms)<br>46 k rows · 31 MB      | **32 MiB** · 38 ms / 38 ms (cold 494 ms)<br>24 k rows · 10 MB       | **33 MiB** · 22 ms / 22 ms (cold 186 ms)<br>9 k rows · 7 MB         |
| P2         | 1d     | –                                                                  | **171 MiB** · 42 ms / 44 ms (cold 1.73 s)<br>106 k rows · 1 MB     | **180 MiB** · 155 ms / 215 ms (cold 13.2 s)<br>2.7 M rows · 96 MB  | **178 MiB** · 143 ms / 144 ms (cold 13.8 s)<br>2.7 M rows · 97 MB   | **187 MiB** · 308 ms / 355 ms (cold 18.3 s)<br>2.8 M rows · 108 MB  |
| P2         | 7d     | **167 MiB** · 233 ms / 243 ms (cold 14.4 s)<br>2.7 M rows · 96 MB  | **171 MiB** · 306 ms / 316 ms<br>2.7 M rows · 96 MB ✗timeout       | **183 MiB** · 234 ms / 325 ms (cold 14.3 s)<br>2.7 M rows · 98 MB  | **182 MiB** · 589 ms / 920 ms (cold 19.8 s)<br>2.7 M rows · 110 MB  | **302 MiB** · 625 ms / 702 ms (cold 21.9 s)<br>3.0 M rows · 205 MB  |
| P2         | 30d    | **167 MiB** · 148 ms / 165 ms (cold 15.0 s)<br>2.7 M rows · 98 MB  | **171 MiB** · 245 ms / 677 ms (cold 13.8 s)<br>2.7 M rows · 106 MB | –                                                                  | **176 MiB** · 278 ms / 385 ms (cold 18.7 s)<br>2.8 M rows · 141 MB  | **538 MiB** · 1.63 s / 4.99 s (cold 29.3 s)<br>3.2 M rows · 326 MB  |
| P2 payload | 1d     | –                                                                  | –                                                                  | –                                                                  | –                                                                   | **53 MiB** · 22 ms / 22 ms (cold 346 ms)<br>19 k rows · 8 MB        |
| P2 payload | 7d     | –                                                                  | –                                                                  | –                                                                  | –                                                                   | **53 MiB** · 24 ms / 24 ms (cold 368 ms)<br>19 k rows · 8 MB        |
| P2 payload | 30d    | –                                                                  | –                                                                  | –                                                                  | **32 MiB** · 20 ms / 21 ms (cold 162 ms)<br>5 k rows · 7 MB         | **49 MiB** · 23 ms / 24 ms (cold 642 ms)<br>19 k rows · 8 MB        |
| P3         | 1d     | –                                                                  | **185 MiB** · 50 ms / 52 ms (cold 3.10 s)<br>106 k rows · 1 MB     | **182 MiB** · 152 ms / 166 ms (cold 14.1 s)<br>2.7 M rows · 96 MB  | **182 MiB** · 155 ms / 161 ms (cold 15.1 s)<br>2.7 M rows · 97 MB   | **191 MiB** · 260 ms / 335 ms (cold 21.3 s)<br>2.8 M rows · 108 MB  |
| P3         | 7d     | **176 MiB** · 248 ms / 599 ms (cold 14.5 s)<br>2.7 M rows · 94 MB  | **180 MiB** · 345 ms / 356 ms (cold 19.1 s)<br>2.7 M rows · 96 MB  | **178 MiB** · 270 ms / 550 ms (cold 15.1 s)<br>2.7 M rows · 98 MB  | **187 MiB** · 252 ms / 312 ms (cold 17.3 s)<br>2.7 M rows · 110 MB  | **309 MiB** · 799 ms / 814 ms (cold 24.4 s)<br>3.0 M rows · 205 MB  |
| P3         | 30d    | **180 MiB** · 158 ms / 163 ms (cold 12.5 s)<br>2.7 M rows · 94 MB  | **189 MiB** · 198 ms / 707 ms (cold 14.6 s)<br>2.7 M rows · 102 MB | **186 MiB** · 254 ms / 321 ms (cold 22.0 s)<br>2.7 M rows · 108 MB | **178 MiB** · 284 ms / 302 ms (cold 20.2 s)<br>2.8 M rows · 141 MB  | **520 MiB** · 1.15 s / 1.18 s<br>3.2 M rows · 327 MB ✗timeout       |
| P3 payload | 1d     | –                                                                  | –                                                                  | **32 MiB** · 15 ms / 15 ms (cold 249 ms)<br>9 k rows · 5 MB        | **37 MiB** · 25 ms / 26 ms (cold 200 ms)<br>11 k rows · 5 MB        | **44 MiB** · 31 ms / 32 ms (cold 183 ms)<br>8 k rows · 14 MB        |
| P3 payload | 7d     | **36 MiB** · 11 ms / 12 ms (cold 172 ms)<br>12 k rows · 3 MB       | **37 MiB** · 11 ms / 12 ms (cold 411 ms)<br>25 k rows · 5 MB       | **32 MiB** · 14 ms / 15 ms (cold 191 ms)<br>9 k rows · 5 MB        | **36 MiB** · 25 ms / 211 ms (cold 196 ms)<br>11 k rows · 5 MB       | **44 MiB** · 31 ms / 31 ms (cold 183 ms)<br>8 k rows · 14 MB        |
| P3 payload | 30d    | **36 MiB** · 12 ms / 12 ms (cold 145 ms)<br>12 k rows · 3 MB       | **112 MiB** · 33 ms / 91 ms (cold 333 ms)<br>87 k rows · 37 MB     | **32 MiB** · 15 ms / 17 ms (cold 345 ms)<br>9 k rows · 5 MB        | **36 MiB** · 26 ms / 28 ms (cold 194 ms)<br>11 k rows · 5 MB        | **44 MiB** · 32 ms / 33 ms (cold 185 ms)<br>8 k rows · 14 MB        |
| G0         | 1d     | **166 MiB** · 111 ms / 152 ms (cold 6.61 s)<br>90 k rows · 923 kB  | **172 MiB** · 39 ms / 40 ms (cold 1.62 s)<br>106 k rows · 1 MB     | **177 MiB** · 135 ms / 141 ms (cold 12.8 s)<br>2.7 M rows · 95 MB  | **178 MiB** · 184 ms / 224 ms (cold 14.1 s)<br>2.7 M rows · 97 MB   | **180 MiB** · 239 ms / 241 ms (cold 18.2 s)<br>2.8 M rows · 104 MB  |
| G0         | 7d     | **170 MiB** · 164 ms / 226 ms (cold 14.2 s)<br>2.7 M rows · 95 MB  | **170 MiB** · 147 ms / 160 ms (cold 22.0 s)<br>2.7 M rows · 96 MB  | **175 MiB** · 272 ms / 400 ms (cold 13.6 s)<br>2.7 M rows · 97 MB  | **181 MiB** · 271 ms / 478 ms (cold 17.0 s)<br>2.7 M rows · 104 MB  | **187 MiB** · 535 ms / 564 ms (cold 19.4 s)<br>3.0 M rows · 163 MB  |
| G0         | 30d    | **166 MiB** · 141 ms / 153 ms (cold 13.6 s)<br>2.7 M rows · 98 MB  | **170 MiB** · 249 ms / 333 ms (cold 13.5 s)<br>2.7 M rows · 102 MB | **174 MiB** · 246 ms / 398 ms (cold 19.7 s)<br>2.7 M rows · 103 MB | **182 MiB** · 198 ms / 202 ms (cold 16.5 s)<br>2.8 M rows · 121 MB  | **279 MiB** · 878 ms / 899 ms (cold 22.9 s)<br>3.2 M rows · 237 MB  |
| D0         | 1d     | **33 MiB** · 11 ms / 12 ms (cold 135 ms)<br>228 k rows · 10 MB     | **32 MiB** · 12 ms / 25 ms (cold 97 ms)<br>234 k rows · 10 MB      | **32 MiB** · 12 ms / 16 ms (cold 540 ms)<br>239 k rows · 11 MB     | **28 MiB** · 13 ms / 17 ms (cold 137 ms)<br>241 k rows · 11 MB      | **31 MiB** · 14 ms / 19 ms (cold 181 ms)<br>246 k rows · 11 MB      |
| D0         | 7d     | **34 MiB** · 12 ms / 12 ms (cold 137 ms)<br>229 k rows · 10 MB     | **32 MiB** · 12 ms / 15 ms (cold 225 ms)<br>235 k rows · 10 MB     | **32 MiB** · 13 ms / 13 ms (cold 114 ms)<br>240 k rows · 11 MB     | **30 MiB** · 13 ms / 14 ms (cold 161 ms)<br>242 k rows · 11 MB      | **31 MiB** · 13 ms / 14 ms (cold 116 ms)<br>249 k rows · 11 MB      |
| D0         | 30d    | **38 MiB** · 11 ms / 21 ms (cold 196 ms)<br>231 k rows · 10 MB     | **32 MiB** · 11 ms / 12 ms (cold 171 ms)<br>237 k rows · 10 MB     | **37 MiB** · 12 ms / 13 ms (cold 150 ms)<br>244 k rows · 11 MB     | **31 MiB** · 14 ms / 18 ms (cold 114 ms)<br>245 k rows · 11 MB      | **31 MiB** · 13 ms / 13 ms (cold 128 ms)<br>251 k rows · 11 MB      |
| D1         | 1d     | **168 MiB** · 191 ms / 240 ms (cold 2.56 s)<br>319 k rows · 11 MB  | **171 MiB** · 106 ms / 129 ms (cold 2.31 s)<br>340 k rows · 12 MB  | **179 MiB** · 234 ms / 265 ms (cold 14.4 s)<br>3.0 M rows · 112 MB | **178 MiB** · 278 ms / 312 ms (cold 15.2 s)<br>3.0 M rows · 115 MB  | **1.44 GiB** · 1.13 s / 1.64 s (cold 17.3 s)<br>3.0 M rows · 641 MB |
| D1         | 7d     | **167 MiB** · 291 ms / 447 ms (cold 16.1 s)<br>2.9 M rows · 107 MB | **172 MiB** · 461 ms / 500 ms (cold 12.8 s)<br>3.0 M rows · 108 MB | **177 MiB** · 439 ms / 587 ms (cold 14.9 s)<br>3.0 M rows · 164 MB | **759 MiB** · 936 ms / 1.23 s (cold 17.2 s)<br>3.0 M rows · 520 MB  | ✗ memory                                                            |
| D1         | 30d    | **169 MiB** · 225 ms / 233 ms (cold 14.6 s)<br>2.9 M rows · 109 MB | **348 MiB** · 325 ms / 341 ms (cold 14.1 s)<br>3.0 M rows · 265 MB | **284 MiB** · 546 ms / 740 ms (cold 16.9 s)<br>3.0 M rows · 381 MB | **3.14 GiB** · 1.74 s / 1.74 s (cold 19.6 s)<br>3.0 M rows · 1.6 GB | –                                                                   |
| D2         | 1d     | **167 MiB** · 49 ms / 102 ms (cold 2.04 s)<br>104 k rows · 2 MB    | **171 MiB** · 48 ms / 50 ms (cold 1.60 s)<br>116 k rows · 2 MB     | **174 MiB** · 175 ms / 233 ms (cold 14.0 s)<br>2.7 M rows · 102 MB | **182 MiB** · 257 ms / 321 ms (cold 13.8 s)<br>2.7 M rows · 105 MB  | **1.35 GiB** · 971 ms / 975 ms (cold 17.1 s)<br>2.8 M rows · 630 MB |
| D2         | 7d     | **167 MiB** · 262 ms / 538 ms (cold 15.6 s)<br>2.7 M rows · 97 MB  | **171 MiB** · 177 ms / 384 ms (cold 12.5 s)<br>2.7 M rows · 98 MB  | **177 MiB** · 282 ms / 440 ms (cold 15.1 s)<br>2.7 M rows · 154 MB | **743 MiB** · 814 ms / 831 ms (cold 18.2 s)<br>2.8 M rows · 510 MB  | ✗ memory                                                            |
| D2         | 30d    | **168 MiB** · 173 ms / 193 ms (cold 13.5 s)<br>2.7 M rows · 99 MB  | **279 MiB** · 303 ms / 520 ms (cold 16.4 s)<br>2.7 M rows · 256 MB | **231 MiB** · 473 ms / 582 ms (cold 17.5 s)<br>2.7 M rows · 371 MB | **3.09 GiB** · 1.46 s / 1.46 s (cold 19.9 s)<br>2.8 M rows · 1.6 GB | –                                                                   |

### queryThreads()

| case | window | small                                                              | mid                                                                | p90                                                                | p99                                                                | largest                                                            |
| ---- | ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| TH0  | 1d     | **166 MiB** · 53 ms / 799 ms (cold 3.11 s)<br>90 k rows · 919 kB   | **180 MiB** · 42 ms / 73 ms (cold 1.83 s)<br>95 k rows · 1 MB      | **174 MiB** · 58 ms / 216 ms (cold 1.92 s)<br>111 k rows · 1 MB    | **175 MiB** · 149 ms / 160 ms (cold 12.1 s)<br>2.7 M rows · 98 MB  | **182 MiB** · 160 ms / 227 ms (cold 13.8 s)<br>2.8 M rows · 101 MB |
| TH0  | 7d     | **170 MiB** · 210 ms / 442 ms (cold 14.1 s)<br>2.7 M rows · 95 MB  | **179 MiB** · 162 ms / 406 ms (cold 13.2 s)<br>2.7 M rows · 96 MB  | **176 MiB** · 43 ms / 163 ms (cold 2.10 s)<br>111 k rows · 2 MB    | **179 MiB** · 234 ms / 368 ms (cold 15.3 s)<br>2.8 M rows · 107 MB | **189 MiB** · 344 ms / 483 ms (cold 18.1 s)<br>2.8 M rows · 125 MB |
| TH0  | 30d    | **167 MiB** · 137 ms / 260 ms (cold 13.7 s)<br>2.7 M rows · 98 MB  | **179 MiB** · 237 ms / 400 ms (cold 13.7 s)<br>2.7 M rows · 101 MB | **174 MiB** · 151 ms / 211 ms (cold 14.4 s)<br>2.7 M rows · 103 MB | **181 MiB** · 196 ms / 369 ms (cold 16.5 s)<br>2.8 M rows · 126 MB | **299 MiB** · 571 ms / 852 ms (cold 20.0 s)<br>3.1 M rows · 208 MB |
| TH1  | 1d     | **168 MiB** · 50 ms / 167 ms (cold 2.20 s)<br>90 k rows · 921 kB   | **170 MiB** · 59 ms / 179 ms (cold 1.64 s)<br>106 k rows · 1 MB    | **175 MiB** · 204 ms / 324 ms (cold 12.8 s)<br>2.7 M rows · 95 MB  | **180 MiB** · 143 ms / 154 ms (cold 12.8 s)<br>2.7 M rows · 97 MB  | **183 MiB** · 178 ms / 412 ms (cold 15.6 s)<br>2.8 M rows · 104 MB |
| TH1  | 7d     | **167 MiB** · 172 ms / 451 ms (cold 14.0 s)<br>2.7 M rows · 95 MB  | **170 MiB** · 303 ms / 449 ms (cold 12.6 s)<br>2.7 M rows · 96 MB  | **174 MiB** · 161 ms / 209 ms (cold 17.1 s)<br>2.7 M rows · 97 MB  | **190 MiB** · 192 ms / 275 ms (cold 15.8 s)<br>2.7 M rows · 104 MB | **191 MiB** · 498 ms / 609 ms (cold 21.1 s)<br>3.0 M rows · 163 MB |
| TH1  | 30d    | **166 MiB** · 145 ms / 157 ms (cold 13.9 s)<br>2.7 M rows · 98 MB  | **170 MiB** · 231 ms / 437 ms (cold 12.6 s)<br>2.7 M rows · 102 MB | **178 MiB** · 163 ms / 220 ms (cold 14.7 s)<br>2.7 M rows · 103 MB | **180 MiB** · 318 ms / 356 ms (cold 18.5 s)<br>2.8 M rows · 121 MB | **300 MiB** · 776 ms / 803 ms (cold 24.9 s)<br>3.2 M rows · 237 MB |
| TH2  | 1d     | **176 MiB** · 79 ms / 224 ms (cold 3.78 s)<br>180 k rows · 2 MB    | **172 MiB** · 123 ms / 503 ms (cold 3.46 s)<br>212 k rows · 2 MB   | **182 MiB** · 446 ms / 542 ms (cold 26.2 s)<br>5.4 M rows · 191 MB | **183 MiB** · 432 ms / 496 ms (cold 25.9 s)<br>5.5 M rows · 193 MB | **197 MiB** · 440 ms / 543 ms (cold 29.9 s)<br>5.5 M rows · 208 MB |
| TH2  | 7d     | **168 MiB** · 439 ms / 461 ms (cold 26.2 s)<br>5.4 M rows · 191 MB | **172 MiB** · 627 ms / 681 ms (cold 24.9 s)<br>5.4 M rows · 191 MB | **186 MiB** · 328 ms / 340 ms (cold 25.1 s)<br>5.4 M rows · 194 MB | **188 MiB** · 533 ms / 1.95 s (cold 29.4 s)<br>5.5 M rows · 208 MB | **282 MiB** · 691 ms / 766 ms<br>5.9 M rows · 331 MB ✗timeout      |
| TH2  | 30d    | **167 MiB** · 282 ms / 332 ms (cold 25.9 s)<br>5.4 M rows · 195 MB | **179 MiB** · 447 ms / 1.11 s (cold 25.0 s)<br>5.4 M rows · 205 MB | **185 MiB** · 355 ms / 364 ms (cold 27.9 s)<br>5.4 M rows · 208 MB | **190 MiB** · 700 ms / 931 ms<br>5.6 M rows · 246 MB ✗timeout      | **408 MiB** · 1.03 s / 1.04 s<br>6.4 M rows · 483 MB ✗timeout      |
| TH3  | 1d     | **168 MiB** · 125 ms / 184 ms (cold 3.66 s)<br>180 k rows · 2 MB   | **173 MiB** · 137 ms / 193 ms (cold 8.79 s)<br>212 k rows · 2 MB   | **176 MiB** · 466 ms / 566 ms (cold 28.5 s)<br>5.5 M rows · 193 MB | **185 MiB** · 630 ms / 633 ms (cold 29.6 s)<br>5.8 M rows · 206 MB | **188 MiB** · 660 ms / 836 ms<br>8.5 M rows · 355 MB ✗timeout      |
| TH3  | 7d     | **169 MiB** · 348 ms / 568 ms (cold 17.9 s)<br>2.8 M rows · 99 MB  | **183 MiB** · 437 ms / 494 ms (cold 16.8 s)<br>2.9 M rows · 99 MB  | **179 MiB** · 559 ms / 648 ms (cold 28.4 s)<br>5.5 M rows · 196 MB | **179 MiB** · 482 ms / 509 ms<br>6.5 M rows · 266 MB ✗timeout      | **366 MiB** · 1.65 s / 1.95 s<br>8.9 M rows · 646 MB ✗timeout      |
| TH3  | 30d    | **168 MiB** · 262 ms / 464 ms (cold 23.1 s)<br>2.8 M rows · 103 MB | **173 MiB** · 269 ms / 302 ms (cold 16.4 s)<br>2.9 M rows · 111 MB | **177 MiB** · 487 ms / 808 ms<br>5.5 M rows · 209 MB ✗timeout      | **190 MiB** · 851 ms / 886 ms<br>6.5 M rows · 357 MB ✗timeout      | **550 MiB** · 1.55 s / 1.76 s<br>9.4 M rows · 984 MB ✗timeout      |
| TH4  | 1d     | **170 MiB** · 143 ms / 309 ms (cold 5.22 s)<br>270 k rows · 3 MB   | **174 MiB** · 173 ms / 380 ms (cold 4.46 s)<br>318 k rows · 3 MB   | **176 MiB** · 557 ms / 733 ms (cold 26.6 s)<br>5.5 M rows · 192 MB | **177 MiB** · 664 ms / 744 ms<br>8.2 M rows · 290 MB ✗timeout      | **192 MiB** · 721 ms / 724 ms<br>8.3 M rows · 312 MB ✗timeout      |
| TH4  | 7d     | **169 MiB** · 456 ms / 544 ms (cold 27.7 s)<br>5.5 M rows · 192 MB | **173 MiB** · 810 ms / 903 ms<br>5.5 M rows · 193 MB ✗timeout      | **176 MiB** · 347 ms / 428 ms (cold 26.2 s)<br>5.5 M rows · 196 MB | **183 MiB** · 565 ms / 634 ms<br>8.2 M rows · 311 MB ✗timeout      | **365 MiB** · 1.01 s / 1.04 s<br>8.9 M rows · 494 MB ✗timeout      |
| TH4  | 30d    | **169 MiB** · 384 ms / 422 ms (cold 27.2 s)<br>5.5 M rows · 199 MB | **173 MiB** · 632 ms / 944 ms (cold 26.7 s)<br>5.5 M rows · 211 MB | **177 MiB** · 417 ms / 454 ms<br>5.5 M rows · 213 MB ✗timeout      | **202 MiB** · 950 ms / 989 ms<br>8.3 M rows · 367 MB ✗timeout      | **538 MiB** · 2.35 s / 2.36 s<br>9.6 M rows · 721 MB ✗timeout      |
| TH5  | 1d     | **168 MiB** · 40 ms / 42 ms (cold 1.65 s)<br>90 k rows · 922 kB    | **170 MiB** · 49 ms / 146 ms (cold 1.64 s)<br>106 k rows · 1 MB    | **174 MiB** · 272 ms / 1.53 s (cold 12.1 s)<br>2.7 M rows · 95 MB  | **175 MiB** · 210 ms / 217 ms (cold 15.6 s)<br>2.7 M rows · 97 MB  | **191 MiB** · 227 ms / 229 ms (cold 14.5 s)<br>2.8 M rows · 104 MB |
| TH5  | 7d     | **167 MiB** · 171 ms / 203 ms (cold 13.6 s)<br>2.7 M rows · 95 MB  | **171 MiB** · 325 ms / 407 ms (cold 12.3 s)<br>2.7 M rows · 96 MB  | **174 MiB** · 141 ms / 158 ms (cold 12.4 s)<br>2.7 M rows · 97 MB  | **178 MiB** · 218 ms / 287 ms (cold 15.2 s)<br>2.7 M rows · 103 MB | **188 MiB** · 312 ms / 382 ms (cold 17.9 s)<br>3.0 M rows · 163 MB |
| TH5  | 30d    | **166 MiB** · 139 ms / 189 ms (cold 14.0 s)<br>2.7 M rows · 98 MB  | **175 MiB** · 225 ms / 269 ms (cold 19.6 s)<br>2.7 M rows · 102 MB | **178 MiB** · 150 ms / 217 ms (cold 14.2 s)<br>2.7 M rows · 103 MB | **179 MiB** · 356 ms / 394 ms (cold 18.5 s)<br>2.8 M rows · 121 MB | **298 MiB** · 684 ms / 766 ms (cold 23.1 s)<br>3.2 M rows · 237 MB |
| TH6  | 1d     | –                                                                  | –                                                                  | –                                                                  | –                                                                  | **186 MiB** · 160 ms / 169 ms (cold 14.5 s)<br>2.8 M rows · 104 MB |
| TH6  | 7d     | –                                                                  | –                                                                  | –                                                                  | –                                                                  | **183 MiB** · 332 ms / 351 ms (cold 18.2 s)<br>3.0 M rows · 163 MB |
| TH6  | 30d    | –                                                                  | –                                                                  | –                                                                  | **174 MiB** · 333 ms / 340 ms (cold 17.1 s)<br>2.8 M rows · 121 MB | **302 MiB** · 627 ms / 772 ms (cold 23.5 s)<br>3.2 M rows · 237 MB |

### querySpans()

| case            | window | small                                                              | mid                                                               | p90                                                                | p99                                                                 | largest                                                             |
| --------------- | ------ | ------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------- |
| S0              | 1d     | **114 MiB** · 73 ms / 125 ms (cold 1.59 s)<br>9 k rows · 1 MB      | **134 MiB** · 18 ms / 194 ms (cold 199 ms)<br>7 k rows · 1 MB     | **114 MiB** · 20 ms / 116 ms (cold 498 ms)<br>5 k rows · 831 kB    | **126 MiB** · 96 ms / 383 ms (cold 2.11 s)<br>247 k rows · 40 MB    | **152 MiB** · 262 ms / 540 ms (cold 3.61 s)<br>271 k rows · 44 MB   |
| S0              | 7d     | **135 MiB** · 107 ms / 590 ms (cold 4.11 s)<br>34 k rows · 6 MB    | **129 MiB** · 66 ms / 252 ms (cold 3.17 s)<br>37 k rows · 6 MB    | **127 MiB** · 77 ms / 205 ms (cold 2.92 s)<br>20 k rows · 3 MB     | **199 MiB** · 458 ms / 964 ms (cold 5.50 s)<br>571 k rows · 96 MB   | **493 MiB** · 416 ms / 1.57 s (cold 5.92 s)<br>675 k rows · 118 MB  |
| S0              | 30d    | **77 MiB** · 211 ms / 1.19 s (cold 10.4 s)<br>78 k rows · 15 MB    | **76 MiB** · 178 ms / 372 ms (cold 9.28 s)<br>98 k rows · 18 MB   | **71 MiB** · 343 ms / 849 ms (cold 12.9 s)<br>104 k rows · 20 MB   | **551 MiB** · 1.25 s / 2.49 s (cold 15.0 s)<br>1.3 M rows · 240 MB  | **1.16 GiB** · 1.55 s / 4.06 s (cold 16.6 s)<br>2.2 M rows · 429 MB |
| S0 span-payload | 1d     | **31 MiB** · 20 ms / 21 ms (cold 161 ms)<br>236 rows · 7 MB        | –                                                                 | **43 MiB** · 25 ms / 28 ms (cold 243 ms)<br>472 rows · 12 MB       | **83 MiB** · 49 ms / 910 ms (cold 493 ms)<br>2 k rows · 32 MB       | **168 MiB** · 79 ms / 1.02 s (cold 599 ms)<br>4 k rows · 130 MB     |
| S0 span-payload | 7d     | **43 MiB** · 20 ms / 260 ms (cold 226 ms)<br>265 rows · 9 MB       | **34 MiB** · 20 ms / 144 ms (cold 262 ms)<br>657 rows · 15 MB     | **43 MiB** · 28 ms / 30 ms (cold 138 ms)<br>472 rows · 12 MB       | **84 MiB** · 47 ms / 69 ms (cold 464 ms)<br>2 k rows · 32 MB        | **164 MiB** · 54 ms / 85 ms (cold 304 ms)<br>4 k rows · 130 MB      |
| S0 span-payload | 30d    | **67 MiB** · 20 ms / 88 ms (cold 289 ms)<br>265 rows · 9 MB        | **81 MiB** · 27 ms / 495 ms (cold 397 ms)<br>2 k rows · 17 MB     | **66 MiB** · 20 ms / 47 ms (cold 228 ms)<br>732 rows · 12 MB       | **87 MiB** · 39 ms / 68 ms (cold 353 ms)<br>2 k rows · 32 MB        | **164 MiB** · 51 ms / 117 ms (cold 284 ms)<br>4 k rows · 130 MB     |
| S0 span-metrics | 1d     | **234 MiB** · 60 ms / 706 ms (cold 3.39 s)<br>701 k rows · 101 MB  | –                                                                 | **236 MiB** · 80 ms / 123 ms (cold 3.01 s)<br>749 k rows · 108 MB  | **236 MiB** · 304 ms / 5.21 s (cold 5.58 s)<br>2.2 M rows · 316 MB  | **251 MiB** · 529 ms / 1.34 s (cold 6.03 s)<br>2.3 M rows · 339 MB  |
| S0 span-metrics | 7d     | **236 MiB** · 71 ms / 176 ms (cold 4.49 s)<br>700 k rows · 101 MB  | **233 MiB** · 60 ms / 129 ms (cold 6.72 s)<br>631 k rows · 90 MB  | **236 MiB** · 79 ms / 117 ms (cold 3.96 s)<br>748 k rows · 108 MB  | **237 MiB** · 219 ms / 1.07 s (cold 5.58 s)<br>2.2 M rows · 317 MB  | **250 MiB** · 169 ms / 513 ms (cold 5.61 s)<br>2.3 M rows · 340 MB  |
| S0 span-metrics | 30d    | **236 MiB** · 61 ms / 102 ms (cold 3.88 s)<br>705 k rows · 103 MB  | **247 MiB** · 66 ms / 766 ms (cold 2.66 s)<br>775 k rows · 112 MB | **237 MiB** · 117 ms / 304 ms (cold 4.74 s)<br>745 k rows · 108 MB | **243 MiB** · 139 ms / 435 ms (cold 4.38 s)<br>2.3 M rows · 317 MB  | **251 MiB** · 257 ms / 745 ms (cold 5.51 s)<br>2.3 M rows · 340 MB  |
| S1              | 1d     | –                                                                  | **136 MiB** · 17 ms / 18 ms (cold 426 ms)<br>6 k rows · 1 MB      | **103 MiB** · 30 ms / 30 ms (cold 1.05 s)<br>10 k rows · 2 MB      | **107 MiB** · 64 ms / 402 ms (cold 2.83 s)<br>199 k rows · 32 MB    | **149 MiB** · 420 ms / 443 ms (cold 5.57 s)<br>1.4 M rows · 228 MB  |
| S1              | 7d     | **135 MiB** · 123 ms / 263 ms (cold 6.54 s)<br>40 k rows · 7 MB    | **120 MiB** · 87 ms / 209 ms (cold 3.99 s)<br>36 k rows · 6 MB    | **125 MiB** · 124 ms / 204 ms (cold 5.46 s)<br>42 k rows · 7 MB    | **157 MiB** · 373 ms / 1.23 s (cold 9.46 s)<br>550 k rows · 96 MB   | **501 MiB** · 1.53 s / 1.53 s (cold 7.51 s)<br>3.5 M rows · 613 MB  |
| S1              | 30d    | **77 MiB** · 256 ms / 1.44 s (cold 12.8 s)<br>90 k rows · 17 MB    | **64 MiB** · 218 ms / 284 ms (cold 10.5 s)<br>98 k rows · 19 MB   | –                                                                  | **277 MiB** · 685 ms / 2.28 s (cold 14.4 s)<br>1.3 M rows · 240 MB  | **1.15 GiB** · 4.46 s / 5.29 s (cold 23.8 s)<br>6.0 M rows · 1.1 GB |
| S1 span-payload | 1d     | –                                                                  | –                                                                 | –                                                                  | **189 MiB** · 186 ms / 315 ms (cold 397 ms)<br>6 k rows · 273 MB    | **199 MiB** · 191 ms / 1.46 s (cold 1.52 s)<br>45 k rows · 452 MB   |
| S1 span-payload | 7d     | **16 MiB** · 13 ms / 205 ms (cold 159 ms)<br>265 rows · 1 MB       | **30 MiB** · 19 ms / 22 ms (cold 85 ms)<br>219 rows · 8 MB        | –                                                                  | **204 MiB** · 105 ms / 109 ms (cold 712 ms)<br>6 k rows · 273 MB    | **201 MiB** · 103 ms / 137 ms (cold 718 ms)<br>45 k rows · 452 MB   |
| S1 span-payload | 30d    | **16 MiB** · 12 ms / 13 ms (cold 74 ms)<br>265 rows · 1 MB         | **99 MiB** · 29 ms / 113 ms (cold 370 ms)<br>2 k rows · 26 MB     | –                                                                  | **188 MiB** · 81 ms / 84 ms (cold 240 ms)<br>6 k rows · 273 MB      | **204 MiB** · 175 ms / 224 ms (cold 1.01 s)<br>45 k rows · 452 MB   |
| S1 span-metrics | 1d     | –                                                                  | –                                                                 | –                                                                  | **239 MiB** · 174 ms / 201 ms (cold 3.77 s)<br>2.2 M rows · 316 MB  | **243 MiB** · 614 ms / 647 ms (cold 7.71 s)<br>7.3 M rows · 925 MB  |
| S1 span-metrics | 7d     | **229 MiB** · 63 ms / 92 ms (cold 2.70 s)<br>708 k rows · 102 MB   | **232 MiB** · 62 ms / 119 ms (cold 3.36 s)<br>775 k rows · 110 MB | –                                                                  | **239 MiB** · 246 ms / 291 ms (cold 5.67 s)<br>2.2 M rows · 317 MB  | **243 MiB** · 448 ms / 450 ms (cold 5.23 s)<br>7.3 M rows · 925 MB  |
| S1 span-metrics | 30d    | **233 MiB** · 59 ms / 60 ms (cold 2.27 s)<br>713 k rows · 103 MB   | **236 MiB** · 70 ms / 90 ms (cold 2.43 s)<br>775 k rows · 113 MB  | –                                                                  | **239 MiB** · 166 ms / 168 ms (cold 3.36 s)<br>2.3 M rows · 317 MB  | **243 MiB** · 636 ms / 680 ms (cold 7.71 s)<br>7.3 M rows · 926 MB  |
| S2              | 1d     | –                                                                  | **138 MiB** · 17 ms / 162 ms (cold 135 ms)<br>6 k rows · 1 MB     | **115 MiB** · 30 ms / 61 ms (cold 922 ms)<br>10 k rows · 2 MB      | **107 MiB** · 97 ms / 178 ms (cold 2.10 s)<br>199 k rows · 34 MB    | **143 MiB** · 385 ms / 495 ms (cold 4.32 s)<br>1.4 M rows · 246 MB  |
| S2              | 7d     | **135 MiB** · 231 ms / 325 ms (cold 5.35 s)<br>38 k rows · 7 MB    | **120 MiB** · 66 ms / 97 ms (cold 2.86 s)<br>36 k rows · 7 MB     | **123 MiB** · 147 ms / 226 ms (cold 3.91 s)<br>42 k rows · 8 MB    | **155 MiB** · 314 ms / 501 ms (cold 5.43 s)<br>550 k rows · 104 MB  | **542 MiB** · 1.48 s / 1.48 s (cold 6.15 s)<br>3.5 M rows · 659 MB  |
| S2              | 30d    | **77 MiB** · 221 ms / 291 ms (cold 9.91 s)<br>88 k rows · 18 MB    | **66 MiB** · 183 ms / 199 ms (cold 8.88 s)<br>99 k rows · 20 MB   | **68 MiB** · 334 ms / 541 ms (cold 15.5 s)<br>101 k rows · 20 MB   | **300 MiB** · 649 ms / 1.29 s (cold 10.6 s)<br>1.3 M rows · 258 MB  | **1.24 GiB** · 4.09 s / 4.88 s (cold 17.8 s)<br>6.0 M rows · 1.2 GB |
| S2 span-payload | 1d     | –                                                                  | –                                                                 | **43 MiB** · 24 ms / 26 ms (cold 84 ms)<br>472 rows · 12 MB        | **135 MiB** · 61 ms / 138 ms (cold 432 ms)<br>4 k rows · 96 MB      | **145 MiB** · 70 ms / 134 ms (cold 747 ms)<br>25 k rows · 145 MB    |
| S2 span-payload | 7d     | –                                                                  | –                                                                 | **43 MiB** · 28 ms / 37 ms (cold 110 ms)<br>472 rows · 12 MB       | **223 MiB** · 197 ms / 496 ms (cold 1.46 s)<br>9 k rows · 255 MB    | **138 MiB** · 69 ms / 69 ms (cold 776 ms)<br>25 k rows · 145 MB     |
| S2 span-payload | 30d    | –                                                                  | –                                                                 | **43 MiB** · 20 ms / 27 ms (cold 104 ms)<br>472 rows · 12 MB       | **213 MiB** · 73 ms / 99 ms (cold 709 ms)<br>9 k rows · 255 MB      | **142 MiB** · 78 ms / 97 ms (cold 924 ms)<br>25 k rows · 145 MB     |
| S2 span-metrics | 1d     | –                                                                  | –                                                                 | **235 MiB** · 63 ms / 121 ms (cold 2.57 s)<br>749 k rows · 108 MB  | **233 MiB** · 151 ms / 164 ms (cold 3.43 s)<br>2.2 M rows · 315 MB  | **243 MiB** · 442 ms / 484 ms (cold 5.18 s)<br>7.3 M rows · 916 MB  |
| S2 span-metrics | 7d     | –                                                                  | –                                                                 | **235 MiB** · 64 ms / 110 ms (cold 2.77 s)<br>749 k rows · 108 MB  | **243 MiB** · 161 ms / 191 ms (cold 4.46 s)<br>2.2 M rows · 315 MB  | **243 MiB** · 430 ms / 434 ms (cold 5.23 s)<br>7.3 M rows · 916 MB  |
| S2 span-metrics | 30d    | –                                                                  | –                                                                 | **235 MiB** · 63 ms / 97 ms (cold 4.77 s)<br>751 k rows · 108 MB   | **239 MiB** · 161 ms / 161 ms (cold 3.35 s)<br>2.3 M rows · 316 MB  | **244 MiB** · 720 ms / 772 ms (cold 7.53 s)<br>7.3 M rows · 917 MB  |
| S3              | 1d     | –                                                                  | **130 MiB** · 17 ms / 54 ms (cold 89 ms)<br>6 k rows · 1 MB       | **112 MiB** · 30 ms / 185 ms (cold 1.34 s)<br>10 k rows · 2 MB     | **107 MiB** · 67 ms / 246 ms (cold 2.27 s)<br>199 k rows · 32 MB    | **149 MiB** · 323 ms / 1.60 s (cold 3.32 s)<br>1.4 M rows · 227 MB  |
| S3              | 7d     | **130 MiB** · 65 ms / 1.22 s (cold 4.58 s)<br>34 k rows · 6 MB     | **120 MiB** · 112 ms / 396 ms (cold 3.60 s)<br>37 k rows · 6 MB   | **124 MiB** · 148 ms / 179 ms (cold 4.00 s)<br>38 k rows · 7 MB    | **154 MiB** · 226 ms / 832 ms (cold 7.32 s)<br>550 k rows · 96 MB   | **498 MiB** · 1.40 s / 1.47 s (cold 6.52 s)<br>3.5 M rows · 613 MB  |
| S3              | 30d    | **77 MiB** · 289 ms / 1.02 s (cold 11.5 s)<br>89 k rows · 17 MB    | **72 MiB** · 175 ms / 225 ms (cold 10.1 s)<br>98 k rows · 19 MB   | **78 MiB** · 329 ms / 569 ms (cold 15.2 s)<br>91 k rows · 17 MB    | **246 MiB** · 755 ms / 1.40 s (cold 12.8 s)<br>1.3 M rows · 240 MB  | **1.15 GiB** · 3.54 s / 3.85 s (cold 19.7 s)<br>6.0 M rows · 1.1 GB |
| S3 span-payload | 1d     | –                                                                  | –                                                                 | **42 MiB** · 21 ms / 24 ms (cold 121 ms)<br>472 rows · 12 MB       | **160 MiB** · 94 ms / 95 ms (cold 260 ms)<br>5 k rows · 197 MB      | **152 MiB** · 74 ms / 154 ms (cold 797 ms)<br>35 k rows · 214 MB    |
| S3 span-payload | 7d     | –                                                                  | –                                                                 | **111 MiB** · 49 ms / 108 ms (cold 273 ms)<br>2 k rows · 48 MB     | **271 MiB** · 115 ms / 188 ms (cold 659 ms)<br>12 k rows · 408 MB   | **149 MiB** · 79 ms / 80 ms (cold 929 ms)<br>35 k rows · 214 MB     |
| S3 span-payload | 30d    | –                                                                  | **34 MiB** · 18 ms / 86 ms (cold 336 ms)<br>1 k rows · 8 MB       | **190 MiB** · 168 ms / 201 ms (cold 1.24 s)<br>8 k rows · 167 MB   | **256 MiB** · 145 ms / 206 ms (cold 916 ms)<br>12 k rows · 408 MB   | **142 MiB** · 78 ms / 84 ms (cold 755 ms)<br>35 k rows · 214 MB     |
| S3 span-metrics | 1d     | –                                                                  | –                                                                 | **233 MiB** · 89 ms / 229 ms (cold 4.04 s)<br>750 k rows · 108 MB  | **239 MiB** · 145 ms / 170 ms (cold 3.56 s)<br>2.2 M rows · 315 MB  | **244 MiB** · 428 ms / 467 ms (cold 5.28 s)<br>7.3 M rows · 916 MB  |
| S3 span-metrics | 7d     | –                                                                  | –                                                                 | **233 MiB** · 82 ms / 133 ms (cold 3.35 s)<br>750 k rows · 108 MB  | **243 MiB** · 144 ms / 315 ms (cold 3.63 s)<br>2.2 M rows · 315 MB  | **243 MiB** · 436 ms / 445 ms (cold 5.46 s)<br>7.3 M rows · 916 MB  |
| S3 span-metrics | 30d    | –                                                                  | **233 MiB** · 58 ms / 61 ms (cold 2.48 s)<br>777 k rows · 110 MB  | **234 MiB** · 80 ms / 127 ms (cold 4.63 s)<br>746 k rows · 108 MB  | **239 MiB** · 210 ms / 220 ms (cold 5.58 s)<br>2.3 M rows · 316 MB  | **244 MiB** · 427 ms / 486 ms (cold 7.14 s)<br>7.3 M rows · 917 MB  |
| S4              | 1d     | –                                                                  | **83 MiB** · 16 ms / 18 ms (cold 369 ms)<br>4 k rows · 628 kB     | –                                                                  | **107 MiB** · 114 ms / 540 ms (cold 2.05 s)<br>199 k rows · 165 MB  | **526 MiB** · 877 ms / 1.17 s (cold 4.07 s)<br>1.4 M rows · 1.2 GB  |
| S4              | 7d     | **131 MiB** · 87 ms / 413 ms (cold 4.45 s)<br>34 k rows · 39 MB    | **125 MiB** · 146 ms / 222 ms (cold 4.06 s)<br>37 k rows · 41 MB  | –                                                                  | **784 MiB** · 891 ms / 1.35 s (cold 6.28 s)<br>550 k rows · 711 MB  | **2.51 GiB** · 4.31 s / 4.38 s (cold 9.47 s)<br>3.5 M rows · 3.3 GB |
| S4              | 30d    | **213 MiB** · 410 ms / 1.53 s (cold 9.99 s)<br>89 k rows · 111 MB  | **182 MiB** · 265 ms / 540 ms (cold 8.66 s)<br>98 k rows · 111 MB | –                                                                  | **1.86 GiB** · 3.31 s / 5.41 s (cold 17.8 s)<br>1.3 M rows · 1.8 GB | ✗ memory                                                            |
| S4 span-payload | 1d     | –                                                                  | –                                                                 | –                                                                  | –                                                                   | **179 MiB** · 165 ms / 223 ms (cold 780 ms)<br>33 k rows · 255 MB   |
| S4 span-payload | 7d     | **16 MiB** · 13 ms / 15 ms (cold 520 ms)<br>265 rows · 1 MB        | **30 MiB** · 18 ms / 19 ms (cold 118 ms)<br>219 rows · 8 MB       | –                                                                  | **35 MiB** · 59 ms / 220 ms (cold 672 ms)<br>2 k rows · 93 MB       | **135 MiB** · 83 ms / 83 ms (cold 790 ms)<br>33 k rows · 255 MB     |
| S4 span-payload | 30d    | **16 MiB** · 13 ms / 14 ms (cold 92 ms)<br>265 rows · 1 MB         | **92 MiB** · 32 ms / 100 ms (cold 603 ms)<br>3 k rows · 27 MB     | –                                                                  | **35 MiB** · 67 ms / 67 ms (cold 329 ms)<br>2 k rows · 93 MB        | –                                                                   |
| S4 span-metrics | 1d     | –                                                                  | –                                                                 | –                                                                  | –                                                                   | **244 MiB** · 598 ms / 602 ms (cold 6.56 s)<br>7.3 M rows · 922 MB  |
| S4 span-metrics | 7d     | **229 MiB** · 102 ms / 1.02 s (cold 3.63 s)<br>709 k rows · 102 MB | **233 MiB** · 64 ms / 121 ms (cold 4.60 s)<br>776 k rows · 111 MB | –                                                                  | **242 MiB** · 156 ms / 210 ms (cold 4.15 s)<br>2.3 M rows · 317 MB  | **243 MiB** · 418 ms / 430 ms (cold 5.46 s)<br>7.3 M rows · 923 MB  |
| S4 span-metrics | 30d    | **233 MiB** · 119 ms / 429 ms (cold 3.52 s)<br>713 k rows · 103 MB | **235 MiB** · 66 ms / 113 ms (cold 2.60 s)<br>777 k rows · 113 MB | –                                                                  | **242 MiB** · 231 ms / 248 ms (cold 6.23 s)<br>2.3 M rows · 318 MB  | –                                                                   |
| S5              | 1d     | –                                                                  | **83 MiB** · 16 ms / 18 ms (cold 137 ms)<br>4 k rows · 644 kB     | **112 MiB** · 29 ms / 30 ms (cold 755 ms)<br>10 k rows · 2 MB      | **107 MiB** · 57 ms / 57 ms (cold 1.62 s)<br>199 k rows · 32 MB     | **145 MiB** · 409 ms / 594 ms (cold 2.89 s)<br>1.4 M rows · 227 MB  |
| S5              | 7d     | **127 MiB** · 81 ms / 147 ms (cold 3.23 s)<br>34 k rows · 6 MB     | **121 MiB** · 117 ms / 140 ms (cold 2.86 s)<br>37 k rows · 6 MB   | **124 MiB** · 119 ms / 124 ms (cold 3.20 s)<br>38 k rows · 7 MB    | **154 MiB** · 220 ms / 243 ms (cold 4.17 s)<br>550 k rows · 96 MB   | **501 MiB** · 1.43 s / 1.52 s (cold 5.90 s)<br>3.5 M rows · 611 MB  |
| S5              | 30d    | **74 MiB** · 442 ms / 1.00 s (cold 9.84 s)<br>90 k rows · 17 MB    | **68 MiB** · 205 ms / 242 ms (cold 8.05 s)<br>98 k rows · 19 MB   | **66 MiB** · 261 ms / 455 ms (cold 11.0 s)<br>92 k rows · 17 MB    | **262 MiB** · 975 ms / 1.04 s (cold 13.5 s)<br>1.3 M rows · 239 MB  | **1.14 GiB** · 3.24 s / 3.44 s (cold 14.0 s)<br>6.0 M rows · 1.1 GB |
| S5 span-payload | 1d     | –                                                                  | –                                                                 | **42 MiB** · 16 ms / 19 ms (cold 87 ms)<br>472 rows · 12 MB        | **113 MiB** · 46 ms / 47 ms (cold 246 ms)<br>3 k rows · 47 MB       | **146 MiB** · 63 ms / 121 ms (cold 823 ms)<br>21 k rows · 114 MB    |
| S5 span-payload | 7d     | –                                                                  | **30 MiB** · 15 ms / 19 ms (cold 118 ms)<br>219 rows · 8 MB       | **85 MiB** · 32 ms / 103 ms (cold 358 ms)<br>1 k rows · 28 MB      | **113 MiB** · 44 ms / 44 ms (cold 422 ms)<br>3 k rows · 47 MB       | **121 MiB** · 64 ms / 67 ms (cold 818 ms)<br>21 k rows · 114 MB     |
| S5 span-payload | 30d    | –                                                                  | **72 MiB** · 28 ms / 30 ms (cold 219 ms)<br>2 k rows · 17 MB      | **84 MiB** · 31 ms / 32 ms (cold 301 ms)<br>2 k rows · 30 MB       | **113 MiB** · 45 ms / 45 ms (cold 403 ms)<br>3 k rows · 47 MB       | **126 MiB** · 62 ms / 62 ms (cold 689 ms)<br>21 k rows · 114 MB     |
| S5 span-metrics | 1d     | –                                                                  | –                                                                 | **233 MiB** · 92 ms / 106 ms (cold 2.97 s)<br>750 k rows · 108 MB  | **239 MiB** · 156 ms / 167 ms (cold 3.66 s)<br>2.2 M rows · 316 MB  | **243 MiB** · 728 ms / 742 ms (cold 7.68 s)<br>7.3 M rows · 924 MB  |
| S5 span-metrics | 7d     | –                                                                  | **233 MiB** · 83 ms / 95 ms (cold 3.87 s)<br>776 k rows · 111 MB  | **233 MiB** · 101 ms / 116 ms (cold 3.97 s)<br>750 k rows · 108 MB | **239 MiB** · 163 ms / 172 ms (cold 3.51 s)<br>2.2 M rows · 317 MB  | **243 MiB** · 442 ms / 469 ms (cold 5.36 s)<br>7.3 M rows · 925 MB  |
| S5 span-metrics | 30d    | –                                                                  | **236 MiB** · 65 ms / 68 ms (cold 2.68 s)<br>778 k rows · 113 MB  | **233 MiB** · 120 ms / 226 ms (cold 4.65 s)<br>749 k rows · 108 MB | **239 MiB** · 308 ms / 333 ms (cold 5.67 s)<br>2.3 M rows · 317 MB  | **243 MiB** · 436 ms / 460 ms (cold 5.19 s)<br>7.3 M rows · 926 MB  |
| S6              | 1d     | –                                                                  | **90 MiB** · 16 ms / 16 ms (cold 195 ms)<br>4 k rows · 677 kB     | **128 MiB** · 35 ms / 59 ms (cold 857 ms)<br>10 k rows · 2 MB      | **106 MiB** · 55 ms / 58 ms (cold 1.67 s)<br>199 k rows · 32 MB     | **148 MiB** · 358 ms / 376 ms (cold 3.02 s)<br>1.4 M rows · 227 MB  |
| S6              | 7d     | **126 MiB** · 82 ms / 2.12 s (cold 3.58 s)<br>34 k rows · 6 MB     | **124 MiB** · 111 ms / 827 ms (cold 3.81 s)<br>37 k rows · 6 MB   | **125 MiB** · 110 ms / 115 ms (cold 3.38 s)<br>39 k rows · 7 MB    | **158 MiB** · 236 ms / 242 ms (cold 4.18 s)<br>550 k rows · 96 MB   | **494 MiB** · 1.39 s / 1.41 s (cold 6.40 s)<br>3.5 M rows · 611 MB  |
| S6              | 30d    | **62 MiB** · 387 ms / 1.39 s (cold 9.54 s)<br>90 k rows · 17 MB    | **72 MiB** · 182 ms / 225 ms (cold 7.56 s)<br>98 k rows · 19 MB   | **67 MiB** · 335 ms / 496 ms (cold 12.3 s)<br>94 k rows · 18 MB    | **303 MiB** · 694 ms / 993 ms (cold 15.9 s)<br>1.3 M rows · 239 MB  | **1.16 GiB** · 3.46 s / 3.74 s (cold 14.6 s)<br>6.0 M rows · 1.1 GB |
| S6 span-payload | 1d     | –                                                                  | –                                                                 | **43 MiB** · 27 ms / 76 ms (cold 95 ms)<br>472 rows · 12 MB        | **81 MiB** · 36 ms / 36 ms (cold 105 ms)<br>2 k rows · 23 MB        | **81 MiB** · 68 ms / 320 ms (cold 851 ms)<br>5 k rows · 48 MB       |
| S6 span-payload | 7d     | **16 MiB** · 14 ms / 15 ms (cold 81 ms)<br>265 rows · 1 MB         | **30 MiB** · 19 ms / 22 ms (cold 86 ms)<br>219 rows · 8 MB        | **74 MiB** · 33 ms / 86 ms (cold 326 ms)<br>973 rows · 30 MB       | **74 MiB** · 38 ms / 331 ms (cold 914 ms)<br>2 k rows · 35 MB       | **125 MiB** · 104 ms / 660 ms (cold 1.25 s)<br>20 k rows · 60 MB    |
| S6 span-payload | 30d    | **16 MiB** · 14 ms / 15 ms (cold 132 ms)<br>265 rows · 1 MB        | **16 MiB** · 18 ms / 18 ms (cold 134 ms)<br>432 rows · 3 MB       | **23 MiB** · 18 ms / 22 ms (cold 302 ms)<br>550 rows · 4 MB        | **39 MiB** · 27 ms / 101 ms (cold 333 ms)<br>975 rows · 12 MB       | **81 MiB** · 40 ms / 150 ms (cold 758 ms)<br>10 k rows · 41 MB      |
| S6 span-metrics | 1d     | –                                                                  | –                                                                 | **236 MiB** · 107 ms / 128 ms (cold 4.74 s)<br>751 k rows · 108 MB | **235 MiB** · 146 ms / 173 ms (cold 3.53 s)<br>2.2 M rows · 315 MB  | **243 MiB** · 630 ms / 701 ms (cold 7.38 s)<br>7.3 M rows · 919 MB  |
| S6 span-metrics | 7d     | **232 MiB** · 92 ms / 124 ms (cold 4.16 s)<br>709 k rows · 102 MB  | **233 MiB** · 83 ms / 142 ms (cold 4.56 s)<br>777 k rows · 111 MB | **236 MiB** · 120 ms / 205 ms (cold 4.21 s)<br>750 k rows · 108 MB | **239 MiB** · 170 ms / 227 ms (cold 3.55 s)<br>2.2 M rows · 317 MB  | **243 MiB** · 410 ms / 444 ms (cold 5.24 s)<br>7.3 M rows · 922 MB  |
| S6 span-metrics | 30d    | **211 MiB** · 253 ms / 287 ms (cold 2.28 s)<br>706 k rows · 102 MB | **236 MiB** · 61 ms / 98 ms (cold 2.19 s)<br>778 k rows · 111 MB  | **236 MiB** · 111 ms / 129 ms (cold 4.98 s)<br>752 k rows · 108 MB | **239 MiB** · 262 ms / 3.51 s (cold 4.21 s)<br>2.3 M rows · 317 MB  | **243 MiB** · 425 ms / 455 ms (cold 7.39 s)<br>7.3 M rows · 922 MB  |
| S7              | 1d     | –                                                                  | **104 MiB** · 16 ms / 89 ms (cold 193 ms)<br>4 k rows · 722 kB    | **124 MiB** · 33 ms / 83 ms (cold 1.10 s)<br>13 k rows · 2 MB      | **106 MiB** · 78 ms / 109 ms (cold 1.52 s)<br>195 k rows · 32 MB    | **143 MiB** · 442 ms / 460 ms (cold 3.03 s)<br>1.4 M rows · 227 MB  |
| S7              | 7d     | **130 MiB** · 89 ms / 271 ms (cold 3.43 s)<br>35 k rows · 6 MB     | **138 MiB** · 89 ms / 139 ms (cold 4.57 s)<br>41 k rows · 7 MB    | **121 MiB** · 109 ms / 243 ms (cold 3.82 s)<br>38 k rows · 7 MB    | **152 MiB** · 268 ms / 277 ms (cold 4.74 s)<br>547 k rows · 95 MB   | **494 MiB** · 1.64 s / 3.82 s (cold 6.15 s)<br>3.6 M rows · 612 MB  |
| S7              | 30d    | **69 MiB** · 198 ms / 231 ms (cold 18.5 s)<br>92 k rows · 17 MB    | **77 MiB** · 220 ms / 446 ms (cold 8.42 s)<br>99 k rows · 19 MB   | **85 MiB** · 330 ms / 392 ms (cold 10.2 s)<br>87 k rows · 16 MB    | **261 MiB** · 632 ms / 673 ms (cold 12.2 s)<br>1.3 M rows · 239 MB  | **1.14 GiB** · 4.46 s / 4.77 s (cold 14.6 s)<br>6.0 M rows · 1.1 GB |
| S7 span-payload | 1d     | –                                                                  | –                                                                 | **43 MiB** · 25 ms / 196 ms (cold 222 ms)<br>472 rows · 12 MB      | **261 MiB** · 109 ms / 162 ms (cold 368 ms)<br>5 k rows · 178 MB    | **263 MiB** · 198 ms / 304 ms (cold 790 ms)<br>58 k rows · 697 MB   |
| S7 span-payload | 7d     | **16 MiB** · 15 ms / 16 ms (cold 155 ms)<br>265 rows · 1 MB        | **30 MiB** · 20 ms / 20 ms (cold 469 ms)<br>219 rows · 8 MB       | **183 MiB** · 62 ms / 104 ms (cold 595 ms)<br>2 k rows · 66 MB     | **259 MiB** · 99 ms / 113 ms (cold 763 ms)<br>5 k rows · 178 MB     | **253 MiB** · 180 ms / 216 ms (cold 678 ms)<br>58 k rows · 697 MB   |
| S7 span-payload | 30d    | **17 MiB** · 14 ms / 14 ms (cold 85 ms)<br>265 rows · 1 MB         | **107 MiB** · 55 ms / 59 ms (cold 426 ms)<br>3 k rows · 33 MB     | **320 MiB** · 252 ms / 291 ms (cold 2.04 s)<br>8 k rows · 311 MB   | **261 MiB** · 97 ms / 105 ms (cold 354 ms)<br>5 k rows · 178 MB     | **253 MiB** · 307 ms / 388 ms (cold 961 ms)<br>58 k rows · 697 MB   |
| S7 span-metrics | 1d     | –                                                                  | –                                                                 | **237 MiB** · 108 ms / 127 ms (cold 4.90 s)<br>753 k rows · 108 MB | **266 MiB** · 278 ms / 326 ms (cold 5.91 s)<br>2.2 M rows · 316 MB  | **276 MiB** · 643 ms / 2.02 s (cold 7.63 s)<br>7.3 M rows · 924 MB  |
| S7 span-metrics | 7d     | **231 MiB** · 99 ms / 133 ms (cold 3.37 s)<br>713 k rows · 103 MB  | **233 MiB** · 87 ms / 128 ms (cold 4.37 s)<br>778 k rows · 111 MB | **248 MiB** · 141 ms / 400 ms (cold 4.62 s)<br>746 k rows · 108 MB | **266 MiB** · 221 ms / 302 ms (cold 6.04 s)<br>2.3 M rows · 317 MB  | **276 MiB** · 741 ms / 3.53 s (cold 7.79 s)<br>7.3 M rows · 925 MB  |
| S7 span-metrics | 30d    | **231 MiB** · 63 ms / 64 ms (cold 2.31 s)<br>712 k rows · 103 MB   | **255 MiB** · 86 ms / 125 ms (cold 4.41 s)<br>778 k rows · 115 MB | **263 MiB** · 121 ms / 174 ms (cold 4.72 s)<br>749 k rows · 108 MB | **266 MiB** · 180 ms / 201 ms (cold 5.92 s)<br>2.3 M rows · 317 MB  | **277 MiB** · 625 ms / 758 ms (cold 8.02 s)<br>7.3 M rows · 926 MB  |
| S8              | 1d     | –                                                                  | –                                                                 | –                                                                  | **107 MiB** · 54 ms / 74 ms (cold 1.61 s)<br>195 k rows · 32 MB     | **144 MiB** · 347 ms / 352 ms (cold 3.25 s)<br>1.4 M rows · 227 MB  |
| S8              | 7d     | –                                                                  | –                                                                 | –                                                                  | **157 MiB** · 212 ms / 212 ms (cold 4.34 s)<br>548 k rows · 96 MB   | **504 MiB** · 1.88 s / 1.99 s (cold 6.41 s)<br>3.5 M rows · 611 MB  |
| S8              | 30d    | –                                                                  | –                                                                 | **78 MiB** · 209 ms / 401 ms (cold 10.3 s)<br>87 k rows · 16 MB    | **312 MiB** · 649 ms / 689 ms (cold 10.7 s)<br>1.3 M rows · 239 MB  | **1.15 GiB** · 3.59 s / 3.90 s (cold 15.8 s)<br>6.0 M rows · 1.1 GB |
| S8 span-payload | 1d     | –                                                                  | –                                                                 | –                                                                  | **132 MiB** · 69 ms / 79 ms (cold 309 ms)<br>3 k rows · 51 MB       | **173 MiB** · 102 ms / 128 ms (cold 834 ms)<br>24 k rows · 153 MB   |
| S8 span-payload | 7d     | –                                                                  | –                                                                 | –                                                                  | **132 MiB** · 71 ms / 76 ms (cold 298 ms)<br>3 k rows · 51 MB       | **176 MiB** · 89 ms / 111 ms (cold 2.04 s)<br>24 k rows · 153 MB    |
| S8 span-payload | 30d    | –                                                                  | –                                                                 | **55 MiB** · 20 ms / 21 ms (cold 223 ms)<br>2 k rows · 12 MB       | **132 MiB** · 66 ms / 71 ms (cold 271 ms)<br>3 k rows · 51 MB       | **165 MiB** · 65 ms / 72 ms (cold 861 ms)<br>24 k rows · 153 MB     |
| S8 span-metrics | 1d     | –                                                                  | –                                                                 | –                                                                  | **239 MiB** · 226 ms / 249 ms (cold 5.62 s)<br>2.2 M rows · 316 MB  | **243 MiB** · 433 ms / 1.65 s (cold 6.22 s)<br>7.3 M rows · 924 MB  |
| S8 span-metrics | 7d     | –                                                                  | –                                                                 | –                                                                  | **243 MiB** · 166 ms / 179 ms (cold 3.40 s)<br>2.2 M rows · 317 MB  | **247 MiB** · 663 ms / 675 ms (cold 7.50 s)<br>7.3 M rows · 925 MB  |
| S8 span-metrics | 30d    | –                                                                  | –                                                                 | **236 MiB** · 64 ms / 73 ms (cold 2.44 s)<br>751 k rows · 108 MB   | **239 MiB** · 169 ms / 195 ms (cold 3.46 s)<br>2.3 M rows · 317 MB  | **243 MiB** · 549 ms / 723 ms (cold 7.54 s)<br>7.3 M rows · 926 MB  |
| S9              | 1d     | –                                                                  | –                                                                 | –                                                                  | –                                                                   | **146 MiB** · 258 ms / 260 ms (cold 2.85 s)<br>1.4 M rows · 227 MB  |
| S9              | 7d     | –                                                                  | –                                                                 | –                                                                  | **157 MiB** · 227 ms / 250 ms (cold 4.07 s)<br>548 k rows · 96 MB   | **497 MiB** · 1.78 s / 2.06 s (cold 7.06 s)<br>3.5 M rows · 611 MB  |
| S9              | 30d    | –                                                                  | –                                                                 | –                                                                  | **271 MiB** · 629 ms / 630 ms (cold 10.5 s)<br>1.3 M rows · 239 MB  | **1.15 GiB** · 4.50 s / 4.51 s (cold 16.0 s)<br>6.0 M rows · 1.1 GB |
| S9 span-payload | 1d     | –                                                                  | –                                                                 | –                                                                  | –                                                                   | **109 MiB** · 52 ms / 96 ms (cold 965 ms)<br>12 k rows · 61 MB      |
| S9 span-payload | 7d     | –                                                                  | –                                                                 | –                                                                  | **42 MiB** · 46 ms / 54 ms (cold 621 ms)<br>1 k rows · 51 MB        | **96 MiB** · 61 ms / 93 ms (cold 409 ms)<br>12 k rows · 61 MB       |
| S9 span-payload | 30d    | –                                                                  | –                                                                 | –                                                                  | **42 MiB** · 48 ms / 52 ms (cold 487 ms)<br>1 k rows · 51 MB        | **96 MiB** · 50 ms / 85 ms (cold 453 ms)<br>12 k rows · 61 MB       |
| S9 span-metrics | 1d     | –                                                                  | –                                                                 | –                                                                  | –                                                                   | **243 MiB** · 417 ms / 429 ms (cold 5.53 s)<br>7.3 M rows · 924 MB  |
| S9 span-metrics | 7d     | –                                                                  | –                                                                 | –                                                                  | **239 MiB** · 160 ms / 165 ms (cold 3.90 s)<br>2.2 M rows · 317 MB  | **243 MiB** · 631 ms / 2.22 s (cold 8.17 s)<br>7.3 M rows · 925 MB  |
| S9 span-metrics | 30d    | –                                                                  | –                                                                 | –                                                                  | **243 MiB** · 171 ms / 227 ms (cold 3.28 s)<br>2.3 M rows · 317 MB  | **247 MiB** · 680 ms / 692 ms (cold 7.90 s)<br>7.3 M rows · 926 MB  |

### Discovery: getTraceQueryObservedFields() / getTraceQueryValues()

| case | window | small                                                              | mid                                                                | p90                                                                | p99                                                                 | largest                                                                     |
| ---- | ------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| OF0  | 1d     | **166 MiB** · 59 ms / 289 ms (cold 1.94 s)<br>90 k rows · 922 kB   | **180 MiB** · 42 ms / 79 ms (cold 1.76 s)<br>94 k rows · 1 MB      | **176 MiB** · 42 ms / 205 ms (cold 1.64 s)<br>112 k rows · 1 MB    | **179 MiB** · 253 ms / 2.22 s (cold 13.8 s)<br>2.8 M rows · 99 MB   | **186 MiB** · 184 ms / 216 ms (cold 13.7 s)<br>2.8 M rows · 102 MB          |
| OF0  | 7d     | **167 MiB** · 194 ms / 354 ms (cold 14.0 s)<br>2.7 M rows · 96 MB  | **180 MiB** · 183 ms / 635 ms (cold 12.0 s)<br>2.7 M rows · 96 MB  | **177 MiB** · 45 ms / 165 ms (cold 2.05 s)<br>111 k rows · 2 MB    | **181 MiB** · 272 ms / 326 ms (cold 14.8 s)<br>2.8 M rows · 113 MB  | **255 MiB** · 431 ms / 1.01 s (cold 16.8 s)<br>2.8 M rows · 131 MB          |
| OF0  | 30d    | **168 MiB** · 149 ms / 163 ms (cold 13.7 s)<br>2.7 M rows · 98 MB  | **185 MiB** · 183 ms / 412 ms (cold 13.4 s)<br>2.7 M rows · 104 MB | **175 MiB** · 163 ms / 246 ms (cold 14.1 s)<br>2.7 M rows · 107 MB | **178 MiB** · 298 ms / 384 ms (cold 15.9 s)<br>2.8 M rows · 148 MB  | **411 MiB** · 858 ms / 991 ms (cold 20.1 s)<br>3.1 M rows · 233 MB          |
| OF1  | 1d     | **166 MiB** · 100 ms / 147 ms (cold 1.96 s)<br>90 k rows · 923 kB  | **173 MiB** · 41 ms / 413 ms (cold 1.82 s)<br>106 k rows · 1 MB    | **178 MiB** · 137 ms / 156 ms (cold 12.5 s)<br>2.7 M rows · 96 MB  | **184 MiB** · 167 ms / 510 ms (cold 14.6 s)<br>2.7 M rows · 97 MB   | **185 MiB** · 170 ms / 179 ms (cold 14.4 s)<br>2.8 M rows · 107 MB          |
| OF1  | 7d     | **166 MiB** · 162 ms / 215 ms (cold 14.3 s)<br>2.7 M rows · 96 MB  | **171 MiB** · 156 ms / 197 ms (cold 11.9 s)<br>2.7 M rows · 96 MB  | **176 MiB** · 256 ms / 299 ms (cold 12.9 s)<br>2.7 M rows · 98 MB  | **174 MiB** · 257 ms / 322 ms (cold 15.7 s)<br>2.7 M rows · 109 MB  | **259 MiB** · 594 ms / 1.20 s (cold 19.5 s)<br>3.0 M rows · 191 MB          |
| OF1  | 30d    | **168 MiB** · 143 ms / 153 ms (cold 13.6 s)<br>2.7 M rows · 98 MB  | **173 MiB** · 153 ms / 356 ms (cold 19.8 s)<br>2.7 M rows · 106 MB | **178 MiB** · 175 ms / 223 ms (cold 14.7 s)<br>2.7 M rows · 107 MB | **176 MiB** · 305 ms / 307 ms (cold 15.9 s)<br>2.8 M rows · 138 MB  | **409 MiB** · 844 ms / 898 ms (cold 22.9 s)<br>3.2 M rows · 292 MB          |
| V1   | 1d     | **170 MiB** · 40 ms / 348 ms (cold 1.86 s)<br>90 k rows · 918 kB   | **181 MiB** · 49 ms / 99 ms (cold 1.80 s)<br>95 k rows · 1 MB      | **175 MiB** · 42 ms / 213 ms (cold 4.94 s)<br>111 k rows · 1 MB    | **181 MiB** · 232 ms / 1.23 s (cold 12.2 s)<br>2.7 M rows · 98 MB   | **184 MiB** · 223 ms / 612 ms (cold 14.5 s)<br>2.8 M rows · 101 MB          |
| V1   | 7d     | **167 MiB** · 175 ms / 251 ms (cold 15.1 s)<br>2.7 M rows · 95 MB  | **180 MiB** · 166 ms / 279 ms (cold 12.6 s)<br>2.7 M rows · 96 MB  | **177 MiB** · 65 ms / 316 ms (cold 2.37 s)<br>112 k rows · 2 MB    | **182 MiB** · 257 ms / 505 ms (cold 15.7 s)<br>2.8 M rows · 106 MB  | **191 MiB** · 343 ms / 555 ms (cold 17.2 s)<br>2.8 M rows · 124 MB          |
| V1   | 30d    | **167 MiB** · 216 ms / 267 ms (cold 14.6 s)<br>2.7 M rows · 98 MB  | **180 MiB** · 225 ms / 339 ms (cold 14.2 s)<br>2.7 M rows · 101 MB | **174 MiB** · 152 ms / 203 ms (cold 15.8 s)<br>2.7 M rows · 103 MB | **179 MiB** · 276 ms / 507 ms (cold 17.5 s)<br>2.8 M rows · 124 MB  | **286 MiB** · 524 ms / 760 ms (cold 23.3 s)<br>3.1 M rows · 204 MB          |
| V2   | 1d     | **166 MiB** · 54 ms / 108 ms (cold 1.94 s)<br>90 k rows · 919 kB   | **171 MiB** · 41 ms / 169 ms (cold 1.66 s)<br>106 k rows · 1 MB    | **173 MiB** · 163 ms / 198 ms (cold 12.8 s)<br>2.7 M rows · 95 MB  | **174 MiB** · 193 ms / 209 ms (cold 12.7 s)<br>2.7 M rows · 97 MB   | **184 MiB** · 231 ms / 243 ms (cold 13.6 s)<br>2.8 M rows · 104 MB          |
| V2   | 7d     | **166 MiB** · 222 ms / 297 ms (cold 14.0 s)<br>2.7 M rows · 95 MB  | **170 MiB** · 207 ms / 395 ms (cold 13.1 s)<br>2.7 M rows · 96 MB  | **173 MiB** · 217 ms / 257 ms (cold 13.5 s)<br>2.7 M rows · 97 MB  | **181 MiB** · 243 ms / 1.52 s (cold 15.4 s)<br>2.7 M rows · 104 MB  | **188 MiB** · 437 ms / 460 ms (cold 19.3 s)<br>3.0 M rows · 167 MB          |
| V2   | 30d    | **166 MiB** · 210 ms / 262 ms (cold 14.6 s)<br>2.7 M rows · 98 MB  | **170 MiB** · 220 ms / 230 ms (cold 14.2 s)<br>2.7 M rows · 103 MB | **180 MiB** · 155 ms / 157 ms (cold 15.0 s)<br>2.7 M rows · 103 MB | **174 MiB** · 388 ms / 913 ms (cold 17.1 s)<br>2.8 M rows · 122 MB  | **303 MiB** · 536 ms / 877 ms (cold 23.7 s)<br>3.2 M rows · 245 MB          |
| V3   | 1d     | **168 MiB** · 42 ms / 62 ms (cold 2.14 s)<br>90 k rows · 919 kB    | **170 MiB** · 42 ms / 49 ms (cold 1.90 s)<br>106 k rows · 1 MB     | **178 MiB** · 164 ms / 390 ms (cold 13.1 s)<br>2.7 M rows · 95 MB  | **174 MiB** · 217 ms / 236 ms (cold 12.6 s)<br>2.7 M rows · 97 MB   | **184 MiB** · 146 ms / 180 ms (cold 13.8 s)<br>2.8 M rows · 104 MB          |
| V3   | 7d     | **166 MiB** · 193 ms / 444 ms (cold 14.1 s)<br>2.7 M rows · 95 MB  | **170 MiB** · 160 ms / 229 ms (cold 12.6 s)<br>2.7 M rows · 96 MB  | **174 MiB** · 242 ms / 269 ms (cold 13.9 s)<br>2.7 M rows · 97 MB  | **185 MiB** · 196 ms / 225 ms (cold 15.5 s)<br>2.7 M rows · 104 MB  | **184 MiB** · 454 ms / 571 ms (cold 19.0 s)<br>3.0 M rows · 164 MB          |
| V3   | 30d    | **167 MiB** · 245 ms / 1.04 s (cold 15.0 s)<br>2.7 M rows · 98 MB  | **170 MiB** · 172 ms / 239 ms (cold 13.2 s)<br>2.7 M rows · 103 MB | **175 MiB** · 139 ms / 153 ms (cold 15.2 s)<br>2.7 M rows · 104 MB | **176 MiB** · 309 ms / 361 ms (cold 17.0 s)<br>2.8 M rows · 124 MB  | **303 MiB** · 802 ms / 843 ms (cold 22.3 s)<br>3.2 M rows · 239 MB          |
| V4   | 1d     | **168 MiB** · 39 ms / 41 ms (cold 2.01 s)<br>90 k rows · 919 kB    | **173 MiB** · 65 ms / 142 ms (cold 1.62 s)<br>105 k rows · 1 MB    | **174 MiB** · 168 ms / 212 ms (cold 13.3 s)<br>2.7 M rows · 95 MB  | **175 MiB** · 343 ms / 346 ms (cold 14.0 s)<br>2.7 M rows · 97 MB   | **182 MiB** · 248 ms / 250 ms (cold 14.9 s)<br>2.8 M rows · 104 MB          |
| V4   | 7d     | **166 MiB** · 215 ms / 278 ms (cold 14.3 s)<br>2.7 M rows · 95 MB  | **173 MiB** · 165 ms / 227 ms (cold 12.7 s)<br>2.7 M rows · 96 MB  | **177 MiB** · 177 ms / 336 ms (cold 14.0 s)<br>2.7 M rows · 97 MB  | **174 MiB** · 182 ms / 276 ms (cold 16.8 s)<br>2.7 M rows · 103 MB  | **187 MiB** · 385 ms / 422 ms (cold 19.8 s)<br>3.0 M rows · 162 MB          |
| V4   | 30d    | **167 MiB** · 165 ms / 218 ms (cold 15.6 s)<br>2.7 M rows · 98 MB  | **170 MiB** · 232 ms / 267 ms (cold 13.6 s)<br>2.7 M rows · 102 MB | **176 MiB** · 155 ms / 223 ms (cold 15.9 s)<br>2.7 M rows · 103 MB | **184 MiB** · 279 ms / 1.09 s (cold 18.0 s)<br>2.8 M rows · 120 MB  | **292 MiB** · 966 ms / 1.21 s (cold 24.6 s)<br>3.2 M rows · 235 MB          |
| V5   | 1d     | **166 MiB** · 40 ms / 83 ms (cold 2.40 s)<br>90 k rows · 919 kB    | **170 MiB** · 48 ms / 72 ms (cold 1.45 s)<br>105 k rows · 1 MB     | **174 MiB** · 144 ms / 834 ms (cold 12.3 s)<br>2.7 M rows · 96 MB  | **174 MiB** · 219 ms / 504 ms (cold 12.7 s)<br>2.7 M rows · 97 MB   | **187 MiB** · 232 ms / 298 ms (cold 14.8 s)<br>2.8 M rows · 108 MB          |
| V5   | 7d     | **166 MiB** · 195 ms / 1.45 s (cold 13.9 s)<br>2.7 M rows · 96 MB  | **170 MiB** · 187 ms / 212 ms (cold 12.4 s)<br>2.7 M rows · 96 MB  | **174 MiB** · 231 ms / 255 ms (cold 14.0 s)<br>2.7 M rows · 98 MB  | **180 MiB** · 254 ms / 264 ms (cold 15.9 s)<br>2.7 M rows · 112 MB  | **257 MiB** · 736 ms / 738 ms (cold 20.8 s)<br>3.0 M rows · 200 MB          |
| V5   | 30d    | **166 MiB** · 211 ms / 258 ms (cold 14.0 s)<br>2.7 M rows · 98 MB  | **170 MiB** · 174 ms / 386 ms (cold 12.9 s)<br>2.7 M rows · 107 MB | **177 MiB** · 146 ms / 157 ms (cold 15.2 s)<br>2.7 M rows · 108 MB | **177 MiB** · 334 ms / 470 ms (cold 18.0 s)<br>2.8 M rows · 147 MB  | **448 MiB** · 1.01 s / 1.23 s (cold 25.6 s)<br>3.2 M rows · 308 MB          |
| V6   | 1d     | **167 MiB** · 94 ms / 496 ms (cold 1.97 s)<br>90 k rows · 924 kB   | **189 MiB** · 73 ms / 1.00 s (cold 2.40 s)<br>95 k rows · 1 MB     | **174 MiB** · 79 ms / 502 ms (cold 2.44 s)<br>111 k rows · 1 MB    | **175 MiB** · 358 ms / 2.06 s (cold 17.4 s)<br>3.2 M rows · 144 MB  | **184 MiB** · 268 ms / 615 ms (cold 19.0 s)<br>4.3 M rows · 162 MB          |
| V6   | 7d     | **171 MiB** · 232 ms / 335 ms (cold 16.2 s)<br>2.7 M rows · 97 MB  | **180 MiB** · 243 ms / 352 ms (cold 14.9 s)<br>2.7 M rows · 98 MB  | **183 MiB** · 65 ms / 1.11 s (cold 2.65 s)<br>111 k rows · 2 MB    | **179 MiB** · 316 ms / 361 ms (cold 19.7 s)<br>3.7 M rows · 162 MB  | **254 MiB** · 561 ms / 1.33 s (cold 24.8 s)<br>4.3 M rows · 207 MB          |
| V6   | 30d    | **168 MiB** · 254 ms / 514 ms (cold 21.1 s)<br>2.7 M rows · 99 MB  | **181 MiB** · 201 ms / 310 ms (cold 14.5 s)<br>2.8 M rows · 103 MB | **179 MiB** · 231 ms / 334 ms (cold 18.0 s)<br>2.8 M rows · 106 MB | **207 MiB** · 381 ms / 788 ms (cold 21.1 s)<br>3.8 M rows · 236 MB  | **369 MiB** · 889 ms / 1.16 s (cold 28.2 s)<br>4.4 M rows · 393 MB ✗timeout |
| V7   | 1d     | **167 MiB** · 56 ms / 279 ms (cold 1.64 s)<br>90 k rows · 924 kB   | **171 MiB** · 95 ms / 129 ms (cold 2.24 s)<br>106 k rows · 1 MB    | **176 MiB** · 281 ms / 560 ms (cold 15.3 s)<br>2.8 M rows · 98 MB  | **176 MiB** · 406 ms / 540 ms (cold 17.5 s)<br>3.1 M rows · 125 MB  | **802 MiB** · 1.07 s / 1.08 s (cold 18.9 s)<br>5.8 M rows · 561 MB          |
| V7   | 7d     | **167 MiB** · 402 ms / 539 ms (cold 16.5 s)<br>2.7 M rows · 97 MB  | **172 MiB** · 393 ms / 2.49 s (cold 15.3 s)<br>2.8 M rows · 98 MB  | **174 MiB** · 334 ms / 421 ms (cold 15.4 s)<br>2.8 M rows · 101 MB | **1.14 GiB** · 1.08 s / 1.19 s (cold 20.0 s)<br>3.7 M rows · 472 MB | **3.54 GiB** · 4.08 s / 4.47 s (cold 27.9 s)<br>6.0 M rows · 2.5 GB         |
| V7   | 30d    | **167 MiB** · 485 ms / 512 ms (cold 21.1 s)<br>2.8 M rows · 100 MB | **172 MiB** · 237 ms / 244 ms (cold 14.7 s)<br>2.8 M rows · 108 MB | **176 MiB** · 243 ms / 270 ms (cold 17.5 s)<br>2.8 M rows · 112 MB | **3.27 GiB** · 2.56 s / 3.56 s (cold 24.3 s)<br>3.8 M rows · 1.5 GB | ✗ timeout/memory                                                            |
| V8   | 1d     | **167 MiB** · 68 ms / 127 ms (cold 2.44 s)<br>90 k rows · 924 kB   | **171 MiB** · 56 ms / 108 ms (cold 2.16 s)<br>106 k rows · 1 MB    | **174 MiB** · 352 ms / 620 ms (cold 16.4 s)<br>2.8 M rows · 97 MB  | **185 MiB** · 442 ms / 1.00 s (cold 16.8 s)<br>3.1 M rows · 110 MB  | **193 MiB** · 337 ms / 367 ms (cold 19.7 s)<br>5.8 M rows · 251 MB          |
| V8   | 7d     | **167 MiB** · 308 ms / 542 ms (cold 16.3 s)<br>2.7 M rows · 97 MB  | **172 MiB** · 349 ms / 1.89 s (cold 14.4 s)<br>2.8 M rows · 98 MB  | **181 MiB** · 343 ms / 369 ms (cold 16.4 s)<br>2.8 M rows · 99 MB  | **174 MiB** · 293 ms / 354 ms (cold 20.3 s)<br>3.7 M rows · 162 MB  | **252 MiB** · 1.03 s / 1.19 s (cold 26.5 s)<br>6.0 M rows · 483 MB          |
| V8   | 30d    | **167 MiB** · 314 ms / 349 ms<br>2.8 M rows · 100 MB ✗timeout      | **171 MiB** · 218 ms / 229 ms (cold 14.5 s)<br>2.8 M rows · 105 MB | **176 MiB** · 230 ms / 249 ms (cold 17.5 s)<br>2.8 M rows · 106 MB | **179 MiB** · 626 ms / 854 ms (cold 23.1 s)<br>3.8 M rows · 237 MB  | **367 MiB** · 1.13 s / 1.21 s<br>6.2 M rows · 747 MB ✗timeout               |

### What-if rewrites

Ratios are what-if ÷ as-compiled (warm medians): time · bytes read · memory.

| what-if                | window | small                 | mid                   | p90                   | p99                   | largest               |
| ---------------------- | ------ | --------------------- | --------------------- | --------------------- | --------------------- | --------------------- |
| T0-w1                  | 1d     | ×0.86 · ×1.00 · ×1.00 | ×0.89 · ×1.00 · ×1.00 | ×1.02 · ×1.00 · ×1.00 | ×0.63 · ×0.27 · ×1.13 | ×0.52 · ×0.55 · ×1.00 |
| T0-w1                  | 7d     | ×0.49 · ×0.09 · ×1.08 | ×0.35 · ×0.09 · ×1.05 | ×1.02 · ×1.00 · ×1.00 | ×0.78 · ×0.72 · ×0.96 | –                     |
| T0-w1                  | 30d    | ×0.44 · ×0.10 · ×1.08 | ×0.41 · ×0.43 · ×0.74 | ×0.56 · ×0.76 · ×0.40 | ×0.99 · ×1.04 · ×1.72 | –                     |
| T1-w1                  | 1d     | ×1.60 · ×1.00 · ×1.06 | ×1.11 · ×1.00 · ×1.00 | ×0.95 · ×1.00 · ×1.00 | ×0.53 · ×0.21 · ×1.06 | ×0.57 · ×0.55 · ×1.00 |
| T1-w1                  | 7d     | ×0.37 · ×0.06 · ×1.08 | ×0.41 · ×0.09 · ×1.03 | ×0.65 · ×1.00 · ×0.99 | ×0.66 · ×0.72 · ×0.95 | –                     |
| T1-w1                  | 30d    | ×0.42 · ×0.06 · ×1.09 | ×0.39 · ×0.34 · ×0.79 | ×0.42 · ×0.76 · ×0.41 | ×1.57 · ×1.28 · ×1.77 | –                     |
| T7-w1                  | 1d     | ×0.60 · ×1.00 · ×1.00 | ×1.02 · ×1.00 · ×1.00 | ×0.90 · ×1.00 · ×1.00 | ×0.69 · ×0.32 · ×1.30 | ×0.54 · ×0.52 · ×1.09 |
| T7-w1                  | 7d     | ×0.49 · ×0.07 · ×1.10 | ×0.57 · ×0.08 · ×1.05 | ×0.97 · ×1.00 · ×1.00 | ×0.78 · ×0.65 · ×0.96 | –                     |
| T7-w1                  | 30d    | ×0.55 · ×0.09 · ×1.05 | ×0.61 · ×0.34 · ×0.74 | ×0.56 · ×0.62 · ×0.41 | ×0.61 · ×0.71 · ×1.00 | –                     |
| P0 payload-scoped      | 1d     | ×0.98 · ×0.91 · ×0.62 | –                     | ×0.89 · ×0.90 · ×0.80 | ×0.79 · ×0.88 · ×0.72 | ×0.92 · ×0.89 · ×0.61 |
| P0 payload-scoped      | 7d     | ×0.83 · ×0.82 · ×0.63 | ×0.84 · ×0.52 · ×0.33 | ×1.04 · ×0.90 · ×0.80 | ×0.95 · ×0.88 · ×0.72 | ×0.92 · ×0.89 · ×0.61 |
| P0 payload-scoped      | 30d    | ×0.86 · ×0.82 · ×0.63 | ×0.92 · ×0.85 · ×0.59 | ×0.81 · ×0.78 · ×0.50 | ×0.82 · ×0.88 · ×0.72 | ×0.95 · ×0.89 · ×0.61 |
| P1 payload-scoped      | 1d     | –                     | –                     | –                     | –                     | ×0.72 · ×0.92 · ×0.78 |
| P1 payload-scoped      | 7d     | –                     | –                     | –                     | ×0.97 · ×0.84 · ×0.71 | ×0.76 · ×0.92 · ×0.78 |
| P1 payload-scoped      | 30d    | –                     | –                     | ×0.94 · ×0.90 · ×0.88 | ×0.98 · ×0.84 · ×0.71 | ×0.93 · ×0.92 · ×0.78 |
| P2 payload-scoped      | 1d     | –                     | –                     | –                     | –                     | ×0.87 · ×0.83 · ×0.54 |
| P2 payload-scoped      | 7d     | –                     | –                     | –                     | –                     | ×0.73 · ×0.83 · ×0.54 |
| P2 payload-scoped      | 30d    | –                     | –                     | –                     | ×0.97 · ×0.96 · ×0.93 | ×0.74 · ×0.83 · ×0.54 |
| P3 payload-scoped      | 1d     | –                     | –                     | ×0.93 · ×0.90 · ×0.80 | ×0.99 · ×0.88 · ×0.72 | ×0.82 · ×0.97 · ×0.88 |
| P3 payload-scoped      | 7d     | ×0.88 · ×0.72 · ×0.44 | ×0.84 · ×0.64 · ×0.34 | ×1.03 · ×0.90 · ×0.80 | ×1.06 · ×0.88 · ×0.72 | ×0.69 · ×0.97 · ×0.88 |
| P3 payload-scoped      | 30d    | ×0.83 · ×0.72 · ×0.44 | ×0.84 · ×0.87 · ×0.77 | ×0.94 · ×0.90 · ×0.80 | ×0.79 · ×0.88 · ×0.72 | ×0.79 · ×0.97 · ×0.88 |
| TH0-w1                 | 1d     | ×0.79 · ×1.00 · ×1.00 | ×1.03 · ×1.00 · ×1.00 | ×1.13 · ×1.00 · ×1.00 | ×0.48 · ×0.08 · ×1.10 | ×0.71 · ×0.25 · ×1.09 |
| TH0-w1                 | 7d     | ×0.41 · ×0.05 · ×1.08 | ×0.51 · ×0.04 · ×1.05 | ×1.18 · ×1.00 · ×1.00 | ×0.42 · ×0.15 · ×1.11 | ×0.61 · ×0.37 · ×1.20 |
| TH0-w1                 | 30d    | ×0.47 · ×0.07 · ×1.08 | ×0.45 · ×0.08 · ×1.08 | ×0.48 · ×0.12 · ×1.08 | ×0.80 · ×0.27 · ×1.18 | ×0.89 · ×0.58 · ×1.24 |
| S0 span-payload-scoped | 1d     | ×1.00 · ×1.00 · ×1.02 | –                     | ×0.95 · ×1.00 · ×1.01 | ×0.78 · ×1.00 · ×1.00 | ×0.75 · ×1.00 · ×0.86 |
| S0 span-payload-scoped | 7d     | ×1.10 · ×1.00 · ×1.01 | ×1.13 · ×1.00 · ×1.03 | ×0.95 · ×1.00 · ×1.01 | ×0.86 · ×1.00 · ×1.00 | ×1.11 · ×1.00 · ×0.80 |
| S0 span-payload-scoped | 30d    | ×0.82 · ×1.00 · ×1.01 | ×0.95 · ×1.00 · ×0.50 | ×1.10 · ×1.00 · ×1.01 | ×0.86 · ×1.00 · ×1.00 | ×1.20 · ×1.00 · ×0.85 |
| S0 span-metrics-scoped | 1d     | ×1.35 · ×1.00 · ×0.96 | –                     | ×1.01 · ×0.99 · ×0.96 | ×1.20 · ×1.03 · ×0.97 | ×0.58 · ×0.98 · ×0.96 |
| S0 span-metrics-scoped | 7d     | ×1.71 · ×1.00 · ×0.96 | ×1.12 · ×1.01 · ×0.92 | ×1.50 · ×0.99 · ×0.97 | ×1.20 · ×1.03 · ×0.96 | ×1.55 · ×0.98 · ×0.95 |
| S0 span-metrics-scoped | 30d    | ×1.35 · ×1.00 · ×0.96 | ×1.31 · ×1.03 · ×0.91 | ×1.14 · ×1.00 · ×0.96 | ×1.67 · ×1.03 · ×0.96 | ×1.25 · ×0.98 · ×0.94 |
| OF0-w1                 | 1d     | ×0.77 · ×1.00 · ×1.00 | ×0.99 · ×1.00 · ×1.00 | ×1.53 · ×1.00 · ×1.00 | ×0.57 · ×0.09 · ×1.11 | ×0.60 · ×0.26 · ×1.10 |
| OF0-w1                 | 7d     | ×0.40 · ×0.05 · ×1.11 | ×0.53 · ×0.05 · ×1.05 | ×0.96 · ×1.00 · ×1.00 | ×0.51 · ×0.19 · ×1.12 | ×0.63 · ×0.39 · ×1.19 |
| OF0-w1                 | 30d    | ×0.44 · ×0.07 · ×1.11 | ×0.60 · ×0.10 · ×1.10 | ×0.48 · ×0.15 · ×1.10 | ×0.73 · ×0.35 · ×1.19 | ×0.90 · ×0.59 · ×1.01 |

### Scaling with project size (log-log slope vs 30-day trace count)

| case            | window | memory slope | latency slope | read-bytes slope | projects |
| --------------- | ------ | ------------ | ------------- | ---------------- | -------- |
| D0              | 1d     | -0.01        | 0.02          | 0.01             | 5        |
| V1              | 1d     | 0.01         | 0.21          | 0.48             | 15       |
| V2              | 1d     | 0.01         | 0.18          | 0.54             | 5        |
| V3              | 1d     | 0.01         | 0.16          | 0.54             | 5        |
| V4              | 1d     | 0.01         | 0.21          | 0.54             | 5        |
| V5              | 1d     | 0.01         | 0.20          | 0.54             | 5        |
| T0              | 1d     | 0.08         | 0.24          | 0.59             | 15       |
| T1              | 1d     | 0.08         | 0.18          | 0.63             | 15       |
| T2              | 1d     | 0.16         | 0.14          | 0.40             | 5        |
| TH0             | 1d     | 0.01         | 0.14          | 0.48             | 15       |
| T3              | 1d     | -0.00        | -0.14         | -0.05            | 5        |
| TH1             | 1d     | 0.01         | 0.13          | 0.54             | 5        |
| T4              | 1d     | 0.08         | 0.18          | 0.28             | 3        |
| TH2             | 1d     | 0.01         | 0.18          | 0.54             | 5        |
| TH4             | 1d     | 0.01         | 0.18          | 0.54             | 5        |
| T6              | 1d     | 0.11         | 0.27          | 0.62             | 5        |
| TH5             | 1d     | 0.01         | 0.19          | 0.54             | 5        |
| O1              | 1d     | 0.17         | 0.28          | 0.69             | 5        |
| O2              | 1d     | 0.17         | 0.30          | 0.69             | 5        |
| O3              | 1d     | 0.17         | 0.31          | 0.69             | 5        |
| K1              | 1d     | 0.17         | 0.30          | 0.69             | 5        |
| OF0             | 1d     | 0.01         | 0.17          | 0.49             | 15       |
| OF1             | 1d     | 0.01         | 0.10          | 0.54             | 5        |
| P0              | 1d     | 0.01         | 0.13          | 0.46             | 13       |
| G0              | 1d     | 0.01         | 0.13          | 0.54             | 5        |
| P0 payload      | 1d     | 0.03         | 0.07          | 0.02             | 8        |
| D1              | 1d     | 0.18         | 0.18          | 0.41             | 5        |
| D2              | 1d     | 0.17         | 0.30          | 0.63             | 5        |
| S0              | 1d     | -0.00        | 0.27          | 0.58             | 13       |
| S0 span-payload | 1d     | 0.13         | 0.14          | 0.21             | 8        |
| T7              | 1d     | 0.08         | 0.23          | 0.57             | 15       |
| S0 span-metrics | 1d     | 0.00         | 0.23          | 0.17             | 8        |
| T8              | 1d     | 0.17         | 0.26          | 0.66             | 5        |
| T9              | 1d     | 0.20         | 0.24          | 0.66             | 5        |
| T10             | 1d     | 0.17         | 0.25          | 0.66             | 5        |
| T12             | 1d     | 0.17         | 0.27          | 0.83             | 4        |
| TH3             | 1d     | 0.01         | 0.19          | 0.58             | 5        |
| V6              | 1d     | 0.01         | 0.16          | 0.55             | 15       |
| V7              | 1d     | 0.12         | 0.29          | 0.68             | 5        |
| V8              | 1d     | 0.01         | 0.20          | 0.61             | 5        |
| D0              | 7d     | -0.01        | 0.01          | 0.01             | 5        |
| V1              | 7d     | 0.01         | 0.10          | 0.11             | 15       |
| V2              | 7d     | 0.01         | 0.06          | 0.05             | 5        |
| V3              | 7d     | 0.01         | 0.08          | 0.05             | 5        |
| V4              | 7d     | 0.01         | 0.05          | 0.05             | 5        |
| V5              | 7d     | 0.03         | 0.12          | 0.07             | 5        |
| T0              | 7d     | 0.18         | 0.15          | 0.22             | 12       |
| T1              | 7d     | 0.18         | 0.23          | 0.37             | 12       |
| T2              | 7d     | 0.08         | 0.10          | 0.18             | 4        |
| TH0             | 7d     | 0.01         | 0.08          | 0.12             | 15       |
| T3              | 7d     | 0.07         | 0.26          | 0.56             | 5        |
| TH1             | 7d     | 0.01         | 0.07          | 0.05             | 5        |
| TH2             | 7d     | 0.04         | 0.03          | 0.05             | 5        |
| TH4             | 7d     | 0.06         | 0.05          | 0.10             | 5        |
| T6              | 7d     | 0.19         | 0.26          | 0.64             | 4        |
| TH5             | 7d     | 0.01         | 0.03          | 0.05             | 5        |
| O1              | 7d     | 0.19         | 0.11          | 0.23             | 4        |
| O2              | 7d     | 0.20         | 0.09          | 0.23             | 4        |
| O3              | 7d     | 0.19         | 0.10          | 0.23             | 4        |
| K1              | 7d     | 0.19         | 0.16          | 0.23             | 4        |
| OF0             | 7d     | 0.02         | 0.08          | 0.13             | 15       |
| OF1             | 7d     | 0.04         | 0.12          | 0.06             | 5        |
| P0              | 7d     | 0.02         | 0.09          | 0.13             | 15       |
| P0 payload      | 7d     | -0.01        | 0.05          | 0.02             | 12       |
| P1              | 7d     | 0.05         | 0.09          | 0.07             | 5        |
| P2              | 7d     | 0.05         | 0.11          | 0.07             | 5        |
| P3              | 7d     | 0.04         | 0.08          | 0.07             | 5        |
| P3 payload      | 7d     | 0.03         | 0.11          | 0.13             | 5        |
| G0              | 7d     | 0.01         | 0.12          | 0.05             | 5        |
| D1              | 7d     | 0.21         | 0.15          | 0.22             | 4        |
| D2              | 7d     | 0.19         | 0.17          | 0.23             | 4        |
| S0              | 7d     | 0.05         | 0.25          | 0.44             | 15       |
| S0 span-payload | 7d     | 0.14         | 0.11          | 0.22             | 12       |
| S0 span-metrics | 7d     | 0.01         | 0.13          | 0.16             | 12       |
| S1              | 7d     | 0.12         | 0.27          | 0.49             | 5        |
| S1 span-payload | 7d     | 0.28         | 0.23          | 0.60             | 4        |
| S1 span-metrics | 7d     | 0.01         | 0.21          | 0.22             | 4        |
| S2              | 7d     | 0.13         | 0.22          | 0.49             | 5        |
| S3              | 7d     | 0.12         | 0.27          | 0.50             | 5        |
| S4              | 7d     | 0.32         | 0.39          | 0.47             | 4        |
| S5              | 7d     | 0.12         | 0.26          | 0.50             | 5        |
| S4 span-payload | 7d     | 0.17         | 0.20          | 0.51             | 4        |
| S6              | 7d     | 0.12         | 0.26          | 0.50             | 5        |
| S4 span-metrics | 7d     | 0.01         | 0.15          | 0.22             | 4        |
| S6 span-payload | 7d     | 0.19         | 0.18          | 0.34             | 5        |
| S6 span-metrics | 7d     | 0.00         | 0.15          | 0.23             | 5        |
| T7              | 7d     | 0.19         | 0.10          | 0.17             | 12       |
| T8              | 7d     | 0.20         | 0.09          | 0.17             | 4        |
| T9              | 7d     | 0.25         | 0.07          | 0.17             | 4        |
| T10             | 7d     | 0.20         | 0.13          | 0.17             | 4        |
| T12             | 7d     | 0.26         | 0.09          | 0.24             | 3        |
| S7              | 7d     | 0.12         | 0.28          | 0.49             | 5        |
| TH3             | 7d     | 0.06         | 0.13          | 0.19             | 5        |
| S7 span-payload | 7d     | 0.29         | 0.26          | 0.61             | 5        |
| S7 span-metrics | 7d     | 0.02         | 0.20          | 0.23             | 5        |
| V6              | 7d     | 0.02         | 0.13          | 0.20             | 15       |
| V7              | 7d     | 0.33         | 0.24          | 0.33             | 5        |
| V8              | 7d     | 0.03         | 0.09          | 0.15             | 5        |
| D0              | 30d    | -0.01        | 0.02          | 0.01             | 5        |
| V1              | 30d    | 0.02         | 0.09          | 0.07             | 15       |
| V2              | 30d    | 0.05         | 0.10          | 0.08             | 5        |
| V3              | 30d    | 0.04         | 0.13          | 0.08             | 5        |
| V4              | 30d    | 0.04         | 0.15          | 0.08             | 5        |
| V5              | 30d    | 0.08         | 0.16          | 0.11             | 5        |
| T0              | 30d    | 0.27         | 0.18          | 0.33             | 11       |
| T1              | 30d    | 0.24         | 0.24          | 0.43             | 11       |
| T2              | 30d    | 0.28         | 0.20          | 0.34             | 4        |
| TH0             | 30d    | 0.03         | 0.12          | 0.07             | 15       |
| T3              | 30d    | 0.06         | 0.23          | 0.45             | 5        |
| TH1             | 30d    | 0.04         | 0.15          | 0.08             | 5        |
| TH2             | 30d    | 0.07         | 0.12          | 0.08             | 5        |
| TH4             | 30d    | 0.10         | 0.17          | 0.13             | 5        |
| T6              | 30d    | 0.36         | 0.44          | 0.68             | 4        |
| TH5             | 30d    | 0.04         | 0.15          | 0.08             | 5        |
| O1              | 30d    | 0.37         | 0.34          | 0.36             | 4        |
| O2              | 30d    | 0.36         | 0.31          | 0.36             | 4        |
| O3              | 30d    | 0.37         | 0.29          | 0.36             | 4        |
| K1              | 30d    | 0.37         | 0.33          | 0.36             | 4        |
| OF0             | 30d    | 0.05         | 0.16          | 0.09             | 15       |
| OF1             | 30d    | 0.07         | 0.17          | 0.10             | 5        |
| P0              | 30d    | 0.06         | 0.17          | 0.10             | 15       |
| P0 payload      | 30d    | -0.06        | 0.00          | -0.05            | 15       |
| P1              | 30d    | 0.08         | 0.21          | 0.11             | 5        |
| P2              | 30d    | 0.09         | 0.19          | 0.11             | 4        |
| P3              | 30d    | 0.08         | 0.17          | 0.11             | 5        |
| P3 payload      | 30d    | -0.02        | 0.07          | 0.04             | 5        |
| G0              | 30d    | 0.04         | 0.13          | 0.08             | 5        |
| D1              | 30d    | 0.37         | 0.28          | 0.35             | 4        |
| D2              | 30d    | 0.37         | 0.28          | 0.36             | 4        |
| S0              | 30d    | 0.25         | 0.26          | 0.43             | 15       |
| S0 span-payload | 30d    | 0.11         | 0.10          | 0.21             | 15       |
| S0 span-metrics | 30d    | 0.01         | 0.13          | 0.14             | 15       |
| S1              | 30d    | 0.28         | 0.28          | 0.44             | 4        |
| S1 span-payload | 30d    | 0.23         | 0.25          | 0.55             | 4        |
| S1 span-metrics | 30d    | 0.01         | 0.22          | 0.22             | 4        |
| S2              | 30d    | 0.29         | 0.29          | 0.45             | 5        |
| S3              | 30d    | 0.28         | 0.27          | 0.45             | 5        |
| S4              | 30d    | 0.35         | 0.32          | 0.41             | 3        |
| S4 span-payload | 30d    | 0.05         | 0.20          | 0.49             | 3        |
| S5              | 30d    | 0.29         | 0.24          | 0.45             | 5        |
| S4 span-metrics | 30d    | 0.01         | 0.12          | 0.16             | 3        |
| S6              | 30d    | 0.30         | 0.24          | 0.45             | 5        |
| S6 span-payload | 30d    | 0.16         | 0.10          | 0.32             | 5        |
| T7              | 30d    | 0.27         | 0.16          | 0.26             | 11       |
| S6 span-metrics | 30d    | 0.01         | 0.11          | 0.23             | 5        |
| T8              | 30d    | 0.37         | 0.20          | 0.29             | 4        |
| T9              | 30d    | 0.39         | 0.21          | 0.29             | 4        |
| T10             | 30d    | 0.05         | 0.05          | 0.22             | 3        |
| T12             | 30d    | 0.43         | 0.34          | 0.38             | 3        |
| TH3             | 30d    | 0.10         | 0.19          | 0.23             | 5        |
| S7              | 30d    | 0.29         | 0.30          | 0.45             | 5        |
| S7 span-payload | 30d    | 0.23         | 0.25          | 0.53             | 5        |
| V6              | 30d    | 0.04         | 0.14          | 0.17             | 15       |
| S7 span-metrics | 30d    | 0.01         | 0.21          | 0.22             | 5        |
| V7              | 30d    | 0.38         | 0.24          | 0.36             | 4        |
| V8              | 30d    | 0.06         | 0.15          | 0.20             | 5        |
| P1              | 1d     | 0.01         | 0.21          | 0.48             | 4        |
| P2              | 1d     | 0.01         | 0.21          | 0.48             | 4        |
| P3              | 1d     | 0.00         | 0.18          | 0.47             | 4        |
| S1              | 1d     | 0.01         | 0.38          | 0.73             | 4        |
| S2              | 1d     | 0.01         | 0.39          | 0.73             | 4        |
| S3              | 1d     | 0.01         | 0.36          | 0.73             | 4        |
| S4              | 1d     | 0.22         | 0.48          | 0.98             | 3        |
| S5              | 1d     | 0.06         | 0.38          | 0.77             | 4        |
| S6              | 1d     | 0.05         | 0.36          | 0.77             | 4        |
| S7              | 1d     | 0.03         | 0.40          | 0.75             | 4        |
| S5 span-payload | 7d     | 0.16         | 0.17          | 0.31             | 4        |
| S5 span-metrics | 7d     | 0.01         | 0.20          | 0.28             | 4        |
| S3 span-payload | 30d    | 0.18         | 0.14          | 0.39             | 4        |
| S3 span-metrics | 30d    | 0.01         | 0.26          | 0.28             | 4        |
| S5 span-payload | 30d    | 0.08         | 0.10          | 0.23             | 4        |
| S5 span-metrics | 30d    | 0.01         | 0.25          | 0.28             | 4        |
| P3 payload      | 1d     | 0.05         | 0.13          | 0.16             | 3        |
| S2 span-payload | 1d     | 0.22         | 0.19          | 0.44             | 3        |
| S2 span-metrics | 1d     | 0.00         | 0.33          | 0.37             | 3        |
| S3 span-payload | 1d     | 0.22         | 0.24          | 0.52             | 3        |
| S5 span-payload | 1d     | 0.19         | 0.24          | 0.39             | 3        |
| S3 span-metrics | 1d     | 0.01         | 0.26          | 0.37             | 3        |
| S5 span-metrics | 1d     | 0.01         | 0.34          | 0.37             | 3        |
| S6 span-payload | 1d     | 0.10         | 0.15          | 0.24             | 3        |
| S6 span-metrics | 1d     | 0.00         | 0.29          | 0.37             | 3        |
| S7 span-payload | 1d     | 0.31         | 0.37          | 0.71             | 3        |
| S7 span-metrics | 1d     | 0.02         | 0.31          | 0.37             | 3        |
| S2 span-payload | 7d     | 0.22         | 0.19          | 0.46             | 3        |
| S2 span-metrics | 7d     | 0.00         | 0.33          | 0.37             | 3        |
| S3 span-payload | 7d     | 0.07         | 0.09          | 0.29             | 3        |
| S3 span-metrics | 7d     | 0.01         | 0.28          | 0.37             | 3        |
| P1 payload      | 30d    | -0.15        | -0.12         | -0.28            | 3        |
| S2 span-payload | 30d    | 0.23         | 0.24          | 0.46             | 3        |
| S2 span-metrics | 30d    | 0.01         | 0.41          | 0.37             | 3        |
| S8              | 30d    | 0.46         | 0.48          | 0.73             | 3        |
| S8 span-payload | 30d    | 0.19         | 0.21          | 0.44             | 3        |
| S8 span-metrics | 30d    | 0.01         | 0.37          | 0.37             | 3        |

### Concurrency proof

#### Concurrency 4 vs sequential (small, mid, p90 at 1d, 7d): FAIL

| measure (B ÷ A)      | median of cells [90% CI] | criterion                     | ok  |
| -------------------- | ------------------------ | ----------------------------- | --- |
| memory               | ×1.000 [1.000–1.000]     | within ±5 %, every cell ±10 % | ✓   |
| read rows / bytes    | ×1.000 / ×1.000          | every cell ±1 %               | ✓   |
| warm latency, median | ×1.04 [1.007–1.110]      | ≤ 1.10                        | ✓   |
| warm latency, p90    | ×1.22 [1.007–1.506]      | ≤ 1.20                        | ✗   |
| cold latency         | ×1.23 [1.082–1.428]      | ≤ 1.15                        | ✗   |
| overload errors      | 0                        | 0                             | ✓   |

72 cells (case × stage × project × window). Per cell:

| cell                               | memory | rows   | bytes  | warm median | warm p90 | cold  |
| ---------------------------------- | ------ | ------ | ------ | ----------- | -------- | ----- |
| V1 1d cea62916                     | ×1.005 | ×1.002 | ×1.001 | ×0.51       | ×0.51    | ×0.27 |
| T0 1d cea62916                     | ×1.000 | ×1.001 | ×1.001 | ×1.14       | ×1.10    | ×1.08 |
| TH0 1d cea62916                    | ×1.000 | ×1.001 | ×1.001 | ×0.83       | ×1.56    | ×2.31 |
| OF0 1d cea62916                    | ×1.000 | ×1.001 | ×1.001 | ×1.06       | ×1.31    | ×2.34 |
| P0 1d cea62916                     | ×1.000 | ×1.001 | ×1.001 | ×1.04       | ×1.69    | ×0.71 |
| S0 1d cea62916                     | ×1.081 | ×1.067 | ×1.067 | ×1.67       | ×0.35    | ×0.44 |
| T7 1d cea62916                     | ×1.000 | ×1.001 | ×1.001 | ×0.89       | ×0.08    | ×0.47 |
| V6 1d cea62916                     | ×1.000 | ×1.001 | ×1.001 | ×0.95       | ×0.29    | ×1.63 |
| V1 7d cea62916                     | ×1.000 | ×1.000 | ×1.000 | ×1.47       | ×8.41    | ×1.54 |
| T0 7d cea62916                     | ×1.000 | ×1.000 | ×1.000 | ×1.55       | ×5.85    | ×1.75 |
| TH0 7d cea62916                    | ×1.000 | ×1.000 | ×1.000 | ×1.40       | ×0.32    | –     |
| OF0 7d cea62916                    | ×1.000 | ×1.000 | ×1.000 | ×1.69       | ×9.55    | ×1.78 |
| P0 7d cea62916                     | ×1.000 | ×1.000 | ×1.000 | ×2.19       | ×6.66    | ×1.42 |
| P0 payload 7d cea62916             | ×1.000 | ×1.000 | ×1.000 | ×1.09       | ×6.84    | ×0.93 |
| P0 payload-scoped 7d cea62916      | ×1.000 | ×1.000 | ×1.000 | ×1.01       | ×0.97    | ×1.18 |
| S0 7d cea62916                     | ×0.999 | ×0.882 | ×0.884 | ×2.86       | ×10.39   | ×1.16 |
| S0 span-payload 7d cea62916        | ×1.000 | ×1.000 | ×1.000 | ×1.02       | ×5.13    | ×1.37 |
| S0 span-metrics 7d cea62916        | ×0.984 | ×1.010 | ×1.008 | ×4.66       | ×13.82   | ×1.69 |
| S0 span-payload-scoped 7d cea62916 | ×1.000 | ×1.000 | ×1.000 | ×1.10       | ×1.66    | ×1.20 |
| S0 span-metrics-scoped 7d cea62916 | ×1.000 | ×1.010 | ×1.008 | ×1.86       | ×3.11    | ×1.89 |
| T7 7d cea62916                     | ×1.000 | ×1.000 | ×1.000 | ×1.22       | ×10.52   | –     |
| V6 7d cea62916                     | ×1.000 | ×1.000 | ×1.000 | ×1.60       | ×1.32    | –     |
| V1 1d b0b172ed                     | ×1.000 | ×1.001 | ×1.001 | ×0.98       | ×1.23    | ×1.06 |
| T0 1d b0b172ed                     | ×1.000 | ×1.001 | ×1.001 | ×0.99       | ×1.77    | ×3.17 |
| TH0 1d b0b172ed                    | ×0.999 | ×1.001 | ×1.001 | ×1.00       | ×2.27    | ×3.33 |
| OF0 1d b0b172ed                    | ×0.999 | ×1.001 | ×1.001 | ×0.96       | ×2.91    | ×3.18 |
| P0 1d b0b172ed                     | ×1.000 | ×1.001 | ×1.000 | ×1.00       | ×0.50    | ×1.00 |
| S0 1d b0b172ed                     | ×1.006 | ×0.999 | ×0.999 | ×0.97       | ×0.14    | ×0.53 |
| T7 1d b0b172ed                     | ×1.000 | ×1.000 | ×1.000 | ×1.16       | ×0.85    | ×0.86 |
| V6 1d b0b172ed                     | ×1.000 | ×1.000 | ×1.000 | ×1.02       | ×0.98    | ×0.87 |
| V1 7d b0b172ed                     | ×1.000 | ×1.000 | ×1.000 | ×0.97       | ×1.54    | ×1.62 |
| T0 7d b0b172ed                     | ×0.999 | ×1.000 | ×1.000 | ×1.03       | ×1.86    | ×1.55 |
| TH0 7d b0b172ed                    | ×1.000 | ×1.000 | ×1.000 | ×1.40       | ×1.24    | –     |
| OF0 7d b0b172ed                    | ×1.000 | ×1.000 | ×1.000 | ×1.14       | ×2.02    | ×1.90 |
| P0 7d b0b172ed                     | ×1.000 | ×1.000 | ×1.000 | ×2.22       | ×2.15    | ×1.43 |
| P0 payload 7d b0b172ed             | ×1.000 | ×1.000 | ×1.000 | ×0.98       | ×9.89    | ×1.93 |
| P0 payload-scoped 7d b0b172ed      | ×1.000 | ×1.000 | ×1.000 | ×0.86       | ×0.87    | ×0.87 |
| S0 7d b0b172ed                     | ×0.990 | ×0.967 | ×0.968 | ×2.02       | ×3.17    | ×1.02 |
| S0 span-payload 7d b0b172ed        | ×1.000 | ×1.000 | ×1.000 | ×1.14       | ×7.62    | ×3.22 |
| S0 span-metrics 7d b0b172ed        | ×1.000 | ×1.004 | ×1.003 | ×1.05       | ×7.01    | ×1.08 |
| S0 span-payload-scoped 7d b0b172ed | ×1.000 | ×1.000 | ×1.000 | ×1.03       | ×0.93    | ×2.84 |
| S0 span-metrics-scoped 7d b0b172ed | ×0.982 | ×1.004 | ×1.004 | ×0.98       | ×1.61    | ×1.03 |
| T7 7d b0b172ed                     | ×1.000 | ×1.000 | ×1.000 | ×1.23       | ×1.21    | –     |
| V6 7d b0b172ed                     | ×0.999 | ×0.999 | ×0.999 | ×1.43       | ×1.47    | ×1.44 |
| V1 1d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×0.99       | ×1.60    | ×1.60 |
| T0 1d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×1.12       | ×0.98    | ×1.57 |
| TH0 1d 13eebeb8                    | ×1.000 | ×1.000 | ×1.000 | ×2.07       | ×2.19    | –     |
| OF0 1d 13eebeb8                    | ×0.999 | ×1.000 | ×1.000 | ×0.99       | ×1.45    | ×1.60 |
| P0 1d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×2.14       | ×2.01    | ×0.89 |
| P0 payload 1d 13eebeb8             | ×1.000 | ×1.000 | ×1.000 | ×1.00       | ×0.49    | ×0.82 |
| P0 payload-scoped 1d 13eebeb8      | ×1.000 | ×1.000 | ×1.000 | ×0.86       | ×1.01    | ×0.81 |
| S0 1d 13eebeb8                     | ×0.964 | ×1.018 | ×1.017 | ×1.85       | ×0.67    | ×0.98 |
| S0 span-payload 1d 13eebeb8        | ×1.000 | ×1.000 | ×1.000 | ×1.04       | ×0.20    | ×0.25 |
| S0 span-metrics 1d 13eebeb8        | ×1.018 | ×0.998 | ×0.998 | ×1.17       | ×0.20    | ×0.72 |
| S0 span-payload-scoped 1d 13eebeb8 | ×1.000 | ×1.000 | ×1.000 | ×1.05       | ×1.02    | ×0.54 |
| S0 span-metrics-scoped 1d 13eebeb8 | ×1.000 | ×0.998 | ×0.999 | ×1.02       | ×0.60    | ×0.96 |
| T7 1d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×0.95       | ×0.52    | –     |
| V6 1d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×0.97       | ×1.45    | ×1.08 |
| V1 7d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×0.63       | ×0.52    | ×1.51 |
| T0 7d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×0.72       | ×0.95    | ×1.50 |
| TH0 7d 13eebeb8                    | ×1.000 | ×1.000 | ×1.000 | ×1.17       | ×0.90    | –     |
| OF0 7d 13eebeb8                    | ×1.000 | ×1.000 | ×1.000 | ×0.98       | ×0.13    | ×1.61 |
| P0 7d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×1.47       | ×0.57    | ×1.37 |
| P0 payload 7d 13eebeb8             | ×1.000 | ×1.000 | ×1.000 | ×0.92       | ×0.95    | ×1.24 |
| P0 payload-scoped 7d 13eebeb8      | ×1.000 | ×1.000 | ×1.000 | ×0.89       | ×1.13    | ×1.00 |
| S0 7d 13eebeb8                     | ×0.999 | ×1.397 | ×1.378 | ×1.07       | ×0.96    | ×1.78 |
| S0 span-payload 7d 13eebeb8        | ×1.000 | ×1.000 | ×1.000 | ×0.94       | ×0.86    | ×0.47 |
| S0 span-metrics 7d 13eebeb8        | ×1.000 | ×1.004 | ×1.004 | ×0.58       | ×1.08    | ×0.79 |
| S0 span-payload-scoped 7d 13eebeb8 | ×1.000 | ×1.000 | ×1.000 | ×0.90       | ×2.78    | ×1.23 |
| S0 span-metrics-scoped 7d 13eebeb8 | ×0.982 | ×0.993 | ×0.995 | ×0.97       | ×1.17    | ×1.22 |
| T7 7d 13eebeb8                     | ×1.000 | ×1.001 | ×1.001 | ×1.13       | ×0.66    | –     |
| V6 7d 13eebeb8                     | ×1.000 | ×1.002 | ×1.002 | ×1.70       | ×0.89    | ×1.42 |

#### Concurrency 2 vs sequential (small, mid, p90 at 1d, 7d): PASS

| measure (B ÷ A)      | median of cells [90% CI] | criterion                     | ok  |
| -------------------- | ------------------------ | ----------------------------- | --- |
| memory               | ×1.000 [1.000–1.000]     | within ±5 %, every cell ±10 % | ✓   |
| read rows / bytes    | ×1.000 / ×1.000          | every cell ±1 %               | ✓   |
| warm latency, median | ×1.02 [1.003–1.043]      | ≤ 1.10                        | ✓   |
| warm latency, p90    | ×1.04 [0.989–1.183]      | ≤ 1.20                        | ✓   |
| cold latency         | ×0.96 [0.928–1.011]      | ≤ 1.15                        | ✓   |
| overload errors      | 0                        | 0                             | ✓   |

72 cells (case × stage × project × window). Per cell:

| cell                               | memory | rows   | bytes  | warm median | warm p90 | cold  |
| ---------------------------------- | ------ | ------ | ------ | ----------- | -------- | ----- |
| V1 1d cea62916                     | ×1.000 | ×1.001 | ×1.001 | ×1.16       | ×0.48    | ×1.05 |
| T0 1d cea62916                     | ×1.000 | ×1.001 | ×1.001 | ×1.08       | ×1.19    | ×1.01 |
| TH0 1d cea62916                    | ×1.000 | ×1.001 | ×1.001 | ×1.08       | ×1.05    | ×1.04 |
| OF0 1d cea62916                    | ×1.000 | ×1.001 | ×1.001 | ×1.06       | ×1.09    | ×0.97 |
| P0 1d cea62916                     | ×1.000 | ×0.997 | ×0.998 | ×0.97       | ×1.23    | ×0.95 |
| S0 1d cea62916                     | ×1.070 | ×1.018 | ×1.018 | ×1.22       | ×0.68    | ×0.55 |
| T7 1d cea62916                     | ×0.998 | ×1.000 | ×1.000 | ×0.91       | ×0.91    | ×0.98 |
| V6 1d cea62916                     | ×1.000 | ×0.996 | ×0.997 | ×1.04       | ×1.06    | ×0.82 |
| V1 7d cea62916                     | ×1.000 | ×1.000 | ×1.000 | ×0.95       | ×0.99    | ×0.96 |
| T0 7d cea62916                     | ×0.999 | ×1.000 | ×1.000 | ×1.01       | ×0.55    | ×0.91 |
| TH0 7d cea62916                    | ×1.000 | ×1.000 | ×1.000 | ×1.02       | ×1.76    | ×0.95 |
| OF0 7d cea62916                    | ×0.999 | ×1.000 | ×1.000 | ×1.21       | ×1.69    | ×0.90 |
| P0 7d cea62916                     | ×1.000 | ×1.000 | ×1.000 | ×0.97       | ×0.51    | ×1.01 |
| P0 payload 7d cea62916             | ×1.000 | ×1.000 | ×1.000 | ×1.06       | ×1.08    | ×1.12 |
| P0 payload-scoped 7d cea62916      | ×1.000 | ×1.000 | ×1.000 | ×1.03       | ×0.99    | ×1.37 |
| S0 7d cea62916                     | ×1.000 | ×1.014 | ×1.013 | ×1.11       | ×0.53    | ×1.03 |
| S0 span-payload 7d cea62916        | ×1.000 | ×1.000 | ×1.000 | ×1.01       | ×1.02    | ×1.31 |
| S0 span-metrics 7d cea62916        | ×0.981 | ×1.003 | ×1.002 | ×1.03       | ×0.77    | ×1.61 |
| S0 span-payload-scoped 7d cea62916 | ×1.000 | ×1.000 | ×1.000 | ×0.95       | ×0.97    | ×0.92 |
| S0 span-metrics-scoped 7d cea62916 | ×1.000 | ×1.003 | ×1.002 | ×1.09       | ×0.54    | ×0.94 |
| T7 7d cea62916                     | ×1.000 | ×1.000 | ×1.000 | ×1.04       | ×0.65    | –     |
| V6 7d cea62916                     | ×1.000 | ×1.000 | ×1.000 | ×1.12       | ×1.18    | ×1.22 |
| V1 1d b0b172ed                     | ×1.000 | ×1.002 | ×1.001 | ×1.00       | ×1.20    | ×1.06 |
| T0 1d b0b172ed                     | ×0.999 | ×1.002 | ×1.001 | ×1.00       | ×1.01    | ×0.86 |
| TH0 1d b0b172ed                    | ×1.000 | ×0.999 | ×0.999 | ×0.97       | ×0.98    | ×0.92 |
| OF0 1d b0b172ed                    | ×1.000 | ×0.999 | ×0.999 | ×0.98       | ×2.57    | ×0.85 |
| P0 1d b0b172ed                     | ×1.000 | ×0.999 | ×0.999 | ×0.97       | ×0.45    | ×0.93 |
| S0 1d b0b172ed                     | ×1.103 | ×1.042 | ×1.042 | ×1.01       | ×1.71    | ×0.29 |
| T7 1d b0b172ed                     | ×1.000 | ×0.998 | ×0.999 | ×1.11       | ×0.59    | ×0.92 |
| V6 1d b0b172ed                     | ×1.000 | ×0.998 | ×0.999 | ×1.02       | ×1.02    | ×0.92 |
| V1 7d b0b172ed                     | ×1.000 | ×1.000 | ×1.000 | ×0.64       | ×0.46    | ×0.90 |
| T0 7d b0b172ed                     | ×1.000 | ×1.000 | ×1.000 | ×0.68       | ×0.49    | ×0.89 |
| TH0 7d b0b172ed                    | ×1.000 | ×1.000 | ×1.000 | ×1.05       | ×1.11    | ×0.90 |
| OF0 7d b0b172ed                    | ×1.000 | ×1.000 | ×1.000 | ×0.78       | ×0.56    | ×0.88 |
| P0 7d b0b172ed                     | ×1.000 | ×1.000 | ×1.000 | ×1.29       | ×1.72    | ×1.00 |
| P0 payload 7d b0b172ed             | ×1.000 | ×1.000 | ×1.000 | ×0.95       | ×0.93    | ×0.96 |
| P0 payload-scoped 7d b0b172ed      | ×1.000 | ×1.000 | ×1.000 | ×0.83       | ×0.10    | ×0.85 |
| S0 7d b0b172ed                     | ×0.933 | ×0.891 | ×0.896 | ×0.59       | ×0.51    | ×0.74 |
| S0 span-payload 7d b0b172ed        | ×1.006 | ×1.000 | ×1.000 | ×1.00       | ×0.22    | ×1.08 |
| S0 span-metrics 7d b0b172ed        | ×1.018 | ×0.993 | ×0.994 | ×0.85       | ×0.78    | ×1.43 |
| S0 span-payload-scoped 7d b0b172ed | ×1.005 | ×1.000 | ×1.000 | ×0.94       | ×0.12    | ×0.51 |
| S0 span-metrics-scoped 7d b0b172ed | ×1.000 | ×0.993 | ×0.994 | ×0.84       | ×2.73    | ×1.46 |
| T7 7d b0b172ed                     | ×1.001 | ×0.999 | ×0.999 | ×0.87       | ×1.06    | –     |
| V6 7d b0b172ed                     | ×1.000 | ×0.999 | ×0.999 | ×0.54       | ×0.79    | ×1.31 |
| V1 1d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×0.74       | ×0.54    | ×1.30 |
| T0 1d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×0.70       | ×0.99    | ×1.40 |
| TH0 1d 13eebeb8                    | ×1.000 | ×1.000 | ×1.000 | ×1.57       | ×2.63    | ×0.97 |
| OF0 1d 13eebeb8                    | ×1.000 | ×1.000 | ×1.000 | ×0.90       | ×1.00    | ×0.88 |
| P0 1d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×1.58       | ×1.63    | ×0.95 |
| P0 payload 1d 13eebeb8             | ×1.000 | ×1.000 | ×1.000 | ×1.00       | ×0.92    | ×0.50 |
| P0 payload-scoped 1d 13eebeb8      | ×1.000 | ×1.000 | ×1.000 | ×1.50       | ×7.55    | ×1.23 |
| S0 1d 13eebeb8                     | ×1.027 | ×0.999 | ×0.999 | ×0.87       | ×0.79    | ×2.21 |
| S0 span-payload 1d 13eebeb8        | ×1.000 | ×1.000 | ×1.000 | ×1.00       | ×2.90    | ×1.03 |
| S0 span-metrics 1d 13eebeb8        | ×1.000 | ×1.005 | ×1.004 | ×0.86       | ×0.91    | ×0.82 |
| S0 span-payload-scoped 1d 13eebeb8 | ×1.000 | ×1.000 | ×1.000 | ×0.89       | ×1.73    | ×2.04 |
| S0 span-metrics-scoped 1d 13eebeb8 | ×1.000 | ×1.005 | ×1.004 | ×2.51       | ×2.75    | ×3.62 |
| T7 1d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×5.33       | ×4.67    | –     |
| V6 1d 13eebeb8                     | ×0.999 | ×1.000 | ×1.000 | ×1.89       | ×1.26    | ×1.63 |
| V1 7d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×1.06       | ×2.01    | ×0.94 |
| T0 7d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×1.38       | ×1.00    | ×1.28 |
| TH0 7d 13eebeb8                    | ×1.000 | ×1.000 | ×1.000 | ×0.69       | ×1.68    | ×0.88 |
| OF0 7d 13eebeb8                    | ×0.999 | ×1.000 | ×1.000 | ×1.16       | ×1.98    | ×1.01 |
| P0 7d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×1.08       | ×4.49    | ×0.99 |
| P0 payload 7d 13eebeb8             | ×1.000 | ×1.000 | ×1.000 | ×1.09       | ×1.02    | ×0.69 |
| P0 payload-scoped 7d 13eebeb8      | ×1.000 | ×1.000 | ×1.000 | ×1.03       | ×11.26   | ×0.93 |
| S0 7d 13eebeb8                     | ×1.028 | ×1.041 | ×1.038 | ×1.53       | ×3.39    | ×1.96 |
| S0 span-payload 7d 13eebeb8        | ×1.000 | ×1.000 | ×1.000 | ×1.04       | ×2.44    | ×0.61 |
| S0 span-metrics 7d 13eebeb8        | ×1.000 | ×1.004 | ×1.003 | ×7.70       | ×10.02   | ×1.02 |
| S0 span-payload-scoped 7d 13eebeb8 | ×1.000 | ×1.000 | ×1.000 | ×1.02       | ×2.77    | ×0.64 |
| S0 span-metrics-scoped 7d 13eebeb8 | ×0.988 | ×1.004 | ×1.003 | ×1.60       | ×5.09    | ×0.84 |
| T7 7d 13eebeb8                     | ×1.001 | ×1.000 | ×1.000 | ×1.39       | ×2.99    | –     |
| V6 7d 13eebeb8                     | ×1.000 | ×1.000 | ×1.000 | ×1.44       | ×1.34    | ×1.14 |

#### Concurrency 2 vs sequential (p99 at 1d): FAIL

| measure (B ÷ A)      | median of cells [90% CI] | criterion                     | ok  |
| -------------------- | ------------------------ | ----------------------------- | --- |
| memory               | ×1.000 [1.000–1.000]     | within ±5 %, every cell ±10 % | ✗   |
| read rows / bytes    | ×1.000 / ×1.000          | every cell ±1 %               | ✓   |
| warm latency, median | ×1.06 [0.900–1.191]      | ≤ 1.10                        | ✓   |
| warm latency, p90    | ×0.75 [0.258–1.146]      | ≤ 1.20                        | ✓   |
| cold latency         | ×0.82 [0.705–1.151]      | ≤ 1.15                        | ✓   |
| overload errors      | 0                        | 0                             | ✓   |

14 cells (case × stage × project × window). Per cell:

| cell                               | memory | rows   | bytes  | warm median | warm p90 | cold  |
| ---------------------------------- | ------ | ------ | ------ | ----------- | -------- | ----- |
| V1 1d bdd9d9fe                     | ×1.000 | ×1.000 | ×1.000 | ×1.27       | ×0.08    | ×0.75 |
| T0 1d bdd9d9fe                     | ×1.000 | ×1.000 | ×1.000 | ×0.90       | ×0.67    | ×1.54 |
| TH0 1d bdd9d9fe                    | ×1.000 | ×1.000 | ×1.000 | ×1.87       | ×1.48    | ×0.79 |
| OF0 1d bdd9d9fe                    | ×1.000 | ×1.000 | ×1.000 | ×1.88       | ×1.38    | ×0.90 |
| P0 1d bdd9d9fe                     | ×1.000 | ×1.000 | ×1.000 | ×0.90       | ×0.82    | ×0.82 |
| P0 payload 1d bdd9d9fe             | ×1.000 | ×1.000 | ×1.000 | ×0.94       | ×0.26    | ×0.55 |
| P0 payload-scoped 1d bdd9d9fe      | ×1.000 | ×1.000 | ×1.000 | ×1.11       | ×1.13    | ×1.40 |
| S0 1d bdd9d9fe                     | ×0.993 | ×0.992 | ×0.992 | ×0.61       | ×0.29    | ×1.15 |
| S0 span-payload 1d bdd9d9fe        | ×1.000 | ×1.000 | ×1.000 | ×1.11       | ×0.08    | ×0.50 |
| S0 span-metrics 1d bdd9d9fe        | ×1.000 | ×1.000 | ×1.000 | ×0.71       | ×0.06    | ×0.70 |
| S0 span-payload-scoped 1d bdd9d9fe | ×1.000 | ×1.000 | ×1.000 | ×1.01       | ×1.09    | ×0.48 |
| S0 span-metrics-scoped 1d bdd9d9fe | ×0.883 | ×1.000 | ×1.000 | ×1.69       | ×2.24    | ×0.85 |
| T7 1d bdd9d9fe                     | ×0.998 | ×1.000 | ×1.000 | ×1.12       | ×0.24    | –     |
| V6 1d bdd9d9fe                     | ×1.000 | ×0.999 | ×1.000 | ×0.47       | ×1.20    | ×1.38 |

#### Sentinels (sequential re-runs after each phase)

| phase run   | cells | memory ratio (median) | warm latency ratio (median) | superseded |
| ----------- | ----- | --------------------- | --------------------------- | ---------- |
| small:1d:1  | 1     | ×1.000                | ×0.78                       | no         |
| small:7d:1  | 7     | ×1.004                | ×0.80                       | no         |
| small:30d:1 | 7     | ×1.000                | ×0.68                       | no         |
| mid:1d:1    | 3     | ×1.000                | ×1.00                       | no         |
| mid:7d:1    | 7     | ×1.000                | ×0.76                       | no         |
| mid:30d:1   | 7     | ×0.982                | ×1.00                       | no         |
| p90:1d:1    | 7     | ×1.000                | ×0.68                       | no         |
| p90:7d:1    | 7     | ×1.000                | ×0.93                       | no         |

#### Latency vs queries in flight: Spearman ρ = 0.065 over 6433 warm executions (latency normalized per cell)

### Skipped

- **T5** (literal not found: tag): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d, p90 1d, p90 7d, p90 30d, p99 1d, p99 7d, p99 30d, largest 1d, largest 7d, largest 30d
- **TH6** (fewer than 1000 rows): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d, p90 1d, p90 7d, p90 30d, p99 1d, p99 7d
- **K2** (fewer than 1000 rows): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d, p90 1d, p90 7d, p99 1d
- **K3** (fewer than 10000 rows): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d, p90 1d, p90 7d, p90 30d, p99 1d, p99 7d
- **P0** (payload: empty page): small 1d, mid 1d, mid 7d, p90 1d, p90 7d
- **P0** (payload-scoped: empty page): small 1d, mid 1d, mid 7d, p90 1d, p90 7d
- **P1** (payload: empty page): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d, p90 1d, p90 7d, p99 1d
- **P1** (payload-scoped: empty page): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d, p90 1d, p90 7d, p99 1d
- **P2** (payload: empty page): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d, p90 1d, p90 7d, p90 30d, p99 1d, p99 7d
- **P2** (payload-scoped: empty page): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d, p90 1d, p90 7d, p90 30d, p99 1d, p99 7d
- **P3** (payload: empty page): small 1d, mid 1d
- **P3** (payload-scoped: empty page): small 1d, mid 1d
- **S0** (span-payload: empty page): small 1d, mid 1d, mid 7d, p90 1d, p90 7d
- **S0** (span-metrics: empty page): small 1d, mid 1d, mid 7d, p90 1d, p90 7d
- **S0** (span-payload-scoped: empty page): small 1d, mid 1d, mid 7d, p90 1d, p90 7d
- **S0** (span-metrics-scoped: empty page): small 1d, mid 1d, mid 7d, p90 1d, p90 7d
- **S1** (span-payload: empty page): small 1d, mid 1d, p90 1d, p90 7d, p90 30d
- **S1** (span-metrics: empty page): small 1d, mid 1d, p90 1d, p90 7d, p90 30d
- **S2** (span-payload: empty page): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d
- **S2** (span-metrics: empty page): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d
- **S3** (span-payload: empty page): small 1d, small 7d, small 30d, mid 1d, mid 7d
- **S3** (span-metrics: empty page): small 1d, small 7d, small 30d, mid 1d, mid 7d
- **S4** (span-payload: empty page): small 1d, mid 1d, p99 1d
- **S4** (span-metrics: empty page): small 1d, mid 1d, p99 1d
- **S5** (span-payload: empty page): small 1d, small 7d, small 30d, mid 1d
- **S5** (span-metrics: empty page): small 1d, small 7d, small 30d, mid 1d
- **S6** (span-payload: empty page): small 1d, mid 1d
- **S6** (span-metrics: empty page): small 1d, mid 1d
- **S8** (fewer than 1000 rows): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d, p90 1d, p90 7d
- **S9** (fewer than 10000 rows): small 1d, small 7d, small 30d, mid 1d, mid 7d, mid 30d, p90 1d, p90 7d, p90 30d, p99 1d
- **S7** (span-payload: empty page): small 1d, mid 1d
- **S7** (span-metrics: empty page): small 1d, mid 1d
- **T4** (literal not found: metadataValue): mid 1d, mid 7d, mid 30d, p90 1d, p90 7d, p90 30d
- **S4** (literal not found: model): p90 1d, p90 7d, p90 30d
- **T12** (literal not found: model): p90 1d, p90 7d, p90 30d
- **S4** (span-payload: Key query span-select failed (code 241, memory)): largest 30d
- **S4** (span-metrics: Key query span-select failed (code 241, memory)): largest 30d

<!-- report:end -->
