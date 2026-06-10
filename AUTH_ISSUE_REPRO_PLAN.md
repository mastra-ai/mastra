# Auth Issue Reproduction Plan

This document outlines how to reproduce each open auth issue and verify if PR #17722 (dual auth) or other recent changes resolve them.

---

## Open Issues (7)

### 1. #17705 - CompositeAuth does not proxy signIn from credentials sub-providers

**Reproducibility:** Easy (code-level)

**Steps to reproduce:**
```typescript
import { CompositeAuth } from '@mastra/core/server';
import { SimpleAuth } from '@mastra/core/auth';

const simpleApiAuth = new SimpleAuth({ tokens: { 'api-key': { ... } } });
const credentialsProvider = /* provider with signIn method */;

const auth = new CompositeAuth([simpleApiAuth, credentialsProvider]);

// Check if signIn is proxied
console.log(typeof auth.signIn); // undefined ← BUG: should be function
```

**Expected:** `auth.signIn` should be a function delegating to `credentialsProvider.signIn`

**Addressed by #17722:** No. This is a CompositeAuth bug, not dual auth.

**Fix location:** `packages/core/src/server/composite-auth.ts` — add `isCredentialsProvider` guard

---

### 2. #17216 - Trusted system-actor signal for cron/background workflows (FGA bypass)

**Reproducibility:** Medium (requires FGA + cron setup)

**Steps to reproduce:**
```typescript
// 1. Configure FGA with WorkOS
const fgaProvider = new MastraFGAWorkos({ ... });

// 2. Create a cron job that calls an FGA-protected agent
// 3. Cron has no user context → hits WorkOSFGAMembershipResolutionError
```

**Expected:** System actors (cron, background jobs) should bypass per-membership FGA checks while still being scoped to tenant.

**Addressed by #17722:** No. This is an FGA design issue, not dual auth.

**Fix:** Add `systemActor` option to FGA check path (see issue for detailed proposal).

---

### 3. #16232 - Bundled Studio routes bypass server.auth (SSE /refresh-events)

**Reproducibility:** Medium (requires bundled deployment)

**Steps to reproduce:**
```bash
# 1. Build with Studio bundled
mastra build --studio

# 2. Deploy with server.auth configured

# 3. Test SSE endpoint without auth
curl http://deployed-server/refresh-events
# Returns SSE stream without auth check ← BUG
```

**Expected:** `/refresh-events`, `/__refresh`, `/__hot-reload-status` should respect `server.auth` or `studio.auth`.

**Addressed by #17722:** Partially. Dual auth adds `studio.auth` but SSE routes may still bypass.

**Verification needed:** Check if SSE routes now check `studio.auth` after #17722.

---

### 4. #16018 - Channel adapter should support per-request agent override for RBAC

**Reproducibility:** Medium (requires Telegram/Slack channel setup)

**Steps to reproduce:**
```typescript
// Supervisor with multiple subagents
const supervisor = new Agent({
  name: 'supervisor',
  agents: { claims: claimsAgent, compliance: complianceAgent }
});

const channels = new AgentChannels({ agent: supervisor });

// Problem: Can't swap agent per Telegram group
// "Compliance" group should only access complianceAgent
// But channels.handleWebhook always uses supervisor with ALL subagents
```

**Expected:** `handleWebhook(request, { agent: groupSpecificAgent })` option

**Addressed by #17722:** No. This is a channel adapter feature request.

---

### 5. #14619 - buildCapabilities() gates SSO/session/user behind EE license

**Reproducibility:** Easy (code-level)

**Steps to reproduce:**
```typescript
// 1. Create custom Auth0 provider implementing MastraAuthProvider
// 2. Deploy to production (NODE_ENV=production)
// 3. No MASTRA_EE_LICENSE set

// buildCapabilities() returns:
{
  user: false,    // ← BUG: should be true (provider implements getCurrentUser)
  session: false, // ← BUG: should be true (provider implements createSession)
  sso: true,      // ← BUG: should be true (provider implements getLoginUrl)
  rbac: false,    // OK: RBAC is EE-gated
  acl: false      // OK: ACL is EE-gated
}
```

**Expected:** SSO, session, user should NOT be EE-gated. Only RBAC/ACL should be.

**Addressed by #17722:** No. This is an EE license gating bug.

**Fix location:** `packages/core/src/auth/ee/capabilities.ts` — remove `isLicensedOrCloud` check from `user`, `session`, `sso`.

---

## Verification Matrix

| Issue | Can repro locally? | Addressed by #17722? | Other PR needed? |
|-------|-------------------|---------------------|------------------|
| #17705 | ✅ Yes (unit test) | ❌ No | Fix CompositeAuth |
| #17216 | ⚠️ Needs FGA setup | ❌ No | New FGA feature |
| #16232 | ⚠️ Needs bundled deploy | ⚠️ Partial | Check SSE routes |
| #16018 | ⚠️ Needs channel setup | ❌ No | New channel feature |
| #14619 | ✅ Yes (unit test) | ❌ No | Fix EE gating |

---

## Recommended Approach

### Phase 1: Easy wins (unit test reproducible)
1. **#17705** — Write unit test for CompositeAuth.signIn, fix, close
2. **#14619** — Write unit test for buildCapabilities EE gating, fix, close

### Phase 2: Integration testing
3. **#16232** — Set up bundled Studio deploy, verify SSE routes check auth after #17722

### Phase 3: Feature work (not bugs)
4. **#17216** — Design system-actor FGA bypass (needs discussion)
5. **#16018** — Design per-request agent override for channels (needs discussion)

---

## Test Environment Setup

For reproducing these issues, use `examples/agent` with different auth configs:

```bash
cd examples/agent

# Test CompositeAuth (#17705)
AUTH_PROVIDER=composite pnpm dev

# Test EE gating (#14619)
NODE_ENV=production AUTH_PROVIDER=workos pnpm dev
# (without MASTRA_EE_LICENSE)

# Test bundled Studio (#16232)
pnpm build --studio
# Deploy and test /refresh-events
```
