---
phase: 02-execution-core
started: 2026-01-24T22:45:00Z
status: deferred
---

# Phase 2: Execution Core — User Acceptance Testing

**Phase Goal:** Run datasets against targets with automatic scoring and result persistence

## Test Checkpoints

### Test 1: runDataset executes items and returns summary
**Status:** ✓ passed
**What to verify:** Call runDataset() with a dataset and mock agent target, confirm all items execute and summary contains correct counts.

### Test 2: Run status transitions correctly
**Status:** pending
**What to verify:** Verify run starts as 'pending', moves to 'running', ends as 'completed' (or 'failed' if all items fail).

### Test 3: Scorers apply inline with error isolation
**Status:** pending
**What to verify:** Pass scorers to runDataset(), confirm scores appear in results, and a failing scorer doesn't break other scorers.

### Test 4: RunsInMemory persists run and results
**Status:** pending
**What to verify:** After runDataset() completes, query RunsInMemory to verify run record and results are retrievable.

### Test 5: AbortSignal cancels execution
**Status:** pending
**What to verify:** Pass an AbortSignal, abort mid-execution, confirm run stops early.

## Session Log

*(Checkpoints recorded as completed)*

