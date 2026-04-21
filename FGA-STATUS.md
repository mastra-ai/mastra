# FGA Implementation Status

_Updated April 14, 2026_

---

## Current State

The `feat/fga` branch adds Fine-Grained Authorization (FGA) to Mastra using the **WorkOS Authorization API** (`workos.authorization.*` — the current, non-deprecated module). The implementation spans core interfaces, enforcement hooks, a WorkOS adapter, tests, and docs.

### What's built

| Layer                                                                              | Status | Files                                                  |
| ---------------------------------------------------------------------------------- | ------ | ------------------------------------------------------ |
| `IFGAProvider` interface (read-only checks)                                        | Done   | `packages/core/src/auth/ee/interfaces/fga.ts`          |
| `IFGAManager` interface (read + write ops)                                         | Done   | same file                                              |
| `checkFGA` enforcement utility                                                     | Done   | `packages/core/src/auth/ee/fga-check.ts`               |
| `FGADeniedError` structured error                                                  | Done   | same file                                              |
| `server.fga` config on `ServerConfig`                                              | Done   | `packages/core/src/server/types.ts`                    |
| Capabilities endpoint reports `fga: boolean`                                       | Done   | `packages/core/src/auth/ee/capabilities.ts`            |
| Agent `generate()`/`stream()` enforcement                                          | Done   | `packages/core/src/agent/agent.ts`                     |
| Workflow `execute()` enforcement                                                   | Done   | `packages/core/src/workflows/workflow.ts`              |
| Tool execution enforcement                                                         | Done   | `packages/core/src/loop/.../tool-call-step.ts`         |
| List endpoint filtering (agents, tools, workflows)                                 | Done   | `packages/server/src/server/handlers/`                 |
| `MastraFGAWorkos` adapter                                                          | Done   | `auth/workos/src/fga-provider.ts`                      |
| FGA types + exports from `@mastra/auth-workos`                                     | Done   | `auth/workos/src/types.ts`, `auth/workos/src/index.ts` |
| Tests (interfaces, check, capabilities, middleware, agent, workflow, tool, memory) | Done   | Various `__tests__/` dirs                              |
| Docs page                                                                          | Done   | `docs/src/content/en/docs/server/auth/fga.mdx`         |
| Changesets                                                                         | Done   | `.changeset/`                                          |

---

## Quick Example

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthWorkos, MastraFGAWorkos } from '@mastra/auth-workos';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos({
      /* SSO + session config */
    }),
    fga: new MastraFGAWorkos({
      organizationId: 'org_abc123',

      // Map Mastra resource types to WorkOS FGA resource types
      resourceMapping: {
        agent: {
          fgaResourceType: 'team',
          deriveId: ctx => ctx.user.teamId,
        },
        workflow: {
          fgaResourceType: 'team',
          deriveId: ctx => ctx.user.teamId,
        },
        memory: {
          fgaResourceType: 'user',
          deriveId: ctx => ctx.user.userId,
        },
      },

      // Map Mastra permissions to WorkOS permission slugs
      permissionMapping: {
        'agents:execute': 'manage-workflows',
        'workflows:execute': 'manage-workflows',
        'memory:read': 'read',
        'memory:write': 'update',
      },
    }),
  },
  agents: {
    /* ... */
  },
});
```

When FGA is configured, calling `agent.generate()` automatically checks:

```
fga.require(user, { resource: { type: 'agent', id: 'chef-agent' }, permission: 'agents:execute' })
```

If denied, a `FGADeniedError` is thrown with structured context (user, resource, permission).

List endpoints (e.g., `GET /api/agents`) call `fga.filterAccessible()` to return only resources the user can see.

When FGA is **not** configured, all checks are no-ops — full backward compatibility.

---

## Known Issues

### 1. `filterAccessible` makes N individual API calls (N+1 problem)

The WorkOS adapter checks each resource one at a time:

```typescript
// Current: N network calls
const checks = await Promise.all(resources.map(r => this.check(user, { resource: { type, id: r.id }, permission })));
```

The WorkOS Authorization SDK has `listResourcesForMembership()` which returns all accessible resources in a single call. This should be used instead of N individual `check()` calls.

### 2. Membership fetch on every authenticated request

`MastraAuthWorkos.getCurrentUser()` now calls `workos.userManagement.listOrganizationMemberships()` on **every request** to populate the user's memberships for FGA. This is a network call per request even when FGA isn't configured.

**Fix**: Only fetch memberships when `server.fga` is configured, or cache in the session cookie.

### 3. `checkRouteFGA` is defined but never wired in

`checkRouteFGA()` in `server-adapter/index.ts` and the `fga` field on `ServerRoute` are exported and tested, but **no middleware or route handler actually calls them**. The declarative per-route FGA config does nothing at runtime.

**Fix**: Either wire `checkRouteFGA` into the route execution pipeline (e.g., inside `checkRouteAuth` or as a separate middleware step), or remove it until it's needed.

### 4. Memory FGA enforcement is a stub

`Memory.checkThreadFGA()` is a static helper that exists but is **never called** from any memory read/write method (`saveMessages`, `getThreadById`, etc.) or from any HTTP handler. Thread-level FGA is defined but not enforced.

### 5. MCP tools have no FGA enforcement

The plan called for FGA checks on MCP-sourced tools at the same level as regular tools. No enforcement exists in `packages/mcp/`.

### 6. `user: any` throughout the enforcement layer

All enforcement call sites pass `requestContext.get('user')` which returns `any`. The `MastraFGAWorkos` class implements bare `IFGAManager` instead of `IFGAManager<WorkOSUser>`. `resolveOrganizationMembershipId` silently returns `undefined` if the user object doesn't have the expected shape, causing a silent denial that's hard to debug.

### 7. Inconsistent resource type naming

- Enforcement uses singular: `{ type: 'agent' }`, `{ type: 'workflow' }`, `{ type: 'tool' }`
- Permission strings use plural: `'agents:execute'`, `'workflows:execute'`, `'tools:execute'`
- `resourceMapping` keys in examples use both conventions

This will confuse users configuring their mappings.

### 8. Permission strings are raw strings, not typed

The codebase has generated `Permission` types in `permissions.generated.ts`, but FGA enforcement uses hardcoded strings like `'agents:execute'`. No compile-time validation that permission strings are valid.

### 9. Double enforcement on execution paths

When a user hits `POST /api/agents/:id/generate`, the handler filtering checks FGA (list-level), then `agent.generate()` checks FGA again (execution-level). This is defense-in-depth but means two `check()` network calls per request. Not a bug, but should be documented as intentional.

### 10. `deriveId` context is too narrow

`FGAResourceMappingEntry.deriveId` only receives `{ user: any }`. Some authorization decisions need the request context (URL params, tenant from headers, etc.):

```typescript
// Current
deriveId?: (ctx: { user: any }) => string;

