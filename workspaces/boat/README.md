# @mastra/boat

Boat cloud sandbox provider for [Mastra](https://mastra.ai) workspaces.

Implements the `WorkspaceSandbox` interface using [Boat](https://docs.boat.dev) — cloud Linux VMs (4 vCPU / 8 GB by default) with Docker, Node, Python, Go and Rust preinstalled. Supports command execution with streaming output, background processes, timeouts and abort, public HTTPS preview URLs, named snapshots as checkpoints, forking, and reattaching to an existing sandbox.

## Installation

```bash
npm install @mastra/boat
```

## Usage

### Basic

```typescript
import { Workspace } from '@mastra/core/workspace';
import { BoatSandbox } from '@mastra/boat';

const sandbox = new BoatSandbox({
  // apiKey read from BOAT_API_KEY
  machineType: 'large',
});

const workspace = new Workspace({ sandbox });
await workspace.init();

const result = await workspace.sandbox.executeCommand('echo', ['Hello!']);
console.log(result.stdout); // "Hello!"

await workspace.destroy();
```

### Preview URLs

Boat gives every sandbox port a stable public HTTPS URL. The service must bind `0.0.0.0` — Boat's route reaches it from outside the application process, so a `localhost` listener is unreachable.

```typescript
await sandbox.processes.spawn('npm run dev -- --host 0.0.0.0 --port 3000');
const url = await sandbox.networking.getPortUrl(3000);
```

The URL carries an access token unless the sandbox was constructed with `publicPorts: true`. Treat it as a secret.

### Checkpoints

Give the sandbox a `checkpointName` and `snapshot()` saves its filesystem to that named Boat snapshot. A later sandbox with the same name boots from it.

```typescript
const sandbox = new BoatSandbox({ checkpointName: 'session-42', seedCheckpointName: 'repo-base' });
await sandbox.snapshot();
```

## Notes

- Boat archives a sandbox one hour after it starts by default, mid-work. Pass `ttlSeconds` to change that window, or `null` to disable auto-stop (needs a payment method, and is refused on the free trial). A sandbox archived out from under a running session is re-acquired and the command replayed.
- `stop()` archives the sandbox and keeps its filesystem, so the next `start()` resumes it. `destroy()` deletes it and its snapshots permanently.
- Boat's command API has no stdin transport, so `sendStdin()` and `closeStdin()` are unsupported.
- `fork()` copies the source's latest snapshot, and Boat refuses to fork a sandbox that has none yet. Since Boat snapshots on its own schedule, `fork()` waits for the first one — around 75 seconds after a sandbox is created.

## Documentation

- [Boat integration guide](https://mastra.ai/integrations/sandboxes/boat)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/boat/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
