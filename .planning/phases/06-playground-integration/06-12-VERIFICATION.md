---
phase: 06-playground-integration
plan: 12
verified: 2026-01-26T23:30:00Z
status: passed
score: 5/5 must-haves verified
---

# Plan 06-12: Gap Closure - Scores and Trace Link Verification

**Plan Goal:** Fix scores not linked to results, and trace link navigation
**Verified:** 2026-01-26T23:30:00Z
**Status:** passed

## Goal Achievement

### Observable Truths

| #   | Truth                                            | Status     | Evidence                                                            |
| --- | ------------------------------------------------ | ---------- | ------------------------------------------------------------------- |
| 1   | RunResult type includes scores array             | ✓ VERIFIED | types.ts line 685: `scores: ScorerResult[]`                         |
| 2   | Scores stored with result during run execution   | ✓ VERIFIED | run/index.ts line 180: `scores: itemScores` in addResult            |
| 3   | API response includes scores per result          | ✓ VERIFIED | schemas/datasets.ts line 164: `scores: z.array(scorerResultSchema)` |
| 4   | Results table displays scores from result.scores | ✓ VERIFIED | results-table.tsx line 101: `result.scores` used directly           |
| 5   | View Trace link navigates to working trace view  | ✓ VERIFIED | result-detail-dialog.tsx line 95: `/observability?traceId=`         |

**Score:** 5/5 truths verified

### Required Artifacts

**Truth 1: RunResult includes scores**

| Artifact                             | Status     | Details                                                                                                                             |
| ------------------------------------ | ---------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/storage/types.ts` | ✓ VERIFIED | Line 659: ScorerResult interface with scorerId/scorerName/score/reason/error. Line 685: `scores: ScorerResult[]` field in RunResult |

**Truth 2: Scores stored with result**

| Artifact                                  | Status     | Details                                                                                                                                        |
| ----------------------------------------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/datasets/run/index.ts` | ✓ VERIFIED | 278 lines. Lines 155-163: runScorersForItem called. Line 180: scores passed to addResult. Lines 184-187: scores included in RunSummary results |

**Truth 3: API includes scores**

| Artifact                                         | Status     | Details                                                                                                                                       |
| ------------------------------------------------ | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/server/src/server/schemas/datasets.ts` | ✓ VERIFIED | Line 141: scorerResultSchema definition. Line 164: scores field in runResultResponseSchema. Lines 235-242: scores in runSummaryResponseSchema |

**Truth 4: UI displays result.scores**

| Artifact                                                                           | Status     | Details                                                                                                                                                                          |
| ---------------------------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/playground-ui/src/domains/datasets/components/results/results-table.tsx` | ✓ VERIFIED | Line 37: `scores: ScoreData[]` in RunResultData. Line 101: `result.scores` extracted. Lines 103-106: scores formatted for display. Line 140: scores passed to ResultDetailDialog |
| `packages/playground/src/pages/datasets/dataset/run/index.tsx`                     | ✓ VERIFIED | 143 lines. Line 86: results from resultsData. Lines 130-133: ResultsTable receives results without separate scores prop                                                          |

**Truth 5: Trace link works**

| Artifact                                                                                  | Status     | Details                                                                                                                     |
| ----------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------- |
| `packages/playground-ui/src/domains/datasets/components/results/result-detail-dialog.tsx` | ✓ VERIFIED | Line 95: Link href uses `/observability?traceId=${result.traceId}`. Lines 90-103: Conditional rendering when traceId exists |

### Key Link Verification

| From                      | To                    | Via                   | Status  | Details                                           |
| ------------------------- | --------------------- | --------------------- | ------- | ------------------------------------------------- |
| runDataset                | addResult with scores | Line 180 scores param | ✓ WIRED | itemScores from runScorersForItem passed directly |
| InMemory addResult        | scores field          | Line 127              | ✓ WIRED | `scores: input.scores ?? []`                      |
| LibSQL addResult          | scores serialization  | Line 336              | ✓ WIRED | `scores: JSON.stringify(scores)`                  |
| LibSQL transformResultRow | scores parsing        | Line 85               | ✓ WIRED | `scores: row.scores ? safelyParseJSON(...) : []`  |
| runResultResponseSchema   | scorerResultSchema    | Line 164              | ✓ WIRED | z.array(scorerResultSchema) validates scores      |
| ResultsTable              | result.scores         | Line 101              | ✓ WIRED | const itemScores = result.scores ?? []            |
| ResultDetailDialog        | scores prop           | Line 140              | ✓ WIRED | scores={selectedResult.scores ?? []}              |
| Trace Link                | observability page    | Line 95 href          | ✓ WIRED | /observability?traceId= with conditional render   |

### Storage Implementation Verification

**Schema:**

- constants.ts line 183: `scores: { type: 'jsonb', nullable: true }`

**InMemory:**

- inmemory.ts line 127: `scores: input.scores ?? []` directly stored

**LibSQL:**

- libsql/runs/index.ts line 336: JSON.stringify on insert
- libsql/runs/index.ts line 85: safelyParseJSON on read

### Anti-Patterns Found

None detected.

**Observations:**

- Scores embedded pattern cleaner than separate ScoresStorage queries
- Type safety maintained throughout: ScorerResult interface → Zod schema → UI types
- Trace link query param pattern matches existing observability routing

### Human Verification Required

#### 1. Scores Display in Results Table

**Test:**

1. Create dataset with items
2. Trigger run with at least 2 scorers selected
3. Wait for run completion
4. Navigate to run detail page
5. Verify Scores column shows values like "scorer1: 0.85, scorer2: 0.92"
6. Click on a result row
7. Verify Scores tab appears in detail dialog
8. Verify table shows scorer name, score value, and reason

**Expected:**

- Scores appear inline in table
- All scorers show in Scores column
- Detail dialog has functional Scores tab
- No API errors in network tab

**Why human:** Requires completed run with actual scorers, visual verification

#### 2. View Trace Link

**Test:**

1. Trigger run against agent or workflow (not scorer)
2. Wait for completion
3. Click on a result row
4. Verify "View Trace" link appears in metadata
5. Click "View Trace"
6. Verify navigation to /observability page
7. Verify trace dialog opens automatically with correct trace

**Expected:**

- Trace link only shows for agent/workflow runs
- Link navigates to observability page
- Trace dialog opens with selected trace
- traceId matches between result and trace view

**Why human:** Requires navigation verification and visual confirmation of trace dialog

---

_Verified: 2026-01-26T23:30:00Z_
_Verifier: Claude (gsd-verifier)_
_Plan 06-12 gap closure: All must-haves verified against codebase_