// Would be more useful
deriveId?: (ctx: { user: any; resourceId?: string; requestContext?: RequestContext }) => string;
```

---

## What's Left to Reach Plan Parity

The [research plan](./fga-mastra-auth-research-and-plan.md) defined 5 phases. Here's what remains:

### Phase 1: Core Interfaces — Complete

No remaining work. `IFGAProvider` and `IFGAManager` are defined, exported, and wired into config.

### Phase 2: Enforcement Points — ~70% complete

| Enforcement Point    | Plan                                   | Current                                | Remaining Work                                                 |
| -------------------- | -------------------------------------- | -------------------------------------- | -------------------------------------------------------------- |
| Route middleware     | FGA check in request pipeline          | Dead code (`checkRouteFGA` not called) | Wire into middleware or remove                                 |
| Agent execution      | Before `generate()`/`stream()`         | Done                                   | —                                                              |
| Tool execution       | Before `tool.execute()`                | Done                                   | —                                                              |
| Memory/thread access | Before read/write                      | Static helper exists, never called     | Call `checkThreadFGA` from memory methods and/or HTTP handlers |
| Workflow execution   | Before `workflow.execute()`            | Done                                   | —                                                              |
| MCP tools            | Same as tool execution                 | Not started                            | Add FGA check in MCP tool execution path                       |
| Resource listing     | `filterAccessible()` on list endpoints | Done (agents, tools, workflows)        | Add for threads/memory listing                                 |

### Phase 3: WorkOS FGA Adapter — ~85% complete

| Item                                                      | Status   | Remaining                                                 |
| --------------------------------------------------------- | -------- | --------------------------------------------------------- |
| `MastraFGAWorkos` class                                   | Done     | —                                                         |
| `resourceMapping` + `permissionMapping`                   | Done     | —                                                         |
| Uses `workos.authorization.*` (current API)               | Done     | —                                                         |
| `filterAccessible` with batch/list API                    | Not done | Switch to `listResourcesForMembership()`                  |
| Machine-to-machine / service account tokens               | Not done | Implement Ryan's custom JWT + service account pattern     |
| Performance (caching, avoid unnecessary membership fetch) | Not done | Gate membership fetch behind FGA config; consider caching |

### Phase 4: OpenFGA / Generic Adapter — Not started

The plan called for an OpenFGA adapter (`@mastra/fga-openfga`) for OSS users who don't use WorkOS. The `IFGAProvider` interface is provider-agnostic, so this is additive work.

### Phase 5: Studio Integration — Not started

The plan called for wiring FGA into Studio Auth so deployed Studios respect fine-grained permissions. This means:

- Studio's `usePermissions()` hook needs FGA awareness
- Studio API routes need the same enforcement middleware

### Summary

| Phase                 | Completion | Blocking issues                                                           |
| --------------------- | ---------- | ------------------------------------------------------------------------- |
| 1. Core Interfaces    | 100%       | —                                                                         |
| 2. Enforcement Points | ~70%       | Memory enforcement not wired, MCP not started, route middleware dead code |
| 3. WorkOS Adapter     | ~85%       | N+1 filterAccessible, no service accounts, membership fetch perf          |
| 4. OpenFGA Adapter    | 0%         | Additive, not blocking                                                    |
| 5. Studio Integration | 0%         | Depends on Phase 2 completion                                             |

### Critical path to ship

1. Wire memory enforcement (call `checkThreadFGA` from actual read/write paths)
2. Either wire or remove `checkRouteFGA` dead code
3. Switch `filterAccessible` to `listResourcesForMembership()`
4. Gate membership fetch behind FGA config
5. Add MCP tool FGA enforcement
