---
'@mastra/core': major
---

Added required collection row counts for application storage, so totals no longer require loading every matching row.

**Before**

```ts
const total = (await storage.ops.findMany('jobs', { status: 'failed' })).length;
```

**After**

```ts
const total = await storage.ops.count('jobs', { status: 'failed' });
```
