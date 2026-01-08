# Plan: Add `requiresAuth` to ServerRoute with Per-Route Auth Checks

## Overview

Refactor the authentication system to add `requiresAuth` directly to `ServerRoute` and perform auth checks inside `registerRoute()` in each server adapter. This eliminates the need for the `customRouteAuthConfig` map and route matching logic, making auth handling more explicit and efficient.

## Goals

1. Add `requiresAuth` property to `ServerRoute` type
2. Explicitly set `requiresAuth` on ALL existing route definitions (no implicit defaults)
3. Perform auth checks directly inside `registerRoute()` in each adapter
4. Maintain backwards compatibility with existing `customRouteAuthConfig` approach
5. Keep current default behavior: routes are **protected by default** (`requiresAuth: true`)

## Current Architecture

### How Auth Works Today

1. **Custom Routes (`ApiRoute`)**: User-defined routes via `registerApiRoute()` or `server.apiRoutes`
   - `requiresAuth` property exists but defaults to `true` (protected)
   - A `customRouteAuthConfig` Map is built: `Map<"METHOD:path", boolean>`
   - Auth middleware calls `isProtectedPath()` which does string/regex matching

2. **Built-in Routes (`ServerRoute`)**: Mastra API routes (agents, workflows, etc.)
   - No `requiresAuth` property currently
   - Rely on `defaultAuthConfig.protected: ['/api/*']` pattern matching
   - Auth middleware uses `isAnyMatch()` for pattern matching

3. **Auth Middleware Flow** (same in all 4 adapters):
   ```
   Request → authenticationMiddleware → authorizationMiddleware → Route Handler
                    ↓                           ↓
              isProtectedPath()           canAccessPublicly()
                    ↓                           ↓
              Pattern matching           Pattern matching
   ```

### Files Involved

| File                                                                | Purpose                                      |
| ------------------------------------------------------------------- | -------------------------------------------- |
| `packages/core/src/server/types.ts`                                 | `ApiRoute` type with `requiresAuth`          |
| `packages/server/src/server/server-adapter/routes/index.ts`         | `ServerRoute` type                           |
| `packages/server/src/server/server-adapter/routes/route-builder.ts` | `createRoute()` helper                       |
| `packages/server/src/server/auth/helpers.ts`                        | `isProtectedPath()`, `isCustomRoutePublic()` |
| `packages/server/src/server/auth/defaults.ts`                       | `defaultAuthConfig` with patterns            |
| `packages/deployer/src/server/index.ts`                             | Builds `customRouteAuthConfig` map           |
| `server-adapters/hono/src/auth-middleware.ts`                       | Hono auth middleware                         |
| `server-adapters/express/src/auth-middleware.ts`                    | Express auth middleware                      |
| `server-adapters/fastify/src/auth-middleware.ts`                    | Fastify auth middleware                      |
| `server-adapters/koa/src/auth-middleware.ts`                        | Koa auth middleware                          |

---

## Implementation Plan

### Phase 1: Update Types and Route Builder

#### 1.1 Add `requiresAuth` to `RouteConfig` in route-builder.ts

**File:** `packages/server/src/server/server-adapter/routes/route-builder.ts`

Add `requiresAuth` to the `RouteConfig` interface:

```typescript
interface RouteConfig<...> {
  method: ServerRoute['method'];
  path: string;
  responseType: TResponseType;
  // ... existing fields
  requiresAuth?: boolean; // NEW: Explicit auth requirement for this route
}
```

Update `createRoute()` to pass through `requiresAuth`:

```typescript
export function createRoute<...>(config: RouteConfig<...>): ServerRoute<...> {
  const { summary, description, tags, deprecated, requiresAuth, ...baseRoute } = config;

  // ... existing openapi generation

  return {
    ...baseRoute,
    openapi: openapi as any,
    deprecated,
    requiresAuth, // NEW: Include in returned route
  };
}
```

#### 1.2 Verify `ServerRoute` type includes `requiresAuth`

