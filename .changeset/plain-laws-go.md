---
'mastracode': patch
---

Fixed mode switching crash when no active thread exists. Previously, pressing Shift+Tab to cycle modes before sending a first message would cause a fatal error.
