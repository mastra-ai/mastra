---
'@mastra/core': minor
---

Widened `ProcessHandle.pid` type from `number` to `string | number` to support sandbox providers that use non-numeric process identifiers.

Providers like Blaxel return string PIDs from their API, and Daytona uses session IDs as process identifiers. This change removes the need for workarounds like `parseInt()` and synthetic numeric counters.

**Before:**

```typescript
const handle = await sandbox.processes.spawn('node server.js');
handle.pid; // number
await sandbox.processes.get(42); // number only
```

**After:**

```typescript
const handle = await sandbox.processes.spawn('node server.js');
handle.pid; // string | number
await sandbox.processes.get(42); // number still works
await sandbox.processes.get('session-abc'); // string PIDs now supported
```
