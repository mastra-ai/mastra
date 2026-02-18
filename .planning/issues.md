# Security Audit Issues — auth-rbac-feature Branch

> Audit Date: 2026-01-29
> Branch: auth-rbac-feature (177 commits ahead of main)
> Auditor: Claude Code

## Summary

| Severity | Count       | Status                   |
| -------- | ----------- | ------------------------ |
| CRITICAL | 5 (1 fixed) | 🔴 Fix before merge      |
| HIGH     | 7 (2 fixed) | 🟠 Fix before production |
| MEDIUM   | 10          | 🟡 Address in follow-up  |
| LOW      | 6           | 🟢 Nice to have          |

---

## CRITICAL Issues

### CRIT-1: JWT Expiration Not Validated in auth/cloud

**File:** `auth/cloud/src/index.ts:100-115`
**Impact:** Expired tokens accepted as valid
**Status:** ✅ Fixed

**Problem:**

```typescript
async getCurrentUser(request: Request): Promise<CloudUser | null> {
  const sessionToken = this.extractSessionToken(request);
  if (!sessionToken) return null;

  try {
    // sessionToken IS the JWT - decode it locally to get user info (NO API call)
    const claims = decodeJwt(sessionToken);  // <-- DOES NOT VERIFY!

    return {
      id: claims.sub as string,
      // ...
    };
  } catch {
    return null;
  }
}
```

`decodeJwt()` from `jose` only decodes the JWT payload without verifying the signature or checking expiration. An attacker with an expired token can still authenticate.

**Affected Methods:**

- `getCurrentUser()` (line 96)
- `getRoles()` (line 211)
- `hasRole()` (line 221)
- `getPermissions()` (line 230)

**Recommended Fix:**

```typescript
import { jwtVerify } from 'jose';

async getCurrentUser(request: Request): Promise<CloudUser | null> {
  const sessionToken = this.extractSessionToken(request);
  if (!sessionToken) return null;

  try {
    // Option 1: At minimum, check exp claim manually
    const claims = decodeJwt(sessionToken);
    if (claims.exp && claims.exp < Date.now() / 1000) {
      return null; // Token expired
    }

    // Option 2: Better - verify signature with JWKS
    // const { payload } = await jwtVerify(sessionToken, JWKS);

    return { id: claims.sub as string, ... };
  } catch {
    return null;
  }
}
```

---

### CRIT-3: Unsafe Type Casting on Request Object

**Files:**

- `packages/server/src/server/server-adapter/index.ts:259`
- `server-adapters/express/src/auth-middleware.ts:61`
- `server-adapters/hono/src/auth-middleware.ts:64`

**Impact:** Type safety removed in auth-critical code path
**Status:** 🔴 Open

**Problem:**

```typescript
// packages/server/src/server/server-adapter/index.ts:259
user = await authConfig.authenticateToken(token ?? '', context.request as any);

// server-adapters/express/src/auth-middleware.ts:61
user = await authConfig.authenticateToken(token, req as any);
```

The `as any` cast removes all type safety. Auth providers may receive incompatible request types, causing:

- Silent failures
- Security bypasses if providers assume certain properties exist
- Runtime errors in production

**Recommended Fix:**
Define a common interface:

```typescript
interface AuthRequest {
  headers: Headers | Record<string, string | undefined>;
  url: string;
}

// Then use explicit conversion, not casting
const authRequest: AuthRequest = {
  headers: request.headers,
  url: request.url,
};
user = await authConfig.authenticateToken(token ?? '', authRequest);
```

---

### CRIT-4: Missing Request in Express Handler Params

**File:** `server-adapters/express/src/index.ts:441`
**Impact:** MCP routes fail silently in Express
**Status:** 🔴 Open

**Problem:**

```typescript
// Line 441 - Express handler params
const handlerParams = {
  ...params.urlParams,
  ...params.queryParams,
  ...(typeof params.body === 'object' ? params.body : {}),
  requestContext: res.locals.requestContext,
  mastra: this.mastra,
  registeredTools: res.locals.registeredTools,
  taskStore: res.locals.taskStore,
  abortSignal: res.locals.abortSignal,
  routePrefix: prefix,
  // MISSING: request: toWebRequest(req)
};
```

Hono includes `request` (line 401), but Express doesn't. Routes that need the request object will silently fail.

**Recommended Fix:**

```typescript
const handlerParams = {
  // ... existing params ...
  request: toWebRequest(req), // Add this
};
```

---

### CRIT-5: Unvalidated JWT Decoding in WorkOS getLogoutUrl

**File:** `auth/workos/src/auth-provider.ts:373-378`
**Impact:** Session ID injection
**Status:** 🔴 Open

**Problem:**

