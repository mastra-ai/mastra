# Schema proposals for `aggregateTraces()`: how to be confident before shipping

Companion to [EXPERIMENTS.md](./EXPERIMENTS.md). That file records what each change saved; this one covers what
each change risks, the facts it depends on, and how to test it before it reaches the multi-tenant cluster.

Target: 10–30 MiB per query for most projects, ≤ 256 MiB for the largest. Constraint: avoid adding write-path
complexity unless it is researched and testable ahead of time.

## Summary

| Tier | Change                                                                                              | Write path                                       | Correctness risk                                               | Evidence               | Recommendation            |
| ---- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------- | ---------------------- | ------------------------- |
| 0    | Compiler rewrites that keep every dedupe (`safe`) + `filesystem_prefetches_limit = 8` for small–p90 | none                                             | none (0 mismatches / 2,880)                                    | prod warm + cold       | **ship**                  |
| 1    | Span-name index `(org, project, name, traceId)`                                                     | 1 MV, no sums                                    | none found: span names never change between copies             | prod facts, lab memory | **research + shadow**     |
| 1    | One token/cost row per usage emission (ReplacingMergeTree, keyed by an emission id)                 | writer stamps an id, 1 row per emission, no sums | must key by emission, not span (rolled-up usage shares a span) | prod facts, lab memory | **research + shadow**     |
| 1    | Narrow token rows ordered by trace (ReplacingMergeTree, read with `FINAL`)                          | 1 MV, no sums                                    | none: same dedupe key as today                                 | lab memory             | fallback to per-call rows |
| 3    | Hourly token/cost rollup                                                                            | 2 MVs with sums or a scheduled recompute         | resumed traces change old hours; retries; roots rewritten      | prod facts, lab memory | **not viable now**        |
| 2    | Per-trace token/cost rollup (sums)                                                                  | 1 MV with sums                                   | retries double-count                                           | lab memory             | superseded by narrow rows |
| 3    | Drop query-time root dedupe                                                                         | writer change                                    | **roots are rewritten today**                                  | prod facts             | **no**                    |
| 3    | Token/cost totals on the root row                                                                   | writer change                                    | 4% of token rows land after the root ends                      | prod facts             | **no**                    |

## Realistic spread: Tier 0 only (prod, 30 days, peak MiB, warm median)

`safe` + prefetch limit 8 for small–p90; `safe` alone for p99 and largest (the limit makes their cold reads
time out).

| Case                                  | small   | mid     | p90     | p99     | largest |
| ------------------------------------- | ------- | ------- | ------- | ------- | ------- |
| F0 count, no filter                   | 18      | 20      | 27      | 162     | 177     |
| F3 `spans.some`                       | 21      | 25      | 34      | 170     | 208     |
| E1 by entity + interval               | 18      | 28      | 43      | 159     | 219     |
| E3 `spans.some` + metadata + distinct | 24      | 43      | 40      | 167     | 294     |
| E4 token/cost by entity               | 34      | 49      | 38      | 293     | 867     |
| T1 token/cost totals                  | 31      | 47      | 37      | 302     | 866     |
| T3 token/cost by thread               | 31      | 47      | 36      | 299     | 866     |
| as compiled today (range)             | 166–225 | 170–224 | 177–227 | 174–321 | 296–971 |

Cold (filesystem cache off), seconds: F0 6–9 for small–p90, 11 at p99, 20 at largest. `spans.some` and
token/cost: 13–22 for small–p90, 24–26 at p99, over 30 (timeout) at largest. The prefetch limit adds 1–5 s.

Without the prefetch limit, p99 non-token queries would be 56–121 MiB warm, but cold `spans.some` and token/cost
then exceed 30 s. Token/cost is the outlier: every dedupe kept, the `(traceId, metricId)` dedupe of token rows
costs ~470 MiB on the largest project by itself (lab, isolated).

## What the replica tells us (read-only, all tenants, last 7 days, `prechecks.ts`)

