---
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/core': patch
---

Session streams opened with `displayState=false` now start with the session's current state as ordinary events (the reply in flight, the latest memory status, the token total) instead of starting empty. Clients that keep display-state snapshots are unaffected.