```typescript
getLogoutUrl(redirectUri: string, request: Request): string | null | Promise<string | null> {
  // ... auth via withAuth() ...

  // Decode JWT to extract sid claim (don't verify, just decode)
  const [, payloadBase64] = auth.accessToken.split('.');
  if (!payloadBase64) {
    return null;
  }

  const payload = JSON.parse(atob(payloadBase64));
  const sessionId = payload.sid;
```

Manual JWT decoding without verification. Even though AuthKit's `withAuth()` verifies the token earlier, manually decoding again creates:

- Code that's hard to audit (trust boundary unclear)
- Risk if future changes move this code before verification

**Recommended Fix:**

```typescript
// Document the trust boundary
// AuthKit's withAuth() has already verified this token
const [, payloadBase64] = auth.accessToken.split('.');

// Add defensive check
if (!payloadBase64 || payloadBase64.length < 10) {
  console.warn('Invalid access token format for logout');
  return null;
}

// Consider using jose's decodeJwt instead of manual parsing
const payload = decodeJwt(auth.accessToken);
```

---

### CRIT-6: Cookie Security Not Validated in Production

**File:** `auth/workos/src/auth-provider.ts:120`
**Impact:** Cookies may be sent over HTTP in production
**Status:** 🔴 Open

**Problem:**

```typescript
const authConfig: ConfigInterface = {
  apiHttps: true, // Hardcoded, no validation
  cookieSecure: undefined, // Falls back to AuthKit default
  cookieSameSite: options?.session?.sameSite?.toLowerCase() as 'lax' | 'strict' | 'none' | undefined,
  cookieDomain: undefined,
  // ...
};
```

No runtime validation that:

- HTTPS is actually being used
- The `Secure` flag is set in production
- Cookie domain is appropriate

**Recommended Fix:**

```typescript
const isProduction = process.env.NODE_ENV === 'production';

if (isProduction && !options?.session?.secure) {
  console.warn('[WorkOS] Cookie secure flag not explicitly set in production');
}

const authConfig: ConfigInterface = {
  apiHttps: true,
  cookieSecure: options?.session?.secure ?? isProduction, // Default to true in prod
  // ... rest
};
```

---

## HIGH Severity Issues

### HIGH-1: Permission Cache Race Condition

**File:** `auth/workos/src/rbac-provider.ts:163-193`
**Impact:** Stale permissions, memory leak
**Status:** ✅ Fixed

**Problems:**

1. No way to invalidate cache for specific user when roles change
2. No cache size limit - unbounded memory growth
3. `clearCache()` clears ALL users (inefficient)

**Fix Applied:**

- Replaced `Map` with `LRUCache` from `lru-cache` package
- Added configurable cache options (`maxSize`, `ttlMs`)
- Added `clearUserCache(userId)` for per-user cache invalidation
- Added `getCacheStats()` for monitoring cache size
- Default max size: 1000 users, default TTL: 60 seconds

---

### HIGH-2: OpenAPI Endpoint Not Auth-Protected

**File:** `packages/server/src/server/server-adapter/index.ts:357-365`
**Impact:** API enumeration by unauthenticated users
**Status:** 🟠 Open

**Problem:**

```typescript
const openApiRoute: ServerRoute = {
  method: 'GET',
  path,
  responseType: 'json',
  handler: async () => openApiSpec,
  // Missing: requiresAuth
};
```

OpenAPI spec reveals all API endpoints, parameters, and security schemes.

**Recommended Fix:**

```typescript
const openApiRoute: ServerRoute = {
  method: 'GET',
  path,
  responseType: 'json',
  requiresAuth: config.requiresAuth !== false, // Default to protected
  handler: async () => openApiSpec,
};
```

---

### HIGH-3: Redundant Auth Checks (TOCTOU)

**File:** `packages/server/src/server/server-adapter/index.ts:211-322`
**Impact:** Race condition between auth checks
**Status:** ✅ Fixed

Auth checked twice:

1. Middleware (auth-middleware.ts)
2. Route handler (checkRouteAuth)

If permissions change between checks, inconsistent behavior.

**Fix Applied:**

- Middleware now sets `authCompleted` flag in request context after successful auth
- `checkRouteAuth` checks for this flag and skips redundant auth if middleware already handled it
- This prevents TOCTOU race conditions and reduces redundant work

---

### HIGH-4: Weak Webhook Signature Verification

**File:** `auth/workos/src/directory-sync.ts:107-116`
**Impact:** Webhook injection
**Status:** 🟠 Open

**Problems:**

```typescript
const parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
// No try-catch for JSON.parse
// No validation that signature exists
const event = (await this.workos.webhooks.constructEvent({...})) as unknown as DirectorySyncEvent;
// Unsafe type assertion
```

**Recommended Fix:**

