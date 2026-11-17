---
'@mastra/core': patch
---

A notification sent with `ifIdle: { behavior: 'persist' }` now stays persist-only when its delivery is deferred. The record stores the asked-for idle behavior alongside the existing routing requirement, and delayed deliveries — full, summarized, and retried — deliver with it instead of falling back to waking the idle thread. A summarized batch keeps the thread asleep only when every record in it asked to persist.
