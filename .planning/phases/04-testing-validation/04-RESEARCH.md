# Phase 4: Testing + Validation - Research

**Researched:** 2026-01-28
**Domain:** Vitest testing for TypeScript auth package with fetch mocking
**Confidence:** HIGH

## Summary

This phase validates the auth/cloud implementation with unit tests. The monorepo uses vitest 4.0.16 (from catalog) with a consistent pattern: `vi.stubGlobal('fetch', ...)` for HTTP mocking, `vi.mock('module')` for dependency mocking. Existing auth packages (auth0, supabase, etc.) provide clear patterns to follow.

Key insight: The auth/cloud package has two layers to test:

1. **Transport layer** (`client.ts`): `MastraCloudClient` methods, `CloudApiError`, `request<T>()` helper
2. **Provider layer** (`index.ts`): `MastraCloudAuth` implementing all EE interfaces with JWT decode logic

**Primary recommendation:** Use `vi.stubGlobal('fetch', ...)` for transport tests; mock `jose.decodeJwt` for provider tests to avoid generating real JWTs.

## Standard Stack

### Core

| Library             | Version          | Purpose     | Why Standard                          |
| ------------------- | ---------------- | ----------- | ------------------------------------- |
| vitest              | 4.0.16 (catalog) | Test runner | Monorepo standard, already in devDeps |
| @vitest/coverage-v8 | 4.0.12 (catalog) | Coverage    | Already in devDeps, not required      |

### Supporting

| Library | Version | Purpose    | When to Use                          |
| ------- | ------- | ---------- | ------------------------------------ |
| jose    | ^5.9.6  | JWT decode | Already in deps, mock for unit tests |

### Alternatives Considered

| Instead of          | Could Use        | Tradeoff                                                    |
| ------------------- | ---------------- | ----------------------------------------------------------- |
| vi.stubGlobal fetch | MSW              | MSW overkill for this scope; decision locked in CONTEXT.md  |
| Real JWTs           | Mocked decodeJwt | Real JWTs need signing keys; mocking simpler for unit tests |

**Installation:**

```bash
# Already installed via devDependencies
# No additional packages needed
```

## Architecture Patterns

### Recommended Test File Structure

```
auth/cloud/
├── src/
│   ├── client.ts
│   ├── client.test.ts        # Transport layer tests
│   ├── index.ts
│   └── index.test.ts         # Provider layer tests
└── vitest.config.ts
```

### Pattern 1: Fetch Mocking with vi.stubGlobal

**What:** Mock global fetch for HTTP request testing
**When to use:** All transport layer tests
**Example:**

```typescript
// Source: packages/rag/src/rerank/relevance/cohere/index.test.ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MastraCloudClient', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  it('makes request with correct headers', async () => {
    const mockResponse = {
      ok: true,
      json: () => Promise.resolve({ ok: true, data: { user: {} } }),
    };
    (global.fetch as any).mockResolvedValue(mockResponse);

    // ... test code
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/'),
      expect.objectContaining({
        headers: expect.objectContaining({
          'X-Project-ID': 'test-project',
        }),
      }),
    );
  });
});
```

### Pattern 2: Module Mocking with vi.mock

**What:** Mock entire modules (like jose) for isolated unit tests
**When to use:** Provider tests that need controlled JWT decode behavior
**Example:**

```typescript
// Source: auth/auth0/src/index.test.ts
import { decodeJwt } from 'jose';
import { vi, describe, beforeEach, afterEach } from 'vitest';

vi.mock('jose', () => ({
  decodeJwt: vi.fn(),
}));

describe('MastraCloudAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts user from JWT claims', async () => {
    (decodeJwt as any).mockReturnValue({
      sub: 'user-123',
      email: 'test@example.com',
      role: 'admin',
      iat: Math.floor(Date.now() / 1000),
    });

    // ... test code
  });
});
```

### Pattern 3: Error Testing

**What:** Test error paths with mocked failures
**When to use:** CloudApiError tests, network failures
**Example:**

```typescript
it('throws CloudApiError on API failure', async () => {
  (global.fetch as any).mockResolvedValue({
    ok: false,
    status: 401,
    json: () =>
      Promise.resolve({
        ok: false,
        error: { message: 'Unauthorized', status: 401, code: 'unauthorized' },
      }),
  });

  await expect(client.verifyToken({ token: 'bad' })).rejects.toThrow(CloudApiError);
});
```

### Anti-Patterns to Avoid

- **Shared mock fixtures:** Decision: inline mocks per test for clarity
- **Mocking implementation internals:** Test public API, not private methods
- **Real network calls:** Always mock fetch, never hit real endpoints

## Don't Hand-Roll

| Problem            | Don't Build          | Use Instead                 | Why                                         |
| ------------------ | -------------------- | --------------------------- | ------------------------------------------- |
| JWT generation     | Custom signing logic | Mock decodeJwt return value | jose signing requires keys; mocking simpler |
| Response helpers   | Utility functions    | Inline mock objects         | Per-test mocks are clearer (per CONTEXT.md) |
| Request assertions | Custom matchers      | expect.objectContaining     | Built-in vitest matchers sufficient         |

**Key insight:** Keep tests minimal. Inline mocks per CONTEXT.md decision; no shared fixtures.

## Common Pitfalls

### Pitfall 1: Forgetting to Restore Fetch

**What goes wrong:** Tests leak mocked fetch to other tests
**Why it happens:** vi.stubGlobal persists between tests
**How to avoid:** Always restore in afterEach
**Warning signs:** Random test failures depending on order

```typescript
afterEach(() => {
  vi.restoreAllMocks();
  if (originalFetch) global.fetch = originalFetch;
});
```

### Pitfall 2: Mock Not Hoisted

