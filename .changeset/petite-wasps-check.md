---
'@mastra/blaxel': patch
---

Use provider-native string process IDs directly as `ProcessHandle.pid`, removing the previous `parseInt()` workaround.

```typescript
const handle = await sandbox.processes.spawn('node server.js');
handle.pid; // string — the Blaxel SDK's native process ID
```
