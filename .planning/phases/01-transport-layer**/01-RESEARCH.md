# Phase 1: Transport Layer - Research

**Researched:** 2026-01-28
**Domain:** TypeScript HTTP client with bearer auth and response envelope unwrapping
**Confidence:** HIGH

## Summary

This phase establishes HTTP transport primitives for the Mastra Cloud auth client. The requirements are straightforward: send `Authorization: Bearer <token>` headers and unwrap `{ ok, data }` response envelopes.

The existing `client.ts` already uses native `fetch` with standard patterns. The changes required are mechanical: update headers, unwrap responses, update paths. No new libraries needed — this is pure TypeScript refactoring.

The Mastra client SDK (`client-sdks/client-js`) provides a reference implementation with retry logic, error handling, and header injection. The Cloud client can follow the same patterns but simpler (no retries needed for auth).

**Primary recommendation:** Keep using native `fetch`. Add a `request<T>()` helper with generic response unwrapping and Bearer auth injection.

## Standard Stack

### Core

| Library      | Version  | Purpose       | Why Standard                    |
| ------------ | -------- | ------------- | ------------------------------- |
| Native fetch | Built-in | HTTP requests | Zero dependencies, standard API |
| TypeScript   | ^5.0     | Type safety   | Already in project              |

### Supporting

| Library | Version | Purpose | When to Use                            |
| ------- | ------- | ------- | -------------------------------------- |
| None    | —       | —       | Native fetch sufficient for this scope |

### Alternatives Considered

| Instead of   | Could Use    | Tradeoff                                                         |
| ------------ | ------------ | ---------------------------------------------------------------- |
| Native fetch | ky/got/axios | Overkill for simple client, adds dependency                      |
| Manual types | zod          | Runtime validation useful but not required for trusted Cloud API |

**Installation:**

```bash
# No additional packages needed
```

## Architecture Patterns

### Recommended Project Structure

```
auth/cloud/src/
├── client.ts      # HTTP client with request helper
└── index.ts       # Auth provider (consumes client)
```

### Pattern 1: Generic Request Helper with Response Unwrapping

**What:** Single method handles all HTTP requests, unwraps `{ ok, data }` envelope
**When to use:** All Cloud API calls
**Example:**

