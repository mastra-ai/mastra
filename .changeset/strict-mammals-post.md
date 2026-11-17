---
'@mastra/core': minor
'@mastra/client-js': patch
'@mastra/server': patch
---

Added `Session.initialStateEvents()`, which returns what a client joining mid-run needs to catch up as ordinary events: the reply in flight (`message_start`), the latest memory status (`om_status`), and the thread's token total. `usage_update` events now also carry `total`, the running token total after the step, so clients no longer have to add up per-step usage.
