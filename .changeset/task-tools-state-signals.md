---
'@mastra/core': minor
---

Make the task tools (`task_write`, `task_update`, `task_complete`, `task_check`) agent-agnostic.

The task tools no longer depend on the Harness request context. The task list is now held in a dedicated, thread-scoped **`tasks` storage domain** (`TasksStorage`) — the source of truth — and projected onto the agent **state-signal** lane (`stateId: "tasks"`) by the new `TaskStateProcessor`, so they work on any `Agent` and not only inside the Harness.

A new storage domain `tasks` is registered on `MastraStorage` (accessible via `storage.getStore("tasks")`). The composite store always wires an `InMemoryTasksStorage` by default, so task tracking works out of the box without configuring a backend. The tools read/write it synchronously within a run via `context.mastra.getStorage().getStore("tasks")`, scoped by the run's `threadId`.

The state-signal projection is cache-aware and observational-memory-aware:

- The task list is carried as a superseding state-signal snapshot instead of being injected into the cached system prompt, so task updates no longer invalidate the prompt-cache prefix.
- When observational-memory truncation drops the snapshot from the context window, `TaskStateProcessor` re-emits it (reading the durable `tasks` store) so the agent never loses track of its tasks.

The task tools and the processor require a memory-backed thread. On a run that is not memory backed (no `threadId`/`resourceId`), the task tools no-op and return a result explaining that task tracking requires agent memory.

New exports from `@mastra/core/storage`: `TasksStorage`, `InMemoryTasksStorage`, and the `TaskRecord` type. New exports from `@mastra/core/tools`: `taskWriteTool`, `taskUpdateTool`, `taskCompleteTool`, `taskCheckTool`, `TaskStateProcessor`, and the task helpers/types (`assignTaskIds`, `summarizeTaskCheck`, `TaskItem`, `TaskItemSnapshot`, `TaskCheckSummary`, `TaskCheckResult`, etc.). The Harness continues to re-export the task tools, so existing imports and toolset identity are unchanged.

Internal behavior change: the Harness no longer stores the task list in session state. Task mutations still emit the `task_updated` display event, so the Harness display snapshot and any pinned task UI are unaffected. To adopt the new behavior on a plain agent (with `Memory` and a Mastra `storage`), add `new TaskStateProcessor()` to the agent's `inputProcessors` alongside the task tools.
