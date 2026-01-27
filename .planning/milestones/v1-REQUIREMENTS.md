# Requirements Archive: v1 Evented Workflow Runtime Parity

**Archived:** 2026-01-27
**Status:** SHIPPED

This is the archived requirements specification for v1.
For current requirements, see `.planning/REQUIREMENTS.md` (created for next milestone).

---

# Requirements: Evented Workflow Runtime Parity

**Defined:** 2026-01-26
**Core Value:** Evented runtime passes the same test suite as default runtime

## v1 Requirements

Requirements for full feature parity. Each maps to roadmap phases.

### State Management

- [x] **STATE-01**: Step results are persisted and retrievable across event boundaries — v1.0
- [x] **STATE-02**: Full workflow state can be serialized to and deserialized from storage — v1.0

### Error Handling

- [x] **ERR-01**: Errors are captured at step execution and propagated through workflow — v1.0
- [x] **ERR-02**: Errors maintain identity when serialized/deserialized across events — v1.0
- [x] **ERR-03**: TripWire, MastraError, and standard Error types are preserved through serialization — v1.0

### Suspend/Resume

- [x] **SUSP-01**: Workflow can suspend execution and resume later with the same run — v1.0
- [x] **SUSP-02**: Suspend can include a data payload accessible when resuming — v1.0
- [x] **SUSP-03**: Resume accepts input data that is passed to the suspended step — v1.0
- [x] **SUSP-04**: A single workflow run can suspend and resume multiple times — v1.0
- [x] **SUSP-05**: When a nested workflow suspends, the parent workflow also suspends — v1.0 (partial: foreach index not supported)
- [x] **SUSP-06**: Suspend points can have labels for targeted resume operations — v1.0

### Control Flow

- [x] **CTRL-01**: Steps execute sequentially in defined order — v1.0 (pre-existing)
- [x] **CTRL-02**: Conditional branching (if/else) routes execution based on step results — v1.0 (pre-existing)
- [x] **CTRL-03**: Loop constructs repeat steps based on conditions — v1.0 (pre-existing)
- [x] **CTRL-04**: Parallel steps execute simultaneously and join before continuing — v1.0 (pre-existing)
- [x] **CTRL-05**: Foreach iterates over collections with configurable parallelism — v1.0 (pre-existing)

### Nested Workflows

- [x] **NEST-01**: A workflow step can invoke another workflow as a child — v1.0 (pre-existing)
- [x] **NEST-02**: Child workflow results are returned to the parent step — v1.0 (pre-existing)
- [x] **NEST-03**: Errors in child workflows propagate to the parent — v1.0 (pre-existing)
- [x] **NEST-04**: When a child workflow suspends, the parent workflow also suspends — v1.0
- [x] **NEST-05**: Child workflows inherit context from their parent — v1.0 (pre-existing)

### Advanced Features

- [x] **ADV-01**: Tracing spans are created for workflow and step execution — v1.0 (pre-existing)
- [x] **ADV-02**: Per-step execution mode allows running one step at a time — v1.0
- [ ] **ADV-03**: Workflow state can be replayed from any point (time travel) — DEFERRED (architectural incompatibility)
- [x] **ADV-04**: Results can be streamed as the workflow executes — v1.0
- [ ] **ADV-05**: TripWire abort signals propagate correctly through the workflow — DEFERRED (agent processor integration)

## v2 Requirements

Deferred to future release. Not in current roadmap.

### Performance Optimization

- **PERF-01**: Incremental state updates instead of full state snapshots
- **PERF-02**: State compression for large workflow state

### Extended Durability

- **DUR-01**: Workflow restart from scratch (currently unsupported in evented)
- **DUR-02**: Cross-process workflow migration

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                     | Reason                                              |
| --------------------------- | --------------------------------------------------- |
| Inngest runtime parity      | Default runtime is the reference, not union of both |
| New features beyond default | Parity only, no additions                           |
| Performance optimization    | Correctness first, optimize later                   |
| UI/Playground integration   | Infrastructure parity, not UI                       |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status   |
| ----------- | ----- | -------- |
| STATE-01    | 1     | Complete |
| STATE-02    | 1     | Complete |
| ERR-01      | 2     | Complete |
| ERR-02      | 2     | Complete |
| ERR-03      | 2     | Complete |
| CTRL-01     | 3     | Complete |
| CTRL-02     | 3     | Complete |
| CTRL-03     | 3     | Complete |
| CTRL-04     | 4     | Complete |
| CTRL-05     | 4     | Complete |
| SUSP-01     | 5     | Complete |
| SUSP-02     | 5     | Complete |
| SUSP-03     | 5     | Complete |
| SUSP-04     | 5     | Complete |
| SUSP-06     | 5     | Complete |
| NEST-01     | 6     | Complete |
| NEST-02     | 6     | Complete |
| NEST-03     | 6     | Complete |
| NEST-04     | 6     | Complete |
| NEST-05     | 6     | Complete |
| SUSP-05     | 6     | Complete |
| ADV-01      | 7     | Complete |
| ADV-02      | 7     | Complete |
| ADV-03      | 7     | Deferred |
| ADV-04      | 7     | Complete |
| ADV-05      | 7     | Deferred |

**Coverage:**

- v1 requirements: 26 total
- Completed: 23 (88.5%)
- Deferred: 2 (architectural limitations)
- Partial: 1 (SUSP-05 - foreach index)

---

## Milestone Summary

**Shipped:** 23 of 26 v1 requirements (88.5%)

**Adjusted:**
- SUSP-05: Partial implementation - nested workflow suspend works, but foreach index resume not supported

**Deferred:**
- ADV-03: Time travel replay incompatible with event-based architecture
- ADV-05: TripWire propagation from agent processors requires architectural changes

---

_Archived: 2026-01-27 as part of v1 milestone completion_
