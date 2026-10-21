---
'@mastra/platform-workspace': minor
---

Added a full process manager to `PlatformSandbox`. Background processes now stream their output and can be stopped:

- `spawn()` streams stdout and stderr while the process runs, instead of only when it exits.
- `kill()` stops a process.
- `list()` shows what is running in the sandbox, plus exited processes whose output hasn't been read.
- `get(pid)` attaches to a process this manager didn't start, for example after your app restarts.

```ts
const handle = await sandbox.processes.spawn('pnpm dev', {
  onStdout: data => console.log(data),
})

const processes = await sandbox.processes.list()
await handle.kill()
```

Processes have no time limit unless you set `timeout`. A long-running process's output stream reconnects periodically, and the process keeps running through it. Output written during a reconnect is lost, and a process that exits during one reports exit code `1` from `wait()` instead of its real exit code.