**What goes wrong:** vi.mock called but import not mocked
**Why it happens:** vi.mock must be at module top level
**How to avoid:** Put vi.mock calls before imports (vitest hoists automatically)
**Warning signs:** Test calls real implementation

### Pitfall 3: instanceof CloudApiError Fails

**What goes wrong:** Caught error not instanceof CloudApiError
**Why it happens:** Error subclass without setPrototypeOf
**How to avoid:** Already fixed in implementation (Object.setPrototypeOf)
**Warning signs:** Error type checks fail in tests

### Pitfall 4: Response.ok vs json.ok Confusion

**What goes wrong:** Test passes but real API fails
**Why it happens:** Cloud API returns 200 with ok:false for some errors
**How to avoid:** Mock both response.ok AND json.ok correctly
**Warning signs:** False positive tests

```typescript
// BAD: Only checks response.ok
{ ok: true, json: () => Promise.resolve({ data: {} }) }

// GOOD: Matches real API envelope
{ ok: true, json: () => Promise.resolve({ ok: true, data: {} }) }
```

## Code Examples

### Transport Layer Test (client.test.ts)

```typescript
// Source: Derived from cohere/index.test.ts + supabase/index.test.ts patterns
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MastraCloudClient, CloudApiError } from './client';

describe('MastraCloudClient', () => {
  let client: MastraCloudClient;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    client = new MastraCloudClient({ projectId: 'test-project' });
    originalFetch = global.fetch;
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.restoreAllMocks();
    global.fetch = originalFetch;
  });

  describe('verifyToken', () => {
    it('returns user on valid token', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: true,
            data: {
              user: {
                id: 'user-123',
                email: 'test@example.com',
                created_at: '2026-01-01T00:00:00Z',
              },
            },
          }),
      });

      const user = await client.verifyToken({ token: 'valid-token' });
      expect(user).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
        }),
      );
    });

    it('returns null on invalid token', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            ok: false,
            error: { message: 'Invalid token', status: 401 },
          }),
      });

      const user = await client.verifyToken({ token: 'invalid' });
      expect(user).toBeNull();
    });
  });
});
```

### Provider Layer Test (index.test.ts)

```typescript
// Source: Derived from auth0/index.test.ts pattern
import { decodeJwt } from 'jose';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MastraCloudAuth, CloudApiError } from './index';

vi.mock('jose', () => ({
  decodeJwt: vi.fn(),
}));

describe('MastraCloudAuth', () => {
  let auth: MastraCloudAuth;

  beforeEach(() => {
    auth = new MastraCloudAuth({ projectId: 'test-project' });
    vi.clearAllMocks();
  });

  describe('getCurrentUser', () => {
    it('decodes JWT from cookie and returns user', async () => {
      (decodeJwt as any).mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
      });

      const request = new Request('http://localhost', {
        headers: { cookie: 'mastra_session=jwt-token-here' },
      });

      const user = await auth.getCurrentUser(request);
      expect(user).toEqual(
        expect.objectContaining({
          id: 'user-123',
          email: 'test@example.com',
          sessionToken: 'jwt-token-here',
        }),
      );
    });

    it('returns null when no cookie', async () => {
      const request = new Request('http://localhost');
      const user = await auth.getCurrentUser(request);
      expect(user).toBeNull();
    });
  });

  describe('createSession', () => {
    it('throws 501 error', async () => {
      await expect(auth.createSession('user-123')).rejects.toThrow(CloudApiError);
      await expect(auth.createSession('user-123')).rejects.toMatchObject({
        status: 501,
        code: 'not_implemented',
      });
    });
  });
});
```

### vitest.config.ts

```typescript
// Source: auth/auth0/vitest.config.ts pattern
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.test.ts'],
  },
});
```

## State of the Art

| Old Approach       | Current Approach | When Changed       | Impact                                   |
| ------------------ | ---------------- | ------------------ | ---------------------------------------- |
| jest               | vitest           | 2023+              | Faster, ESM-native                       |
| global.fetch =     | vi.stubGlobal    | vitest 1.0+        | Cleaner, auto-cleanup option             |
| MSW for unit tests | vi.stubGlobal    | Current preference | MSW for integration, stubGlobal for unit |

**Deprecated/outdated:**

- `jest.fn()` -> `vi.fn()` (jest not used in this monorepo)

## Open Questions

1. **CloudApiError instanceof verification**
   - What we know: Implementation uses setPrototypeOf
   - What's unclear: Need to verify tests actually check instanceof
   - Recommendation: Add explicit instanceof test

2. **Cookie parsing edge cases**
   - What we know: extractSessionToken uses regex
   - What's unclear: Edge cases with malformed cookies
   - Recommendation: Test a few edge cases (empty string, missing cookie, extra semicolons)

## Sources

### Primary (HIGH confidence)

- auth/auth0/vitest.config.ts - Vitest config pattern
- auth/auth0/src/index.test.ts - Jose mocking pattern
- auth/supabase/src/index.test.ts - Client mocking pattern
- packages/rag/src/rerank/relevance/cohere/index.test.ts - fetch stubGlobal pattern
- pnpm-workspace.yaml catalog - vitest 4.0.16

### Secondary (MEDIUM confidence)

- [Vitest Mocking Guide](https://vitest.dev/guide/mocking) - Official docs on vi.mock and vi.stubGlobal
- [Vitest Globals Mocking](https://vitest.dev/guide/mocking/globals) - vi.stubGlobal best practices

### Tertiary (LOW confidence)

- None

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH - Verified from pnpm catalog and existing packages
- Architecture: HIGH - Pattern derived from 5+ existing auth package tests
- Pitfalls: HIGH - Observed from actual codebase patterns and vitest docs

**Research date:** 2026-01-28
**Valid until:** 2026-02-28 (vitest stable, patterns established)
