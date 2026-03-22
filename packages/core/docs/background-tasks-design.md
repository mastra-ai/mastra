# Background Tasks: Detailed Design

This document describes the detailed design for background tasks. It combines the in-loop dispatch mechanism (how tools get sent to the background) with an event-driven task manager class that rides on the existing Mastra PubSub system for event distribution and the existing Storage system for task state persistence.

The key insight: Mastra already has a pluggable `PubSub` abstraction (with in-memory and Google Cloud backends) used by the workflow engine for event-driven execution. Background tasks use the same system rather than introducing a separate queue adapter, so whatever pubsub backend a user has configured for workflows automatically handles background task events too.

---

## Architecture Overview

```
                         ┌─────────────────────────────┐
                         │        Agent Loop            │
                         │                              │
                         │  llmExecutionStep            │
                         │       ↓                      │
                         │  toolCallStep ───────────────┼──── foreground tool → await execute()
                         │       │                      │
                         │       └── background tool ───┼──→ BackgroundTaskManager.enqueue()
                         │              ↓               │         │
                         │    placeholder result         │         ↓
                         │    returned to LLM            │    ┌─────────────────────────┐
                         │       ↓                      │    │ PubSub (mastra.pubsub)   │
                         │  llmMappingStep              │    │ ┌─────────────────────┐  │
                         │       ↓                      │    │ │ EventEmitter (dev)   │  │
                         │  isTaskCompleteStep          │    │ │ Google Cloud (prod)  │  │
                         │       ↓                      │    │ │ + queue groups       │  │
                         │  LLM continues...            │    │ └─────────────────────┘  │
                         └─────────────────────────────┘    └────────────┬──────────────┘
                                                                         │
                                                            publish 'background-tasks'
                                                                         │
                                                                         ↓
                         ┌─────────────────────────────┐    ┌────────────────────────┐
                         │    Result Delivery           │    │  Task Worker            │
                         │                              │    │  (subscribes to topic)  │
                         │  • Stream chunk emission     │←───│                         │
                         │  • Message list injection    │    │  tool.execute(args)     │
                         │  • Callback invocation       │    │         ↓               │
                         └─────────────────────────────┘    │  publish result event   │
                                                            └────────────────────────┘
```

There are three layers:

1. **In-loop dispatch** — The tool call step decides whether a tool runs foreground or background. Background tools get enqueued and a placeholder result is returned immediately so the loop continues.
2. **BackgroundTaskManager** — A class that orchestrates background tasks: enqueues via pubsub, tracks task lifecycle via storage, enforces concurrency limits, and delivers results back to the agent stream and message list.
3. **PubSub + Storage** — The existing Mastra `PubSub` handles event distribution (task dispatch, completion, failure). The existing `Storage` handles task state persistence. No new adapter pattern needed — you get the same pluggability that workflows already have.

---

## Layer 1: In-Loop Dispatch

### How a Tool Call Becomes a Background Task

Inside `tool-call-step.ts`, the current flow is:

```
const result = await tool.execute(args, toolOptions);
```

With background tasks, this becomes:

```
if (shouldRunInBackground(tool, agentConfig)) {
  const task = await backgroundTaskManager.enqueue({
    toolName,
    toolCallId,
    args,
    toolOptions,
    agentId,
    threadId,
    resourceId,
  });

  // Return placeholder immediately — loop does not block
  return {
    result: `Background task started. Task ID: ${task.id}. Status: pending.`,
    taskId: task.id,
    isBackgroundTask: true,
  };
} else {
  const result = await tool.execute(args, toolOptions);
  return { result };
}
```

### Determining Background Eligibility

A tool call runs in the background when **both** of these are true:

1. The tool is marked as background-eligible (via tool config or agent config).
2. The tool call is not in a state that requires synchronous handling (e.g., requires approval, has a suspend schema).

The resolution order for whether a tool runs in background:

```
1. LLM per-call override (_background field in tool args)    ← highest priority
2. Agent-level backgroundTools config
3. Tool-level background property
4. Default: foreground                                        ← lowest priority
```

### LLM Per-Call Override

The LLM can override the background config for any individual tool call. This is important because the same tool might need to run in the foreground in one context and the background in another. For example, a research tool might need to run in the foreground when the user is waiting for the answer, but in the background when the agent is kicking off multiple parallel research tasks.

**How the LLM communicates the override:**

When background tasks are enabled, every background-eligible tool gets an additional optional parameter injected into its schema — a `_background` object:

```typescript
// Automatically injected into the tool's input schema when background is enabled
_background?: {
  // Override whether this specific call runs in background or foreground
  // true = force background, false = force foreground, undefined = use default config
  enabled?: boolean;

  // Override timeout for this specific call
  timeoutMs?: number;

  // Override retry config for this specific call
  maxRetries?: number;
}
```

This is injected at the schema level (similar to how tool descriptions are augmented with context), so the LLM sees it as part of the tool's parameters and can choose to include it or not.

**Example — LLM decides to run in foreground despite background config:**

The tool is configured with `background.enabled: true`, but the user asks "What's the weather right now?" — the LLM knows the user is waiting for this specific answer, so it forces foreground:

```json
{
  "tool": "weather-lookup",
  "args": {
    "location": "San Francisco",
    "_background": { "enabled": false }
  }
}
```

**Example — LLM decides to run in background with a longer timeout:**

The agent is doing a multi-step research plan and kicks off a deep analysis. It overrides the default 5-minute timeout because it knows this one will take longer:

```json
{
  "tool": "deep-analysis",
  "args": {
    "topic": "market trends in renewable energy",
    "_background": { "enabled": true, "timeoutMs": 900000 }
  }
}
```

**Example — LLM uses default config (no override):**

When the LLM doesn't include `_background`, the tool falls back to the agent-level and tool-level config as normal:

```json
{
  "tool": "slow-research",
  "args": {
    "query": "history of quantum computing"
  }
}
```

**Resolution in the tool call step:**

