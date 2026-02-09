## PR Review: #12804 - feat: enable tracing for tool executions through MCP server

### Summary

This PR replaces the direct `tracingContext?.currentSpan?.createChildSpan(...)` call in `CoreToolBuilder.createExecute()` with the centralized `getOrCreateSpan()` utility. The goal is to enable tracing for tool calls made through MCP servers, where no parent agent span exists.

The concept is sound — `getOrCreateSpan` is already the established pattern used by agents (`agent.ts:3457`, `agent-legacy.ts:226`). It has two paths:
1. If `tracingContext.currentSpan` exists → creates a child span (identical to current behavior)
2. If no current span exists → creates a **root span** via `mastra.observability`

This is exactly what's needed for MCP server tool executions that don't have a parent agent span.

---

### Critical: Missing `mastra` parameter

`getOrCreateSpan()` needs a `mastra` instance to create root spans. From `observability/types/tracing.ts`:

```typescript
export interface GetOrCreateSpanOptions<TType extends SpanType> {
  // ...
  mastra?: Mastra;  // Required for root span creation
}
```

The fallback path in `getOrCreateSpan()` (`observability/utils.ts:31`) does:

```typescript
const instance = options.mastra?.observability?.getSelectedInstance({ requestContext });
return instance?.startSpan<T>({ ... });
```

Without `mastra`, when there's no parent span this returns `undefined` — making the change effectively a no-op for the MCP server use case. The `mastra` instance **is** available in `createExecute` (destructured as `_mastra` at `builder.ts:251`), so it should be forwarded:

```typescript
const toolSpan = getOrCreateSpan({
  // ...existing props...
  tracingContext,
  requestContext,
  tracingPolicy: options.tracingPolicy,
  mastra: options.mastra,  // <-- Needs to be added
});
```

---

### Medium: Test assertion weakened

The test "should not inject tracingContext when agentSpan is not available" is renamed to "should inject tracingContext when agentSpan is not available" and the assertion is changed from a specific equality check to a loose truthiness check:

**Before:**
```typescript
expect(receivedTracingContext).toEqual({ currentSpan: undefined });
```

**After:**
```typescript
expect(receivedTracingSpan).toBeTruthy();
```

Suggestions:
- Verify span properties (type should be `SpanType.TOOL_CALL`, name should match, entityType should be `EntityType.TOOL`)
- Verify span lifecycle (`end()` is called after execution completes)
- The test setup (lines 624–636) doesn't provide a mock `mastra` with observability — so if `mastra` is intended to be passed to `getOrCreateSpan`, the test needs a mock that returns a span from `observability.getSelectedInstance().startSpan()`

---

### Minor: Extra fields spread into `createChildSpan`

When a parent span **does** exist, `getOrCreateSpan` spreads `...rest` into `createChildSpan`. This now includes `mastra` and `requestContext` fields that weren't previously passed to `createChildSpan`. These extra fields are likely ignored but could have unintended side effects depending on the span implementation. Worth verifying.

---

### Missing: Changeset

This PR needs a changeset for `@mastra/core` since it's a behavioral change (new feature). Should be a `minor` bump:
```
feat: enable tracing for tool executions through MCP server when no parent span exists
```

---

### Question: Scope vs. issue #10889

Issue #10889 requests "client-side tool tracing" — visibility when running client-side tools. This PR focuses on MCP server tool executions specifically. Could you clarify whether this fully or partially addresses the original issue?

---

### TL;DR

The approach is correct and well-motivated. Two things to address before merge:

1. **Pass `mastra: options.mastra` to `getOrCreateSpan`** — without it, root span creation doesn't work, which is the entire purpose of this PR
2. **Strengthen the no-parent-span test** — add a mock mastra with observability, and assert on span properties + lifecycle rather than just truthiness
3. **Add a changeset**
