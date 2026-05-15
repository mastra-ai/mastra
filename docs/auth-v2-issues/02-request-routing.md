# Request routing middleware

## Type

Feature

## Priority

**P0 — Critical** (core security boundary)

## Estimate

1.5 days

## Description

Route requests to the appropriate auth config based on the `x-mastra-client-type: studio` header. Studio requests use `studio.*` config, API requests use `server.*` config.

**Security model:** The header routes to the correct provider, but the provider's session validation is the actual security boundary. An external user can add the studio header, but they won't have a valid studio session — so they get 401 + login redirect.

## Existing Infrastructure

- `x-mastra-client-type: studio` header already identifies Studio requests
- `isStudioClientTypeHeader()` helper in `packages/server/src/server/constants.ts`
- `MASTRA_IS_STUDIO_KEY` set in request context when header present
- Playground already sends this header

## Core Logic

```typescript
function getAuthConfigForRequest(
  config: MastraConfig,
  isStudioRequest: boolean,
): { auth?: MastraAuthProvider; rbac?: IRBACProvider; fga?: IFGAProvider } {
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

## Security Model

### Why header-based routing is secure:

1. External user adds `x-mastra-client-type: studio` header to spoof
2. Server sees header → routes to `studio.auth` provider (e.g., Okta)
3. Okta checks for valid SSO session cookie
4. External user has no valid Okta session → **401 + login redirect**

**The header is just routing. The session validation by the auth provider is the security boundary.**

### Unauthenticated Studio Request Behavior

**Decision:** When `studio.auth` is configured but user has no valid session:

- ✅ Return 401 with login redirect (treat as unauthenticated studio user)
- ❌ Do NOT fall back to server.auth (that would let API users access Studio)

### Defense in Depth (recommended)

- Log suspicious patterns (API token + studio header combo)
- Rate limit failed studio auth attempts
- Optionally verify Origin header for studio requests

## Test Cases

```typescript
describe('Request routing', () => {
  test('studio header routes to studio.auth', async () => {
    // Config: studio.auth = Okta, server.auth = WorkOS
    // Request has x-mastra-client-type: studio + valid Okta session
    // Expected: Authenticated via Okta
  })

  test('no header routes to server.auth', async () => {
    // Config: studio.auth = Okta, server.auth = WorkOS
    // Request has valid WorkOS JWT, no studio header
    // Expected: Authenticated via WorkOS
  })

  test('studio header without session shows login', async () => {
    // Config: studio.auth = Okta
    // Request has x-mastra-client-type: studio but no Okta session
    // Expected: 401 + login redirect, NOT fallback to server.auth
  })

  test('backwards compat: server.auth only', async () => {
    // Config: only server.auth configured (no studio config)
    // Request has x-mastra-client-type: studio
    // Expected: Uses server.auth provider
  })

  test('API user cannot access studio by adding header', async () => {
    // Config: studio.auth = Okta, server.auth = WorkOS
    // Request has valid WorkOS JWT + x-mastra-client-type: studio
    // Expected: Routes to Okta, fails auth (no Okta session), shows login
  })
})
```

## Session Cookie Separation

Providers should use distinct cookie names to avoid conflicts:

| Provider | Cookie Name Example |
| -------- | ------------------- |
| WorkOS   | `wos_session`       |
| Okta     | `okta_session`      |
| Clerk    | `__clerk_session`   |

No additional work needed if providers already use unique cookie names.

## Acceptance Criteria

- [ ] Studio requests (`x-mastra-client-type: studio`) route to `studioAuth`
- [ ] API requests (no header) route to `apiAuth`
- [ ] Unauthenticated studio requests → 401 + login (no apiAuth fallback)
- [ ] Backwards compatible when only `auth` configured
- [ ] Unit tests for routing logic
- [ ] Security tests for header spoofing scenarios
- [ ] Logging for suspicious patterns

## Files to Modify

- `packages/server/src/server/server-adapter/index.ts` — `checkRouteAuth()`
- `packages/server/src/server/auth/helpers.ts` — Add `getAuthConfigForRequest()`
- `packages/server/src/server/auth/helpers.test.ts` — Routing + security tests

## Dependencies

- 01-config-schema

## Blocks

- 05-team-list-page
- 08-users-list-page