```typescript
function resolveBackgroundConfig(
  toolCallArgs: Record<string, unknown>,
  toolConfig: ToolBackgroundConfig | undefined,
  agentConfig: AgentBackgroundConfig | undefined,
): { runInBackground: boolean; timeoutMs: number; maxRetries: number } {
  const llmOverride = toolCallArgs._background as LLMBackgroundOverride | undefined;

  // 1. LLM override takes priority for all fields it specifies
  const enabled = llmOverride?.enabled ?? agentConfig?.tools?.[toolName]?.enabled ?? toolConfig?.enabled ?? false;

  const timeoutMs =
    llmOverride?.timeoutMs ??
    agentConfig?.tools?.[toolName]?.timeoutMs ??
    toolConfig?.timeoutMs ??
    managerConfig.defaultTimeoutMs ??
    300_000;

  const maxRetries =
    llmOverride?.maxRetries ?? toolConfig?.retries?.maxRetries ?? managerConfig.defaultRetries?.maxRetries ?? 0;

  // Strip _background from args before passing to tool.execute()
  delete toolCallArgs._background;

  return { runInBackground: enabled, timeoutMs, maxRetries };
}
```

The `_background` field is stripped from the args before the tool executes — the tool itself never sees it. It's purely a communication channel between the LLM and the background task system.

### How the LLM Knows About Background Capability

When background tasks are enabled for an agent, a system prompt addition is injected that tells the LLM:

1. Which tools support background execution.
2. That it can include `_background` in tool call args to override behavior.
3. Guidelines for when to use background vs foreground.

```
You have the ability to run certain tools in the background while continuing
the conversation. The following tools support background execution:
- slow-research (default: background)
- deep-analysis (default: background)
- weather-lookup (default: foreground)

For any of these tools, you can include a "_background" field in the tool
arguments to override the default:
  "_background": { "enabled": true/false, "timeoutMs": number, "maxRetries": number }

Guidelines:
- Use background execution when the user doesn't need the result immediately,
  or when you're launching multiple independent tasks.
- Use foreground execution when the user is directly waiting for the result
  and the conversation can't continue without it.
- If you don't include "_background", the tool's default configuration is used.
```

This prompt is generated automatically from the tool and agent background configs — the developer doesn't write it.

### Placeholder Results

The placeholder returned to the LLM serves two purposes:

- It unblocks the agentic loop so the LLM can continue generating.
- It gives the LLM the task ID so it can reference the pending task in its response to the user (e.g., "I've started researching that topic — I'll let you know when it's done.").

The placeholder is a tool result like any other, so the existing `llmMappingStep` processes it normally. The LLM sees it as the tool's response and can decide what to say next.

---

## Layer 2: BackgroundTaskManager

The `BackgroundTaskManager` is a class that the `Mastra` instance owns. It is the single entry point for all background task operations. Instead of managing its own event system, it uses `mastra.pubsub` for event distribution and `mastra.storage` for task state persistence — the same infrastructure workflows already use.

### Responsibilities

- **Enqueue**: Persist task to storage, publish dispatch event via pubsub.
- **Lifecycle tracking**: Task state (pending → running → completed/failed/cancelled) persisted in storage.
- **Event distribution**: Publish state changes to pubsub topics. Subscribers (including the agent loop) react to events.
- **Concurrency enforcement**: Check running counts before dispatching. Apply backpressure when limits are hit.
- **Result delivery**: On completion event, stream a chunk to the UI and inject the result into the agent's message list.

### Class Shape

```typescript
class BackgroundTaskManager extends MastraBase {
  private pubsub: PubSub;        // mastra.pubsub — already configured
  private storage: Storage;       // mastra.storage — already configured
  private config: BackgroundTaskManagerConfig;

  constructor(config: BackgroundTaskManagerConfig) { ... }

  // Called by Mastra during initialization — wires up pubsub subscriptions
  async init(pubsub: PubSub, storage: Storage): Promise<void>

  // --- Core operations ---

  async enqueue(payload: TaskPayload): Promise<BackgroundTask>
  async cancel(taskId: string): Promise<void>
  async getTask(taskId: string): Promise<BackgroundTask | null>
  async listTasks(filter: TaskFilter): Promise<BackgroundTask[]>

  // --- Lifecycle ---

  async shutdown(): Promise<void> // Unsubscribe from topics, flush pubsub
}
```

### Task State Machine

```
  enqueue()       worker picks up       execute() resolves
 ─────────→ PENDING ──────────→ RUNNING ──────────────→ COMPLETED
                                   │
                                   ├── execute() rejects ──→ FAILED
                                   │
                                   ├── cancel() called ────→ CANCELLED
                                   │
                                   └── timeout exceeded ───→ TIMED_OUT
```

### Task Shape

```typescript
interface BackgroundTask {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timed_out';

  // What to execute
  toolName: string;
  toolCallId: string;
  args: Record<string, unknown>;

  // Context
  agentId: string;
  threadId?: string;
  resourceId?: string;

  // Result
  result?: unknown;
  error?: { message: string; stack?: string };

  // Timing
  createdAt: Date;
  startedAt?: Date;
  completedAt?: Date;

  // Metadata
  retryCount: number;
  maxRetries: number;
  timeoutMs: number;
}
```

### Registration with Mastra

The `BackgroundTaskManager` is configured on the `Mastra` instance. It receives `pubsub` and `storage` during initialization — no separate backend to configure:

```typescript
const mastra = new Mastra({
  agents: { myAgent },
  storage: myStorage,
  pubsub: new GoogleCloudPubSub({ projectId: '...' }), // or default EventEmitterPubSub
  backgroundTasks: {
    globalConcurrency: 10,
    perAgentConcurrency: 5,
    // ... other config (see Configuration section)
  },
});
```

During `Mastra` initialization, it passes its already-configured `pubsub` and `storage` to the `BackgroundTaskManager`:

