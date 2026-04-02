---
'@mastra/memory': patch
'@mastra/core': patch
---

Fixed thread titles not persisting when generated during async buffered observation. Titles now update immediately when the observer produces them, rather than being lost until activation.