**File:** `packages/server/src/server/server-adapter/routes/index.ts`

`ServerRoute` extends `ApiRoute` via `Omit<ApiRoute, 'handler' | 'createHandler'>`, which already includes `requiresAuth`. Verify this is working correctly, or make it explicit:

```typescript
export type ServerRoute<...> = Omit<ApiRoute, 'handler' | 'createHandler'> & {
  responseType: TResponseType;
  // ... existing fields
  requiresAuth?: boolean; // Make explicit if needed
};
```

---

### Phase 2: Add `requiresAuth` to ALL Existing Routes

Add explicit `requiresAuth: true` to every route definition. This is important because we want NO implicit defaults - every route should explicitly declare its auth requirement.

#### Route Files to Update

All routes use `createRoute()`, so we need to add `requiresAuth: true` to each call:

| File                                                                | Routes                                               |
| ------------------------------------------------------------------- | ---------------------------------------------------- |
| `packages/server/src/server/handlers/agents.ts`                     | `GENERATE_AGENT_ROUTE`, `GENERATE_AGENT_VNEXT_ROUTE` |
| `packages/server/src/server/server-adapter/routes/agents.ts`        | `AGENTS_ROUTES` (multiple)                           |
| `packages/server/src/server/server-adapter/routes/workflows.ts`     | `WORKFLOWS_ROUTES`                                   |
| `packages/server/src/server/server-adapter/routes/tools.ts`         | `TOOLS_ROUTES`                                       |
| `packages/server/src/server/server-adapter/routes/memory.ts`        | `MEMORY_ROUTES`                                      |
| `packages/server/src/server/server-adapter/routes/vectors.ts`       | `VECTORS_ROUTES`                                     |
| `packages/server/src/server/server-adapter/routes/scorers.ts`       | `SCORES_ROUTES`                                      |
| `packages/server/src/server/server-adapter/routes/observability.ts` | `OBSERVABILITY_ROUTES`                               |
| `packages/server/src/server/server-adapter/routes/logs.ts`          | `LOGS_ROUTES`                                        |
| `packages/server/src/server/server-adapter/routes/processors.ts`    | `PROCESSORS_ROUTES`                                  |
| `packages/server/src/server/server-adapter/routes/a2a.ts`           | `A2A_ROUTES`                                         |
| `packages/server/src/server/server-adapter/routes/agent-builder.ts` | `AGENT_BUILDER_ROUTES`                               |
| `packages/server/src/server/server-adapter/routes/legacy.ts`        | `LEGACY_ROUTES`                                      |
| `packages/server/src/server/server-adapter/routes/mcp.ts`           | `MCP_ROUTES`                                         |
| `packages/server/src/server/server-adapter/routes/stored-agents.ts` | `STORED_AGENTS_ROUTES`                               |
| `packages/server/src/server/server-adapter/routes/system.ts`        | `SYSTEM_ROUTES`                                      |

**Example change:**

```typescript
// Before
export const GET_SYSTEM_PACKAGES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/system/packages',
  responseType: 'json',
  // ...
});

// After
export const GET_SYSTEM_PACKAGES_ROUTE = createRoute({
  method: 'GET',
  path: '/api/system/packages',
  responseType: 'json',
  requiresAuth: true, // Explicit auth requirement
  // ...
});
```

---

### Phase 3: Add Auth Check Helper to Base Server Adapter

#### 3.1 Create shared auth check function

**File:** `packages/server/src/server/server-adapter/index.ts`

Add a method that encapsulates the auth check logic. This will be called from `registerRoute()`:

