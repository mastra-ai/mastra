# Architecture Patterns: Auth Client Internal Structure

**Domain:** Auth client API alignment for `@mastra/auth-cloud`
**Researched:** 2026-01-28
**Context:** Brownfield update to match Cloud API specification

---

## Recommended Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     MastraCloudAuth (index.ts)                     │
│              Implements: IUserProvider, ISessionProvider,          │
│                          ISSOProvider, IRBACProvider               │
│                                                                    │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                    Interface Methods                         │   │
│  │  getCurrentUser(request) → extracts token, delegates        │   │
│  │  getPermissions(user) → uses user.sessionToken              │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                              │                                     │
│                              ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                  MastraCloudClient (client.ts)               │   │
│  │                      Singleton Instance                      │   │
│  │                                                              │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │              Public API Methods                      │    │   │
│  │  │  verifyToken(token)                                  │    │   │
│  │  │  validateSession(token)                              │    │   │
│  │  │  destroySession(token, sessionId)                    │    │   │
│  │  │  getUser(userId, token)                              │    │   │
│  │  │  getUserPermissions(userId, token)                   │    │   │
│  │  │  exchangeCode(code)                                  │    │   │
│  │  │  getLoginUrl(redirectUri, state)                     │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                              │                               │   │
│  │                              ▼                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │              Transport Layer                         │    │   │
│  │  │  request<T>(path, options) → CloudApiResponse<T>     │    │   │
│  │  │  - Adds X-Project-ID header                          │    │   │
│  │  │  - Adds Authorization header (when token provided)   │    │   │
│  │  │  - Handles fetch errors → returns { ok: false }      │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                              │                               │   │
│  │                              ▼                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │              Response Layer                          │    │   │
│  │  │  unwrapResponse<T>(response) → T | null              │    │   │
│  │  │  - Extracts data from { ok, data, error } envelope   │    │   │
│  │  │  - Returns null for { ok: false }                    │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                              │                               │   │
│  │                              ▼                               │   │
│  │  ┌─────────────────────────────────────────────────────┐    │   │
│  │  │              Parsing Layer                           │    │   │
│  │  │  parseUser(data) → CloudUser                         │    │   │
│  │  │  parseSession(data) → CloudSession                   │    │   │
│  │  │  - snake_case → camelCase                            │    │   │
│  │  │  - String dates → Date objects                       │    │   │
│  │  └─────────────────────────────────────────────────────┘    │   │
│  │                                                              │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

---

## Component Boundaries

| Component           | Responsibility                                                                    | Communicates With   |
| ------------------- | --------------------------------------------------------------------------------- | ------------------- |
| `MastraCloudAuth`   | Interface implementation, token extraction from requests, session cookie handling | `MastraCloudClient` |
| `MastraCloudClient` | API communication, URL building, response handling                                | Cloud API via fetch |
| Transport Layer     | HTTP mechanics, headers, error catching                                           | Native fetch        |
| Response Layer      | Envelope unwrapping, null coercion                                                | Transport Layer     |
| Parsing Layer       | Type transformation, date parsing                                                 | Response Layer      |

---

## Data Flow for Auth Operations

### 1. Token Verification Flow

```
Request → MastraCloudAuth.authenticateToken(token)
                │
                ▼
        MastraCloudClient.verifyToken(token)
                │
                ├── request('/api/v1/auth/verify', { token: header })
                │
                ▼
        Cloud API returns { ok: true, data: { user } }
                │
                ├── unwrapResponse() → { user }
                ├── parseUser() → CloudUser
                │
                ▼
        Return CloudUser or null
```

### 2. Session-Based User Lookup Flow

```
Request → MastraCloudAuth.getCurrentUser(request)
                │
                ├── extractSessionToken(request) → token from cookie
                │
                ▼
        MastraCloudClient.validateSession(token)
                │
                ├── request('/api/v1/auth/session/validate', { token: header })
                │
                ▼
        Returns CloudSession with userId
                │
                ▼
        MastraCloudClient.getUser(userId, token)  ← token passed explicitly
                │
                ▼
        Return CloudUser or null
```

### 3. Permission Check Flow

```
MastraCloudAuth.getPermissions(user)
        │
        ├── user.sessionToken exists? ← token stored on user object
        │       │
        │       ├── NO → return []
        │       │
        │       ▼
        │   MastraCloudClient.getUserPermissions(userId, token)
        │       │
        │       ▼
        │   Return string[] or []
        │
        ▼
```

---

## Singleton + Multi-Tenant Token Handling

### Problem Statement

```typescript
// Client is instantiated once at startup
const client = new MastraCloudClient({ projectId: 'proj_xxx' });

// Multiple concurrent users, each with different tokens
// User A: token_aaa
// User B: token_bbb
// User C: token_ccc
```

**Wrong approach:** Store token in client instance

