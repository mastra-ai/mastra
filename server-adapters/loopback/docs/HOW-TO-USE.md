# How To Use `@mastra/loopback`

This adapter lets Mastra run inside an existing LoopBack 4 application while
preserving LoopBack's request-scoped DI model.

It does **not** automatically convert your LoopBack controllers or REST APIs
into Mastra tools or agents.

What it does provide is a bridge so Mastra code can resolve LoopBack-managed
services, repositories, models, and other bindings from the current request
context.

## Core Idea

LoopBack remains your application framework and system of record.

Mastra becomes an AI orchestration layer that runs inside the LoopBack app.

With this adapter:

- LoopBack still owns:
  - repositories
  - services
  - datasources
  - bindings
  - auth and request context
- Mastra can access those through `requestContext.get('loopback')`

## What This Adapter Does

Inside a Mastra route, tool, or agent execution path, the adapter injects a
LoopBack bridge into Mastra `RequestContext`.

Example:

```ts
const loopback = requestContext.get('loopback');
const customerService = await loopback.resolve('services.CustomerService');
```

That bridge exposes:

- `app`
- `context`
- `request`
- `response`
- `resolve(binding)`
- `resolveSync(binding)`
- `isBound(binding)`

The adapter also lets you customize or replace its built-in auth behavior:

- `config.auth.authorize`
- `config.auth.authorizeMode`
- `config.auth.resolveContext`
- `config.auth.resolveContextMode`
- `config.auth.extractContext`

## What This Adapter Does Not Do

It does **not** automatically:

- turn existing LoopBack controllers into Mastra tools
- turn existing LoopBack endpoints into agents
- introspect your entire LoopBack app and generate AI behavior

You explicitly decide what Mastra should expose:

- as a custom Mastra route
- as a Mastra tool
- through a Mastra agent that uses those tools

## Recommended Architecture

The cleanest architecture is:

1. LoopBack repositories and services hold business logic
2. Mastra tools call those repositories/services
3. Agents call those tools
4. The adapter provides request-scoped DI bridging

That means:

- LoopBack stays authoritative
- Mastra handles orchestration and reasoning
- no duplication of domain logic

## Usage Patterns

There are three main patterns.

### 1. Mastra Custom Route -> LoopBack Service

Use this when you want an HTTP endpoint served by Mastra but backed by existing
LoopBack business logic.

Example:

```ts
import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { RestApplication } from '@loopback/rest';
import { LoopbackMastraServer } from '@mastra/loopback';

class CustomerService {
  async getCustomerSummary(id: string) {
    return { id, status: 'active' };
  }
}

const app = new RestApplication();
app.bind('services.CustomerService').to(new CustomerService());

const mastra = new Mastra();
mastra.setServer({
  apiRoutes: [
    registerApiRoute('/ai/customer/:id', {
      method: 'GET',
      handler: async c => {
        const requestContext = c.get('requestContext');
        const loopback = requestContext.get('loopback');
        const customerService = await loopback.resolve('services.CustomerService');

        return c.json(await customerService.getCustomerSummary(c.req.param('id')));
      },
      openapi: {
        summary: 'AI customer summary',
      },
    }),
  ],
});

const adapter = new LoopbackMastraServer({
  app,
  mastra,
  config: {
    prefix: '/api/mastra',
    enableAuth: false,
  },
});

await adapter.init();
```

Flow:

1. Request hits LoopBack
2. Adapter routes it into Mastra
3. Mastra route resolves LoopBack service from DI
4. Service returns domain data
5. Response is sent through LoopBack

### 2. Mastra Tool -> LoopBack Repository/Service

Use this when an agent or workflow should call real application logic.

Example:

```ts
const getCustomerTool = createTool({
  id: 'get-customer',
  description: 'Fetch a customer from the main LoopBack app',
  inputSchema: z.object({
    customerId: z.string(),
  }),
  execute: async (input, toolContext) => {
    const requestContext = toolContext.requestContext;
    if (!requestContext) {
      throw new Error('requestContext is required');
    }
    const loopback = requestContext.get('loopback');
    const customerRepository = await loopback.resolve('repositories.CustomerRepository');

    return customerRepository.findById(input.customerId);
  },
});
```

This is usually better than making the agent call your own HTTP API because:

- it stays inside the app boundary
- it uses LoopBack request-scoped DI
- it avoids duplicate network layers
- it can respect current auth and tenant context

### 3. Agent -> Tool -> LoopBack Service

This is the most useful pattern when you want real AI behavior over existing
app capabilities.

Example:

```ts
const mastra = new Mastra({
  agents: {
    support: new Agent({
      name: 'support',
      instructions: 'Help support staff answer customer questions',
      model: 'openai/gpt-5',
      tools: {
        getCustomerTool,
      },
    }),
  },
});
```

Now the agent does not need to know about LoopBack directly.

It calls a tool.

The tool resolves LoopBack services/repositories through `requestContext`.

## Custom Auth Strategies

You can compose your own authorization with Mastra route auth or replace it.

Example:

```ts
const adapter = new LoopbackMastraServer({
  app,
  mastra,
  config: {
    prefix: '/api/mastra',
    auth: {
      authorizeMode: 'replace',
      authorize: async input => {
        return input.getHeader('x-api-key') === 'loopback-secret' ? null : { status: 403, error: 'Forbidden' };
      },
      resolveContextMode: 'replace',
      resolveContext: async input => ({
        userId: input.headers['x-user-id'] as string | undefined,
        raw: { strategy: 'custom' },
      }),
    },
  },
});
```

