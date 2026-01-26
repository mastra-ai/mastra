# Architecture Patterns: Mastra Workflow Runtimes

**Domain:** AI Workflow Orchestration
**Researched:** 2025-01-26
**Confidence:** HIGH (based on direct codebase analysis)

## Overview

Mastra implements a dual-runtime workflow system with a shared architecture pattern:

1. **Default Runtime** - Synchronous, in-process execution (simpler, direct function calls)
2. **Evented Runtime** - Pub/Sub-based asynchronous execution (distributed, event-driven)

Both share the same **Workflow**, **Step**, and **ExecutionEngine** abstractions but differ in execution strategy.

## System Architecture Diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│                           User Application                                │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   createWorkflow({ ... })                createStep({ ... })              │
│         │                                       │                        │
│         ▼                                       ▼                        │
│   ┌─────────────┐                        ┌──────────────┐                │
│   │  Workflow   │◄───── contains ───────│    Step      │                │
│   │  (Config)   │                        │ (Definition) │                │
│   └──────┬──────┘                        └──────────────┘                │
│          │                                                               │
│          │ commit()                                                      │
│          ▼                                                               │
│   ┌─────────────────┐                                                    │
│   │ ExecutionGraph  │  ── StepFlowEntry[] (step, parallel, loop, etc.)  │
│   └────────┬────────┘                                                    │
│            │                                                             │
│            │ createRun() -> run.start()                                  │
│            ▼                                                             │
│   ┌──────────────────────────────────────────────────────────────────┐  │
│   │                        Run Instance                               │  │
│   │  ┌────────────────────────────────────────────────────────────┐  │  │
│   │  │                   ExecutionEngine                           │  │  │
│   │  │  ┌─────────────────────┐    ┌───────────────────────────┐  │  │  │
│   │  │  │  DefaultExecEngine  │    │   EventedExecEngine       │  │  │  │
│   │  │  │  (synchronous)      │    │   (pub/sub based)         │  │  │  │
│   │  │  └─────────────────────┘    └───────────────────────────┘  │  │  │
│   │  └────────────────────────────────────────────────────────────┘  │  │
│   └──────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## Component Boundaries

| Component                  | Responsibility                                                                             | File Location                                         |
| -------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------- |
| **Workflow**               | Configuration, step composition (`.then()`, `.branch()`, `.parallel()`), schema validation | `workflows/workflow.ts`                               |
| **Step**                   | Individual unit of work, input/output schemas, execute function                            | `workflows/step.ts`                                   |
| **ExecutionEngine**        | Abstract base for execution strategies                                                     | `workflows/execution-engine.ts`                       |
| **DefaultExecutionEngine** | Synchronous execution with handlers                                                        | `workflows/default.ts`                                |
| **EventedExecutionEngine** | Pub/Sub-based execution                                                                    | `workflows/evented/execution-engine.ts`               |
| **WorkflowEventProcessor** | Event routing and state machine for evented runtime                                        | `workflows/evented/workflow-event-processor/index.ts` |
| **StepExecutor**           | Step execution logic for evented runtime                                                   | `workflows/evented/step-executor.ts`                  |
| **PubSub**                 | Abstract event bus interface                                                               | `events/pubsub.ts`                                    |
| **Storage**                | Workflow state persistence                                                                 | `storage/` (pluggable backends)                       |

## Core Data Structures

### StepFlowEntry (Execution Graph Nodes)

```typescript
type StepFlowEntry =
  | { type: 'step'; step: Step }
  | { type: 'sleep'; id: string; duration?: number; fn?: ExecuteFunction }
  | { type: 'sleepUntil'; id: string; date?: Date; fn?: ExecuteFunction }
  | { type: 'parallel'; steps: { type: 'step'; step: Step }[] }
  | { type: 'conditional'; steps: Step[]; conditions: ConditionFunction[] }
  | { type: 'loop'; step: Step; condition: LoopConditionFunction; loopType: 'dowhile' | 'dountil' }
  | { type: 'foreach'; step: Step; opts: { concurrency: number } };
```

