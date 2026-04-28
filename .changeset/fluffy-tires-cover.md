---
'mastracode': patch
---

Fixed task lists, active plans, and sandbox paths leaking across threads. These per-thread state values are now properly cleared when switching threads, creating new threads, cloning threads, or using the /new command.
