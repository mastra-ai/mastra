# FGA Implementation Status

_Updated April 24, 2026_

---

## Current State

The `feat/fga` branch now has a working end-to-end Fine-Grained Authorization implementation built around the current **WorkOS Authorization API**.

### What's built

| Layer                                                         | Status | Files                                                                                 |
| ------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| `IFGAProvider` and `IFGAManager` interfaces                   | Done   | `packages/core/src/auth/ee/interfaces/fga.ts`                                         |
| `checkFGA` utility and `FGADeniedError`                       | Done   | `packages/core/src/auth/ee/fga-check.ts`                                              |
| `server.fga` config on `ServerConfig`                         | Done   | `packages/core/src/server/types.ts`                                                   |
| Capabilities endpoint reports `fga: boolean`                  | Done   | `packages/core/src/auth/ee/capabilities.ts`                                           |
| Agent `generate()` and `stream()` enforcement                 | Done   | `packages/core/src/agent/agent.ts`                                                    |
| Workflow execution enforcement                                | Done   | `packages/core/src/workflows/workflow.ts`                                             |
| Tool execution enforcement                                    | Done   | `packages/core/src/loop/.../tool-call-step.ts`                                        |
| MCP tool execution enforcement                                | Done   | `packages/mcp/src/server/server.ts`                                                   |
| Route-level declarative FGA checks                            | Done   | `packages/server/src/server/server-adapter/index.ts`, server adapters                 |
| List endpoint filtering for agents, tools, workflows          | Done   | `packages/server/src/server/handlers/`                                                |
| Thread and memory read/write/delete enforcement               | Done   | `packages/server/src/server/handlers/memory.ts`, `packages/core/src/memory/memory.ts` |
| Memory list/search filtering                                  | Done   | `packages/server/src/server/handlers/memory.ts`                                       |
| `MastraFGAWorkos` adapter                                     | Done   | `auth/workos/src/fga-provider.ts`                                                     |
| WorkOS FGA types and exports                                  | Done   | `auth/workos/src/types.ts`, `auth/workos/src/index.ts`                                |
| WorkOS membership fetch gating and caching                    | Done   | `auth/workos/src/auth-provider.ts`                                                    |
| WorkOS bearer JWT claim mapping for service tokens            | Done   | `auth/workos/src/auth-provider.ts`, `auth/workos/src/types.ts`                        |
| Tests for core, server, MCP, memory, and WorkOS adapter paths | Done   | Various `__tests__/` and `*.test.ts` files                                            |
| FGA docs                                                      | Done   | `docs/src/content/en/docs/server/auth/fga.mdx`                                        |

---

## Quick Example

```typescript
import { Mastra } from '@mastra/core/mastra';
import { MastraAuthWorkos, MastraFGAWorkos } from '@mastra/auth-workos';

const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos({
      apiKey: process.env.WORKOS_API_KEY,
      clientId: process.env.WORKOS_CLIENT_ID,
      redirectUri: process.env.WORKOS_REDIRECT_URI,
      fetchMemberships: true,
    }),
    fga: new MastraFGAWorkos({
      organizationId: 'org_abc123',
      resourceMapping: {
        agent: {
          fgaResourceType: 'team',
          deriveId: ctx => ctx.user.teamId,
        },
        workflow: {
          fgaResourceType: 'team',
          deriveId: ctx => ctx.user.teamId,
        },
        thread: {
          fgaResourceType: 'workspace-thread',
          deriveId: ({ resourceId }) => resourceId,
        },
      },
      permissionMapping: {
        'agents:execute': 'manage-workflows',
        'workflows:execute': 'manage-workflows',
        'memory:read': 'read',
        'memory:write': 'update',
      },
    }),
  },
});
```

### Service-token example

```typescript
const auth = new MastraAuthWorkos({
  apiKey: process.env.WORKOS_API_KEY,
  clientId: process.env.WORKOS_CLIENT_ID,
  redirectUri: process.env.WORKOS_REDIRECT_URI,
  trustJwtClaims: true,
  jwtClaims: {
    organizationId: 'org_id',
    organizationMembershipId: 'urn:mastra:organization_membership_id',
  },
});
```

