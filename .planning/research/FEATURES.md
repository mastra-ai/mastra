# Feature Landscape: Workflow Runtime Parity

**Domain:** Workflow execution runtimes (default vs evented)
**Researched:** Jan 26, 2026
**Overall Confidence:** HIGH (based on Mastra codebase analysis)

## Table Stakes (Core Features)

Features any workflow runtime MUST have. Missing = non-functional runtime.

| Feature                       | Why Expected            | Complexity | Default Runtime | Evented Runtime | Notes                              |
| ----------------------------- | ----------------------- | ---------- | --------------- | --------------- | ---------------------------------- |
| **Sequential Step Execution** | Basic workflow chaining | Low        | Yes             | Yes             | `.then(step)` pattern              |
| **Input/Output Schemas**      | Type safety, validation | Low        | Yes             | Yes             | Zod schema validation              |
| **Step Context**              | Access to runtime data  | Low        | Yes             | Yes             | `runId`, `workflowId`, state, etc. |
| **Error Handling**            | Graceful failure        | Low        | Yes             | Yes             | Status: 'failed' with error        |
| **Run State Persistence**     | Resume after crash      | Medium     | Yes             | Yes             | Via storage layer                  |
| **Step Results Access**       | Previous step outputs   | Low        | Yes             | Yes             | `getStepResult()`                  |
| **Initial Data Passthrough**  | Workflow input access   | Low        | Yes             | Yes             | `getInitData()`                    |

## Advanced Core Features

Features that make a runtime production-ready. Expected by power users.

| Feature                     | Why Expected                  | Complexity | Default Runtime | Evented Runtime | Notes                            |
| --------------------------- | ----------------------------- | ---------- | --------------- | --------------- | -------------------------------- |
| **Suspend/Resume**          | Human-in-loop, external waits | High       | Yes             | Yes             | `suspend()` call, `resume()` API |
| **Parallel Execution**      | Multiple concurrent branches  | Medium     | Yes             | Partial         | `.parallel([steps])`             |
| **Conditional Branching**   | Dynamic path selection        | Medium     | Yes             | Yes             | `.branch()` with conditions      |
| **Loops (doWhile/doUntil)** | Iterative processing          | Medium     | Yes             | Yes             | `.dowhile()`, `.dountil()`       |
| **forEach**                 | Array item processing         | Medium     | Yes             | Yes             | Concurrent batch processing      |
| **Retries**                 | Transient failure recovery    | Medium     | Yes             | Partial         | Per-step and workflow-level      |
| **Sleep/SleepUntil**        | Timed delays                  | Low        | Yes             | Yes             | Fixed or dynamic duration        |
| **Abort/Cancel**            | Graceful termination          | Medium     | Yes             | Partial         | AbortController propagation      |
| **Streaming Output**        | Real-time step progress       | Medium     | Yes             | Yes             | Watch events                     |

## Differentiators

Features that distinguish Mastra's workflow system. Not universally expected.

| Feature                   | Value Proposition       | Complexity | Default Runtime | Evented Runtime | Notes                        |
| ------------------------- | ----------------------- | ---------- | --------------- | --------------- | ---------------------------- |
| **Nested Workflows**      | Workflow composition    | High       | Yes             | Partial         | Workflows as steps           |
| **Time Travel**           | Debug/replay execution  | High       | Yes             | Unknown         | Re-run from any step         |
| **Per-Step Execution**    | Debugging, step-through | Medium     | Yes             | Partial         | `perStep: true` mode         |
| **Bail Early**            | Skip remaining steps    | Low        | Yes             | Yes             | `bail()` in step             |
| **Tripwire (abort)**      | Agent guardrails        | Medium     | Yes             | Unknown         | Processor integration        |
| **Resume Labels**         | Named suspend points    | Medium     | Yes             | Unknown         | Multiple suspend points      |
| **Data Mapping**          | Transform between steps | Medium     | Yes             | Yes             | `.map()` with variable refs  |
| **State Management**      | Cross-step state        | Medium     | Yes             | Partial         | `setState()`, `state` access |
| **Lifecycle Callbacks**   | Post-execution hooks    | Low        | Yes             | Yes             | `onFinish`, `onError`        |
| **Tracing/Observability** | Spans, telemetry        | Medium     | Yes             | Partial         | OpenTelemetry integration    |

## Anti-Features

Features to explicitly NOT build or avoid in workflow runtimes.

| Anti-Feature                   | Why Avoid                      | What to Do Instead                         |
| ------------------------------ | ------------------------------ | ------------------------------------------ |
| **Implicit State Mutation**    | Hard to debug, race conditions | Explicit `setState()` with clear semantics |
| **Global Step Registry**       | Coupling, hard to test         | Steps defined per-workflow                 |
| **Synchronous-Only Execution** | Blocks event loop              | All operations async                       |
| **Unbounded Loops**            | Runaway execution              | Require explicit loop conditions           |
| **Silent Failures**            | Lost errors                    | Always propagate or log                    |

## Feature Dependencies

```
Suspend/Resume ─────────────┬───> Nested Workflows (suspend bubbles up)
                            │
Parallel Execution ─────────┼───> forEach (uses parallel internally)
                            │
Step Execution ─────────────┴───> Conditional Branching
                                  └──> Loops (depend on step execution)

State Management ────────────────> Resume Labels (uses state tracking)

Abort/Cancel ────────────────────> Nested Workflows (propagates to children)
                                   └──> Parallel (all branches)

Time Travel ─────────────────────> Requires: Persistence, Step Results
```

## Feature Categories by Runtime Role

### Event-Driven Model Advantages

The evented runtime's architecture provides inherent benefits:

- **Durability**: Events persisted independently
- **Scalability**: Stateless processors, distributed execution
- **Visibility**: Event stream for debugging
- **Resilience**: Easy replay from any event

### Default Model Advantages

The default runtime's in-process model provides:

- **Simplicity**: Direct function calls
- **Performance**: No serialization overhead
- **Debugging**: Standard stack traces
- **Type Safety**: Full TypeScript inference

## Priority for Parity

Based on test coverage and usage patterns, priority order for evented runtime:

### P0 - Critical (Tests likely failing)

1. Suspend/Resume flow
2. Parallel execution completeness
3. Nested workflow execution
4. Retries with proper counting

### P1 - Important (Feature gaps)

1. Time Travel support
2. Per-step execution mode
3. Tripwire/abort propagation
4. State management sync

### P2 - Nice to Have

1. Resume labels
2. Full tracing integration
3. Lifecycle callback timing

## Sources

- Primary: Mastra codebase analysis
  - `packages/core/src/workflows/types.ts` - Type definitions
  - `packages/core/src/workflows/execution-engine.ts` - Engine interface
  - `packages/core/src/workflows/default.ts` - Default implementation
  - `packages/core/src/workflows/evented/` - Evented implementation
  - `packages/core/src/workflows/handlers/control-flow.ts` - Control flow
  - `packages/core/src/workflows/workflow.test.ts` - Test coverage
  - `packages/core/src/workflows/evented/evented-workflow.test.ts` - Evented tests