```typescript
if (!signature) {
  throw new Error('Missing webhook signature');
}

let parsedPayload: unknown;
try {
  parsedPayload = typeof payload === 'string' ? JSON.parse(payload) : payload;
} catch {
  throw new Error('Invalid webhook payload');
}

// Add type guard instead of casting
```

---

### HIGH-5: Blind Organization Selection

**File:** `auth/workos/src/auth-provider.ts:177-187`
**Impact:** Wrong org permissions applied
**Status:** 🟠 Open

```typescript
organizationId: memberships.data[0]?.organizationId; // Takes first blindly
```

**Recommended Fix:**

- Require explicit org selection via config
- Or use organization from JWT claims if available

---

### HIGH-6: Case-Insensitive Path Matching

**File:** `packages/server/src/server/auth/path-pattern.ts:71`
**Impact:** Pattern bypass via case variations
**Status:** 🟠 Open

```typescript
pattern: new RegExp('^' + pattern + (loose ? '(?=$|/)' : '/?$'), 'i'); // 'i' flag
```

**Recommended Fix:**
Remove `'i'` flag or make it configurable.

---

### HIGH-7: Webhook Failures Return Success

**File:** `auth/workos/src/directory-sync.ts:119-124`
**Impact:** Webhook retries won't be triggered
**Status:** 🟠 Open

```typescript
try {
  await this.routeEvent(event);
} catch (error) {
  console.error(...);  // Error logged but not returned
}
// Returns void - caller thinks success
```

**Recommended Fix:**
Return `{success: boolean, error?: string}` result object.

---

## MEDIUM Severity Issues

### MED-1: Silent Failures in Org Fetch

**File:** `auth/workos/src/auth-provider.ts:220-231`
Empty catch block silently ignores all errors.

### MED-2: No Session Expiration Validation

**File:** `auth/workos/src/auth-provider.ts:150-168`
No explicit check that session token is non-expired.

### MED-3: Unsafe Type Assertion

**File:** `auth/workos/src/auth-provider.ts:249`
`(user as any)._refreshedSessionData = ...`

### MED-4: Unbounded Cookie Parsing

**File:** `auth/workos/src/session-storage.ts:35-45`
No size limit on cookie header (DoS vector), no cookie name validation.

### MED-5: Verbose Error Messages

**Files:** Multiple server files
Errors like "No token verification method configured" leak implementation details.

### MED-6: No authenticateToken Return Validation

**Files:** Multiple auth-middleware files
Any return value accepted without type checking.

### MED-7: Unsafe Base64 JSON Parsing

**Files:** `server-adapters/hono/src/index.ts:92`, `express:87`
Request context parsed without error handling.

### MED-8: Errors Swallowed in verifyToken

**File:** `auth/cloud/src/client.ts:205-207`
All errors return null, hiding actual failures.

### MED-9: Regex Injection in Cookie Extraction

**File:** `auth/cloud/src/index.ts:275`
Cookie name used directly in regex without escaping special characters.

### MED-10: No Structured Audit Logging

**File:** `auth/workos/src/auth-provider.ts`
`console.log` scattered throughout, no structured logging.

---

## LOW Severity Issues

### LOW-1: Dev Cookie Password Regeneration

**File:** `auth/workos/src/auth-provider.ts:39`
Sessions don't persist across dev restarts.

### LOW-2: Insufficient Directory Sync Validation

**File:** `auth/workos/src/directory-sync.ts:202-220`
Aggressive type casting without runtime validation.

### LOW-3: Missing Error Context in JWT Fallback

**File:** `auth/workos/src/auth-provider.ts:192-195`
Generic error logged without differentiating failure types.

### LOW-4: No CORS/Origin Validation

**Files:** All server adapters
No request origin validation for cookie-based auth.

### LOW-5: Tokens in Query Strings

**Files:** Multiple auth helpers
API keys in query strings get logged and cached.

### LOW-6: Missing JWT Expiration Test Cases

**Files:** `auth/cloud/src/index.test.ts`
No tests for expired/malformed JWTs.

---

## Tracking

| Issue  | Assignee | PR  | Status   |
| ------ | -------- | --- | -------- |
| CRIT-1 | Claude   | -   | ✅ Fixed |
| CRIT-2 | -        | -   | Open     |
| CRIT-3 | -        | -   | Open     |
| CRIT-4 | -        | -   | Open     |
| CRIT-5 | -        | -   | Open     |
| CRIT-6 | -        | -   | Open     |
| HIGH-1 | Claude   | -   | ✅ Fixed |
| HIGH-2 | -        | -   | Open     |
| HIGH-3 | Claude   | -   | ✅ Fixed |
| HIGH-4 | -        | -   | Open     |
| HIGH-5 | -        | -   | Open     |
| HIGH-6 | -        | -   | Open     |
| HIGH-7 | -        | -   | Open     |
