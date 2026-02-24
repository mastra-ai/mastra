---
'mastracode': patch
---

Improved TUI maintainability by modularizing the main TUI class into focused modules: event handlers, command dispatchers, status line rendering, message rendering, error display, shell passthrough, and setup logic. Reduced the main TUI file from ~4,760 lines to 449 lines with no changes to user-facing behavior.
