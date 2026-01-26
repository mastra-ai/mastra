# Research Summary: Evented Workflow Runtime Parity

**Project:** Mastra Evented Workflow Runtime Parity
**Synthesized:** 2026-01-26
**Overall Confidence:** HIGH

## Executive Summary

The evented runtime in Mastra implements an event-driven workflow orchestration pattern (similar to Inngest and AWS Step Functions) while the default runtime uses synchronous in-memory execution. Both runtimes share the same Workflow, Step, and ExecutionEngine abstractions, but the evented runtime must reconstruct state from events on each step execution rather than maintaining it in memory. Current parity stands at approximately 53% test coverage (124 evented tests vs 232 default tests), with known TODOs in state management, streaming, and tracing.

The primary technical challenge is bridging the gap between synchronous execution semantics (where state persists in closures and Maps) and event-driven execution (where state must be explicitly serialized into event payloads and storage). Critical areas requiring attention include error serialization/hydration across event boundaries, state isolation between event handlers, and suspend/resume path consistency. The evented step-executor has approximately 17 TODOs that must be addressed for full parity.

The recommended approach is to work through the test coverage gap systematically, starting with core execution features (state management, error handling) before addressing advanced features (streaming, tracing). Each feature should be verified to work identically in both runtimes before moving to the next. The shared ExecutionEngine interface provides a clean extension point for runtime-specific behavior.

## Key Findings

### From STACK.md

| Technology                | Rationale                                                                    |
| ------------------------- | ---------------------------------------------------------------------------- |
| Event Sourcing            | Store workflow state as events, reconstruct on each step execution           |
| Durable Execution         | Completed steps skip re-execution on replay (memoization pattern)            |
| Execution Graph Traversal | DAG with `StepFlowEntry[]` for sequential, parallel, conditional, loop flows |
| PubSub Architecture       | Decouple orchestrator from executors for distributed execution               |

**Critical version requirements:** Node.js >= 22.13.0, TypeScript ~5.5, Zod ^3.x

### From FEATURES.md

**Table Stakes (Must Have):**

- Sequential step execution (`.then()`)
- Input/output schema validation (Zod)
- Step context access (runId, workflowId, state)
- Error handling with proper status propagation
- Run state persistence for crash recovery
- Step results access (`getStepResult()`)

**Differentiators (Should Have):**

- Suspend/resume for human-in-the-loop workflows
- Parallel execution (`.parallel()`)
- Conditional branching (`.branch()`)
- Loops (`.dowhile()`, `.dountil()`, `.foreach()`)
- Nested workflows (workflows as steps)
- Time travel debugging

**Defer to v2+:**

- Resume labels (named suspend points)
- Full tracing integration (TODOs exist)
- Advanced streaming features

### From ARCHITECTURE.md

**Major Components:**

| Component              | Responsibility                                  |
| ---------------------- | ----------------------------------------------- |
| Workflow               | Configuration, step composition via fluent API  |
| Step                   | Unit of work with input/output schemas          |
| ExecutionEngine        | Abstract base for execution strategies          |
| WorkflowEventProcessor | Event routing state machine for evented runtime |
| StepExecutor           | Step execution logic for evented runtime        |
| PubSub                 | Abstract event bus interface                    |
| Storage                | Workflow state persistence                      |

**Key Patterns:**

1. **Handler Delegation** - Complex execution extracted to handler functions
2. **Mutable Context Pattern** - Separate mutable state from immutable execution context
3. **Event-Driven State Machine** - Workflow transitions via typed events
4. **Durable Operation Wrapping** - Wrap side-effects for platform durability

### From PITFALLS.md

**Top 5 Critical Pitfalls:**

| Pitfall                        | Impact                                              | Prevention                                                 |
| ------------------------------ | --------------------------------------------------- | ---------------------------------------------------------- |
| Error Serialization Boundary   | Errors lose type identity crossing event boundaries | Use `hydrateSerializedStepErrors()` on all receive paths   |
| State Isolation Across Events  | Closures/Maps don't persist between event handlers  | All mutable state must serialize to stepResults or storage |
| Suspend/Resume Path Divergence | Resume requires full context reconstruction         | Validate resume path matches suspended step                |
| Event Ordering/Race Conditions | Out-of-order events cause incomplete results        | Use stepResults as source of truth, implement idempotency  |
| At-Least-Once Semantics        | Duplicate step execution from event redelivery      | Check step status before executing                         |

## Implications for Roadmap

### Suggested Phase Structure