### ExecutionContext (Runtime State)

```typescript
type ExecutionContext = {
  workflowId: string;
  runId: string;
  executionPath: number[]; // Position in execution graph [0], [0, 2], etc.
  activeStepsPath: Record<string, number[]>; // Currently running steps
  suspendedPaths: Record<string, number[]>; // Steps awaiting resume
  resumeLabels: Record<string, { stepId: string; foreachIndex?: number }>;
  state: Record<string, any>; // Workflow-level mutable state
  retryConfig: { attempts: number; delay: number };
  format?: 'legacy' | 'vnext';
  tracingIds?: { traceId: string; workflowSpanId: string };
};
```

### StepResult (Step Execution Outcome)

```typescript
type StepResult<P, R, S, T> =
  | { status: 'success'; output: T; payload: P; ... }
  | { status: 'failed'; error: Error; payload: P; tripwire?: TripwireInfo; ... }
  | { status: 'suspended'; payload: P; suspendPayload?: S; ... }
  | { status: 'running'; payload: P; ... }
  | { status: 'waiting'; payload: P; ... }
  | { status: 'paused'; payload: P; ... };
```

## Data Flow

### Default Runtime Flow (Synchronous)

```
run.start(input)
    │
    ▼
DefaultExecutionEngine.execute()
    │
    ├──▶ For each StepFlowEntry in graph:
    │       │
    │       ▼
    │    executeEntry() ─── dispatches to:
    │       ├── executeStep()      ← regular step
    │       ├── executeParallel()  ← parallel block
    │       ├── executeConditional()
    │       ├── executeLoop()
    │       ├── executeForeach()
    │       └── executeSleep()/executeSleepUntil()
    │       │
    │       ▼
    │    Step.execute(ExecuteFunctionParams)
    │       │
    │       ▼
    │    StepResult
    │       │
    │       ▼
    │    persistStepUpdate() → Storage
    │
    ▼
WorkflowResult (success/failed/suspended)
```

### Evented Runtime Flow (Pub/Sub)

```
run.start(input)
    │
    ▼
EventedExecutionEngine.execute()
    │
    ├──▶ Publish: 'workflow.start' event
    │
    ▼
Subscribe: 'workflows-finish' (waits for completion)
    │
    │    [Background Event Processing]
    │    ┌────────────────────────────────────────────┐
    │    │  WorkflowEventProcessor.process(event)     │
    │    │                                            │
    │    │  event.type determines handler:            │
    │    │    'workflow.start'    → processWorkflowStart()
    │    │    'workflow.step.run' → processWorkflowStepRun()
    │    │    'workflow.step.end' → processWorkflowStepEnd()
    │    │    'workflow.end'      → processWorkflowEnd()
    │    │    'workflow.suspend'  → processWorkflowSuspend()
    │    │    'workflow.fail'     → processWorkflowFail()
    │    │    'workflow.cancel'   → processWorkflowCancel()
    │    │    'workflow.resume'   → processWorkflowStart() (reused)
    │    │                                            │
    │    │  StepExecutor.execute() → Step logic       │
    │    │  Storage persistence after each event      │
    │    │                                            │
    │    │  Publish: next event (step.run/end/etc.)   │
    │    └────────────────────────────────────────────┘
    │
    ▼
Receive: 'workflow.end'/'workflow.fail'/'workflow.suspend'
    │
    ▼
WorkflowResult
```

## Event Types in Evented Runtime

| Event Type                   | Purpose                                | Published By                         |
| ---------------------------- | -------------------------------------- | ------------------------------------ |
| `workflow.start`             | Initiate workflow execution            | `run.start()`, nested workflow start |
| `workflow.resume`            | Resume from suspended state            | `run.resume()`                       |
| `workflow.step.run`          | Execute a specific step                | Event processor (sequencing)         |
| `workflow.step.end`          | Step completed, determine next         | Event processor                      |
| `workflow.end`               | Workflow completed successfully        | Event processor                      |
| `workflow.fail`              | Workflow failed                        | Event processor                      |
| `workflow.suspend`           | Workflow suspended (human-in-the-loop) | Event processor                      |
| `workflow.cancel`            | Abort workflow execution               | `run.cancel()`                       |
| `workflow.events.v2.{runId}` | Watch channel for real-time updates    | Step handlers                        |

