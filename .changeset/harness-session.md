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

`Harness.abort()`, `setResourceId()`, `getCurrentMode()`, `getCurrentModeId()`, `hasPendingSuspensions()`, and `isCurrentThreadStreamActive()` remain on the Harness with unchanged behavior (they orchestrate or compose Harness-host state and delegate the relevant reads/writes to the session).
