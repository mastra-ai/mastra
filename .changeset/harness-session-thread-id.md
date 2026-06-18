---
'@mastra/core': patch
'mastracode': patch
---

Move the session's active thread binding onto `Session.thread`

The active thread id no longer lives on `SessionIdentity` (which now owns only
`resourceId`/`defaultResourceId` — the stable "who"). A dedicated `SessionThread`
owns the navigational "where": `session.thread.getId()` / `set({ threadId })` /
`clear()` / `isSet()` / `requireId()`.

In the multi-user model each session has its own current thread while the Harness
host shares storage, the thread lock, and the event bus — so the thread binding is
per-session state and lives on the session, not the host.

`Harness.getCurrentThreadId()` is removed; consumers read
`harness.session.thread.getId()`. All mastracode production sites, e2e scenarios,
and test mocks are migrated; `HarnessCompat` delegates to the session.
