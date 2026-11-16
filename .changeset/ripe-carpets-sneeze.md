---
'@mastra/core': patch
---

Fixed durable agents never generating a thread title when observational memory is passed in the call's `memory.options`. These threads now get a title, as they do with a regular agent. Fixes #30478.
