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

app.get('/mastra/agents', ctx => handlers.agents.listAgentsHandler({ mastra, requestContext: ctx }));
app.post('/mastra/agents/:id/generate', async ctx => {
  const body = await ctx.req.json();
  return handlers.agents.generateHandler({
    mastra,
    requestContext: ctx,
    agentId: ctx.req.param('id'),
    body,
  });
});

// Mount additional handlers as required
```

## Documentation

- [@mastra/server documentation](https://mastra.ai/docs/server/overview)

## Changelog

See the [package changelog](https://github.com/mastra-ai/mastra/blob/main/packages/server/CHANGELOG.md) for version history and release notes.

## Support

We have an [open community Discord](https://discord.gg/mastra-ai). Come and say hello and let us know if you have any questions or need any help getting things running.
