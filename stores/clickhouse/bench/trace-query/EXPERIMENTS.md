# Memory experiments: `queryTraces()` on ClickHouse

Running log of every experiment and candidate improvement for `queryTraces()` memory. `FINDINGS.md` holds the
benchmark; this file tracks what we tried, where, and what it showed. Structure mirrors
`aggregate-traces/EXPERIMENTS.md` (OBS-539), whose X-ids are referenced below.

**Target** (agreed 2026-10-07): ≤ 40 MB warm per query for projects up to p99, ≤ ~200 MB for the largest.

**Method**

- Tool: `experiments.ts` (`ab`, `equiv`, `census`, `explain`, `summary`), variants in `variants.ts`. Each variant is
  a settings overlay or a fail-closed rewrite of the project-scoped compiled SQL (anchor must match exactly once);
  variants compose with `+`.
- `ab` runs base and every variant interleaved per rep (order reversed on odd reps), sequentially, 3 s apart, Tier 1
  limits (30 s / 4 GiB / 4 threads), on the replica. Numbers are warm medians from the same session; we never
  compare against an earlier session.
- `equiv` hashes base and variant results on the server (count, order-free sum and ordered hash of
  `cityHash64(result columns)`) and runs base twice as a control. Only counts and hashes leave the server.
- `experiments.smoke.ts` checks every rewrite row-for-row against base in a local throwaway ClickHouse, with
  duplicated roots (exact unmerged copies, same content under a second `dedupeKey`, and copies whose content
  differs and wins the dedupe), and checks that the hash comparison reaches the same verdict.
- Projects: representative small (25 traces / 30d), p90 (~1.3k), p99 (~41k), the heavy p99 project `62b01951`
  (~42k, hit 4 GiB in the benchmark) and the largest (~430k).
- The aggregate track's floor/lab processes shared the replica during these sessions. Per-query memory is not
  affected by neighbours (×1.000 in the concurrency proof); latency is only compared inside our ABAB pairs.

## Improvements

Prod numbers are warm medians; cold is filesystem cache off. All proposed, none implemented in `trace-query.ts` yet.

| #   | Improvement                                                                                                                          | Kind     | Evidence            | Effect                                                                                                           | Status    |
| --- | ------------------------------------------------------------------------------------------------------------------------------------ | -------- | ------------------- | ---------------------------------------------------------------------------------------------------------------- | --------- |
| I1  | Keyset: narrow list, then a second scoped query for the winners' `input` / `metadataRaw` (`nh2`)                                     | compiler | QX03, QX05b         | Removes the blob sort: p99 2.9 GiB → ~200 MiB on its own, every 4 GiB failure succeeds                           | proposed  |
| I2  | Keyset: find the page boundary from `(startedAt, traceId)` only, then read roots inside it (`topn2`)                                 | compiler | QX04/05, QX09       | Memory no longer grows with the window: with I1 + I6, p99 35 / 43 MiB, largest 7d 65 / 52; cold faster than base | proposed  |
| I3  | Page: `uniqExact` total + boundary page instead of window functions over the window (`pg`)                                           | compiler | QX06, QX09          | Largest 30d 503 → 92 MiB; p99 38 MiB; cold faster than base                                                      | proposed  |
| I4  | Delta: limit the delta page first, scoped to the project's roots, then re-read only those traces scoped and time-bounded (`dtop+rs`) | compiler | QX06/07, QX08, QX09 | p99 2.9 GiB → 53 MiB; heavy p99 and largest 7d go from ✗ to 55 / 91 MiB; cold faster                             | proposed  |
| I5  | Groups: distinct threads straight from the window's matching roots (`g2`)                                                            | compiler | QX08, QX09          | Largest 30d 285 → 29 MiB, cold 26 s → 9 s                                                                        | proposed  |
| I6  | `filesystem_prefetches_limit = 8` on these queries (`pf8`), at the Tier 1 default of 4 threads                                       | setting  | QX01, QX09          | Removes most of the ~150 MiB floor without the cold penalty of turning prefetch off or of fewer threads          | proposed  |
| I7  | Relation filters: no span dedupe for existence checks, spans seeded from window roots and `endedAt`-bounded (`sp`)                   | compiler | QX08, QX09          | T7/T9/T10 p99 2.7–3.3 GiB (or ✗) → 26–44 MiB                                                                     | proposed  |
| I8  | Optional: one thread for the keyset lookup only (`t1@2`)                                                                             | setting  | QX09                | Heavy p99 lookup 54 → 39 MiB, +10 s cold                                                                         | trade-off |

## Experiment register

