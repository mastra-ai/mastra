# Architecture

This document describes the architecture currently implemented by the
`@mastra/loopback` adapter.

## Goals

The adapter is built around four goals.

1. Register Mastra routes as native LoopBack 4 routes without mounting Express.
2. Preserve LoopBack request-scoped DI so Mastra handlers, tools, and agents can
   resolve LoopBack bindings during a request.
3. Preserve Mastra server semantics such as route auth, request context,
   streaming, MCP, and custom API routes.
4. Keep framework integration code modular enough to contribute upstream.

## High-Level Design

The adapter follows a layered design.

1. `LoopbackMastraServer` is the facade and orchestrator.
2. `internal/request-runtime.ts` owns request-time compatibility logic such as
   auth, request parsing, tool/task-store lookup, and stream redaction.
3. `internal/route-entry-factory.ts` owns LoopBack `RouteEntry` creation and
   abort lifecycle wiring.
4. `internal/request-utils.ts` owns request-context creation, bridge creation,
   request normalization, and request-context binding.
5. `internal/response-writer.ts` owns response transport behavior for JSON,
   streams, data streams, and MCP.
6. `providers/` and `component.ts` expose request-scoped values back into
   LoopBack DI.

This splits the adapter into orchestration, request lifecycle, transport, and
DI-support concerns.

## Request Lifecycle

A normal Mastra route request flows through these stages.

1. LoopBack receives the HTTP request through a native `RouteEntry`.
2. `createLoopbackRouteEntry(...)` creates an `AbortController`, binds the
   current OpenAPI operation spec, and watches request/response close events.
3. `LoopbackMastraServer.registerRoute(...)` delegates request execution to
   `handleRegisteredRouteInvocation(...)`.
4. The adapter extracts raw params from the LoopBack request using
   `getParams(...)`.
5. `LoopbackRequestRuntime` applies Mastra-compatible parse hooks for query,
   body, and path params.
6. `createMastraRequestContext(...)` builds a real Mastra `RequestContext` and
   injects the LoopBack bridge under `requestContext.get('loopback')`.
7. `LoopbackRequestRuntime.checkRouteAuth(...)` runs authorization according to
   the configured composition mode.
8. `LoopbackRequestRuntime.resolveAuthContext(...)` maps authenticated state
   into a normalized adapter auth context.
9. `bindRequestContextValues(...)` publishes request-scoped values into the
   current LoopBack request context.
10. The Mastra route handler executes.
11. `LoopbackResponseWriter` serializes the handler result back to the
    LoopBack response.
12. Request logging runs at the end when enabled.

## Core Runtime Objects

### `LoopbackMastraServer`

File:

- [src/loopback-mastra-server.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/loopback-mastra-server.ts)

Responsibilities:

- extend Mastra's `MastraServer`
- register native LoopBack routes
- register custom Mastra API routes
- install support bindings and component helpers
- coordinate request parsing, auth checks, handler invocation, and response
  writing
- expose Mastra adapter lifecycle methods expected by the base server

This class is intentionally a facade. It coordinates collaborators but avoids
owning all transport and auth logic directly.

### `LoopbackRequestRuntime`

File:

- [src/internal/request-runtime.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/internal/request-runtime.ts)

Responsibilities:

- query/body/path param compatibility hooks
- route auth compatibility with Mastra
- custom auth composition
- auth-context resolution
- tool and task-store lookup
- stream redaction hook access

This is the compatibility boundary between LoopBack request handling and Mastra
runtime semantics.

### `LoopbackResponseWriter`

File:

- [src/internal/response-writer.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/internal/response-writer.ts)

Responsibilities:

- write normal JSON/text/buffer responses
- write streaming responses
- write `datastream-response`
- bridge `mcp-http`
- bridge `mcp-sse`
- normalize fetch-like responses

This isolates transport output behavior from the server facade.

### `createLoopbackRouteEntry(...)`

File:

- [src/internal/route-entry-factory.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/internal/route-entry-factory.ts)

Responsibilities:

- build native LoopBack `RouteEntry` objects
- bind current operation spec into the request context
- create and manage `AbortController`
- map request/response lifecycle events to request abortion

This is the transport entry point into the adapter.

### Request Utilities

File:

- [src/internal/request-utils.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/internal/request-utils.ts)

Responsibilities:

- create Mastra request context
- create the LoopBack bridge object
- normalize params and headers
- convert LoopBack requests into web `Request` objects for Mastra auth hooks
- bind request-scoped values back into LoopBack DI

## DI Bridge Design

A core feature of this adapter is the request-scoped DI bridge.

### Mastra-side bridge

For every request, the adapter creates a bridge object and stores it inside the
Mastra `RequestContext` under `loopback`.

Example:

```ts
const loopback = requestContext.get('loopback');
const repo = await loopback.resolve('repositories.CustomerRepository');
```

The bridge exposes:

- `app`
- `context`
- `request`
- `response`
- `resolve(binding)`
- `resolveSync(binding)`
- `isBound(binding)`

This allows Mastra routes, tools, and agents to reuse real LoopBack services,
repositories, and other bindings from the active request scope.

### LoopBack-side providers

The adapter also publishes request-scoped Mastra values back into LoopBack via
bindings and providers.

Bindings:

- [src/bindings.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/bindings.ts)

Component:

- [src/component.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/component.ts)

Providers:

- [src/providers/request-context.provider.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/providers/request-context.provider.ts)
- [src/providers/auth-context.provider.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/providers/auth-context.provider.ts)
- [src/providers/abort-signal.provider.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/providers/abort-signal.provider.ts)
- [src/providers/loopback-bridge.provider.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/providers/loopback-bridge.provider.ts)

