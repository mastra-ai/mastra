# Roadmap: Evented Workflow Runtime Parity

## Milestones

- ✅ **v1.0 Runtime Parity** - Phases 1-6 (shipped 2026-01-27)
- 🚧 **v1.1 Agent Integration** - Phases 7-9 (in progress)

## Phases

<details>
<summary>✅ v1.0 Runtime Parity (Phases 1-6) - SHIPPED 2026-01-27</summary>

### Phase 1: State Object Support
**Goal:** Implement the state parameter that allows workflows to maintain mutable state across steps
**Plans:** 2 plans

Plans:
- [x] 01-01: Port 12 state-related tests from default to evented runtime (RED phase)
- [x] 01-02: Implement state support to make tests pass (GREEN phase)

### Phase 2: Lifecycle Callbacks
**Goal:** Port 15 callback context tests and fix resourceId propagation
**Plans:** 1 plan

Plans:
- [x] 02-01: Port 15 callback context tests and fix resourceId bug

### Phase 3: Schema Validation
**Goal:** Full schema validation including default values from schemas
**Plans:** 1 plan

Plans:
- [x] 03-01: Port 12 schema validation tests and fix any validation gaps

### Phase 4: Suspend/Resume Edge Cases
**Goal:** Handle all suspend/resume scenarios including parallel, labels, and nested edge cases
**Plans:** 6 plans

Plans:
- [x] 04-01: Auto-resume and error handling (5 passing, 1 skipped)
- [x] 04-02: Resume labels and suspendData (3 passing, 1 skipped)
- [x] 04-03: Parallel/branch suspend (0 passing, 4 skipped)
- [x] 04-04: Context preservation (2 passing)
- [x] 04-05: Nested workflow edge cases (1 passing, 3 skipped)
- [x] 04-06: Foreach suspend/resume (0 passing, 6 skipped)

### Phase 5: Streaming vNext
**Goal:** Implement modern streaming API (stream() and resumeStream() methods)
**Plans:** 1 plan

Plans:
- [x] 05-01: Implement stream() and resumeStream() on EventedRun, unskip 4 streaming tests

### Phase 6: Remaining Parity
**Goal:** Close all remaining test gaps for full parity
**Plans:** 4 plans

Plans:
- [x] 06-01: Storage and error handling tests (12 tests: 6 passing, 6 skipped)
- [x] 06-02: Agent and streaming edge case tests (10 tests: 3 passing, 7 skipped)
- [x] 06-03: Schema validation and sleep fn tests (6 tests: 3 passing, 3 skipped)
- [x] 06-04: Nested, parallel, and misc tests (12 tests: 7 passing, 5 skipped)

</details>

### 🚧 v1.1 Agent Integration (In Progress)

**Milestone Goal:** Complete agent step parity and foreach resume capabilities

Agent steps support modern AI SDK features (V2 models with structured output), TripWire error propagation for processor-driven workflow control, Writer API for custom event emission, and precise foreach iteration resume.

#### Phase 7: V2 Model + TripWire Support

**Goal:** Agent steps support V2 models and propagate TripWire errors from output processors to workflow results

**Depends on:** Phase 6

**Requirements:** AGENT-01, AGENT-02, AGENT-03, AGENT-04

**Success Criteria** (what must be TRUE):
  1. Agent step detects V2 models and uses .stream() instead of .streamLegacy()
  2. Agent step successfully streams responses from V2 models with structured output
  3. TripWire errors caught in agent steps serialize with explicit type markers (__type, status)
  4. Workflow result status reflects tripwire state when agent output processor throws TripWire
  5. TripWire metadata preserved across event boundaries without prototype chain loss

**Plans:** 2 plans

Plans:
- [x] 07-01-PLAN.md — V2 model detection and TripWire catching
- [x] 07-02-PLAN.md — TripWire status propagation and test verification

#### Phase 8: Writer API

**Goal:** Steps can emit custom events via context.writer during execution

**Depends on:** Phase 7

**Requirements:** AGENT-05, AGENT-06, AGENT-07

**Success Criteria** (what must be TRUE):
  1. Step context exposes writer property as ToolStream instance
  2. Writer.write() method emits custom chunks during step execution
  3. Writer.custom() method emits typed custom events with arbitrary payloads
  4. Writer events stream to workflow consumers via pub/sub transport
  5. Writer events maintain correct sequence ordering during step execution

**Plans:** 1 plan

Plans:
- [x] 08-01-PLAN.md — Implement ToolStream writer in StepExecutor and verify tests

#### Phase 9: Foreach Index Resume

**Goal:** Users can resume specific foreach iterations via forEachIndex parameter

**Depends on:** Phase 8

**Requirements:** FOREACH-01, FOREACH-02, FOREACH-03

**Success Criteria** (what must be TRUE):
  1. EventedRun.resume() accepts optional forEachIndex parameter
  2. Resume with forEachIndex targets specific iteration without re-executing previous iterations
  3. forEachIndex stored in __workflow_meta on suspend for tracking
  4. Resume validates forEachIndex is within valid range (0 to foreachTotal-1)

**Plans:** TBD

Plans:
- [ ] 09-01: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 7 → 8 → 9

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. State Object | v1.0 | 2/2 | Complete | 2026-01-27 |
| 2. Lifecycle Callbacks | v1.0 | 1/1 | Complete | 2026-01-27 |
| 3. Schema Validation | v1.0 | 1/1 | Complete | 2026-01-27 |
| 4. Suspend/Resume | v1.0 | 6/6 | Complete | 2026-01-27 |
| 5. Streaming vNext | v1.0 | 1/1 | Complete | 2026-01-27 |
| 6. Remaining Parity | v1.0 | 4/4 | Complete | 2026-01-27 |
| 7. V2 Model + TripWire | v1.1 | 2/2 | Complete | 2026-01-27 |
| 8. Writer API | v1.1 | 1/1 | Complete | 2026-01-27 |
| 9. Foreach Index | v1.1 | 0/TBD | Not started | - |
