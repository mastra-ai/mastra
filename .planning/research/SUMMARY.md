# Project Research Summary

**Project:** Mastra Evented Workflow Runtime v1.1 - Agent Integration Parity
**Domain:** Event-driven workflow runtime agent integration
**Researched:** 2026-01-27
**Confidence:** HIGH

## Executive Summary

The v1.1 milestone adds four agent integration features to the evented workflow runtime: V2 model support, TripWire propagation, Writer API exposure, and foreach index resume. All four features already exist in the default runtime, making this a parity effort rather than new capability development. The evented runtime's event-driven architecture introduces serialization challenges that the default runtime doesn't face—TripWire instances lose type identity across event boundaries, writer state doesn't naturally persist between async operations, and foreach resume metadata must be explicitly threaded through the event pipeline.

The recommended approach is to implement all four features as additive modifications to existing components. No architectural refactoring is required. The critical risk is TripWire serialization: when a TripWire crosses event boundaries (agent step → step executor → workflow processor), JSON serialization strips the prototype chain, causing `instanceof TripWire` checks to fail and the workflow to mishandle tripwires as generic errors. Mitigation requires serializing TripWire with explicit type markers and detecting tripwire status from the step result's status field rather than error type.

This milestone builds on v1.0's 83% test parity foundation. After completion, the evented runtime will support modern agent features (V2 models with structured output, processor-driven tripwires, custom event emission, and fine-grained foreach resume) that are essential for production agent workflows.

## Key Findings

### Recommended Stack

The v1.1 stack changes are minimal and targeted. The evented runtime already has all necessary infrastructure—pub/sub for event transport, step executor for step execution, workflow event processor for state orchestration. The changes involve wiring existing capabilities rather than adding new dependencies.

**Core technologies:**
- **V2 Model API**: Detect `specificationVersion` and call `.stream()` instead of `.streamLegacy()` — enables modern agent features like structured output
- **TripWire Class**: Serialize with `__type` marker and status field — preserves tripwire semantics across event boundaries
- **ToolStream**: Wrap pub/sub-backed outputWriter — enables streaming output from steps
- **Suspend Metadata**: Add `foreachIndex` to `__workflow_meta` — enables precise foreach iteration resume

**Implementation complexity:** All four features are LOW complexity. Each involves 15-50 lines of code, no new external dependencies, and follows established patterns from the default runtime.

### Expected Features

All four features are **table stakes** for agent integration parity. The default runtime supports them, and users expect consistent behavior across runtime modes.

**Must have (agent parity):**
- **V2 Model Support** — Users expect modern AI SDK models to work in evented runtime (currently blocked by `streamLegacy()` limitation)
- **TripWire Propagation** — Agent output processors need ability to abort with retry semantics (quality checks, rate limiting, content filtering)
- **Writer API** — Steps need to emit custom events during execution (progress updates, domain events, debugging data)
- **Foreach Index Resume** — Users need to resume specific foreach iterations (required for partial concurrency and selective retry)

**Current gaps:**
- 4 test skips explicitly document V2 model limitations (test lines 12831, 12935)
- 2 test skips document missing writer support (lines 1851, 1938)
- Multiple test skips document missing forEachIndex parameter (lines 19119-19492, requires `as any` cast)

**After v1.1:** All skipped tests should pass, evented runtime reaches 100% agent integration parity with default runtime.

### Architecture Approach

The evented runtime uses event-driven state machine architecture: WorkflowEventProcessor receives events via pub/sub, routes them to handlers (loop, parallel, conditional), which delegate to StepExecutor for individual step execution. All state is persisted in stepResults, making the processor stateless and distributed-execution-ready.

**Integration points for v1.1 features:**

1. **StepExecutor** — Add outputWriter parameter, construct ToolStream, detect TripWire in catch block, store foreachIndex in suspend metadata
2. **WorkflowEventProcessor** — Thread outputWriter through event data (ProcessorArgs), extract foreachIndex from resume labels, pass to StepExecutor
3. **EventedExecutionEngine** — Extract outputWriter from workflow params and pass to initial event, extract tripwire from step results and pass to lifecycle callbacks
4. **Agent Steps** — Detect model version internally and call appropriate streaming method (`.stream()` vs `.streamLegacy()`)

**Key pattern:** All features follow "thread through events" pattern—new capabilities are passed through ProcessorArgs, step executor params, and step context, rather than stored in class state. This maintains stateless processor design and supports distributed execution.

### Critical Pitfalls

