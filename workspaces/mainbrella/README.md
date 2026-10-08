# @mastra/mainbrella

Mainbrella Linux containers for Mastra workspaces. Includes command execution,
managed processes with streaming and stdin, an HTTP filesystem, and an editor
sandbox provider.

```bash
pnpm add @mastra/mainbrella @mastra/core
```

Provision `MAINBRELLA_API_KEY` on your server. `MAINBRELLA_API_URL` optionally
selects an API origin; the default is `https://api.mainbrella.com`.

```typescript
import { Workspace } from '@mastra/core/workspace';
import { MainbrellaFilesystem, MainbrellaSandbox } from '@mastra/mainbrella';

const sandbox = new MainbrellaSandbox({ catalogId: 'node', size: 'lite' });
const filesystem = new MainbrellaFilesystem({ sandbox });
const workspace = new Workspace({ sandbox, filesystem });

try {
  await workspace.init();
  await filesystem.writeFile('/hello.txt', 'hello from mainbrella');
  const result = await sandbox.executeCommand('cat', ['/workspace/hello.txt']);
  console.log(result.stdout, result.exitCode);
} finally {
  await workspace.destroy();
}
```

Save `sandbox.container` (both `id` and `createdAt`) to reconnect to the exact
running generation. A logical Mastra `id` alone does not identify a remote
container. Persist a `creationKey` before starting if you need creation recovery
across process restarts; reuse that key with the same creation options within
24 hours. Ambiguous command or input requests are never replayed automatically.

Stop discards unsaved files. After an explicit stop, starting the same object
creates a fresh generation with a new key. Reconnection to a missing generation
fails instead of silently replacing it. Access `sandbox.mainbrella` for SDK
features such as explicit saved workspaces, exports, previews, signals, and PTYs.
Check `sandbox.getCapabilities()` before using optional provider features.

File transfer is limited to 1 MiB per file. Managed execution is limited to
15 minutes and 1 MiB of output, within the container's lease. Read the actual
deadline from `(await sandbox.getInfo()).timeoutAt`. Preview URLs are bearer credentials
and expire within that lease; `sandbox.mainbrella.previews.create()` returns
expiration metadata. Preview issuance failures require list/revoke reconciliation
before another link is issued.

The filesystem resolves workspace paths under `basePath` (default `/workspace`).
It rejects symlinks and special files. Directory checks are not an isolation
boundary against other code in the same container. Append/copy and write
preconditions are not atomic against external writers; moves never overwrite.
FUSE cloud mounts, filesystem watchers, guest-wide process listing, and automatic
checkpoints are unsupported. Destroying the filesystem alone leaves its sandbox
running.

For MastraEditor, register `mainbrellaSandboxProvider` in `sandboxes`.

## Development

```bash
pnpm --filter @mastra/mainbrella test:unit
pnpm --filter @mastra/mainbrella typecheck
pnpm --filter @mastra/mainbrella lint
pnpm --filter @mastra/mainbrella build
```

Integration tests require explicit `MAINBRELLA_RUN_INTEGRATION=true`, an API key,
and an optional API URL. They consume one start, preserve creation recovery state
in a private temporary directory, and clean up only the generation they create.
Use a local credential only with its matching localhost API.

See the [Mainbrella integration documentation](https://mastra.ai/integrations/sandboxes/mainbrella)
and [Mainbrella API reference](https://mainbrella.com/API.md).
