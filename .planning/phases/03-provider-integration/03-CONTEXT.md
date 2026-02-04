# Phase 3: Provider Integration - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Wire `MastraCloudAuth` provider to use updated client with `sessionToken` flow. Provider methods extract data from JWT locally — no additional Cloud API calls for user info or permissions.

</domain>

<decisions>
## Implementation Decisions

### CloudUser Type

- `sessionToken` is **required** (not optional)
- Plain interface with public properties:
  ```typescript
  interface CloudUser {
    id: string;
    email: string;
    sessionToken: string;
    name?: string; // optional
    avatar?: string; // optional
  }
  ```
- Token only used internally by provider methods — not exposed for external use

### Error Handling

- `createSession()` throws descriptive `CloudApiError` explaining Cloud doesn't support session creation
- `getPermissions()` throws `CloudApiError` on failures (invalid token, decode errors)
- Auth error typing (401/403 distinction): Claude's discretion
- Error logging before throwing: Claude's discretion

### Permission Lookup Flow

- **No Cloud API call** — permissions resolved locally
- JWT contains `role` claim (e.g., `"admin"`, `"member"`)
- `getPermissions()` decodes JWT to extract role
- Uses `resolvePermissions([role], DEFAULT_ROLES)` from `@mastra/core`
- JWT decode only — no signature validation (validation happens elsewhere)

### Callback Response Shape

- Cloud returns **JWT only** after OAuth
- `handleCallback()` processes JWT locally — no API call
- Decodes JWT to extract: `id`, `email`, `role`, `name?`, `avatar?`
- Constructs `CloudUser` with JWT as `sessionToken`

</decisions>

<specifics>
## Specific Ideas

- Permissions use existing `DEFAULT_ROLES` and `resolvePermissions()` from `packages/core/src/ee/defaults/roles.ts`
- JWT role claim maps to role IDs: `"owner"`, `"admin"`, `"member"`, `"viewer"`

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 03-provider-integration_
_Context gathered: 2026-01-28_
