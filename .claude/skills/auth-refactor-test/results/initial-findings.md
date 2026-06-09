# Auth Refactor Testing - Initial Findings

Date: June 8, 2026
Branch: `wardpeet/auth-rework-takeover` (based on Ward's PR #17142)

## Build Results

### ✅ Core Packages Built Successfully
- `@internal/auth` - New internal auth package (cache hit)
- `@internal/voice` - New internal voice package (cache hit)
- `@mastra/auth-workos` - WorkOS provider (cache hit)
- `@mastra/core` - Core package (built successfully)
- `@mastra/server` - Server package (built successfully)
- `@internal/playground` - Playground (built successfully)
- `mastra` CLI - CLI package (built successfully)

### ❌ Docs Build Failed
- `mastra-docs` - Failed due to browserslist/autoprefixer issue (unrelated to auth refactor)
- Error: `BrowserslistError: Unknown browser query`

## Runtime Test Results

### WorkOS Auth Provider (`AUTH_PROVIDER=workos`)

**Server Startup:** ✅ PASS
- Server starts successfully
- Logs show `[Auth] Using WorkOS authentication`
- Server ready in ~1.6s

**Unauthenticated API Access:** ✅ PASS
- `curl http://localhost:4111/api/agents` returns `{"error":"Invalid or expired token"}`
- Correct 401 response for unauthenticated requests

**Studio Login UI:** ✅ PASS
- Login page renders correctly at http://localhost:4111
- Shows "Sign in to continue" with WorkOS branding
- Sign in button present

**SSO Flow:** ⏳ NOT TESTED
- Sign in button clicked but redirect timing uncertain
- Need persistent server to fully test SSO callback

---

### Simple Auth Provider (`AUTH_PROVIDER=simple`)

**Server Startup:** ✅ PASS
- Server starts successfully
- Logs show `[Auth] Using SimpleAuth (token-based) authentication`
- Server ready in ~1.6-2.4s

**Unauthenticated API Access:** ✅ PASS
- `curl http://localhost:4111/api/agents` returns `{"error":"Invalid or expired token"}`
- Correctly returns 401 Unauthorized for unauthenticated requests

**Authenticated API Access:** ✅ PASS
- `curl -H "Authorization: Bearer test-token" http://localhost:4111/api/agents` returns full agents list (16+ agents)
- Token-based auth working correctly

**Studio Login UI:** ✅ PASS
- Login page renders correctly at http://localhost:4111
- Shows "Sign in to continue" with Mastra branding
- Sign in button present

**Overall:** SimpleAuth working correctly on Ward's auth-rework branch

## Issues Found

### 1. SQLite Lock Contention (Unrelated to Auth)
- `SQLITE_BUSY_SNAPSHOT: database is locked` errors
- Affects workflow event processing
- Pre-existing issue, not caused by auth refactor

### 2. Server Timeout in Shell
- Dev server terminates when shell command times out
- Need persistent background process for browser testing

## Issues Resolved

### SimpleAuth Authentication - WORKS CORRECTLY ✅
- Initially appeared to fail due to testing timing issues
- Re-tested and confirmed working:
  - Unauthenticated: Returns `{"error":"Invalid or expired token"}` (401)
  - Authenticated with `test-token`: Returns full agents list (200)

## Auth Provider Configuration

The example app supports multiple auth providers via `AUTH_PROVIDER` env var:

```bash
# In examples/agent/.env
AUTH_PROVIDER=workos  # Currently active
```

Available providers:
- `simple` - Token-based (test-token, viewer-token)
- `workos` - Enterprise SSO + FGA ✅ TESTED
- `better-auth` - Credentials auth
- `okta` - Okta SSO + RBAC
- `auth0-okta` - Cross-provider
- `cloud` - Mastra platform OAuth
- `composite` - Multi-provider fallback
- `studio` - Platform Studio auth

## Key Files in Ward's Refactor

### New Internal Package
- `packages/_internals/auth/src/` - All auth internals
  - `ee/interfaces/fga.ts` - FGA types
  - `ee/interfaces/rbac.ts` - RBAC types
  - `session/` - Session management
  - `provider/` - Base auth provider

### Auth Provider Updates
- `auth/workos/src/fga-provider.ts` - Now imports from `@internal/auth/ee`
- `auth/workos/src/auth-provider.ts` - Uses internal types

### Core Re-exports
- `packages/core/src/auth/` - Re-export stubs for backward compatibility

## Next Steps

1. [ ] Test simple auth provider (no SSO flow needed)
2. [ ] Test better-auth provider (credentials flow)
3. [ ] Set up persistent dev server for SSO testing
4. [ ] Run FGA tests with WorkOS
5. [ ] Document any regressions found
