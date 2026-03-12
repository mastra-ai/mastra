---
'@mastra/e2b': patch
---

`ProcessHandle.pid` is now a string. Numeric PIDs from the E2B SDK are stringified automatically.

```typescript
const handle = await sandbox.processes.spawn('node server.js');
handle.pid; // string (e.g., '1234')
```
