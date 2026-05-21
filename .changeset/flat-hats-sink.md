---
'mastracode': patch
---

Fixed pending GitHub PR notifications so they are delivered after the active response finishes instead of staying queued. GitHub PR notifications now treat `BLOCKED` merge state as an out-of-date or gated PR instead of a merge conflict, and existing persisted subscriptions no longer silently acknowledge a newly discovered real merge conflict during startup.
