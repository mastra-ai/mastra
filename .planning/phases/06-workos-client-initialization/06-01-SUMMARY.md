---
phase: 06-workos-client-initialization
plan: 01
subsystem: auth
tags: [workos, rbac, constructor, api-consistency]

# Dependency graph
requires:
  - phase: none
    provides: existing MastraRBACWorkos with external WorkOS client pattern
provides:
  - Internal WorkOS client initialization in MastraRBACWorkos
  - API consistency between MastraAuthWorkos and MastraRBACWorkos
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Internal client initialization with env fallback"
    - "Consistent error messages across auth providers"

key-files:
  created: []
  modified:
    - auth/workos/src/types.ts
    - auth/workos/src/rbac-provider.ts
    - auth/workos/src/index.ts

key-decisions:
  - "Clean break from getWorkOS() sharing - no backward compatibility"
  - "Identical error message to MastraAuthWorkos for consistency"
  - "PermissionCacheOptions moved to types.ts for proper re-export"

patterns-established:
  - "Both auth providers accept apiKey/clientId with env var fallback"
  - "Validation error format: 'X and Y are required. Provide them... or set ENV_VAR...'"

# Metrics
duration: 2min
completed: 2026-01-30
---

# Phase 6 Plan 01: WorkOS Client Initialization Summary

**MastraRBACWorkos now initializes WorkOS client internally, matching MastraAuthWorkos pattern**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-30T20:15:00Z
- **Completed:** 2026-01-30T20:17:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- MastraRBACWorkosOptions now has apiKey and clientId optional fields
- Constructor creates WorkOS client internally (no more external dependency)
- Package examples updated to show simpler API without getWorkOS() sharing

## Task Commits

Each task was committed atomically:

1. **Task 1: Update types and constructor for internal WorkOS init** - `69565ad367` (feat)
2. **Task 2: Update package example documentation** - `1fad5a1cd0` (docs)

## Files Created/Modified

- `auth/workos/src/types.ts` - Added apiKey/clientId to MastraRBACWorkosOptions, moved PermissionCacheOptions here
- `auth/workos/src/rbac-provider.ts` - Removed MastraRBACWorkosFullOptions, constructor now creates WorkOS internally
- `auth/workos/src/index.ts` - Updated package example, fixed PermissionCacheOptions export

## Decisions Made

- Clean break from getWorkOS() sharing pattern (research recommendation)
- Error message identical to MastraAuthWorkos for consistency
- PermissionCacheOptions moved to types.ts for better organization

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- WorkOS client initialization is now consistent across both providers
- No blockers or concerns

---
*Phase: 06-workos-client-initialization*
*Completed: 2026-01-30*
