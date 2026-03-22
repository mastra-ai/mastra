# Background Tasks: Implementation Approaches

This document outlines possible approaches for implementing background tasks in Mastra's agent system. Each approach has different trade-offs around complexity, scalability, and developer experience.

---

## Approach 1: In-Loop Dispatch with Placeholder Results

### Concept

Modify the existing tool call step to support a "fire-and-forget" mode. When a tool is marked as background-eligible, the tool call step dispatches it and immediately returns a placeholder result (e.g., `"Task dispatched, running in background. Task ID: abc123"`) to the LLM. The agentic loop continues without waiting.

A separate listener watches for task completion and injects results into the message list. On the next agentic loop iteration (or the next user turn), the LLM sees the completed result and can act on it.

### How It Fits

- **Minimal structural change**: The agentic execution workflow (`llmExecutionStep → toolCallStep → llmMappingStep`) stays the same. The change is inside the tool call step — instead of `await tool.execute()`, background tools get `dispatchAndReturnPlaceholder()`.
- **Message list as event bus**: Completed background tasks append their results to the message list, which the LLM reads on the next iteration.
- **Tool-level opt-in**: Tools declare `background: true` or the agent configuration specifies which tools can run in the background.

### Trade-offs

- **Simple to implement**: Requires changes mainly in `tool-call-step.ts` and the tool configuration types.
- **Limited to single-process**: Without an external queue, tasks only run within the current Node.js process. If the process dies, background tasks are lost.
- **Result timing is coarse**: Results arrive between loop iterations or user turns, not mid-generation.

---

## Approach 2: Event-Driven Background Task Manager

### Concept

Introduce a `BackgroundTaskManager` component that sits alongside the agentic loop. It manages a registry of running tasks, emits events on completion, and provides an API for the agent to query task status.

```
Agent Loop ←→ BackgroundTaskManager ←→ Task Executors
                     ↕
              Event Emitter / Callbacks
```

The agent loop dispatches tasks to the manager. The manager runs them (in-process or via a queue) and emits events. The agent loop subscribes to these events and can:

- Inject results into the stream as new chunks
- Append results to the conversation for the next turn
- Notify the user via a dedicated notification chunk type

### How It Fits

- **New component**: `BackgroundTaskManager` is a new class that the `Mastra` instance owns, similar to how it owns storage and memory.
- **Stream integration**: New chunk types (`background-task-started`, `background-task-progress`, `background-task-completed`, `background-task-failed`) emitted through the existing `ReadableStream`.
- **Task lifecycle**: The manager tracks task state (pending, running, completed, failed, cancelled) and supports querying and cancellation.

### Trade-offs

- **More flexible**: Supports progress updates, cancellation, and status queries.
- **More complex**: Requires a new component, event system, and stream chunk types.
- **Natural extension**: Follows the existing pattern of pluggable components (storage adapters, memory adapters) and could support different backends.

---

## Approach 3: Leveraging the Workflow Engine

### Concept

Mastra already has a workflow engine with step-based execution, suspension, and resumption. Background tasks could be modeled as workflow runs. When the agent wants to run something in the background, it creates a workflow run and continues. The workflow engine handles execution, persistence, and completion notification.

### How It Fits

- **Reuses existing infrastructure**: Workflows already support suspension/resumption, step tracking, and state persistence.
- **Natural persistence model**: Workflow state is already designed to be serializable and resumable, which solves the "process dies mid-task" problem.
- **Agent-workflow bridge**: The agent already integrates with workflows. This approach makes background tasks a specific usage pattern of that integration rather than a new system.

### Trade-offs

- **Overhead for simple tasks**: Wrapping a single tool call as a workflow adds ceremony. Best suited for complex, multi-step background work.
- **Workflow engine coupling**: Ties background task behavior to the workflow engine's capabilities and limitations.
- **Already proven pattern**: The suspend/resume mechanism in the current agent loop is workflow-based, so this is a natural extension.

---

## Approach 4: Job Queue with Pluggable Backends (Adapter Pattern)

### Concept

Introduce a job queue abstraction with pluggable backends, following the same adapter pattern used for storage and memory. The queue interface defines `enqueue`, `dequeue`, `getStatus`, and `onComplete`. Backends can be:

- **In-memory**: For local development and testing
- **Redis-backed**: For production environments needing persistence and distribution
- **Database-backed**: Using the existing storage adapter for persistence
- **Workflow-backed**: Delegating to the workflow engine (Approach 3 as a backend)

