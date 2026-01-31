# Phase 4: Scorer Targets - Research

**Researched:** 2026-01-24
**Domain:** Scorer-as-Target Execution for LLM-as-Judge Calibration
**Confidence:** HIGH

## Summary

Researched the existing codebase to understand how to implement scorer-as-target execution for dataset runs. The goal is enabling users to run datasets against scorers to calibrate LLM-as-judge evaluation against human-labeled ground truth.

Key discoveries:

1. **Scorer.run() interface already supports the required contract:** `scorer.run({ input, output, groundTruth })` - exactly what CONTEXT.md specified
2. **Executor already has placeholder:** `case 'scorer':` exists in executor.ts, currently throws "not yet supported"
3. **runScorersForItem pattern provides isolation:** Error handling for scorer execution is already solved
4. **Type: 'scorer' is already in TargetType:** No schema changes needed
5. **CRITICAL: DatasetItem lacks `output` field:** Current type only has `input`, `expectedOutput`, `context` - need to add `output?: unknown` field

The implementation is straightforward - add `executeScorer()` function following the existing `executeAgent()`/`executeWorkflow()` pattern, then enable the case statement. However, DatasetItem type needs an `output` field added.

**Primary recommendation:** Add optional `output` field to DatasetItem type, then implement `executeScorer()` that calls `scorer.run({ input: item.input, output: item.output, groundTruth: item.expectedOutput })`. Store scorer result (score/reason) in ItemResult.output field. Follow existing error isolation pattern.

## Standard Stack

### Core

| Library                   | Version  | Purpose                          | Why Standard                   |
| ------------------------- | -------- | -------------------------------- | ------------------------------ |
| @mastra/core/evals        | internal | MastraScorer, createScorer       | Existing scorer infrastructure |
| @mastra/core/datasets/run | internal | executeTarget, runScorersForItem | Existing executor pattern      |

### Supporting

| Library | Version | Purpose | When to Use             |
| ------- | ------- | ------- | ----------------------- |
| vitest  | ^2.x    | Testing | Verify scorer execution |

### Alternatives Considered

| Instead of            | Could Use            | Tradeoff                                                                       |
| --------------------- | -------------------- | ------------------------------------------------------------------------------ |
| Add item.output field | Nest in item.input   | item.output is clearer for "thing being judged"; per CONTEXT.md recommendation |
| Add item.output field | Nest in item.context | context is for metadata, not primary data                                      |

**Installation:**

```bash
# No new packages needed - all dependencies exist
```

## Architecture Patterns

### Recommended Project Structure

```
packages/core/src/
├── storage/types.ts      # Add output field to DatasetItem
├── datasets/run/
│   ├── executor.ts       # Add executeScorer() here
│   ├── scorer.ts         # Existing - runScorersForItem
│   ├── types.ts          # No changes needed
│   └── __tests__/
│       └── executor.test.ts  # Add scorer target tests
└── storage/domains/datasets/
    └── schema.ts         # May need output column if persisting
```

### Pattern 1: DatasetItem Type Update (REQUIRED)

**What:** Add optional `output` field for scorer target use case
**When to use:** Before implementing executeScorer
**Example:**

```typescript
// Source: packages/core/src/storage/types.ts - NEEDS MODIFICATION
/** Dataset item entity */
export interface DatasetItem {
  id: string;
  datasetId: string;
  /** Timestamp when item was added/modified */
  version: Date;
  /** Any JSON - string for simple prompts, object for structured */
  input: unknown;
  /** Any JSON - the response/output being evaluated (for scorer targets) */
  output?: unknown; // NEW FIELD
  /** Any JSON - ground truth/human label */
  expectedOutput?: unknown;
  context?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
```

### Pattern 2: Scorer Execution

**What:** Execute scorer with dataset item's input/output/expectedOutput
**When to use:** `targetType === 'scorer'`
**Example:**

