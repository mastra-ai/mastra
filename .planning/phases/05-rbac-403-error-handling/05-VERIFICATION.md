---
phase: 05-rbac-403-error-handling
verified: 2026-01-30T20:10:00Z
status: passed
score: 4/4 must-haves verified
---

# Phase 5: RBAC 403 Error Handling Verification Report

**Phase Goal:** Fix playground retry behavior and fallback on 403 RBAC errors
**Verified:** 2026-01-30T20:10:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth                                                           | Status     | Evidence                                                                                                 |
| --- | --------------------------------------------------------------- | ---------- | -------------------------------------------------------------------------------------------------------- |
| 1   | 403 responses are not retried                                   | ✓ VERIFIED | `shouldRetryQuery()` returns false when `isNonRetryableError()` detects 403                              |
| 2   | 403 errors route to Permission Denied page immediately          | ✓ VERIFIED | All 4 tables check `is403ForbiddenError()` BEFORE empty state and render PermissionDenied component     |
| 3   | No fallback to "no agents created" docs page on 403             | ✓ VERIFIED | 403 check at line 62 (agents), 68 (workflows), 59 (tools), 57 (mcps) — BEFORE empty state at line 70+   |
| 4   | Other error codes retain existing behavior                      | ✓ VERIFIED | `shouldRetryQuery()` only returns false for 400/401/403/404, others retry up to 3 times (line 74)       |

**Score:** 4/4 truths verified

### Required Artifacts

| Artifact                                                        | Expected                                      | Status     | Details                                                                                       |
| --------------------------------------------------------------- | --------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------- |
| `packages/playground-ui/src/lib/query-utils.ts`                | Error detection utilities                     | ✓ VERIFIED | 77 lines, exports is403ForbiddenError, isNonRetryableError, shouldRetryQuery                 |
| `packages/playground-ui/src/lib/tanstack-query.tsx`            | QueryClient with global retry config          | ✓ VERIFIED | Lines 14-16: retry: shouldRetryQuery applied to defaultOptions.queries                        |
| `packages/playground-ui/src/ds/components/PermissionDenied/`   | UI component for 403 errors                   | ✓ VERIFIED | 45 lines, renders EmptyState with ShieldX icon, resource-specific messaging                   |
| `packages/playground-ui/src/domains/agents/components/`        | AgentsTable with error prop                   | ✓ VERIFIED | Line 26: error?: Error \| null, Line 62: 403 check before empty state                         |
| `packages/playground-ui/src/domains/workflows/components/`     | WorkflowTable with error prop                 | ✓ VERIFIED | Line 23: error?: Error \| null, Line 68: 403 check before empty state                         |
| `packages/playground-ui/src/domains/tools/components/`         | ToolTable with error prop                     | ✓ VERIFIED | Line 25: error?: Error \| null, Line 59: 403 check before empty state                         |
| `packages/playground-ui/src/domains/mcps/components/`          | MCPTable with error prop                      | ✓ VERIFIED | Line 24: error?: Error \| null, Line 57: 403 check before empty state                         |
| `packages/playground/src/pages/agents/index.tsx`               | Agents page passes error to table             | ✓ VERIFIED | Line 23: destructures error, Line 63: passes to AgentsTable                                   |
| `packages/playground/src/pages/workflows/index.tsx`            | Workflows page passes error to table          | ✓ VERIFIED | Line 18: destructures error, Line 43: passes to WorkflowTable                                 |
| `packages/playground/src/pages/tools/index.tsx`                | Tools page passes error to table              | ✓ VERIFIED | Line 20: destructures error, Line 45: passes to ToolTable                                     |
| `packages/playground/src/pages/mcps/index.tsx`                 | MCPs page passes error to table               | ✓ VERIFIED | Line 18: destructures error, Line 43: passes to MCPTable                                      |
| `packages/playground/src/App.tsx`                              | PlaygroundQueryClient wraps app               | ✓ VERIFIED | Line 219: PlaygroundQueryClient wraps StudioConfigProvider                                    |

### Key Link Verification

