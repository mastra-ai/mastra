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

Added `dataset.purgeItem()` to permanently redact item content from every stored dataset version and linked experiment results while preserving version history and review status. Later experiment-result writes remain redacted, and MongoDB purges require transaction support.

```typescript
await dataset.purgeItem({ itemId: 'item-123' });
```