## State Management

### Where State Lives

1. **In-Memory (Run Instance)**
   - `stepResults: Record<string, StepResult>` - accumulated step outputs
   - `executionContext` - current execution position and mutable context

2. **Persistent Storage (WorkflowRunState)**
   - `context` - serialized stepResults
   - `status` - workflow status
   - `suspendedPaths` - resume points for suspended workflows
   - `resumeLabels` - named resume points
   - `activePaths` - currently executing paths

3. **PubSub Events (Evented Runtime)**
   - Events carry full state snapshot for stateless processing
   - Each event includes: workflowId, runId, executionPath, stepResults, prevResult

### State Transitions

```
pending → running → success
                  → failed
                  → suspended → (resume) → running
                  → canceled
                  → paused → (continue) → running
```

## Extension Points

### 1. Custom Execution Engine

Extend `ExecutionEngine` to create platform-specific runtimes:

```typescript
class CustomExecutionEngine extends DefaultExecutionEngine {
  // Override for platform-specific durability
  async wrapDurableOperation<T>(operationId: string, fn: () => Promise<T>): Promise<T> {
    // e.g., Inngest step.run(), Temporal activity, etc.
  }

  // Override for platform-specific sleep
  async executeSleepDuration(duration: number, sleepId: string): Promise<void> {
    // e.g., Inngest step.sleep(), Temporal sleep, etc.
  }

  // Override for nested workflow invocation
  async executeWorkflowStep(params: ExecuteWorkflowParams): Promise<StepResult | null> {
    // e.g., Inngest step.invoke(), Temporal child workflow
  }
}
```

**Key hooks in DefaultExecutionEngine:**

- `wrapDurableOperation()` - wrap operations for replay/durability
- `executeSleepDuration()` / `executeSleepUntilDate()` - platform timers
- `evaluateCondition()` - condition evaluation with durability
- `onStepExecutionStart()` - step lifecycle hooks
- `executeWorkflowStep()` - nested workflow handling
- `isNestedWorkflowStep()` - detect nested workflows
- `createStepSpan()` / `endStepSpan()` / `errorStepSpan()` - tracing hooks
- `executeStepWithRetry()` - retry logic customization

### 2. Custom PubSub Backend

Implement `PubSub` interface for different event systems:

```typescript
class CustomPubSub extends PubSub {
  async publish(topic: string, event: Event): Promise<void> {
    /* Redis, Kafka, SQS, etc. */
  }
  async subscribe(topic: string, cb: EventCallback): Promise<void> {
    /* ... */
  }
  async unsubscribe(topic: string, cb: EventCallback): Promise<void> {
    /* ... */
  }
  async flush(): Promise<void> {
    /* ... */
  }
}
```

### 3. Custom Storage Backend

Implement storage interface for workflow state persistence:

```typescript
const customWorkflowStore = {
  persistWorkflowSnapshot(params: PersistParams): Promise<void>,
  loadWorkflowSnapshot(params: LoadParams): Promise<WorkflowRunState | null>,
  updateWorkflowState(params: UpdateParams): Promise<void>,
  updateWorkflowResults(params: UpdateResultsParams): Promise<Record<string, StepResult>>,
  getWorkflowRunById(params: GetParams): Promise<WorkflowState | null>,
  getWorkflowRuns(params: ListParams): Promise<WorkflowState[]>,
};
```

### 4. Custom Step Types

Create steps from various sources:

- **Plain params**: `createStep({ id, inputSchema, outputSchema, execute })`
- **Agent**: `createStep(agent)` - wraps Agent for workflow use
- **Tool**: `createStep(tool)` - wraps Tool for workflow use
- **Processor**: `createStep(processor)` - wraps message processor

## Parity Considerations (Default vs Evented)

### Features with Parity