| ID    | Env  | Question                                                           | Result (short)                                                                                                                      | Status            |
| ----- | ---- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------- |
| QX00  | prod | Duplicate census: do a trace's root copies differ?                 | Rare (≤ 11 traces / 30d), all exact copies under one `dedupeKey`                                                                    | done              |
| QX01  | prod | Is the ~165 MiB floor the same for `queryTraces()`?                | Yes; prefetch off → 8–36 MiB until the query's own state dominates                                                                  | done              |
| QX02  | prod | Is sorting the blobs the p99/largest driver? (diagnostic `noblob`) | Yes: p99 30d 2.9–3.9 GiB → 174–184 MiB; largest 7d ✗ → 243–353 MiB                                                                  | done              |
| QX03  | prod | Narrow-then-hydrate, one statement (`nh`) or two (`nh2`)?          | Both fix the blow-up; `nh2` reads half as much. 52 / 52 equivalent                                                                  | done → I1         |
| QX04  | prod | Does scoping / time-bounding the re-read (`rs`) cut memory?        | Bytes 1.3–10× less, memory unchanged on its own                                                                                     | done              |
| QX05  | prod | Top-N in sort-key order (`topn`, `topn2`)?                         | `topn` doesn't read in order for the default sort; `topn2` is window-independent (33–57 MiB at largest 7d)                          | done → I2         |
| QX05b | prod | `nh2+topn2`, and one thread                                        | 19–43 MiB warm everywhere with `nopf+t1`; `bs` dead end                                                                             | done (see QX09)   |
| QX06  | prod | Page mode without window functions (`pg`)                          | 18–27 MiB through p99, 73 at largest (warm, `nopf+t1`); 9 / 9 equivalent                                                            | done → I3         |
| QX07  | prod | Delta (`dtop`) and groups (`rs`)                                   | Delta fixed (42–81 MiB); groups at largest stuck at 245                                                                             | done              |
| QX08  | prod | Relation filters (`sp`); `dtop+rs`; groups `g2`                    | `sp` 18–27 MiB list; `rs` halves delta bytes; `g2` largest 275 → 13                                                                 | done → I4, I5, I7 |
| QX09  | prod | Cold: prefetch × threads × rewrites                                | One thread / 2 threads not shippable cold; 4 threads + `pf8` never slower than base; `rb`, `nopf@2`, `bs@2`, `dtop+rs+nh` dead ends | done → I6, I8     |

## Entries

### QX00: duplicate census (2026-10-07, prod)

Per target and window, server-side counts over the project's root rows in the window: traces, rows, traces with
more than one row (`multiRow`), more than one `dedupeKey` (`multiKey`), rows of the same trace in another tenant,
copies that differ in `startedAt` / `endedAt` / content (`cityHash64` of every result column), and traces whose
lowest `dedupeKey` lies outside the window or tenant.

| Target               | Window | Traces  | Rows    | multiRow | every "differs" counter |
| -------------------- | ------ | ------- | ------- | -------- | ----------------------- |
| small `cea62916`     | 30d    | 25      | 25      | 0        | 0                       |
| p90 `13eebeb8`       | 30d    | 1,337   | 1,345   | 8        | 0                       |
| p99 `bdd9d9fe`       | 30d    | 41,460  | 41,460  | 0        | 0                       |
| p99 heavy `62b01951` | 30d    | 41,852  | 41,863  | 11       | 0                       |
| largest `a62771ca`   | 30d    | 433,895 | 433,900 | 5        | 0                       |

1d has no duplicates anywhere. Every duplicate is an unmerged copy of the same row (same `dedupeKey`, same
content), so today's "arbitrary copy" dedupe is deterministic in practice, and rewrites that keep the winning
`dedupeKey` (QX03) or assume copies share `startedAt` (QX05) are safe on this data. The local smoke still tests
copies that differ, to catch rewrites that would only be correct because prod happens to be clean.

### QX01: prefetch floor (2026-10-07, prod, warm, ABAB)

Settings only: `nopf` = `allow_prefetched_read_pool_for_remote_filesystem = 0, remote_filesystem_read_prefetch = 0`,
`pf8` / `pf16` = `filesystem_prefetches_limit`. Warm median MiB (n = 5, p99 n = 3):

