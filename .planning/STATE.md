# State: Evented Workflow Runtime Parity

**Project:** Evented Workflow Runtime Parity
**Core Value:** Evented runtime passes the same test suite as default runtime

## Current Position

**Phase:** 3 In Progress
**Plan:** 1/1 in progress (03-01-schema-validation)
**Status:** Task 1 complete (tests ported), Task 2 in progress (fixing failures)

```
Progress: [████░░░░░░] 40%
Phases:   2/6 complete, 1 in progress
Tests:    158/232 expected (68% parity) - pending verification
```

## Gap Analysis Summary

**Current evented runtime state:**

- 146 tests passing in evented-workflow.test.ts
- 6 tests skipped (streaming vNext)
- ~86 tests in default that don't exist in evented

**Major gaps identified:**

1. State object (12 tests) - COMPLETE (Phase 1)
2. Lifecycle callbacks (15 tests) - COMPLETE (Phase 2)
3. Schema defaults (12 tests) - Default value handling
4. Suspend/resume edge cases (18 tests) - Parallel, labels, nested
5. Streaming vNext (6 tests) - Modern streaming API
6. Miscellaneous (43 tests) - Various edge cases

**Intentionally out of scope:**

- Restart functionality (6 tests) - Design decision, throws error

## Current Focus

Phase 3 - Schema Validation in progress. Task 1 complete: 12 schema validation tests ported to evented runtime.

**Current status:**
- ✅ Task 1: All 12 tests ported with evented adaptations
- ⏳ Task 2: Tests running to identify failures (likely isEmpty() check in validateStepInput)
- ⏳ Task 3: Final verification pending Task 2 completion

**Next action:** Complete Task 2 - fix any failing tests, likely in utils.ts validateStepInput

## Performance Metrics

| Metric           | Value |
| ---------------- | ----- |
| Phases completed | 2     |
| Plans completed  | 3     |
| Plans in progress| 1 (03-01) |
| Tests ported     | 39 (27 + 12 new) |
| Tests to port    | ~74   |
| Session count    | 4     |

## Accumulated Context

### Key Decisions

| Decision                           | Rationale                                             | Phase      |
| ---------------------------------- | ----------------------------------------------------- | ---------- |
| Test parity as success metric      | Objective, verifiable measure of feature completeness | Init       |
| Restart excluded from scope        | Intentional design decision in evented runtime        | Init       |
| 6 phases based on feature clusters | Natural grouping from test gap analysis               | Roadmap    |
| State in stepResults.__state       | Allows state to persist across event boundaries       | Phase 1    |
| Nested workflow via component      | Detect both EventedWorkflow and Workflow types        | Phase 1    |
| Item extract only for workflows    | Step executor handles regular steps via foreachIdx    | Phase 1    |
| resourceId via execute() params    | Pass from Run.start() through execute to callbacks    | Phase 2-01 |
| Test Mastra instances per test    | Each test creates own Mastra with workflows registered | Phase 3-01 |
| Subset schema test shares Mastra   | 4 workflows in single test share one Mastra instance  | Phase 3-01 |

### Key Files

| File                                                                    | Purpose                           |
| ----------------------------------------------------------------------- | --------------------------------- |
| `packages/core/src/workflows/evented/workflow.ts`                       | Main EventedWorkflow class        |
| `packages/core/src/workflows/evented/workflow-event-processor/index.ts` | Event processing                  |
| `packages/core/src/workflows/evented/step-executor.ts`                  | Step execution                    |
| `packages/core/src/workflows/evented/execution-engine.ts`               | Evented execution engine          |
| `packages/core/src/workflows/workflow.test.ts`                          | Default runtime tests (reference) |
| `packages/core/src/workflows/evented/evented-workflow.test.ts`          | Evented tests (target)            |

### Active TODOs Found in Code

From evented runtime source:

- `// TODO: Pass proper tracing context when evented workflows support tracing`
- `// TODO: implement state` (in step executor) - MAY BE STALE after Phase 1
- `// TODO: support stream` (for vNext streaming)

### Blockers

None.

### Research Flags

| Phase              | Needs Research? | Reason                             |
| ------------------ | --------------- | ---------------------------------- |
| 1 - State Object   | NO              | COMPLETE                           |
| 2 - Lifecycle      | NO              | COMPLETE                           |
| 3 - Schema         | NO              | Zod integration patterns clear     |
| 4 - Suspend/Resume | MAYBE           | Edge cases need investigation      |
| 5 - Streaming      | YES             | vNext API needs understanding      |
| 6 - Remaining      | NO              | Miscellaneous, case by case        |

## Session Continuity

### Last Session

**Date:** 2026-01-27
**Work completed:** Phase 3 Plan 01 - Task 1 complete (12 schema validation tests ported)
**Stopping point:** Tests running for Task 2 verification

### Session History

| Date       | Work Completed                                          |
| ---------- | ------------------------------------------------------- |
| 2026-01-26 | Gap analysis and roadmap creation                       |
| 2026-01-27 | Phase 1: State Object Support (12 tests passing)        |
| 2026-01-27 | Phase 2-01: Callback context tests (15 tests passing)   |
| 2026-01-27 | Phase 3-01 Task 1: Schema validation tests ported (12)  |

### Resumption Notes

1. Run `cd packages/core && pnpm test evented-workflow.test.ts -t "Schema Validation"` to check Task 2 status
2. Expected failures in default value tests due to isEmpty() check in validateStepInput (utils.ts line 54-55)
3. Fix: Change `inputData = isEmptyData ? prevOutput : validatedInput.data;` to `inputData = validatedInput.data;`
4. After Task 2 complete: Run full test suite to verify 158 tests passing
5. Complete Task 3: Final verification and commit

---

_State initialized: 2026-01-26_
_Last updated: 2026-01-27 after Phase 3 Plan 01 Task 1 completion_
