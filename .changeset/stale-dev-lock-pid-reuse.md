---
'mastra': patch
---

Fixed `mastra dev` refusing to start with "Another development server instance is already running in this directory" when `.mastra/dev.lock` was left over from a previous run and its PID now belonged to an unrelated process, which commonly happens after `docker restart`. On Linux the lock now records when the owning process started, so a reused PID is recognised as a stale lock and replaced. Two dev servers running in the same directory are still rejected. The same check applies to `mastra build`'s guard against a running dev server, and the lock is now also removed when `mastra dev` is force-exited during shutdown.