```typescript
/**
 * Check if the current request should be authenticated/authorized.
 * Returns null if auth passes, or an error response if it fails.
 */
protected async checkRouteAuth(
  route: ServerRoute,
  context: {
    path: string;
    method: string;
    getHeader: (name: string) => string | undefined;
    getQuery: (name: string) => string | undefined;
    requestContext: RequestContext;
  }
): Promise<{ status: number; error: string } | null> {
  const authConfig = this.mastra.getServer()?.auth;

  // No auth config means no auth required
  if (!authConfig) {
    return null;
  }

  // Check route-level requiresAuth flag first (explicit per-route setting)
  // Default to true (protected) if not specified for backwards compatibility
  if (route.requiresAuth === false) {
    return null; // Route explicitly opts out of auth
  }

  // Dev playground bypass
  if (isDevPlaygroundRequest(context.path, context.method, context.getHeader, authConfig)) {
    return null;
  }

  // Check if path is publicly accessible via auth config patterns
  if (canAccessPublicly(context.path, context.method, authConfig)) {
    return null;
  }

  // --- Authentication ---
  const authHeader = context.getHeader('authorization');
  let token: string | null = authHeader ? authHeader.replace('Bearer ', '') : null;

  if (!token) {
    token = context.getQuery('apiKey') || null;
  }

  if (!token) {
    return { status: 401, error: 'Authentication required' };
  }

  let user: unknown;
  try {
    if (typeof authConfig.authenticateToken === 'function') {
      user = await authConfig.authenticateToken(token, /* request */);
    } else {
      return { status: 401, error: 'No token verification method configured' };
    }

    if (!user) {
      return { status: 401, error: 'Invalid or expired token' };
    }

    context.requestContext.set('user', user);
  } catch (err) {
    console.error(err);
    return { status: 401, error: 'Invalid or expired token' };
  }

  // --- Authorization ---
  // (Similar logic from authorizationMiddleware)
  // Check authorizeUser, authorize, rules...

  return null; // Auth passed
}
```

**Decision:** `checkRouteAuth()` will be a **concrete method on the base `MastraServer` class** in `packages/server/src/server/server-adapter/index.ts`. Each adapter's `registerRoute()` will call `this.checkRouteAuth()` with a normalized context object containing the adapter-specific request data.

This approach:

- Keeps auth logic centralized and DRY
- Allows adapters to construct the context object from their specific request types
- Makes it easy to update auth logic in one place

---

### Phase 4: Update `registerRoute()` in Each Adapter

Each adapter's `registerRoute()` method will call `this.checkRouteAuth()` (inherited from the base class) at the start of the route handler, passing a normalized context object constructed from the adapter's specific request type.

#### 4.1 Hono Adapter

**File:** `server-adapters/hono/src/index.ts`

```typescript
async registerRoute(app: HonoApp, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void> {
  // ... existing middleware setup (body limit, etc.)

  app[route.method.toLowerCase()](
    `${prefix}${route.path}`,
    ...middlewares,
    async (c: Context) => {
      // NEW: Call base class auth check with normalized context
      const authError = await this.checkRouteAuth(route, {
        path: c.req.path,
        method: c.req.method,
        getHeader: (name) => c.req.header(name),
        getQuery: (name) => c.req.query(name),
        requestContext: c.get('requestContext'),
      });

      if (authError) {
        return c.json({ error: authError.error }, authError.status);
      }

      // ... rest of existing handler logic (param parsing, handler call, etc.)
    },
  );
}
```

#### 4.2 Express Adapter

**File:** `server-adapters/express/src/index.ts`

```typescript
async registerRoute(app: Application, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void> {
  // ... existing middleware setup

  app[route.method.toLowerCase()](
    `${prefix}${route.path}`,
    ...middlewares,
    async (req: Request, res: Response) => {
      // NEW: Call base class auth check with normalized context
      const authError = await this.checkRouteAuth(route, {
        path: req.path,
        method: req.method,
        getHeader: (name) => req.headers[name.toLowerCase()] as string | undefined,
        getQuery: (name) => req.query[name] as string | undefined,
        requestContext: res.locals.requestContext,
      });

      if (authError) {
        return res.status(authError.status).json({ error: authError.error });
      }

      // ... rest of existing handler logic
    },
  );
}
```

#### 4.3 Fastify Adapter

**File:** `server-adapters/fastify/src/index.ts`