Based on evented architecture constraints and v1.0 lessons:

1. **TripWire Type Identity Loss** — JSON serialization strips prototype chain, causing `instanceof TripWire` to fail after event boundary crossing. Mitigation: serialize with `__type: 'TripWire'` marker and `status: 'tripwire'` field, detect by status rather than instanceof.

2. **V2 Model Stream API Differs** — V2 models use different streaming API with different chunk types and completion semantics. Calling `streamLegacy()` on V2 models throws errors. Mitigation: branch on `specificationVersion === 'v1'` like default runtime (workflow.ts:381).

3. **Writer State Across Event Boundaries** — Writer must serialize writes to pub/sub, state doesn't persist between event cycles. Current code stubs `writer: undefined as any`. Mitigation: create ToolStream backed by pub/sub publish, forward writes as workflow events.

4. **Foreach Index Resume Plumbing Missing** — Default runtime supports `forEachIndex` parameter in resume(), evented runtime lacks type definition and plumbing. Tests use `as any` to bypass type error. Mitigation: add parameter to EventedRun.resume() signature, extract from resume event in processor, pass to StepExecutor.

5. **TripWire Metadata Serialization** — TripWire metadata is generic `<TMetadata>`, but JSON serialization only preserves plain objects. Class instances, functions, symbols are lost. Mitigation: document metadata must be JSON-serializable, validate structure on serialization.

## Implications for Roadmap

Based on research, the milestone naturally divides into three phases aligned with feature coupling and testing dependencies.

### Phase 1: V2 Model Support + TripWire Propagation
**Rationale:** These features are naturally coupled—both involve stream consumption loop modifications, and tripwire chunks only appear in V2 model streams (via output processor support). Testing V2 tripwire requires both features working together.

**Delivers:** Agent steps work with V2 models, structured output support, TripWire propagation from processors to workflow results

**Addresses:**
- V2 model API detection and conditional method calling
- TripWire chunk detection in stream loop
- TripWire serialization with type markers
- Structured output capture from V2 result.object

