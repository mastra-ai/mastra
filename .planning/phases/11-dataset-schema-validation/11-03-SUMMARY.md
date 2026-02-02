---
phase: 11-dataset-schema-validation
plan: 03
subsystem: api
tags: [datasets, workflows, schema, json-schema, zod, server, client-sdk]

# Dependency graph
requires:
  - phase: 11-01
    provides: SchemaValidator and SchemaValidationError for item validation
provides:
  - Dataset API routes with inputSchema/outputSchema fields
  - Workflow schema route returning parsed JSON schemas
  - Client SDK types for schema fields
  - Client getSchema() method for workflows
affects: [11-04, 11-06, 11-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - JSON Schema field as z.union([z.record(z.unknown()), z.null()]).optional()
    - Type casting for JSONSchema7 to Record<string, unknown> in handlers

key-files:
  modified:
    - packages/server/src/server/schemas/datasets.ts
    - packages/server/src/server/handlers/datasets.ts
    - packages/server/src/server/handlers/workflows.ts
    - packages/server/src/server/server-adapter/routes/workflows.ts
    - client-sdks/client-js/src/types.ts
    - client-sdks/client-js/src/resources/workflow.ts

key-decisions:
  - 'JSONSchema7 cast to Record<string, unknown> for Zod schema compatibility'
  - 'Workflow schema returns parsed JSON (not stringified) for direct client use'

patterns-established:
  - 'jsonSchemaField Zod schema for optional nullable JSON Schema fields'

# Metrics
duration: 5min
completed: 2026-02-02
---

# Phase 11 Plan 03: API Routes for Schema Management Summary

**Extended dataset API with inputSchema/outputSchema fields, added GET /workflows/:workflowId/schema route, updated client SDK types and methods**

## Performance

- **Duration:** 5 min
- **Started:** 2026-02-02T20:18:41Z
- **Completed:** 2026-02-02T20:23:58Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- Dataset CRUD routes now accept and return inputSchema/outputSchema fields
- Workflow schema route returns parsed JSON schemas for direct client use
- Client SDK Dataset type includes schema fields
- Client SDK Workflow class has getSchema() method
- SchemaValidationError handling in dataset/item CRUD handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend dataset API schemas and handlers for schema fields** - `8214afdfb1` (feat)
2. **Task 2: Add workflow schema route, register it, and update client SDK** - `bb434e4223` (feat)

## Files Created/Modified

- `packages/server/src/server/schemas/datasets.ts` - Added jsonSchemaField Zod type and schema fields
- `packages/server/src/server/handlers/datasets.ts` - Pass schema fields, handle SchemaValidationError
- `packages/server/src/server/handlers/workflows.ts` - Added GET_WORKFLOW_SCHEMA_ROUTE
- `packages/server/src/server/server-adapter/routes/workflows.ts` - Registered workflow schema route
- `client-sdks/client-js/src/types.ts` - Added schema fields to Dataset and param types
- `client-sdks/client-js/src/resources/workflow.ts` - Added getSchema() method

## Decisions Made

- JSONSchema7 from json-schema package doesn't match Record<string, unknown> - cast with `as any` for handler returns
- Workflow schema route parses the stringified JSON (from superjson stringify) and returns objects for direct client consumption

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Type incompatibility between JSONSchema7 and Record<string, unknown> in Zod response schemas - resolved with type casting

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- API routes ready for UI integration in 11-04
- Client SDK ready for playground hooks in 11-06
- Schema validation errors propagate correctly for 11-07 error handling UI

---

_Phase: 11-dataset-schema-validation_
_Completed: 2026-02-02_
