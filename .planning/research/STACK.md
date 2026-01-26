# Technology Stack: Event-Driven Workflow Runtime Patterns

**Project:** Mastra Evented Workflow Runtime Parity
**Researched:** 2026-01-26
**Overall Confidence:** HIGH (based on official documentation + codebase analysis)

## Executive Summary

The evented runtime in Mastra implements an event-driven workflow orchestration pattern similar to Inngest and AWS Step Functions, while the default runtime follows a synchronous in-memory execution model closer to direct function invocation. To achieve parity, the evented runtime must support the same workflow primitives (suspend/resume, branching, loops, parallel execution) while maintaining its event-driven architecture.

## Core Patterns for Event-Driven Workflow Runtimes

### 1. Event Sourcing for Workflow State

**Pattern:** Store workflow state as a sequence of events rather than current state snapshots.

**Why it matters for parity:**

- The default runtime keeps state in memory during execution (stepResults, executionContext)
- The evented runtime must reconstruct state from events on each step execution
- Enables distributed execution across multiple workers/processes
- Supports time-travel debugging and workflow replay

**How Mastra implements this:**

- `WorkflowEventProcessor` handles events like `workflow.start`, `workflow.step.run`, `workflow.step.end`
- State is persisted via `workflowsStore.persistWorkflowSnapshot()` and `updateWorkflowResults()`
- Events carry `stepResults`, `executionPath`, and `prevResult` for state reconstruction

**Parity concern:** The evented runtime stores state in `stepResults` passed through events, but must ensure state mutations (e.g., `setState`) are properly persisted and propagated.

### 2. Durable Execution / Memoization

**Pattern:** Steps that have completed successfully should not re-execute on replay. Results are memoized and injected when the workflow resumes.

**Why it matters for parity:**

- Temporal and Inngest both implement this pattern
- Inngest: "The step's code is not executed, instead the SDK injects the result into the return value"
- Temporal: "If the app crashes, another Worker automatically takes over by replaying this history"

**How Mastra implements this:**

- Default runtime: `stepResults` dictionary tracks completed steps
- Evented runtime: `stepResults` passed through pub/sub events, loaded from storage on resume
- `WorkflowEventProcessor.loadData()` retrieves persisted state

**Parity concern:** The evented runtime must handle the same resume/time-travel scenarios as default, reconstructing stepResults from storage before continuing execution.

### 3. Execution Graph Traversal

**Pattern:** Workflows are represented as directed graphs. The runtime traverses the graph, executing steps based on dependencies.

**Why it matters for parity:**

- Both runtimes use `ExecutionGraph` with `StepFlowEntry[]` for graph representation
- Supports sequential `.then()`, parallel `.parallel()`, conditional `.branch()`
- Graph structure enables control flow (loops, foreach, conditionals)

**How Mastra implements this:**

- `workflow.stepGraph` defines the execution flow
- `executionPath` tracks position in the graph (e.g., `[0]`, `[1, 2]` for parallel)
- Handlers exist for each type: `executeStep`, `executeParallel`, `executeConditional`, `executeLoop`, `executeForeach`

**Parity concern:** The evented runtime's `WorkflowEventProcessor` must handle all graph traversal patterns that `DefaultExecutionEngine` supports.

### 4. Suspend/Resume (Human-in-the-Loop)

**Pattern:** Workflows can suspend execution and wait for external input before resuming.

**Why it matters for parity:**

- Critical for AI workflows requiring human approval, user input, or external events
- Inngest: Supports `step.waitForEvent()` for external triggers
- Temporal: Uses signals and queries for external interaction

**How Mastra implements this:**

- Steps call `suspend(payload)` to pause execution
- State stored with `suspendedPaths` tracking which steps are suspended
- Resume publishes `workflow.resume` event with `resumePayload`
- `validateStepResumeData()` validates resume data against schema

**Parity concern:** The evented runtime has suspend/resume working but must match all edge cases from default runtime tests (nested workflows, parallel suspends, etc.).

### 5. Pub/Sub Event Distribution

**Pattern:** Use message queues/pub-sub for decoupling workflow orchestrator from step executors.

**Why it matters for parity:**

- Enables distributed execution across processes/containers
- Provides at-least-once delivery guarantees
- Supports horizontal scaling of workers

**How Mastra implements this:**

- Abstract `PubSub` class with `publish()`, `subscribe()`, `unsubscribe()`
- Topics: `workflows` (main events), `workflows-finish` (completion), `workflow.events.v2.{runId}` (streaming)
- Events: `workflow.start`, `workflow.step.run`, `workflow.step.end`, `workflow.fail`, `workflow.suspend`, `workflow.cancel`

**Parity concern:** Event ordering and acknowledgment must be reliable. The evented runtime uses `ack?.()` callbacks for message acknowledgment.

### 6. Cancellation and Abort Handling

**Pattern:** Workflows must support graceful cancellation, propagating abort to nested workflows.

**Why it matters for parity:**

- Users need to stop long-running workflows
- Resources should be cleaned up properly
- Nested workflows must cascade cancellation

**How Mastra implements this:**

- `AbortController` per workflow run
- `cancelRunAndChildren()` traverses parent-child relationships
- `parentChildRelationships` Map tracks nested workflow hierarchy
- `workflow.cancel` event triggers cancellation

**Parity concern:** Default runtime handles abort via `abortController.signal`. Evented runtime must properly propagate cancellation through nested workflows.

## Patterns Comparison: Default vs Evented Runtime

