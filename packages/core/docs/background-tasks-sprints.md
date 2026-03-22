# Background Tasks: Sprint Breakdown

Two sprints. Sprint 1 gets background tasks executing end-to-end using pubsub and in-memory state. Sprint 2 adds durable storage, the query API, and cleanup.

---

## Sprint 1: Execution

Get a background tool call working end-to-end — from the LLM invoking a tool, to it running in the background via pubsub, to the result streaming back and appearing in the next agent turn. Storage is in-memory only (a `Map` inside the manager). Persistence comes in Sprint 2.

### Task 1.1: Extend PubSub with `group` option on `subscribe()`

Add the `SubscribeOptions` parameter to the abstract `PubSub` class and implement competing-consumer behavior in `EventEmitterPubSub`.

**Files:**

- `packages/core/src/events/pubsub.ts` — Add optional `options?: SubscribeOptions` to `subscribe()` signature
- `packages/core/src/events/types.ts` — Add `SubscribeOptions` interface with `group?: string`
- `packages/core/src/events/event-emitter.ts` — Implement group tracking and round-robin dispatch

**Acceptance:**

- Existing `subscribe(topic, cb)` calls work unchanged (fan-out)
- `subscribe(topic, cb, { group: 'x' })` delivers each message to exactly one subscriber in group `x`
- Multiple subscribers in the same group round-robin
- Unit tests covering fan-out, single-group, multi-group, and mixed fan-out + group on the same topic

---

### Task 1.2: Extend Google Cloud PubSub with `group` support

Implement the `group` option in the Google Cloud PubSub adapter.

**Files:**

- `pubsub/google-cloud-pubsub/src/index.ts` — Use `${topic}-${group}` as subscription name when group is set (instead of `${topic}-${instanceId}`)

**Acceptance:**

- With `group` set, multiple processes share the same subscription name → Google Cloud distributes messages
- Without `group`, existing per-instance subscription behavior is preserved
- `enableExactlyOnceDelivery: true` when group is set

---

### Task 1.3: Define background task types and config interfaces

Create the type definitions that the rest of the implementation depends on.

**Files:**

- New file: `packages/core/src/background-tasks/types.ts`

**Types to define:**

- `BackgroundTask` — id, status, toolName, toolCallId, args, agentId, threadId, resourceId, result, error, retryCount, maxRetries, timeoutMs, createdAt, startedAt, completedAt
- `BackgroundTaskStatus` — `'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out'`
- `TaskPayload` — what `enqueue()` accepts
- `TaskFilter` — status, agentId, threadId, toolName, date ranges, ordering, pagination
- `BackgroundTaskManagerConfig` — globalConcurrency, perAgentConcurrency, backpressure, defaultTimeoutMs, defaultRetries, cleanup, messageHandling, callbacks
- `RetryConfig` — maxRetries, retryDelayMs, backoffMultiplier, maxRetryDelayMs, retryableErrors
- `CleanupConfig` — completedTtlMs, failedTtlMs, cleanupIntervalMs
- `ToolBackgroundConfig` — enabled, timeoutMs, retries, messageHandling, callbacks
- `AgentBackgroundConfig` — tools map, concurrency, messageHandling, callbacks
- `LLMBackgroundOverride` — enabled, timeoutMs, maxRetries (the `_background` field shape)
- `SubscribeOptions` (if not already done in 1.1)
- Stream chunk types: `BackgroundTaskStartedChunk`, `BackgroundTaskCompletedChunk`, `BackgroundTaskFailedChunk`, `BackgroundTaskProgressChunk`

**Acceptance:**

- All types compile with strict TypeScript
- Exported from `packages/core/src/background-tasks/index.ts`

---

### Task 1.4: BackgroundTaskManager — core class with in-memory state

Implement the manager class with enqueue, dispatch, worker subscriber, result listener, concurrency control, and drain logic. Uses an in-memory `Map<string, BackgroundTask>` for task state (no storage dependency yet).

**Files:**

- New file: `packages/core/src/background-tasks/manager.ts`

**Methods to implement:**

- `init(pubsub, storage?)` — subscribe to `background-tasks` (with group) and `background-tasks-result` (fan-out)
- `enqueue(payload)` — create task, check concurrency, dispatch or apply backpressure
- `dispatch(task)` — publish `task.dispatch` event
- `cancel(taskId)` — update status, publish `task.cancel` event
- `getTask(taskId)` — return from in-memory map
- `listTasks(filter)` — filter in-memory map
- `checkConcurrency(agentId)` — count running tasks
- `drainPending(agentId)` — dispatch pending tasks when slots open
- `executeWithTimeout(tool, args, timeoutMs)` — AbortController-based timeout
- `shutdown()` — unsubscribe, flush, let running tasks finish