```typescript
// Inside Mastra constructor (conceptual)
if (config.backgroundTasks) {
  this.#backgroundTaskManager = new BackgroundTaskManager(config.backgroundTasks);
  this.#backgroundTaskManager.init(this.#pubsub, this.#storage);
}
```

This means:

- If you're using `EventEmitterPubSub` (the default), background tasks work in-process with no extra infrastructure.
- If you've already configured Google Cloud PubSub for workflows, background tasks automatically use it too — gaining distributed dispatch across multiple workers.
- Task state (pending, running, completed) is persisted via whatever storage adapter is configured.

---

## Layer 3: PubSub + Storage (No Separate Backend Needed)

Instead of a dedicated queue adapter, background tasks ride on two systems Mastra already has:

1. **PubSub** — For event distribution (dispatching tasks, notifying completion/failure).
2. **Storage** — For task state persistence (tracking status, storing results).

This means the pluggability comes from the user's existing choice of pubsub and storage backends. No new adapter interface to define or implement.

### Extending PubSub With Queue Semantics

The current `PubSub` is pure fan-out: every subscriber gets every message. Background tasks need **work queue** semantics: multiple workers can subscribe, but each task is processed by exactly one worker.

The difference:

```
Fan-out (current pubsub):          Work queue (needed for background tasks):

  publish("topic", event)            publish("topic", event)
       │                                  │
       ├──→ subscriber A (gets it)        └──→ subscriber A (gets it)
       ├──→ subscriber B (gets it)             subscriber B (doesn't)
       └──→ subscriber C (gets it)             subscriber C (doesn't)
```

**The fix: add a `group` option to `subscribe()`.**

When multiple subscribers use the same group name, they form a competing consumer group — each message is delivered to only one subscriber in the group. This is the same concept as Kafka consumer groups or Google Cloud shared subscriptions.

```typescript
// Updated PubSub abstract class
abstract class PubSub {
  abstract publish(topic: string, event: Omit<Event, 'id' | 'createdAt'>): Promise<void>;

  abstract subscribe(
    topic: string,
    cb: (event: Event, ack?: () => Promise<void>) => void,
    options?: SubscribeOptions, // ← new optional parameter
  ): Promise<void>;

  abstract unsubscribe(topic: string, cb: (event: Event, ack?: () => Promise<void>) => void): Promise<void>;
  abstract flush(): Promise<void>;
}

interface SubscribeOptions {
  // When set, subscribers with the same group compete for messages.
  // Each message is delivered to exactly one subscriber in the group.
  // When not set, behaves as fan-out (current behavior — all subscribers get every message).
  group?: string;
}
```

**This is a backward-compatible change.** Existing `subscribe()` calls without `options` continue to work as fan-out. Only subscribers that opt into a group get competing-consumer behavior.

**How each backend implements it:**

**EventEmitterPubSub:**

```typescript
// Current: emitter.on(topic, cb) — every listener fires
// With groups: track group members, round-robin dispatch

class EventEmitterPubSub extends PubSub {
  private groups: Map<string, Map<string, Array<Function>>> = new Map();
  //                 topic → group → callbacks[]
  private groupCounters: Map<string, number> = new Map();

  async subscribe(topic, cb, options?) {
    if (options?.group) {
      // Register in group — only one callback per message
      const topicGroups = this.groups.get(topic) ?? new Map();
      const members = topicGroups.get(options.group) ?? [];
      members.push(cb);
      topicGroups.set(options.group, members);
      this.groups.set(topic, topicGroups);

      // Set up group listener if first member
      if (members.length === 1) {
        this.emitter.on(topic, event => {
          const members = this.groups.get(topic)?.get(options.group!) ?? [];
          if (members.length === 0) return;
          // Round-robin: pick next member
          const key = `${topic}:${options.group}`;
          const idx = (this.groupCounters.get(key) ?? 0) % members.length;
          this.groupCounters.set(key, idx + 1);
          members[idx](event);
        });
      }
    } else {
      // Fan-out (existing behavior)
      this.emitter.on(topic, cb);
    }
  }
}
```

In a single-process setup, there's typically only one worker subscriber, so round-robin is trivial. But this still matters for testing and for cases where multiple agents in the same process share a worker pool.

**Google Cloud PubSub:**

```typescript
// Current: subscription name = `${topic}-${instanceId}` (unique per process → fan-out)
// With groups: subscription name = `${topic}-${group}` (shared across processes → competing consumers)

async subscribe(topic, cb, options?) {
  const subscriptionName = options?.group
    ? `${topic}-${options.group}`      // Shared subscription → competing consumers
    : `${topic}-${this.instanceId}`;   // Unique subscription → fan-out (existing)

  const [sub] = await this.pubsub.topic(topic).createSubscription(subscriptionName, {
    enableMessageOrdering: true,
    enableExactlyOnceDelivery: true,  // Prevent double-processing
  });

  // ... rest of subscription setup (same as current)
}
```

This is the elegant part: Google Cloud PubSub already supports competing consumers natively. When multiple processes create subscriptions with the **same name**, Google Cloud distributes messages across them. The only change is using the group name instead of the instance ID in the subscription name.

### How Background Tasks Use Groups

The `BackgroundTaskManager` subscribes to the dispatch topic with a group:

```typescript
// Task worker subscription — uses a group so only one worker processes each task
await this.pubsub.subscribe('background-tasks', workerCallback, {
  group: 'background-task-workers',
});

// Result listener — uses fan-out (no group) so all processes receive results
// This is important: the process that enqueued the task needs to receive the result
// to stream it to the UI, even if a different process executed the task
await this.pubsub.subscribe('background-tasks-result', resultCallback);
```

This gives us:

- **Dispatch topic** (`background-tasks`): Competing consumers. Each task goes to exactly one worker.
- **Result topic** (`background-tasks-result`): Fan-out. Every process receives every result so the original enqueuer can deliver it to the UI.

### PubSub Topics

