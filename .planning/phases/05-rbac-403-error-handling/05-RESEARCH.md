# Phase 5: RBAC 403 Error Handling - Research

**Researched:** 2026-01-30
**Domain:** TanStack Query error handling, React Router navigation
**Confidence:** HIGH

## Summary

This phase fixes the playground's retry behavior on 403 RBAC errors. Currently when a user lacks permission to access a resource, the server returns 403, but TanStack Query retries the request (default behavior) and the UI may fall back to "no agents created" empty state instead of showing the Permission Denied page.

The fix requires:
1. Configuring TanStack Query to NOT retry on 403 status codes
2. Routing to Permission Denied page immediately on 403 errors

**Primary recommendation:** Add a global `shouldRetryQuery` function in `packages/playground-ui` that checks for 403 status codes and returns `false`, similar to the existing `shouldRetryWorkspaceQuery` pattern for 501 errors.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @tanstack/react-query | ^5.x | Data fetching and caching | Already used throughout playground-ui |
| react-router | ^6.x | Client-side routing | Already used in playground |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @mastra/client-js | internal | HTTP client with retry logic | API requests from playground |

### Existing Patterns
The codebase already has a pattern for conditional retries in `packages/playground-ui/src/domains/workspace/compatibility.ts`:

```typescript
// Source: packages/playground-ui/src/domains/workspace/compatibility.ts
export const shouldRetryWorkspaceQuery = (failureCount: number, error: unknown): boolean => {
  // Don't retry 501 "Not Implemented" errors
  if (isWorkspaceNotSupportedError(error)) {
    return false;
  }
  return failureCount < 3;
};
```

## Architecture Patterns

### Recommended Approach

**Pattern 1: Create centralized retry logic with 403 handling**

Create a shared utility in `packages/playground-ui/src/lib/`:

```typescript
// Source: TanStack Query docs + existing codebase pattern
const HTTP_STATUS_NO_RETRY = [400, 401, 403, 404];

export function is403Error(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Check for status property
  if ('status' in error && (error as { status: number }).status === 403) {
    return true;
  }

  // Check error message pattern from client-js
  if ('message' in error) {
    const message = (error as { message: string }).message;
    return message.includes('status: 403') || message.includes('HTTP error! status: 403');
  }

  return false;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  // Don't retry 403 Forbidden errors
  if (is403Error(error)) {
    return false;
  }
  // Default: retry up to 3 times
  return failureCount < 3;
}
```

**Pattern 2: Apply to QueryClient globally or per-query**

Option A - Global default in `PlaygroundQueryClient`:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetryQuery,
    },
  },
});
```

Option B - Per-query (more surgical):
```typescript
useQuery({
  queryKey: ['agents'],
  queryFn: fetchAgents,
  retry: shouldRetryQuery,
});
```

**Pattern 3: Handle 403 in error state rendering**

Components should check for 403 errors and render Permission Denied page:

```typescript
const { data, error, isError } = useAgents();

