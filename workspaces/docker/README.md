# @mastra/docker

Docker container sandbox provider for Mastra workspaces. Use `@mastra/docker` to connect this provider to a Mastra application.

## Installation

```bash
npm install @mastra/docker
```

## Usage

Configure the prerequisites described in the documentation.

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
  model: 'openai/gpt-5.6-sol',
  workspace,
});
```

## Documentation

- [@mastra/docker documentation](https://mastra.ai/docs/mastra-platform/workspaces)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/workspaces/docker/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
