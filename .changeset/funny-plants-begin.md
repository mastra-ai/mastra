---
'@mastra/libsql': minor
---

Added native application collection counts so totals no longer load matching rows.

**Before**

```ts
const total = (await storage.ops.findMany('jobs', { status: 'failed' })).length;
```

**After**

```ts
const total = await storage.ops.count?.('jobs', { status: 'failed' });
```
