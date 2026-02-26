---
'@mastra/blaxel': minor
---

Added background process management support for Blaxel sandboxes. Agents can now spawn, monitor, and kill long-running processes using the standard `ProcessHandle` interface.

**Example usage:**

```typescript
const sandbox = new BlaxelSandbox({ timeout: '5m' });
const workspace = new Workspace({ sandbox });

// Process manager is available via sandbox.processes
const handle = await sandbox.processes.spawn('python server.py');

// Monitor output
handle.onStdout(data => console.log(data));

// Check status
const info = await sandbox.processes.list();

// Kill when done
await handle.kill();
```

**Note:** Process stdin is not supported in Blaxel sandboxes.

**Additional improvements:**

- Fixed detection of expired sandboxes, ensuring operations automatically retry when a sandbox has timed out
