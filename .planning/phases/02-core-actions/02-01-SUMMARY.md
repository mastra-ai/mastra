---
phase: 02-core-actions
plan: 01
subsystem: api
tags: [browser-tools, accessibility, error-handling, mastra]

# Dependency graph
requires:
  - phase: 01-infrastructure
    provides: BrowserToolset scaffold, navigate tool pattern
provides:
  - BrowserToolError interface for unified error responses
  - ErrorCode type union with 7 error categories
  - createError factory with automatic canRetry logic
  - createSnapshotTool for accessibility tree capture with @e1 refs
affects: [02-core-actions/click, 02-core-actions/type, 02-core-actions/scroll]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Unified error structure with code, message, recoveryHint, canRetry"
    - "Ref format @e1 (not [ref=e1]) for LLM consumption"

key-files:
  created:
    - integrations/agent-browser/src/errors.ts
    - integrations/agent-browser/src/tools/snapshot.ts
  modified: []

key-decisions:
  - "Retryable codes: timeout, element_blocked"
  - "Transform refs from [ref=e1] to @e1 via regex"

patterns-established:
  - "Error factory: createError(code, message, hint?) for all tools"
  - "Page context header in snapshot output"

# Metrics
duration: 2min
completed: 2026-01-27
---

# Phase 02 Plan 01: Error Handling and Snapshot Tool Summary

**Unified error types with createError factory and snapshot tool that captures accessibility tree with @e1 refs and page context header**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-27T04:18:07Z
- **Completed:** 2026-01-27T04:19:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- ErrorCode type union with 7 error categories for browser tool failures
- BrowserToolError interface with LLM-friendly structure (code, message, recoveryHint, canRetry)
- createError factory that auto-sets canRetry based on error code
- createSnapshotTool that captures accessibility tree with @e1, @e2 refs
- Page context header (title, URL, element count) in snapshot output

## Task Commits

Each task was committed atomically:

1. **Task 1: Create unified error handling module** - `8df608b7cb` (feat)
2. **Task 2: Create snapshot tool with custom formatting** - `fec5549ba3` (feat)

## Files Created/Modified
- `integrations/agent-browser/src/errors.ts` - ErrorCode, BrowserToolError, createError
- `integrations/agent-browser/src/tools/snapshot.ts` - createSnapshotTool factory

## Decisions Made
- Retryable error codes: 'timeout' and 'element_blocked' (auto-set by createError)
- Transform refs from agent-browser's [ref=e1] format to @e1 format for LLM friendliness
- Default maxElements to 50 with nullish coalescing fallback for TypeScript strictness

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- TypeScript complained about `input.maxElements` possibly being undefined despite Zod default - fixed with nullish coalescing operator `?? 50`

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Error handling foundation ready for click, type, and scroll tools
- Snapshot tool provides refs that click/type will use
- Pattern established: use createError for all error responses

---
*Phase: 02-core-actions*
*Completed: 2026-01-27*
