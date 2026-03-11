---
'@mastra/e2b': patch
---

`ProcessHandle.pid` is now a string (stringified numeric PID) to match the updated core interface. The `get()` method still accepts numeric strings and connects to E2B processes by parsing them back to numbers internally.

```typescript
const handle = await sandbox.processes.spawn('node server.js');
handle.pid; // string (e.g., '1234')
```
