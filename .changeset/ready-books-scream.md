---
'mastracode': patch
---

Fixed stale git branch in system prompt and TUI status bar. The branch is now refreshed on every agent request and when switching threads, so both the system prompt and status bar reflect the current branch. Also improved the status line to show abbreviated branch names instead of hiding the branch entirely when the name is too long.
