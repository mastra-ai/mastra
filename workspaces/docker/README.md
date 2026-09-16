# @mastra/docker

Docker container sandbox provider for Mastra workspaces. Uses long-lived containers with `docker exec` for command execution. Targets local development, CI/CD, air-gapped deployments, and cost-sensitive scenarios where cloud sandboxes are unnecessary.

## Installation

```bash
npm install @mastra/docker
```

## Usage

```typescript
import { Agent } from '@mastra/core/agent';
import { Workspace } from '@mastra/core/workspace';
import { DockerSandbox } from '@mastra/docker';

const workspace = new Workspace({
  sandbox: new DockerSandbox({
    image: 'node:22-slim',
    timeout: 60_000, // 60 second timeout (default: 5 minutes)
  }),
});

const agent = new Agent({
  name: 'my-agent',
  model: 'anthropic/claude-opus-4-6',
  workspace,
});
```

### Volume subpath mounts

Use `mounts` (mapped 1:1 onto Docker's `HostConfig.Mounts`) when you need mount
options that the `-v`/`volumes` syntax cannot express — most notably mounting a
subdirectory of a named volume. Requires Docker Engine 26.0+ (API v1.45+) for
`subpath`.

```typescript
const workspace = new Workspace({
  sandbox: new DockerSandbox({
    image: 'node:22-slim',
    mounts: [
      // Read-only parent from a named volume
      { type: 'volume', source: 'project-data', target: '/shared', readOnly: true },
      // Writable per-conversation subdirectory of the same volume
      {
        type: 'volume',
        source: 'project-data',
        target: '/work',
        volumeOptions: { subpath: 'conversations/abc123' },
      },
    ],
  }),
});
```

`volumes` and `mounts` can be combined; both are passed through to Docker.

> **Note:** Docker does not create `volumeOptions.subpath` for you — the
> subdirectory must already exist inside the named volume before the container
> starts, otherwise the mount fails. Provision it ahead of time (for example,
> with a one-off container that creates `conversations/abc123` in the volume).

## Templates

`DockerTemplate` prepares a reusable environment once — a base image plus ordered
setup commands, env vars, and package installs — then spawns multiple disposable
sandboxes from it. Each sandbox is a fresh container with its own writable layer
over the shared read-only image, so their filesystems are independent. The image
is produced by synthesizing a `Dockerfile` and running `docker build` (not
`docker commit`), so setup is baked into reproducible, cached, content-addressed
layers.

```typescript
import { DockerTemplate } from '@mastra/docker';

const template = new DockerTemplate({ baseImage: 'node:22-slim' })
  .runCmd('git clone --depth=1 https://example.com/repo /workspace/app')
  .setWorkdir('/workspace/app')
  .runCmd('npm ci');

const result = await template.build();
if (result.status !== 'ready') throw new Error(result.error);

// Prepare once, spawn many — each has an independent writable filesystem.
const a = await template.createSandbox();
const b = await template.createSandbox();

// Remove the built image when done (independent of any sandbox's destroy()).
await template.dispose();
```

Builder methods (`from`, `setWorkdir`, `setEnvs`, `runCmd`, `aptInstall`,
`npmInstall`) are immutable and chainable — each returns a new template. The
image tag is content-addressed (`mastra-template:<hash>`), so `build()` is
idempotent and reuses an existing image unless you pass `{ force: true }`.

Build-time secrets can be supplied as ephemeral env vars — passed only as build
args and excluded from the template identity:

```typescript
const template = new DockerTemplate()
  .setEnvs({ NPM_TOKEN: process.env.NPM_TOKEN! }, { ephemeral: true })
  .runCmd('npm ci');
```

### Repository templates

`createDockerRepoTemplate` is a convenience that prepares a repository checkout
at an exact commit (or branch) plus setup commands. A private-repo token is read
from the named env var and injected as an ephemeral build arg:

```typescript
import { createDockerRepoTemplate } from '@mastra/docker';

const template = createDockerRepoTemplate({
  repoUrl: 'https://github.com/acme/app.git',
  commit: 'a1b2c3d',
  setupCommands: ['npm ci', 'npm run build'],
  tokenEnv: 'GITHUB_TOKEN', // optional, for private repos
});

await template.build();
const sandbox = await template.createSandbox();
```

## Documentation

- [Docker Sandbox integration guide](https://mastra.ai/integrations/sandboxes/docker)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/docker/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