| Case | Target | Window | base  | nopf     | pf8   | pf16  |
| ---- | ------ | ------ | ----- | -------- | ----- | ----- |
| T0   | small  | 1d     | 166   | **8.3**  | 10.2  | 20.3  |
| T0   | small  | 30d    | 166   | **27.5** | 40.8  | 40.8  |
| P0   | small  | 30d    | 167   | **23.6** | 36.7  | 37.1  |
| T0   | p90    | 1d     | 174   | **35.9** | 45.9  | 47.1  |
| T0   | p90    | 30d    | 190   | 132      | 205   | 198   |
| P0   | p90    | 30d    | 174   | **44.0** | 54.7  | 54.2  |
| T0   | p99    | 1d     | 174   | **35.8** | 45.6  | 43.0  |
| P0   | p99    | 1d     | 174   | **24.7** | 33.8  | 33.5  |
| T0   | p99    | 30d    | 2,907 | 2,903    | 2,903 | 3,160 |
| P0   | p99    | 30d    | 174   | 83.0     | 85.2  | 104   |

- The floor is the same ~165–175 MiB the aggregate track found (X10). Turning prefetch off removes it; a limit of
  8 or 16 leaves 10–20 MiB more than off.
- Bytes read are unchanged by every setting. Warm latency is equal or lower with prefetch off at these sizes.
- Once the query's own state is bigger than the floor (keyset at p90/p99 30d), the setting does nothing: p99 T0
  stays at 2.9 GiB. That is QX02's problem.
- Cold latency is not measured here; it is the known cost of these settings (aggregate X25) and is QX09.

### QX02: is blob sorting the driver? (2026-10-07, prod, warm, ABAB)

`noblob` replaces `r.metadataRaw AS metadata, r.input AS input` in `candidates` with empty strings. Not shippable
(the result loses its payload); it only measures what the blobs cost. Warm median MiB, n = 3:

| Case | Target    | Window | base             | noblob | noblob+nopf | MB read base → noblob |
| ---- | --------- | ------ | ---------------- | ------ | ----------- | --------------------- |
| T0   | p90       | 30d    | 201              | 174    | **44**      | 373 → 111             |
| D1   | p90       | 30d    | 282              | 174    | 112         | 385 → 123             |
| T0   | p99       | 30d    | 2,906            | 174    | 83          | 1,566 → 142           |
| D1   | p99       | 30d    | 2,718            | 182    | 158         | 1,578 → 154           |
| T0   | p99 heavy | 30d    | ✗ 4 GiB (2 of 3) | 182    | 85          | 1,723 → 153           |
| D1   | p99 heavy | 30d    | ✗ 4 GiB (2 of 3) | 184    | 156         | 1,735 → 165           |
| T0   | largest   | 1d     | 1,365            | 180    | **35**      | 631 → 109             |
| D1   | largest   | 1d     | 1,482            | 180    | 118         | 643 → 121             |
| T0   | largest   | 7d     | ✗ 4 GiB (3 of 3) | 243    | 272         | — → 206               |
| D1   | largest   | 7d     | ✗ 4 GiB (3 of 3) | 353    | 355         | — → 217               |

- Confirmed: without the blobs, p99 and the heavy p99 project drop from 2.9–3.9 GiB to the floor, and the
  largest project's 7d window succeeds at 243–353 MiB instead of failing at 4 GiB. Warm latency falls 3–6×.
- What's left after the floor is the dedupe itself: ~50–110 MiB at p99 30d (`noblob+nopf`) and ~270–355 MiB at
  largest 7d, where prefetch no longer matters. D1 keeps ~70 MiB more than T0 (it joins the delta table).
- Gate for QX03 passed: removing blobs from the sort is worth building.

### QX03: narrow-then-hydrate (2026-10-07, prod)

Two shapes, both keeping the root's `dedupeKey` in `candidates` so the payload comes from the exact row the base
dedupe picked:

- `nh` (one statement): dedupe, filter, sort and limit on `candidates` without `metadata` / `input` (`__winners`),
  then read the blobs for those `limit` rows by `(startedAt, traceId, dedupeKey) IN __winners` and join them back.
  Applies to keyset and delta.
