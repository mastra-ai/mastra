# Mastra Cloud Auth Plugin — API Alignment

## What This Is

Update the `@mastra/auth-cloud` plugin to match the Cloud team's API specification. The plugin exists and implements all auth interfaces, but the HTTP client calls endpoints with wrong paths, auth patterns, and response formats.

## Core Value

The Cloud auth plugin must communicate correctly with Cloud's API — if the request/response contract is wrong, nothing works.

## Requirements

### Validated

- ✓ `MastraCloudAuth` implements all EE interfaces (`IUserProvider`, `ISessionProvider`, `ISSOProvider`, `IRBACProvider`) — existing
- ✓ `MastraCloudClient` handles all Cloud API communication — existing
- ✓ Session management via cookies — existing
- ✓ User/permission data transforms (snake_case → camelCase) — existing

### Active

- [ ] API paths use `/api/v1/` prefix and `/auth/oss` login endpoint
- [ ] Authenticated requests use `Authorization: Bearer <token>` header
- [ ] Responses unwrapped from `{ ok, data }` envelope
- [ ] `getUser()` and `getUserPermissions()` accept token parameter
- [ ] `createSession()` in client removed, throws in index.ts
- [ ] `CloudUser` includes `sessionToken` field for permission lookups
- [ ] TypeScript compiles without errors

### Out of Scope

- Cloud backend implementation — Cloud team owns this
- New features beyond spec alignment — ship parity first
- Integration tests — blocked on Cloud staging environment

## Context

**Technical environment:**

- Plugin location: `auth/cloud/src/`
- Two files: `client.ts` (HTTP client), `index.ts` (auth provider)
- Cloud base URL: `https://cloud.mastra.ai`
- Part of larger Mastra monorepo

**Prior work:**

- Implementation plan reviewed and refined: `auth/cloud/IMPLEMENTATION_PLAN.md`
- Decided `getPermissions()` token access via `sessionToken` field on `CloudUser`

**Dependency:**

- Cloud endpoints don't exist yet — we're implementing against spec so it works when they ship

## Constraints

- **API Contract**: Must match Cloud spec exactly — no deviations
- **Interface Compatibility**: `ISessionProvider.createSession()` required by interface even though Cloud doesn't support it
- **No Breaking Changes**: Internal to plugin, not released yet

## Key Decisions

| Decision                                   | Rationale                                                 | Outcome   |
| ------------------------------------------ | --------------------------------------------------------- | --------- |
| Token on CloudUser for `getPermissions()`  | Avoids interface changes, simpler than caching            | — Pending |
| `createSession()` throws descriptive error | Interface requires method, Cloud doesn't support          | — Pending |
| Pass token as param not client storage     | Client is singleton, multiple users have different tokens | — Pending |

---

_Last updated: 2026-01-28 after initialization_
