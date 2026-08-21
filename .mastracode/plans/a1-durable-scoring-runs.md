# A1: Durable Scoring Runs on the Workflow Engine — Exploration

Status: exploration only, no implementation.

## Problem

Live scorer execution is fire-and-forget:

- The scorer hook is dispatched via `setImmediate` with no await, no return value, no error channel (`packages/core/src/hooks/index.ts:24-30`).
- The handler (`createOnScorerHook`) runs `scorerToUse.scorer.run(...)` inside one big try/catch; any failure — scorer lookup, LLM judge call, score save — ends in `mastra.getLogger()?.trackException(mastraError)` and nothing else (`packages/core/src/mastra/hooks.ts:44-115`). No retry, no queue, no attempt record.
- Sampling declines are silently dropped: `runScorer` computes `shouldExecute = Math.random() < rate` and simply `return`s without emitting anything (`packages/core/src/evals/hooks.ts:46-58`).

Consequences: scoring **coverage is uncomputable** (no denominator — declined and failed runs leave zero rows) and failures are only visible in logs.

The offline path already does better: `scoreTraces()` starts a run of the internal `__batch-scoring-traces` workflow (`packages/core/src/evals/scoreTraces/scoreTraces.ts:13-17`, workflow defined at `packages/core/src/evals/scoreTraces/scoreTracesWorkflow.ts:450-474`), which gives it a durable run record. The proposal under evaluation: model *every* scoring run (live and trace) as a durable workflow run.

## Engine facts (evidence base)

**Write-before-run intent record exists.** `Workflow.createRunAsync` persists an initial snapshot with `status: 'pending'` *before* any step executes, unless the run already exists in storage (`packages/core/src/workflows/workflow.ts:2612-2638`). This is exactly the "intent recorded before work happens" primitive we need: a crash between intent-write and execution leaves a queryable `pending` row.

