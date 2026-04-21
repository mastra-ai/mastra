# @mastra/loopback

LoopBack 4 server adapter for Mastra, enabling you to run Mastra with native
LoopBack route registration instead of mounting an Express sub-application.

## Installation

```bash
npm install @mastra/loopback @loopback/core @loopback/rest
```

## Usage

```typescript
import { RestApplication } from '@loopback/rest';
import { Mastra } from '@mastra/core';
import { LoopbackMastraServer } from '@mastra/loopback';

const app = new RestApplication();
const mastra = new Mastra();

const server = new LoopbackMastraServer({
  app,
  mastra,
  config: {
    prefix: '/api/mastra',
    openapiPath: '/openapi.json',
  },
});

await server.init();
await app.start();
```

## Why LoopBack Is Different

This adapter is built for apps that want to preserve LoopBack 4 request-scoped
DI while exposing Mastra routes, tools, and agents through the existing
LoopBack application.

It provides:

- native LoopBack `RouteEntry` registration
- a Mastra `RequestContext` per request
- a request-scoped LoopBack bridge inside `requestContext.get('loopback')`
- adapter-level auth composition hooks
- support for standard responses, streaming, and MCP transports

## Resolving LoopBack Bindings From Mastra

Inside a Mastra route, tool, or agent, resolve LoopBack-managed bindings from
Mastra `RequestContext`:

```typescript
const loopback = requestContext.get('loopback');
const customerService = await loopback.resolve('services.CustomerService');
const customer = await customerService.findById('customer-1');
```

The bridge exposes:

- `app`
- `context`
- `request`
- `response`
- `resolve(binding)`
- `resolveSync(binding)`
- `isBound(binding)`

## Custom Routes

Mastra `apiRoutes` are registered as native LoopBack routes and receive the same
request-scoped bridge:

```typescript
import { registerApiRoute } from '@mastra/core/server';

mastra.setServer({
  apiRoutes: [
    registerApiRoute('/customer/:id', {
      method: 'GET',
      handler: async c => {
        const requestContext = c.get('requestContext');
        const loopback = requestContext.get('loopback');
        const customerService = await loopback.resolve('services.CustomerService');

        return c.json(customerService.findById(c.req.param('id')));
      },
      openapi: {
        summary: 'Get customer by id',
      },
    }),
  ],
});
```

## Auth Configuration

The adapter supports composing custom authorization with Mastra route auth.

```typescript
const server = new LoopbackMastraServer({
  app,
  mastra,
  config: {
    prefix: '/api/mastra',
    auth: {
      authorizeMode: 'after',
      authorize: async input => {
        return input.getHeader('x-tenant-id') ? null : { status: 403, error: 'Tenant header required' };
      },
      resolveContextMode: 'replace',
      resolveContext: async input => ({
        userId: input.headers['x-user-id'] as string | undefined,
      }),
    },
  },
});
```

Supported composition modes:

- `authorizeMode`: `before`, `after`, `replace`
- `resolveContextMode`: `before`, `after`, `replace`

## Related Links

- [Server Adapters Documentation](https://mastra.ai/docs/server/server-adapters)
- [LoopBack 4 Documentation](https://loopback.io/doc/en/lb4/)