if (isError && is403Error(error)) {
  return <PermissionDeniedPage />;
}
```

### Key Files to Modify

| File | Change |
|------|--------|
| `packages/playground-ui/src/lib/query-utils.ts` | Create `is403Error()` and `shouldRetryQuery()` |
| `packages/playground-ui/src/lib/tanstack-query.tsx` | Apply global retry config to QueryClient |
| Various hooks in `src/domains/*/hooks/` | Apply per-query if needed |
| Page components | Add 403 error handling to render Permission Denied |

### Anti-Patterns to Avoid
- **Retrying 403 errors:** Never retry - it's an authorization error that won't resolve with retries
- **Falling back to empty state on 403:** Should show Permission Denied, not "no data"
- **Modifying client-js retry logic:** The client-js retries are for network errors; 403 should propagate

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Status code extraction | Manual parsing | Pattern from `workspace/compatibility.ts` | Edge cases, consistency |
| Query retry logic | Custom retry loop | TanStack Query `retry` option | Built-in, tested, configurable |
| Error boundaries | Custom try/catch everywhere | React error boundaries + TanStack error state | Standard React pattern |

**Key insight:** TanStack Query's `retry` option accepts a function `(failureCount, error) => boolean` which is the perfect hook for status-code-based retry decisions.

## Common Pitfalls

### Pitfall 1: Error Object Shape Varies
**What goes wrong:** Code checks `error.status` but `@mastra/client-js` throws `Error` with status in message
**Why it happens:** Different HTTP clients format errors differently
**How to avoid:** Check both `error.status` property AND parse error message for "status: 403" pattern
**Warning signs:** 403 errors still being retried despite check

### Pitfall 2: Empty State vs Permission Denied
**What goes wrong:** 403 error causes data to be `undefined`, component renders "no data" empty state
**Why it happens:** Error handling logic doesn't distinguish 403 from network errors
**How to avoid:** Check `isError && is403Error(error)` BEFORE checking `!data`
**Warning signs:** "No agents created" page showing for users who lack permission

### Pitfall 3: Client-JS Double Retry
**What goes wrong:** Request retried by client-js AND TanStack Query
**Why it happens:** `@mastra/client-js` has built-in retry (3 attempts with backoff)
**How to avoid:** Client-js should NOT retry 403; TanStack Query should NOT retry 403
**Warning signs:** 6+ retry attempts visible in network tab

## Code Examples

### Error Detection Utility
```typescript
// Source: Pattern from workspace/compatibility.ts adapted for 403
export function is403ForbiddenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  // Check for status property (from fetch Response or similar)
  if ('status' in error && (error as { status: number }).status === 403) {
    return true;
  }

  // Check for statusCode property (some HTTP clients)
  if ('statusCode' in error && (error as { statusCode: number }).statusCode === 403) {
    return true;
  }

  // Check error message (from @mastra/client-js)
  if ('message' in error) {
    const message = (error as { message: string }).message;
    return message.includes('403') || message.toLowerCase().includes('forbidden');
  }

  return false;
}
```

### Combined Retry Logic
```typescript
// Source: Combining workspace pattern with TanStack Query docs
export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  // Don't retry client errors (4xx)
  if (is403ForbiddenError(error)) return false;
  if (isWorkspaceNotSupportedError(error)) return false;  // 501

  // Default: retry up to 3 times for transient errors
  return failureCount < 3;
}
```

### Error Handling in Components
```typescript
// Source: Pattern from existing E2E tests + PRD requirements
function AgentsList() {
  const { data, error, isError, isLoading } = useAgents();

  // Check 403 FIRST before checking empty data
  if (isError && is403ForbiddenError(error)) {
    return <PermissionDeniedPage resource="agents" action="read" />;
  }

  if (isLoading) return <Loading />;

  if (!data || Object.keys(data).length === 0) {
    return <EmptyState message="No agents created yet" />;
  }

  return <AgentsTable agents={data} />;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Default retry all errors | Conditional retry based on status | TanStack Query v4+ | Skip unrecoverable errors |
| Per-query error handling | Global QueryClient defaults | Standard practice | Consistent behavior |

**Current in codebase:**
- 501 errors already have conditional retry via `shouldRetryWorkspaceQuery`
- Some hooks use `retry: false` (agents, memory, auth)
- No centralized 403 handling exists

## Open Questions

1. **Client-JS retry behavior on 403**
   - What we know: client-js has 3 retries with backoff built-in
   - What's unclear: Does it retry 403 errors?
   - Recommendation: Check and fix if needed; 403 should NOT retry at client-js level

2. **Permission Denied page location**
   - What we know: E2E tests reference "Permission Denied" text
   - What's unclear: Is there an existing PermissionDeniedPage component?
   - Recommendation: Create if missing; reuse existing EmptyState pattern

## Sources

### Primary (HIGH confidence)
- [TanStack Query Retry Docs](https://tanstack.com/query/v4/docs/framework/react/guides/query-retries) - Official retry configuration
- `packages/playground-ui/src/domains/workspace/compatibility.ts` - Existing 501 retry pattern
- `client-sdks/client-js/src/resources/base.ts` - Client-js retry implementation

### Secondary (MEDIUM confidence)
- [TanStack Query Discussion #372](https://github.com/TanStack/query/discussions/372) - Community pattern for status-code retry
- `packages/playground/e2e/tests/__utils__/auth.ts` - E2E test patterns for permission handling

### Tertiary (LOW confidence)
- General web search results - Verified against official docs

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing patterns from codebase
- Architecture: HIGH - TanStack Query retry option is well-documented
- Pitfalls: HIGH - Based on actual codebase analysis

**Research date:** 2026-01-30
**Valid until:** 2026-02-28 (stable patterns, unlikely to change)
