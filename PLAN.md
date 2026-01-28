# Evented Workflow Engine Parity Plan

## Current State
- **Passing tests**: ~195
- **Skipped tests**: 33
- Target: Parity with default execution engine

---

## Stage 1: Input/Resume Validation (Easy - 3 tests)

**Goal**: Throw proper errors for invalid input/resume data

### Tests to unskip:
- Line 6437: `should throw error if trigger data is invalid`
- Line 7052: `should throw error when resuming with invalid resume data`
- Line 7138: `should use default value from resumeSchema when resuming`

### Implementation:
1. **workflow.ts** - Add input validation in `execute()` before starting workflow
2. **workflow.ts** - Add resume data validation in `resume()` method
3. **workflow.ts** - Apply schema defaults from `resumeSchema` when resuming

### Files:
- `packages/core/src/workflows/evented/workflow.ts`

---

## Stage 2: Storage/Snapshot Sync (Easy - 4 tests)

**Goal**: Sync run status from storage on createRun

### Tests to unskip:
- Line 11697: `should return correct status from storage on createRun`
- Line 11776: `should return only requested fields when fields option is specified`
- Line 11831: `should update run status from storage snapshot`
- Line 11901: `should use shouldPersistSnapshot option`

### Implementation:
1. **workflow.ts** - In `createRun()`, check storage for existing snapshot and sync status
2. **workflow.ts** - Support `fields` option to filter returned data
3. **execution-engine.ts** - Respect `shouldPersistSnapshot` option

### Files:
- `packages/core/src/workflows/evented/workflow.ts`
- `packages/core/src/workflows/evented/execution-engine.ts`

---

## Stage 3: ForEach Index Resume (Medium - 6 tests)

**Goal**: Resume forEach at specific iteration index

### Tests to unskip:
- Line 18925: `should suspend and resume when running single item concurrency`
- Line 19024: `should suspend and resume when running all items concurrency`
- Line 19117: `should suspend and resume provided index with all items concurrency`
- Line 19219: `should suspend and resume provided label with all items concurrency`
- Line 19320: `should suspend and resume with partial item concurrency`
- Line 19417: `should suspend and resume provided index with partial concurrency`

### Implementation:
1. **workflow.ts** - Add `forEachIndex?: number` parameter to `resume()` signature
2. **step-executor.ts** - Store `foreachIndex` in `__workflow_meta` during suspend
3. **execution-engine.ts** - Thread `forEachIndex` through to pubsub events
4. **workflow-event-processor/index.ts** - Add `forEachIndex` to `ProcessorArgs`
5. **workflow-event-processor/loop.ts** - Skip iterations before target index on resume

### Files:
- `packages/core/src/workflows/evented/workflow.ts`
- `packages/core/src/workflows/evented/step-executor.ts`
- `packages/core/src/workflows/evented/execution-engine.ts`
- `packages/core/src/workflows/evented/workflow-event-processor/index.ts`
- `packages/core/src/workflows/evented/workflow-event-processor/loop.ts`

---

## Stage 4: Loop Resume Bugs (Medium - 2 tests)

**Goal**: Fix resume inside loops causing hangs/premature exits

### Tests to unskip:
- Line 18222: `should have correct input value when resuming in loop (bug #6669)`
- Line 18336: `should handle suspend/resume in nested dountil workflow (bug #5650)`

### Implementation:
1. Debug event flow in `processWorkflowLoop` and `processWorkflowDoUntil`
2. Ensure loop state (iteration count, condition result) preserved on resume
3. Fix nested workflow resume within loop context

### Files:
- `packages/core/src/workflows/evented/workflow-event-processor/loop.ts`

---

## Stage 5: Nested Workflow Resolution (Medium - 2 tests)

**Goal**: Auto-detect suspended nested workflow steps

### Tests to unskip:
- Line 18090: `should resume nested workflow with only nested workflow step provided`
- Line 19524: `should return workflow run with nested workflow steps info`
- Line 19637: `should exclude nested workflows when withNestedWorkflows is false`

### Implementation:
1. **workflow.ts** - In `resume()`, if step is a workflow, check its children for suspended state
2. **workflow.ts** - Fix `getWorkflowRunById` timeout for nested workflows

### Files:
- `packages/core/src/workflows/evented/workflow.ts`

---

## Stage 6: Miscellaneous (Easy-Medium - 5 tests)

### Tests to unskip:
- Line 1760: `should continue streaming current run on subsequent stream calls`
- Line 5376: `should persist error message without stack trace in snapshot`
- Line 5437: `should persist MastraError message without stack trace in snapshot`
- Line 19941: `should bail foreach execution when called in concurrent batch`
- Line 19945: `should not show removed requestContext values in subsequent steps`

---

## Stage 7: Architectural Differences (Hard - 7 tests)

These require significant design decisions or architectural changes:

### Parallel Multi-Suspend (5 tests)
- Lines 17185, 18442, 18530, 18618, 18720
- **Issue**: Evented stops at first suspend in parallel
- **Decision needed**: Is this acceptable behavior for event-driven model?

### Branch Execution (2 tests)
- Lines 18618, 18720
- **Issue**: Only executes first matching condition (default executes all)
- **Decision needed**: Should evented match default behavior?

---

## Verification

After each stage, run:
```bash
cd packages/core
pnpm test src/workflows/evented/evented-workflow.test.ts
```

Check skipped test count decreases as expected.

---

## Summary

| Stage | Tests | Difficulty | Status |
|-------|-------|------------|--------|
| 1. Input/Resume Validation | 3 | Easy | TODO |
| 2. Storage/Snapshot Sync | 4 | Easy | TODO |
| 3. ForEach Index Resume | 6 | Medium | TODO |
| 4. Loop Resume Bugs | 2 | Medium | TODO |
| 5. Nested Workflow Resolution | 3 | Medium | TODO |
| 6. Miscellaneous | 5 | Mixed | TODO |
| 7. Architectural Differences | 7 | Hard | Decision needed |

**Total**: 30 tests across 7 stages (3 remaining are duplicates/related)
