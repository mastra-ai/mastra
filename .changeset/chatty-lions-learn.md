---
'@mastra/core': patch
---

Fixed session-deleted listeners missing their notification when a session teardown failed while releasing its thread lock. The controller deregisters the session either way, so `onSessionDeleted` now always fires and listeners no longer hold on to a dead session.
