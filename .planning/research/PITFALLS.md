# Pitfalls: Workflow Runtime Parity

**Domain:** Event-driven workflow runtime parity with synchronous default runtime
**Researched:** 2026-01-26
**Confidence:** HIGH (based on codebase analysis and domain knowledge)

## Critical Pitfalls

Mistakes that cause test failures, rewrites, or fundamental incompatibility.

### Pitfall 1: Error Serialization Boundary

**What goes wrong:** Errors lose their type identity when crossing event boundaries. The default runtime preserves `Error` instances with `instanceof` checks working. The evented runtime serializes errors to JSON, losing prototype chain, custom properties, and `cause` chains.

**Why it happens:** Events are serialized for pub/sub transport. `JSON.stringify(error)` produces `{}` by default. Even with `error.toJSON()`, re-hydration creates plain objects, not `Error` instances.

**Warning signs:**

- Tests checking `error instanceof MastraError` fail
- Error `cause` chains are undefined after event transport
- Custom error properties (like `domain`, `category`) become unreliable
- Tests comparing error objects fail with "expected Error, got Object"

**Prevention:**

- Use `hydrateSerializedStepErrors()` (already exists at `packages/core/src/workflows/utils.ts:377`) consistently on all event receive paths
- Test error serialization round-trips explicitly
- Prefer checking `error.name === 'MastraError'` over `instanceof` in tests
- Add integration tests that verify error properties survive pub/sub transport

**Relevance to evented:** Already documented in test file (line 3533: "In evented workflows, errors are serialized through events and become objects"). Must ensure hydration happens in ALL code paths, not just the main flow.

---

### Pitfall 2: State Isolation Across Event Boundaries

**What goes wrong:** Mutable state (closures, `Map`, shared objects) works in the default runtime because execution is synchronous in one process. In evented, each step may execute in a different event handler invocation, losing closure state.

**Why it happens:** Event-driven execution is fundamentally stateless between events. The `retryCounts` Map in `DefaultExecutionEngine` (line 57) works because the engine instance persists. In evented, if the processor restarts, that Map is empty.

**Warning signs:**

- Retry counts reset unexpectedly
- `setState()` changes don't persist between steps
- Tests using closure state across steps fail intermittently
- Step results from parallel execution are missing or stale

**Prevention:**

- ALL mutable state must be serialized into `stepResults` or persisted storage
- Replace in-memory Maps with storage-backed state
- Test with multiple event processor instances (simulating distributed execution)
- The evented step-executor has TODOs at lines 104, 356, 430 - these MUST be implemented before parity

**Relevance to evented:** The evented workflow explicitly passes `state: {}` (empty object) in many places. This is a placeholder. Real state implementation requires explicit serialization into the event payload.

---

### Pitfall 3: Suspend/Resume Path Divergence

**What goes wrong:** Suspend points in the default runtime return control immediately and resume in the same execution context. In evented, suspend publishes an event and terminates; resume comes from a completely new event, requiring full context reconstruction.

**Why it happens:** Default runtime can use JavaScript's async/await to "pause" at suspend. Evented runtime must exit completely and re-enter via `workflow.resume` event.

**Warning signs:**

- Resume receives `undefined` for `suspendData`
- Workflow meta (`__workflow_meta`) is missing or malformed
- Resume path doesn't match original suspend path
- Tests with nested suspends fail with "step not found"

**Prevention:**

- Ensure `suspendPayload.__workflow_meta.path` is always populated (step-executor line 121)
- Validate resume path matches a suspended step before processing
- Test suspend/resume cycles with: single suspend, multiple suspends, nested workflow suspends
- The `restart()` feature is explicitly not supported (test at line 2198) - document and test this constraint

**Relevance to evented:** Test file explicitly tests "should throw error when restart is called on evented workflow" - this is intentional. But regular suspend/resume MUST work identically to default runtime.

---

### Pitfall 4: Event Ordering and Race Conditions

**What goes wrong:** Default runtime executes steps sequentially by design. Evented runtime may process events out of order if pub/sub doesn't guarantee ordering, causing steps to see incomplete predecessor results.

**Why it happens:** Pub/sub systems vary in ordering guarantees. `EventEmitterPubSub` is synchronous and ordered, but production pub/sub (Redis, Google Cloud Pub/Sub) may deliver events out of order under load.

**Warning signs:**

- Parallel step results are incomplete
- `getStepResult()` returns undefined for completed steps
- Tests pass locally but fail in CI or with external pub/sub
- Workflow shows "success" but step results are missing

**Prevention:**

- Use `stepResults` record as source of truth, not execution order assumptions
- Implement idempotency checks - processing same event twice should be safe
- For conditional/parallel branches, wait for ALL branch events before proceeding
- Test with artificial delays injected between event publish and subscribe

**Relevance to evented:** The `WorkflowEventProcessor` tracks `activeSteps` (line 25) to coordinate parallel execution. This tracking must be accurate or branches will complete prematurely.

---

### Pitfall 5: Exactly-Once vs At-Least-Once Semantics

**What goes wrong:** Default runtime executes each step exactly once. Evented runtime may re-deliver events (pub/sub retry, network partition), causing duplicate step execution.

**Why it happens:** Distributed systems can't guarantee exactly-once without coordination. Pub/sub typically guarantees at-least-once delivery.

**Warning signs:**

