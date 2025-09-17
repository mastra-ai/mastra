# @mastra/server

Typed HTTP handlers and utilities for exposing a `Mastra` instance over HTTP.
This package powers `mastra dev` and can be added to your own server to provide
REST and streaming endpoints for agents, workflows, telemetry and more.

## Installation

```bash
npm install @mastra/server
```

## Usage

The handlers are framework agnostic functions which accept a `Mastra` instance
and a request context. They are typically mounted under a URL prefix within your
web framework of choice:

```typescript
import { Hono } from 'hono';
import { handlers } from '@mastra/server';
import { mastra } from './mastra-instance';

const app = new Hono();

app.get('/mastra/agents', ctx => handlers.agents.getAgentsHandler({ mastra, runtimeContext: ctx }));
app.post('/mastra/agents/:id/generate', async ctx => {
  const body = await ctx.req.json();
  return handlers.agents.generateHandler({
    mastra,
    runtimeContext: ctx,
    agentId: ctx.req.param('id'),
    body,
  });
});

// Mount additional handlers as required
```

Running `mastra dev` starts a local development UI at
`http://localhost:3000` using these handlers.

## Available Handler Groups

- **Agents** - list defined agents, retrieve metadata, and run `generate`
  or `stream`.
- **Workflows** - start and inspect workflow runs.
- **Tools** - discover tools available to the `Mastra` instance.
- **Memory** - interact with configured memory stores.
- **Logs** - query runtime logs when a supporting logger transport is used.
- **Telemetry** - expose metrics produced by the telemetry subsystem.
- **Networks** - interact with agent networks.
- **Vector / Voice** - endpoints related to vector stores and voice synthesis.

Handlers return JSON serialisable data and throw an `HTTPException` (subclass of
`Error`) when a failure should result in a non-2xx HTTP status.

## OpenAPI Spec Generation

The local OpenAPI specification used by the CLI playground and similar tools can
be refreshed by running:

```bash
pnpm run pull:openapispec
```

within the `@mastra/server` directory.