**Worker subscriber logic:**

- Receive `task.dispatch` event
- Mark task as running
- Resolve tool reference + execute
- On success: mark completed, publish `task.completed`
- On failure: check retry policy, re-dispatch or publish `task.failed`
- Call `drainPending()` after completion

**Result listener logic:**

- Receive `task.completed` / `task.failed`
- Emit stream chunk (via a callback/hook — stream integration comes in 1.6)
- Invoke user callbacks (manager-level)

**Acceptance:**

- `enqueue()` dispatches a task that gets picked up by the worker subscriber
- Tool executes and result is published back
- Concurrency limits are enforced (tasks queue when at limit, drain when slots open)
- Timeout aborts the tool execution
- Retry re-dispatches on failure up to maxRetries
- Cancel sets status and prevents execution
- Unit tests for all of the above

---

### Task 1.5: In-loop dispatch — modify tool-call-step

Modify the tool call step to check if a tool should run in the background and dispatch via the manager instead of `await tool.execute()`.

**Files:**

- `packages/core/src/loop/workflows/agentic-execution/tool-call-step.ts` — Add background dispatch branch
- `packages/core/src/background-tasks/resolve-config.ts` — New file: `resolveBackgroundConfig()` function

**Changes to tool-call-step:**

- Before `tool.execute()`, call `resolveBackgroundConfig(toolCallArgs, toolConfig, agentConfig)`
- If `runInBackground` is true: call `backgroundTaskManager.enqueue(...)`, return placeholder result
- If false: existing `await tool.execute()` path unchanged
- Strip `_background` from args before either path

**resolveBackgroundConfig:**

- Resolution order: LLM override (`_background`) → agent config → tool config → default (foreground)
- Returns `{ runInBackground, timeoutMs, maxRetries }`

**Acceptance:**

- Tool with `background.enabled: true` gets dispatched to manager, placeholder returned to LLM
- Tool without background config runs synchronously as before
- LLM `_background: { enabled: false }` forces foreground on a background-eligible tool
- LLM `_background: { enabled: true, timeoutMs: X }` forces background with custom timeout
- Placeholder result includes task ID
- Integration test: agent with one background tool and one foreground tool, verify both work

---

### Task 1.6: Stream chunk emission for background task events

Wire the manager's result listener to emit background task stream chunks on the active agent stream.

**Files:**

- `packages/core/src/background-tasks/manager.ts` — Add stream chunk emission to result listener
- Stream chunk type definitions (from 1.3) registered in the chunk type union

**Chunks to emit:**

- `background-task-started` — emitted in `enqueue()` after dispatch
- `background-task-completed` — emitted in result listener on `task.completed`
- `background-task-failed` — emitted in result listener on `task.failed`

**Acceptance:**

- Streaming an agent with background tools produces `background-task-started` and `background-task-completed`/`background-task-failed` chunks in the `fullStream`
- Chunks contain taskId, toolName, toolCallId, and result/error

---

### Task 1.7: Result injection into message list

When a background task completes, inject the result into the agent's message list so the LLM sees it on the next turn.

**Files:**

- `packages/core/src/background-tasks/manager.ts` — Implement `injectResultIntoMessageList()`

**Behavior:**

- On `task.completed`: add a tool-result message to the thread's message list, matched to the original `toolCallId`
- On `task.failed`: add a tool-result message with the error as content
- Respect `messageHandling` config: `'final-only'` (default), `'all'`, or `'none'`

**Acceptance:**

- After background task completes, the next LLM call sees the tool result in its message context
- With `messageHandling: 'none'`, no message is persisted but the result is still available for the next turn
- Integration test: agent dispatches background task, user sends next message, LLM references the completed result

---

### Task 1.8: `_background` schema injection and system prompt generation

Automatically inject the `_background` field into tool schemas and generate the system prompt addition that tells the LLM about background capabilities.

**Files:**

- New file: `packages/core/src/background-tasks/schema-injection.ts` — Inject `_background` into tool input schemas
- New file: `packages/core/src/background-tasks/system-prompt.ts` — Generate the background task system prompt section

**Schema injection:**

- For each background-eligible tool, extend its `inputSchema` with an optional `_background` object
- Only inject when background tasks are enabled for the agent

**System prompt:**

- List which tools support background execution and their defaults
- Describe the `_background` override syntax
- Include guidelines for when to use background vs foreground

**Acceptance:**

