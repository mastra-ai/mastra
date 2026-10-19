---
'@mastra/pg': patch
'@mastra/libsql': patch
'@mastra/core': patch
---

Fixed stored skills ignoring the `metadata` filter. `skills.list({ metadata })` and `skills.listResolved({ metadata })` now return only skills whose resolved version metadata matches every key/value pair, with correct `total` and pagination.

```ts
const skills = await storage.getStore('skills');
await skills.listResolved({ metadata: { publishedBy: 'user-123' } });
```