```typescript
// Source: Codebase analysis - to be implemented
async function executeScorer(scorer: MastraScorer<any, any, any, any>, item: DatasetItem): Promise<ExecutionResult> {
  try {
    // CONTEXT.md decision: scorer.run({ input, output, groundTruth })
    const result = await scorer.run({
      input: item.input,
      output: item.output, // The thing being judged
      groundTruth: item.expectedOutput, // Human label
    });

    // Validate score
    const score = typeof result.score === 'number' && !isNaN(result.score) ? result.score : null;

    if (score === null && result.score !== undefined) {
      console.warn(`Scorer ${scorer.id} returned invalid score: ${result.score}`);
    }

    // Store scorer result in output field (consistent ItemResult shape)
    return {
      output: {
        score,
        reason: typeof result.reason === 'string' ? result.reason : null,
      },
      error: null,
    };
  } catch (error) {
    // CONTEXT.md decision: catch and store error, continue run
    return {
      output: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

### Pattern 3: DatasetItem Schema for Scorer Calibration

**What:** Dataset item provides input, output, expectedOutput fields
**When to use:** When dataset is designed for scorer calibration
**Example:**

```typescript
// Example dataset item for scorer calibration (Ragas-style):
{
  id: "item-1",
  datasetId: "scorer-calibration-dataset",
  input: {
    question: "What is the capital of France?",
    context: ["France is a country in Europe", "Paris is the capital of France"]
  },
  output: {
    response: "The capital of France is Paris."
  },
  expectedOutput: {
    score: 0.95,
    label: "relevant",
    grading_notes: "Response directly answers the question correctly"
  },
  version: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
}
```

### Pattern 4: Meta-Scoring (Scoring the Scorer)

**What:** Apply optional scorers[] to scorer-as-target output
**When to use:** Evaluating scorer consistency, confidence calibration
**Example:**

```typescript
// CONTEXT.md decision: same mechanics as agent/workflow runs
// After executeScorer returns, runScorersForItem applies meta-scorers

// runDataset already has this pattern - no changes needed:
const itemScores = await runScorersForItem(
  scorers, // Meta-scorers from config.scorers
  item, // Original dataset item
  execResult.output, // Scorer's output: { score, reason }
  storage,
  runId,
  targetType, // 'scorer'
  targetId,
);
```

### Pattern 5: Score Validation

**What:** Validate scorer output before storing
**When to use:** When scorer returns invalid score type
**Example:**

```typescript
// CONTEXT.md decision: invalid score = null + warning, continue run
const result = await scorer.run({ input, output, groundTruth });

// Validate score is a number
const score = typeof result.score === 'number' && !isNaN(result.score) ? result.score : null;

if (score === null && result.score !== undefined) {
  console.warn(`Scorer ${scorer.id} returned invalid score: ${result.score}`);
}

return {
  output: {
    score, // null if invalid
    reason: typeof result.reason === 'string' ? result.reason : null,
  },
  error: null,
};
```

### Anti-Patterns to Avoid

- **Auto-comparing scores:** Don't compare scorer output to expectedOutput - store both, let analytics handle alignment analysis
- **Changing ItemResult shape:** Keep same structure (output, latency, error) as agent/workflow
- **Skipping error handling:** Always catch scorer errors, store message, continue run
- **Input transformation:** Pass item fields directly to scorer.run(), no mapping
- **Using item.input for scorer output:** Use the new item.output field for clarity

## Don't Hand-Roll

| Problem           | Don't Build          | Use Instead                          | Why                        |
| ----------------- | -------------------- | ------------------------------------ | -------------------------- |
| Error isolation   | try/catch per-scorer | Existing `runScorersForItem` pattern | Handles all edge cases     |
| Score persistence | Custom storage calls | `validateAndSaveScore`               | Already handles validation |
| Scorer resolution | Registry lookup      | `mastra.getScorerById()`             | Already in resolveTarget   |

**Key insight:** All infrastructure exists. Implementation is wiring existing pieces together + adding DatasetItem.output field.

## Common Pitfalls

### Pitfall 1: Confusing item.output vs ItemResult.output

**What goes wrong:** Storing wrong value in ItemResult.output
**Why it happens:** item.output is the thing being judged, ItemResult.output is scorer result
**How to avoid:**

- item.output = thing being judged (passed TO scorer as `output` param)
- ItemResult.output = scorer result { score, reason } (returned FROM scorer)
  **Warning signs:** Score data missing from results

### Pitfall 2: Missing output field in DatasetItem

**What goes wrong:** item.output is undefined, scorer receives nothing to judge
**Why it happens:** Dataset created for agent/workflow (only input/expectedOutput)
**How to avoid:** Validate item.output exists when targetType === 'scorer', or document that scorer can work without it if scorer handles undefined output
**Warning signs:** Scorers all return 0 or error

### Pitfall 3: Comparing Scores Automatically

**What goes wrong:** Building complex comparison logic for score alignment
**Why it happens:** Natural instinct to compute alignment %
**How to avoid:** Per CONTEXT.md - store both values, defer analysis to analytics phase
**Warning signs:** Adding tolerance/threshold parameters

### Pitfall 4: Different Result Shape for Scorers

**What goes wrong:** ItemResult has different fields for scorer vs agent
**Why it happens:** Wanting to add scorer-specific fields
**How to avoid:** Use same ItemResult shape, scorer result goes in ItemResult.output field
**Warning signs:** Type errors in downstream code expecting consistent shape

### Pitfall 5: NaN or Invalid Score Types

**What goes wrong:** Storing NaN or undefined as score, breaks aggregation
**Why it happens:** Scorer returns unexpected type
**How to avoid:** Validate score is number, convert invalid to null + warning
**Warning signs:** NaN appearing in score results

### Pitfall 6: Forgetting DatasetItem Schema Migration

**What goes wrong:** Code expects item.output but database doesn't have column
**Why it happens:** Type updated but storage schema not updated
**How to avoid:** Check if storage schema needs `output` column added for persistence
**Warning signs:** Runtime errors when loading items with output field

## Code Examples

### Current DatasetItem Type (BEFORE)

```typescript
// Source: packages/core/src/storage/types.ts (lines 567-579)
export interface DatasetItem {
  id: string;
  datasetId: string;
  version: Date;
  input: unknown;
  expectedOutput?: unknown; // Human label / ground truth
  context?: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}
