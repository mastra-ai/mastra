---
'@mastra/memory': patch
---

Fixed memory recall exposing stored reasoning. Recall now returns visible message content while preserving text and tool part indices, and paging no longer stops early at messages that only contain reasoning.
