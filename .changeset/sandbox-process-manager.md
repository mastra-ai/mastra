---
'@mastra/core': minor
'@mastra/e2b': minor
---

Added background process management to workspace sandboxes.

You can now spawn, monitor, and manage long-running background processes (dev servers, watchers, REPLs) inside sandbox environments.

```typescript
// Spawn a background process
const handle = await sandbox.processes.spawn('node server.js');

// Stream output
const result = await handle.wait({
  onStdout: (data) => console.log(data),
});

// List and manage running processes
const procs = await sandbox.processes.list();
await sandbox.processes.kill(handle.pid);
```

- `sandbox.processes.spawn()` to start background processes
- `sandbox.processes.list()`, `.get(pid)`, `.kill(pid)` for process lifecycle management
- `ProcessHandle` with stdout/stderr streaming and `wait()` with callbacks
- Node.js stream interop via `handle.reader` / `handle.writer`
- Works with both `LocalSandbox` and `E2BSandbox`
