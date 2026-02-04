# Feature Landscape: Auth Client API Alignment

**Domain:** Auth client for Mastra Cloud plugin
**Researched:** 2026-01-28
**Context:** Brownfield update to `@mastra/auth-cloud` plugin

---

## Table Stakes

Features users expect from a production auth client. Missing = security risk or broken flows.

| Feature                                  | Why Expected                                                                          | Complexity | Notes                             |
| ---------------------------------------- | ------------------------------------------------------------------------------------- | ---------- | --------------------------------- |
| **Bearer token in Authorization header** | Industry standard (RFC 6750). Body tokens leak in logs, proxies, and error responses. | Low        | Current gap: token in body        |
| **Response envelope unwrapping**         | Cloud API returns `{ ok, data, error }`. Raw response = broken parsing.               | Low        | Current gap: expects raw objects  |
| **Token expiry checking**                | Prevents sending expired tokens. 401 cascades are poor UX.                            | Low        | Check `exp` claim before requests |
| **Session cookie extraction**            | Sessions stored in httpOnly cookies. Must parse `Cookie` header correctly.            | Low        | Already implemented               |
| **Graceful error handling**              | Network failures, 4xx, 5xx must not throw unhandled errors.                           | Low        | Already mostly implemented        |
| **HTTPS in production**                  | Tokens over HTTP = credential theft.                                                  | Low        | Enforce via config                |
| **CSRF state validation**                | OAuth `state` param must be verified on callback.                                     | Low        | Already implemented               |
| **API versioning support**               | Cloud uses `/api/v1/` prefix. Must match spec.                                        | Low        | Current gap: uses `/api/`         |

---

## Differentiators

Features that elevate the client beyond basic functionality. Not expected, but valued.

| Feature                              | Value Proposition                                                         | Complexity | Notes                                        |
| ------------------------------------ | ------------------------------------------------------------------------- | ---------- | -------------------------------------------- |
| **Automatic token refresh**          | Extends sessions without re-login. Invisible to users.                    | Medium     | Cloud endpoint: `POST /api/v1/oauth/refresh` |
| **Token refresh buffer**             | Refresh 5 min before expiry, not at expiry. Prevents race conditions.     | Low        | Check `exp - buffer > now`                   |
| **Request retry with backoff**       | Transient failures (503, network) auto-retry. Reduces user-facing errors. | Medium     | Exponential backoff (1s, 2s, 4s)             |
| **Concurrent request deduplication** | Multiple components requesting same user don't multiply API calls.        | Medium     | Promise caching pattern                      |
| **Offline detection**                | Graceful degradation when Cloud unreachable.                              | Low        | `navigator.onLine` + fetch timeout           |
| **Request timeout configuration**    | Prevent hung requests. Default: 30s, configurable.                        | Low        | `AbortController` + timeout                  |
| **Debug logging**                    | Opt-in verbose logging for troubleshooting.                               | Low        | `debug: true` config option                  |
| **Token introspection**              | Read JWT claims without API call for basic user info.                     | Low        | Decode JWT, don't verify                     |

---

## Anti-Features

Features to explicitly NOT build. Common mistakes in auth clients.

| Anti-Feature                         | Why Avoid                                                           | What to Do Instead                         |
| ------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------ |
| **Token in URL query params**        | Appears in browser history, server logs, Referer headers.           | Use Authorization header                   |
| **Token in request body**            | Can leak in error responses, proxy logs. Less standard than header. | Use Authorization header                   |
| **Storing token in client instance** | Client is singleton, multiple users = token collision.              | Pass token per-request or store externally |
| **Silent error swallowing**          | `try { } catch { return null }` hides root cause.                   | Log errors, return typed error objects     |
| **Auto-refresh on every request**    | Unnecessary API calls, race conditions.                             | Refresh only when near expiry              |
| **Synchronous token storage**        | Blocks UI. localStorage is synchronous but can be slow.             | Use async patterns                         |
| **JWT verification in client**       | JWKS fetch adds latency. Server already verified.                   | Trust server response, optionally decode   |
| **Retry on 4xx errors**              | 400/401/403/404 are deterministic failures. Retry won't help.       | Only retry 5xx and network errors          |
| **Infinite retry loops**             | Failing endpoint hammered forever.                                  | Max retry count (3-5), then fail           |
| **Hardcoded timeouts**               | Different environments need different settings.                     | Make configurable with sensible defaults   |

---

## Feature Dependencies

```
                    Token Storage
                         |
                         v
               +------------------+
               |  Bearer Header   | <-- Required first
               +------------------+
                         |
          +--------------+--------------+
          |              |              |
          v              v              v
    Expiry Check    Refresh Flow    Error Handling
          |              |              |
          v              v              v
    Refresh Buffer   Retry Logic   Debug Logging
```

**Dependency notes:**

