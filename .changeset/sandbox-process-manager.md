---
'@mastra/core': minor
---

Added background process management to workspace sandboxes.

You can now spawn, monitor, and manage long-running background processes (dev servers, watchers, REPLs) inside sandbox environments.

```typescript
// Spawn a background process
const handle = await sandbox.processes.spawn('node server.js');

// Stream output and wait for exit
const result = await handle.wait({
  onStdout: (data) => console.log(data),
});

// List and manage running processes
const procs = await sandbox.processes.list();
await sandbox.processes.kill(handle.pid);
```

- `SandboxProcessManager` abstract base class with `spawn()`, `list()`, `get(pid)`, `kill(pid)`
- `ProcessHandle` base class with stdout/stderr accumulation, streaming callbacks, and `wait()`
- `LocalProcessManager` implementation wrapping Node.js `child_process`
- Node.js stream interop via `handle.reader` / `handle.writer`
- Default `executeCommand` implementation built on process manager (spawn + wait)
