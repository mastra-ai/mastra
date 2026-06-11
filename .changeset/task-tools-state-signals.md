---
'@mastra/core': minor
---

Make the task tools (`task_write`, `task_update`, `task_complete`, `task_check`) agent-agnostic.

The task tools no longer depend on the Harness request context. The task list is now held in a generic, thread-scoped **`threadState` storage domain** (`ThreadStateStorage`) — the source of truth — and projected onto the agent **state-signal** lane (`stateId: "tasks"`) by the new `TaskStateProcessor`, so they work on any `Agent` and not only inside the Harness.

A new storage domain `threadState` is registered on `MastraStorage` (accessible via `storage.getStore("threadState")`). It is keyed by `(threadId, type)` so it can hold any per-thread state; the task list lives under `type: "task"` and the domain is intentionally generic so other agent-scoped state (e.g. `"goal"`) can reuse it. The composite store always wires an `InMemoryThreadStateStorage` by default, so task tracking works out of the box without configuring a backend, and a durable backend (`@mastra/libsql`'s `ThreadStateLibSQL`) persists the list across process restarts. The tools read/write it within a run via `context.mastra.getStorage().getStore("threadState")`, scoped by the run's `threadId`.

The state-signal projection is delta-first (modelled on working memory), cache-aware, and observational-memory-aware:

- The first projection of a populated list (and every compaction) is a full `<current-task-list>` **snapshot**; each later mutation emits a small `<task-list-update>` **delta** carrying only that turn's add/remove/update ops, so a large task list is not re-sent in full on every change.
- The task list is carried on the state-signal lane instead of being injected into the cached system prompt, so task updates no longer invalidate the prompt-cache prefix.
- The base snapshot and its deltas accumulate in the window; the processor re-snapshots once enough deltas accumulate (compaction) to bound window growth, and whenever observational-memory truncation drops the base snapshot from the window (deltas are meaningless without their base), reading the `threadState` store so the agent never loses track of its tasks.

The task tools and the processor require a memory-backed thread. On a run that is not memory backed (no `threadId`/`resourceId`), the task tools no-op and return a result explaining that task tracking requires agent memory.

For the simplest setup, register `TaskSignalProvider` via the agent's `signals` array — it bundles the task tools and the `TaskStateProcessor` so they cannot get out of sync:

```ts
import { Agent } from '@mastra/core/agent';
import { TaskSignalProvider } from '@mastra/core/signals';

const agent = new Agent({ name, instructions, model, memory, signals: [new TaskSignalProvider()] });
```

The Agent merges the tools into its toolset and registers the processor automatically.

New exports from `@mastra/core/storage`: `ThreadStateStorage`, `InMemoryThreadStateStorage`, and the `TaskRecord` type. New exports from `@mastra/core/tools`: `taskWriteTool`, `taskUpdateTool`, `taskCompleteTool`, `taskCheckTool`, `TaskStateProcessor`, and the task helpers/types (`assignTaskIds`, `summarizeTaskCheck`, `TaskItem`, `TaskItemSnapshot`, `TaskCheckSummary`, `TaskCheckResult`, etc.). New export from `@mastra/core/signals`: `TaskSignalProvider`, alongside the other signal providers. The Harness continues to re-export the task tools, so existing imports and toolset identity are unchanged.

Internal behavior change: the Harness no longer stores the task list in session state. Task mutations still emit the `task_updated` display event, so the Harness display snapshot and any pinned task UI are unaffected. To adopt the new behavior on a plain agent (with `Memory` and a Mastra `storage`), register `new TaskSignalProvider()` in `signals` — or, for manual control, add `new TaskStateProcessor()` to `inputProcessors` alongside the task tools.
