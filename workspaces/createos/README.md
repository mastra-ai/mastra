# `@mastra/createos`

CreateOS cloud sandbox support for Mastra workspaces.

## Installation

```bash
pnpm add @mastra/createos
```

Set `CREATEOS_SANDBOX_API_KEY`, then configure a workspace:

```ts
import { Workspace } from '@mastra/core/workspace';
import { CreateOSSandbox } from '@mastra/createos';

const workspace = new Workspace({
  sandbox: new CreateOSSandbox({
    id: 'project-1',
    shape: 's-2vcpu-2gb',
    autoPauseAfterSeconds: 900,
    ingress: true,
  }),
});
```

The sandbox starts lazily when the workspace first runs a command or writes a file. `_stop()` pauses it, while `_destroy()` permanently removes it.

Runtime environment variables are applied per process and are not persisted in the sandbox. This allows `sandbox.setEnv()` to rotate credentials such as `GH_TOKEN` after the sandbox has started.

CreateOS currently reconnects a logical Mastra ID by scanning for its deterministic sandbox name when a physical CreateOS ID is unavailable. Supplying `sandboxId` avoids that scan.

If command execution discovers that the attached sandbox was deleted or became unavailable, the adapter reconnects or creates a replacement, restores configured mounts, and retries process creation once. Authentication, quota, command, and generic server errors aren't retried.

Mount an S3-compatible filesystem through CreateOS's native disk API:

```ts
import { S3Filesystem } from '@mastra/s3';

const workspace = new Workspace({
  mounts: {
    '/workspace/data': new S3Filesystem({
      bucket: process.env.S3_BUCKET!,
      region: process.env.S3_REGION ?? 'us-east-1',
      endpoint: process.env.S3_ENDPOINT,
      accessKeyId: process.env.S3_ACCESS_KEY_ID!,
      secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      prefix: 'projects/demo',
    }),
  },
  sandbox: new CreateOSSandbox({ id: 'project-1' }),
});
```

The adapter registers a deterministic CreateOS S3 disk, stores its credentials encrypted in the CreateOS control plane, and live-attaches it when the sandbox starts. CreateOS remounts the disk after pause and resume. Static access-key credentials are required; session-token and read-only mounts aren't currently supported.

Enable Mastra computer-use controls with a CreateOS desktop root filesystem:

```ts
const sandbox = new CreateOSSandbox({
  computerUse: true,
  ingress: true,
});

const screenshot = await sandbox.computer?.screenshot();
const viewerUrl = await sandbox.computer?.streamUrl?.();
```

When `computerUse` is enabled without an explicit `rootfs`, the provider uses `desktop:1`. Set `ingress: true` to receive a public noVNC viewer URL.