| Capability            | Default Runtime       | Evented Runtime        | Parity Status      |
| --------------------- | --------------------- | ---------------------- | ------------------ |
| Sequential Steps      | In-memory loop        | Event per step         | Implemented        |
| Parallel Execution    | Promise.all           | Multiple events        | Implemented        |
| Conditional Branching | Inline evaluation     | Event + condition eval | Implemented        |
| Loops (while)         | While loop            | Event recursion        | Implemented        |
| ForEach               | Array iteration       | Event per item         | Implemented        |
| Suspend/Resume        | In-memory suspend     | Event + storage        | Needs verification |
| Nested Workflows      | Direct invocation     | Child workflow events  | Implemented        |
| Time Travel           | stepResults injection | Event + storage load   | Needs verification |
| Cancellation          | AbortController       | Abort + cancel event   | Implemented        |
| State Management      | In-memory context     | Storage persistence    | Needs verification |
| Streaming             | Direct pubsub         | Event relay            | Implemented        |
| Error Handling        | Try/catch + retries   | Event + retry count    | Implemented        |
| Lifecycle Callbacks   | Direct invocation     | Post-event invocation  | Implemented        |

## Critical Implementation Patterns

### Step Executor Pattern

The evented runtime uses a dedicated `StepExecutor` class that mirrors the default runtime's step execution but operates in an event-driven context:

```typescript
// From evented/step-executor.ts
async execute({
  step, runId, stepResults, state, emitter,
  requestContext, input, resumeData, retryCount,
  validateInputs, abortController, perStep
}) {
  // Execute step with retry handling
  // Emit events for streaming
  // Return step result
}
```

### Event Flow Pattern

The workflow progresses through a series of events:

```
workflow.start
  -> workflow.step.run (step 0)
  -> workflow.step.end (step 0)
  -> workflow.step.run (step 1)
  -> ...
  -> workflow.end
```

For parallel execution:

```
workflow.step.run (parallel entry)
  -> workflow.step.run (branch 0)
  -> workflow.step.run (branch 1)
  -> workflow.step.end (branch 0)
  -> workflow.step.end (branch 1)
  -> workflow.step.end (parallel exit - all branches complete)
```

### State Reconstruction Pattern

On each event, state is reconstructed from:

1. Event payload (`stepResults`, `prevResult`, `executionPath`)
2. Storage snapshot (for resume/time-travel)
3. Request context (for cross-step context)

```typescript
// From workflow-event-processor/index.ts
const snapshot = await workflowsStore?.loadWorkflowSnapshot({
  workflowName: workflowId,
  runId,
});
```

## Technology Dependencies

### Required for Evented Runtime

| Technology      | Version    | Purpose            | Why                                   |
| --------------- | ---------- | ------------------ | ------------------------------------- |
| PubSub Adapter  | Any        | Event distribution | Core messaging backbone               |
| Storage Adapter | Any        | State persistence  | Workflow snapshots, step results      |
| Node.js         | >= 22.13.0 | Runtime            | Async/await, modern APIs              |
| TypeScript      | ~5.5       | Type safety        | Generic workflow types                |
| Zod             | ^3.x       | Schema validation  | Input/output/resume schema validation |

### Optional Enhancements

| Technology | Purpose           | When to Use               |
| ---------- | ----------------- | ------------------------- |
| Redis      | Pub/sub + storage | High-throughput scenarios |
| PostgreSQL | Durable storage   | Production persistence    |
| BullMQ     | Job queue         | Rate limiting, scheduling |

## Anti-Patterns to Avoid

### 1. Synchronous Event Processing

**Anti-pattern:** Processing all events in a single synchronous chain.
**Why bad:** Blocks other workflow executions, no parallelism.
**Instead:** Each event triggers independent processing, state persisted between.

### 2. In-Memory State Only

**Anti-pattern:** Keeping all workflow state in memory without persistence.
**Why bad:** State lost on process restart, no distributed execution.
**Instead:** Persist after each step, reconstruct on resume.

### 3. Direct Step Invocation

**Anti-pattern:** Calling step functions directly without event intermediary.
**Why bad:** Loses event sourcing benefits, no replay capability.
**Instead:** Always publish events, let processor handle step execution.

### 4. Ignoring Abort Signals

**Anti-pattern:** Not checking AbortController signal in long-running steps.
**Why bad:** Cancellation doesn't work, resources wasted.
**Instead:** Check `abortSignal.aborted` and call `abort()` helper.

## Sources

- **HIGH confidence:** Mastra codebase analysis
  - `packages/core/src/workflows/execution-engine.ts`
  - `packages/core/src/workflows/default.ts`
  - `packages/core/src/workflows/evented/execution-engine.ts`
  - `packages/core/src/workflows/evented/workflow-event-processor/index.ts`

- **HIGH confidence:** Official documentation
  - Temporal: https://temporal.io/how-it-works
  - Inngest: https://www.inngest.com/docs/learn/how-functions-are-executed
  - AWS Step Functions: https://docs.aws.amazon.com/step-functions/latest/dg/concepts-standard-vs-express.html

## Implications for Parity Work

1. **Test Suite Approach:** Run default runtime test suite against evented runtime by swapping `createWorkflow` import
2. **State Verification:** Ensure `stepResults` structure matches between runtimes
3. **Event Coverage:** Every control flow path in default must have corresponding event handling in evented
4. **Resume Paths:** All suspend/resume scenarios must work identically
5. **Error Shapes:** Error objects must serialize/deserialize consistently