**Avoids:**
- TripWire type identity loss (Pitfall #1) via status field detection
- V2 stream API incompatibility (Pitfall #2) via version branching
- TripWire metadata serialization issues (Pitfall #5) via JSON-safe constraints

**Modified files:**
- `packages/core/src/workflows/evented/workflow.ts` (agent step creation)
- `packages/core/src/workflows/evented/step-executor.ts` (TripWire catch block)

**Tests:** Un-skip tests at lines 12831, 12935 (V2 models), add TripWire propagation tests

### Phase 2: Writer API
**Rationale:** Writer API is independent of other features and touches the most files (threads outputWriter through 4+ components). Implementing separately isolates integration risk.

**Delivers:** Steps can emit custom events via `context.writer.write()` and `context.writer.custom()`, streaming output during execution

**Uses:**
- ToolStream class (existing in codebase)
- OutputWriter type (existing)
- Pub/sub for event transport (existing)

**Implements:**
- Add `outputWriter` parameter to StepExecutor.execute()
- Thread outputWriter through ProcessorArgs and handler calls
- Construct ToolStream instance wrapping outputWriter
- Forward writer events to workflow pub/sub

**Avoids:**
- Writer undefined errors (Pitfall #3) via ToolStream construction
- Writer chunks out of order (Pitfall #6) via sequence numbers
- Events published before step-start (Pitfall #9) via lifecycle ordering

**Modified files:**
- `packages/core/src/workflows/evented/step-executor.ts` (ToolStream construction, 4 context sites)
- `packages/core/src/workflows/evented/workflow-event-processor/index.ts` (ProcessorArgs threading)
- `packages/core/src/workflows/evented/execution-engine.ts` (outputWriter extraction)
- `packages/core/src/workflows/evented/workflow-event-processor/loop.ts` (handler param)
- `packages/core/src/workflows/evented/workflow-event-processor/parallel.ts` (handler param)

**Tests:** Un-skip tests at lines 1851, 1938 (writer API)

### Phase 3: Foreach Index Resume
**Rationale:** Foreach index is the smallest feature (touches only 1 file), can be implemented last as polish. Enables fine-grained foreach control without blocking agent features.

**Delivers:** Users can resume specific foreach iterations via `resume({ forEachIndex: N })`, supports out-of-order resume and selective retry

**Addresses:**
- Add `forEachIndex` to EventedRun.resume() signature
- Extract foreachIndex from resume labels in WorkflowEventProcessor
- Pass foreachIndex to StepExecutor for item extraction
- Validate index range against foreachTotal

**Avoids:**
- Type errors from missing parameter (Pitfall #4) via signature update
- Index out of range errors (Pitfall #8) via bounds validation
- Resume of completed iteration (Pitfall #12) via status check

**Modified files:**
- `packages/core/src/workflows/evented/workflow-event-processor/index.ts` (resume event handling)

**Tests:** Un-skip tests at lines 19119-19492 (forEachIndex parameter)

### Phase Ordering Rationale

**Why Phase 1 first:** V2 models are foundational—modern AI SDKs default to V2, and structured output is a key differentiator. TripWire depends on stream parsing, so coupling with V2 stream implementation is natural. Tests for both features already exist (currently skipped), providing immediate validation.

**Why Phase 2 second:** Writer API is independent and touches the most files, so implementing after agent execution is stable reduces integration risk. Writer events are valuable for debugging and monitoring, making this high-value second priority.

**Why Phase 3 last:** Foreach index is polish—default runtime added it later, it's less commonly used than basic resume, and it only affects foreach loop resume edge cases. Safe to implement last.

**Alternative: parallel implementation:** All three phases could be implemented in parallel by different contributors, as they have minimal code overlap and no runtime dependencies.

### Research Flags

**Phases with standard patterns (skip research-phase):**
- **Phase 1:** V2 model and TripWire — Default runtime reference implementation is comprehensive (workflow.ts:381-482), evented just needs to match
- **Phase 2:** Writer API — ToolStream implementation is documented (tools/stream.ts), default runtime shows exact usage (handlers/step.ts:389-397)
- **Phase 3:** Foreach index — Default runtime has reference implementation (control-flow.ts:840-986), pattern is straightforward

**No phases need deeper research** — All features are parity implementations with clear reference code from default runtime. Codebase analysis provided 100% of needed information.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All required APIs exist in codebase, verified in default runtime |
| Features | HIGH | Features are table stakes, test gaps explicitly document them |
| Architecture | HIGH | Integration points mapped from codebase analysis, event threading pattern verified |
| Pitfalls | HIGH | Serialization constraints verified from v1.0 lessons, TripWire type issues confirmed in code |

**Overall confidence:** HIGH

Research based entirely on Mastra codebase analysis with clear reference implementations in default runtime. No external APIs or undocumented patterns. All four features have skipped tests that document the exact gaps, providing validation path.

### Gaps to Address

**None requiring pre-implementation research.** All implementation questions can be answered during development:

**During Phase 1:**
- V2 stream chunk structure differences → verify with mock V2 model tests
- TripWire serialization edge cases → test with nested metadata structures

**During Phase 2:**
- Writer event ordering guarantees → document EventEmitterPubSub behavior
- Writer performance with high-frequency writes → benchmark if needed

**During Phase 3:**
- Foreach concurrent suspend handling → verify with parallel iteration tests
- Resume label + forEachIndex interaction → test both parameters together

**Test-driven approach recommended:** Un-skip existing tests first to validate implementation matches expected behavior.

## Sources

### Primary (HIGH confidence)
- **Mastra codebase** — Default runtime reference implementations
  - `packages/core/src/workflows/workflow.ts:381-482` — V2 model branching, TripWire handling
  - `packages/core/src/workflows/handlers/step.ts:389-397` — Writer API usage
  - `packages/core/src/workflows/handlers/control-flow.ts:840-986` — Foreach index implementation
  - `packages/core/src/workflows/evented/` — Evented runtime current state (25,587 lines analyzed)
  - `packages/core/src/workflows/evented/evented-workflow.test.ts` — Skipped tests documenting gaps
  - `packages/core/src/agent/trip-wire.ts` — TripWire class definition
  - `packages/core/src/tools/stream.ts` — ToolStream implementation
  - `packages/core/src/workflows/types.ts` — StepTripwireInfo, OutputWriter types

### Secondary (MEDIUM confidence)
- **v1.0 milestone completion** — Serialization patterns from error handling
  - `.planning/research/PITFALLS.md` (v1.0) — Event-driven error handling lessons
  - `.planning/PROJECT.md` — v1.1 milestone context

### Tertiary (LOW confidence, contextual only)
- **Event-driven architecture patterns** — Background for serialization constraints
  - Event-driven workflow engine articles (Medium, Dev.to)
  - Temporal workflow patterns (idempotency, durable execution)

---
*Research completed: 2026-01-27*
*Ready for roadmap: yes*