| Topic                     | Mode          | Purpose                   | Publisher                         | Subscriber                              |
| ------------------------- | ------------- | ------------------------- | --------------------------------- | --------------------------------------- |
| `background-tasks`        | Queue (group) | Dispatch tasks to workers | `BackgroundTaskManager.enqueue()` | Task worker (competing consumers)       |
| `background-tasks-result` | Fan-out       | Report completion/failure | Task worker (after execution)     | `BackgroundTaskManager` (all processes) |

### Storage Domain

Task state is persisted via a new storage domain (`BackgroundTasksStorage`), following the same domain pattern as `MemoryStorage`, `WorkflowsStorage`, etc.

#### Abstract Base

```typescript
abstract class BackgroundTasksStorage extends StorageDomain {
  abstract createTask(task: BackgroundTask): Promise<void>;
  abstract updateTask(taskId: string, update: Partial<BackgroundTask>): Promise<void>;
  abstract getTask(taskId: string): Promise<BackgroundTask | null>;
  abstract listTasks(filter: TaskFilter): Promise<BackgroundTask[]>;
  abstract deleteTasks(filter: TaskFilter): Promise<void>;
  abstract getRunningCountByAgent(agentId: string): Promise<number>;
  abstract getRunningCount(): Promise<number>;
}
```

#### Table Schema

```sql
CREATE TABLE background_tasks (
  -- Identity
  id              TEXT PRIMARY KEY,                -- Unique task ID (UUID)
  tool_call_id    TEXT NOT NULL,                   -- ID of the original tool call from the LLM
  tool_name       TEXT NOT NULL,                   -- Name of the tool being executed

  -- Execution context
  agent_id        TEXT NOT NULL,                   -- Agent that enqueued this task
  thread_id       TEXT,                            -- Thread the task was enqueued from (nullable for threadless agents)
  resource_id     TEXT,                            -- Resource/user identifier

  -- Status
  status          TEXT NOT NULL DEFAULT 'pending', -- pending | running | completed | failed | cancelled | timed_out

  -- Input / Output
  args            JSONB NOT NULL,                  -- Tool call arguments (as passed by the LLM)
  result          JSONB,                           -- Tool execution result (null until completed)
  error           JSONB,                           -- Error details on failure: { message, stack? }

  -- Retry
  retry_count     INTEGER NOT NULL DEFAULT 0,      -- How many times this task has been retried
  max_retries     INTEGER NOT NULL DEFAULT 0,      -- Maximum retry attempts allowed

  -- Timeout
  timeout_ms      INTEGER NOT NULL DEFAULT 300000, -- Timeout in milliseconds

  -- Worker tracking
  worker_id       TEXT,                            -- ID of the worker process that claimed this task (null if pending)

  -- Timestamps
  created_at      TIMESTAMP NOT NULL DEFAULT NOW(),  -- When the task was enqueued
  started_at      TIMESTAMP,                         -- When a worker started executing
  completed_at    TIMESTAMP,                         -- When execution finished (success, failure, or timeout)

  -- Concurrency control
  version         INTEGER NOT NULL DEFAULT 0       -- Optimistic concurrency: incremented on every update
);
```

#### Indexes

```sql
-- Query pending tasks for dispatch (ordered by creation time for FIFO)
CREATE INDEX idx_bg_tasks_status ON background_tasks (status, created_at);

-- Query running tasks per agent (for per-agent concurrency checks)
CREATE INDEX idx_bg_tasks_agent_status ON background_tasks (agent_id, status);

-- Look up tasks by thread (for API: "list background tasks for this conversation")
CREATE INDEX idx_bg_tasks_thread ON background_tasks (thread_id, created_at);

-- Look up tasks by tool call ID (for correlating with LLM tool calls)
CREATE INDEX idx_bg_tasks_tool_call ON background_tasks (tool_call_id);
```

#### Column Details

| Column                                       | Purpose                                                                                                                                                                                                             |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                                         | Unique task identifier. Returned to the LLM as part of the placeholder result so it can reference the task. Also used for `getTask()`, `cancel()` API calls.                                                        |
| `tool_call_id`                               | Links back to the original tool call in the LLM conversation. When the result is injected into the message list, it's matched to the tool call via this ID so the LLM sees it as the response to a tool it invoked. |
| `tool_name`                                  | Name of the tool. Used to resolve the tool reference when the worker picks up the task, and for filtering/display in APIs.                                                                                          |
| `agent_id`                                   | Which agent enqueued the task. Used for per-agent concurrency limits and scoping API queries.                                                                                                                       |
| `thread_id`                                  | The conversation thread. Used to inject results back into the correct message list. Also enables API queries like "list all background tasks for this thread."                                                      |
| `resource_id`                                | The user/resource identifier. Enables multi-tenant queries and ensures results go to the right user context.                                                                                                        |
| `status`                                     | Task lifecycle state. Transitions: `pending` → `running` → `completed` / `failed` / `cancelled` / `timed_out`. Used for concurrency counting (`SELECT COUNT(*) WHERE status = 'running'`).                          |
| `args`                                       | The serialized tool call arguments. Stored so the worker can execute the tool without needing the original call context.                                                                                            |
| `result`                                     | The serialized tool execution result. Stored on completion. Returned via `getTask()` API and injected into the message list.                                                                                        |
| `error`                                      | Error details on failure. Stored as `{ message, stack? }`. Surfaced via the `background-task-failed` stream chunk and `getTask()` API.                                                                              |
| `retry_count` / `max_retries`                | Track retry attempts. On failure, if `retry_count < max_retries`, the task is re-dispatched.                                                                                                                        |
| `timeout_ms`                                 | Per-task timeout. The worker sets an `AbortController` timer for this duration.                                                                                                                                     |
| `worker_id`                                  | Identifies which worker process claimed the task. Useful for debugging in multi-process setups and for stale task detection.                                                                                        |
| `created_at` / `started_at` / `completed_at` | Timestamps for observability, ordering (FIFO dispatch uses `created_at`), and cleanup (delete completed tasks older than TTL based on `completed_at`).                                                              |
| `version`                                    | Optimistic concurrency control. Incremented on every `UPDATE`. Prevents two workers from claiming the same task in multi-process setups (see concurrency control section).                                          |

