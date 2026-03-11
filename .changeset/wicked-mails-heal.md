---
'@mastra/core': minor
---

Changed `ProcessHandle.pid` type from `number` to `string` to support sandbox providers that use non-numeric process identifiers (e.g., session IDs).

**Before:**

```typescript
const handle = await sandbox.processes.spawn('node server.js');
handle.pid; // number
await sandbox.processes.get(42);
```

**After:**

```typescript
const handle = await sandbox.processes.spawn('node server.js');
handle.pid; // string (e.g., '1234' for local, 'session-abc' for Daytona)
await sandbox.processes.get('1234');
```