### How It Fits

- **Adapter pattern**: Follows the established Mastra pattern — define an interface, provide multiple implementations, configure at the `Mastra` instance level.
- **Scalable**: Production deployments can use Redis or similar for distributed task execution across multiple workers.
- **Configurable concurrency**: The queue manages how many tasks run simultaneously, preventing runaway parallelism (the "100,000 trees" problem from the spec).

### Trade-offs

- **Most complex to build**: Requires defining the queue interface, building multiple adapters, and handling distributed concerns (task claiming, failure recovery, retries).
- **Most production-ready**: Solves real scaling concerns that simpler approaches don't address.
- **Incremental adoption**: Can start with in-memory backend and add others later.

---

## Approach 5: Async Tool Results via Suspension/Resumption

### Concept

Use the existing suspend/resume mechanism as the backbone for background tasks. When a background tool is called:

1. The tool call step dispatches the task and then _suspends_ the agent loop (similar to tool approval suspension).
2. The conversation returns to the user with a "task running" status.
3. When the task completes, it triggers a _resume_ with the result as resume data.
4. The agent loop picks up where it left off, with the tool result now available.

The key difference from today's suspension: instead of waiting for user input to resume, the system automatically resumes when the background task completes. Multiple suspensions can be active simultaneously.

### How It Fits

- **Leverages existing mechanism**: Suspend/resume is already implemented with state serialization, message flushing, and run ID tracking.
- **State persistence built-in**: Suspended state is already saved to storage, so background tasks survive process restarts.
- **Familiar pattern**: Developers who understand tool approval suspension will understand background task suspension.

### Trade-offs

- **Conversation interruption model**: Each background task completion triggers a resume, which may interrupt the user's current interaction. Needs careful UX design.
- **Multiple concurrent suspensions**: The current model assumes one suspension point. Supporting multiple concurrent background tasks requires extending the suspension model.
- **Auto-resume complexity**: The system needs a way to automatically trigger resume when a task completes, which doesn't exist today.

---

## Cross-Cutting Concerns (All Approaches)

### Agent Awareness

The LLM needs to know which tools support background execution. Options:

- **Tool metadata**: Add a `background` field to tool definitions. The system prompt automatically includes "You can run tool X in the background."
- **Agent configuration**: Specify background-eligible tools at the agent level, separate from tool definitions.
- **LLM-decided**: Let the LLM choose whether to run a tool in the background based on context. The system prompt describes when background execution is appropriate.

### Result Delivery

When a background task completes, the result needs to reach the agent. Options:

- **Next-turn injection**: Results are added to the message list and visible on the next LLM call.
- **Stream notification**: A new chunk is emitted on the active stream, allowing real-time UI updates.
- **Callback/webhook**: An external notification mechanism for distributed setups.

### Concurrency Limits

Unbounded background tasks are dangerous. All approaches need:

- **Per-agent limits**: Maximum concurrent background tasks per agent instance.
- **Global limits**: Maximum across all agents in a Mastra instance.
- **Backpressure**: When limits are hit, either queue the task or fall back to synchronous execution.

### Message Handling

The spec identifies three options for how background task messages integrate with the conversation:

- **All messages**: Every intermediate message from the background task is added to the thread.
- **Final message only**: Only the final result is added.
- **Stream events**: Background task progress is streamed to the UI but not persisted as conversation messages.

### Error Handling

Background task failures need a defined path:

- **Retry policy**: Should failed tasks retry automatically?
- **Error surfacing**: How does the agent learn about failures? A special tool-result with error status? A system message?
- **Timeout**: Maximum duration before a background task is considered failed.

---

## Recommendation: Incremental Path

These approaches are not mutually exclusive. A pragmatic path forward:

1. **Start with Approach 1** (in-loop dispatch with placeholders) for the simplest viable implementation. This validates the concept with minimal architecture changes.
2. **Evolve to Approach 2** (event-driven manager) to add lifecycle management, progress updates, and cancellation.
3. **Add Approach 4** (pluggable backends) when scaling requirements emerge, starting with in-memory and adding Redis/database backends as needed.

Approach 3 (workflow engine) and Approach 5 (suspend/resume) can inform the design at each stage without being the primary implementation path — the workflow engine provides persistence patterns, and suspend/resume provides the state management model.