**Phase 1: State Management Foundation** (Critical Path)

- **Rationale:** State isolation is the root cause of most parity issues. Fix this first.
- **Delivers:** Reliable state serialization/deserialization across events
- **Features:** `setState()`, `getStepResult()`, state persistence in storage
- **Pitfalls to avoid:** #2 (State Isolation), #5 (At-Least-Once)
- **Research needed:** LOW - patterns well documented

**Phase 2: Error Handling Parity**

- **Rationale:** Error behavior must match before testing other features
- **Delivers:** Consistent error types, cause chains, and failure propagation
- **Features:** Error hydration, `MastraError` preservation, tripwire handling
- **Pitfalls to avoid:** #1 (Error Serialization Boundary)
- **Research needed:** LOW - `hydrateSerializedStepErrors()` already exists

**Phase 3: Suspend/Resume Completeness**

- **Rationale:** Human-in-the-loop is a key differentiator requiring full parity
- **Delivers:** Multi-suspend, nested workflow suspend, resume validation
- **Features:** Suspend/resume, `resumePayload`, nested workflow suspend
- **Pitfalls to avoid:** #3 (Path Divergence)
- **Research needed:** MEDIUM - nested scenarios may have edge cases

**Phase 4: Parallel and Control Flow**

- **Rationale:** Control flow primitives depend on solid state/error handling
- **Delivers:** All branching and looping constructs working identically
- **Features:** `.parallel()`, `.branch()`, `.dowhile()`, `.foreach()`
- **Pitfalls to avoid:** #4 (Event Ordering)
- **Research needed:** LOW - well-defined semantics

**Phase 5: Nested Workflows**

- **Rationale:** Complex composition patterns, requires prior phases stable
- **Delivers:** Workflows as steps with proper parent-child relationships
- **Features:** Nested workflow execution, cancellation propagation, result aggregation
- **Pitfalls to avoid:** #8 (Nested State Propagation)
- **Research needed:** MEDIUM - deep nesting may have edge cases

**Phase 6: Advanced Features**

- **Rationale:** Nice-to-haves after core parity achieved
- **Delivers:** Full feature parity including debugging tools
- **Features:** Time travel, streaming output, tracing context
- **Pitfalls to avoid:** #6 (Tracing), #7 (Streaming)
- **Research needed:** HIGH for streaming - multiple TODOs

### Research Flags

| Phase                  | Needs `/gsd-research-phase`? | Reason                                    |
| ---------------------- | ---------------------------- | ----------------------------------------- |
| Phase 1 (State)        | NO                           | Patterns clear from codebase              |
| Phase 2 (Errors)       | NO                           | Utility functions already exist           |
| Phase 3 (Suspend)      | MAYBE                        | Nested suspend scenarios need exploration |
| Phase 4 (Control Flow) | NO                           | Handler implementations exist             |
| Phase 5 (Nested)       | MAYBE                        | Parent-child edge cases                   |
| Phase 6 (Advanced)     | YES                          | Streaming has significant TODOs           |

## Confidence Assessment

| Area         | Confidence | Notes                                                              |
| ------------ | ---------- | ------------------------------------------------------------------ |
| Stack        | HIGH       | Based on direct codebase analysis + official Temporal/Inngest docs |
| Features     | HIGH       | Feature matrix derived from actual implementation code             |
| Architecture | HIGH       | Component boundaries and data flows verified in source             |
| Pitfalls     | HIGH       | TODOs counted, test coverage measured, patterns documented         |

### Gaps Requiring Attention

1. **Test Coverage Gap:** 124 evented tests vs 232 default tests - need to identify specific missing test scenarios
2. **TODO Audit:** 17 TODOs in evented directory need prioritization
3. **Streaming Implementation:** Multiple "// TODO: support stream" comments without clear implementation path
4. **Performance Characteristics:** No benchmarks comparing evented vs default runtime overhead

## Sources

**Primary (HIGH confidence):**

- Mastra codebase: `packages/core/src/workflows/`
- Test files: `workflow.test.ts`, `evented-workflow.test.ts`
- Existing concerns: `.planning/codebase/CONCERNS.md`

**External (HIGH confidence):**

- Temporal: https://temporal.io/how-it-works
- Inngest: https://www.inngest.com/docs/learn/how-functions-are-executed
- AWS Step Functions: https://docs.aws.amazon.com/step-functions/latest/dg/concepts-standard-vs-express.html

---

_Research synthesis: 2026-01-26_
