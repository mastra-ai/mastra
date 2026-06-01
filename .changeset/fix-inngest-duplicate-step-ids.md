---
"@mastra/core": patch
---

Fixed duplicate step ID warnings in Inngest workflows. When a workflow step ran, two persistence calls with the same ID caused AUTOMATIC_PARALLEL_INDEXING warnings in Inngest logs. Steps now use unique IDs for each persistence call, eliminating the warnings.
