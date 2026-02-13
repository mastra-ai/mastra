# Domain Pitfalls: Auth Client API Alignment

**Domain:** Auth client implementation matching remote API spec
**Researched:** 2026-01-28
**Confidence:** HIGH (based on codebase analysis + established patterns)

---

## Critical Pitfalls

Mistakes that cause broken auth flows or security issues.

### Pitfall 1: Token Location Mismatch

**What goes wrong:** Client sends token in request body, server expects Authorization header (or vice versa).

**Why it happens:**

- Original spec says one thing, implementation assumes another
- Different endpoints have different conventions
- Copy-paste from examples that use body-based auth

**Consequences:**

- 401 on every authenticated request
- Silent failures (server ignores body token, returns "unauthenticated")

**Prevention:**

```typescript
// Explicit contract in types
interface AuthenticatedRequest {
  headers: {
    Authorization: `Bearer ${string}`; // NOT body.token
    'X-Project-ID': string;
  };
}
```

**Detection:**

- Server logs show "missing authentication" despite client sending token
- Requests work in Postman but fail in code (Postman might auto-set headers)

**Where it bites us:**

- Current `client.ts` sends token in body (`body: JSON.stringify({ token })`)
- Target spec requires `Authorization: Bearer <token>` header
- Affects: `verifyToken()`, `validateSession()`, `destroySession()`, `getUser()`, `getUserPermissions()`

---

### Pitfall 2: Response Envelope Unwrapping Omission

**What goes wrong:** Client expects `{ user: {...} }` but server returns `{ ok: true, data: { user: {...} } }`.

**Why it happens:**

- API evolved from direct objects to envelope pattern
- Different endpoints have inconsistent wrapping
- Client written against spec v1, server now at v2

**Consequences:**

- `data.user` is `undefined` (actually at `data.data.user`)
- Runtime errors: "Cannot read property 'id' of undefined"
- Partial data extraction (gets `ok: true` instead of user object)

**Prevention:**

```typescript
// Generic unwrapper with type safety
interface CloudApiResponse<T> {
  ok: boolean;
  data?: T;
  error?: { message: string; status: number };
}

function unwrap<T>(response: CloudApiResponse<T>): T {
  if (!response.ok || !response.data) {
    throw new CloudApiError(response.error?.message ?? 'Unknown error');
  }
  return response.data;
}
```

**Detection:**

- User objects have unexpected shape (e.g., `user.ok` exists)
- TypeScript errors if types are strict
- Unit tests that check actual field values, not just truthy

**Where it bites us:**

- Current `client.ts` expects direct objects: `const data = await response.json() as VerifyTokenResponse`
- Target spec wraps in `{ ok, data }` envelope
- Every API method needs unwrapping

---

### Pitfall 3: API Path Version Drift

**What goes wrong:** Client calls `/api/auth/verify`, server listens on `/api/v1/auth/verify`.

**Why it happens:**

- API versioning added after client written
- Different environments have different prefixes
- Spec document out of sync with deployed API

**Consequences:**

- 404 errors on all requests
- Works in dev (no versioning), fails in prod (versioned)

**Prevention:**

```typescript
// Centralize path construction
class MastraCloudClient {
  private apiVersion = 'v1';

  private apiPath(path: string): string {
    return `${this.baseUrl}/api/${this.apiVersion}${path}`;
  }

  // Usage
  async verifyToken(token: string) {
    const url = this.apiPath('/auth/verify'); // => /api/v1/auth/verify
  }
}
```

**Detection:**

- 404 responses from server
- Check Network tab for actual URLs being called

**Where it bites us:**

- Current: `/api/auth/verify`, `/api/users/:id`
- Target: `/api/v1/auth/verify`, `/api/v1/users/:id`
- Also: Login path is `/auth/login` → should be `/auth/oss`

---

### Pitfall 4: Singleton Client with Per-Request Token

**What goes wrong:** Storing auth token on client instance when multiple users share the client.

**Why it happens:**

