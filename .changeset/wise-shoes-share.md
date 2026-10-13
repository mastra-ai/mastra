---
'@mastra/core': patch
---

Improved AgentController sessions so each thread restores its saved mode, model, state, token usage, and pending tool prompts when selected. Switching away and `detachFromCurrent()` cancel actively running local executions only for the initiating session. Listeners detach without cancelling the run. Parked runs and pending prompts remain available when switching back.

Fixed first-thread creation to retain explicit startup mode, model, and thinking selections. Later new conversations use controller defaults. Asynchronous state writes and resumed tools keep their source thread's preferences without changing another active conversation. Addressed resumes recover the originating agent after restart and support repeated suspensions while another thread stays active. The executing run saves token usage to its own thread and retains unsaved measurements for retry on the next step. Subscribers display saved totals without counting replayed steps again or saving usage. Storage-free sessions can still receive inactive wake signals. Custom state and permissions remain host-scoped.

Changed `session.thread.set()` and `session.thread.clear()` to throw during thread lifecycle transitions. Added address-based suspension APIs and event fields so callers can safely claim and resume a prompt after switching threads: `const claim = session.claimToolSuspension(toolCallId, runId)` returns an `address` that can be passed to `session.respondToToolSuspension({ address, resumeData })`. Exported `SuspensionAddress` and `getSuspensionAddressKey` for hosts that persist or key those addresses.

Deprecated the `SessionRecord.modeId`, `modelId`, `state`, and `pending` fields, the `HarnessStorage.appendPendingItem()`, `updatePendingItem()`, and `removePendingItem()` helpers, and `SessionSuspensions.resolveToolCallId()`.
