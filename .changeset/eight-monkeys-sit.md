---
'@mastra/pg': patch
---

Fixed rewritten observability scores so filtered reads and trace predicates consistently return the latest value for each score ID without globally deduplicating score history.
