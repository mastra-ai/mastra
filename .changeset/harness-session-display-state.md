---
'@mastra/core': minor
'mastracode': patch
---

Move the Harness display state onto `session.displayState`

The canonical display state a UI renders — `isRunning`, active tools, tool-input
buffers, pending approval/suspensions, active subagents, current message,
queued follow-ups, modified files, tasks, OM progress, and token usage — now
lives on the Session as `session.displayState`, alongside the reducer that keeps
it in sync with every Harness event.

`SessionDisplayState` owns:

- `get()` — a read-only snapshot to render from (replaces `harness.getDisplayState()`)
- `apply(event)` — the centralized state machine that folds each event into the snapshot
- `resetThread()` — reset thread-scoped fields on thread switch/create
- `restoreTasks(tasks)` — restore replayed task history without emitting an event
- `clearPendingSuspensions()` / `deletePendingSuspension(toolCallId)` — display mirror upkeep on abort/resume

Display state is inherently per-conversation, so in a shared (multi-user) host
it can't hang off the Harness — `harness.getDisplayState()` has no single answer
when one host serves many sessions. It reads from `harness.session.displayState`
instead.

The Harness stays the **event-bus owner**: `emit()` folds the event into
`session.displayState` and then dispatches to listeners (including the
`display_state_changed` fan-out). The reducer needs a few read-only host facts it
doesn't own — the live token-usage tally, the subagent display-name lookup
(Harness config), and the active thread id — which are injected into the Session
at construction.

Removed from the Harness public API (read through `harness.session.displayState.*`):

- `getDisplayState()` → `session.displayState.get()`
- `restoreDisplayTasks(tasks)` → `session.displayState.restoreTasks(tasks)`

`restoreTasks` is now a pure session-state mutation (it no longer emits
`display_state_changed`); the UI re-renders explicitly after a replay.
