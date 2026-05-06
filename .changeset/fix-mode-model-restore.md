---
'@mastra/core': patch
---

Fixed a Harness issue where reopening a thread could apply the wrong model for
the saved mode. Threads now reopen with the correct model for that mode,
including when no explicit per-mode model was selected.