```typescript
// Source: Derived from IMPLEMENTATION_PLAN.md + client-sdks/client-js/src/resources/base.ts
interface CloudApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    status: number;
  };
}

class CloudApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string
  ) {
    super(message);
    this.name = 'CloudApiError';
  }
}

private async request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Project-ID': this.projectId,
    ...options.headers as Record<string, string>,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${this.baseUrl}${path}`, {
    ...options,
    headers,
  });

  const json = await response.json() as CloudApiResponse<T>;

  if (!json.ok || !response.ok) {
    throw new CloudApiError(
      json.error?.message ?? `Request failed: ${response.status}`,
      json.error?.status ?? response.status,
      json.error?.code
    );
  }

  return json.data as T;
}
```

### Pattern 2: Optional Token Parameter

**What:** Methods accept token as optional last parameter
**When to use:** Authenticated endpoints like `getUser()`, `getUserPermissions()`
**Example:**

```typescript
async getUser(userId: string, token: string): Promise<CloudUser | null> {
  try {
    const data = await this.request<UserData>(
      `/api/v1/users/${userId}`,
      { method: 'GET' },
      token
    );
    return this.parseUser(data.user);
  } catch (error) {
    if (error instanceof CloudApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
```

### Anti-Patterns to Avoid

- **Token in client state:** Don't store token in client instance. Client is singleton, multiple users have different tokens.
- **Swallowing errors silently:** Current code returns `null` on any error. New code should throw `CloudApiError` and let callers decide.
- **Parsing JSON before checking ok:** Check `response.ok` AND `json.ok` — both must be true.

## Don't Hand-Roll

| Problem          | Don't Build                  | Use Instead                   | Why                                   |
| ---------------- | ---------------------------- | ----------------------------- | ------------------------------------- |
| Retry logic      | Custom retry wrapper         | None (skip for auth)          | Auth failures shouldn't retry         |
| Token refresh    | Auto-refresh interceptor     | Caller handles re-auth        | Simpler, Cloud handles session expiry |
| Response parsing | Manual json parse per method | Generic `request<T>()` helper | DRY, type-safe                        |

**Key insight:** The Cloud client is simple enough that a single `request()` helper covers all cases. Don't over-engineer.

## Common Pitfalls

### Pitfall 1: Checking Only response.ok

**What goes wrong:** Cloud returns 200 with `{ ok: false, error: {...} }` for some errors
**Why it happens:** API design uses envelope for error semantics
**How to avoid:** Always check BOTH `response.ok` AND `json.ok`
**Warning signs:** Getting `undefined` data when expecting error

### Pitfall 2: Token in Body vs Header

**What goes wrong:** Current code sends token in request body
**Why it happens:** Initial implementation before Cloud spec finalized
**How to avoid:** Always use `Authorization: Bearer <token>` header
**Warning signs:** 401 errors even with valid token

### Pitfall 3: Missing Type Narrowing in Catch

**What goes wrong:** TypeScript 4.4+ defaults catch variable to `unknown`
**Why it happens:** Stricter error typing
**How to avoid:** Narrow with `instanceof CloudApiError` before accessing properties
**Warning signs:** TypeScript errors on `error.status`

### Pitfall 4: Forgetting X-Project-ID

**What goes wrong:** Cloud rejects request with 400
**Why it happens:** Project scoping is required
**How to avoid:** Include in every request via `request()` helper
**Warning signs:** "Missing project ID" errors

## Code Examples

### Complete Request Helper

```typescript
// Source: Synthesized from spec + client-sdks/client-js pattern
private async request<T>(
  path: string,
  options: RequestInit = {},
  token?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Project-ID': this.projectId,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${this.baseUrl}${path}`, {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await response.json() as CloudApiResponse<T>;

  if (!response.ok || !json.ok) {
    throw new CloudApiError(
      json.error?.message ?? `HTTP ${response.status}`,
      json.error?.status ?? response.status,
      json.error?.code
    );
  }

  if (json.data === undefined) {
    throw new CloudApiError('No data in response', 500);
  }

  return json.data;
}
```

### CloudApiError Class

```typescript
// Source: Standard pattern from web search
export class CloudApiError extends Error {
  public readonly status: number;
  public readonly code?: string;

  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'CloudApiError';
    this.status = status;
    this.code = code;
    Object.setPrototypeOf(this, CloudApiError.prototype);
  }
}
```

### CloudApiResponse Type

```typescript
// Source: IMPLEMENTATION_PLAN.md spec
interface CloudApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    status: number;
  };
}
```

## State of the Art

| Old Approach    | Current Approach    | When Changed    | Impact                       |
| --------------- | ------------------- | --------------- | ---------------------------- |
| Token in body   | Bearer header       | Cloud spec 2026 | Must update all auth methods |
| Direct response | Envelope unwrapping | Cloud spec 2026 | All response parsing changes |
| `/api/` paths   | `/api/v1/` prefix   | Cloud spec 2026 | URL updates throughout       |

**Deprecated/outdated:**

- `/api/auth/verify` path: Now `/api/v1/auth/verify`
- Token in `{ token }` body: Now in `Authorization` header

## Open Questions

1. **Error code standardization**
   - What we know: Errors have `code` field
   - What's unclear: Are codes like `invalid_token` documented?
   - Recommendation: Handle codes when needed, log unrecognized ones

2. **Rate limiting**
   - What we know: Cloud may rate limit auth endpoints
   - What's unclear: Headers format (`X-RateLimit-*` vs `RateLimit-*`)
   - Recommendation: Don't implement rate limit handling now, add later if needed

## Sources

### Primary (HIGH confidence)

- IMPLEMENTATION_PLAN.md - Approved API contract spec
- SPEC_REVIEW.md - Cloud endpoint requirements
- client-sdks/client-js/src/resources/base.ts - Existing Mastra HTTP pattern

### Secondary (MEDIUM confidence)

- [MDN fetch documentation](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch) - Standard fetch patterns
- [Jason Watmore blog](https://jasonwatmore.com/fetch-add-bearer-token-authorization-header-to-http-request) - Bearer token pattern

### Tertiary (LOW confidence)

- Web search results for TypeScript HTTP patterns (verified against MDN)

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Native fetch, no decisions needed
- Architecture: HIGH - Pattern exists in codebase (client-sdks)
- Pitfalls: HIGH - Derived from spec analysis

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (30 days, stable domain)
