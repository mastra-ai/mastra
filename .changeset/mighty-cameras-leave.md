---
'mastracode': patch
---

Fixed runaway terminal rendering allocations in long Mastra Code sessions by bounding retained chat history and releasing stale component references.