- Bearer header must work before token refresh makes sense
- Expiry checking enables smart refresh (don't refresh valid tokens)
- Error handling enables retry logic (need to know what failed)

---

## MVP Recommendation

For initial alignment with Cloud spec, prioritize:

1. **Bearer token in Authorization header** - Security fix, spec compliance
2. **Response envelope unwrapping** - Functional fix, spec compliance
3. **API path updates** - Spec compliance (`/api/v1/` prefix)
4. **Token parameter passing** - Fix singleton token collision

Defer to post-MVP:

- **Token refresh**: Cloud endpoint may not exist yet
- **Retry logic**: Nice-to-have, not blocking
- **Request deduplication**: Optimization, not correctness

---

## Detailed Feature Specifications

### Bearer Token in Authorization Header

**Current:**

```typescript
body: JSON.stringify({ token });
```

**Target:**

```typescript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json',
  'X-Project-ID': this.projectId,
}
```

**Rationale:**

- RFC 6750 defines Bearer token usage in Authorization header
- Prevents token leakage in request body logging
- Consistent with Cloud team's API spec
- Consistent with WorkOS pattern (existing plugin)

**Affected methods:**

- `verifyToken()`
- `validateSession()`
- `destroySession()`
- `getUser()`
- `getUserPermissions()`

---

### Response Envelope Unwrapping

**Current expects:**

```typescript
interface VerifyTokenResponse {
  user: Record<string, unknown>;
}
```

**Cloud returns:**

```typescript
{
  ok: true,
  data: {
    user: { ... }
  }
}
// or
{
  ok: false,
  error: {
    message: string,
    status: number
  }
}
```

**Solution:**

```typescript
interface CloudApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    status: number;
  };
}

function unwrapResponse<T>(response: CloudApiResponse<T>): T {
  if (!response.ok || !response.data) {
    throw new CloudApiError(response.error?.message ?? 'Unknown error', response.error?.status ?? 500);
  }
  return response.data;
}
```

---

### Token Lifecycle Patterns

**Storage options (recommendation: external):**

| Option                | Pros                | Cons                    | Recommendation     |
| --------------------- | ------------------- | ----------------------- | ------------------ |
| Client instance field | Simple              | Multi-user collision    | Avoid              |
| User object field     | Per-user storage    | Mutates user object     | Acceptable         |
| Request context       | Clean separation    | Requires passing around | Preferred          |
| External store        | Maximum flexibility | More complexity         | For advanced cases |

**Current approach in implementation plan:** Add `sessionToken` field to `CloudUser` type.

**Expiry handling:**

```typescript
function isTokenExpired(token: string, bufferSeconds = 300): boolean {
  try {
    const [, payload] = token.split('.');
    const { exp } = JSON.parse(atob(payload));
    return Date.now() / 1000 > exp - bufferSeconds;
  } catch {
    return true; // Treat malformed tokens as expired
  }
}
```

---

### Session Management Patterns

**Session extraction (already implemented correctly):**

```typescript
private extractSessionToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${this.cookieName}=([^;]+)`));
  return match?.[1] ?? null;
}
```

**Session cookie format:**

```
Set-Cookie: mastra_session={id}; HttpOnly; SameSite=Lax; Path=/; Max-Age={seconds}
```

**Key attributes:**

- `HttpOnly`: Prevents XSS token theft
- `SameSite=Lax`: CSRF protection while allowing top-level navigation
- `Path=/`: Cookie sent for all paths
- `Max-Age`: Server-controlled expiry

---

### Request Authentication Patterns

**Pattern 1: Token in header (RECOMMENDED)**

```typescript
fetch(url, {
  headers: {
    Authorization: `Bearer ${token}`,
  },
});
```

**Pattern 2: Token in body (AVOID)**

```typescript
fetch(url, {
  body: JSON.stringify({ token }),
});
```

**Pattern 3: Token in URL (NEVER)**

```typescript
fetch(`${url}?token=${token}`); // SECURITY RISK
```

---

## Sources

**Existing codebase:**

- `/auth/cloud/src/client.ts` - Current implementation
- `/auth/cloud/src/index.ts` - Provider implementation
- `/auth/workos/src/auth-provider.ts` - Reference implementation
- `/auth/workos/src/session-storage.ts` - Cookie handling reference
- `/packages/core/src/ee/interfaces/` - Interface contracts

**Project specs:**

- `SPEC_REVIEW.md` - Cloud API requirements
- `IMPLEMENTATION_PLAN.md` - Approved changes
- `PLUGIN_SPEC_EXPLORE.md` - Cloud team's API design

**Standards:**

- RFC 6750 - Bearer Token Usage
- RFC 6749 - OAuth 2.0 Authorization Framework

---

## Confidence Assessment

| Area               | Confidence | Reason                                      |
| ------------------ | ---------- | ------------------------------------------- |
| Table stakes       | HIGH       | Based on existing interfaces and Cloud spec |
| Anti-features      | HIGH       | Common security patterns, RFC standards     |
| Differentiators    | MEDIUM     | Depends on Cloud endpoint availability      |
| Token lifecycle    | HIGH       | JWT standard, existing WorkOS pattern       |
| Session management | HIGH       | Cookie handling proven in codebase          |