- `nh2` (two statements, like page mode's payload stage): the narrow list is the response; a second query fetches
  `metadataRaw` / `input` for the returned keys, project-scoped. Keyset only (`#1` rows below are that second query).

**Equivalence** (`equiv`, server-side hashes; base run twice as a control): 52 comparisons, 0 mismatches, every
control stable — T0, T1, T3, T7, T9, T10, O1, O2, K1, K2, D1 on p90 30d; T0, T1, T4, O2, K1, K2, D1 on p99 30d;
T0, T1, O2, K1, D1 on the heavy p99 project (7d) and on the largest (1d). (T4 has no metadata literal on the p90
project.) For `nh2`, prod compares the narrow list against base without the two blob columns; the lookup itself is
checked row-for-row (including blobs) by the local smoke, which also passes with duplicate copies whose content
differs.

Warm median MiB, n = 3 (`nh2` shows list / hydrate):

| Case | Target    | Window | base             | nh  | nh2       | nh+nopf | nh2+nopf    |
| ---- | --------- | ------ | ---------------- | --- | --------- | ------- | ----------- |
| T0   | small     | 30d    | 166              | 203 | 166 / 181 | 35      | **23 / 27** |
| T0   | p90       | 30d    | 199              | 200 | 174 / 197 | 48      | **40 / 37** |
| D1   | p90       | 30d    | 248              | 202 | —         | 116     | —           |
| T0   | p99       | 30d    | 2,906            | 212 | 174 / 198 | 97      | 83 / 45     |
| T0   | p99 heavy | 30d    | ✗ 4 GiB (2 of 3) | 213 | 175 / 198 | 93      | 89 / 49     |
| O2   | p99 heavy | 30d    | ✗ 4 GiB (1 of 3) | 213 | 178 / 198 | 93      | 84 / 52     |
| D1   | p99 heavy | 30d    | ✗ 4 GiB (2 of 3) | 215 | —         | 163     | —           |
| T0   | largest   | 1d     | 1,319            | 202 | 180 / 195 | 59      | **34** / 49 |
| T0   | largest   | 7d     | ✗ 4 GiB (3 of 3) | 275 | 270 / 195 | 275     | 273 / 49    |
| D1   | largest   | 7d     | ✗ 4 GiB (3 of 3) | 363 | —         | 366     | —           |

- Both shapes remove the blow-up: p99 30d 2.9 GiB → ~210 MiB, every 4 GiB failure succeeds, and warm latency
  drops 2–5×. O2 (sorted by `endedAt`) behaves the same as T0.
- `nh` reads the root table twice (MB read ~2× `nh2`'s list) because the blob lookup is a second scan of the
  window. `nh2`'s list costs exactly what `noblob` costs, and its lookup reads 11–32 MB.
- With prefetch off, `nh2` reaches the target at small and p90 (23–40 MiB) and at largest 1d. What's left above
  40 MiB is the dedupe of the whole window: ~85 MiB at p99 30d, ~270 MiB at largest 7d (not prefetch, it's the
  same with it off). The lookup's ~45–50 MiB comes from decompressing whole blob granules for 101 rows.
- Delta keeps ~115–165 MiB with prefetch off; that is the join against the delta table (QX07).
- Status: `nh2` adopted as the base for the remaining experiments (cheapest list, same result).

### QX04 / QX05: scoped re-read and top-N (2026-10-07, prod)

- `rs` (aggregate X17 `rs`): the outer `current_roots` re-read gets the tenant, the window and `endedAt >= from`;
  the seed scan gets `endedAt >= from` (partition bound).
- `topn` (first attempt): read the root table directly, `ORDER BY startedAt, traceId, dedupeKey`, `LIMIT 1 BY
traceId`, `LIMIT n`. `EXPLAIN` on p99 30d: ascending (O1) reads `InOrder`; the default `startedAt DESC,
traceId ASC` stays `ReadType: Default` (mixed directions), so it still sorts the window. Not measured further.
- `topn2`: same idea, exact for both directions. A first pass reads only `(startedAt, traceId)` for the window,
  `DISTINCT … ORDER BY startedAt LIMIT n`, and returns the boundary `startedAt`; the list then reads only roots at
  or inside that boundary (primary-key pruned: 146–148 of ~6,200 granules on p99 30d, vs 6,208 for base). Valid
  because copies share `startedAt` (QX00); the smoke shows it differs from base when copies' content differs, as
  expected.

Warm median MiB, n = 3; `nh2` lists show list / lookup:

| Case | Target    | Window | base       | rs    | nh2+rs    | nh2+rs+nopf | topn2  | topn2+nopf |
| ---- | --------- | ------ | ---------- | ----- | --------- | ----------- | ------ | ---------- |
| T0   | small     | 30d    | 166        | 152   | 152 / 200 | **22 / 31** | 191    | **28**     |
| T0   | p90       | 30d    | 188        | 174   | 161 / 201 | 44 / 37     | 163    | **33**     |
| O1   | p90       | 30d    | 238        | 165   | 161 / 201 | 52 / 29     | **37** | **33**     |
| K2   | p90       | 30d    | 225        | 163   | 161 / 201 | 44 / 71     | 164    | 68         |
| T0   | p99       | 30d    | 2,652      | 2,902 | 176 / 199 | 87 / 45     | 164    | 91         |
| K2   | p99       | 30d    | 3,267      | —     | —         | 82 / 33     | 165    | **31**     |
| O1   | p99       | 30d    | 2,909      | —     | —         | 91 / 72     | 84     | 75         |
| T0   | p99 heavy | 30d    | ✗ (3 of 3) | —     | —         | 80 / 53     | 162    | 51         |
| K2   | p99 heavy | 30d    | ✗ (2 of 3) | —     | —         | 90 / 38     | 163    | **39**     |
| O1   | p99 heavy | 30d    | ✗ (3 of 3) | —     | —         | 88 / 40     | 102    | 85         |
| T0   | largest   | 1d     | 1,381      | —     | 214 / 195 | 73 / 55     | 163    | 51         |
| T0   | largest   | 7d     | ✗ (3 of 3) | —     | 284 / 195 | 262 / 55    | 163    | **53**     |
| K2   | largest   | 7d     | ✗ (3 of 3) | —     | 289 / 197 | 259 / 39    | 163    | **54**     |
| O1   | largest   | 7d     | ✗ (3 of 3) | —     | 280 / 194 | 267 / 51    | 61     | **57**     |

- `rs` alone cuts bytes read 10× at small (102 → 10 MB) and ~1.3× at p90, and doesn't change memory: the re-read
  wasn't what held memory, the blobs and the floor were. With `nh2` it brings the list's bytes from 110–153 MB to
  8–55 MB.
- `topn2` is the first variant whose memory doesn't grow with the window: 33–57 MiB at largest 7d, where
  `nh2+rs+nopf` still needs ~260 MiB to dedupe 450k roots. It reads 7–51 MB.
- Ascending `topn2` (O1) skips most of the floor even with prefetch on (37–61 MiB): its pass reads in order, which
  doesn't use the prefetched read pool.
- What's left at p99 (31–91 MiB) tracks the response: the 101 returned rows carry 1–5 MB of blobs, and the table
  is sorted by `(startedAt, traceId, dedupeKey)` with no tenant prefix, so every granule a lookup touches holds
  other tenants' blob rows too (a hydrate for 101 keys on the 25-trace project reads ~92k rows).

**Equivalence** (`rs`, `nh2+rs`, `topn2`, `nh2+topn2`): p90 30d on T0, T1, T3, T7, T9, T10, O1, O2, K1, K2, D1;
p99 and heavy p99 30d on T0, T1, T4, O1, K2; largest 7d on T0, O1, K2. 0 mismatches. Where base itself fails
at 4 GiB (heavy p99 and largest 7d), only the narrow comparison (`nh2+…` against base without blobs) can run, and
it matches; full-row comparisons there are recorded as inconclusive, not as matches.

### QX05b: `nh2+topn2` and one thread (2026-10-07, prod)

`nh2+topn2`: `topn2`'s boundary list without the blob columns, then `nh2`'s lookup. `t1` = `max_threads = 1`
(settings apply to both statements). Warm median MiB, n = 3, list / lookup:

| Case | Target    | Window | base       | nh2+topn2+nopf | **nh2+topn2+nopf+t1** | topn2+nopf+t1 | nh2+rs+nopf+t1 |
| ---- | --------- | ------ | ---------- | -------------- | --------------------- | ------------- | -------------- |
| T0   | p99       | 30d    | 2,907      | 53 / 62        | **23 / 28**           | 31            | 60 / 28        |
| K2   | p99       | 30d    | 3,267      | 30 / 32        | **21 / 27**           | 27            | 60 / 27        |
| O1   | p99       | 30d    | 2,903      | 45 / 70        | **28 / 64**           | 73            | 60 / 64        |
| T0   | p99 heavy | 30d    | ✗ (1 of 3) | 28 / 41        | **19 / 37**           | 48            | 54 / 37        |
| K2   | p99 heavy | 30d    | ✗ (3 of 3) | 34 / 38        | **22 / 26**           | 37            | 54 / 27        |
| O1   | p99 heavy | 30d    | ✗ (3 of 3) | 70 / 47        | **27 / 21**           | 35            | 54 / 21        |
| T0   | largest   | 7d     | ✗ (3 of 3) | 60 / 45        | **43 / 37**           | 49            | 207 / 37       |
| O1   | largest   | 7d     | ✗ (3 of 3) | 56 / 54        | **39 / 38**           | 55            | 207 / 38       |

- One thread roughly halves what's left: per-thread read buffers were most of it once the floor is gone.
- `nh2+topn2+nopf+t1` is within 40 MiB on every p99 statement except the oldest-first (O1) lookup on `bdd9d9fe`
  (64 MiB, reading 45 MB to return 2.7 MB of blobs), and at 37–43 MiB on the largest project at 7d (target
  ≤ 200). Bytes read are 13–30 MB per statement, down from 1.6–1.7 GB.
- Latency: list 180–240 ms, lookup 100–160 ms warm with one thread, vs 1.6–2.3 s for base. One thread costs
  ~2× over `nopf` alone, still well below base.
- `bs` (`max_block_size = 1024`, `preferred_block_size_bytes = 1 MiB`) on top: list 23 → 53 MiB, lookup unchanged.
  Dead end.

### QX06 / QX07: page, delta, groups (2026-10-07, prod)

- `pg` (page): the base computes `row_number()` and `count() OVER ()` over every deduped root in the window. `pg`
  takes the total as `uniqExact(traceId)` over the window's matching roots and builds the page with `topn2`'s
  boundary at `offset + perPage` distinct traces, numbered in the same order (row 1 is still returned for the
  total). Blobs were never in page mode.
- `dtop` (delta): the base dedupes the whole window, then joins every delta row since the cursor, for every tenant
  (`GROUP BY traceId` over the delta table). `dtop` limits the delta page first, scoped to the project's matching
  window roots and ordered by cursor, and re-reads only those traces' roots.
- `g2` / `rs` (groups): `G0` already never reads blobs; only the floor and the window dedupe apply.

**Equivalence**: `pg` on P0, P1 (offset 1,000), P3 (filtered) at p90, p99 and largest 30d: 9 / 9 match. `dtop`
on D1 at p90, p99, heavy p99 and largest, 1d and 30d: 6 match, 2 inconclusive (base fails at 4 GiB on heavy p99
and largest 30d). Local smoke: all match, including duplicated roots.

Warm median MiB, n = 3:

| Case | Target    | Window | base       | nopf       | variant        | +nopf | +nopf+t1 | MB read base → variant |
| ---- | --------- | ------ | ---------- | ---------- | -------------- | ----- | -------- | ---------------------- |
| P0   | small     | 30d    | 167        | 24         | pg 181         | 25    | **22**   | 101 → 9                |
| P0   | p90       | 30d    | 174        | 45         | pg 178         | 25    | **18**   | 111 → 12               |
| P1   | p90       | 30d    | 174        | 45         | pg 178         | 59    | **27**   | 111 → 21               |
| P0   | p99       | 30d    | 174        | 82         | pg 178         | 29    | **19**   | 142 → 23               |
| P1   | p99       | 30d    | 174        | 82         | pg 177         | 51    | **20**   | 142 → 26               |
| P0   | largest   | 30d    | 491        | 477        | pg 187         | 86    | **73**   | 327 → 124              |
| D1   | p90       | 30d    | 258        | 199        | dtop 180       | 33    | **28**   | 385 → 134              |
| D1   | p99       | 30d    | 2,720      | 2,969      | dtop 180       | 50    | 45       | 1,578 → 151            |
| D1   | p99 heavy | 30d    | ✗ (2 of 3) | 4,048      | dtop 184       | 55    | 52       | 1,736 → 158            |
| D1   | largest   | 1d     | 1,498      | 1,432      | dtop 185       | 47    | 42       | 644 → 137              |
| D1   | largest   | 7d     | ✗ (3 of 3) | ✗ (3 of 3) | dtop 190       | 86    | **81**   | — → 193                |
| G0   | p90       | 30d    | 174        | 20         | rs 23 (+nopf)  | —     | **15**   | 106 → 13               |
| G0   | p99       | 30d    | 174        | 44         | rs 48 (+nopf)  | —     | **32**   | 122 → 29               |
| G0   | largest   | 30d    | 273        | 279        | rs 260 (+nopf) | —     | 245      | 238 → 160              |

- Page mode reaches 18–27 MiB through p99 and 73 MiB at the largest project's 30d window (target ≤ 200). What
  remains at the largest is the exact total (`uniqExact` over ~434k traces, 124 MB read).
- Delta is under 200 MiB everywhere and fixes the failures, but stays at 42–52 MiB at p99 and 1d largest: it
  still re-reads the winners' roots without a tenant or window bound (most of the ~150 MB; the whole delta table
  is ~11 MB, see D0 in `FINDINGS.md`). Next: `dtop+rs`.
- Groups at the largest project stay at 245 MiB: distinct threads over 434k roots. Next: `g2` (no root dedupe).

### QX08: relation filters, and the delta / groups follow-ups (2026-10-07, prod)

- `sp` (aggregate X17 `sp`): `current_spans` feeds only existence checks (`traceId IN (SELECT s.traceId FROM
current_spans s …)`; the rewrite refuses otherwise), and a duplicate span can't change whether a trace has a
  matching span. So: no span dedupe, spans seeded from the project's window roots instead of the deduped
  `root_scope`, and bounded by `endedAt >= from`.
- `dtop+rs`: `dtop` plus the scoped, time-bounded re-read. `g2`: `G0`'s distinct thread ids straight from the
  window's matching roots, without the root dedupe.

**Equivalence**: `sp` and `sp+nh2+topn2` on T7, T9, T10 at p90 30d, p99 30d and largest 1d: 11 match, 1
inconclusive (T10 p99 30d `sp` alone: base and variant both hit 4 GiB; `sp+nh2+topn2` there matches). `dtop+rs` at
p90, p99, largest 1d: 3 / 3. `g2` at p90, p99, largest 30d: 3 / 3. Local smoke: all match.

Warm median MiB, n = 3, list / lookup:

| Case | Target  | Window | base       | nh2+topn2+nopf+t1 | **sp+nh2+topn2+nopf+t1** | MB read (list)    |
| ---- | ------- | ------ | ---------- | ----------------- | ------------------------ | ----------------- |
| T7   | p90     | 30d    | 236        | 25 / 28           | **25 / 27**              | 481 → 226 → 25    |
| T9   | p90     | 30d    | 211        | 23 / 29           | **24 / 29**              | 481 → 229 → 26    |
| T7   | p99     | 30d    | 2,708      | 91 / 29           | **27 / 28**              | 1,804 → 488 → 104 |
| T9   | p99     | 30d    | 3,315      | 72 / 28           | **26 / 29**              | 1,789 → 462 → 71  |
| T10  | p99     | 30d    | ✗ (3 of 3) | 91 / 29           | **27 / 32**              | — → 493 → 109     |
| T7   | largest | 1d     | 1,396      | 43 / 61           | 18 / 63                  | 885 → 517 → 146   |
| T9   | largest | 1d     | 2,079      | 38 / 37           | **18 / 39**              | 879 → 505 → 25    |
| T10  | largest | 1d     | 1,420      | 42 / 37           | **19 / 39**              | 885 → 519 → 147   |

| Case | Target    | Window | base       | previous best   | new                | MB read   |
| ---- | --------- | ------ | ---------- | --------------- | ------------------ | --------- |
| D1   | p99       | 30d    | 2,974      | dtop+nopf+t1 47 | dtop+rs+nopf+t1 47 | 151 → 60  |
| D1   | p99 heavy | 30d    | ✗ (1 of 3) | 50              | 50                 | 158 → 68  |
| D1   | largest   | 7d     | ✗ (3 of 3) | 80              | 79                 | 193 → 107 |
| G0   | p99       | 30d    | 174        | rs+nopf+t1 32   | **g2+nopf+t1 9.6** | 29 → 10   |
| G0   | largest   | 30d    | 275        | 245             | **g2+nopf+t1 13**  | 160 → 20  |

- Relation filters: `sp` takes the span side from 460–520 MB read and up to 91 MiB to 25–146 MB and 18–27 MiB, and
  halves latency (T7 p99 1.9 s → 0.75 s warm). Everything is inside 40 MiB except the largest project's T7
  lookup (63 MiB, still far under 200).
- Delta: `rs` halves bytes read but memory stays at 47–50 MiB at p99. The rest is the winners' blobs (delta
  still returns them from `candidates`); next is `dtop+rs+nh`, which hydrates them in a separate scoped read.
