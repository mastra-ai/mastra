---
'@mastra/daytona': patch
---

Improved Daytona process handling to use provider session IDs directly as `ProcessHandle.pid`.

```typescript
const handle = await sandbox.processes.spawn('node server.js');
await sandbox.processes.get(handle.pid);
```
