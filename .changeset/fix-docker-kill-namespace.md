---
'@mastra/docker': patch
---

Fixed `DockerProcessHandle.kill()` reporting exit code 137 while the process kept running inside the container, and stopped killed/timed-out processes from accumulating against `pidsLimit`.

**Namespace-correct kill**

`kill()` previously used the host PID from `exec.inspect()`, which does not match the PIDs an in-container `kill` can address, so the signal missed the target and the process stayed alive. Each spawned process is now tagged with a unique `MASTRA_PROC_ID` marker; `kill()` scans `/proc` inside the container for that marker (plus descendants), then `SIGSTOP`s and `SIGKILL`s the whole tree in the container's own PID namespace.

**Zombie reaping via an init process**

The default container command (`sleep infinity`) as PID 1 never reaps children, so terminated processes lingered as zombies and consumed PIDs. `DockerSandbox` now runs a Docker init process as PID 1 by default (`HostConfig.Init`), which reaps children. Disable it with the new `init` option:

```ts
const sandbox = new DockerSandbox({ init: false });
```

Fixes #23773.
