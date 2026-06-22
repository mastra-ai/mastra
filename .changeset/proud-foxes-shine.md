---
'@mastra/core': minor
'mastracode': patch
---

Move the thread lifecycle onto `session.thread`. Creating, switching, cloning, renaming, and deleting a thread — plus loading a thread's persisted settings and managing the agent subscription — now live on the session's thread domain (`session.thread.create/switch/clone/rename/delete/loadMetadata/ensureSubscription/detachFromCurrent`). The host's storage, thread lock, and clone primitives are injected behind an expanded `ThreadDataStore` gateway, so `SessionThread` owns the full lifecycle while the Harness owns only the DB.

Breaking (Harness is under development): the Harness no longer exposes `createThread`, `switchThread`, `cloneThread`, `renameThread`, `detachFromCurrentThread`, or the `memory` accessor. Use `harness.session.thread.*` instead — e.g. `harness.session.thread.create()`, `harness.session.thread.switch({ threadId })`, `harness.session.thread.delete({ threadId })`.
