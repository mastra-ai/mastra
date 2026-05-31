---
"@mastra/libsql": patch
---

Added a public `close()` method to `LibSQLStore` that releases SQLite file handles and cleans up the WAL/shm sidecar files. Previously these handles stayed open until the process exited, which on Windows caused `EBUSY` errors when removing the storage directory after shutdown. `Mastra.shutdown()` now calls `close()` automatically, so you no longer need to reach into private fields.

```typescript
const storage = new LibSQLStore({ id: 'my-store', url: 'file:./dev.db' });

// Release all file handles, including WAL/shm sidecar files
await storage.close();

// Now safe to remove the storage directory on all platforms, including Windows
await fs.rm('./dev.db', { recursive: true, force: true });
```
