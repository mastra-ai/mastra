---
'mastracode': patch
---

Fixed a crash when the terminal briefly reports a very narrow width while the screen is off or resizing.

Error boxes and workflow diagrams now size themselves to the terminal width, so they stay within the screen after a resize instead of overflowing.
