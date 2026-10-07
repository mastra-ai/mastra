---
'@mastra/core': patch
---

Improved AgentController sessions so each thread restores its saved mode, model, state, token usage, and pending tool prompts when selected. Switching away no longer cancels parked runs, so pending prompts remain available when switching back, and `detachFromCurrent()` no longer aborts the detached run.

Changed `session.thread.set()` and `session.thread.clear()` to throw during thread lifecycle transitions. Deprecated the `SessionRecord.modeId`, `modelId`, `state`, and `pending` fields and the `HarnessStorage.appendPendingItem()`, `updatePendingItem()`, and `removePendingItem()` helpers.