- Tool schema visible to LLM includes `_background` field
- System prompt includes background task instructions
- LLM can produce tool calls with `_background` field that resolves correctly in 1.5

---

### Task 1.9: Register BackgroundTaskManager on Mastra instance

Wire the manager into the Mastra class so it's initialized with pubsub and made available to agents.

**Files:**

- `packages/core/src/mastra/index.ts` — Add `backgroundTasks` config option, create and init manager
- `packages/core/src/agent/agent.ts` — Accept manager via dependency injection, pass to tool execution context
- `packages/core/src/agent/types.ts` — Add `backgroundTasks` to agent config type

**Acceptance:**

- `new Mastra({ backgroundTasks: { ... } })` creates and initializes the manager
- Agents receive the manager and can dispatch background tasks
- Agent-level `backgroundTasks` config is respected

---

### Task 1.10: Tool-level and agent-level background config

Add the `background` field to tool definitions and `backgroundTasks` to agent config.

**Files:**

- `packages/core/src/tools/types.ts` — Add optional `background?: ToolBackgroundConfig` to tool definition type
- `packages/core/src/agent/types.ts` — Add optional `backgroundTasks?: AgentBackgroundConfig` to agent config type

**Acceptance:**

- `createTool({ ..., background: { enabled: true, timeoutMs: 600_000 } })` compiles and is respected
- `new Agent({ ..., backgroundTasks: { tools: { 'my-tool': true } } })` compiles and is respected
- Config resolution follows the priority chain (LLM → agent → tool → default)

---

## Sprint 2: Storage

Replace the in-memory `Map` with durable storage via the existing storage domain pattern. Add the query API, cancellation, and cleanup.

### Task 2.1: Define BackgroundTasksStorage domain base class

Create the abstract storage domain following the existing pattern.

**Files:**

- New file: `packages/core/src/storage/domains/background-tasks/base.ts`

**Abstract methods:**

- `createTask(task)` — insert a new task
- `updateTask(taskId, update)` — partial update (status, result, error, timestamps, retryCount, workerProof, version)
- `getTask(taskId)` — get by ID
- `listTasks(filter)` — query with TaskFilter (status, agentId, threadId, toolName, date ranges, ordering, pagination)
- `deleteTasks(filter)` — delete matching tasks (for cleanup)
- `getRunningCount()` — count tasks with `status = 'running'`
- `getRunningCountByAgent(agentId)` — count running tasks for a specific agent
- `init()` — create table/indexes if needed (overridden by concrete implementations)

**Acceptance:**

- Abstract class compiles
- Exported from storage domains

---

### Task 2.2: In-memory BackgroundTasksStorage implementation

For local development and testing — mirrors the in-memory pattern used by other storage domains.

**Files:**

- New file: `packages/core/src/storage/domains/background-tasks/inmemory.ts`

**Implementation:**

- Backed by `Map<string, BackgroundTask>`
- `listTasks` filters and sorts in-memory
- `getRunningCount` / `getRunningCountByAgent` filter by status

**Acceptance:**

- All abstract methods implemented
- Unit tests for create, update, get, list with filters, delete, running counts

---

### Task 2.3: PostgreSQL BackgroundTasksStorage implementation

Implement the storage domain for Postgres using the table schema from the design doc.

**Files:**

- Relevant Postgres storage adapter package (follow existing pattern for other domains)

**SQL:**

- `CREATE TABLE background_tasks (...)` — full schema with all columns
- Indexes: `idx_bg_tasks_status`, `idx_bg_tasks_agent_status`, `idx_bg_tasks_thread`, `idx_bg_tasks_tool_call`
- All queries use parameterized statements

**Key queries:**

- `createTask` → `INSERT INTO background_tasks (...) VALUES (...)`
- `updateTask` → `UPDATE background_tasks SET ... WHERE id = $1 AND version = $2` (optimistic concurrency)
- `getTask` → `SELECT * FROM background_tasks WHERE id = $1`
- `listTasks` → Dynamic `SELECT` with `WHERE` clauses built from TaskFilter, `ORDER BY`, `LIMIT`, `OFFSET`
- `deleteTasks` → `DELETE FROM background_tasks WHERE ...` built from TaskFilter
- `getRunningCount` → `SELECT COUNT(*) FROM background_tasks WHERE status = 'running'`
- `getRunningCountByAgent` → `SELECT COUNT(*) FROM background_tasks WHERE status = 'running' AND agent_id = $1`

**Acceptance:**

- Table created on `init()`
- All abstract methods implemented with proper SQL
- Optimistic concurrency: `updateTask` fails gracefully if version doesn't match
- Integration tests against a real Postgres instance