| From                  | To                         | Via                                  | Status     | Details                                                                              |
| --------------------- | -------------------------- | ------------------------------------ | ---------- | ------------------------------------------------------------------------------------ |
| PlaygroundQueryClient | shouldRetryQuery           | defaultOptions.queries.retry         | ✓ WIRED    | tanstack-query.tsx line 15 imports shouldRetryQuery, line 15 applies to QueryClient |
| shouldRetryQuery      | isNonRetryableError        | Function call                        | ✓ WIRED    | query-utils.ts line 71 calls isNonRetryableError                                     |
| isNonRetryableError   | HTTP_NO_RETRY_STATUSES     | Array.includes check                 | ✓ WIRED    | query-utils.ts lines 46, 52, 58 check against [400, 401, 403, 404]                  |
| AgentsTable           | is403ForbiddenError        | Conditional check                    | ✓ WIRED    | agent-table.tsx line 6 imports, line 62 checks                                       |
| AgentsTable           | PermissionDenied           | Render on 403                        | ✓ WIRED    | agent-table.tsx line 4 imports, line 65 renders                                      |
| Agents page           | AgentsTable error prop     | Destructure + pass                   | ✓ WIRED    | pages/agents/index.tsx line 23 gets error from hook, line 63 passes to table        |
| WorkflowTable         | is403ForbiddenError        | Conditional check                    | ✓ WIRED    | workflow-table.tsx line 6 imports, line 68 checks                                    |
| WorkflowTable         | PermissionDenied           | Render on 403                        | ✓ WIRED    | workflow-table.tsx line 4 imports, line 71 renders                                   |
| Workflows page        | WorkflowTable error prop   | Destructure + pass                   | ✓ WIRED    | pages/workflows/index.tsx line 18 gets error from hook, line 43 passes to table     |
| ToolTable             | is403ForbiddenError        | Conditional check                    | ✓ WIRED    | tool-table.tsx line 7 imports, line 59 checks                                        |
| ToolTable             | PermissionDenied           | Render on 403                        | ✓ WIRED    | tool-table.tsx line 4 imports, line 62 renders                                       |
| Tools page            | ToolTable error prop       | Destructure + pass                   | ✓ WIRED    | pages/tools/index.tsx line 20 gets error from hook, line 45 passes to table         |
| MCPTable              | is403ForbiddenError        | Conditional check                    | ✓ WIRED    | mcp-table.tsx line 6 imports, line 57 checks                                         |
| MCPTable              | PermissionDenied           | Render on 403                        | ✓ WIRED    | mcp-table.tsx line 4 imports, line 60 renders                                        |
| MCPs page             | MCPTable error prop        | Destructure + pass                   | ✓ WIRED    | pages/mcps/index.tsx line 18 gets error from hook, line 43 passes to table          |

### Requirements Coverage

No requirements mapped to this phase in REQUIREMENTS.md.

### Anti-Patterns Found

No anti-patterns detected. All implementations are substantive:

- Error detection functions have multiple format checks (status, statusCode, message)
- PermissionDenied component renders real UI with icon and contextual messaging
- All table components check 403 BEFORE empty state (correct precedence)
- All hooks return full TanStack Query result (error available)
- All page components wire error prop through

### Human Verification Required

While all automated checks pass, the following should be tested manually:

#### 1. 403 Error Display

**Test:** In a Cloud environment with RBAC, access a resource without permission (e.g., agents list when user lacks `agents:read` permission)
**Expected:** PermissionDenied component appears immediately with ShieldX icon and message "You don't have permission to access agents. Contact your administrator for access."
**Why human:** Requires Cloud RBAC setup with real 403 responses

#### 2. No Retry on 403

**Test:** Monitor network tab when triggering a 403 error
**Expected:** Single request only — no retries
**Why human:** Requires monitoring network behavior in browser

#### 3. Other Errors Still Retry

**Test:** Trigger a transient error (500, network timeout)
**Expected:** Request retries up to 3 times before failing
**Why human:** Requires simulating transient failures

#### 4. Empty State When No Data

**Test:** Access agents page when user HAS permission but there are no agents
**Expected:** EmptyAgentsTable component with "No Agents Yet" and docs link
**Why human:** Need to distinguish between 403 and legitimate empty data

---

## Verification Methodology

### Level 1: Existence
All required files exist and are in expected locations.

### Level 2: Substantive
- `query-utils.ts`: 77 lines with 3 exported functions and comprehensive format checking
- `PermissionDenied.tsx`: 45 lines with icon, title, description, and actionSlot props
- All tables: 150+ lines each with full table rendering logic
- All 403 checks: Multi-line if blocks with early returns
- Global retry config: Applied to QueryClient defaultOptions

### Level 3: Wired
- PlaygroundQueryClient wraps entire app (App.tsx line 219)
- shouldRetryQuery imported and used in QueryClient config
- is403ForbiddenError imported in all 4 table files
- PermissionDenied imported in all 4 table files
- Error prop passed from hooks to tables in all 4 pages
- All exports present in package index files

### Precedence Verification
All 4 tables follow correct precedence order:
1. 403 check first (lines 57-68 depending on table)
2. Empty state check second (lines 65-77 depending on table)
3. Normal rendering last

This ensures Permission Denied takes precedence over "no data" empty states.

---

_Verified: 2026-01-30T20:10:00Z_
_Verifier: Claude (gsd-verifier)_