// NOTE: No `output` field - needs to be added for scorer targets
```

### Scorer.run() Interface

```typescript
// Source: packages/core/src/evals/base.ts (lines 49-56)
interface ScorerRun<TInput = any, TOutput = any> {
  runId?: string;
  input?: TInput;
  output: TOutput; // The thing being evaluated
  groundTruth?: any; // Human label for comparison
  requestContext?: Record<string, any>;
  tracingContext?: TracingContext;
}

// scorer.run() returns:
ScorerRunResult<TAccumulatedResults, TInput, TRunOutput> = Promise<
  ScorerRun<TInput, TRunOutput> & {
    score: number;
    reason?: string;
    preprocessStepResult?: any;
    analyzeStepResult?: any;
    // ... prompts
  }
>;
```

### Existing runScorerSafe Pattern (for reference)

```typescript
// Source: packages/core/src/datasets/run/scorer.ts (lines 91-124)
async function runScorerSafe(
  scorer: MastraScorer<any, any, any, any>,
  item: DatasetItem,
  output: unknown, // This is the target's output being scored
): Promise<ScorerResult> {
  try {
    const scoreResult = await scorer.run({
      input: item.input,
      output, // Target's output
      groundTruth: item.expectedOutput,
    });

    const score = (scoreResult as any).score;
    const reason = (scoreResult as any).reason;

    return {
      scorerId: scorer.id,
      scorerName: scorer.name,
      score: typeof score === 'number' ? score : null,
      reason: typeof reason === 'string' ? reason : null,
      error: null,
    };
  } catch (error) {
    return {
      scorerId: scorer.id,
      scorerName: scorer.name,
      score: null,
      reason: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

### Existing executeTarget Switch

```typescript
// Source: packages/core/src/datasets/run/executor.ts (lines 27-51)
export async function executeTarget(
  target: Target,
  targetType: TargetType,
  item: DatasetItem,
): Promise<ExecutionResult> {
  try {
    switch (targetType) {
      case 'agent':
        return await executeAgent(target as Agent, item);
      case 'workflow':
        return await executeWorkflow(target as Workflow, item);
      case 'scorer':
      case 'processor':
        // Currently throws - scorer to be implemented
        throw new Error(`Target type '${targetType}' not yet supported. Coming in Phase 4.`);
      default:
        throw new Error(`Unknown target type: ${targetType}`);
    }
  } catch (error) {
    return {
      output: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
```

### resolveTarget Already Handles Scorers

```typescript
// Source: packages/core/src/datasets/run/index.ts (lines 253-259)
function resolveTarget(mastra: Mastra, targetType: string, targetId: string): Target | null {
  switch (targetType) {
    // ... agent, workflow cases ...
    case 'scorer':
      try {
        return mastra.getScorerById(targetId as any) ?? null;
      } catch {
        return null;
      }
    // ...
  }
}
```

## State of the Art

| Old Approach                    | Current Approach           | When Changed | Impact                |
| ------------------------------- | -------------------------- | ------------ | --------------------- |
| Manual scorer evaluation        | Integrated in dataset runs | Phase 4      | Automated calibration |
| Compare scores programmatically | Store both, analyze later  | Phase 4      | Cleaner separation    |

**Deprecated/outdated:**

- Processor targets - dropped from roadmap entirely per CONTEXT.md

## Open Questions

1. **DatasetItem.output Storage**
   - What we know: Need to add `output?: unknown` to DatasetItem type
   - What's unclear: Does database schema need `output` column, or is it JSON in input?
   - Recommendation: Add `output` column to datasets storage schema if it doesn't exist. Check `packages/core/src/storage/domains/datasets/` for schema.

2. **Invalid Score Handling - Warning Mechanism**
   - What we know: CONTEXT.md says "invalid score (NaN, wrong type): Store null + warning"
   - What's unclear: Where to surface the warning - console.warn? Return in result?
   - Recommendation: console.warn for now, can add warning field to ScorerResult later if needed

3. **Meta-Scorer Recursion Prevention**
   - What we know: Optional scorers[] can evaluate scorer output
   - What's unclear: Should we prevent scorer from being used as both target AND meta-scorer?
   - Recommendation: No prevention needed - that's a valid calibration use case (testing scorer against itself)

## Sources

### Primary (HIGH confidence)

- `packages/core/src/evals/base.ts` - MastraScorer, ScorerRun interface, scorer.run() method
- `packages/core/src/datasets/run/executor.ts` - Existing executeTarget, executeAgent, executeWorkflow patterns
- `packages/core/src/datasets/run/scorer.ts` - runScorerSafe, error isolation pattern
- `packages/core/src/datasets/run/index.ts` - resolveTarget handles 'scorer' case
- `packages/core/src/datasets/run/types.ts` - ItemResult, ScorerResult types
- `packages/core/src/storage/types.ts` - DatasetItem, TargetType definitions (lines 567-579)

### Secondary (MEDIUM confidence)

- `.planning/phases/04-scorer-targets/04-CONTEXT.md` - Phase decisions
- `.planning/phases/03-agent-workflow-targets/03-RESEARCH.md` - Pattern reference

### Tertiary (LOW confidence)

- None - all findings from direct codebase analysis

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - using existing infrastructure
- Architecture: HIGH - follows established patterns exactly
- Pitfalls: HIGH - derived from CONTEXT.md decisions and codebase analysis

**Research date:** 2026-01-24
**Valid until:** 60 days (internal patterns are stable)

---

## Implementation Checklist

Based on research, the implementation involves:

1. **Add `output` field to DatasetItem type** in `packages/core/src/storage/types.ts`:

   ```typescript
   export interface DatasetItem {
     // ... existing fields
     output?: unknown; // NEW: The response being evaluated (for scorer targets)
     // ...
   }
   ```

2. **Check storage schema** - verify if `output` column needs adding to dataset items table

3. **Add executeScorer() function** in `packages/core/src/datasets/run/executor.ts`:
   - Call `scorer.run({ input: item.input, output: item.output, groundTruth: item.expectedOutput })`
   - Validate score is number, convert invalid to null + console.warn
   - Return `{ output: { score, reason }, error: null }` on success
   - Catch errors, return `{ output: null, error: message }`

4. **Enable scorer case** in `executeTarget()`:
   - Replace throw with `return await executeScorer(target as MastraScorer, item)`

5. **Update Target type union** in `executor.ts` if needed (may already include MastraScorer)

6. **Add tests**:
   - executeScorer basic success case
   - executeScorer with invalid score (NaN) - verify null + warning
   - executeScorer with scorer error - verify error captured
   - executeScorer with missing item.output - verify behavior
   - Integration test: runDataset with targetType: 'scorer'
   - Meta-scoring test: scorers[] applied to scorer output

7. **No changes needed** to:
   - resolveTarget (already handles scorer)
   - runScorersForItem (works with scorer output)
   - ItemResult type (output field accepts scorer result)