**Opt-out & pruning hooks exist.** Persistence is controlled per-workflow by `shouldPersistSnapshot` (default `() => true`) and `pruneSnapshot` options (`packages/core/src/workflows/workflow.ts:1705-1706`, checked at `2589-2592` and again per step-update at `packages/core/src/workflows/handlers/entry.ts:185-189, 231`). Precedent: transient processor workflows persist nothing (#17344, comment at `workflow.ts:2594-2597`), and agent-loop workflows register `pruneSnapshot` (`packages/core/src/loop/workflows/prune-snapshot.ts:1-41`).

**Run status lifecycle.** `WorkflowRunStatus = 'running' | 'success' | 'failed' | 'tripwire' | 'suspended' | 'waiting' | 'pending' | 'canceled' | 'bailed' | 'paused' | 'skipped'` (`packages/core/src/workflows/types.ts:282-293`). Note `'skipped'` already exists as both a run status and a step-result status (`types.ts:156`), currently used for untaken conditional branches (`packages/core/src/workflows/handlers/control-flow.ts:470-480`).

**Retry today.** `retryConfig` is `{ attempts?: number; delay?: number }` only (`packages/core/src/workflows/types.ts:1121`, `workflow.ts:1662-1694`). Default engine: an in-process loop with a **fixed** `setTimeout(delay)` between attempts (`packages/core/src/workflows/default.ts:476-479`); the sleeping process holds the retry — a crash mid-delay loses remaining attempts. Evented engine: on `failed` it republishes `workflow.step.run` with `retryCount + 1` (`packages/core/src/workflows/evented/workflow-event-processor/index.ts:1791-1830`) — crash-safe redelivery, but **no delay at all** (the `delay` field is not consulted on this path). No backoff, no jitter, no error-classified retry, no persisted "retrying/delayed" state in either engine.

**Foreach concurrency.** `.foreach(step, { concurrency })` with default 1 (`packages/core/src/workflows/workflow.ts:2440-2470`) gives bounded parallelism. `scoreTracesWorkflow` instead uses `pMap(..., { concurrency: 3 })` inside a single step (`scoreTracesWorkflow.ts:67-90`) — meaning per-target failures are caught and logged (`:72-87`), invisible to the run record: the run succeeds even if every score fails. This is the anti-pattern to avoid.

**Storage shape.** One row per run in `mastra_workflow_snapshot` with columns `workflow_name, run_id, resourceId, snapshot(jsonb), createdAt, updatedAt` (`packages/core/src/storage/constants.ts:739-756`). Persist is an upsert keyed on `(workflow_name, run_id)` that rewrites the whole snapshot blob every time (`stores/libsql/src/storage/domains/workflows/index.ts:304-317`, comment at `:300-303` notes pg/mysql/mongodb mirror this). Each step-boundary persist serializes the full snapshot including `context` (all step results) **and** `serializedStepGraph` (`packages/core/src/workflows/handlers/entry.ts:206-232`; `WorkflowRunState` shape at `packages/core/src/workflows/types.ts:383-408`).

**Internal-workflow plumbing.** `scoreTracesWorkflow` is registered via `mastra.__registerInternalWorkflow` from bundler entrypoints (`packages/cli/src/public/templates/dev.entry.js:2,14`) and resolved with `__getInternalWorkflow('__batch-scoring-traces')` (`scoreTraces.ts:13`). A durable live-scoring workflow can reuse this exact mechanism. Note it is built on the **evented** engine (`scoreTracesWorkflow.ts:6` imports from `../../workflows/evented`).

---

## D1 — Recording declined-sampling decisions (coverage denominator)

Two candidate mechanisms:

**Option A: a workflow run with status `'skipped'`.** The status literal exists (`types.ts:293`), but nothing today creates a run directly in `skipped` — `createRunAsync` always writes `status: 'pending'` (`workflow.ts:2616`) and skipped is set on branch arms, not whole runs. We'd need a new "record-only" entry point that persists a terminal snapshot without executing. Cost: a full snapshot row (~1–2 KB min, see D4) per *declined* decision — and sampling is designed precisely so declined ≫ executed (a 1% rate means 99% of rows would be skip markers). That inverts the economics: the cheapest outcome writes the same row as the most expensive one. Also pollutes workflow-run listings (`listWorkflowRuns`, `storage/domains/workflows/base.ts:56`) with millions of no-op runs.

**Option B: a lightweight decision record.** Emit a small "scoring decision" row (or counter) at the sampling site (`evals/hooks.ts:56-58`): `{ scorerId, entityId, traceId/spanId, decision: 'sampled' | 'declined', samplingRate, ts }`. The scores domain already exists as a storage home (`saveScore` via `storage.getStore('scores')`, `mastra/hooks.ts:122-134`); a sibling `scoring_decisions` table — or even just aggregated counters per (scorer, hour) — gives the coverage denominator at a fraction of the cost.

**Recommendation: Option B**, with an aggregate variant for high volume. The denominator question ("of N eligible events, how many were sampled, how many succeeded?") only needs counts plus sampling metadata, not replayable state. Reserve workflow runs for work that actually executes. If per-decision granularity is required for debugging, write individual decision rows behind a config flag; default to per-(scorer, window) counters. A `skipped` workflow run should only be used for runs that were *accepted* but then found ineligible at execution time (e.g. span vanished), where the intent row already exists.

## D2 — Granularity: run per (scorer, span) vs batching

**One run per (scorer, span):**
- Pros: run status *is* the score attempt status — `pending → running → success/failed` maps 1:1 to attempt tracking; `retryConfig`/retryCount is per-score for free; failure reason lands in `snapshot.error` (`types.ts:388`); resume/restart re-runs exactly one score; coverage = simple status aggregation over runs.
- Cons: at least 2 snapshot upserts per score (initial pending at `workflow.ts:2630`, terminal at step end via `persistStepUpdate`, `entry.ts:227`), plus row-per-score storage (D4). Also `createRunAsync` does an existence read before the intent write (`workflow.ts:2598-2601`) — 3 storage ops per score minimum.
- Concurrency control has to move above the engine (a dispatcher that limits in-flight runs), since each run is independent.

**One batched run with `.foreach`:**
- Pros: 1 run row per batch; `.foreach(scoreOneTarget, { concurrency: N })` (`workflow.ts:2440-2470`) gives engine-level bounded concurrency; per-target results are individual step-results inside `snapshot.context`, so per-score status/error *is* recorded (unlike today's `pMap`+swallow at `scoreTracesWorkflow.ts:67-90`); retries apply per foreach iteration (`handlers/step.ts:300-306`).
- Cons: per-score attempt data is buried inside one JSON blob — computing coverage means parsing snapshots, not querying rows; the snapshot is rewritten at every step boundary and grows O(batch size) (every target's input/output accumulates in `context`, `entry.ts:210`); one poisoned target can't be individually resumed; live scoring is event-driven, so batching requires a buffering/flush layer that itself needs durability (buffered-but-not-yet-flushed events are the new fire-and-forget gap).

**What per-score attempt/failure tracking actually requires:** queryable fields per (scorer, target): status, attempt count, last error class, timestamps. Workflow storage gives status per *run* cheaply (`getWorkflowRunById`, `listWorkflowRuns`) but everything finer lives inside the snapshot JSON. Neither granularity gives an indexed per-score attempt table; batching makes it strictly worse.

**Recommendation:** run per (scorer, span) for live scoring — the write-before-run intent row is the entire point, and it must be per-score to serve as the attempt record. Mitigate cost with a pruned snapshot (D4). Keep batch mode (foreach-based, replacing internal `pMap`) for the offline/backfill path where targets are known upfront, and fix `scoreTracesWorkflow` to surface per-target failures as step results instead of swallowing them.

## D3 — Retry semantics

Today vs. needed:

| Capability | Today | Evidence |
|---|---|---|
| Max attempts | yes, `retryConfig.attempts` / `step.retries` | `handlers/step.ts:300` |
| Fixed delay | default engine only | `default.ts:476-479` |
| Delay on evented engine | **no** — immediate republish | `evented/workflow-event-processor/index.ts:1811-1830` |
| Exponential backoff / jitter | no | `types.ts:1121` (shape is `{attempts, delay}` only) |
| Error classification (retryable vs not) | partial: `MastraNonRetryableError` short-circuits | `default.ts:484-486` |
| Honor `Retry-After` (429) | only Inngest engine via `RetryAfterError` | `default.ts:441-443` |
| Persisted "delayed/retrying" state | no — retry wait is in-memory; run stays `running` | `default.ts:476-479` |

For LLM-judge scorers, 429s are the dominant failure mode, so this matters. Engine changes needed:

1. **`retryConfig` extension**: `{ attempts, delay, backoff?: 'fixed' | 'exponential', maxDelay?, jitter? }` — additive change in `types.ts:1121` and the retry loop in `default.ts:450-509` (compute delay from attempt index instead of constant). Low risk, generally useful.
2. **Error-driven delay**: let steps throw a typed `MastraRetryableError { retryAfterMs }`; the retry loop honors it. The `MastraNonRetryableError` check at `default.ts:484` shows the pattern for error-class-driven behavior.
3. **Durable delayed state**: a real "delayed until T, attempt N" needs (a) persisting the pending retry in the snapshot and (b) a scheduler that resumes it. The evented engine is the natural home — it already has durable sleep primitives (`processWorkflowSleep`/`processWorkflowSleepUntil`, `evented/workflow-event-processor/index.ts:34`) and could publish the retry `workflow.step.run` event after a sleep instead of immediately (`index.ts:1812`). The existing `'waiting'` run status (`types.ts:288`) can represent "delayed"; a distinct `'delayed'` status is nice-to-have, not required (dashboards can distinguish via snapshot metadata).

**Recommendation:** phase 1 uses existing per-step retries (better than today's zero retries); phase 2 adds backoff config + retryable-error contract to the default engine loop; phase 3 adds durable delayed retry on the evented engine using sleep + republish. Scoring does not need suspend/resume semantics beyond this.

## D4 — Cost at volume

**What one durable scoring run writes** (per-span granularity, single-step workflow, relational adapters):
- 1 existence read (`workflow.ts:2598-2601`).
- Upsert #1: initial `pending` snapshot (`workflow.ts:2630`). Minimal snapshot but includes `serializedStepGraph` (`workflow.ts:2622`).
- Upsert #2..k: step-boundary persists via `persistStepUpdate` (`entry.ts:184-233`) — for a one-step workflow typically a `running` persist and a terminal persist. Each rewrites the **entire** snapshot: step graph + `context` containing the scorer input/output payload (`entry.ts:210,214`).
- Net: 1 row, ~3-4 full-blob upserts per score.

**Bytes.** The snapshot embeds the scoring payload (trace input/output can be tens of KB) plus the serialized step graph, re-serialized on every persist. Conservative estimate 2–10 KB per snapshot for pruned payloads, 50 KB+ unpruned for chatty traces. At **10k scores/day**: 10k rows/day (~3.65 M rows/yr) and 30–40k upserts/day. On Postgres/LibSQL this is trivial write load (<1 write/sec) but unbounded table growth — `mastra_workflow_snapshot` has no TTL/retention mechanism anywhere in `storage/domains/workflows`. At 5 KB avg that's ~18 GB/yr mixed into the same table that powers user-facing workflow-run listings. Row-count pollution of `listWorkflowRuns` is arguably worse than the bytes. Adding decision records (D1 option A) at a 10% sampling rate would multiply rows ×10 — reinforcing D1 option B.

**Lighter-weight run mode: exists.** This is the key finding — no engine change needed:
- `shouldPersistSnapshot` predicate can skip persists entirely per phase (`workflow.ts:1705`, `entry.ts:185-189`).
- `pruneSnapshot` can strip payloads before write (`workflow.ts:1706`, `entry.ts:231`); agent-loop workflows already use it to keep snapshots to routing state (`loop/workflows/prune-snapshot.ts`).

A scoring workflow should register a `pruneSnapshot` that keeps only `{runId, status, error, timestamp, scorerId, traceId, spanId, attempt}`-scale data (the score itself is saved to the scores store, not the snapshot) and a `shouldPersistSnapshot` that persists only `pending` + terminal states (skip intermediate `running` writes). That gets to ~2 upserts × <1 KB per score. What's genuinely missing and would need building: retention/TTL for internal workflow runs, and exclusion of internal runs from user-facing run listings.

---

## Recommended architecture

1. **Durable live scoring = one run of an internal `__score-span` workflow per (scorer, span)**, registered via the existing internal-workflow registry (like `__batch-scoring-traces`, `dev.entry.js:14`). The hook body (`mastra/hooks.ts:44-115`) moves into the workflow's single step; `createOnScorerHook` shrinks to: resolve owner → `createRunAsync` (writes the pending intent row, `workflow.ts:2612-2638`) → `start()`.
2. **Sampling decisions** recorded as lightweight decision records/counters in the scores domain (D1 option B), *not* as skipped runs. Coverage = decisions(sampled) vs. run statuses.
3. **Snapshot diet**: `pruneSnapshot` + `shouldPersistSnapshot` configured on the scoring workflow so each score costs ~2 small upserts (D4).
4. **Retry**: per-step `retries` immediately; add exponential backoff + `retryAfterMs` error contract to `executeStepWithRetry` (`default.ts:450`); later, durable delayed retry on the evented engine via sleep-before-republish (`evented/.../index.ts:1811`).
5. **Bounded concurrency** for live scoring via a small in-process dispatcher capping in-flight runs (per-run granularity means foreach doesn't apply); offline path keeps foreach/batch.
6. **Retention**: add a cleanup policy (age-based delete via `deleteWorkflowRunById`, `storage/domains/workflows/base.ts:60`) for internal scoring runs, and filter internal workflow names out of default run listings.

## Phased plan

- **Phase 1 — durability + denominator (core win):** `__score-span` internal workflow wrapping current hook logic; pending-intent row per score; decision counters at `evals/hooks.ts:56`; prune/skip-persist config; basic `retries` on the step. Live coverage becomes computable.
- **Phase 2 — retry quality:** backoff options in `retryConfig`; `MastraRetryableError { retryAfterMs }` honored in `default.ts:476-509`; surface attempt count + last error in a queryable score-attempt view (from run snapshots or a small attempts column on decision records).
- **Phase 3 — evented durability + ops:** delayed retry via evented sleep + republish (crash-safe 429 handling, run shows `waiting`); retention job for scoring runs; exclude internal runs from user-facing listings; convert `scoreTracesWorkflow` from `pMap`-with-swallowed-errors to foreach with per-target step results.
- **Phase 4 (optional) — recovery:** startup sweep that lists `pending`/`running` scoring runs older than a threshold and restarts them (the intent row makes orphan detection possible for the first time).

## Open questions

- Should decision records live in the scores store or a new domain? (Scores store keeps adapter surface unchanged only if we model declines as a score-like row, which is ugly; a counters table is cleaner but touches every adapter.)
- Per-run dispatch throughput on evented engine: each run costs pubsub round-trips; is worker-pool overhead acceptable at 10k/day (yes: ~0.1/sec) and at 1M/day (needs measurement)?
- Multi-instance dedup: two Mastra instances can both own a hook today only via the owner check (`hooks/scorer-owner.ts` via `mastra/hooks.ts:23`); with durable runs, `runId` derived deterministically from (scorerId, traceId, spanId) would make the intent upsert idempotent (`ON CONFLICT` at `stores/libsql/.../workflows/index.ts:310`) — worth adopting.
