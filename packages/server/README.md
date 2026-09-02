# @mastra/server

Typed, framework-agnostic HTTP route definitions, handlers, schemas, and adapter utilities for exposing a `Mastra` instance over HTTP. This package powers Mastra's development server and the framework-specific server adapters.

## Installation

```bash
npm install @mastra/server
```

## Usage

The handlers are framework-agnostic functions that accept a `Mastra` instance and request context. Import them from `@mastra/server/handlers`, then mount the route handlers under a URL prefix in your web framework:

```typescript
import { RequestContext } from '@mastra/core/request-context';
import { agents } from '@mastra/server/handlers';
import { Hono } from 'hono';
import { mastra } from './mastra-instance';

const app = new Hono();

app.get('/mastra/agents', async c => {
  const result = await agents.LIST_AGENTS_ROUTE.handler({
    mastra,
    partial: c.req.query('partial'),
    requestContext: new RequestContext(),
  });

  return c.json(result);
});

export default app;
```

Each exported route combines its HTTP method, path, validation schemas, permission requirements, response type, and handler. Framework adapter packages automate this registration and translate framework requests and responses into the common handler context.

## Documentation

Handler groups cover agents and agent controllers, conversations, workflows and dynamic workflows, tools, MCP, memory, vectors, voice, logs, observability, scores, schedules, datasets, processors, workspaces, skills, plans, authentication, A2A tasks, and stored entities.

Route handlers return serializable values or streams and throw `HTTPException` when an error should map to a non-2xx response. Shared schemas and error-formatting helpers are available through package subpaths for adapters that need to validate requests or emit OpenAPI metadata.

`@mastra/server/server-adapter` exports the abstract `MastraServer` contract and common route-registration utilities. Adapter packages implement framework-specific streaming, parameter extraction, response handling, context middleware, authentication middleware, and HTTP logging around this contract.

The package's OpenAPI-derived route metadata can be refreshed from `packages/server` with:

```bash
pnpm run pull:openapispec
```

- [`MastraServer` adapter reference](https://mastra.ai/reference/server/mastra-server)
- [Server adapter guide](https://mastra.ai/docs/server/server-adapters)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/server/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
