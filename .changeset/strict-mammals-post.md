---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
---

Session streams opened with `displayState=false` now start with the session's current state as ordinary events (the reply in flight as `message_start`, the latest memory status as `om_status`, and the thread's token total) instead of starting empty. Clients that keep display-state snapshots are unaffected.

`Session.initialStateEvents()` returns those events for any other transport that needs the same catch-up. `usage_update` events now also carry `total`, the running token total after the step, so clients no longer have to add up per-step usage.