Request-scoped values published during route execution:

- Mastra request context
- normalized auth context
- abort signal
- LoopBack bridge

This allows LoopBack-managed code to resolve Mastra request state when needed.

## Auth Architecture

Auth is intentionally composable.

Types:

- [src/types.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/types.ts)

Config surface:

- `config.enableAuth`
- `config.auth.enabled`
- `config.auth.authorize`
- `config.auth.authorizeMode`
- `config.auth.resolveContext`
- `config.auth.resolveContextMode`
- `config.auth.extractContext`
- legacy `config.authResolver`

### Authorization modes

`LoopbackRequestRuntime.checkRouteAuth(...)` supports three modes.

- `before`: custom authorizer runs first, then Mastra route auth
- `after`: Mastra route auth runs first, then custom authorizer
- `replace`: only custom authorizer runs

This is what lets consumers plug in framework-native auth such as
`loopback4-authentication`, JWT strategies, or organization-specific RBAC.

### Auth-context resolution modes

`LoopbackRequestRuntime.resolveAuthContext(...)` supports:

- `before`
- `after`
- `replace`

This lets consumers control how identity/session state is projected into the
adapter's normalized `MastraAuthContext`.

### Why auth is not hard-coded to one LoopBack library

The adapter is upstream-oriented and should not force one authentication stack.

Instead of coupling directly to one LoopBack auth extension, it exposes a
composable auth hook surface so consumers can:

- keep Mastra route auth only
- compose Mastra route auth with framework auth
- fully replace adapter-managed authorization with their own stack

## Route Registration Model

The adapter supports two route categories.

### Registered Mastra routes

Mastra core/server routes are registered through `registerRoute(...)`.

Key points:

- Mastra paths like `:id` are converted to LoopBack paths like `{id}`
- a minimal OpenAPI operation spec is generated when needed
- each route becomes a native LoopBack `RouteEntry`

### Custom API routes

Mastra `apiRoutes` are registered through `registerCustomApiRoutes()`.

Key points:

- custom route auth config is synchronized with the adapter
- `ALL` routes are expanded to common concrete HTTP verbs
- custom routes use the same request lifecycle and DI bridge as built-in Mastra
  routes

## Response Model

The response writer supports these route/result types.

- standard JSON/object responses
- text and buffer responses
- fetch-like responses
- `stream`
- `datastream-response`
- `mcp-http`
- `mcp-sse`

Streaming behavior:

- SSE routes emit `text/event-stream`
- standard stream routes emit chunked `text/plain`
- redaction hooks can transform chunks before they are written
- SSE routes emit a final `event: done` marker

## OpenAPI Model

Path/OpenAPI helpers live in:

- [src/internal/path-utils.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/internal/path-utils.ts)

Current behavior:

- converts Mastra route params to LoopBack route params
- extracts path param names
- creates a minimal operation spec when one is not provided
- preserves explicit custom-route `openapi` metadata when present

## Design Patterns Used

The implementation uses a few explicit patterns.

### Facade

`LoopbackMastraServer` is the facade over the adapter runtime.

### Factory

`createLoopbackRouteEntry(...)` builds the transport-specific route entry and
abort lifecycle wrapper.

### Strategy-style composition

Auth, auth-context resolution, and stream redaction all use strategy-like hooks
provided through adapter config and runtime hooks.

### Provider pattern

LoopBack providers expose request-scoped Mastra state back into the host app.

## Why the File Split Exists

`src/loopback-mastra-server.ts` used to accumulate all concerns in one file.
The current split exists to keep review and upstream contribution manageable.

The current responsibility split is:

- facade: `src/loopback-mastra-server.ts`
- request runtime: `src/internal/request-runtime.ts`
- request helpers: `src/internal/request-utils.ts`
- response transport: `src/internal/response-writer.ts`
- route-entry creation: `src/internal/route-entry-factory.ts`
- path/OpenAPI helpers: `src/internal/path-utils.ts`
- provider bindings: `src/bindings.ts`, `src/component.ts`, `src/providers/*`

This keeps transport, auth, DI, and runtime semantics separate.

## Tradeoffs

The architecture deliberately chooses these tradeoffs.

1. Native LoopBack routes over Express mount.
   - better DI fidelity
   - cleaner request-scope integration
   - more framework-native behavior

2. Configurable auth hooks over hard dependency on one auth extension.
   - broader compatibility
   - easier upstream adoption
   - slightly more work for consumers to compose framework auth

3. Minimal provider set instead of deep coupling to LoopBack sequence internals.
   - simpler adapter surface
   - easier contribution path into Mastra
   - leaves advanced auth/authorization sequencing to host apps

## Recommended Reading Order

If you are reviewing the codebase, read in this order.

1. [src/loopback-mastra-server.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/loopback-mastra-server.ts)
2. [src/internal/request-runtime.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/internal/request-runtime.ts)
3. [src/internal/request-utils.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/internal/request-utils.ts)
4. [src/internal/response-writer.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/internal/response-writer.ts)
5. [src/component.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/component.ts)
6. [src/providers/index.ts](https://github.com/mastra-ai/mastra/blob/main/server-adapters/loopback/src/providers/index.ts)

## Implementation Notes

The implementation has evolved in these ways:

- the architecture is more modular than the original sketch
- auth customization is broader than the original plan
- the DI bridge is now a first-class runtime concept
- transport and request-runtime logic are split into dedicated modules
