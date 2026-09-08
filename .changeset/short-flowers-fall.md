---
'mastra': patch
'@mastra/client-js': patch
'@mastra/server': patch
'@mastra/mongodb': patch
'@mastra/spanner': patch
'@mastra/core': patch
'@mastra/libsql': patch
'@mastra/mysql': patch
'@mastra/pg': patch
---

Added `dataset.purgeItem()` to redact item content from existing dataset history and linked experiment results while preserving version history and review status. Purged items reject later dataset updates, later experiment-result writes remain redacted, and MongoDB purges require transaction support. Dataset item writes must not run concurrently with purge.

```typescript
await dataset.purgeItem({ itemId: 'item-123' });
```
