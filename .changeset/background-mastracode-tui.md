---
'mastracode': patch
---

Added thread-scoped background activity and completion handling to the Mastra Code TUI when background tools are enabled in settings. Enable **Experimental background tools** in `/settings`, then restart Mastra Code. The toggle saves the global `backgroundTools.enabled` setting and is off by default; changing it does not alter the running session. Deferred tools and delegated subagents reconcile their original rows in place, completed work produces a single persisted completion card, and `Ctrl+G` opens the current thread's activity list for inspection or cancellation.