| Fact                                                                | Result                                                                             | Consequence                                                                                                                        |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Trace roots stored more than once                                   | 437 of 542k traces (0.08%), up to 263 copies; 434 of them with different `endedAt` | Roots are **rewritten** as traces update. The query-time root dedupe is load-bearing; a rollup fed from roots counts each rewrite. |
| Token rows stored more than once                                    | 0 of 1.26M                                                                         | Today's writers don't duplicate token rows; not a guarantee.                                                                       |
| Spans stored more than once                                         | 4.4k of 5.3M (0.08%), up to 64 copies; **0 with a different name**                 | A span-name index is exact.                                                                                                        |
| Token rows recorded after the root ended                            | 4.3% (1.2% more than a minute after)                                               | Token totals written onto the root would need root rewrites.                                                                       |
| Token rows in a different hour than the root's start                | 1.2% of rows, **9.9% of tokens**                                                   | Hour attribution for a rollup materially changes hourly numbers.                                                                   |
| Token rows with no `rootEntityName` / a different one than the root | 2.6% / 0.14%                                                                       | A rollup fed from token rows alone would misattribute ~2.7% of rows.                                                               |
| Traces crossing an hour boundary                                    | 0.37% (p99 duration 172 s)                                                         | Small, but these are the token-heavy ones.                                                                                         |
| Hourly rollup rows                                                  | 23k for 545k roots (×23 fewer)                                                     | Small table.                                                                                                                       |
| Span-name index rows                                                | 3.8M for 5.3M span rows                                                            | Few rows saved; the win is a narrow, trace-keyed layout.                                                                           |

Not visible from the read-only service: insert sizes and part counts (access denied). These are needed to size
write cost (step 4 below).

## How to be confident (every Tier ≥ 1 change)

1. **Facts first.** Re-run `prechecks.ts` before each decision. A fact that holds today (e.g. 0 duplicate token
   rows) is not a guarantee, so it also becomes an alert (step 6).
2. **Query equivalence offline.** `lab.ts equiv` runs every case through the current path and the new path on
   the 15 pulled projects and compares rows. Required: 0 mismatches. (Done for every variant so far, ~20k
   comparisons, 0 mismatches.)
3. **Feed the new table the way production will, then break it.** The lab filled tables with `INSERT … SELECT`.
   Production MVs only see each inserted block. Replay the pulled rows as a stream of production-sized inserts
   through the real MVs, and inject what writers actually do: retried batches, retries re-split into different
   batches, out-of-order and late token rows, rewritten roots (up to hundreds of copies). Re-run step 2 after
   each. `retries.ts` is the starting point.
4. **Measure write cost.** Each MV writes a part per insert and adds merges. Replay at 1× and 3× production rate
   on a staging Cloud service, with and without the MV: insert latency, parts per minute, merge CPU, storage.
   Needs insert sizes from the writer service (not visible from the replica).
5. **Shadow in production.** New tables are additive and change no existing table or query. Create, backfill,
   then reconcile daily per tenant (new table vs raw: counts exact, sums within float tolerance). In the API,
   compute both paths for a sample of real requests and log differences while serving the current result.
   Cover at least one deploy and one incident (retries cluster there). Measure cold reads here too: the lab
   can't.
6. **Roll out behind the planner with a kill switch.** Route to the new table only for supported shapes and
   flagged tenants; anything else takes the current path. Turning the route off is instant and the tables are
   harmless unused. Alerts: duplicate rates (roots, tokens, spans), reconciliation diffs, part counts.

## Tier 1: span-name index

**What.** `mastra_trace_span_names (organizationId, projectId, name, traceId)`, ReplacingMergeTree, partitioned
by day, fed by an MV on `mastra_span_events` (projection of 4 columns, no sums). `spans.some(name = X)` becomes a
key lookup; other span predicates keep scanning.

