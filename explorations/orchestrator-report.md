# Mastra Orchestrator: Architecture Analysis

> **Status: historical exploration (May 2026).** This document was the design
> exploration that preceded the standalone-worker / push-capable-PubSub work
> on the `mastra-orchestrator` branch. It is preserved here as a record of the
> reasoning. The shipped implementation diverged from this plan in several
> places — see [Implementation Status](#implementation-status-may-2026) below
> before treating any later section as current truth.

---

## Implementation Status (May 2026)

What actually shipped on `mastra-orchestrator` vs. what this report proposed.

### Shipped

- **`MastraWorker` base class + concrete workers** (`packages/core/src/worker/`)
  - `OrchestrationWorker` — wraps `WorkflowEventProcessor`, subscribes to the
    `workflows` topic via `PullTransport`.
  - `SchedulerWorker` — wraps `WorkflowScheduler`.
  - `BackgroundTaskWorker` — reuses Mastra's `BackgroundTaskManager`; wires
    static tool executors so a remote worker can resolve tool implementations
    by name.
- **`MASTRA_WORKERS` env filter + `Mastra.startWorkers(name?)`** — workers are
  always constructed but only started when the filter (env or arg) admits them.
  `MASTRA_WORKERS=false` disables all event processing.
- **Step-execution strategies** (`packages/core/src/worker/strategies/`)
  - `InProcessStrategy` — used inside the server process.
  - `HttpRemoteStrategy` — used by standalone orchestrator workers when
    `MASTRA_STEP_EXECUTION_URL` is set; auth via `MASTRA_WORKER_AUTH_TOKEN`
    forwarded through the framework's existing auth provider.
- **Server step-execution endpoint** —
  `POST /api/workflows/:workflowId/runs/:runId/steps/execute` in
  `packages/server/src/server/handlers/workflows.ts`. Uses a per-`Mastra`
  cached `InProcessStrategy`.
- **Push-capable PubSub** (replaces "Hook mode" — see Diverged below)
  - `PubSub.supportedModes: ('pull' | 'push')[]` (default `['pull']`).
  - `Mastra.handleWorkflowEvent(event)` public entrypoint.
  - `POST /api/workflows/events` route in
    `packages/server/src/server/handlers/workflows.ts` for brokers that push
    over HTTP.
  - For push-only PubSub, `Mastra` skips auto-creating `OrchestrationWorker`
    and instead subscribes `handleWorkflowEvent` directly.
- **Redis Streams PubSub** (`pubsub/redis-streams/`)
  - Pull-only. Late-join consumer groups anchor at `'0'`. `XAUTOCLAIM`-based
    reclaim loop. Configurable `maxDeliveryAttempts` (with `0`/`Infinity`
    semantics). `MAXLEN ~` trim on publish. Per-topic unsubscribe.
- **Cross-process integration tests** (`pubsub/redis-streams/src/*.test.ts`)
  driven through the real CLI deployment shape: the test fixture is a
  `cli-project/src/mastra/index.ts` that mirrors what users write, plus two
  generic entry files (`app.server.entry.ts`, `app.worker.entry.ts`) that
  mirror `BuildBundler` / `WorkerBundler` output. There are no per-role
  hand-written entry files.
- **CLI** — `mastra worker` command, `WorkerBundler`, with role selection via
  `--name` / `MASTRA_WORKERS`.
- **Background-task cross-process execution** —
  `BackgroundTaskManager.staticExecutors` registry resolves tool
  implementations by name on a worker that did not produce the task. The
  internal `__background-task` workflow's `executeStep` falls back to
  `manager.getStaticExecutor(task.toolName)` when the per-task closure is
  unavailable.

### Diverged from the report

- **No `WorkerSubsystem` abstraction.** The report proposed one `MastraWorker`
  containing pluggable subsystems (Orchestration, Scheduler, BackgroundTask).
  The shipped design instead has **three concrete `MastraWorker` subclasses**.
  Each is independently deployable; composition happens in the `Mastra`
  constructor and via `MASTRA_WORKERS`. The "subsystem" layer was dropped as
  unnecessary indirection.
- **No "Hook mode" / `PushTransport` / `StateManager` / `JoinTracker`.** The
  report's serverless story was a stateless HTTP webhook that loaded full run
  state per invocation. That was abandoned in favor of letting push-capable
  brokers (in-process emitter, GCP Pub/Sub push) deliver events to a normal
  HTTP route that calls `Mastra.handleWorkflowEvent`. The orchestrator state
  machine continues to live inside the process that handles the event;
  serverless deployments simply scale that process.
- **No `@mastra/orchestrator` package.** Worker abstractions live in
  `@mastra/core/worker`. Standalone deployment is a CLI mode of the user's
  existing Mastra app, not a separate package.
- **Worker-to-server auth uses the framework's existing auth provider** rather
  than a dedicated worker-secret machinery. An earlier iteration shipped a
  `MASTRA_WORKER_SECRET` pathway; it was removed because it duplicated the
  existing `experimental_auth` flow.

### Still future / not shipped here

- **Phase 5 — durable timers.** `setTimeout`-based sleeps in evented workflows
  are unchanged.
- **Cloud-specific PubSub adapters** (GCP Pub/Sub package, SNS/EventBridge,
  SQS). The push-capable interface is in place, but no new broker package
  ships in this branch beyond Redis Streams.
- **`mastra worker temporal`** as a unified abstraction. `@mastra/temporal`
  remains a thin library; the user owns the Temporal worker process. The
  symmetry between `OrchestrationWorker` and a hypothetical `TemporalWorker`
  was judged aesthetic rather than real (Temporal owns its own scheduling and
  durability).
- **Operational features** listed in the original "What This Does NOT Cover"
  section (multi-tenancy, versioning, blue/green, autoscaling, DLQs, etc.).

---

## What Are We Trying to Do?

Decouple **workflow orchestration** (deciding what step runs next) from **step execution** (actually running the step). Today both happen in-process inside the Mastra Server. The diagram moves orchestration into a separate, independently scalable component — the **Orchestrator** — that coordinates via PubSub and delegates step execution back to the Server via HTTP.

---

## How It Works Today

```text
Client → Mastra Server → WorkflowEventProcessor (in-process) → StepExecutor (in-process)
                              ↕
                     PubSub (EventEmitter or GCP)
```

The `WorkflowEventProcessor` (~3000 lines) is a state machine that lives inside the server process. It subscribes to the `workflows` pubsub topic and processes a loop of events:

```text
workflow.start → workflow.step.run → workflow.step.end → workflow.step.run → ... → workflow.end
```

Each event handler does three things:
1. **Reads state** from storage (workflow snapshot, step results)
2. **Makes a decision** (what step to run next, whether to loop, branch, suspend, etc.)
3. **Executes the step** via `StepExecutor.execute()` in the same process, then publishes the next event

The Orchestrator proposal splits #3 out: the Orchestrator keeps the decision-making, but delegates execution over HTTP.

---

## Proposed Architecture

```text
                                                         ┌─────────────────┐
  ┌───────────┐                                          │  Orchestrator   │
  │ Scheduler │──── triggers ────┐                  ┌───▶│   (Worker)      │───┐
  └───────────┘                  ▼                  │    │  pull sub       │   │
                          ┌─────────────┐     ┌─────┴──┐ └─────────────────┘   │
  ┌──────────────┐        │             │     │        │                       │
  │ Client SDK   │──start─▶ Mastra      │─pub─▶ PubSub │                       │
  │ Agent.stream │◀─handle│ Server      │◀────│Adapter │ ┌─────────────────┐   │
  └──────────────┘        │             │     │        │ │  Orchestrator   │   │
                          └──────▲──────┘     └───┬────┘ │   (Hook)        │   │
                                 │                └─────▶│  push sub       │───┤
                                 │                       └─────────────────┘   │
                                 │                                             │
                                 └──────── HTTP: run individual step ──────────┘
```

---

## How the Orchestrator Differs from the WorkflowEventProcessor

This is the core question. They share the same brain — graph traversal, branching, looping, suspend detection — but differ in where and how step code actually runs.

### What stays in the Orchestrator (from the WEP)

The Orchestrator keeps all the **decision-making logic** that currently lives in the WorkflowEventProcessor:

| WEP Handler | What the Orchestrator Keeps |
|---|---|
| `processWorkflowStart` | Initialize run state, determine first step, persist initial snapshot |
| `processWorkflowStepEnd` | Determine next step from graph (increment execution path, detect branches, loops, forEach completion, parallel join), decide if workflow is done |
| `processWorkflowSuspend` | Detect suspension, propagate to parent if nested, persist suspended state |
| `processWorkflowResume` | Restore snapshot, determine which step to resume, rebuild execution context |
| `processWorkflowFail` | Error handling, propagation to parent workflows, cleanup |
| `processWorkflowCancel` | Recursive cancellation of child workflows, cleanup |

The Orchestrator also keeps:
- **Parent-child tracking** for nested workflows (in-memory map of `childRunId → parentRunId`)
- **Execution path arithmetic** (`[0] → [1]`, `[0,0] → [0,1]`, etc.)
- **forEach/parallel/conditional join logic** (waiting for all branches before advancing)
- **Abort controller management** (per-run cancellation signals)

### What moves to the Mastra Server

The Orchestrator removes one handler entirely — `processWorkflowStepRun` — and replaces it with an HTTP call. Today `processWorkflowStepRun` does:

1. Look up the step definition from the workflow's `stepGraph`
2. Validate inputs against the step's `inputSchema`
3. Call `StepExecutor.execute()` which runs the actual step function
4. Capture step output, state mutations, watch events
5. Handle suspend/bail/error within the step
6. Publish `workflow.step.end` with the result

In the new model, the Mastra Server exposes this as an HTTP endpoint. The Server has direct access to:
- **Step functions** (JS code that can't be serialized)
- **Tool definitions** and tool execution runtime
- **LLM connections** (for agent steps)
- **Watch event publishing** (output writers for streaming)

### The key difference, concretely

**Today (WEP in-process):**
```text
WEP receives workflow.step.run event
  → calls stepExecutor.execute(step, context) directly
  → gets StepResult back synchronously
  → publishes workflow.step.end
```

**Proposed (Orchestrator + Server):**
```text
Orchestrator receives workflow.step.run event (from its own decision logic)
  → sends HTTP POST to Server with step identity + context
  → Server looks up step definition, runs StepExecutor.execute()
  → Server returns StepResult as HTTP response
  → Orchestrator receives result
  → Orchestrator publishes workflow.step.end (or next decision)
```

### What this actually buys us

The WEP today is tightly coupled: the process that decides "run step X next" is the same process that runs step X. This means:

1. **A step that crashes takes down the orchestration loop.** If step X throws an unhandled error or OOMs, the WEP dies too — no recovery without external restart.
2. **Steps compete with orchestration for resources.** An LLM call that takes 30 seconds blocks the event loop, delaying other workflows sharing the same WEP.
3. **Scaling is all-or-nothing.** You can't scale step execution independently from decision-making.
4. **Sleep steps use `setTimeout`.** If the server restarts, sleeping workflows are lost. A separate Orchestrator with durable PubSub can survive restarts.

---

## End-to-End Event Flow

### Happy Path: Start → Execute Steps → Complete

```text
1. Client calls eventedWorkflow.start() on Mastra Server
2. Server publishes { type: 'workflow.start', runId, data: { inputData } } to PubSub
3. Server returns stream handle (runId) to client immediately
4. Client subscribes to workflow.events.v2.{runId} topic for watch events

--- Orchestrator picks up ---

5. Orchestrator receives workflow.start event (pull or push)
6. Orchestrator: processWorkflowStart()
   - Persists initial snapshot to storage
   - Determines first step (executionPath: [0])
   - Sends HTTP POST to Server: "run step 0 of workflow X, run Y"
7. Server receives HTTP request
   - Looks up workflow definition + step function
   - Calls StepExecutor.execute()
   - Step runs, publishes watch events to workflow.events.v2.{runId}
   - Returns StepResult as HTTP response
8. Orchestrator receives StepResult
9. Orchestrator: processWorkflowStepEnd()
   - Persists step result to storage
   - Determines next step (executionPath: [1])
   - Sends HTTP POST to Server: "run step 1"
10. Repeat steps 7-9 until no more steps
11. Orchestrator: workflow complete
    - Publishes { type: 'workflow.end' } to workflows-finish topic
    - Publishes workflow-finish watch event to workflow.events.v2.{runId}
12. Client stream receives finish event, closes
```

### Suspend and Resume

```text
1-6. Same as happy path (start, first steps execute)

7. Server runs step that calls suspend(payload)
   - StepExecutor captures suspension
   - Returns StepResult { status: 'suspended', suspendPayload }
8. Orchestrator receives suspended StepResult
9. Orchestrator: processWorkflowSuspend()
   - Persists snapshot with suspendedPaths: { stepId: executionPath }
   - Stores resume labels if provided
   - Publishes workflow.suspend to workflows-finish
   - If nested: publishes workflow.step.end to parent with suspension context

--- Time passes, external system provides data ---

10. Client calls resume(resumeData, step) on Mastra Server
11. Server loads snapshot, validates status is 'suspended'
12. Server validates resumeData against step's resumeSchema
13. Server publishes { type: 'workflow.resume', data: { resumeSteps, resumeData } }
14. Orchestrator receives workflow.resume
15. Orchestrator: processWorkflowStart() (resume uses same handler)
    - Restores snapshot state
    - Sends HTTP POST to Server: "run suspended step with resumeData"
16. Server runs step with ctx.resumeData available
17. Continue from step 8 of happy path
```

### Nested Workflows

```text
1-6. Parent workflow starts, steps execute

7. Orchestrator encounters a step that IS a nested workflow
   - Does NOT send HTTP to Server
   - Instead publishes { type: 'workflow.start', parentWorkflow: {...} } to PubSub
   - Records parentChildRelationship: nestedRunId → parentRunId
8. Orchestrator receives the nested workflow.start (same event loop)
   - Processes nested workflow exactly like a top-level workflow
   - Nested steps execute via HTTP to Server
9. When nested workflow completes:
   - Orchestrator publishes workflow.step.end back to PARENT runId
   - Parent workflow continues from the nested step
```

### Streaming Across Machines

```text
                    Client                Server              PubSub            Orchestrator
                      │                     │                   │                    │
                      │──start workflow────▶│                   │                    │
                      │◀──stream handle─────│                   │                    │
                      │                     │──publish start───▶│                    │
                      │                     │                   │──deliver event────▶│
                      │                     │                   │                    │
                      │                     │                   │    (decides next   │
                      │                     │                   │     step)          │
                      │                     │                   │                    │
                      │                     │◀──HTTP: run step──┼────────────────────│
                      │                     │                   │                    │
                      │                     │ (executes step,   │                    │
                      │                     │  publishes watch  │                    │
                      │                     │  events)          │                    │
                      │                     │──watch events────▶│                    │
                      │◀──watch events──────┼───────────────────│                    │
                      │                     │                   │                    │
                      │                     │──HTTP response───▶│                    │
                      │                     │  (step result)    │───────────────────▶│
                      │                     │                   │                    │
```

Watch events (step progress, tool calls, text deltas) are published to `workflow.events.v2.{runId}` during step execution on the Server. Because PubSub is external (GCP), the client's subscription receives them regardless of which machine ran the step.

The Server's `CachingPubSub` + `createReplayStream()` handles late-joining observers — a client that reconnects replays cached events from its last known position.

---

## Component Deep Dives

### Scheduler

**What exists today:** Nothing built-in. The only scheduling is:
- `sleep()` / `sleepUntil()` steps that use `setTimeout` (lost on restart)
- Inngest's cron support (external dependency)

**What the diagram proposes:** A standalone component that:
- Checks for scheduled actions on an interval
- Sends workflow run triggers to the Mastra Server via HTTP
- The Server then publishes `workflow.start` to PubSub as normal

**Implementation options:**
1. Simple cron job that `POST /workflows/:id/start-async` on schedule
2. Storage-backed scheduler that queries a `scheduled_runs` table
3. Leverage existing cloud schedulers (Cloud Scheduler → PubSub, EventBridge → Lambda)

**Key consideration:** Sleep steps. Today `setTimeout` is used in-process. With a separate Orchestrator, sleeps should be handled differently:
- Option A: Orchestrator uses durable timers (write sleep expiry to storage, poll for expired sleeps)
- Option B: PubSub delayed delivery (GCP supports scheduled publish)
- Option C: Scheduler polls for sleeping workflows and re-triggers them when time expires

### PubsubAdapter

**What exists today:**
- `EventEmitterPubSub` — in-memory, single process, no persistence
- `CachingPubSub` — decorator that adds replay via `MastraServerCache`
- `GoogleCloudPubSub` — production-grade, supports ordering + exactly-once + consumer groups
- `InngestPubSub` — bridges Inngest realtime system

**What the Orchestrator needs:**
- Pull subscriptions (Worker model) — GCP supports this natively
- Push subscriptions (Hook model) — GCP supports this natively
- Consumer groups — so multiple Orchestrator workers share the load
- Message ordering by `runId` — so a single workflow's events are processed in order
- Ack/nack — so failed event processing gets retried

**EventEmitterPubSub won't work** for the distributed model (in-memory only). The Orchestrator requires an external broker. GCP Pub/Sub is the obvious choice given the existing adapter.

### Mastra Server — New Step Execution Endpoint

The Server needs a new endpoint that the Orchestrator calls:

```text
POST /workflows/:workflowId/runs/:runId/steps/execute
```

**What the Server does on this endpoint:**
1. Looks up the workflow definition from the Mastra registry
2. Resolves the step from the `stepGraph` using the provided `executionPath`
3. Creates a `StepExecutor` with the workflow's pubsub, storage, etc.
4. Calls `stepExecutor.execute()` with the step, input, state, and resumeData
5. Step function runs — may call tools, LLMs, or suspend
6. Watch events are published to `workflow.events.v2.{runId}` during execution
7. Returns `StepResult` as HTTP response

**What the Server does NOT do:**
- Decide what step to run next
- Persist workflow snapshot (Orchestrator does this)
- Publish workflow lifecycle events (start, end, fail)

**Challenges:**
- The `StepExecutor` today receives in-memory references to the workflow and pubsub. These exist on the Server naturally, so this part is fine.
- `requestContext` needs to be serialized in the HTTP request and deserialized on the Server side.
- The step function gets a `suspend()` callback — this still works because `StepExecutor` captures suspension internally and returns it as part of `StepResult`.

### Orchestrator (Worker vs Hook)

Both modes run the same logic — the extracted `WorkflowEventProcessor` minus `processWorkflowStepRun`.

**Worker (Pull):**
- Long-running process with an event loop
- Calls `pubsub.subscribe('workflows', handler, { group: 'orchestrators' })`
- Multiple workers share the load via consumer group
- Each worker processes events for different `runId`s
- Maintains in-memory maps (AbortControllers, parent-child relationships) per run
- Best for: steady-state production workloads

**Hook (Push):**
- Stateless HTTP endpoint that receives pushed events
- PubSub calls `POST /orchestrator/webhook` with event payload
- Handler processes the event, makes HTTP call to Server, publishes next event
- No in-memory state between invocations — must load everything from storage
- Best for: serverless deployments, bursty/low-volume workloads

**Worker vs Hook tradeoffs:**

| Concern | Worker (Pull) | Hook (Push) |
|---|---|---|
| Latency | Low (already connected) | Higher (cold start possible) |
| In-memory state | Can cache AbortControllers, parent-child maps | Must reconstruct from storage each time |
| Scaling | Manual (add more workers) | Automatic (serverless scales with events) |
| Cost | Always running | Pay per invocation |
| Cancellation | Easy (AbortController in memory) | Harder (must look up and signal cancellation) |
| Nested workflows | Tracks parent-child in memory | Must persist parent-child to storage |

---

## Hard Problems to Solve

### 1. In-Memory State in the Orchestrator

The WorkflowEventProcessor maintains several in-memory maps:
- `abortControllers: Map<runId, AbortController>` — for cancellation
- `parentChildRelationships: Map<childRunId, parentRunId>` — for nested workflows
- `runFormats: Map<runId, format>` — for stream formatting
- `activeSteps: Map<stepKey, ...>` — for tracking in-flight steps

In the Worker model, these live naturally in the worker process. But if a worker crashes, they're lost. And in the Hook model, they don't exist at all.

**Solution:** Persist these to storage. The storage layer already handles workflow snapshots — extend it to store:
- Parent-child mappings (already partially stored in step metadata)
- Active step tracking (for detecting stuck steps)
- Cancellation flags (instead of AbortController, poll a `canceled` flag in storage)

### 2. Ordering Guarantees

A workflow's events must be processed in order. If two Orchestrator workers both receive events for the same `runId`, they could step on each other.

**Solution:** PubSub ordering keys. GCP Pub/Sub supports `orderingKey` — set it to `runId`. This ensures all events for a given workflow run are delivered to the same consumer in order. The existing `GoogleCloudPubSub` adapter already enables ordering for the `workflows` topic.

### 3. Sleep Steps in a Distributed World

Today: `processWorkflowSleep()` calls `setTimeout(ms)` in-process. If the process restarts, the sleep is lost.

**Options:**
- **Durable timer:** Orchestrator persists sleep expiry to storage. Scheduler polls for expired sleeps and re-publishes `workflow.step.end`.
- **PubSub delayed delivery:** Some brokers support scheduled messages.
- **Simple approach:** Orchestrator publishes a `workflow.sleep` event with expiry timestamp. The Scheduler picks these up on its polling interval and re-triggers them when expired. Trades precision for simplicity.

### 4. Workflow Definition Access

The Orchestrator needs to traverse the step graph to determine next steps. Today the WEP gets workflow definitions from the Mastra instance's registry (in-process).

**Options:**
- **Orchestrator loads definitions from Server:** HTTP call to `GET /workflows/:id` to fetch the step graph
- **Server returns routing info:** Step execution response includes `nextSteps` or the full graph
- **Orchestrator has its own Mastra instance:** Initialized with the same workflow definitions (requires shared config)
- **Store serialized step graph in storage:** Orchestrator loads from DB directly

The cleanest option: the Server returns the serialized step graph as part of the step execution response, or the Orchestrator fetches it once and caches it per workflow.

### 5. Auth Between Orchestrator and Server

The Orchestrator makes HTTP calls to a Server that likely has auth middleware. Options:
- **Service account / API key:** Simple, rotatable
- **mTLS:** Strongest, but complex to set up
- **Shared secret / JWT:** Orchestrator mints tokens signed with a shared secret
- **Internal network only:** If Orchestrator and Server are in the same VPC, skip auth (risky)

---

## What Needs to Change in Existing Code

### packages/core

1. **Extract decision logic from WorkflowEventProcessor** — Separate "determine next step" from "execute step" into composable pieces
2. **Make StepExecutor HTTP-callable** — Wrap it in a handler that takes serialized context and returns serialized result
3. **Persist in-memory state** — Parent-child relationships, cancellation flags to storage
4. **Replace `setTimeout` in sleep steps** — Use durable timer mechanism

### packages/server

1. **New route:** `POST /workflows/:workflowId/runs/:runId/steps/execute` — accepts step identity + serialized context, runs `StepExecutor`, returns result
2. **Auth middleware** for service-to-service calls from Orchestrator

### New: @mastra/orchestrator

1. **Worker mode:** Long-running process that subscribes to PubSub, processes events, calls Server
2. **Hook mode:** HTTP handler that receives pushed events
3. **Scheduler:** Cron-based or polling-based workflow trigger system
4. **Config:** Server URL, PubSub config, auth credentials, retry policies

### pubsub/google-cloud-pubsub

1. **Ensure pull subscription support** for Worker mode
2. **Ensure push subscription support** for Hook mode
3. **Ordering key on `runId`** (already partially implemented)

---

## Deployment Models

| Model | Orchestrator | Server | PubSub | Best For |
|---|---|---|---|---|
| Monolith (today) | In-process WEP | Same process | EventEmitter | Dev, simple apps |
| Sidecar | Separate process, same machine | Same machine | GCP/Redis | Fault isolation without network hops |
| Distributed Worker | Separate fleet | Separate fleet | GCP | Production, high throughput |
| Serverless Hook | Cloud Function | Cloud Run | GCP Push | Cost-efficient, bursty |
| Hybrid | Worker + Hook | Auto-scaled | GCP Both | Large-scale production |

---

## Open Questions

1. **Should the Orchestrator know the workflow graph, or should the Server tell it what to do next?** If the Server returns "next step is X" in the step execution response, the Orchestrator becomes much thinner (just a router). But then the Server is doing orchestration again.

2. **How do we handle forEach/parallel in the distributed model?** Today the WEP tracks parallel branch completion in-memory. With multiple workers, this state must be in storage with atomic operations (e.g., "increment completed branch count, if all done, advance").

3. **What about the BackgroundTaskManager?** It already has its own worker pattern with consumer groups on PubSub. Should the Orchestrator subsume it, or do they remain separate?

4. **Can we keep backward compatibility?** The in-process WEP model should still work for users who don't need distribution. The Orchestrator should be opt-in.

5. **How does this interact with Inngest?** Inngest already provides durable execution. Is the Orchestrator a replacement for Inngest, a complement, or an alternative for users who don't want an Inngest dependency?

6. **What is the granularity of "step"?** If a step is an agent that streams for 60 seconds, the HTTP call to the Server is long-lived. Should the Server stream the step result back, or return only when done?

---

## Resolved Decisions

| Question | Resolution | Rationale |
|----------|-----------|-----------|
| Q1: Orchestrator knows graph? | **Yes — shared import** | User imports workflow definition module in both server and worker. Orchestrator has the step graph for routing decisions. |
| Q2: forEach/parallel joins | **Atomic CAS in storage** | Counter per `(runId, joinStepId)`. The instance that reaches targetCount wins and triggers the join step. |
| Q3: BackgroundTaskManager | **Subsumed into unified Worker** | All three worker-like components (WEP, Scheduler, BGTaskManager) become composable subsystems within a single Worker abstraction. |
| Q4: Backward compatibility | **Automatic** | `MastraWorker` with in-process mode is created by default. Zero config change for existing users. |
| Q6: Streaming steps | **HTTP timeout (5min) + PubSub for watch events** | Watch events (tokens, progress) publish to PubSub during execution. HTTP response carries only the final StepResult. Timeout is configurable. |
| `worker: false` behavior | **Pure HTTP layer** | Server publishes events, exposes step endpoint, does zero local event processing. |
| Hook vs Worker scope | **Both designed together** | Share identical subsystem logic, differ only in transport (how events arrive). |

---

# Unified MastraWorker: Implementation Design

## Concept: The Unified Worker

Inspired by Temporal's worker model: a **Worker** is a process that executes application logic. The same Worker code works whether embedded in your application or running as a dedicated service.

Mastra has three independent "worker-like" components today:

1. **WorkflowEventProcessor** — subscribes to `'workflows'` PubSub topic, processes orchestration events
2. **WorkflowScheduler** — polls storage for due schedules on `setInterval`, publishes `workflow.start` events
3. **BackgroundTaskManager** — subscribes to `'background-tasks'` PubSub topic with consumer group, executes tool calls

All share the same dependency pattern (PubSub + Storage + start/stop lifecycle) but are initialized and managed separately by the `Mastra` class.

The unified `MastraWorker` merges these into a single composable abstraction with two independent axes:

```text
                         Step Execution
                    in-process       remote (HTTP)
         ┌──────────────────────┬────────────────────┐
  worker │  DEFAULT (today)     │  Standalone worker │
  (pull) │                      │  (distributed)     │
         ├──────────────────────┼────────────────────┤
  hook   │  invalid             │  Serverless        │
  (push) │                      │  (Cloud Run/λ)     │
         └──────────────────────┴────────────────────┘
```

- **Transport** (how events arrive): Worker (pull, long-running subscriber) or Hook (push, stateless HTTP handler)
- **Step Execution** (how steps run): In-process (direct `StepExecutor.execute()` call) or Remote (HTTP POST to server)

---

## Temporal Worker Model: Key Lessons

Temporal's architecture informed this design. Key takeaways:

1. **Workers are dumb executors, the Server is the brain.** In Temporal, the Server maintains all state and decides what happens next. Workers poll for tasks, execute code, and report results. They hold no essential state — if one crashes, another replays and continues.

2. **The same Worker code works embedded or standalone.** Whether running in-process with your app or as a separate service, a Worker polls a Task Queue and executes tasks. The deployment topology is an operational concern, not a code concern.

3. **Task Queues decouple "what" from "where".** Named queues with consumer group semantics mean application code says "run activity X on queue Y" without caring how many workers listen or where they are.

4. **Communication is always Worker-initiated.** Workers long-poll the Server. The Server never calls into Workers directly. This means workers don't need public IPs and can be behind NAT.

**How we differ from Temporal:**
- In Temporal, the Server is the brain and Workers execute. In our model, the Worker IS the brain (orchestration decisions) and the Server executes steps. This is because our step functions require JS runtime, tools, and LLM connections that live on the Server.
- Temporal uses gRPC long-poll. We use PubSub (pull subscription or push delivery).
- Temporal replays full event history for recovery. We checkpoint to storage after each step.

---

## Architecture: All Deployment Modes

### Mode 1: In-Process (today's default, zero config)

```text
┌──────────────────────────────────────────────────────────────────────┐
│                          Single Process                                │
│                                                                        │
│  ┌──────────────────┐         ┌────────────────────────────────────┐  │
│  │ Mastra (Server)  │────────▶│ MastraWorker (in-process)          │  │
│  │                  │         │                                    │  │
│  │  HTTP API        │         │  OrchestrationSub                  │  │
│  │  Step functions  │         │    → InProcessStrategy             │  │
│  │  Tools / LLMs    │         │    → StepExecutor.execute()        │  │
│  │                  │         │  SchedulerSub                      │  │
│  │                  │         │    → polls storage, publishes      │  │
│  │                  │         │  BackgroundTaskSub                  │  │
│  │                  │         │    → executes tools w/ concurrency │  │
│  └──────────────────┘         └────────────────────────────────────┘  │
│           │                            │                               │
│           └────────────┬───────────────┘                               │
│                        ▼                                               │
│              EventEmitterPubSub (in-memory)                            │
└──────────────────────────────────────────────────────────────────────┘
```

### Mode 2: Standalone Worker (distributed, pull)

```text
┌────────────────────────────┐         ┌─────────────────────────────────┐
│  Mastra Server             │         │  MastraWorker (standalone)      │
│  (worker: false)           │         │                                 │
│                            │         │  PullTransport                  │
│  HTTP API (user-facing)    │         │    └── subscribes to PubSub    │
│  POST /steps/execute       │◀──HTTP──│                                 │
│    (worker-facing)         │         │  OrchestrationSub               │
│                            │         │    → HttpRemoteStrategy         │
│  Step functions            │         │  SchedulerSub                   │
│  Tools / LLMs              │         │    → polls storage              │
│  Watch event publishing    │         │  BackgroundTaskSub              │
│                            │         │    → (optional)                 │
└─────────────┬──────────────┘         └───────────────┬─────────────────┘
              │                                        │
              └────────────────┬───────────────────────┘
                               ▼
                    ┌────────────────────┐
                    │  External PubSub   │
                    │  (GCP Pub/Sub)     │
                    └────────────────────┘
                               │
                    ┌────────────────────┐
                    │  External Storage  │
                    │  (LibSQL / PG)     │
                    └────────────────────┘
```

### Mode 3: Serverless Hook (push)

```text
┌────────────────────────────┐
│  Mastra Server             │
│  (worker: false)           │
│                            │         PubSub push delivery
│  POST /steps/execute       │              │
└─────────────▲──────────────┘    ┌─────────┴──────────┐
              │                   ▼                     ▼
              │         ┌──────────────────┐  ┌──────────────────┐
              │         │  Hook instance A │  │  Hook instance B │
              └──HTTP───│                  │  │                  │
                        │  POST /hook      │  │  POST /hook      │
                        │  load state      │  │  load state      │
                        │  decide + exec   │  │  decide + exec   │
                        │  save state      │  │  save state      │
                        │  ack (200)       │  │  ack (200)       │
                        └──────────────────┘  └──────────────────┘
                                │                     │
                        Auto-scaled by platform (Cloud Run / Lambda)
```

### Mode 4: Specialized Workers

```text
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Worker A        │    │  Worker B        │    │  Worker C        │
│  orchestration   │    │  scheduler only  │    │  backgroundTasks │
└────────┬─────────┘    └────────┬─────────┘    └────────┬─────────┘
         └───────────────────────┼────────────────────────┘
                                 ▼
                       Shared PubSub + Storage
```

### Worker vs Hook: When to Use Which

| | Worker (pull) | Hook (push) |
|---|---|---|
| **Process model** | Long-running | Stateless per invocation |
| **Deploy on** | VM, K8s pod, ECS task | Cloud Run, Lambda, Vercel |
| **State** | In-memory (flushes to storage) | Loads from storage every time |
| **Scaling** | Horizontal via consumer groups | Auto-scales with platform |
| **Latency** | Lower (state cached in memory) | Higher (cold start + state load) |
| **Cost model** | Always-on | Pay-per-invocation |
| **Best for** | High-throughput, latency-sensitive | Bursty, cost-sensitive |
| **Scheduler subsystem** | Yes (interval polling) | No (use Cloud Scheduler) |
| **Cancellation** | In-memory AbortController | Storage flag check |
| **Crash recovery** | PubSub nack → redelivery to peer | Platform retries on non-200 |

---

## Layered Design

```text
┌─────────────────────────────────────────────────────────┐
│  Layer 4: MastraWorker                                   │
│  Composes subsystems + transport + strategy              │
│  Lifecycle: start() / stop() / handleEvent()            │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Subsystems                                     │
│  OrchestrationSub / SchedulerSub / BackgroundTaskSub    │
│  Each has processEvent() — identical regardless of       │
│  transport or execution strategy                         │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Transport (how events arrive)                  │
│  PullTransport — subscribes to PubSub, pulls events     │
│  PushTransport — no-op start, events arrive externally  │
├─────────────────────────────────────────────────────────┤
│  Layer 1: StepExecutionStrategy (how steps run)          │
│  InProcessStrategy — direct StepExecutor.execute()      │
│  HttpRemoteStrategy — POST to server endpoint           │
└─────────────────────────────────────────────────────────┘
```

---

## Interfaces

### WorkerConfig

```typescript
interface WorkerConfig {
  /**
   * Transport mode: how the worker receives events.
   * - 'worker': long-running process, pulls from PubSub (default)
   * - 'hook': stateless, events pushed via handleEvent()
   */
  transport?: 'worker' | 'hook';

  /** Which subsystems to enable. Default: all enabled. */
  subsystems?: {
    orchestration?: boolean | OrchestrationSubConfig;
    scheduler?: boolean | SchedulerSubConfig;
    backgroundTasks?: boolean | BackgroundTaskSubConfig;
  };

  /** How steps are executed when orchestration decides "run step X". */
  stepExecution?: {
    mode: 'in-process' | 'remote';
    serverUrl?: string;
    auth?: { type: 'api-key'; key: string } | { type: 'bearer'; token: string };
    timeoutMs?: number;  // default: 300_000 (5 min)
  };

  /** Required for standalone mode. In-process derives from Mastra. */
  pubsub?: PubSub;
  storage?: MastraCompositeStore;

  /** Workflow definitions (step graphs). Required for standalone orchestration. */
  workflows?: Record<string, Workflow>;

  /** Consumer group name for PubSub subscriptions. */
  group?: string;  // default: 'mastra-workers'

  /** Max time to wait for in-flight work during shutdown. */
  shutdownTimeoutMs?: number;  // default: 30_000
}

interface OrchestrationSubConfig {
  /** Consumer group for workflow events. Default: inherits from parent. */
  group?: string;
}

interface SchedulerSubConfig {
  tickIntervalMs?: number;   // default: 10_000
  batchSize?: number;        // default: 100
}

interface BackgroundTaskSubConfig {
  globalConcurrency?: number;
  perAgentConcurrency?: number;
  defaultTimeoutMs?: number;
}
```

### MastraWorker

```typescript
class MastraWorker extends MastraBase {
  constructor(config: WorkerConfig);

  /** In-process injection. Called by Mastra class. */
  __registerMastra(mastra: Mastra): void;

  /** Start all enabled subsystems + transport. */
  async start(): Promise<void>;

  /** Graceful shutdown: stop accepting → drain in-flight → cleanup. */
  async stop(): Promise<void>;

  /**
   * Hook mode only: process a single pushed event.
   * Throws if transport is 'worker'.
   */
  async handleEvent(event: WorkflowEvent): Promise<void>;

  get isRunning(): boolean;
}
```

### WorkerTransport (internal)

```typescript
/**
 * Transport determines HOW the worker receives events.
 * The subsystem logic (WHAT to do with events) is identical regardless of transport.
 */
interface WorkerTransport {
  /** Start receiving events (Worker: subscribe; Hook: no-op) */
  start(router: EventRouter): Promise<void>;
  /** Stop receiving events */
  stop(): Promise<void>;
}

/**
 * EventRouter maps events to the correct subsystem.
 * Both transports use the same router.
 */
interface EventRouter {
  route(event: WorkflowEvent): Promise<void>;
}

/** Worker transport: long-running, subscribes to PubSub */
class PullTransport implements WorkerTransport {
  async start(router: EventRouter) {
    await this.pubsub.subscribe('workflows', (event, ack) => {
      router.route(event).then(ack);
    }, { group: this.group });

    await this.pubsub.subscribe('background-tasks', (event, ack) => {
      router.route(event).then(ack);
    }, { group: this.group });
  }
}

/** Hook transport: no-op start, events arrive via handleEvent() */
class PushTransport implements WorkerTransport {
  async start() { /* no-op — events arrive externally */ }
  async stop() { /* no-op */ }
}
```

### WorkerSubsystem (internal)

```typescript
interface WorkerSubsystem {
  readonly name: string;

  /** Initialize the subsystem with dependencies */
  init(deps: SubsystemDeps): Promise<void>;

  /**
   * Process a single event routed to this subsystem.
   * Called by both transports:
   * - PullTransport calls this from subscription callback
   * - PushTransport calls this from handleEvent()
   */
  processEvent(event: WorkflowEvent): Promise<void>;

  /** Start autonomous work (scheduler tick loop, etc.) */
  start(): Promise<void>;

  /** Graceful stop */
  stop(): Promise<void>;

  readonly isRunning: boolean;
}

interface SubsystemDeps {
  pubsub: PubSub;
  storage: MastraCompositeStore;
  logger: IMastraLogger;
  mastra?: Mastra;  // only available in-process
  stepExecutionStrategy: StepExecutionStrategy;
  workflows?: Record<string, Workflow>;
}
```

### StepExecutionStrategy

```typescript
interface StepExecutionStrategy {
  executeStep(params: StepExecutionParams): Promise<StepResult>;
}

interface StepExecutionParams {
  workflowId: string;
  runId: string;
  stepId: string;
  executionPath: number[];
  stepResults: Record<string, StepResult>;
  state: Record<string, any>;
  requestContext: Record<string, any>;
  input?: any;
  resumeData?: any;
  retryCount?: number;
  foreachIdx?: number;
  format?: 'legacy' | 'vnext';
  perStep?: boolean;
}
```

**InProcessStrategy** — used when Worker runs in-process with Mastra:
```typescript
class InProcessStrategy implements StepExecutionStrategy {
  constructor(private stepExecutor: StepExecutor, private mastra: Mastra) {}

  async executeStep(params: StepExecutionParams): Promise<StepResult> {
    const step = this.resolveStep(params.workflowId, params.stepId);
    const rc = new RequestContext();
    Object.entries(params.requestContext).forEach(([k, v]) => rc.set(k, v));
    return this.stepExecutor.execute({ ...params, step, requestContext: rc });
  }
}
```

**HttpRemoteStrategy** — used when Worker runs standalone:
```typescript
class HttpRemoteStrategy implements StepExecutionStrategy {
  constructor(private config: { serverUrl: string; auth?; timeoutMs: number }) {}

  async executeStep(params: StepExecutionParams): Promise<StepResult> {
    const url = `${this.config.serverUrl}/workflows/${params.workflowId}/runs/${params.runId}/steps/execute`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { ...this.authHeaders(), 'content-type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(this.config.timeoutMs),
    });
    if (!res.ok) throw new StepExecutionError(res.status, await res.text());
    return res.json();
  }
}
```

---

## Subsystem Details

### OrchestrationSubsystem

Wraps the extracted decision-making logic from WorkflowEventProcessor.

**What it keeps from WEP:**
- `processWorkflowStart()` — initialize run, determine first step
- `processWorkflowStepEnd()` — graph traversal, branching, looping, forEach/parallel joins
- `processWorkflowSuspend()` — persist suspended state, propagate to parent
- `processWorkflowResume()` — restore snapshot, re-enter at suspended step
- `processWorkflowFail()` — error handling, parent propagation
- `processWorkflowCancel()` — recursive cancellation
- Execution path arithmetic (`[0] → [1]`, `[0,0] → [0,1]`)
- Parent-child relationship tracking

**What changes:**
- `processWorkflowStepRun` is replaced by `StepExecutionStrategy.executeStep()`
- In-memory maps (AbortControllers, parent-child) are backed by storage for crash recovery
- In Worker mode: maps are hot in memory, flushed to storage after each step
- In Hook mode: maps are loaded from storage at start of each invocation

**Event routing:**
```text
event.type starts with 'workflow.' → OrchestrationSubsystem.processEvent()
```

### SchedulerSubsystem

Thin wrapper around the existing `WorkflowScheduler`.

**Behavior:**
- Polls `schedules` storage table on interval for due schedules
- Publishes `{ type: 'workflow.start' }` events to PubSub when schedule fires
- Atomic compare-and-set on `nextFireAt` prevents double-fire across workers

**Constraint:** Only valid with Worker transport (needs persistent interval loop).
In Hook mode, use external scheduler (GCP Cloud Scheduler → PubSub → Hook) to trigger workflow starts.

**Event routing:** SchedulerSub does NOT process inbound events. Its `start()` begins the tick loop. It is a pure producer.

### BackgroundTaskSubsystem

Wraps the existing `BackgroundTaskManager`.

**Behavior:**
- Subscribes to `'background-tasks'` topic with consumer group
- Executes tool calls with concurrency control (global + per-agent limits)
- Publishes results to `'background-tasks-result'` topic
- Recovers stale tasks on startup

**Event routing:**
```text
event.type starts with 'background-task.' → BackgroundTaskSubsystem.processEvent()
```

---

## Hook Mode: State Management Protocol

Since Hook is stateless between invocations, each call follows a strict protocol:

```text
┌─────────────────────────────────────────────────────────────┐
│  Hook invocation lifecycle                                   │
│                                                              │
│  1. LOAD    — read run state from storage                   │
│              (snapshot, step results, parent-child,           │
│               cancellation flags, join counters)              │
│                                                              │
│  2. CHECK   — verify run not canceled                       │
│              (if canceled, ack and exit)                      │
│                                                              │
│  3. DECIDE  — run orchestration logic                       │
│              (same code as Worker mode)                       │
│                                                              │
│  4. EXECUTE — call server for step execution (HTTP)          │
│                                                              │
│  5. SAVE    — persist updated state to storage              │
│              (new step results, updated snapshot,             │
│               join counters, next event to publish)           │
│                                                              │
│  6. PUBLISH — publish next event to PubSub                  │
│              (workflow.step.end, workflow.end, etc.)           │
│                                                              │
│  7. ACK     — return 200 (PubSub won't redeliver)           │
└─────────────────────────────────────────────────────────────┘
```

### Hook: Parallel/ForEach Joins

Multiple hook instances may complete different parallel branches concurrently. The join must be atomic:

```typescript
// Storage operation (must be atomic CAS):
interface JoinTracker {
  incrementBranch(runId: string, joinStepId: string, branchId: string): Promise<{
    completed: number;
    target: number;
  }>;
}

// In OrchestrationSubsystem during a branch completion:
const { completed, target } = await joinTracker.incrementBranch(runId, joinStepId, branchId);
if (completed === target) {
  // This invocation "wins" the race — trigger the join step
  await this.strategy.executeStep({ stepId: joinStepId, ... });
} else {
  // Other branches still pending — ack and exit
  return;
}
```

### Hook: Cancellation

No in-memory AbortController between invocations:

1. Cancel request sets `canceled: true` flag in storage for the runId
2. Each Hook invocation checks the flag in the LOAD phase
3. If canceled → ack event, do nothing
4. In-flight HTTP calls to server are bounded by timeout (step is wasted work, but bounded)

---

## Server-Side: Step Execution Endpoint

### New Endpoint

```text
POST /workflows/:workflowId/runs/:runId/steps/execute
Authorization: Bearer <worker-api-key>
Content-Type: application/json
```

### Request Body

```json
{
  "stepId": "process-payment",
  "executionPath": [0, 1],
  "stepResults": { "validate-input": { "status": "success", "output": {"valid": true} } },
  "state": { "orderId": "abc-123" },
  "requestContext": { "userId": "user-1" },
  "input": { "amount": 100 },
  "resumeData": null,
  "retryCount": 0,
  "format": "vnext",
  "perStep": true
}
```

### Response (success)

```json
{
  "status": "success",
  "output": { "transactionId": "txn-456" },
  "state": { "orderId": "abc-123", "paid": true }
}
```

### Response (suspended)

```json
{
  "status": "suspended",
  "suspendPayload": { "reason": "needs-approval", "labels": ["manager"] }
}
```

### Server Implementation

```typescript
app.post('/workflows/:workflowId/runs/:runId/steps/execute', workerAuthMiddleware, async (req, res) => {
  const { workflowId, runId } = req.params;
  const params = req.body as StepExecutionParams;

  const workflow = mastra.getWorkflow(workflowId);
  const step = workflow.resolveStep(params.stepId);
  const stepExecutor = new StepExecutor({ mastra });

  const result = await stepExecutor.execute({
    step,
    runId,
    ...params,
    requestContext: RequestContext.fromJSON(params.requestContext),
  });

  res.json(result);
});
```

### Auth

> **Historical — pre-implementation design.** The `MASTRA_WORKER_API_KEY` /
> `workerAuthMiddleware` / `stepExecution.auth` shape below describes the
> original exploration. The shipped implementation reuses the framework's
> existing `experimental_auth` flow instead of a dedicated worker-secret
> pathway — see "Worker-to-server auth uses the framework's existing auth
> provider" in the Diverged-from-original-plan section above (lines 82-85).
> The example is preserved here for historical context; do not follow it for
> shipped deployments.

Service-to-service authentication:
- Configured on server: `MASTRA_WORKER_API_KEY=secret`
- Configured on worker: `stepExecution.auth: { type: 'api-key', key: 'secret' }`
- `workerAuthMiddleware` validates before passing to handler
- Separate from user-facing auth (different key, different middleware)

---

## Mode Detection & Validation

### How Mode is Determined

- `__registerMastra()` called → **in-process mode**: uses Mastra's PubSub, Storage, workflow registry. StepExecution defaults to `InProcessStrategy`. Transport is effectively pull (direct subscription).
- Explicit `pubsub` + `storage` in config, no `__registerMastra()` → **standalone mode**: uses provided deps. StepExecution must be `{ mode: 'remote', serverUrl }`.
- `transport: 'hook'` → events arrive via `handleEvent()`, no persistent subscription.

### Validation Rules

| Config combination | Valid? | Notes |
|---|---|---|
| In-process + EventEmitterPubSub | Yes | Today's default |
| In-process + GoogleCloudPubSub | Yes | External PubSub, same process |
| Standalone Worker + GoogleCloudPubSub | Yes | Production distributed |
| Standalone Worker + EventEmitterPubSub | **Error** | Can't span processes with in-memory PubSub |
| Hook + remote | Yes | Serverless deployment |
| Hook + in-process | **Error** | Hook implies separate from server |
| Hook + scheduler subsystem | **Warning** | Scheduler needs interval loop, use external cron |
| worker: false + no external PubSub | **Error** | Events will be published but nobody processes them |

---

## Integration with Mastra Class

### Config Addition

```typescript
interface MastraConfig {
  // ... existing fields ...

  /**
   * Worker configuration.
   * - undefined: auto-create in-process worker (today's behavior, backward compat)
   * - WorkerConfig object: create worker from config
   * - MastraWorker instance: use provided worker directly
   * - false: server-only mode (pure HTTP, no local event processing)
   */
  worker?: WorkerConfig | MastraWorker | false;
}
```

### Inside Mastra Constructor

```typescript
if (config.worker === false) {
  // Server-only mode:
  // - PubSub exists for publishing events (workflow.start, etc.)
  // - No local subscribers for orchestration, scheduling, or background tasks
  // - Step execution endpoint is the only way steps run
  this.#worker = null;
} else {
  const worker = config.worker instanceof MastraWorker
    ? config.worker
    : new MastraWorker(config.worker ?? {});
  worker.__registerMastra(this);
  this.#worker = worker;
  // Worker.start() called during Mastra.startEventEngine() or init
}
```

### What This Replaces

The unified Worker replaces three separate initialization paths:
- `new WorkflowEventProcessor({ mastra })` → `worker.orchestration` subsystem
- `this.#ensureScheduler()` → `worker.scheduler` subsystem
- `this.#ensureBackgroundTaskManager()` → `worker.backgroundTasks` subsystem

The `startEventEngine()` method delegates to `this.#worker.start()`.
The `shutdown()` method delegates to `this.#worker.stop()`.

---

## Entrypoints

### In-Process (default, no change required)

```typescript
// mastra.config.ts — works exactly as today, zero config change
import { Mastra } from 'mastra';

export const mastra = new Mastra({
  workflows: { myWorkflow },
  // worker is undefined → auto-creates in-process worker with all subsystems
});
```

### Standalone Worker (pull mode)

```typescript
// worker.ts — run as: node worker.ts (or tsx worker.ts)
import { MastraWorker } from '@mastra/core/worker';
import { GoogleCloudPubSub } from '@mastra/google-cloud-pubsub';
import { LibSQLStore } from '@mastra/libsql';
import { workflows } from './shared/workflows';

const worker = new MastraWorker({
  transport: 'worker',
  pubsub: new GoogleCloudPubSub({ projectId: 'my-project' }),
  storage: new LibSQLStore({ url: process.env.DATABASE_URL }),
  workflows,
  subsystems: {
    orchestration: true,
    scheduler: { tickIntervalMs: 5000 },
    backgroundTasks: { globalConcurrency: 20 },
  },
  stepExecution: {
    mode: 'remote',
    serverUrl: process.env.MASTRA_SERVER_URL,
    auth: { type: 'api-key', key: process.env.WORKER_API_KEY },
  },
});

await worker.start();
process.on('SIGTERM', () => worker.stop().then(() => process.exit(0)));
```

### Serverless Hook (push mode)

```typescript
// hook.ts — deploy as Cloud Run / Lambda / Vercel Function
import { MastraWorker } from '@mastra/core/worker';
import { GoogleCloudPubSub } from '@mastra/google-cloud-pubsub';
import { LibSQLStore } from '@mastra/libsql';
import { workflows } from './shared/workflows';

const worker = new MastraWorker({
  transport: 'hook',
  pubsub: new GoogleCloudPubSub({ projectId: 'my-project' }),
  storage: new LibSQLStore({ url: process.env.DATABASE_URL }),
  workflows,
  subsystems: {
    orchestration: true,
    backgroundTasks: true,
    // scheduler: not enabled — use Cloud Scheduler externally
  },
  stepExecution: {
    mode: 'remote',
    serverUrl: process.env.MASTRA_SERVER_URL,
    auth: { type: 'api-key', key: process.env.WORKER_API_KEY },
  },
});

// HTTP handler for PubSub push delivery
export async function POST(req: Request) {
  const event = await parsePubSubPushMessage(req);
  await worker.handleEvent(event);
  return new Response('ok', { status: 200 });
}
```

### Server-Only (when using external workers)

```typescript
// server.ts
import { Mastra } from 'mastra';
import { GoogleCloudPubSub } from '@mastra/google-cloud-pubsub';

export const mastra = new Mastra({
  workflows: { myWorkflow },
  worker: false,  // pure HTTP layer, no local event processing
  pubsub: new GoogleCloudPubSub({ projectId: 'my-project' }),
});
```

---

## File Structure

```text
packages/core/src/worker/
├── index.ts                      # Public exports: MastraWorker, types, strategies
├── worker.ts                     # MastraWorker class implementation
├── types.ts                      # WorkerConfig, SubsystemDeps, event types
│
├── transport/
│   ├── transport.ts              # WorkerTransport + EventRouter interfaces
│   ├── pull-transport.ts         # PullTransport (long-running PubSub subscriber)
│   └── push-transport.ts         # PushTransport (no-op, events via handleEvent)
│
├── subsystems/
│   ├── subsystem.ts              # WorkerSubsystem interface
│   ├── orchestration.ts          # OrchestrationSubsystem
│   │                               - Extracted WEP decision logic
│   │                               - Delegates step exec to strategy
│   ├── scheduler.ts              # SchedulerSubsystem
│   │                               - Wraps existing WorkflowScheduler
│   │                               - Only active in Worker transport mode
│   └── background-tasks.ts       # BackgroundTaskSubsystem
│                                    - Wraps existing BackgroundTaskManager
│
├── strategies/
│   ├── step-execution.ts         # StepExecutionStrategy interface
│   ├── in-process-strategy.ts    # InProcessStrategy (direct call)
│   └── http-remote-strategy.ts   # HttpRemoteStrategy (POST to server)
│
└── state/
    ├── state-manager.ts          # Load/save run state (primarily for Hook mode)
    └── join-tracker.ts           # Atomic CAS for parallel/forEach joins
```

---

## Hard Problems & Solutions

### 1. Parallel/ForEach Joins (distributed)

**Problem:** Multiple branches complete concurrently across workers/hooks. Who triggers the join?

**Solution:** Atomic counter in storage.
- Each branch completion increments a counter for `(runId, joinStepId)`
- The increment operation returns the new count atomically
- The instance that reaches `targetCount` wins and triggers the join step
- Others just ack and exit
- In Worker mode with ordering keys: all events for same runId go to same worker, so joins work with in-memory state (atomic counter is a fallback safety net)

### 2. Cancellation Across Machines

**Problem:** In-memory AbortControllers don't span processes.

**Worker mode solution:** PubSub ordering keys ensure all events for a runId go to the same worker. That worker has the AbortController in memory. `workflow.cancel` event arrives at the same worker → abort works as today.

**Hook mode solution:** Storage flag. Each invocation checks `run.canceled` in LOAD phase. If canceled, ack and exit immediately.

**Cross-worker cancellation (edge case):** If ordering key changes worker assignment during rebalancing, the new worker loads cancellation state from storage on the next event for that run.

### 3. Crash Recovery (Worker mode)

**Problem:** Worker crashes mid-workflow. In-memory state lost.

**Solution:**
- State is persisted to storage after each step completes (existing workflow snapshot behavior)
- PubSub nacks unacknowledged messages → redelivery to another worker in the group
- The new worker loads state from storage and continues from last checkpoint
- For the specific step that was in-flight: the Server may have completed it. Worker checks storage for step result before re-executing (idempotency)

### 4. Long-Running Steps (Streaming Agents)

**Problem:** An agent step may stream for 60+ seconds. HTTP timeout? Connection drops?

**Solution:**
- HTTP timeout is configurable (default 5 min, configurable up to 30 min for agent steps)
- Watch events (streaming tokens, tool calls, progress) are published to PubSub by the Server during execution — they don't flow through the Worker's HTTP response
- Client observes watch events via their own PubSub subscription to `workflow.events.v2.{runId}`
- If HTTP connection drops, Worker retries. Server uses `(runId, stepId, retryCount)` as idempotency key: if the step already completed, return cached result; if still running, wait for it

### 5. Ordering Guarantees

**Problem:** Workflow events must be processed in order. Two workers processing events for the same runId would conflict.

**Solution:** PubSub ordering keys.
- All events for a workflow run use `orderingKey: runId`
- GCP Pub/Sub guarantees ordered delivery within an ordering key to the same consumer
- Existing `GoogleCloudPubSub` adapter already supports ordering for the `workflows` topic
- In Hook mode: push delivery maintains ordering within a subscription if configured

### 6. Sleep Steps (Durable Timers)

**Problem:** Today `setTimeout` is in-process, lost on restart.

**Solution:** Integrate with SchedulerSubsystem:
- When orchestration encounters a sleep step, it writes a timer record to storage: `(runId, stepId, expiresAt)`
- SchedulerSubsystem polls for expired timers alongside cron schedules
- Expired timer → publish `workflow.step.end` with sleep-complete context
- Orchestration picks up the event and advances to the next step
- In Hook mode: external cron (Cloud Scheduler) triggers a "check timers" endpoint

---

## Migration Plan

### Phase 1: Internal Refactor (no public API change)

**Goal:** Wrap existing components in the Worker/Subsystem pattern without changing behavior.

Steps:
1. Create `packages/core/src/worker/` directory structure
2. Define `WorkerSubsystem` interface
3. Create `OrchestrationSubsystem` that wraps `WorkflowEventProcessor` as-is (thin delegation)
4. Create `SchedulerSubsystem` that wraps `WorkflowScheduler`
5. Create `BackgroundTaskSubsystem` that wraps `BackgroundTaskManager`
6. Create `MastraWorker` with `PullTransport` + `InProcessStrategy`
7. Refactor `Mastra` class internals to delegate to `MastraWorker`
8. All existing tests pass unchanged — this is a pure refactoring

**Key constraint:** Zero behavioral change. The Worker is purely organizational at this stage.

### Phase 2: Public API + Server-Only Mode

**Goal:** Users can configure worker behavior and run server-only.

Steps:
1. Export `MastraWorker` and config types from `@mastra/core/worker`
2. Add `worker` option to `MastraConfig`
3. Implement `worker: false` (server publishes events but has no local subscribers)
4. Support custom `WorkerConfig` (disable specific subsystems)
5. Add validation (standalone requires external PubSub, etc.)
6. Document the Worker concept and configuration options

### Phase 3: Remote Execution (Standalone Worker)

**Goal:** Workers can run as separate processes, calling server for step execution.

Steps:
1. Implement `HttpRemoteStrategy`
2. Add step execution endpoint to `packages/server` (or deployer package)
3. Add service-to-service auth middleware
4. Implement standalone Worker entrypoint (no Mastra instance needed)
5. Handle crash recovery: nack → redelivery, idempotent step execution
6. End-to-end test: separate server + worker processes driving a workflow to completion
7. Test: parallel workflow with joins across worker restart

### Phase 4: Hook Mode (Serverless)

**Goal:** Stateless serverless deployment via PubSub push delivery.

Steps:
1. Implement `PushTransport`
2. Implement `StateManager` (load/save full run state per invocation)
3. Implement `JoinTracker` (atomic CAS for parallel/forEach joins)
4. Implement cancellation via storage flag
5. Add `handleEvent()` method to `MastraWorker`
6. Add `parsePubSubPushMessage()` helper for GCP push format
7. End-to-end test: simulated PubSub push → Hook handler → step execution → completion
8. Test: concurrent parallel branch completion via multiple hook invocations
9. Document serverless deployment pattern (Cloud Run, Lambda)

### Phase 5: Durable Timers

**Goal:** Replace `setTimeout` with persistent, crash-safe timers.

Steps:
1. Add `workflow_timers` table to storage schema (runId, stepId, expiresAt, status)
2. Extend SchedulerSubsystem to poll expired timers alongside cron schedules
3. Expired timer → publish `workflow.step.end` to resume the sleeping workflow
4. Remove in-process `setTimeout` for evented workflow sleeps
5. Test: workflow with sleep step survives worker restart

---

## Testing Strategy

| Level | Scope | Method |
|-------|-------|--------|
| Unit | Each subsystem in isolation | Mocked PubSub, Storage, Strategy |
| Unit | Each strategy in isolation | Mocked StepExecutor / HTTP server |
| Unit | Transport implementations | Mocked PubSub subscribe/unsubscribe |
| Integration | MastraWorker in-process | Real EventEmitterPubSub, in-memory storage |
| Integration | Worker + Mastra wiring | Verify existing behavior unchanged |
| E2E (Phase 3) | Server + Worker (two processes) | Real GCP PubSub, real DB, HTTP between |
| E2E (Phase 4) | Hook handler | Simulated push delivery, verify state persistence |
| E2E (Phase 5) | Durable timers | Worker restart during sleep, verify resume |

---

## What This Does NOT Cover (Future Work)

- Multi-tenancy / per-tenant workers with isolated resources
- Workflow versioning (running v1 and v2 simultaneously)
- Blue/green deployment of worker fleets
- Worker-level metrics and observability (traces, throughput, latency histograms)
- Rate limiting between workers and server
- Backpressure from server → workers when overloaded
- Worker auto-scaling based on queue depth
- Dead letter queues for permanently failed events
- Multi-region deployment (workers in region A, server in region B)
