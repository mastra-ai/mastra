# E2E Test Review: packages/playground/e2e/tests/auth

**Review Date:** 2026-01-22
**Reviewer:** Claude Code (E2E QA Review)
**Scope:** Authentication and RBAC E2E Test Suite

---

## Summary

This test suite covers authentication and RBAC (Role-Based Access Control) for the Mastra playground. It tests login flows, session persistence, and role-based UI behavior (admin, member, viewer roles). The suite uses route interception via Playwright's `page.route()` to mock auth API responses.

---

## Test Coverage

### Files Analyzed

| File | Test Count | Purpose |
|------|------------|---------|
| `infrastructure.spec.ts` | ~15 tests | Validates auth mocking utilities work correctly |
| `login-flow.spec.ts` | ~19 tests | Login/logout flows, redirects, credentials, SSO |
| `admin-role.spec.ts` | ~18 tests | Admin access to all resources |
| `member-role.spec.ts` | ~19 tests | Member access patterns (read agents, full workflows, read/execute tools) |
| `viewer-role.spec.ts` | ~24 tests | Viewer read-only access patterns |

### Scenarios Covered

- Unauthenticated user redirect to login prompt
- SSO vs credentials vs both login modes
- Invalid credentials error handling
- Session persistence across reloads/navigation
- Role-based navigation visibility
- Role-based action button visibility (create, run, execute)
- Disabled inputs for unpermitted actions
- Permission messages for denied operations
- Role comparisons (admin > member > viewer)

---

## Critical Analysis

### Strengths

1. **Real user journey testing**: Tests simulate actual user behavior - navigating pages, clicking elements, seeing content. This is the proper use of E2E tests.

2. **Good separation of concerns**: The auth utilities (`auth.ts`) properly document that "Server-side permission enforcement tests are in `server-adapters/hono/src/__tests__/rbac-permissions.test.ts`."

3. **Proper test cleanup**: Each test uses `afterEach` with `resetStorage()` to avoid state leakage.

4. **Comprehensive role testing**: All three roles (admin, member, viewer) plus unauthenticated and `_default` states are tested.

5. **UI state verification**: Tests verify that disabled inputs, hidden buttons, and permission messages appear correctly for each role.

6. **No Playwright-as-HTTP-client anti-pattern**: All tests interact through the browser, not raw `request.get()` calls.

7. **Server tests exist in correct location**: The RBAC permission enforcement tests (`rbac-permissions.test.ts`) live in the server adapter package, which is the correct ownership.

### Weaknesses

1. **Mock-heavy testing reduces integration confidence**: All auth state is mocked via route interception. While this is appropriate for testing UI behavior, there's no E2E test that exercises the actual auth flow with a real server. A single "smoke test" with real auth would increase confidence.

2. **Some redundant tests across role files**: The three role spec files (`admin-role.spec.ts`, `member-role.spec.ts`, `viewer-role.spec.ts`) have significant overlap - each tests navigation to agents, workflows, tools with similar patterns. This could be parameterized.

3. **Weak "role comparison" tests**: Tests like `admin has more permissions than viewer` don't actually verify the difference - they just check both roles can access the page.

4. **Infrastructure tests may belong elsewhere**: `infrastructure.spec.ts` tests the auth utility helpers and fixtures. These are unit tests of utility functions that happen to use Playwright for verification. They could be vitest unit tests.

5. **Some tests have no real assertion value**: For example, `viewer sees correct user info` just verifies the page loads and assigns `userElement` but never asserts on it.

6. **Missing negative test for API bypass**: There's no test verifying that a user can't bypass UI restrictions by directly calling API endpoints. While the server tests cover this, one E2E smoke test would verify end-to-end.

### Security Concerns

| Concern | Status | Notes |
|---------|--------|-------|
| Server-side enforcement exists | Good | `rbac-permissions.test.ts` in server package tests 401/403 responses |
| UI reflects permission state | Good | Disabled inputs, hidden buttons, permission messages verified |
| E2E API bypass test | Gap | No E2E test verifying API calls are blocked for low-permission users |
| No conditional assertions | Good | Uses explicit `toBeVisible()` / `not.toBeVisible()` |

---

## Recommendations

| Priority | Issue | Recommendation |
|----------|-------|----------------|
| Medium | Infrastructure tests are testing utility functions | Consider moving `buildAuthCapabilities` and fixture tests to vitest unit tests. Keep only the route-interception verification in E2E. |
| Medium | Redundant role tests | Consider using Playwright's `test.describe.parallel` with `test.use({ storageState })` or parameterized tests to reduce duplication across admin/member/viewer specs. |
| Low | Some comparison tests don't assert differences | Make `admin vs viewer` tests actually assert on the specific UI differences (e.g., `expect(adminRunButton).not.toBeDisabled()` vs `expect(viewerRunButton).not.toBeVisible()`). |
| Low | Missing one smoke test for API bypass prevention | Add a single test that verifies `page.evaluate(() => fetch('/api/...'))` returns 403 for unauthorized operations, confirming server enforcement works end-to-end. |
| Low | Empty user info assertions | Either complete the assertions for user info display or remove the incomplete tests. |

---

## Value Assessment

| Aspect | Rating | Notes |
|--------|--------|-------|
| User Flow Coverage | 4/5 | Excellent coverage of login, navigation, and feature access per role |
| Security Enforcement | 4/5 | Good UI enforcement testing; server tests exist separately. One E2E API bypass test would complete the picture. |
| Test Reliability | 4/5 | Proper cleanup, explicit assertions, no flaky patterns observed |
| Real-World Scenarios | 4/5 | Tests navigate, click, fill forms - simulates real users well |
| Test Architecture | 5/5 | Excellent separation - UI tests in E2E, permission enforcement in server package |

---

## Test Pyramid Compliance

This suite correctly follows the test pyramid principle:

```
        /\
       /  \     E2E (This Suite)
      /    \    - UI behavior per role
     /------\   - Login/logout flows
    /        \  - Navigation & visibility
   /          \
  /------------\  Server Integration Tests
 /              \ - rbac-permissions.test.ts
/                \- 401/403 enforcement
/------------------\
        Unit Tests
```

**Key Architectural Decisions:**

1. **E2E tests focus on UI**: Verifies the frontend correctly shows/hides elements based on mocked permissions
2. **Server tests own permission enforcement**: `server-adapters/hono/src/__tests__/rbac-permissions.test.ts` tests actual 401/403 responses
3. **No Playwright-as-HTTP-client abuse**: Tests don't use `request.get()` for API testing - that belongs in server tests

---

## Verdict

**This is a well-architected E2E test suite that correctly focuses on UI behavior while leaving server-side permission enforcement to server-level tests.**

The test pyramid is respected: comprehensive API permission testing lives in `server-adapters/hono`, while E2E tests verify the UI correctly reflects permission state.

### Key Improvement Opportunities

1. Reducing duplication across role-specific test files
2. Moving pure utility function tests out of E2E
3. Adding one smoke test for API bypass prevention to verify end-to-end security

### Overall Assessment

**This suite provides real safety for users.** A UI change that breaks permission-based visibility or enablement will be caught by these tests, and the server-level tests ensure the backend can't be bypassed.

---

## Related Test Files

- **Server Permission Tests:** `server-adapters/hono/src/__tests__/rbac-permissions.test.ts`
- **Auth Utilities:** `packages/playground/e2e/tests/__utils__/auth.ts`
- **Storage Reset:** `packages/playground/e2e/tests/__utils__/reset-storage.ts`
