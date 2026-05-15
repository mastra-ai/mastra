# Config schema for studio auth

## Type

Feature

## Priority

**P0 — Critical** (required for Studio auth separation)

## Estimate

1 day

## Description

Add a top-level `studio` configuration option to Mastra config. This separates Studio authentication from API authentication.

**Design principle:** Fully configurable, no assumptions, no magic inheritance.

## Configuration

```typescript
const mastra = new Mastra({
  // Existing — unchanged, for API authentication
  server: {
    auth: apiAuthProvider,
    rbac: apiRbacProvider,
    fga: apiFgaProvider,
    // ... other server config
  },

  // New — for Studio UI authentication
  studio: {
    auth: studioAuthProvider, // Required if you want Studio auth
    rbac: studioRbacProvider, // Optional — for role-based access in Studio
    fga: studioFgaProvider, // Optional — for fine-grained access in Studio
  },
})
```

## Behavior Matrix

| server.auth | studio.auth | Studio Behavior    | API Behavior     |
| ----------- | ----------- | ------------------ | ---------------- |
| ❌          | ❌          | No auth (dev mode) | No auth          |
| ✅          | ❌          | Uses server.auth   | Uses server.auth |
| ❌          | ✅          | Uses studio.auth   | No auth          |
| ✅          | ✅          | Uses studio.auth   | Uses server.auth |

**Key:** `studio.auth` takes precedence for Studio routes when configured.

## Type Definitions

```typescript
interface StudioConfig {
  /** Auth provider for Studio UI access */
  auth?: MastraAuthProvider<any>
  /** RBAC provider for Studio role-based access */
  rbac?: IRBACProvider<any>
  /** FGA provider for Studio fine-grained access */
  fga?: IFGAProvider<any>
}

interface MastraConfig {
  // Existing
  server?: ServerConfig

  // New
  studio?: StudioConfig

  // ... other config
}
```

## Examples

### Example 1: Studio auth only (API is public)

```typescript
const mastra = new Mastra({
  studio: {
    auth: new MastraAuthOkta({ ... }),
    rbac: new MastraRBACOkta({ ... }),
  },
});
```

### Example 2: Same auth for both (backwards compatible)

```typescript
const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos({ ... }),
    rbac: new MastraRBACWorkos({ ... }),
  },
  // No studio config — Studio uses server.auth
});
```

### Example 3: Different auth for Studio vs API

```typescript
const mastra = new Mastra({
  server: {
    auth: new MastraAuthWorkos({ ... }),  // Customers use WorkOS
  },
  studio: {
    auth: new MastraAuthOkta({ ... }),    // Team uses Okta
    rbac: new StaticRBACProvider({
      roles: DEFAULT_ROLES,
      getUserRoles: (user) => [user.role],
    }),
  },
});
```

## Routing Logic

```typescript
function getAuthConfigForRequest(config: MastraConfig, isStudioRequest: boolean) {
  if (isStudioRequest && config.studio?.auth) {
    // Studio request with studio config — use studio auth
    return {
      auth: config.studio.auth,
      rbac: config.studio.rbac,
      fga: config.studio.fga,
    }
  }

  // API request OR studio request without studio config — use server auth
  return {
    auth: config.server?.auth,
    rbac: config.server?.rbac,
    fga: config.server?.fga,
  }
}
```

## Acceptance Criteria

- [ ] `studio` config option added to `MastraConfig`
- [ ] `StudioConfig` type defined with auth/rbac/fga
- [ ] Backwards compatible — existing configs work unchanged
- [ ] TypeScript provides good autocomplete/errors
- [ ] Config validation catches invalid combinations
- [ ] Unit tests for config parsing

## Files to Modify

- `packages/core/src/mastra/types.ts` — Add StudioConfig
- `packages/core/src/mastra/index.ts` — Handle studio config
- `packages/server/src/server/types.ts` — Reference studio config

## Dependencies

None — this is foundation

## Blocks

- 02-request-routing
