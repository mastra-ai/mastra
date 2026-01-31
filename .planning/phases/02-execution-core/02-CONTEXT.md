# Phase 2: Execution Core - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Run datasets against targets with automatic scoring and result persistence. Users can trigger runs with datasetId + targetType + targetId + optional scorers[]. Each item executes against the target, results persist, and scores save to ScoresStorage.

</domain>

<decisions>
## Implementation Decisions

### Run triggering API

- Entry point: `mastra.datasets.run()` — needs access to registries + storage
- Dataset version: Default to latest; optional `version` param to pin specific version
- Target identification: Explicit `targetType` + `targetId` (not auto-detect)
  - targetType: 'agent' | 'workflow' | 'scorer' | 'processor'
  - targetId: string identifier for resolution via Mastra registries
- Execution modes: Support both sync (await) and async (return runId, poll)
  - Sync useful for CI
  - Async useful for UI
- Concurrency: Parallel by default with `maxConcurrency` param (user-controlled, ~5 default)
  - Follows Braintrust pattern — user manages rate limits via concurrency
- Failure handling: Continue on error
  - Log error per item, complete run, include error count in result
  - Industry standard (Promptfoo, LangSmith, Jest)
- Cancellation: Accept AbortSignal for mid-execution abort
- Deferred: Custom run metadata (commit SHA, tags) — add in later phase

### Result structure

- Fields per item result:
  - `output` — raw from target (not normalized)
  - `latency` — execution time in ms
  - `error` — error message if failed, null otherwise
  - `traceId` — link to observability trace
  - `tokenUsage` — input/output tokens from target
  - `startedAt` / `completedAt` — timestamps
  - `retryCount` — how many retries before result
  - `itemVersion` — snapshot which version was used
- Input storage: Snapshot in result — self-contained, captures exact test
- Output format: Raw from target — no normalization

### Scoring integration

- Timing: Inline after each item (score immediately after target returns)
- Scorer param: Single `scorers` array accepting instances OR string IDs
  - `scorers: [myScorer, 'stored-accuracy-id']`
  - Detect type (Scorer instance vs string) and resolve accordingly
  - Supports code-defined scorers AND stored scorer configs
- Storage: ScoresStorage (existing domain) — consistent with agent scoring
- Context passed to scorers: Full context
  - input, output, expectedOutput, context from item + target metadata
- expectedOutput: Optional — some scorers don't need ground truth
- Scoring errors: Skip scorer, log error — don't fail the item

### Status & progress

- Run states: `pending` | `running` | `completed` | `failed`
- Failure semantics: "Completed" if any items succeed
  - Partial failure still marked completed; error count in summary
- Progress reporting: Claude's discretion (stored on run record for polling)
- Summary stats: Minimal now
  - totalItems, succeededCount, failedCount
  - Detailed analytics (per-scorer aggregation, improvements/regressions) in Phase 5

### Claude's Discretion

- Default maxConcurrency value (recommend ~5)
- Progress update frequency during async runs
- Exact retry behavior if network errors occur
- Token usage extraction from different target types

</decisions>

<specifics>
## Specific Ideas

- Follow Braintrust pattern for `maxConcurrency` — simple param, user manages API limits
- Industry standard is continue-on-error (see Promptfoo, Jest, LangSmith)
- Scorer param supports mixed array: `[scorerInstance, 'scorer-id']` — matches flexibility of agent resolution pattern

</specifics>

<deferred>
## Deferred Ideas

- Custom run metadata (commit SHA, branch, tags) — add when CI/analytics integration clearer
- Exponential backoff on 429 rate limits — keep simple with maxConcurrency for now
- Provider-aware rate limiting — different limits per LLM provider
- Per-scorer aggregation with improvements/regressions — Phase 5 analytics

</deferred>

---

_Phase: 02-execution-core_
_Context gathered: 2026-01-24_