This lets verified bearer tokens from a WorkOS custom JWT template carry pre-resolved FGA context for machine-to-machine or service-account flows.

---

## Phase Status

### Phase 1: Core Interfaces — Complete

No remaining work. The provider interfaces, config wiring, and shared enforcement utilities are in place.

### Phase 2: Enforcement Points — Complete

All planned enforcement points are wired:

| Enforcement Point    | Status | Notes                                                                  |
| -------------------- | ------ | ---------------------------------------------------------------------- |
| Route middleware     | Done   | Declarative `route.fga` config is enforced in the server adapters      |
| Agent execution      | Done   | `generate()` and `stream()` enforce `agents:execute`                   |
| Tool execution       | Done   | Tool-call execution enforces `tools:execute`                           |
| Memory/thread access | Done   | Read, write, delete, create, clone, list, and search paths are covered |
| Workflow execution   | Done   | `workflows:execute` enforced                                           |
| MCP tools            | Done   | MCP server execution enforces `tools:execute`                          |
| Resource listing     | Done   | Agents, tools, workflows, and threads are filtered                     |

### Phase 3: WorkOS FGA Adapter — Complete for the planned integration

The WorkOS implementation now covers the branch plan:

| Item                                             | Status | Notes                                                               |
| ------------------------------------------------ | ------ | ------------------------------------------------------------------- |
| `MastraFGAWorkos` class                          | Done   | Uses `workos.authorization.*`                                       |
| `resourceMapping` and `permissionMapping`        | Done   | Supports canonical keys and legacy aliases                          |
| Batch listing where parent resource is derivable | Done   | Uses `listResourcesForMembership()` when that optimization is valid |
| Membership fetch performance                     | Done   | Gated behind `fetchMemberships` and cached                          |
| Service token / machine-to-machine bearer flow   | Done   | Supported through verified JWT claim mapping and `trustJwtClaims`   |

The only remaining WorkOS-side follow-up would be future optimization for thread filtering if WorkOS exposes a better bulk query for resource IDs derived per thread. The current thread path intentionally uses per-resource checks because it depends on each thread's owning `resourceId`.

### Phase 4: OpenFGA / Generic Adapter — Not started

The core interfaces are provider-agnostic, but there is still no OpenFGA adapter package on this branch.

### Phase 5: Studio Integration — Not started

There is no dedicated Studio-side FGA integration work on this branch yet.

---

## Known Limitations

### 1. Permission strings are still mostly raw strings

FGA call sites still use string literals such as `'agents:execute'` and `'memory:write'` instead of a generated permission type. This works, but there is no compile-time validation for typos.

### 2. Some execution paths intentionally double-check authorization

For example, a request can hit route-level FGA and then hit execution-level FGA again inside the agent, workflow, or tool implementation. This is intentional defense-in-depth, but it can produce duplicate network checks.

### 3. Thread filtering cannot always be reduced to one WorkOS API call

For resources like agents and workflows, `filterAccessible()` can batch via `listResourcesForMembership()`. For threads, the resolved FGA resource can depend on each thread's own `resourceId`, so the adapter falls back to per-thread checks.

---

## What's Left to Reach Full Plan Parity

The remaining work is outside the main WorkOS adapter phase:

1. Build an OpenFGA or other generic provider package for non-WorkOS users.
2. Add Studio-specific FGA awareness in the deployed Studio auth and permissions flows.
3. Optionally introduce typed permission literals to replace raw permission strings in enforcement call sites.

### Summary

| Phase                 | Completion | Notes                                       |
| --------------------- | ---------- | ------------------------------------------- |
| 1. Core Interfaces    | 100%       | Complete                                    |
| 2. Enforcement Points | 100%       | Complete                                    |
| 3. WorkOS Adapter     | 100%       | Complete for the planned WorkOS integration |
| 4. OpenFGA Adapter    | 0%         | Not started                                 |
| 5. Studio Integration | 0%         | Not started                                 |
