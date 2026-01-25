# Phase 5: Run Analytics - Context

**Gathered:** 2026-01-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Compare runs to detect score regressions and track performance metrics. Users can compare two runs side-by-side with score deltas, see aggregate statistics, and identify which items regressed. This phase delivers the analytics layer — UI integration is Phase 6.

</domain>

<decisions>
## Implementation Decisions

### Comparison API
- Explicit pair comparison: `compareRuns(runA, runB)` — user picks both runs
- No baseline model for v1 (can add later as thin layer if needed)
- When dataset versions differ: warn and proceed, compare only overlapping items
- Return both item-level diffs AND aggregate summary

### Regression Detection
- Threshold-based detection (industry standard per Langfuse/Braintrust)
- Thresholds stored per dataset, per scorer
- Flag regression in results (consumer decides action — no exit code for v1)
- Both aggregate threshold check AND per-item breakdown for debugging
- "Averages can hide outliers" — need per-item to identify what broke

### Aggregation Methods
- Basic stats only: mean score, count (no percentiles for v1)
- Three separate metrics per scorer:
  - Error rate: items that threw errors / total items
  - Pass rate: items scoring ≥ threshold / items with scores
  - Avg score: mean of scores (errors excluded, tracked separately)
- No latency tracking for v1
- Per-scorer stats only (no composite/weighted aggregate)

### Output Structure
- Serves both API (CI/CD) and UI (Playground) equally
- Nested by scorer for scalability:
  ```
  { scorers: { accuracy: {...}, relevance: {...} } }
  ```
- Minimal item-level detail: itemId, scores per scorer, pass/fail status
- Regression flags at both levels:
  - Top-level `hasRegression` for CI quick check
  - Per-scorer `regressed` boolean with `delta` for debugging

### Claude's Discretion
- Exact TypeScript types for comparison result
- How to handle edge cases (empty runs, no overlapping items)
- Internal implementation of threshold checking

</decisions>

<specifics>
## Specific Ideas

- Industry research informed decisions: Langfuse, Braintrust, Arize Phoenix patterns
- "A 4% avg improvement can hide a 16% regression on critical cases" (Langfuse) — drove per-item requirement
- Braintrust GitHub Action pattern: posts comparison to PR, blocks merge on regression
- DeepEval pattern for per-metric access: `metric.score`, `metric.reason`

</specifics>

<deferred>
## Deferred Ideas

- Baseline model (auto-compare to blessed run) — add if workflow demands it
- Latency tracking (p50/p95/p99) — future phase
- CI exit codes for quality gates — future enhancement
- Statistical significance testing — overkill for v1
- Composite/weighted aggregate scores — per-scorer sufficient for now

</deferred>

---

*Phase: 05-run-analytics*
*Context gathered: 2026-01-24*
