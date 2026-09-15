---
'@mastra/docker': patch
---

Fixed `DockerProcessHandle.kill()` reporting exit code 137 while the process kept running inside the container, and stopped killed/timed-out processes from accumulating against `pidsLimit`.

**Namespace-correct kill**

`kill()` previously used the host PID from `exec.inspect()`, which does not match the PIDs an in-container `kill` can address, so the signal missed the target and the process stayed alive. Each spawned command now runs in its own session/process group (`setsid -w`) and records its PGID to a private file; `kill()` then `SIGSTOP`s and `SIGKILL`s the whole kernel-owned process group in the container's own PID namespace. Because the group identity is enforced by the kernel, descendants are still terminated even if they drop their environment or re-parent to PID 1, and the identity cannot be forged by another container process. Images without `setsid -w` (e.g. BusyBox) fall back to signalling the recorded leader PID directly.

**Zombie reaping via an init process**

The default container command (`sleep infinity`) as PID 1 never reaps children, so terminated processes lingered as zombies and consumed PIDs. `DockerSandbox` now runs a Docker init process as PID 1 by default (`HostConfig.Init`), which reaps children. Disable it with the new `init` option:

```ts
const sandbox = new DockerSandbox({ init: false });
```

Fixes #23773.
