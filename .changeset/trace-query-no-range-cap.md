---
'@mastra/core': minor
---

Removed the 31-day limit on trace query time ranges. `queryTraces()`, `queryThreads()`, `querySpans()`, and trace field discovery now accept any range where `from` is earlier than `to`, so you can search all of your retained trace data.
