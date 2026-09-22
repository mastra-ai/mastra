---
'@mastra/boat': minor
---

Added `@mastra/boat`, a sandbox provider for [Boat](https://docs.boat.dev) cloud sandboxes — isolated Linux VMs with Docker, Node, Python, Go and Rust preinstalled.

```typescript
import { Workspace } from '@mastra/core/workspace';
import { BoatSandbox } from '@mastra/boat';

const workspace = new Workspace({
  sandbox: new BoatSandbox({ machineType: 'large' }), // apiKey read from BOAT_API_KEY
});
```

**Preview URLs** — every sandbox port gets a stable public HTTPS URL. Bind the service to `0.0.0.0`, since Boat reaches it from outside the application process.

```typescript
await sandbox.processes.spawn('npm run dev -- --host 0.0.0.0 --port 3000');
const url = await sandbox.networking.getPortUrl(3000);
```

**Checkpoints and forks** — `snapshot()` saves to a named Boat snapshot that a later sandbox boots from, and `fork()` copies a sandbox without touching the source.

```typescript
const sandbox = new BoatSandbox({ checkpointName: 'project-session-42' });
await sandbox.snapshot();

const child = await sandbox.fork();
```

Boat forks from the latest snapshot and takes them on its own schedule, so `fork()` waits for the source's first snapshot — about 75 seconds after creation — rather than failing with a `fork_failed` you can only retry.

**Survives auto-stop** — Boat archives a sandbox an hour after it starts, mid-work, so a command that finds its VM gone resumes the sandbox and runs again rather than failing. Pass `ttlSeconds` to widen the window, or `null` to disable auto-stop.

Commands run as background processes and are polled, so output streams as it appears, timeouts and abort fire while the command is still running, and long jobs are not capped at Boat's ten-minute synchronous limit. Boat has no stdin transport, so `sendStdin()` and `closeStdin()` are unsupported.
