---
'@mastra/core': minor
'mastracode': patch
---

Introduce the Harness `Session`: the Harness now exposes `harness.session`, a class that owns the per-conversation runtime state that previously lived flattened on the Harness instance. The Harness remains the shared host (storage, the thread lock, the agent registry, the event bus); the Session owns the state scoped to a single user's conversation.

`harness.session` owns:

- **`session.identity`** — the session's `resourceId` / `defaultResourceId` (the stable "who").
- **`session.thread`** — the active thread binding (`getId` / `set` / `clear` / `isSet` / `requireId`) plus the thread data domain scoped to the session: `list`, `getById`, `listMessages`, `listActiveMessages`, `firstUserMessage(s)`, and thread settings (`getSetting` / `setSetting` / `deleteSetting`). It reaches shared-host storage through an injected gateway rather than calling back into Harness orchestration.
- **`session.mode`** / **`session.model`** — the currently-selected mode and model (source of truth), the mode-switch sequence, and per-mode model memory. The Harness still owns the mode *definitions* (`config.modes`).
- **`session.run`** — transient per-run identity (run id, trace id, operation counter) and abort control (controller, `isRunning`, `requestAbort`, …). Never persisted.
- **`session.stream`** — the live agent-thread subscription handle and its dedup key. Adds `session.getCurrentRunId()` and `session.abortRun()`, which compose the subscription.
- **`session.suspensions`** — the parked-tool resume map (`toolCallId → { runId, toolName }`) for tools paused via the native suspension primitive (`ask_user` / `request_access` / `submit_plan`).
- **`session.followUps`** — the queue of messages to send after the active run finishes.
- **`session.approval`** — the interactive tool-approval gate; `session.respondToToolApproval({ decision, requestContext })` applies the user's approve / decline / always-allow choice and releases the run.
- session-scoped permission grants and the live token-usage counter (the Harness still persists usage to thread metadata, since usage is thread-scoped).

**Removed from the Harness public API** — read these through `harness.session.*` instead:

- `getSessionGrants()`, `getTokenUsage()` → `session.getGrants()` / `session.getTokenUsage()`
- `getCurrentModelId()`, `hasModelSelected()` → `session.model.get()` / `session.model.hasSelection()`
- `getCurrentRunId()`, `getCurrentTraceId()`, `isRunning()` → `session.getCurrentRunId()` / `session.run.getTraceId()` / `session.run.isRunning()`
- `getCurrentThreadId()`, `getThreads()`, `listThreads()`, `listMessages()`, `listMessagesForThread()`, `getFirstUserMessage(s)ForThread(s)()`, `getThreadSetting()`, `setThreadSetting()` → `session.thread.*`
- `getResourceId()`, `getDefaultResourceId()` → `session.identity.*`
- `getFollowUpCount()` → `session.followUps.count()`
- `respondToToolApproval()` → `session.respondToToolApproval()`
- `getCurrentModeId()` → `session.mode.get()`
- `getCurrentMode()` → `session.mode.resolve()` (resolves the selected mode id against the host's `config.modes` catalog, injected into the Session)
- `hasPendingSuspensions()` → `session.suspensions.hasPending()`
- `isCurrentThreadStreamActive()` → `session.stream.isActive()`

`Harness.abort()` and `setResourceId()` remain on the Harness with unchanged behavior — they orchestrate Harness-host state (the display-state mirror, the agent-stream subscription, thread teardown) before delegating the relevant reads/writes to the session.

`session.mode` exposes two complementary accessors: `get()` returns the selected mode **id** (a `string`, mirroring `session.model.get()`), while `resolve()` returns the full `HarnessMode` definition by looking the id up in the injected mode catalog.

The legacy `HarnessCompat` shim (v1-session/legacy-thread merge) has been removed; its thread-list merge now lives in the Session's thread-data store, so `session.thread.list()` returns the merged result directly.

`session.abortRun()` now also releases a parked tool-approval gate: a run awaiting `session.approval.arm()` is not actively streaming, so aborting resolves the gate as a decline (rejecting the gated tool) instead of leaving the await hung. Mirrors how abort already drops parked tool suspensions.