- Groups: `g2` is the biggest single win of the session (largest 30d 275 → 13 MiB).

### QX09: cold reads, threads and prefetch (2026-10-07, prod)

Every arm above was warm. Here each arm also runs cold (filesystem cache off) 2–3 times before its warm reps, in
the same ABAB order. The Tier 1 timeout is 30 s, so ✗ means > 30 s. `<id>@2` applies a settings overlay to the
lookup (stage 2) only.

**One thread is not shippable.** With `t1`, `nh2+topn2` on the small project takes 26 s cold for the list (5 MB
read) vs 6 s at 4 threads, and the lookup 10–23 s; at p99 every `t1` arm times out cold while base finishes in
21–24 s. Prefetch doesn't help with one thread (`t1+pf8` 26.7 s, `t1+nopf` 26.4 s): cold time follows the number of
remote reads in flight, not bytes. Thread count at `pf8`, T0 30d, list / lookup:

| Target     | Threads              | warm MiB | cold s              | base cold s |
| ---------- | -------------------- | -------- | ------------------- | ----------- |
| small      | 4 (Tier 1 default)   | 24 / 28  | 5.9 + 2.7           | 15–19       |
| small      | 2                    | 24 / 22  | 11.6 + 5.4          |             |
| p99        | 4                    | 35 / 43  | 9.4 + 3.1           | 21–24       |
| p99        | 3                    | 30 / 39  | 12.6–15.2 + 5.3–5.8 |             |
| p99        | 2                    | 29 / 39  | 18.1–18.5 + 6.4–6.9 |             |
| p99        | 4, lookup 1 (`t1@2`) | 35 / 30  | 8.8 + 12.4          |             |
| p99 heavy  | 4                    | 30 / 54  | 7.8 + 2.9           | ✗ memory    |
| p99 heavy  | 2                    | 26 / 48  | 16.2 + 5.8          |             |
| p99 heavy  | 4, lookup 1 (`t1@2`) | 29 / 39  | 8.6 + 12.8          |             |
| largest 7d | 4                    | 65 / 52  | 8.4–14.0 + 3.1–3.6  | ✗ memory    |

