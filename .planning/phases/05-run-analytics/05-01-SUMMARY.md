---
phase: 05
plan: 01
subsystem: analytics
tags: [comparison, regression, statistics]
dependency-graph:
  requires: [02-execution-core, 04-scorer-targets]
  provides: [compareRuns, ScorerStats, ComparisonResult]
  affects: [06-playground-integration]
tech-stack:
  added: []
  patterns: [pure-functions, nested-by-scorer]
key-files:
  created:
    - packages/core/src/datasets/run/analytics/types.ts
    - packages/core/src/datasets/run/analytics/aggregate.ts
    - packages/core/src/datasets/run/analytics/compare.ts
    - packages/core/src/datasets/run/analytics/index.ts
  modified:
    - packages/core/src/datasets/run/index.ts
decisions:
  - id: nested-by-scorer
    choice: 'Scorers nested: { scorers: { accuracy: {...} } }'
    rationale: 'Scalable structure per CONTEXT.md'
  - id: three-metrics
    choice: 'errorRate, passRate, avgScore per scorer'
    rationale: 'Basic stats sufficient for v1'
  - id: default-threshold
    choice: 'Default threshold: 0, higher-is-better'
    rationale: 'Any negative delta = regression unless configured'
metrics:
  duration: 4 min
  completed: 2026-01-25
---

# Phase 05 Plan 01: Run Analytics Summary

Pure computation layer for comparing runs and detecting score regressions via threshold-based delta checking.

## What Was Built

### Types (types.ts)

- `ScorerStats`: errorRate, passRate, avgScore, counts
- `ScorerComparison`: statsA, statsB, delta, regressed flag
- `ItemComparison`: per-item score diffs by scorer
- `ComparisonResult`: top-level with hasRegression flag
- `CompareRunsConfig`: runIdA, runIdB, per-scorer thresholds

### Aggregation (aggregate.ts)

- `computeMean()`: arithmetic mean with empty handling
- `computeScorerStats()`: compute all metrics from ScoreRowData[]
- `isRegression()`: threshold + direction based detection

### Comparison (compare.ts)

- `compareRuns()`: main function, loads from storage, returns ComparisonResult
- Handles version mismatch with warning
- Groups scores by scorer/item for efficient lookup
- Builds both aggregate and per-item views

## Commits

| Hash       | Message                                     |
| ---------- | ------------------------------------------- |
| 8f71e35152 | feat(05-01): add run analytics types        |
| 14039c8fa3 | feat(05-01): add aggregation helpers        |
| 8e8ff7498c | feat(05-01): implement compareRuns function |
| 206ea373c9 | feat(05-01): wire analytics exports         |

## Deviations from Plan

None - plan executed exactly as written.

## Key Decisions

1. **Nested-by-scorer structure** - `{ scorers: { accuracy: {...} } }` for scalability
2. **Three metrics per scorer** - errorRate, passRate, avgScore (no percentiles for v1)
3. **Default threshold: 0** - Any negative delta is regression unless configured
4. **Pass threshold: 0.5** - Default for computing pass rate

## Verification

```bash
# All passed
pnpm typecheck   # No errors
pnpm build:core  # Successful
grep compareRuns packages/core/src/datasets/  # Found in exports
```

## Next Phase Readiness

Phase 06 (Playground Integration) can now use:

- `compareRuns(mastra, { runIdA, runIdB })` for side-by-side comparison
- `result.hasRegression` for CI quick check
- `result.scorers[id].delta` for per-scorer drilling
- `result.items` for per-item breakdown
