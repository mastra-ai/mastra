---
"@mastra/libsql": patch
"@mastra/core": patch
---

`LibSQLStore` now exposes a public `close()` method that releases SQLite file handles and cleans up WAL sidecar files. `Mastra.shutdown()` calls it automatically, so you no longer need to reach into private fields to avoid `EBUSY` errors when removing the storage directory on Windows.

```typescript
const storage = new LibSQLStore({ id: 'my-store', url: 'file:./dev.db' });
const mastra = new Mastra({ storage });

// Cleanly releases all file handles, including WAL/shm sidecar files
await mastra.shutdown();

// Now safe to remove the storage directory on all platforms, including Windows
await fs.rm('./dev.db', { recursive: true, force: true });
```