#### Task Filter

Used by `listTasks()` and `deleteTasks()` to query and manage tasks:

```typescript
interface TaskFilter {
  status?: BackgroundTask['status'] | BackgroundTask['status'][];
  agentId?: string;
  threadId?: string;
  resourceId?: string;
  toolName?: string;
  createdBefore?: Date;
  createdAfter?: Date;
  completedBefore?: Date; // useful for cleanup: delete completed tasks older than X
  orderBy?: 'createdAt' | 'startedAt' | 'completedAt';
  orderDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}
```

#### API Use Cases Enabled by Storage

Because tasks are persisted with rich metadata, the storage enables several API patterns:

```typescript
// List all running background tasks for a thread (e.g., show in UI sidebar)
const running = await manager.listTasks({ threadId: 'thread-123', status: 'running' });

// List all tasks for an agent (e.g., admin dashboard)
const allTasks = await manager.listTasks({ agentId: 'research-agent', limit: 50 });

// Get a specific task's status and result (e.g., polling from client)
const task = await manager.getTask('task-abc-123');

// Cancel a running task (e.g., user clicks "cancel" in UI)
await manager.cancel('task-abc-123');

// List failed tasks for retry/debugging
const failed = await manager.listTasks({ status: 'failed', agentId: 'research-agent' });

// Cleanup: delete completed tasks older than 24 hours
await manager.cleanup({ completedBefore: new Date(Date.now() - 86_400_000) });
```

Every existing storage adapter (Postgres, SQLite, filesystem, etc.) implements this domain. Task state is durable by default — if the process restarts, pending and running tasks are still in the database.

### How It Scales With Your PubSub Choice

| PubSub Backend                   | What Happens                                                                                                                                      | Best For                                     |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| **EventEmitterPubSub** (default) | Tasks dispatched and consumed in the same process. Group subscription round-robins locally. No network overhead.                                  | Local dev, single-process apps               |
| **Google Cloud PubSub**          | Tasks published to a cloud topic. Shared subscription name distributes messages across workers. Exactly-once delivery prevents double-processing. | Multi-process production, horizontal scaling |

The key point: **the developer doesn't configure background task infrastructure separately**. If they've already set up Google Cloud PubSub for workflows, background tasks automatically use it too — gaining distributed dispatch across multiple workers. If they're using the default `EventEmitterPubSub`, background tasks work in-process with zero setup.

---

## Execution, Concurrency, and Persistence In Detail

This section walks through how the pubsub + storage approach handles the full lifecycle of a background task.

### The Full Flow

```
1. Agent loop calls manager.enqueue(taskPayload)
2. Manager assigns a task ID
3. Manager persists task to storage with status='pending'
4. Manager checks concurrency limits (query storage for running count)
   → Under limit: publish dispatch event to 'background-tasks' topic
   → At limit: task stays 'pending' in storage (backpressure applies)
5. Task worker (subscribed to 'background-tasks') receives event
6. Worker updates task status to 'running' in storage
7. Worker executes tool: tool.execute(args, toolOptions)
8. On completion: worker updates storage, publishes result to 'background-tasks-result'
9. Manager (subscribed to 'background-tasks-result') receives result
10. Manager streams chunk to UI + injects result into message list
11. On failure: worker updates storage, publishes failure, manager handles retry or notifies
```

### Enqueue

```typescript
// Inside BackgroundTaskManager

async enqueue(payload: TaskPayload): Promise<BackgroundTask> {
  const task: BackgroundTask = {
    id: generateId(),
    status: 'pending',
    toolName: payload.toolName,
    toolCallId: payload.toolCallId,
    args: payload.args,
    agentId: payload.agentId,
    threadId: payload.threadId,
    resourceId: payload.resourceId,
    retryCount: 0,
    maxRetries: payload.maxRetries ?? this.config.defaultRetries?.maxRetries ?? 0,
    timeoutMs: payload.timeoutMs ?? this.config.defaultTimeoutMs ?? 300_000,
    createdAt: new Date(),
  };

  // Persist to storage first — task is durable before we publish
  await this.storage.backgroundTasks.createTask(task);

  // Check concurrency before dispatching
  const canRun = await this.checkConcurrency(task.agentId);

  if (canRun) {
    await this.dispatch(task);
  } else {
    await this.applyBackpressure(task);
  }

  return task;
}

private async dispatch(task: BackgroundTask): Promise<void> {
  // Publish to the 'background-tasks' topic — a worker will pick this up
  await this.pubsub.publish('background-tasks', {
    type: 'task.dispatch',
    data: {
      taskId: task.id,
      toolName: task.toolName,
      toolCallId: task.toolCallId,
      args: task.args,
      agentId: task.agentId,
      threadId: task.threadId,
      resourceId: task.resourceId,
      timeoutMs: task.timeoutMs,
    },
    runId: task.id,
  });
}
```

### Task Worker (Subscriber)

The task worker subscribes to the `background-tasks` topic during `init()`. This is the code that actually runs tools:

