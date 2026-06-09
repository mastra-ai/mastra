# Auth Refactor Testing Skill

Test Ward's auth refactor (PR #17142) which extracts auth internals into `@internal/auth` package.

## Context

Ward's PR moves auth interfaces, providers, sessions, and EE auth helpers from `@mastra/core` into `@internal/auth`. The goal is to verify that all auth patterns still work correctly after the refactor.

## Auth Patterns to Test

The `examples/agent` app supports multiple auth providers via `AUTH_PROVIDER` env var:

| Provider | Type | Features | Test Priority |
|:---------|:-----|:---------|:--------------|
| `simple` | Token-based | API keys, static RBAC | HIGH |
| `workos` | Enterprise SSO | SAML, OIDC, FGA, dynamic roles | HIGH |
| `better-auth` | Credentials | Username/password, SQLite | MEDIUM |
| `okta` | Enterprise | SSO + RBAC | MEDIUM |
| `auth0-okta` | Cross-provider | Auth0 auth + Okta RBAC | LOW |
| `cloud` | Platform OAuth | PKCE flow | LOW |
| `composite` | Multi-provider | SimpleAuth + CloudAuth fallback | LOW |
| `studio` | Platform Studio | Sealed session + Bearer token | LOW |

## Test Scenarios Per Provider

### 1. Build & Start
- [ ] `pnpm build` completes without errors
- [ ] `pnpm mastra:dev` starts without auth errors
- [ ] Server logs show correct auth provider initialized

### 2. Unauthenticated Access
- [ ] Public routes accessible without token
- [ ] Protected routes return 401 without token
- [ ] Error message is correct format

### 3. Authenticated Access
- [ ] Valid token returns 200 on protected routes
- [ ] Invalid token returns 401
- [ ] User object is correctly populated

### 4. RBAC (if configured)
- [ ] Admin role can access all routes
- [ ] Viewer role blocked from write routes
- [ ] Role derivation from user works
- [ ] Permissions checked correctly

### 5. FGA (WorkOS only)
- [ ] Resource-level checks work
- [ ] Role assignments work
- [ ] Public-by-default behavior correct
- [ ] Ownership registration works

## Testing Commands

```bash
# Set auth provider
export AUTH_PROVIDER=simple  # or workos, better-auth, etc.

# Start dev server
cd examples/agent && pnpm mastra:dev

# Test endpoints (in another terminal)
curl http://localhost:4111/api/agents
curl -H "Authorization: Bearer test-token" http://localhost:4111/api/agents
```

## Browser Testing

Use Stagehand browser automation to test auth flows that require UI interaction:

1. Navigate to Studio at http://localhost:4111
2. Check login redirect behavior
3. Test SSO callback flow (WorkOS/Okta)
4. Verify user session persistence
5. Test logout and session cleanup

## Files Changed in Ward's PR

Key files to watch for issues:
- `packages/_internals/auth/src/` - new auth package
- `auth/workos/src/` - WorkOS provider (imports from @internal/auth)
- `auth/better-auth/src/` - Better Auth provider
- `auth/okta/src/` - Okta provider
- `packages/core/src/auth/` - re-export stubs

## Success Criteria

1. All auth providers build without errors
2. All providers start without runtime errors
3. Authentication works for each provider
4. RBAC enforcement works where configured
5. FGA enforcement works (WorkOS)
6. No regressions from current main branch
