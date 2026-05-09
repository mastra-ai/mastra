---
'@mastra/core': minor
---

Added stable IDs to Harness task items plus `task_update` and `task_complete` for updating or completing one tracked task by ID. Task tools now return structured task snapshots, and `task_check` returns `summary` and `incompleteTasks` fields so agents and UIs can restore and verify task state without parsing text.

Harness also exports `TaskItemSnapshot`, `assignTaskIds`, and `harness.restoreDisplayTasks()` for UI history replay, serializes task reads and mutations against the latest task state snapshot, and returns task-tool errors inside forked subagents so sidecar work cannot mutate parent task state.