```typescript
// Inside BackgroundTaskManager.init()

await this.pubsub.subscribe('background-tasks', async (event, ack) => {
  if (event.type !== 'task.dispatch') return;

  const { taskId, toolName, args, agentId, timeoutMs } = event.data;

  // Update status in storage
  await this.storage.backgroundTasks.updateTask(taskId, {
    status: 'running',
    startedAt: new Date(),
  });

  try {
    // Resolve the tool reference and execute
    const tool = this.resolveTool(toolName, agentId);
    const result = await this.executeWithTimeout(tool, args, timeoutMs);

    // Persist result
    await this.storage.backgroundTasks.updateTask(taskId, {
      status: 'completed',
      result,
      completedAt: new Date(),
    });

    // Publish completion — the manager's result listener will deliver it
    await this.pubsub.publish('background-tasks-result', {
      type: 'task.completed',
      data: { taskId, toolName, agentId, result },
      runId: taskId,
    });

    // Acknowledge the message (important for Google Cloud PubSub exactly-once delivery)
    await ack?.();

    // Drain: check storage for pending tasks that can now run
    await this.drainPending(agentId);
  } catch (error) {
    await this.storage.backgroundTasks.updateTask(taskId, {
      status: 'failed',
      error: { message: error.message, stack: error.stack },
      completedAt: new Date(),
    });

    // Check retry policy
    const task = await this.storage.backgroundTasks.getTask(taskId);
    if (task && task.retryCount < task.maxRetries) {
      await this.storage.backgroundTasks.updateTask(taskId, {
        status: 'pending',
        retryCount: task.retryCount + 1,
      });
      await this.dispatch(task);
    } else {
      await this.pubsub.publish('background-tasks-result', {
        type: 'task.failed',
        data: { taskId, toolName, agentId, error: { message: error.message } },
        runId: taskId,
      });
    }

    await ack?.();
    await this.drainPending(agentId);
  }
});
```

### Result Listener

A separate subscription on the `background-tasks-result` topic handles delivering results back to the agent:

```typescript
// Inside BackgroundTaskManager.init()

await this.pubsub.subscribe('background-tasks-result', async (event, ack) => {
  const { taskId, toolName, agentId } = event.data;

  if (event.type === 'task.completed') {
    // Stream chunk to the UI (if an active stream exists for this agent/thread)
    this.emitStreamChunk(agentId, {
      type: 'background-task-completed',
      payload: { taskId, toolName, toolCallId: event.data.toolCallId, result: event.data.result },
    });

    // Inject into message list so the LLM sees it on next turn
    await this.injectResultIntoMessageList(agentId, event.data);

    // Invoke optional callbacks (manager → agent → tool level)
    await this.config.onTaskComplete?.(await this.getTask(taskId));
  }

  if (event.type === 'task.failed') {
    this.emitStreamChunk(agentId, {
      type: 'background-task-failed',
      payload: { taskId, toolName, toolCallId: event.data.toolCallId, error: event.data.error },
    });

    await this.config.onTaskFailed?.(await this.getTask(taskId));
  }

  await ack?.();
});
```

### Concurrency Control

Concurrency is enforced by querying storage — the source of truth for task state:

```typescript
private async checkConcurrency(agentId: string): Promise<boolean> {
  const runningTasks = await this.storage.backgroundTasks.listTasks({ status: 'running' });

  // Check global limit
  if (runningTasks.length >= this.config.globalConcurrency) {
    return false;
  }

  // Check per-agent limit
  const agentRunning = runningTasks.filter(t => t.agentId === agentId);
  if (agentRunning.length >= this.config.perAgentConcurrency) {
    return false;
  }

  return true;
}
```

When a task completes, `drainPending` checks if any queued tasks can now be dispatched:

```typescript
private async drainPending(agentId: string): Promise<void> {
  // Find pending tasks that could run now
  const pendingTasks = await this.storage.backgroundTasks.listTasks({
    status: 'pending',
    orderBy: 'createdAt',
    limit: this.config.globalConcurrency, // don't fetch more than we could possibly run
  });

  for (const task of pendingTasks) {
    const canRun = await this.checkConcurrency(task.agentId);
    if (canRun) {
      await this.dispatch(task);
    }
  }
}
```

**Why storage instead of in-memory counters?** Because in a multi-process setup (Google Cloud PubSub), multiple workers share the same storage. Each worker can query the real running count across all processes. In-memory counters would only reflect the local process.

### How It Behaves With Different PubSub Backends

**EventEmitterPubSub (default — single process):**

```
1. enqueue() → storage.createTask(task)
2. pubsub.publish('background-tasks', event)
   → EventEmitter.emit() triggers subscriber callback synchronously in same process
3. Subscriber runs tool.execute() — executes as a Promise in the current event loop
4. On resolve → storage.updateTask(), pubsub.publish('background-tasks-result', ...)
   → EventEmitter.emit() triggers result listener synchronously
5. Result listener streams chunk + injects into message list
```

Total overhead: ~0ms for pubsub (direct function call), storage query time for persistence.
Effectively identical to the old "in-memory backend" behavior but with durable task state.

**Google Cloud PubSub (multi-process):**

```
1. enqueue() → storage.createTask(task)
2. pubsub.publish('background-tasks', event)
   → Message published to Google Cloud topic
3. Worker process B (subscribed with group: 'background-task-workers') receives message
   → Shared subscription name → Google Cloud distributes to one worker only
   → Exactly-once delivery ensures no double-execution
4. Worker B runs tool.execute() in its own process
5. On resolve → storage.updateTask(), pubsub.publish('background-tasks-result', ...)
   → Result published to result topic (fan-out, no group)
6. Process A (the original enqueuer, subscribed to results) receives result
7. Process A streams chunk + injects into message list
8. Worker B calls ack() → Google Cloud marks message as processed
```

Total overhead: ~50-200ms for Google Cloud message delivery (network round trip).
Key advantage: tasks execute on any worker process. The original process doesn't need to be the one running the tool.

### Persistence via Storage