```typescript
async registerRoute(app: FastifyInstance, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void> {
  // ... existing setup

  app.route({
    method: route.method,
    url: `${prefix}${route.path}`,
    handler: async (request, reply) => {
      // NEW: Call base class auth check with normalized context
      const authError = await this.checkRouteAuth(route, {
        path: String(request.url.split('?')[0] || '/'),
        method: String(request.method || 'GET'),
        getHeader: (name) => request.headers[name.toLowerCase()] as string | undefined,
        getQuery: (name) => (request.query as Record<string, string>)[name],
        requestContext: request.requestContext,
      });

      if (authError) {
        return reply.status(authError.status).send({ error: authError.error });
      }

      // ... rest of existing handler logic
    },
  });
}
```

#### 4.4 Koa Adapter

**File:** `server-adapters/koa/src/index.ts`

```typescript
async registerRoute(app: Koa, route: ServerRoute, { prefix }: { prefix?: string }): Promise<void> {
  // ... existing setup using koa-router

  router[route.method.toLowerCase()](
    `${prefix}${route.path}`,
    async (ctx: Context) => {
      // NEW: Call base class auth check with normalized context
      const authError = await this.checkRouteAuth(route, {
        path: String(ctx.path || '/'),
        method: String(ctx.method || 'GET'),
        getHeader: (name) => ctx.headers[name.toLowerCase()] as string | undefined,
        getQuery: (name) => (ctx.query as Record<string, string>)[name],
        requestContext: ctx.state.requestContext,
      });

      if (authError) {
        ctx.status = authError.status;
        ctx.body = { error: authError.error };
        return;
      }

      // ... rest of existing handler logic
    },
  );
}
```

---

### Phase 5: Maintain Backwards Compatibility

The existing auth middleware and `customRouteAuthConfig` should continue to work for custom `ApiRoute` routes registered via `server.apiRoutes`. The new per-route auth check in `registerRoute()` is only for `ServerRoute` (built-in Mastra routes).

#### 5.1 Keep existing auth middleware

**Files:**

- `server-adapters/hono/src/auth-middleware.ts`
- `server-adapters/express/src/auth-middleware.ts`
- `server-adapters/fastify/src/auth-middleware.ts`
- `server-adapters/koa/src/auth-middleware.ts`

These should continue to work as-is for custom routes. The `customRouteAuthConfig` map is still built in `packages/deployer/src/server/index.ts` for custom `ApiRoute` routes.

#### 5.2 Auth check priority

The auth flow becomes:

1. **For `ServerRoute` (built-in routes):** Auth checked in `registerRoute()` using `route.requiresAuth`
2. **For `ApiRoute` (custom routes):** Auth checked in global middleware using `customRouteAuthConfig` map

Since built-in routes go through `registerRoute()` and custom routes don't (they're registered directly on the app), there's no conflict.

---

### Phase 6: Update Tests

#### 6.1 New tests for `requiresAuth` on `ServerRoute`

**File:** `packages/server/src/server/server-adapter/routes/route-builder.test.ts` (create or update)

```typescript
describe('createRoute', () => {
  it('should include requiresAuth in returned route', () => {
    const route = createRoute({
      method: 'GET',
      path: '/test',
      responseType: 'json',
      requiresAuth: true,
      handler: async () => ({}),
    });

    expect(route.requiresAuth).toBe(true);
  });

  it('should allow requiresAuth: false', () => {
    const route = createRoute({
      method: 'GET',
      path: '/public',
      responseType: 'json',
      requiresAuth: false,
      handler: async () => ({}),
    });

    expect(route.requiresAuth).toBe(false);
  });
});
```

#### 6.2 Integration tests for per-route auth

Add tests verifying:

- Routes with `requiresAuth: true` require authentication
- Routes with `requiresAuth: false` are publicly accessible
- Auth config patterns still work as fallback

#### 6.3 Existing tests to update

- `packages/server/src/server/auth/helpers.test.ts` - May need updates if `isProtectedPath` signature changes
- `packages/deployer/src/server/__tests__/auth-integration.test.ts` - Verify backwards compatibility