- Memory falls with fewer threads, cold time grows in proportion. 4 threads is the only setting that is never
  slower than base cold; it's faster everywhere (T0 p99: 12.5 s vs 22 s).
- Lookup: at 2+ threads the heavy project's lookup stays at 46–55 MiB whatever else changes: `nopf@2` 49,
  `bs@2` 55, `rb` (128 KiB read buffers) 52. One thread for the lookup only (`t1@2`) gets it to 39 MiB at
  +10 s cold. It reads 21 MB to return 101 traces' blobs: the granules around the winners belong to other
  traces and tenants (no tenant prefix in the sort key, see QX05).
- `rb` looked like a 2× win on its first cold rep (list 36 → 18 MiB); the warm medians are identical to plain
  `pf8`. Dead end.

Best stack per mode at 4 threads and `pf8` (warm median MiB, n = 2–5; cold s, n = 2):

| Mode     | Case | Target    | Window | Stack              | warm MiB | cold s     | base warm / cold  |
| -------- | ---- | --------- | ------ | ------------------ | -------- | ---------- | ----------------- |
| keyset   | T0   | small     | 30d    | `nh2+topn2+pf8`    | 24 / 28  | 8.6        | 166 / 15–19       |
| keyset   | T0   | p99       | 30d    | `nh2+topn2+pf8`    | 35 / 43  | 12.5       | 2,779 / 21–24     |
| keyset   | T0   | p99 heavy | 30d    | `nh2+topn2+pf8`    | 30 / 54  | 10.7       | ✗ / ✗             |
| keyset   | T0   | largest   | 7d     | `nh2+topn2+pf8`    | 65 / 52  | 12–17      | ✗ / ✗             |
| page     | P0   | small     | 30d    | `pg+pf8`           | 27       | 12.7–13.4  | 167 / 17–18       |
| page     | P0   | p99       | 30d    | `pg+pf8`           | 38       | 16.3–17.4  | 174 / 20–22       |
| page     | P0   | largest   | 30d    | `pg+pf8`           | 92       | 24.6–25.7  | 503 / ✗, 29.8     |
| relation | T7   | p99       | 30d    | `sp+nh2+topn2+pf8` | 44 / 42  | ✗          | 2,972 / ✗         |
| relation | T7   | largest   | 1d     | `sp+nh2+topn2+pf8` | 37 / 68  | 22.2 + 3.4 | 1,410 / ✗         |
| delta    | D1   | p99       | 30d    | `dtop+rs+pf8`      | 53       | 17.0–18.0  | 2,910 / 20.5–22.2 |
| delta    | D1   | p99 heavy | 30d    | `dtop+rs+pf8`      | 55       | 15.4–15.6  | ✗ / ✗             |
| delta    | D1   | largest   | 7d     | `dtop+rs+pf8`      | 91       | 18.0       | ✗ / ✗             |
| groups   | G0   | largest   | 30d    | `g2+pf8`           | 29       | 8.8–9.1    | 285 / 24.5–27     |

- Every stack is at or below base cold, and every case base fails (✗ memory) now finishes cold in 8–26 s.
  T7 p99 times out cold in both arms; the span scan is the cold cost there (aggregate I9, span-name index).
- `dtop+rs+nh` (delta winners' blobs joined in one statement) is 37–44 MiB warm with one thread but times out
  cold at every thread count (base 21 s). `dtop+rs` without it is the delta candidate; a two-stage delta lookup
  like `nh2` is the next thing to try for the remaining 53–55 MiB.
- Against the target (40 MB ≈ 38 MiB up to p99, 200 MB at the largest): the largest project is inside 200
  everywhere (37–92 MiB). Up to p99, lists and pages are at 24–38 MiB; the keyset lookups (43–54), T7 at p99
  (42–44) and delta (53–55) are 1.1–1.4× over. Getting those under 38 MiB costs either one thread for the lookup
  (`t1@2`, +10 s cold) or a schema change (tenant-prefixed sort key / narrow list table, §5 of the plan).