```typescript
// BAD - race conditions, wrong user's data returned
client.setToken(tokenA);
await client.getUser(userIdA); // might use tokenB if another request set it
```

### Correct Approach: Token as Parameter

```typescript
// Token passed per-call, no instance state
async getUser(userId: string, token: string): Promise<CloudUser | null>
async getUserPermissions(userId: string, token: string): Promise<string[]>
async validateSession(token: string): Promise<CloudSession | null>
async destroySession(token: string, sessionId: string): Promise<void>
```

**Client instance holds only:**

- `projectId` (constant)
- `baseUrl` (constant)

**Token flows:**

1. Extracted from request (cookie or header) in `MastraCloudAuth`
2. Passed to `MastraCloudClient` methods
3. Added to request headers in transport layer
4. Stored on `CloudUser.sessionToken` for later use

---

## Transport Layer Design

### Recommended: Single `request<T>` Method

```typescript
interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  token?: string;  // Optional auth token
}

private async request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<CloudApiResponse<T>> {
  const { method = 'GET', body, token } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Project-ID': this.projectId,
  };

  // Add auth header only when token provided
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Always parse JSON, even for errors (Cloud returns structured errors)
    return await response.json() as CloudApiResponse<T>;
  } catch {
    // Network error, timeout, etc.
    return { ok: false, error: { message: 'Network error', status: 0 } };
  }
}
```

### Why This Pattern

| Concern        | Handled By                                      |
| -------------- | ----------------------------------------------- |
| Headers        | `request()` adds project ID + optional auth     |
| HTTP errors    | `request()` catches and returns `{ ok: false }` |
| JSON parsing   | `request()` always parses response              |
| Response shape | `unwrapResponse()` extracts data                |
| Business logic | Public methods use parsed data                  |

---

## Response Layer Design

### `unwrapResponse<T>` Helper

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

private unwrapResponse<T>(response: CloudApiResponse<T>): T | null {
  if (!response.ok || !response.data) {
    return null;
  }
  return response.data;
}
```

### Usage Pattern

```typescript
async verifyToken(token: string): Promise<CloudUser | null> {
  const response = await this.request<{ user: CloudUserData }>(
    '/api/v1/auth/verify',
    { method: 'POST', token }
  );

  const data = this.unwrapResponse(response);
  if (!data) return null;

  return this.parseUser(data.user);
}
```

### Error Handling Variants

**Nullable return (validation-style):**

```typescript
// Returns null on failure - caller handles absence
async validateSession(token: string): Promise<CloudSession | null>
```

**Throws on failure (action-style):**

```typescript
// Throws on failure - operation must succeed
async exchangeCode(code: string): Promise<{ user: CloudUser; session: CloudSession }> {
  const response = await this.request<CallbackData>('/api/v1/auth/callback', {
    method: 'POST',
    body: { code }
  });

  if (!response.ok || !response.data) {
    throw new Error(response.error?.message ?? 'Code exchange failed');
  }

  return {
    user: this.parseUser(response.data.user),
    session: this.parseSession(response.data.session),
  };
}
```

---

## Parsing Layer Design

### Type Transformation

```typescript
// Raw API shape (snake_case from Cloud)
interface CloudUserData {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  roles: string[];
  created_at: string;
}

// Parsed shape (camelCase for TypeScript)
export interface CloudUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  roles: string[];
  createdAt: Date;
  sessionToken?: string;  // Added for token storage
}

private parseUser(data: CloudUserData): CloudUser {
  return {
    id: data.id,
    email: data.email,
    name: data.name || undefined,
    avatarUrl: data.avatar_url || undefined,
    roles: data.roles ?? ['member'],
    createdAt: new Date(data.created_at),
  };
}
```

### Date Handling

```typescript
private parseSession(data: CloudSessionData): CloudSession {
  return {
    id: data.id,
    userId: data.user_id,
    expiresAt: new Date(data.expires_at),
    createdAt: new Date(data.created_at),
  };
}
```

---

## Token Storage Strategy

### Where Token Lives

| Stage                     | Token Location                            |
| ------------------------- | ----------------------------------------- |
| Initial auth              | Cookie (httpOnly) or Authorization header |
| During request processing | Extracted by `MastraCloudAuth`            |
| Passed to client          | Method parameter                          |
| Stored for later use      | `CloudUser.sessionToken` field            |

### Token Flow Through System

```typescript
// 1. SSO callback creates user + session
async handleCallback(code: string, _state: string): Promise<SSOCallbackResult<CloudUser>> {
  const { user, session } = await this.client.exchangeCode(code);

  // Store session token on user for later API calls
  user.sessionToken = session.id;

  return {
    user,
    tokens: {
      accessToken: session.id,
      expiresAt: session.expiresAt,
    },
  };
}

