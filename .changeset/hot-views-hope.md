---
'@mastra/core': patch
---

LocalSandbox now replaces an existing checkpoint atomically. A concurrent boot never observes a missing or half-written checkpoint while a snapshot is being saved.
