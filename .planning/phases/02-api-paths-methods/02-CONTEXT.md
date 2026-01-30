# Phase 2: API Paths + Methods - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Update all endpoints to match Cloud spec paths and accept token parameters. This phase changes the internal `MastraCloudClient` methods — the `AuthProvider` interface stays unchanged (token handling is implementation detail).

</domain>

<decisions>
## Implementation Decisions

### Path conventions

- API prefix `/api/v1/` is **configurable** — default to spec, allow override
- Login path `/auth/oss` is also **configurable**
- Base URL: **constructor param with env var fallback** (`MASTRA_CLOUD_URL`)
- Trailing slashes: **normalize both** — accept either, handle internally

### Token parameter design

- **Interface unchanged** — `AuthProvider` methods keep same signature
- **Client methods use options object** — `getUser({ userId, token })` not positional params
- **All methods use options pattern** — even single-param methods for consistency (e.g., `getLoginUrl({ redirectUri })`)

### Error responses

- **Include endpoint in error** — `CloudApiError` shows which path failed
- **Separate error codes** — `TOKEN_MISSING` vs `TOKEN_INVALID` distinguished
- **Single error class** — All API errors are `CloudApiError` with different codes
- **Include raw response** — Error has `rawResponse` property for debugging

### Backward compatibility

- **Clean break** — Remove old signatures, no deprecation period
- **Versioning decided later** — Not part of this phase
- **Migration docs separate** — Deferred to Phase 4 or separate task

### Claude's Discretion

- Whether token param is TypeScript-required or optional with runtime error
- Exact error code naming conventions
- Internal URL normalization implementation

</decisions>

<specifics>
## Specific Ideas

- Pattern follows existing decision: "Store `sessionToken` on `CloudUser` type for `getPermissions()` access"
- Provider reads token from user object, passes to client — keeps interface stable

</specifics>

<deferred>
## Deferred Ideas

- Migration documentation — separate task or Phase 4
- Version bump decision — to be determined when releasing

</deferred>

---

_Phase: 02-api-paths-methods_
_Context gathered: 2026-01-28_
