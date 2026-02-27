---
'@mastra/blaxel': patch
---

Added support for provider-native string process IDs in Blaxel process APIs.

```typescript
const handle = await sandbox.processes.spawn('node server.js');
await sandbox.processes.get(handle.pid); // handle.pid can be a string
```
