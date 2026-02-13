# Phase 3: Provider Integration - Research

**Researched:** 2026-01-28
**Domain:** Provider method updates for JWT-based permission flow
**Confidence:** HIGH

## Summary

This phase wires `MastraCloudAuth` provider to use local JWT decoding for permissions instead of Cloud API calls. The key changes are:

1. **CloudUser type** - Add required `sessionToken` field to store JWT
2. **handleCallback()** - Decode JWT locally to extract user info + role, return CloudUser with token
3. **getPermissions()** - Decode JWT to extract role, use `resolvePermissions()` from core
4. **createSession()** - Throw `CloudApiError` (interface requires method, Cloud doesn't support)

The codebase already uses `jose` library in `auth/auth0` for JWT operations. For decode-only (no validation), native Buffer.from() or `jose.decodeJwt()` both work. Recommend `jose.decodeJwt()` for consistency with existing auth packages.

**Primary recommendation:** Use `jose.decodeJwt()` for JWT payload extraction. Use existing `resolvePermissions()` from `@mastra/core/ee/defaults/roles` for role-to-permission mapping.

## Standard Stack

### Core

| Library      | Version   | Purpose                           | Why Standard                                       |
| ------------ | --------- | --------------------------------- | -------------------------------------------------- |
| jose         | ^5.x      | JWT decode                        | Already in monorepo (auth/auth0), standard pattern |
| @mastra/core | workspace | resolvePermissions, DEFAULT_ROLES | Required by decision                               |

### Supporting

| Library | Version | Purpose | When to Use                       |
| ------- | ------- | ------- | --------------------------------- |
| None    | -       | -       | No additional dependencies needed |

### Alternatives Considered

| Instead of       | Could Use             | Tradeoff                                         |
| ---------------- | --------------------- | ------------------------------------------------ |
| jose.decodeJwt() | Manual base64 decode  | jose is already in monorepo, cleaner API         |
| jose.decodeJwt() | jwt-decode            | Would add new dependency, jose already available |
| jose.decodeJwt() | jsonwebtoken.decode() | jsonwebtoken is heavier, jose is lighter         |

**Installation:**

```bash
# Add jose to auth/cloud/package.json dependencies
pnpm add jose
```

## Architecture Patterns

### Recommended Project Structure

```
auth/cloud/src/
├── client.ts      # HTTP client (unchanged this phase)
└── index.ts       # Auth provider with JWT decode logic
```

### Pattern 1: JWT Decode Without Validation

**What:** Extract payload claims from JWT without signature verification
**When to use:** When validation is handled elsewhere (Cloud validates before issuing)
**Example:**

```typescript
// Source: jose library official docs + auth/auth0 pattern
import { decodeJwt } from 'jose';

interface JWTClaims {
  sub: string; // user id
  email: string;
  role: string; // "owner", "admin", "member", "viewer"
  name?: string;
  avatar?: string;
  exp: number;
  iat: number;
}

function extractUserFromJwt(jwt: string): CloudUser {
  const claims = decodeJwt(jwt) as JWTClaims;
  return {
    id: claims.sub,
    email: claims.email,
    sessionToken: jwt,
    name: claims.name,
    avatar: claims.avatar,
  };
}
```

### Pattern 2: Local Permission Resolution

**What:** Map JWT role to permissions using core's resolvePermissions()
**When to use:** When permissions are derived from roles, not fetched from API
**Example:**

```typescript
// Source: packages/core/src/ee/defaults/roles.ts
import { resolvePermissions, DEFAULT_ROLES } from '@mastra/core/ee/defaults/roles';
import { decodeJwt } from 'jose';

async getPermissions(user: CloudUser): Promise<string[]> {
  try {
    const claims = decodeJwt(user.sessionToken);
    const role = claims.role as string;
    if (!role) return [];
    return resolvePermissions([role], DEFAULT_ROLES);
  } catch {
    throw new CloudApiError('Failed to decode session token', 401);
  }
}
```

### Pattern 3: Unsupported Method Throws

**What:** Interface requires method, but provider doesn't support it
**When to use:** createSession() - Cloud only creates sessions via SSO
**Example:**

```typescript
// Source: Decision from PROJECT.md
async createSession(_userId: string, _metadata?: Record<string, unknown>): Promise<CloudSession> {
  throw new CloudApiError(
    'MastraCloudAuth does not support createSession(). Sessions are created via SSO flow (handleCallback).',
    501,  // Not Implemented
    'session_creation_not_supported'
  );
}
```

### Anti-Patterns to Avoid

- **Storing token on client instance:** Token belongs on CloudUser, not client singleton
- **Validating JWT signature here:** Validation happens elsewhere (Cloud issued it)
- **Calling Cloud API for permissions:** Decision: resolve locally from JWT role
- **Making sessionToken optional:** Decision: it's required on CloudUser

## Don't Hand-Roll

| Problem              | Don't Build           | Use Instead          | Why                                     |
| -------------------- | --------------------- | -------------------- | --------------------------------------- |
| JWT decode           | Manual base64 parsing | jose.decodeJwt()     | Handles edge cases, already in monorepo |
| Role-to-permissions  | Custom mapping logic  | resolvePermissions() | Core provides this, handles inheritance |
| Permission wildcards | Custom matching       | matchesPermission()  | Core provides this, handles \* patterns |

**Key insight:** The core package already has the permission resolution infrastructure. Don't recreate it.

## Common Pitfalls

### Pitfall 1: Treating sessionToken as optional

**What goes wrong:** Methods fail at runtime when token is undefined
**Why it happens:** Natural instinct to make new fields optional
**How to avoid:** Decision: sessionToken is REQUIRED on CloudUser
**Warning signs:** `Cannot read property 'split' of undefined` errors

### Pitfall 2: Calling decodeJwt with invalid token

**What goes wrong:** jose throws JWTInvalid error
**Why it happens:** Token could be expired, malformed, or empty
**How to avoid:** Wrap in try/catch, throw CloudApiError on failure
**Warning signs:** Unhandled promise rejection

### Pitfall 3: Wrong role claim name

**What goes wrong:** Role extraction returns undefined, permissions empty
**Why it happens:** JWT claim might be `role`, `roles`, or `realm_access`
**How to avoid:** Document expected claim name, log on missing
**Warning signs:** All users get empty permissions

### Pitfall 4: Missing setPrototypeOf in Error subclass

**What goes wrong:** `instanceof CloudApiError` returns false
**Why it happens:** TypeScript extends Error breaks prototype chain
**How to avoid:** Add `Object.setPrototypeOf(this, CloudApiError.prototype)` in constructor
**Warning signs:** Error type checks fail silently

## Code Examples

### Updated CloudUser Interface

```typescript
// Source: Decision from CONTEXT.md
export interface CloudUser {
  id: string;
  email: string;
  sessionToken: string; // REQUIRED - stores JWT for permission lookup
  name?: string;
  avatar?: string;
}
```

### handleCallback() with JWT Decode

```typescript
// Source: Pattern from CONTEXT.md decisions
import { decodeJwt } from 'jose';

async handleCallback(code: string, _state: string): Promise<SSOCallbackResult<CloudUser>> {
  // Exchange code for JWT (Cloud returns JWT directly)
  const jwt = await this.client.exchangeCodeForJwt({ code });

  // Decode JWT locally - no API call
  const claims = decodeJwt(jwt);

  const user: CloudUser = {
    id: claims.sub as string,
    email: claims.email as string,
    sessionToken: jwt,
    name: claims.name as string | undefined,
    avatar: claims.avatar as string | undefined,
  };

  return {
    user,
    tokens: {
      accessToken: jwt,
      expiresAt: claims.exp ? new Date(claims.exp * 1000) : undefined,
    },
  };
}
```

### getPermissions() with Local Resolution

```typescript
// Source: Pattern from CONTEXT.md + packages/core/src/ee/defaults/roles.ts
import { decodeJwt } from 'jose';
import { resolvePermissions, DEFAULT_ROLES } from '@mastra/core/ee/defaults/roles';

async getPermissions(user: CloudUser): Promise<string[]> {
  try {
    const claims = decodeJwt(user.sessionToken);
    const role = claims.role as string;

    if (!role) {
      // Log for debugging but don't crash
      console.warn('[MastraCloudAuth] No role claim in JWT');
      return [];
    }

    return resolvePermissions([role], DEFAULT_ROLES);
  } catch (error) {
    throw new CloudApiError(
      'Failed to decode session token for permissions',
      401,
      'invalid_token'
    );
  }
}
```

### createSession() Throws

```typescript
// Source: Decision from PROJECT.md
async createSession(_userId: string, _metadata?: Record<string, unknown>): Promise<CloudSession> {
  throw new CloudApiError(
    'MastraCloudAuth does not support createSession(). Use SSO flow via handleCallback() instead.',
    501,
    'not_implemented'
  );
}
```

## Discretion Recommendations

### Auth Error Typing (401 vs 403)

**Recommendation:** Use 401 for all token/auth failures in this phase.

Rationale:

- 401 = "I don't know who you are" (authentication failure)
- 403 = "I know who you are but you can't do this" (authorization failure)

For this phase:

- Invalid/expired/malformed token: **401**
- Token decode failure: **401**
- createSession() unsupported: **501** (Not Implemented)

Permission checks (hasPermission, hasAnyPermission) don't throw - they return boolean.

### Error Logging Before Throwing

**Recommendation:** Log WARN before throwing, but only for unexpected failures.

Rationale:

- Silent throws lose diagnostic info
- But verbose logging clutters output
- WARN level appropriate for "something went wrong"

Pattern:

```typescript
catch (error) {
  console.warn('[MastraCloudAuth] JWT decode failed:', error);
  throw new CloudApiError('Invalid session token', 401, 'invalid_token');
}
```

Don't log:

- createSession() throw (expected, not a failure)
- Normal null returns (e.g., user not found)

## State of the Art

| Old Approach             | Current Approach      | When Changed | Impact                   |
| ------------------------ | --------------------- | ------------ | ------------------------ |
| API call for permissions | Local JWT decode      | Phase 3      | No network round-trip    |
| sessionToken optional    | sessionToken required | Phase 3      | Simpler null handling    |
| CloudSession from API    | Constructed from JWT  | Phase 3      | handleCallback() changes |

**Deprecated/outdated:**

- `client.getUserPermissions()`: No longer called by provider
- Optional sessionToken: Now required on CloudUser

## Open Questions

1. **JWT claim names**
   - What we know: Role is in JWT
   - What's unclear: Exact claim name (`role` vs `roles` vs custom)
   - Recommendation: Assume `role`, add comment noting this may change

2. **Expiration handling**
   - What we know: JWT has `exp` claim
   - What's unclear: Should getPermissions() check expiration?
   - Recommendation: No - validation happens elsewhere, decode-only is fine

## Sources

### Primary (HIGH confidence)

- packages/core/src/ee/defaults/roles.ts - resolvePermissions(), DEFAULT_ROLES API
- auth/auth0/src/index.ts - jose usage pattern in codebase
- 03-CONTEXT.md - User decisions for this phase

### Secondary (MEDIUM confidence)

- [jose npm](https://www.npmjs.com/package/jose) - decodeJwt() API
- [jwt-decode npm](https://www.npmjs.com/package/jwt-decode) - Alternative considered
- [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401) - HTTP status codes

### Tertiary (LOW confidence)

- Web search for JWT decode patterns (verified against jose docs)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - jose already in monorepo
- Architecture: HIGH - resolvePermissions() API verified in codebase
- Pitfalls: HIGH - Derived from code analysis

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days, stable domain)