---

### Task 2.4: Wire storage into BackgroundTaskManager

Replace the in-memory `Map` in the manager with calls to the storage domain.

**Files:**

- `packages/core/src/background-tasks/manager.ts`

**Changes:**

- `enqueue()`: `this.storage.backgroundTasks.createTask(task)` instead of `this.tasks.set()`
- Worker subscriber: `this.storage.backgroundTasks.updateTask()` for status transitions
- `getTask()`: `this.storage.backgroundTasks.getTask()`
- `listTasks()`: `this.storage.backgroundTasks.listTasks()`
- `checkConcurrency()`: `this.storage.backgroundTasks.getRunningCount()` and `getRunningCountByAgent()`
- `drainPending()`: `this.storage.backgroundTasks.listTasks({ status: 'pending', orderBy: 'createdAt' })`
- Remove the in-memory `Map`

**Acceptance:**

- All existing Sprint 1 tests still pass (now backed by storage)
- Tasks survive manager restart (create manager, enqueue task, destroy manager, create new manager, `listTasks()` returns the task)

---

### Task 2.5: Cancellation

Implement task cancellation end-to-end.

**Files:**

- `packages/core/src/background-tasks/manager.ts` — `cancel()` method

**Behavior:**

- If task is `pending`: update status to `cancelled` in storage. It will never be dispatched.
- If task is `running`: update status to `cancelled` in storage, publish `task.cancel` event. The worker subscriber checks for cancellation and aborts the tool via `AbortController`.
- If task is already `completed`/`failed`/`cancelled`/`timed_out`: no-op or throw.

**Worker subscriber changes:**

- On receiving `task.cancel` event, abort the running tool's `AbortController`
- Need to track active `AbortController` instances by taskId

**Stream chunk:**

- Emit `background-task-failed` with a cancellation error when a running task is cancelled

**Acceptance:**

- Cancel a pending task → status is `cancelled`, never executes
- Cancel a running task → tool execution is aborted, status is `cancelled`
- Cancel a completed task → no-op or error
- Integration test: enqueue a slow tool, cancel it mid-execution, verify it stops

---

### Task 2.6: Cleanup

Implement periodic cleanup of old completed/failed task records.

**Files:**

- `packages/core/src/background-tasks/manager.ts` — Add cleanup logic

**Behavior:**

- On `init()`, start a `setInterval` that runs `cleanup()` every `cleanupIntervalMs` (default 60s)
- `cleanup()` calls `this.storage.backgroundTasks.deleteTasks({ status: ['completed', 'failed', 'cancelled', 'timed_out'], completedBefore: new Date(Date.now() - ttl) })`
- On `shutdown()`, clear the interval
- Expose `cleanup()` as a public method for manual invocation

**Acceptance:**

- Completed tasks older than `completedTtlMs` are deleted automatically
- Failed tasks older than `failedTtlMs` are deleted automatically
- Cleanup interval is configurable
- Manual `cleanup({ completedBefore: date })` works

---

### Task 2.7: Recovery on startup

When the manager starts, detect tasks that were left in `running` or `pending` state from a previous process and handle them.

**Files:**

- `packages/core/src/background-tasks/manager.ts` — Add recovery logic to `init()`

**Behavior:**

- On `init()`, query storage for tasks with `status = 'running'` (stale from previous process)
  - Mark as `failed` with error "Worker process terminated" (or re-dispatch if retries remain)
- Query for tasks with `status = 'pending'` that were never dispatched
  - Call `dispatch()` for each (respecting concurrency limits)

**Acceptance:**

- Tasks left as `running` from a crashed process are recovered
- Tasks left as `pending` are re-dispatched
- Concurrency limits still respected during recovery

---

### Task 2.8: Additional storage adapter implementations

Implement `BackgroundTasksStorage` for other existing storage adapters as needed.

**Files:**

- SQLite storage adapter
- LibSQL storage adapter
- Any other adapters that follow the existing domain pattern

**Acceptance:**

- Same test suite as Postgres passes for each adapter
- Table schema adapted for each database's dialect (e.g., `JSONB` → `JSON` for SQLite)

---

### Task 2.9: Register storage domain in composite store

Wire `BackgroundTasksStorage` into `MastraCompositeStore` so it's automatically available when storage is configured.

**Files:**

- `packages/core/src/storage/base.ts` — Add `backgroundTasks` to the domain resolution
- Relevant composite store files

**Acceptance:**

- `mastra.storage.backgroundTasks` is available when storage is configured
- `init()` cascade includes the new domain
- In-memory storage is the fallback when no persistent storage is configured
