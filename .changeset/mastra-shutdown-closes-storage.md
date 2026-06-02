---
"@mastra/core": patch
---

`Mastra.shutdown()` now releases storage resources automatically. Stores that expose a `close()` lifecycle hook (such as `LibSQLStore`) are closed during shutdown, so file handles are freed and the storage directory can be removed cleanly afterward, including on Windows.

```typescript
const mastra = new Mastra({ storage });

// Storage is closed for you — no manual cleanup needed
await mastra.shutdown();
```