- Natural to think "client has auth state"
- Works in single-user scenarios
- Copy-paste from client-side auth patterns (where there's one user)

**Consequences:**

- User A's request uses User B's token
- Race conditions in concurrent requests
- Security breach: data leakage between users

**Prevention:**

```typescript
// WRONG: Token stored on instance
class BadClient {
  private token: string; // Shared across all requests!

  setToken(t: string) {
    this.token = t;
  }
  async getUser() {
    /* uses this.token */
  }
}

// CORRECT: Token passed per-call
class GoodClient {
  async getUser(userId: string, token: string) {
    // Token is request-scoped, not instance-scoped
  }
}
```

**Detection:**

- Auth failures that "fix themselves" on retry
- Wrong data returned for user
- Load testing with multiple users exposes immediately

**Where it bites us:**

- Current `getUser()` and `getUserPermissions()` don't accept token param
- Implementation Plan says: add `token` parameter to both methods
- Must NOT store token on `MastraCloudClient` instance

---

## Moderate Pitfalls

Mistakes that cause bugs or maintenance burden.

### Pitfall 5: Snake_case to camelCase Mapping Inconsistency

**What goes wrong:** API returns `avatar_url`, client expects `avatarUrl`, field is silently `undefined`.

**Why it happens:**

- API follows REST convention (snake_case)
- TypeScript/JS convention is camelCase
- Mapping done in some places, forgotten in others

**Consequences:**

- Missing data in UI
- TypeScript types lie about actual shape
- Bugs appear only for optional fields (required would crash)

**Prevention:**

```typescript
// Explicit mapping layer
interface CloudUserData {
  // API shape (snake_case)
  id: string;
  avatar_url: string | null;
  created_at: string;
}

interface CloudUser {
  // Domain shape (camelCase)
  id: string;
  avatarUrl: string | null;
  createdAt: Date;
}

function parseUser(data: CloudUserData): CloudUser {
  return {
    id: data.id,
    avatarUrl: data.avatar_url, // Explicit mapping
    createdAt: new Date(data.created_at),
  };
}
```

**Detection:**

- TypeScript strict mode with explicit field access
- Integration tests that check all fields

**Where it bites us:**

- Current `parseUser()` does map `avatar_url` → `avatarUrl`
- But uses `Record<string, unknown>` input type — no compile-time safety
- New fields from updated spec could be missed

---

### Pitfall 6: Error Swallowing in Catch Blocks

**What goes wrong:** All errors caught and converted to `null`, losing diagnostic info.

**Why it happens:**

- Defensive programming mindset
- "Don't crash the user" instinct
- Errors seen as exceptional, not informative

**Consequences:**

- "Why is user null?" — no logs, no clues
- Network errors look like auth failures
- Rate limiting looks like invalid token

**Prevention:**

```typescript
// WRONG: Silent swallow
async verifyToken(token: string): Promise<CloudUser | null> {
  try {
    // ...
  } catch {
    return null;  // Was it network? Auth? Server error? Who knows!
  }
}

// CORRECT: Log context, return typed error
async verifyToken(token: string): Promise<CloudUser | CloudAuthError> {
  try {
    const response = await fetch(/*...*/);
    if (!response.ok) {
      return new CloudAuthError(response.status, await response.text());
    }
    // ...
  } catch (error) {
    console.error('[CloudClient] verifyToken failed:', error);
    return new CloudAuthError(0, 'Network error');
  }
}
```

**Detection:**

- Unexplained `null` returns
- Users report "not working" with no server-side evidence

**Where it bites us:**

- Current `client.ts` swallows errors: `catch { return null; }` or `catch { return []; }`
- When Cloud endpoints are built and fail, we'll have no visibility
- Add logging at minimum, consider typed errors for better UX

---

### Pitfall 7: Expired Token Without Refresh Logic

**What goes wrong:** Token expires, all requests fail, user must re-login.

**Why it happens:**

- MVP omits refresh flow
- "2 hour expiry is long enough"
- Token refresh is complex, deferred

**Consequences:**

- Poor UX (sudden session loss)
- Data loss if user was mid-action
- Support tickets for "random logouts"

**Prevention:**

```typescript
// Proactive expiry check
interface TokenInfo {
  token: string;
  expiresAt: Date;
}

function isExpiringSoon(info: TokenInfo, bufferMs = 60000): boolean {
  return info.expiresAt.getTime() - Date.now() < bufferMs;
}

// Or: Intercept 401s and trigger re-auth flow
```

**Detection:**

- Failures cluster around token expiry time
- Works after page refresh (gets new token)

**Where it bites us:**

- Cloud spec says token lifetime is 2 hours
- Current implementation has no expiry check or refresh
- Spec mentions optional `POST /api/v1/oauth/refresh` endpoint
- Consider: at least check `expiresAt` before making requests

---

### Pitfall 8: Missing Method After Interface Change

**What goes wrong:** Interface requires `createSession()`, but spec doesn't support it. Method exists but breaks at runtime.

**Why it happens:**

- Plugin implements interface designed for different provider
- Spec omits endpoint that was assumed to exist
- Interface methods are mandatory, can't just delete

**Consequences:**

- Runtime error when method called
- Compile-time success hides runtime failure
- Confusing error message ("failed to create session" vs "not supported")

**Prevention:**

```typescript
// WRONG: Leave broken implementation
async createSession(): Promise<CloudSession> {
  return this.client.createSession(userId);  // This method doesn't exist!
}

// CORRECT: Explicit not-supported error
async createSession(): Promise<CloudSession> {
  throw new Error(
    'Direct session creation not supported by Mastra Cloud. ' +
    'Sessions are created automatically during SSO callback.'
  );
}
```

**Detection:**

- Clear error message when attempted
- Tests that verify behavior

**Where it bites us:**

- `ISessionProvider` interface requires `createSession()`
- Cloud spec: sessions created only via code exchange
- Implementation Plan: keep method in `index.ts`, throw descriptive error
- Remove `createSession()` from `client.ts` entirely

---

## Minor Pitfalls

Mistakes that cause friction but are recoverable.

### Pitfall 9: State Parameter CSRF Validation Skipped

**What goes wrong:** Callback accepts any `state`, attacker can redirect user to malicious callback.

**Why it happens:**

- State validation seems optional
- "It's just for development"
- Implementation focus on happy path

**Consequences:**

- CSRF vulnerability
- Attacker could steal auth code

**Prevention:**

```typescript
// Store state before redirect
const state = crypto.randomUUID();
session.set('oauth_state', state);

// Validate on callback
const savedState = session.get('oauth_state');
if (state !== savedState) {
  throw new Error('Invalid state parameter');
}
```

**Detection:**

- Security audit
- Missing state validation code

**Where it bites us:**

- Current `handleCallback(code, _state)` — `_state` prefix suggests unused
- State validation should happen in the auth handler, but verify it does

---

### Pitfall 10: Header Case Sensitivity

**What goes wrong:** Server expects `X-Project-ID`, client sends `x-project-id`, header ignored.

**Why it happens:**

- HTTP headers are case-insensitive per spec
- But some servers are strict
- Different libraries have different behaviors

**Consequences:**

- Subtle auth failures
- Works in some environments, not others

**Prevention:**

```typescript
// Be consistent, match server exactly
headers: {
  'X-Project-ID': this.projectId,  // Match server's expected case
  'Content-Type': 'application/json',
}
```

**Detection:**

- Compare headers in docs vs implementation
- Check server logs for received headers

**Where it bites us:**

- Current code uses `'X-Project-ID'` — verify server expects same case
- Low risk but worth documenting

---

## Testing Blind Spots

| Area                         | Why Missed                              | Prevention                                        |
| ---------------------------- | --------------------------------------- | ------------------------------------------------- |
| Response envelope changes    | Mocks return expected shape, not actual | Mock actual API responses from spec               |
| Token in wrong location      | Unit tests don't check HTTP layer       | Integration tests against mock server             |
| Concurrent user tokens       | Tests run single-user                   | Load test with multiple concurrent users          |
| Field mapping for all fields | Tests check happy path fields only      | Property-based testing or exhaustive field checks |
| Error response parsing       | Tests focus on success                  | Test every error code path explicitly             |
| Network timeouts             | Local tests are fast                    | Add timeout and retry tests                       |

---

## Phase-Specific Warnings

| Phase                    | Likely Pitfall                             | Mitigation                                             |
| ------------------------ | ------------------------------------------ | ------------------------------------------------------ |
| API path updates         | Miss one path, silent 404                  | Centralize path construction, grep for hardcoded paths |
| Auth header migration    | Token in body AND header during transition | Feature flag or big-bang switch                        |
| Response unwrapping      | Forget one endpoint                        | Add `unwrap()` helper, use consistently                |
| Token parameter addition | Call sites not updated                     | TypeScript will catch missing args                     |
| createSession removal    | Breaks interface contract                  | Throw explicit error, don't remove from index.ts       |

---

## Checklist Before Implementation

- [ ] All paths use `/api/v1/` prefix
- [ ] Login URL uses `/auth/oss` not `/auth/login`
- [ ] Token sent via `Authorization: Bearer` header, not body
- [ ] All responses unwrapped from `{ ok, data }` envelope
- [ ] `getUser()` and `getUserPermissions()` accept `token` parameter
- [ ] `createSession()` removed from client, throws in provider
- [ ] Error responses logged with context, not silently swallowed
- [ ] Snake_case → camelCase mapping has typed input/output
- [ ] Integration tests mock actual API response shapes from spec

---

## Sources

- `/Users/yj/.superset/worktrees/mastra/auth-exploration/auth/cloud/SPEC_REVIEW.md` — Cloud API spec
- `/Users/yj/.superset/worktrees/mastra/auth-exploration/auth/cloud/IMPLEMENTATION_PLAN.md` — Change requirements
- `/Users/yj/.superset/worktrees/mastra/auth-exploration/auth/cloud/PLUGIN_SPEC_EXPLORE.md` — Auth flow proposal
- `/Users/yj/.superset/worktrees/mastra/auth-exploration/auth/cloud/src/client.ts` — Current implementation
- `/Users/yj/.superset/worktrees/mastra/auth-exploration/auth/workos/src/auth-provider.ts` — Reference implementation
- `/Users/yj/.superset/worktrees/mastra/auth-exploration/auth/better-auth/src/index.ts` — Reference implementation
