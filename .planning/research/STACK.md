# Technology Stack: HTTP Auth Client

**Project:** @mastra/auth-cloud client alignment
**Researched:** 2026-01-28

---

## Executive Summary

Use native `fetch` with a typed wrapper pattern. No external HTTP libraries needed. The existing client.ts already uses fetch correctly — add response unwrapping and Authorization headers.

---

## Recommended Stack

### HTTP Client

| Technology     | Version  | Purpose       | Why                                                              |
| -------------- | -------- | ------------- | ---------------------------------------------------------------- |
| Native `fetch` | Built-in | HTTP requests | Zero dependencies, TypeScript support, sufficient for auth flows |

**Rationale:**

- Monorepo already uses native fetch everywhere (`packages/core/src/utils.ts:fetchWithRetry`, playground hooks)
- Auth client is simple CRUD — no need for axios's interceptor complexity
- fetch is standard, no versioning concerns

---

### Type-Safe Response Pattern

| Pattern                       | Purpose                                   | Implementation           |
| ----------------------------- | ----------------------------------------- | ------------------------ |
| Generic unwrap function       | Extract `data` from `{ ok, data, error }` | Single utility, reusable |
| Discriminated union responses | Type-safe error handling                  | `CloudApiResponse<T>`    |
| Branded types for IDs         | Prevent ID misuse                         | `UserId`, `SessionId`    |

**Response wrapper type:**

```typescript
// Matches Cloud API spec from IMPLEMENTATION_PLAN.md
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

**Unwrap utility:**

```typescript
async function unwrapResponse<T>(response: Response): Promise<T> {
  const json: CloudApiResponse<T> = await response.json();

  if (!json.ok || !json.data) {
    throw new CloudApiError(
      json.error?.message ?? 'Unknown error',
      json.error?.status ?? response.status,
      json.error?.code,
    );
  }

  return json.data;
}
```

---

### Authorization Header Pattern

| Pattern                         | When                    | Implementation                       |
| ------------------------------- | ----------------------- | ------------------------------------ |
| `Authorization: Bearer <token>` | Authenticated endpoints | Pass token to method, add to headers |
| `X-Project-ID: <id>`            | All requests            | Add in base request builder          |

**Request builder:**

```typescript
private buildHeaders(token?: string): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    'X-Project-ID': this.projectId,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}
```

**Why pass token as parameter, not store on client:**

- Client is singleton
- Multiple users = multiple tokens
- WorkOS pattern: `getUser(userId)` — no stored state
- Stateless = thread-safe

---

### Error Handling Pattern

| Pattern                     | Purpose                            | Confidence |
| --------------------------- | ---------------------------------- | ---------- |
| Custom error class          | Structured errors with code/status | HIGH       |
| Return `null` for not-found | Matches existing client.ts pattern | HIGH       |
| Throw for unexpected errors | Surface issues to caller           | HIGH       |

**Error class:**

```typescript
class CloudApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'CloudApiError';
  }

  get isAuthError(): boolean {
    return this.status === 401 || this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}
```

**Error handling strategy:**

```typescript
async verifyToken(token: string): Promise<CloudUser | null> {
  try {
    const response = await fetch(url, { headers: this.buildHeaders(token) });

    // 401/403 = invalid token, return null (not error)
    if (response.status === 401 || response.status === 403) {
      return null;
    }

    // Other errors = throw
    if (!response.ok) {
      throw new CloudApiError(`Verify failed`, response.status);
    }

    return unwrapResponse<VerifyData>(response).then(d => this.parseUser(d.user));
  } catch (error) {
    // Network errors = return null (can't verify)
    if (error instanceof TypeError) {
      return null;
    }
    throw error;
  }
}
```

---

## Alternatives Considered

| Option                     | Recommendation | Why Not                                                   |
| -------------------------- | -------------- | --------------------------------------------------------- |
| axios                      | Do not use     | Extra dependency, interceptors overkill for this use case |
| ky                         | Do not use     | Good library, but fetch already works, avoid churn        |
| got                        | Do not use     | Node-only, Mastra supports edge runtimes                  |
| Custom fetch wrapper class | Do not use     | Over-engineering, simple functions suffice                |
| ofetch                     | Do not use     | Nice ergonomics but adds dependency                       |

---

## TypeScript Patterns

### Response Type Definitions

```typescript
// Raw API response shapes (snake_case from API)
interface CloudUserData {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  roles: string[];
  created_at: string;
}

interface CloudSessionData {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

// Endpoint-specific response data
interface CallbackData {
  user: CloudUserData;
  session: CloudSessionData;
}

interface VerifyData {
  user: CloudUserData;
}

interface ValidateData {
  session: CloudSessionData;
  valid: boolean;
}

interface PermissionsData {
  permissions: string[];
}
```

### Transform Functions

```typescript
// snake_case API -> camelCase domain
private parseUser(data: CloudUserData): CloudUser {
  return {
    id: data.id,
    email: data.email,
    name: data.name ?? undefined,
    avatarUrl: data.avatar_url ?? undefined,
    roles: data.roles,
    createdAt: new Date(data.created_at),
  };
}
```

---

## DO NOT

| Anti-pattern                   | Why                                   |
| ------------------------------ | ------------------------------------- |
| Store token on client instance | Multiple users share client singleton |
| Use `any` for API responses    | Loses type safety, defeats purpose    |
| Swallow all errors             | Hide real issues                      |
| Create fetch wrapper class     | Over-engineering for 8 methods        |
| Add retry logic                | Auth failures shouldn't retry         |
| Add request interceptors       | Overkill for explicit header passing  |

---

## Implementation Checklist

- [ ] Add `CloudApiResponse<T>` type
- [ ] Add `CloudApiError` class
- [ ] Add `unwrapResponse<T>()` utility
- [ ] Add `buildHeaders(token?)` method
- [ ] Update all endpoints to `/api/v1/` paths
- [ ] Update all authenticated methods to accept token parameter
- [ ] Return `null` for 401/403, throw for other errors

---

## Confidence Assessment

| Recommendation          | Confidence | Basis                                 |
| ----------------------- | ---------- | ------------------------------------- |
| Use native fetch        | HIGH       | Monorepo precedent, zero dependencies |
| Generic unwrap pattern  | HIGH       | Standard TS pattern, matches spec     |
| Pass token as parameter | HIGH       | WorkOS precedent, stateless           |
| Custom error class      | HIGH       | Standard pattern                      |
| Avoid axios             | HIGH       | No benefit for this use case          |

---

## Sources

- `/auth/cloud/IMPLEMENTATION_PLAN.md` — API spec
- `/auth/cloud/SPEC_REVIEW.md` — Response format
- `/auth/cloud/src/client.ts` — Current implementation
- `/auth/workos/src/auth-provider.ts` — Pattern reference
- `/packages/core/src/utils.ts` — `fetchWithRetry` pattern
- `/packages/playground-ui/src/domains/auth/hooks/` — fetch usage patterns