// 2. Permission check uses stored token
async getPermissions(user: CloudUser): Promise<string[]> {
  if (!user.sessionToken) {
    return [];  // Can't make authenticated API call
  }
  return this.client.getUserPermissions(user.id, user.sessionToken);
}
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Global Token State

**What:** Storing token in client instance or module-level variable
**Why bad:** Race conditions in concurrent requests, wrong user data returned
**Instead:** Pass token as method parameter

### Anti-Pattern 2: Mixed Error Handling

**What:** Some methods throw, some return null, inconsistent
**Why bad:** Callers don't know what to expect
**Instead:** Document pattern per method type:

- Validation methods → return null on failure
- Action methods → throw on failure

### Anti-Pattern 3: Parsing in Transport

**What:** JSON parsing and type transformation in same function
**Why bad:** Hard to test, hard to change response format
**Instead:** Separate layers: transport → unwrap → parse

### Anti-Pattern 4: Swallowing Errors Silently

**What:** `catch { return null }` without logging
**Why bad:** No visibility into failures
**Instead:** Log errors or use structured error returns

---

## File Organization

```
auth/cloud/src/
├── client.ts       # MastraCloudClient class
│   ├── Types:      CloudUser, CloudSession, CloudApiResponse<T>
│   ├── Transport:  request<T>() private method
│   ├── Response:   unwrapResponse<T>() private method
│   ├── Parsing:    parseUser(), parseSession() private methods
│   └── Public:     verifyToken, validateSession, getUser, etc.
│
└── index.ts        # MastraCloudAuth class
    ├── Extends:    MastraAuthProvider<CloudUser>
    ├── Implements: IUserProvider, ISessionProvider, ISSOProvider, IRBACProvider
    ├── Owns:       MastraCloudClient instance
    ├── Extracts:   Token from Request cookies/headers
    └── Delegates:  All API calls to client with token param
```

---

## Type Definitions Summary

### API Response Types (client.ts)

```typescript
// Generic envelope for all Cloud API responses
interface CloudApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    message: string;
    code?: string;
    status: number;
  };
}

// Raw shapes from API (snake_case)
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
interface VerifyData {
  user: CloudUserData;
}
interface ValidateData {
  session: CloudSessionData;
  valid: boolean;
}
interface CallbackData {
  user: CloudUserData;
  session: CloudSessionData;
}
interface UserData {
  user: CloudUserData;
}
interface PermissionsData {
  permissions: string[];
}
```

### Public Types (client.ts, exported)

```typescript
export interface CloudUser {
  id: string;
  email: string;
  name?: string;
  avatarUrl?: string;
  roles: string[];
  createdAt: Date;
  metadata?: Record<string, unknown>;
  sessionToken?: string; // NEW: for authenticated API calls
}

export interface CloudSession {
  id: string;
  userId: string;
  expiresAt: Date;
  createdAt: Date;
}
```

---

## Comparison with WorkOS Pattern

| Aspect          | WorkOS                                       | Cloud (Target)                         |
| --------------- | -------------------------------------------- | -------------------------------------- |
| SDK             | `@workos-inc/node` provides typed client     | Custom `MastraCloudClient`             |
| Session         | AuthKit handles via `authService.withAuth()` | Manual cookie extraction               |
| Token location  | Encrypted in cookie, managed by AuthKit      | Session ID in cookie, passed as header |
| User lookup     | `workos.userManagement.getUser(id)`          | `client.getUser(id, token)`            |
| Response format | WorkOS SDK handles                           | Manual unwrap from `{ ok, data }`      |

**Key difference:** WorkOS SDK abstracts transport; Cloud client must implement it.

---

## Implementation Checklist

### Transport Layer

- [ ] Single `request<T>()` method handles all HTTP
- [ ] `X-Project-ID` header always added
- [ ] `Authorization: Bearer` added when token provided
- [ ] Network errors return `{ ok: false }` not throw

### Response Layer

- [ ] `unwrapResponse<T>()` extracts data from envelope
- [ ] Returns null for `{ ok: false }` responses
- [ ] Documented which methods throw vs return null

### Parsing Layer

- [ ] `parseUser()` transforms snake_case → camelCase
- [ ] `parseSession()` transforms snake_case → camelCase
- [ ] Date strings converted to Date objects

### Token Handling

- [ ] No token stored in client instance
- [ ] Token passed as parameter to authenticated methods
- [ ] `sessionToken` field added to `CloudUser`
- [ ] Token populated during `handleCallback()`

---

## Sources

- **Existing code:** `/auth/cloud/src/client.ts`, `/auth/cloud/src/index.ts`
- **Specification:** `/auth/cloud/IMPLEMENTATION_PLAN.md`
- **Cloud spec:** `/auth/cloud/PLUGIN_SPEC_EXPLORE.md`
- **Comparable implementation:** `/auth/workos/src/auth-provider.ts`

**Confidence:** HIGH - Based on existing codebase patterns and approved implementation plan.
