# @mastra/docker

Docker container sandbox provider for Mastra workspaces. Uses long-lived containers with `docker exec` for command execution. Targets local development, CI/CD, air-gapped deployments, and cost-sensitive scenarios where cloud sandboxes are unnecessary.

## Installation

```bash
npm install @mastra/docker
```

Requires [Docker Engine](https://docs.docker.com/engine/install/) running on the host machine.

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

### Bind Mounts

Mount host directories into the container:

```typescript
const workspace = new Workspace({
  sandbox: new DockerSandbox({
    image: 'node:22-slim',
    volumes: {
      '/my/project': '/workspace/project',
      '/shared/data': '/data',
    },
  }),
});
```

### Reconnection

Containers can be reconnected by providing a fixed `id`. On `start()`, an existing container with a matching label is reused instead of creating a new one:

```typescript
const workspace = new Workspace({
  sandbox: new DockerSandbox({
    id: 'persistent-sandbox',
    image: 'node:22-slim',
  }),
});
```

### Docker Connection Options

Connect to remote Docker hosts or use custom socket paths:

```typescript
const workspace = new Workspace({
  sandbox: new DockerSandbox({
    dockerOptions: {
      host: '192.168.1.100',
      port: 2376,
    },
  }),
});
```

## Documentation

For more information, see the [DockerSandbox reference](https://mastra.ai/docs/reference/workspace/docker-sandbox).