Task state is always persisted in storage, regardless of pubsub backend. See the [Storage Domain](#storage-domain) section for the full table schema, column details, indexes, and query patterns.

Key guarantees:

- **Every task is durable** from the moment it's enqueued, even with `EventEmitterPubSub`.
- **Querying task status** (`getTask`, `listTasks`) always works, regardless of whether pubsub delivered the events.
- **Concurrency checks** query storage for the real count of running tasks across all processes.
- **Recovery on restart**: if the process crashes, pending tasks are still in storage. On startup, the manager can query for pending tasks and re-dispatch them.
- **API access**: Tasks can be listed, filtered, and cancelled via the `BackgroundTaskManager` API, enabling UI dashboards, admin tools, and user-facing task status.

### Timeout Handling

```typescript
private async executeWithTimeout(
  tool: MastraTool,
  args: Record<string, unknown>,
  timeoutMs: number,
): Promise<unknown> {
  const abortController = new AbortController();

  const timeoutHandle = setTimeout(() => {
    abortController.abort(new Error(`Background task timed out after ${timeoutMs}ms`));
  }, timeoutMs);

  try {
    return await tool.execute(args, {
      abortSignal: abortController.signal,
    });
  } finally {
    clearTimeout(timeoutHandle);
  }
}
```

The `AbortController` signal is passed to the tool so it can clean up resources on timeout. The caller catches the abort error and marks the task as `timed_out`.

---

## Configuration

### Manager-Level Configuration

Passed when creating the `BackgroundTaskManager` (or via the `Mastra` constructor):

```typescript
interface BackgroundTaskManagerConfig {
  // No 'backend' field — uses mastra.pubsub and mastra.storage automatically

  // Global concurrency limit across all agents
  // Maximum number of tasks that can be in 'running' state simultaneously
  // Default: 10
  globalConcurrency?: number;

  // Per-agent concurrency limit
  // Maximum running tasks for a single agent
  // Default: 5
  perAgentConcurrency?: number;

  // What happens when concurrency limit is reached
  // 'queue': task waits in pending state until a slot opens (default)
  // 'reject': enqueue() throws an error
  // 'fallback-sync': tool executes synchronously in the agentic loop instead
  backpressure?: 'queue' | 'reject' | 'fallback-sync';

  // Default timeout for tasks (overridable per-tool)
  // Default: 300_000 (5 minutes)
  defaultTimeoutMs?: number;

  // Default retry configuration
  defaultRetries?: RetryConfig;

  // How completed/failed task records are cleaned up
  cleanup?: CleanupConfig;

  // Optional callbacks invoked when tasks complete or fail
  // These run in addition to the default behavior (stream chunk + message list injection)
  onTaskComplete?: (task: BackgroundTask) => void | Promise<void>;
  onTaskFailed?: (task: BackgroundTask) => void | Promise<void>;

  // What gets persisted to the thread's message history
  // 'all': all intermediate messages from the background execution are saved
  // 'final-only': only the final result is saved as a tool-result message (default)
  // 'none': nothing is persisted — result is ephemeral (still streamed, just not saved)
  messageHandling?: 'all' | 'final-only' | 'none';
}
```

### Retry Configuration

```typescript
interface RetryConfig {
  // Maximum retry attempts
  // Default: 0 (no retries)
  maxRetries?: number;

  // Delay between retries in ms
  // Default: 1000
  retryDelayMs?: number;

  // Backoff multiplier applied to retryDelayMs on each attempt
  // Default: 2 (exponential backoff)
  backoffMultiplier?: number;

  // Maximum delay between retries regardless of backoff
  // Default: 30_000 (30 seconds)
  maxRetryDelayMs?: number;

  // Which errors should be retried
  // Default: all errors
  retryableErrors?: (error: Error) => boolean;
}
```

### Cleanup Configuration

```typescript
interface CleanupConfig {
  // How long to keep completed task records
  // Default: 3_600_000 (1 hour)
  completedTtlMs?: number;

  // How long to keep failed task records
  // Default: 86_400_000 (24 hours)
  failedTtlMs?: number;

  // How often the cleanup process runs
  // Default: 60_000 (1 minute)
  cleanupIntervalMs?: number;
}
```

### Result Delivery

Result delivery is not a mode — it always does two things:

1. **Stream a chunk** — A `background-task-completed` (or `background-task-failed`) chunk is emitted on the active stream so the UI can react in real time.
2. **Inject into the message list** — The result is added to the thread's message list so the LLM sees it on the next agentic loop turn and can reason about it.

Both always happen. This means the UI gets immediate feedback and the agent is always aware of completed work.

**Optional callbacks** can be provided on top for custom handling (e.g., sending a notification, triggering another workflow, logging). These are additive — they don't replace the default behavior.

```typescript
// On the manager config:
onTaskComplete?: (task: BackgroundTask) => void | Promise<void>;
onTaskFailed?: (task: BackgroundTask) => void | Promise<void>;
```

**Message handling** controls what gets persisted to thread history:

```typescript
messageHandling?: 'all' | 'final-only' | 'none';
// 'all': all intermediate messages from the background execution are saved
// 'final-only': only the final result is saved as a tool-result message (default)
// 'none': result is streamed and visible to the LLM on next turn, but not persisted to thread history
```

### Tool-Level Configuration

Individual tools can declare their background task behavior:

```typescript
const myTool = createTool({
  id: 'slow-research',
  description: 'Researches a topic (takes a while)',
  inputSchema: z.object({ query: z.string() }),
  execute: async ({ query }) => { /* ... */ },

  // Background task configuration for this tool
  background: {
    // Whether this tool is eligible for background execution
    // Default: false
    enabled: true,

    // Override the manager's default timeout for this tool
    timeoutMs: 600_000, // 10 minutes

    // Override retry config for this tool
    retries: { maxRetries: 2 },

    // Override what gets persisted to thread history for this tool
    messageHandling: 'final-only',

    // Optional per-tool callbacks (run in addition to manager-level callbacks)
    onComplete?: (task: BackgroundTask) => void | Promise<void>,
    onFailed?: (task: BackgroundTask) => void | Promise<void>,
  },
});
```

### Agent-Level Configuration

Agents can configure background task behavior for their tools:

```typescript
const myAgent = new Agent({
  id: 'research-agent',
  model: openai('gpt-4o'),
  tools: { slowResearch, quickLookup },

  // Background task configuration at the agent level
  backgroundTasks: {
    // Which tools should run in the background
    // Overrides tool-level config
    tools: {
      'slow-research': true, // use tool's own background config
      'quick-lookup': false, // always foreground, even if tool says background
      'agent-analyst': {
        // override specific settings
        enabled: true,
        timeoutMs: 900_000,
      },
    },

    // Or shorthand: run all background-eligible tools in background
    // tools: 'all',

    // Per-agent concurrency override
    concurrency: 3,

    // Per-agent message handling override
    messageHandling: 'final-only',

    // Per-agent callbacks (run in addition to manager-level callbacks)
    onTaskComplete: task => console.log(`Agent task done: ${task.id}`),
    onTaskFailed: task => console.error(`Agent task failed: ${task.id}`),
  },
});
```

---

## Event and Stream Integration

### New Stream Chunk Types

Background tasks emit chunks through the existing streaming infrastructure:

```typescript
// Emitted when a task is enqueued
interface BackgroundTaskStartedChunk {
  type: 'background-task-started';
  payload: {
    taskId: string;
    toolName: string;
    toolCallId: string;
  };
}

// Always emitted when a task completes
interface BackgroundTaskCompletedChunk {
  type: 'background-task-completed';
  payload: {
    taskId: string;
    toolName: string;
    toolCallId: string;
    result: unknown;
  };
}

// Emitted when a task fails
interface BackgroundTaskFailedChunk {
  type: 'background-task-failed';
  payload: {
    taskId: string;
    toolName: string;
    toolCallId: string;
    error: { message: string };
  };
}

// Optional: emitted for progress updates
interface BackgroundTaskProgressChunk {
  type: 'background-task-progress';
  payload: {
    taskId: string;
    toolName: string;
    progress: unknown; // tool-defined progress shape
  };
}
```

These chunks allow UIs to:

- Show a "task started" indicator when `background-task-started` arrives.
- Update the UI in real time when `background-task-completed` or `background-task-failed` arrives.
- Display progress bars or status updates via `background-task-progress`.

### Event Flow via PubSub

All background task events flow through `mastra.pubsub`, following the same subscribe-before-publish pattern used by workflows:

```
BackgroundTaskManager
  ├── publishes to 'background-tasks':
  │     type: 'task.dispatch'     → new task ready for execution
  │     type: 'task.cancel'       → cancellation request
  │
  ├── publishes to 'background-tasks-result':
  │     type: 'task.completed'    → task finished successfully
  │     type: 'task.failed'       → task errored or timed out
  │     type: 'task.progress'     → tool reported progress
  │
  ├── subscribes to 'background-tasks':
  │     → task worker picks up dispatch events and executes tools
  │
  └── subscribes to 'background-tasks-result':
        → result listener streams chunks to UI + injects into message list
        → invokes optional callbacks (manager-level, agent-level, tool-level)
```

This means:

- With `EventEmitterPubSub`, publish/subscribe is a direct function call in the same process.
- With Google Cloud PubSub, events are distributed across processes with ordering and exactly-once delivery.
- With Google Cloud PubSub, events are distributed across processes via shared subscriptions.

The developer doesn't interact with these topics directly — the `BackgroundTaskManager` handles all subscriptions internally during `init()`.

---

## Concurrency Control

### How Limits Are Enforced

```
enqueue() called
    ↓
Check global running count < globalConcurrency?
    ↓ no                          ↓ yes
Check per-agent running count     ↓
  < perAgentConcurrency?          ↓
    ↓ no                          ↓ yes
Apply backpressure policy         Start task immediately
  ├── 'queue': stay pending       (status → running)
  ├── 'reject': throw error
  └── 'fallback-sync': return
       signal to run in-loop
```

The `'fallback-sync'` backpressure mode is important: it means the system gracefully degrades to the current blocking behavior when the queue is saturated, rather than failing or making the user wait for a queue slot.

---

## Shutdown

When `BackgroundTaskManager.shutdown()` is called:

1. Stop accepting new tasks (`enqueue()` throws).
2. Unsubscribe from pubsub topics.
3. Flush pubsub to ensure all pending acknowledgments are delivered.
4. Running tasks continue to completion — they are not cancelled. The tool execution promises run to natural resolution even after the manager stops accepting new work.
5. Pending tasks remain in storage. On next startup, the manager can query for pending tasks and re-dispatch them.

---

## Full Configuration Example

**Local development (zero config):**

```typescript
import { Mastra } from '@mastra/core';

const mastra = new Mastra({
  agents: { researchAgent, deployAgent },
  storage: myStorage,
  // pubsub defaults to EventEmitterPubSub — no extra setup

  backgroundTasks: {
    globalConcurrency: 10,
    perAgentConcurrency: 5,
    messageHandling: 'final-only',
  },
});
```

**Production with Google Cloud PubSub (distributed):**

```typescript
import { Mastra } from '@mastra/core';
import { GoogleCloudPubSub } from '@mastra/google-cloud-pubsub';
import { PostgresStore } from '@mastra/pg';

const mastra = new Mastra({
  agents: { researchAgent, deployAgent },
  storage: new PostgresStore({ connectionString: process.env.DATABASE_URL }),
  pubsub: new GoogleCloudPubSub({ projectId: 'my-project' }),

  backgroundTasks: {
    globalConcurrency: 20,
    perAgentConcurrency: 5,
    backpressure: 'queue',
    defaultTimeoutMs: 300_000,

    defaultRetries: {
      maxRetries: 1,
      retryDelayMs: 2_000,
      backoffMultiplier: 2,
    },

    cleanup: {
      completedTtlMs: 3_600_000,
      failedTtlMs: 86_400_000,
    },

    messageHandling: 'final-only',

    // Optional callbacks (in addition to stream + message list injection)
    onTaskComplete: task => {
      console.log(`Task ${task.id} completed: ${task.toolName}`);
    },
    onTaskFailed: task => {
      console.error(`Task ${task.id} failed: ${task.error?.message}`);
    },
  },
});
```

The only difference between local and production is swapping `pubsub` and `storage` — the `backgroundTasks` config stays the same. Background tasks automatically inherit the infrastructure you've already set up for workflows.