---

## File Change Summary

| File                                                                | Change Type | Description                                             |
| ------------------------------------------------------------------- | ----------- | ------------------------------------------------------- |
| `packages/server/src/server/server-adapter/routes/route-builder.ts` | Modify      | Add `requiresAuth` to `RouteConfig` and `createRoute()` |
| `packages/server/src/server/server-adapter/routes/index.ts`         | Verify      | Ensure `requiresAuth` is in `ServerRoute` type          |
| `packages/server/src/server/server-adapter/index.ts`                | Modify      | Add `checkRouteAuth()` helper method                    |
| `packages/server/src/server/handlers/agents.ts`                     | Modify      | Add `requiresAuth: true` to routes                      |
| `packages/server/src/server/server-adapter/routes/agents.ts`        | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/workflows.ts`     | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/tools.ts`         | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/memory.ts`        | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/vectors.ts`       | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/scorers.ts`       | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/observability.ts` | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/logs.ts`          | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/processors.ts`    | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/a2a.ts`           | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/agent-builder.ts` | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/legacy.ts`        | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/mcp.ts`           | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/stored-agents.ts` | Modify      | Add `requiresAuth: true` to all routes                  |
| `packages/server/src/server/server-adapter/routes/system.ts`        | Modify      | Add `requiresAuth: true` to all routes                  |
| `server-adapters/hono/src/index.ts`                                 | Modify      | Add auth check in `registerRoute()`                     |
| `server-adapters/express/src/index.ts`                              | Modify      | Add auth check in `registerRoute()`                     |
| `server-adapters/fastify/src/index.ts`                              | Modify      | Add auth check in `registerRoute()`                     |
| `server-adapters/koa/src/index.ts`                                  | Modify      | Add auth check in `registerRoute()`                     |

---

## Testing Strategy

1. **Unit Tests:** Test `createRoute()` includes `requiresAuth` in output
2. **Integration Tests:**
   - Test routes with `requiresAuth: true` reject unauthenticated requests
   - Test routes with `requiresAuth: false` allow unauthenticated requests
   - Test custom `ApiRoute` routes still work with `customRouteAuthConfig`
3. **Manual Testing:**
   - Run `mastra dev` and verify protected routes require auth
   - Verify public routes are accessible
   - Test with all 4 server adapters

---

## Rollout Plan

1. **Phase 1-2:** Update types and add `requiresAuth` to all routes (non-breaking)
2. **Phase 3-4:** Add auth check in `registerRoute()` (non-breaking, additive)
3. **Phase 5:** Verify backwards compatibility
4. **Phase 6:** Add tests
5. **Release:** Include in next minor version with changelog entry

---

## Decisions Made

1. **Auth check placement:** `checkRouteAuth()` will be a **concrete method on the base `MastraServer` class** (shared logic). Each adapter's `registerRoute()` calls `this.checkRouteAuth()`.

2. **Request object handling:** Each adapter passes a **normalized context object** to `checkRouteAuth()` containing:
   - `path: string`
   - `method: string`
   - `getHeader: (name: string) => string | undefined`
   - `getQuery: (name: string) => string | undefined`
   - `requestContext: RequestContext`

## Open Questions

1. **Future deprecation:** Should we plan to deprecate `customRouteAuthConfig` in a future major version, or keep it indefinitely for backwards compatibility?

---

## Changelog Entry (Draft)

```markdown
### @mastra/server

- Added `requiresAuth` property to `ServerRoute` type for explicit per-route authentication control
- All built-in Mastra API routes now explicitly declare `requiresAuth: true`
- Auth checks are now performed directly in `registerRoute()` for built-in routes, eliminating route matching overhead

### server-adapters (hono, express, fastify, koa)

- Updated `registerRoute()` to perform per-route auth checks based on `route.requiresAuth`
- Maintains backwards compatibility with existing `customRouteAuthConfig` for custom API routes
```
