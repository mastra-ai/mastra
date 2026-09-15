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

## Documentation

- [Docker Sandbox integration guide](https://mastra.ai/integrations/sandboxes/docker)
- [Workspace documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/docker/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
