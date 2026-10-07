---
'@mastra/core': patch
---

Improved AgentController sessions so each thread restores its saved mode, model, state, token usage, and pending tool prompts when selected. Switching away no longer cancels parked runs, so pending prompts remain available when switching back, and `detachFromCurrent()` no longer aborts the detached run.

Changed `session.thread.set()` and `session.thread.clear()` to throw during thread lifecycle transitions. Added address-based suspension APIs and event fields so callers can safely claim and resume a prompt after switching threads: `const claim = session.claimToolSuspension(toolCallId, runId)` returns an `address` that can be passed to `session.respondToToolSuspension({ address, resumeData })`. Exported `SuspensionAddress` and `getSuspensionAddressKey` for hosts that persist or key those addresses.

Deprecated the `SessionRecord.modeId`, `modelId`, `state`, and `pending` fields, the `HarnessStorage.appendPendingItem()`, `updatePendingItem()`, and `removePendingItem()` helpers, and `SessionSuspensions.resolveToolCallId()`.
