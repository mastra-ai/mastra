---
'@mastra/core': minor
---

Harness v1: bridge `data-task-updated` writer chunks into typed `task_updated` events. The built-in `taskWrite` tool publishes a `data-task-updated` chunk via `ctx.writer?.custom(...)` after persisting tasks to thread metadata; inside a Session, the drain loop translates that into a `task_updated` event so subscribers can react to task-list changes without parsing raw chunks. Outside Harness, the same chunk surfaces on the agent's `fullStream` directly.
