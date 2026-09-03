---
'mastracode': patch
---

Added thread-scoped background activity and completion handling to the Mastra Code TUI. Deferred tools and delegated subagents reconcile their original rows in place, completed work produces a single persisted completion card, and `Ctrl+G` opens the current thread's activity list for inspection or cancellation.