Auth composition modes:

- `authorizeMode: 'before'`: custom authorizer first, then Mastra route auth
- `authorizeMode: 'after'`: Mastra route auth first, then custom authorizer
- `authorizeMode: 'replace'`: only custom authorizer runs
- `resolveContextMode: 'before'`: custom context resolver first, then default extraction
- `resolveContextMode: 'after'`: default extraction first, then custom resolver
- `resolveContextMode: 'replace'`: only custom resolver runs

### Loopback4 Authentication + Authorization

If your LoopBack app already uses loopback4 auth packages, keep them as the
source of truth and call them from the adapter auth hooks.

One practical pattern is:

1. `loopback4-authentication` verifies the bearer token through
   `Strategies.Passport.BEARER_TOKEN_VERIFIER`
2. the authenticated user is rebound into the current LoopBack request context
   with `AuthenticationBindings.CURRENT_USER`
3. `loopback4-authorization` checks route-specific permissions through
   `AuthorizationBindings.AUTHORIZE_ACTION`
4. the adapter maps the authenticated user into Mastra `requestContext` so
   tools, routes, and agents can access both auth state and LoopBack DI

The practical effect is:

- LoopBack auth remains authoritative
- Mastra routes do not bypass your JWT verification logic
- tools and agents can still resolve LoopBack services/repositories after auth

## Example In An Existing LoopBack App

Assume your LoopBack app already has:

- `CustomerRepository`
- `CustomerService`
- `OrderService`
- existing auth and tenant bindings

You do **not** replace them.

You add Mastra alongside them.

Example:

```ts
import { RestApplication } from '@loopback/rest';
import { Mastra } from '@mastra/core';
import { registerApiRoute } from '@mastra/core/server';
import { LoopbackMastraServer } from '@mastra/loopback';

const app = new RestApplication();

// Existing LoopBack bindings remain unchanged
app.bind('services.CustomerService').toClass(CustomerService);
app.bind('repositories.CustomerRepository').toClass(CustomerRepository);

const mastra = new Mastra();
mastra.setServer({
  apiRoutes: [
    registerApiRoute('/customer/:id', {
      method: 'GET',
      handler: async c => {
        const requestContext = c.get('requestContext');
        const loopback = requestContext.get('loopback');
        const customerService = await loopback.resolve('services.CustomerService');

        return c.json(await customerService.getCustomerSummary(c.req.param('id')));
      },
      openapi: {
        summary: 'Customer summary from existing LoopBack service',
      },
    }),
  ],
});

const adapter = new LoopbackMastraServer({
  app,
  mastra,
  config: {
    prefix: '/api/mastra',
  },
});

await adapter.init();
```

## How Existing LoopBack APIs Fit In

Your existing LoopBack APIs can be used in two ways:

### Option A: Use underlying services/repositories directly

This is the preferred approach.

Instead of having Mastra call your own REST endpoints, have Mastra call the
underlying LoopBack service or repository through DI.

Why:

- less overhead
- less duplication
- better access to request-scoped context
- easier to keep business logic in one place

### Option B: Wrap existing APIs explicitly

If you really want a tool that calls an existing HTTP endpoint, you can do that,
but that is just ordinary HTTP composition. It is not the main advantage of the
adapter.

The adapter is most valuable when Mastra uses the **same DI-managed domain
objects** your LoopBack app already uses.

## Auth And Tenant Context

Mastra auth rules are evaluated against the **prefixed** LoopBack route path.

Example:

```ts
mastra.setServer({
  auth: {
    protected: ['/api/mastra/secure/*', '/api/mastra/customer/*'],
    authenticateToken: async token => {
      if (token === 'valid-token') return { id: 'user-1' };
      return null;
    },
  },
});
```

Because the adapter uses Mastra `RequestContext`, authenticated values placed
there can be consumed by tools and handlers during the same request.

## OpenAPI

If you enable `openapiPath`, the adapter registers a prefixed OpenAPI route.

Custom Mastra routes are included in the spec when they define `openapi`
metadata.

Example:

```ts
const adapter = new LoopbackMastraServer({
  app,
  mastra,
  config: {
    prefix: '/api/mastra',
    openapiPath: '/openapi.json',
  },
});
```

Then:

```text
/api/mastra/openapi.json
```

## When This Adapter Is Useful

This is a good fit when:

- you already have a mature LoopBack backend
- you want to add AI capabilities incrementally
- you want agents to use real domain logic
- you need tenant/auth/request context preserved
- you do not want to duplicate repository/service code

## When This Adapter Is Not Enough

This adapter is not a code generator.

If you want:

- automatic tool generation from controllers
- automatic API-to-tool conversion
- agent generation from your entire LoopBack app

that would need a separate layer on top of this adapter.

## Bottom Line

Use this adapter so Mastra can run **inside** a LoopBack app and use
LoopBack-managed domain objects through DI.

Do not think of it as:

- "LoopBack APIs automatically become tools"

Think of it as:

- "Mastra gets request-scoped access to the same services and repositories my
  LoopBack app already uses"
