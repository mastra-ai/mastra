---
'@mastra/core': patch
---

Added runtime `requestContext` forwarding to tool executions.

Tools invoked within agentic workflow steps now receive the caller's `requestContext` — including authenticated API clients, feature flags, and user metadata set by middleware. Runtime `requestContext` is preferred over build-time context when both are available.

**Why:** Previously, `requestContext` values were silently dropped in two places: (1) the workflow loop stream created a new empty `RequestContext` instead of forwarding the caller's, and (2) `createToolCallStep` didn't pass `requestContext` in tool options. This aligns both the agent generate/stream and agentic workflow paths with the agent network path, where `requestContext` was already forwarded correctly.

**Before:** Tools received an empty `requestContext`, losing all values set by the workflow step.
```ts
// requestContext with auth data set in workflow step
requestContext.set('apiClient', authedClient);
// tool receives empty RequestContext — apiClient is undefined
```

**After:** Pass `requestContext` via `MastraToolInvocationOptions` and tools receive it.
```ts
// requestContext with auth data flows through to the tool
requestContext.set('apiClient', authedClient);
// tool receives the same RequestContext — apiClient is available
```

Fixes #13088
