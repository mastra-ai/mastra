# @mastra/smol

Smol microVM sandbox provider for Mastra workspaces. Run workspace commands in an isolated VM on your computer or in Smol Cloud.

## Installation

```bash
npm install @mastra/smol
```

The bundled Smol SDK boots local VMs without a separate runtime install on a supported virtualization host (macOS Apple Silicon or Linux with `/dev/kvm`). Cloud VMs use `SMOL_CLOUD_TOKEN` or a cloud API key in the provider options.

## Local workspace shared with an agent

```ts
import { resolve } from 'node:path';
import { LocalFilesystem, Workspace } from '@mastra/core/workspace';
import { SmolSandbox } from '@mastra/smol';

const source = resolve('./project');
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: source }),
  sandbox: new SmolSandbox({
    id: 'project-agent',
    image: 'node:22-slim',
    workingDirectory: '/workspace',
    mounts: [{ source, target: '/workspace' }],
  }),
});
await workspace.init();
const result = await workspace.sandbox?.executeCommand?.('node', ['--version']);
console.log(result?.stdout);
await workspace.destroy();
```

Use an OCI image that includes the tools your agent needs. A local host mount lets Mastra file tools and VM commands access the same files. With host mounts, `stop()` stops the VM and retains its disk and host files; `start()` boots it again. A VM without host mounts pauses with memory intact and resumes on the next start.

## Cloud workspace

```ts
import { Workspace } from '@mastra/core/workspace';
import { SmolSandbox } from '@mastra/smol';

const sandbox = new SmolSandbox({ target: 'cloud', image: 'node:22-slim', id: 'cloud-agent' });
const workspace = new Workspace({ sandbox });
await workspace.init();
console.log((await sandbox.executeCommand('node', ['--version'])).stdout);
await workspace.destroy();
```

Cloud workspaces stop and preserve their disk by default. Set `checkpointable: true` to enable RAM pause/resume and Cloud snapshots; this opts into checkpointable VM placement and memory requirements.

Cloud machine names derive from `id` and the VM configuration to reconnect after a process restart. Changing the image, resources, egress policy, ports, or mounts with the same `id` fails until you destroy the earlier VM or choose a new `id`. You can explicitly attach by saved `sandbox.instance?.id` using `machineId`; verify the existing VM configuration yourself when doing so. Smol Cloud credentials stay on the host. To limit guest network access, set `allowHosts`; local guest networking defaults to enabled.

File tools require a filesystem backed by the same files as the VM. Host mounts work only on the local target. On cloud, use `sandbox.writeFiles()` or a shared filesystem; using an unrelated host `LocalFilesystem` will not expose those files inside the VM.

`checkpointPath` enables local portable snapshots on VMs without host mounts. Cloud snapshots require `checkpointable: true` and save a checkpoint in Smol Cloud. Read `sandbox.checkpointInfo` after `sandbox.snapshot()` for the resulting artifact. Do not combine `checkpointPath` with host mounts, since Smol cannot capture a portable checkpoint of a host mount.

Run the local VM test on a supported host with `MASTRA_SMOL_INTEGRATION=1 pnpm --filter @mastra/smol test:integration`. Set `MASTRA_SMOL_TEST_BUILTIN=1` to run without pulling an image. Set `MASTRA_SMOL_CLOUD_BRIDGE=1` to test the cloud transport against a local VM and an HTTP bridge.
