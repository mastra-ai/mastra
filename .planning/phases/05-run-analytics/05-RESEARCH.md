# Phase 5: Run Analytics - Research

**Researched:** 2026-01-24
**Domain:** Run Comparison and Score Aggregation
**Confidence:** HIGH

## Summary

Researched run comparison and score aggregation patterns from industry tools (Langfuse, Braintrust, DeepEval) and mapped them to CONTEXT.md decisions. This phase implements a pure analytics layer with no storage changes — all data already exists in RunResult and ScoreRowData. The core pattern is explicit pair comparison (`compareRuns(runA, runB)`) with threshold-based regression detection.

Key insight: Industry tools separate comparison (which runs to compare) from analytics (how to compute deltas and stats). CONTEXT.md aligns with this — comparison is user-driven, analytics are computed on demand. No materialized aggregates for v1.

**Primary recommendation:** Implement `compareRuns()` as a pure function over existing data, returning nested-by-scorer structure with regression flags. Compute metrics on demand (mean, count, error rate) from RunResult/ScoreRowData without storage changes.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @mastra/core | internal | Storage access (RunsStorage, ScoresStorage) | All data already stored |
| TypeScript | ^5.x | Type-safe comparison result | Already in stack |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| None | - | - | No new dependencies needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Materialized aggregates | On-demand computation | On-demand simpler for v1, can cache later |
| Statistical percentiles | Basic mean/count | Per CONTEXT.md: basic stats only |

**Installation:**
```bash
# No new packages needed - pure computation over existing data
```

## Architecture Patterns

### Recommended Project Structure
```
packages/core/src/datasets/
├── run/
│   ├── index.ts              # runDataset (existing)
│   └── analytics/
│       ├── index.ts          # Re-exports
│       ├── compare.ts        # compareRuns function
│       ├── aggregate.ts      # Aggregation helpers (mean, count)
│       └── types.ts          # ComparisonResult, ScorerStats types
└── index.ts                  # Add analytics export
```

### Pattern 1: Explicit Pair Comparison
**What:** User provides both run IDs, function returns comparison result
**When to use:** All comparison scenarios (CI, UI, manual)
**Example:**
```typescript
// Source: CONTEXT.md decision
export async function compareRuns(
  storage: MastraCompositeStore,
  runIdA: string,
  runIdB: string,
): Promise<ComparisonResult> {
  // Load runs and results
  // Compare overlapping items
  // Return structured result with deltas
}
```

### Pattern 2: Nested-by-Scorer Structure
**What:** Organize results by scorer for scalability (arbitrary scorer count)
**When to use:** All comparison output
**Example:**
```typescript
// Source: CONTEXT.md decision
interface ComparisonResult {
  runA: { id: string; datasetVersion: Date };
  runB: { id: string; datasetVersion: Date };
  versionMismatch: boolean;           // Warn when versions differ
  hasRegression: boolean;             // Quick CI check
  scorers: {
    [scorerId: string]: ScorerComparison;
  };
  items: ItemComparison[];            // Per-item detail
}

interface ScorerComparison {
  avgA: number;
  avgB: number;
  delta: number;                      // avgB - avgA
  regressed: boolean;                 // delta below threshold
  threshold: number;                  // From dataset config
  countA: number;
  countB: number;
}
```

### Pattern 3: Three Metrics Per Scorer (CONTEXT.md)
**What:** Error rate, pass rate, avg score — separately tracked
**When to use:** All aggregation
**Example:**
```typescript
// Source: CONTEXT.md decision
interface ScorerStats {
  // Error rate: items that threw errors / total items
  errorRate: number;
  errorCount: number;

  // Pass rate: items scoring >= threshold / items with scores
  passRate: number;
  passCount: number;

  // Avg score: mean of scores (errors excluded)
  avgScore: number;
  scoreCount: number;

  totalItems: number;
}
```

### Pattern 4: Threshold-Based Regression Detection
**What:** Compare delta against stored threshold per scorer
**When to use:** Regression flag computation
**Example:**
```typescript
// Industry standard: Langfuse, Braintrust, DeepEval
// Source: CONTEXT.md decision - thresholds per dataset, per scorer
function isRegression(
  delta: number,
  threshold: number,
  direction: 'higher-is-better' | 'lower-is-better' = 'higher-is-better',
): boolean {
  // For higher-is-better metrics, negative delta is regression
  return direction === 'higher-is-better' ? delta < -threshold : delta > threshold;
}
```

### Anti-Patterns to Avoid
- **Materialized aggregates in storage:** Compute on demand, cache if needed later
- **Latency percentiles:** Deferred per CONTEXT.md
- **Composite/weighted scores:** Per-scorer only for v1
- **Exit codes for CI:** Flag regression, consumer decides action

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Run/Result loading | Custom queries | RunsStorage.listResults | Already has pagination |
| Score loading | Custom queries | ScoresStorage.listScoresByRunId | Already has runId index |
| Concurrent aggregation | Promise.all | p-map with concurrency | Already in stack |

**Key insight:** All data retrieval patterns exist — Phase 5 is pure computation over existing data structures.

## Common Pitfalls

