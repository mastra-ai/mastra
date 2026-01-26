# State: Evented Workflow Runtime Parity

**Project:** Evented Workflow Runtime Parity
**Core Value:** Evented runtime passes the same test suite as default runtime

## Current Position

**Phase:** Not started
**Plan:** None active
**Status:** Roadmap created, ready for phase planning

```
Progress: [░░░░░░░░░░] 0%
Phases:   0/6 complete
Tests:    119/232 passing (51% parity)
```

## Gap Analysis Summary

**Current evented runtime state:**

- 119 tests passing in evented-workflow.test.ts
- 6 tests skipped (streaming vNext)
- 119 tests in default that don't exist in evented

**Major gaps identified:**

1. State object (12 tests) - `state` parameter not implemented
2. Lifecycle callbacks (16 tests) - onFinish/onError callbacks
3. Schema defaults (12 tests) - Default value handling
4. Suspend/resume edge cases (18 tests) - Parallel, labels, nested
5. Streaming vNext (6 tests) - Modern streaming API
6. Miscellaneous (43 tests) - Various edge cases

**Intentionally out of scope:**

- Restart functionality (6 tests) - Design decision, throws error

## Current Focus

Ready to begin Phase 1: State Object Support

**Next action:** `/gsd-plan-phase 1`

## Performance Metrics

| Metric           | Value |
| ---------------- | ----- |
| Phases completed | 0     |
| Plans completed  | 0     |
| Tests to port    | ~113  |
| Session count    | 1     |

## Accumulated Context

### Key Decisions

| Decision                           | Rationale                                             | Phase   |
| ---------------------------------- | ----------------------------------------------------- | ------- |
| Test parity as success metric      | Objective, verifiable measure of feature completeness | Init    |
| Restart excluded from scope        | Intentional design decision in evented runtime        | Init    |
| 6 phases based on feature clusters | Natural grouping from test gap analysis               | Roadmap |

### Key Files

| File                                                                    | Purpose                           |
| ----------------------------------------------------------------------- | --------------------------------- |
| `packages/core/src/workflows/evented/workflow.ts`                       | Main EventedWorkflow class        |
| `packages/core/src/workflows/evented/workflow-event-processor/index.ts` | Event processing                  |
| `packages/core/src/workflows/evented/step-executor.ts`                  | Step execution                    |
| `packages/core/src/workflows/workflow.test.ts`                          | Default runtime tests (reference) |
| `packages/core/src/workflows/evented/evented-workflow.test.ts`          | Evented tests (target)            |

### Active TODOs Found in Code

From evented runtime source:

- `// TODO: Pass proper tracing context when evented workflows support tracing`
- `// TODO: implement state` (in step executor)
- `// TODO: support stream` (for vNext streaming)

### Blockers

None.

### Research Flags

| Phase              | Needs Research? | Reason                             |
| ------------------ | --------------- | ---------------------------------- |
| 1 - State Object   | NO              | Clear pattern from default runtime |
| 2 - Lifecycle      | NO              | Standard callback pattern          |
| 3 - Schema         | NO              | Zod integration patterns clear     |
| 4 - Suspend/Resume | MAYBE           | Edge cases need investigation      |
| 5 - Streaming      | YES             | vNext API needs understanding      |
| 6 - Remaining      | NO              | Miscellaneous, case by case        |

## Session Continuity

### Last Session

**Date:** 2026-01-26
**Work completed:** Gap analysis and roadmap creation
**Stopping point:** Ready for phase planning

### Resumption Notes

1. Run `pnpm test` in packages/core to verify current test state
2. Review the 119 missing tests in `/tmp/default-tests.txt` vs `/tmp/evented-tests.txt`
3. Start with `/gsd-plan-phase 1` for State Object Support
4. Each phase: port tests from default → fix failures → verify parity

---

_State initialized: 2026-01-26_
_Last updated: 2026-01-26 after gap analysis_
