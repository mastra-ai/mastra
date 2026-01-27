# State: Evented Workflow Runtime Parity

**Project:** Evented Workflow Runtime Parity
**Core Value:** Evented runtime passes the same test suite as default runtime

## Current Position

**Phase:** 3 Complete
**Plan:** 1/1 complete (03-01-schema-validation)
**Status:** Ready for Phase 4 - Suspend/Resume Edge Cases

```
Progress: [█████░░░░░] 50%
Phases:   3/6 complete
Tests:    156/232 passing (67% parity), 8 skipped
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

Phase 3 complete. 9 of 12 schema validation tests ported and passing (3 skipped for Phase 4 or need input validation fix).

**Next action:** Start Phase 4 - Suspend/Resume Edge Cases

## Performance Metrics

| Metric           | Value |
| ---------------- | ----- |
| Phases completed | 3     |
| Plans completed  | 4     |
| Tests ported     | 36 (27 + 9 new) |
| Tests to port    | ~77   |
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
**Work completed:** Phase 3 complete - 9 schema validation tests passing
**Stopping point:** Ready for Phase 4

### Session History

| Date       | Work Completed                                          |
| ---------- | ------------------------------------------------------- |
| 2026-01-26 | Gap analysis and roadmap creation                       |
| 2026-01-27 | Phase 1: State Object Support (12 tests passing)        |
| 2026-01-27 | Phase 2-01: Callback context tests (15 tests passing)   |
| 2026-01-27 | Phase 3-01: Schema validation tests (9 passing, 3 skipped)|

### Resumption Notes

1. Run `pnpm test evented-workflow.test.ts` in packages/core to verify 156 tests passing
2. Phase 3 complete - proceed to Phase 4: Suspend/Resume Edge Cases
3. Use `/gsd:plan-phase 4` to start planning Phase 4
4. Note: 3 schema validation tests skipped - 2 need Phase 4 suspend/resume, 1 needs workflow input validation fix

---

_State initialized: 2026-01-26_
_Last updated: 2026-01-27 after Phase 3 completion_