### Pitfall 1: Comparing Non-Overlapping Items
**What goes wrong:** Runs have different item sets (version drift, deleted items)
**Why it happens:** Dataset evolves between runs
**How to avoid:**
- Track overlapping items by itemId
- Return `versionMismatch: true` as warning
- Only include items present in BOTH runs
**Warning signs:** `items` array smaller than either run's totalItems

### Pitfall 2: Ignoring Null Scores
**What goes wrong:** Scorers fail silently, nulls contaminate averages
**Why it happens:** Scorer errors stored as `score: null`
**How to avoid:**
- Filter nulls before computing avgScore
- Track error count separately
- Report both errorRate AND avgScore
**Warning signs:** NaN in computed averages

### Pitfall 3: Threshold Direction Confusion
**What goes wrong:** Higher-is-better vs lower-is-better metrics compared incorrectly
**Why it happens:** Latency (lower is better) vs accuracy (higher is better)
**How to avoid:**
- Store direction with threshold config
- Default to higher-is-better (most common)
- Document in threshold config schema
**Warning signs:** False positives on latency-style metrics

### Pitfall 4: Memory Issues on Large Runs
**What goes wrong:** Loading all results into memory for runs with 10k+ items
**Why it happens:** Naive full-load approach
**How to avoid:**
- Stream results with pagination if needed
- For v1: warn user on runs > 1000 items
- Compute aggregates incrementally
**Warning signs:** OOM on large dataset runs

## Code Examples

Verified patterns from existing codebase:

### Loading Run Results
```typescript
// Source: packages/core/src/storage/domains/runs/base.ts
const results = await runsStore.listResults({
  runId,
  pagination: { page: 0, perPage: false }, // Get all
});
```

### Loading Scores for Run
```typescript
// Source: packages/core/src/storage/domains/scores/base.ts
const scores = await scoresStore.listScoresByRunId({
  runId,
  pagination: { page: 0, perPage: false },
});
```

### Computing Mean (Existing Pattern)
```typescript
// Source: packages/core/src/evals/run/scorerAccumulator.ts
private getAverageScore(scoreArray: number[]): number {
  if (scoreArray.length > 0) {
    return scoreArray.reduce((a, b) => a + b, 0) / scoreArray.length;
  } else {
    return 0;
  }
}
```

### Score Structure
```typescript
// Source: packages/core/src/evals/types.ts - ScoreRowData
interface ScoreRowData {
  id: string;
  scorerId: string;
  entityId: string;
  runId: string;
  score: number;           // The value we aggregate
  reason?: string;
  // ... other fields
}
```

### Run Result Structure
```typescript
// Source: packages/core/src/storage/types.ts
interface RunResult {
  id: string;
  runId: string;
  itemId: string;
  itemVersion: Date;
  input: unknown;
  output: unknown | null;
  expectedOutput: unknown | null;
  latency: number;         // We track but don't compute percentiles v1
  error: string | null;    // Non-null = error item
  // ... timestamps
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Manual A/B testing | Automated comparison with thresholds | 2024+ | Standard in all eval platforms |
| Single baseline | Explicit pair comparison | Current | More flexible, user controls |
| Integer versioning | Timestamp versioning | Langfuse 2024 | Better for concurrent edits |

**Deprecated/outdated:**
- N/A — this is new code

## Open Questions

Things that couldn't be fully resolved:

1. **Threshold Storage Location**
   - What we know: CONTEXT.md says "thresholds stored per dataset, per scorer"
   - What's unclear: Exact schema — extend Dataset? Separate config table?
   - Recommendation: Add `scorerThresholds: Record<string, { threshold: number; direction?: 'higher-is-better' | 'lower-is-better' }>` to Dataset metadata

2. **Empty Run Edge Case**
   - What we know: Need to handle runs with 0 results
   - What's unclear: Return null? Throw? Empty comparison?
   - Recommendation: Return comparison with empty scorers/items, clear error message

3. **No Overlapping Items Edge Case**
   - What we know: Two runs might share 0 items (complete version drift)
   - What's unclear: Is this an error or valid empty comparison?
   - Recommendation: Return `{ versionMismatch: true, hasRegression: false, scorers: {}, items: [] }` with warning

## Sources

### Primary (HIGH confidence)
- Codebase analysis: `packages/core/src/storage/domains/runs/base.ts` - Run/Result types
- Codebase analysis: `packages/core/src/storage/domains/scores/base.ts` - Score storage API
- Codebase analysis: `packages/core/src/evals/run/scorerAccumulator.ts` - Aggregation pattern

### Secondary (MEDIUM confidence)
- [Langfuse Score Analytics](https://langfuse.com/docs/evaluation/evaluation-methods/score-analytics) - Mean, correlation metrics
- [Braintrust Experiments](https://www.braintrust.dev/docs/core/experiments) - Regression highlighting
- [DeepEval Metrics](https://deepeval.com/docs/metrics-introduction) - Threshold-based pass/fail

### Tertiary (LOW confidence)
- None — all findings verified against codebase or official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, pure computation
- Architecture: HIGH — follows CONTEXT.md decisions exactly
- Pitfalls: HIGH — derived from codebase edge cases

**Research date:** 2026-01-24
**Valid until:** 2026-02-24 (30 days — stable domain)
