---
'@mastra/platform-workspace': minor
---

Background processes on an E2B-backed `PlatformSandbox` now work like `E2BSandbox`'s:

- `spawn()` streams stdout and stderr while the process runs, instead of only when it exits.
- `kill()` stops a process.
- `list()` shows what is running in the sandbox, plus exited processes whose output hasn't been read.
- `get(pid)` attaches to a process this manager didn't start.

When the lease a process started with expires, the manager reattaches and the process keeps running, but output written between the expiry and the reattach is lost. If the process exits in that window, `wait()` reports a failure without its real exit code. Processes have no time limit unless you set `timeout`. Sandboxes on other providers keep the previous behavior.
