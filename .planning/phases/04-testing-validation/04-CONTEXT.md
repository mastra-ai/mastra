# Phase 4: Testing + Validation - Context

**Gathered:** 2026-01-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Verify TypeScript compiles and auth flows work against mocked API responses. This phase validates the implementation from Phases 1-3 — no new features, just proof that the code works.

</domain>

<decisions>
## Implementation Decisions

### Test coverage scope

- Happy paths + key error paths (not comprehensive edge cases)
- Key errors: invalid token, network failure, 501 from createSession
- Unit tests for transport layer (request<T>(), unwrapResponse(), CloudApiError)
- Integration tests for provider methods
- Test file location: match existing pattern in auth/cloud package

### Mock strategy

- Use vi.mock fetch — no MSW or dependency injection
- Mock responses defined inline in each test — no shared fixtures
- Error responses must match Cloud API spec exactly (actual error codes/formats)

### Validation criteria

- Minimum bar: `pnpm typecheck` passes AND all tests green
- Scope: auth/cloud package only (not whole monorepo)
- Full vitest setup: add vitest.config.ts + test script to package.json
- No coverage threshold required

### Claude's Discretion

- JWT testing approach (real JWTs vs mocked decode function)
- Exact test file organization within the package
- Helper utilities for test setup

</decisions>

<specifics>
## Specific Ideas

- No existing tests in auth/cloud — building test infrastructure from scratch
- Package currently only has src/client.ts and src/index.ts

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

_Phase: 04-testing-validation_
_Context gathered: 2026-01-28_
