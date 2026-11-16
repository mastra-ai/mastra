---
'@mastra/core': patch
---

Fixed durable agents never generating a thread title when observational memory is on. These threads now get a title the same way they do with a regular agent. Fixes #30478.