**Buys (lab).** p99 F3 94 → 27 MiB, largest 357 → 115 MiB. Expected to fix cold `spans.some` (16–26 s today
even on tiny projects): unverified, step 5.

**Why low risk.** It answers "does a span with this name exist in the trace". Duplicates, retries and unmerged
parts can't change that, and span names never change between copies (prechecks).

**Open.** TTL and deletes must match `mastra_span_events`; backfill must finish before routing; write cost (step
4).

## Tier 1: narrow token rows ordered by trace

**What.** `mastra_usage_rows (organizationId, projectId, cityHash64(traceId), metricId)` ReplacingMergeTree with
only the columns the token join reads, fed by an MV that copies rows (no sums). Queries read it with `FINAL`
instead of grouping by `(traceId, metricId)`.

**Buys (lab, X23).** Largest E4 873 → 361 MiB, exact under injected retries (the dedupe key is the same one the
query uses today). Still over 256 MiB on the largest project; cuts the token-join cost by ~60%.

**Why low risk.** Copies rows; duplicates collapse on the same key the query dedupes on now.

**Open.** `FINAL` cost on Cloud with many unmerged parts (lab tables were fully merged); p99 numbers; write cost.
A projection on `mastra_metric_events` with this order would avoid the MV, but ClickHouse didn't choose it, and
sorting alone didn't make the dedupe stream (X32): the gain comes from the narrow, hash-keyed table plus `FINAL`.

## Tier 1: one token/cost row per usage emission

**What.** `mastra_model_usage (organizationId, projectId, traceId, usageId)` ReplacingMergeTree holding the four token
totals, cost and pricing flags for one call to `emitUsageMetrics`. The writer stamps a new `usageId` per emission and
writes this row next to the token metric rows. Queries dedupe per `usageId` and sum per trace, instead of deduping ~6
token rows per trace.

**Why not key by span.** Usage from hidden model calls is rolled up to the nearest exported ancestor
(`applyUsageRollup` in `observability/mastra/src/instances/base.ts`): each hidden call emits its own token rows under
the _ancestor's_ `spanId`, and a visible model span can carry its own usage plus rolled-up usage. Several emissions can
share a span; keyed by span, "latest wins" would drop all but one. The lab table (X35) was keyed by span and matched
only because the pulled data had no such collision. Token rows don't carry an emission id today, so a materialized view
over them can't build this table; the writer has to stamp the id (one per emission, shared by its token rows).

**Buys (lab, X35, keyed by span).** p99 E4/T1/T3 187 → 72 MiB; largest 818 → 338 MiB. Keyed by emission the row count
is the same or slightly higher. The largest project stays over 256 MiB.

**Why exact.** No sums at write time; a retried emission repeats its `usageId` and collapses. Every emission is kept,
including rolled-up and resumed (HITL) usage, because each is its own row.

**Can go wrong.** A writer path that emits usage without a row (must cover `emitUsageMetrics` for both live and rolled-up
usage); retries that mint a new `usageId` (would double-count, as today's metric rows would with new `metricId`s).

**Test.** Per-tenant reconciliation of per-trace sums against deduped token rows (must match exactly); fixtures with
nested hidden model calls under one processor, a visible model span with rolled-up usage, and suspend/resume.

## Not viable now: hourly token/cost rollup

Lab memory was 8–14 MiB at every size, but it can't be both exact and current. Traces suspend and resume (HITL) hours
or days later and add usage, so the hour a trace started keeps changing indefinitely. An insert-time view sums (retries
double-count, roots are rewritten); a scheduled recompute lags and can't know which old hours changed. Attributing
usage to the hour it happened avoids that, but answers a different question than `aggregateTraces()` (which counts all
of a trace's usage under its start time). Revisit only with a product decision on that semantics.

## Tier 3: not recommended

- **Drop the root dedupe.** Roots are rewritten today; results would be wrong for those traces.
- **Token/cost on the root row.** 4.3% of token rows arrive after the root ends, so roots would be rewritten
  more, and still need the dedupe.
