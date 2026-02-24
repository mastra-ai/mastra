---
'mastracode': patch
---

Fixed stale git branch in system prompt when resuming a thread on a different branch. The branch is now refreshed on every agent request and when switching threads. Also improved the status line to show abbreviated branch names instead of hiding the branch entirely when the name is too long.
