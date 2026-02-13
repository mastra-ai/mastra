---
phase: 05-rbac-403-error-handling
plan: 01
subsystem: ui
tags: [tanstack-query, error-handling, rbac, 403]

requires:
  - phase: null
    provides: null
provides:
  - is403ForbiddenError() utility for 403 detection
  - isNonRetryableError() for 4xx client error detection
  - shouldRetryQuery() for TanStack Query retry config
  - Global QueryClient retry configuration
affects: [05-02, 05-03, 05-04]

tech-stack:
  added: []
  patterns: [error-detection-utilities, tanstack-query-global-retry]

key-files:
  created:
    - packages/playground-ui/src/lib/query-utils.ts
  modified:
    - packages/playground-ui/src/lib/tanstack-query.tsx
    - packages/playground-ui/src/index.ts

key-decisions:
  - "Check multiple error formats: status prop, statusCode prop, message string"
  - "Non-retryable statuses: 400, 401, 403, 404"
  - "Retry config applied as default, can be overridden per-query"

patterns-established:
  - "Error detection: is*Error() + shouldRetry*() pattern"

duration: 2min
completed: 2026-01-30
---

# Phase 5 Plan 01: 403 Error Detection and Query Retry Handling Summary

**Centralized 403/4xx error detection utilities with TanStack Query global retry config to prevent retrying RBAC permission errors**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-30T19:55:27Z
- **Completed:** 2026-01-30T19:57:25Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- `is403ForbiddenError()` detects 403 in status prop, statusCode prop, or error message
- `isNonRetryableError()` detects 400/401/403/404 client errors
- `shouldRetryQuery()` default retry function that skips client errors
- QueryClient configured with global retry config

## Task Commits

1. **Task 1: Create query-utils.ts** - `34b19fbdb7` (feat)
2. **Task 2: Update tanstack-query.tsx** - `1da5f6725e` (feat) [committed with 05-02]
3. **Task 3: Export from index.ts** - `b4cd15891a` (feat)

## Files Created/Modified

- `packages/playground-ui/src/lib/query-utils.ts` - Error detection and retry utilities
- `packages/playground-ui/src/lib/tanstack-query.tsx` - Global retry config applied
- `packages/playground-ui/src/index.ts` - Export query-utils

## Decisions Made

- Check multiple error formats (status, statusCode, message) for compatibility with various HTTP clients
- Non-retryable status codes: 400, 401, 403, 404 (client errors that won't resolve with retries)
- Retry config applied as default but can be overridden per-query via options spread

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## Next Phase Readiness

- Query utilities ready for use in domain hooks
- 05-02 (PermissionDenied component) can proceed independently
- 05-03 will integrate these utilities in domain hooks

---
*Phase: 05-rbac-403-error-handling*
*Completed: 2026-01-30*
