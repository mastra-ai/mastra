# Project Research Summary

**Project:** Mastra Cloud Auth Plugin — API Alignment
**Domain:** Auth client brownfield refactor
**Researched:** 2026-01-28
**Confidence:** HIGH

## Executive Summary

This is a brownfield refactor of the `@mastra/auth-cloud` plugin to align with the Cloud team's API specification. The current implementation has four critical mismatches: token in request body (should be Authorization header), missing response envelope unwrapping, wrong API path prefix (`/api/` vs `/api/v1/`), and singleton-stored token causing multi-user collision. All four must be fixed simultaneously for the plugin to function.

The recommended approach is a single coordinated update: add a generic `request<T>()` transport layer with Authorization header support, add `unwrapResponse<T>()` helper for envelope extraction, update all paths to `/api/v1/`, and change all authenticated methods to accept `token` as a parameter. The existing `parseUser()` and session extraction patterns are correct and can be retained.

Key risk is the all-or-nothing nature of this change — partial migration will break auth completely. Mitigation: implement all changes in one PR, test against mock server before Cloud API is available.

## Key Findings

### Recommended Stack

Use native `fetch` with a typed wrapper pattern. No external HTTP libraries needed. The existing codebase already uses fetch everywhere.

**Core technologies:**

- Native `fetch`: HTTP requests — zero dependencies, monorepo precedent
- `CloudApiResponse<T>`: Generic envelope type — matches Cloud spec exactly
- `CloudApiError`: Custom error class — structured errors with code/status

### Expected Features

**Must have (table stakes):**

- Bearer token in Authorization header — RFC 6750, security standard
- Response envelope unwrapping — Cloud returns `{ ok, data, error }`
- API versioning (`/api/v1/`) — spec compliance
- Token parameter passing — fix singleton collision

**Should have (competitive):**

- Token expiry checking — prevent 401 cascades
- Request timeout configuration — prevent hung requests
- Debug logging — opt-in verbose logging

**Defer (v2+):**

- Automatic token refresh — Cloud endpoint may not exist yet
- Request retry with backoff — nice-to-have
- Concurrent request deduplication — optimization

### Architecture Approach

Three-layer client design: transport (HTTP mechanics), response (envelope unwrapping), parsing (snake_case to camelCase). Token flows through as parameter, never stored on client instance. `MastraCloudAuth` extracts token from request, passes to `MastraCloudClient` methods, stores on `CloudUser.sessionToken` for later use.

**Major components:**

1. `MastraCloudClient` (client.ts) — HTTP transport, response unwrapping, type parsing
2. `MastraCloudAuth` (index.ts) — Interface implementation, token extraction, session cookies
3. Transport layer — Single `request<T>()` method handles headers, errors, JSON parsing

### Critical Pitfalls

1. **Token location mismatch** — Client sends body, server expects header. Prevention: explicit `Authorization: Bearer` header in transport layer.
2. **Response envelope omission** — Expecting `{ user }`, getting `{ ok, data: { user } }`. Prevention: generic `unwrapResponse<T>()` helper.
3. **API path version drift** — `/api/auth/` vs `/api/v1/auth/`. Prevention: centralize path construction with version prefix.
4. **Singleton token collision** — Token stored on instance, wrong user data returned. Prevention: pass token as method parameter, never store on client.
5. **Error swallowing** — `catch { return null }` hides root cause. Prevention: log errors with context, consider typed error returns.

## Implications for Roadmap

Based on research, suggested phase structure:

### Phase 1: Transport Layer + Response Handling

**Rationale:** Foundation for all other changes. Cannot fix endpoints without proper HTTP layer.
**Delivers:** `request<T>()` method, `CloudApiResponse<T>` type, `unwrapResponse<T>()` helper, `CloudApiError` class
**Addresses:** Response envelope unwrapping, Authorization header
**Avoids:** Token location mismatch, response envelope omission

### Phase 2: API Path + Method Signatures

**Rationale:** Depends on transport layer. All paths and methods updated together.
**Delivers:** `/api/v1/` paths, token parameter on authenticated methods
**Uses:** Transport layer from Phase 1
**Implements:** Path versioning, stateless token handling

### Phase 3: Provider Integration

**Rationale:** Depends on client methods being correct. Integrates with interface contracts.
**Delivers:** Updated `MastraCloudAuth` using new client signatures, `sessionToken` stored on `CloudUser`
**Avoids:** Singleton token collision, missing method errors

### Phase 4: Testing + Validation

**Rationale:** Final validation before Cloud API is available.
**Delivers:** Integration tests with mocked API responses, error path coverage
**Addresses:** Testing blind spots, all error scenarios

### Phase Ordering Rationale

- Transport first because all endpoints depend on it
- Paths + signatures together to avoid partial migration breakage
- Provider integration last because it depends on correct client
- Testing as final phase but should start mocks early

### Research Flags

Phases likely needing deeper research during planning:

- **Phase 3:** Cloud API may have undocumented behaviors, test against real API when available

Phases with standard patterns (skip research-phase):

- **Phase 1:** Well-documented fetch patterns, established TypeScript conventions
- **Phase 2:** Straightforward path updates, no ambiguity
- **Phase 4:** Standard testing patterns

## Confidence Assessment

| Area         | Confidence | Notes                                                    |
| ------------ | ---------- | -------------------------------------------------------- |
| Stack        | HIGH       | Monorepo precedent, zero new dependencies                |
| Features     | HIGH       | Based on existing interfaces and Cloud spec              |
| Architecture | HIGH       | Existing codebase patterns, approved implementation plan |
| Pitfalls     | HIGH       | Codebase analysis, established security patterns         |

**Overall confidence:** HIGH

### Gaps to Address

- **Token refresh endpoint:** Cloud spec mentions optional `/api/v1/oauth/refresh`. Verify availability before implementing.
- **Cloud API availability:** Mock server needed for testing until Cloud endpoints deployed.
- **State parameter validation:** Current implementation has `_state` unused — verify handled by auth handler.

## Sources

### Primary (HIGH confidence)

- `/auth/cloud/IMPLEMENTATION_PLAN.md` — Approved change requirements
- `/auth/cloud/SPEC_REVIEW.md` — Cloud API response format
- `/auth/cloud/PLUGIN_SPEC_EXPLORE.md` — Cloud team's API design
- `/auth/cloud/src/client.ts` — Current implementation
- `/auth/workos/src/auth-provider.ts` — Reference implementation

### Secondary (MEDIUM confidence)

- RFC 6750 — Bearer Token Usage
- RFC 6749 — OAuth 2.0 Authorization Framework

---

_Research completed: 2026-01-28_
_Ready for roadmap: yes_
