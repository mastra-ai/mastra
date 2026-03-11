---
'@mastra/e2b': patch
---

E2B process handles now expose string PIDs. You can still pass numeric-string PIDs to `get()` when reconnecting to an existing process.

```typescript
const handle = await sandbox.processes.spawn('node server.js');
handle.pid; // string (e.g., '1234')
```
