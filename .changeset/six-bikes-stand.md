---
'@mastra/memory': patch
---

Improved observational memory performance by reusing the current memory record during a single agent step. This reduces repeated storage lookups while preserving fresh reads after memory state changes.
