---
'@mastra/core': minor
---

Added optional collection row counts for application storage, so totals no longer require loading every matching row.

**Before**

```ts
const total = (await storage.ops.findMany('jobs', { status: 'failed' })).length;
```

**After**

```ts
if (!storage.ops.count) throw new Error('Storage backend does not support counts');
const total = await storage.ops.count('jobs', { status: 'failed' });
```
