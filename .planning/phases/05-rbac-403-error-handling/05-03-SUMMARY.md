---
phase: 05-rbac-403-error-handling
plan: 03
subsystem: ui
tags: [react, tanstack-query, 403, error-handling, tables]

# Dependency graph
requires:
  - phase: 05-rbac-403-error-handling
    provides: is403ForbiddenError utility, PermissionDenied component
provides:
  - Table components with error prop accepting 403 errors
  - Consistent 403 handling pattern across all domain tables
affects: [04-PLAN.md (page components need to pass error props)]

# Tech tracking
tech-stack:
  added: []
  patterns: [error prop pattern for tables, 403 check before empty state]

key-files:
  created: []
  modified:
    - packages/playground-ui/src/domains/agents/components/agent-table/agent-table.tsx
    - packages/playground-ui/src/domains/workflows/components/workflow-table/workflow-table.tsx
    - packages/playground-ui/src/domains/tools/components/tool-table/tool-table.tsx
    - packages/playground-ui/src/domains/mcps/components/mcp-table/mcp-table.tsx

key-decisions:
  - "403 check before empty state: Permission denied takes precedence over 'no data'"
  - "Optional error prop: Tables remain backward compatible (error?: Error | null)"

patterns-established:
  - "Table error prop pattern: All domain tables accept optional error prop"
  - "403 precedence: Check is403ForbiddenError BEFORE empty state check"

# Metrics
duration: 2min
completed: 2026-01-30
---

# Phase 5 Plan 3: Integrate 403 Handling in Domain Tables Summary

**Added error prop and PermissionDenied rendering to AgentsTable, WorkflowTable, ToolTable, and MCPTable with 403 check before empty state**

## Performance

- **Duration:** 2 min
- **Started:** 2026-01-30T19:59:07Z
- **Completed:** 2026-01-30T20:00:56Z
- **Tasks:** 5 (Task 1 confirmed no change needed)
- **Files modified:** 4

## Accomplishments

- All four domain tables now accept error prop
- 403 errors render PermissionDenied component instead of empty state
- Pattern established: check 403 BEFORE empty state check

## Task Commits

1. **Task 1: Verify useAgents hook** - No commit needed (hook already returns full query result)
2. **Task 2: AgentsTable 403 handling** - `6be392e` (feat)
3. **Task 3: WorkflowTable 403 handling** - `ac21982` (feat)
4. **Task 4: ToolTable 403 handling** - `d72305d` (feat)
5. **Task 5: MCPTable 403 handling** - `93ac182` (feat)

## Files Created/Modified

- `packages/playground-ui/src/domains/agents/components/agent-table/agent-table.tsx` - Added error prop, 403 check
- `packages/playground-ui/src/domains/workflows/components/workflow-table/workflow-table.tsx` - Added error prop, 403 check
- `packages/playground-ui/src/domains/tools/components/tool-table/tool-table.tsx` - Added error prop, 403 check
- `packages/playground-ui/src/domains/mcps/components/mcp-table/mcp-table.tsx` - Added error prop, 403 check

## Decisions Made

- **403 check before empty state:** Permission denied is a more specific error than "no data" - must take precedence
- **Optional error prop:** Keeps tables backward compatible - callers not passing error will see normal behavior

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All table components ready to receive error prop
- 04-PLAN.md can now wire up page components to pass error from hooks to tables

---
*Phase: 05-rbac-403-error-handling*
*Completed: 2026-01-30*