- Basic step execution (`.then()`)
- Control flow (`.branch()`, `.parallel()`)
- Loops (`.dowhile()`, `.dountil()`, `.foreach()`)
- Sleep/delay (`.sleep()`, `.sleepUntil()`)
- Suspend/resume (human-in-the-loop)
- Nested workflows
- State management (`setState()`)
- Schema validation

### Features Needing Verification for Parity

| Feature          | Default                   | Evented                              | Notes                                    |
| ---------------- | ------------------------- | ------------------------------------ | ---------------------------------------- |
| Tracing spans    | Full support              | Partial (TODO markers)               | Evented has `// TODO` for tracingContext |
| Output streaming | Full support via `writer` | Partial (`// TODO` for stream)       | Evented needs streaming support          |
| State in steps   | Full support              | Partial (`// TODO: implement state`) | Evented state TODO comments              |
| Retry with delay | Built-in loop             | Per-step via pubsub                  | Different mechanisms                     |
| Abort/cancel     | AbortController + events  | AbortController + events             | Both support, verify parity              |
| Time travel      | Full support              | Full support                         | Debug feature parity                     |
| Watch events     | Full support              | Full support                         | Real-time updates                        |

### Code Evidence of Gaps (Evented Runtime)

From `evented/step-executor.ts`:

```typescript
// TODO: implement state
state: {},
setState: async (_state: any) => {
  // TODO
},
// TODO
tracingContext: {},
```

From `evented/workflow.ts`:

```typescript
// TODO: support stream
// TODO: should use regular .stream()
```

## Patterns to Follow

### Pattern 1: Handler Delegation

**What:** Execution logic extracted to handler functions
**When:** Complex execution flow (parallel, conditional, loop)
**Example:**

```typescript
// In default.ts
async executeParallel(params: ExecuteParallelParams) {
  return executeParallelHandler(this, params);  // Delegates to handlers/control-flow.ts
}
```

### Pattern 2: Mutable Context Pattern

**What:** Separate mutable state from immutable execution context
**When:** State that can change during step execution
**Example:**

```typescript
type MutableContext = {
  state: Record<string, any>;
  suspendedPaths: Record<string, number[]>;
  resumeLabels: Record<string, { stepId: string; foreachIndex?: number }>;
};

// After step execution
engine.applyMutableContext(executionContext, result.mutableContext);
```

### Pattern 3: Event-Driven State Machine

**What:** Workflow state transitions via events
**When:** Evented runtime execution
**Example:**

```typescript
// Event types map to state transitions
'workflow.start' → status: 'running'
'workflow.step.end' + last_step → status: 'success'
'workflow.step.end' + suspended → status: 'suspended'
'workflow.fail' → status: 'failed'
```

### Pattern 4: Durable Operation Wrapping

**What:** Wrap side-effects for platform-specific durability
**When:** Creating execution engines for durable platforms
**Example:**

```typescript
// Default: direct execution
await engine.wrapDurableOperation(operationId, async () => {
  await doSomething();
});

// Inngest override: step.run() for memoization
async wrapDurableOperation<T>(opId: string, fn: () => Promise<T>): Promise<T> {
  return this.inngestStep.run(opId, fn);
}
```

## Anti-Patterns to Avoid

### Anti-Pattern 1: Direct State Mutation

**What:** Modifying executionContext directly in step code
**Why bad:** Breaks durability and replay for evented/platform engines
**Instead:** Use `contextMutations` object returned from step execution

### Anti-Pattern 2: Skipping Persistence Hooks

**What:** Not calling `persistStepUpdate()` after state changes
**Why bad:** State lost on restart, breaks resume functionality
**Instead:** Always persist after significant state transitions

### Anti-Pattern 3: Tight Coupling to Execution Strategy

**What:** Step code that assumes synchronous or async execution
**Why bad:** Breaks portability between Default and Evented runtimes
**Instead:** Steps should be pure functions of their inputs

## Sources

- Direct codebase analysis of `packages/core/src/workflows/`
- File locations verified against actual repository structure
- Code patterns extracted from implementation