- Step execute function called multiple times for same step
- Side effects happen twice (emails sent twice, records created twice)
- Step results contain duplicate entries
- Tests checking call counts fail (`expect(execute).toHaveBeenCalledTimes(1)`)

**Prevention:**

- Make step execution idempotent (check if already completed before executing)
- Use `stepResults[stepId].status` to skip already-completed steps
- For steps with external side effects, implement deduplication keys
- Test with explicit event re-delivery simulation

**Relevance to evented:** The event processor should check `stepResults` before executing. If a step already has a `success` or `failed` status, skip re-execution.

---

## Moderate Pitfalls

Mistakes that cause delays or technical debt but don't fundamentally break parity.

### Pitfall 6: Tracing Context Loss

**What goes wrong:** Tracing spans from the default runtime don't propagate across event boundaries, breaking distributed tracing.

**Warning signs:**

- Observability dashboards show disconnected spans
- Parent-child span relationships are missing
- Workflow runs can't be traced end-to-end

**Prevention:**

- Serialize tracing context into event payload (currently TODO at workflow.ts line 420)
- Reconstruct tracing context on event receive
- This is a "parity" feature - must work but may be lower priority than core execution

---

### Pitfall 7: Streaming Output Incomplete

**What goes wrong:** Default runtime supports `stream()` for real-time step output. Evented runtime has multiple TODOs for streaming support.

**Warning signs:**

- `workflow.createRun().stream()` returns empty stream or throws
- Step streaming events not published
- LLM streaming through evented steps doesn't work

**Prevention:**

- Streaming requires coordinated event publishing (step-stream-chunk, step-stream-end)
- TODOs at workflow.ts lines 333, 344, 1315 must be addressed
- Test streaming with LLM-based steps explicitly

---

### Pitfall 8: Nested Workflow State Propagation

**What goes wrong:** Nested workflows in evented runtime have complex parent-child relationships that must be tracked for proper completion.

**Warning signs:**

- Parent workflow completes before child
- Child workflow results don't propagate to parent
- `parentWorkflow` context is lost during suspend/resume

**Prevention:**

- The `parentChildRelationships` Map (processor line 60) must be accurate
- Clean up relationships on workflow completion (line 101-110)
- Test deeply nested workflows (3+ levels)

---

### Pitfall 9: Test Suite Assumptions

**What goes wrong:** Default runtime tests may make assumptions that don't hold for evented:

- Synchronous execution order
- Single-process state
- Immediate availability of results

**Warning signs:**

- Tests pass for default, fail for evented with timing issues
- Tests use `setTimeout` or `setImmediate` that don't translate to events
- Mock implementations don't account for async event flow

**Prevention:**

- When adapting tests for evented, add explicit `await` for event processing
- Use event-based completion detection, not timing
- The evented test file has 124 tests vs 232 for default - identify coverage gaps

---

## Minor Pitfalls

Mistakes that cause annoyance but are fixable without architecture changes.

### Pitfall 10: Bail and Suspend in Condition Contexts

**What goes wrong:** `bail()` and `suspend()` inside condition evaluation functions (like loop conditions) throw "Not implemented".

**Warning signs:**

- Tests with conditional bail fail with "Not implemented" error
- Loop conditions that need to suspend crash

**Prevention:**

- Complete implementations at step-executor.ts lines 298, 366, 369, 440, 443
- These are likely edge cases but must work for full parity

---

### Pitfall 11: Writer/Output Writer Not Implemented

**What goes wrong:** Step execution context has `writer: undefined as any` in multiple places.

**Warning signs:**

- Steps trying to use `writer` get undefined errors
- Output streaming via writer fails

**Prevention:**

- Implement OutputWriter support or explicitly document as unsupported
- TODOs at step-executor lines 127, 301, 375, 449

---

## Phase-Specific Warnings

| Phase Topic          | Likely Pitfall           | Mitigation                           |
| -------------------- | ------------------------ | ------------------------------------ |
| Basic step execution | Error serialization (#1) | Verify hydration on all paths        |
| State management     | State isolation (#2)     | Implement state serialization early  |
| Suspend/resume       | Path divergence (#3)     | Test multi-suspend scenarios         |
| Parallel execution   | Event ordering (#4)      | Use stepResults as source of truth   |
| Retry behavior       | At-least-once (#5)       | Implement idempotency checks         |
| Nested workflows     | State propagation (#8)   | Test deep nesting explicitly         |
| Streaming            | Incomplete support (#7)  | Address TODOs before claiming parity |

## Detection Checklist

Before claiming parity, verify:

- [ ] All 232 default runtime tests have evented equivalents (currently 124)
- [ ] Error `cause` chains survive round-trip
- [ ] State persists across simulated process restart
- [ ] Suspend/resume works with nested workflows
- [ ] Parallel branches complete correctly with artificial delays
- [ ] No "Not implemented" errors in any test path
- [ ] Streaming produces equivalent output to default runtime

## Sources

- Codebase analysis: `packages/core/src/workflows/evented/`
- Test file comparisons: `workflow.test.ts` (232 tests) vs `evented-workflow.test.ts` (124 tests)
- Existing concerns: `.planning/codebase/CONCERNS.md`
- TODO/FIXME grep: 17 matches in evented directory
- Domain knowledge: Event-driven architecture patterns (HIGH confidence from training)

---

_Pitfalls research: 2026-01-26_
