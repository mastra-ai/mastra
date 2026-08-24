---
'mastracode': patch
---

Improved long-session terminal performance by coalescing background renders, drawing status animations without re-rendering the full component tree, preserving completed component caches, and retaining a smaller rendered scrollback.
