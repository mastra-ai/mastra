---
'@mastra/libsql': minor
---

Add `ThreadStateLibSQL`, the LibSQL implementation of the new `ThreadStateStorage` domain. It persists per-thread, per-type state (e.g. the agent task list under `type: "task"`) in the `mastra_thread_state` table, keyed by `(threadId, type)`. Composing a LibSQL store wires this domain automatically, so an agent's task list now survives a process restart.
