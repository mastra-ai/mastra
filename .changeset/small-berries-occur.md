---
'@mastra/core': patch
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/mongodb': patch
---

Fixed observation activation to always preserve a minimum amount of context. Previously, swapping buffered observation chunks could unexpectedly drop the context window to near-zero tokens.
