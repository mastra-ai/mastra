---
'@mastra/inngest': patch
---

Fixed `InngestRun.watch()` crashing the process with an unhandled rejection when the Inngest realtime subscription fails to connect (for example `fetch failed` or a WebSocket error). The failure is now logged as a warning and the run still completes through polling. Unwatching now also closes the realtime connection instead of leaving it open.
