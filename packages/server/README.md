# @mastra/server

Typed HTTP handlers and utilities for exposing a `Mastra` instance over HTTP.
This package powers `mastra dev` and can be added to your own server to provide
REST and streaming endpoints for agents, workflows, telemetry and more.

## Installation

```bash
npm install @mastra/server
```

## Usage

Import from a documented subpath; the package root intentionally has no exports. Framework adapters consume route definitions such as these and register each route's method, path, schemas, permissions, and handler.

```typescript
import { agents, workflows } from '@mastra/server/handlers';

export const routes = [agents.LIST_AGENTS_ROUTE, agents.GENERATE_AGENT_ROUTE, workflows.LIST_WORKFLOWS_ROUTE];
```

## Documentation

- [`MastraServer` adapter reference](https://mastra.ai/reference/server/mastra-server)
- [Server adapter guide](https://mastra.ai/docs/server/server-adapters)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/server/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
