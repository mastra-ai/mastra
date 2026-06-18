---
'@mastra/core': patch
'mastracode': patch
---

Move the thread data domain onto `Session.thread`

`SessionThread` now owns the thread reads/queries scoped to a session — `list`,
`getById`, `listMessages`, `listActiveMessages`, `firstUserMessage(s)`, and thread
settings (`getSetting`/`setSetting`/`deleteSetting`) — in addition to the
active-thread binding. It reaches the shared host storage through an injected
`ThreadDataStore` gateway (wired by the Harness via `session.thread.connect()`),
not by calling back into Harness orchestration.

This matches the multi-user model: the Harness is the shared host (storage, the
thread lock, the event bus, the agent registry) and each session leverages that
machinery to own its own thread state and reads. Lifecycle *transitions*
(create/switch/clone/delete) remain host machinery because they drive the shared
event bus and rebind the shared agent stream.

The public thread-data forwarders are removed from Harness — `listThreads`,
`listMessages`, `listMessagesForThread`, `getFirstUserMessage(s)ForThread(s)`,
`getThreadSetting`, and `setThreadSetting`. All consumers now read from
`harness.session.thread.*` directly. `createThreadDataStore()` is now `protected`
so `HarnessCompat` overrides it to merge Harness v1 sessions with legacy threads
inside the store (its old public `listThreads` override moved onto
`session.thread.list()`).
