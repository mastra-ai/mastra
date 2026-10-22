---
'@mastra/memory': patch
---

Fixed synchronous observation retrieval reindexing unchanged groups after each cycle or Memory restart, while preserving retries and generation metadata updates. Fixes https://github.com/mastra-ai/mastra/issues/27930.
