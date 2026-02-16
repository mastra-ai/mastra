---
'@mastra/core': patch
---

Added runtime `requestContext` forwarding to tool executions.

Tools invoked within agentic workflow steps now receive the caller's `requestContext` — including authenticated API clients, feature flags, and user metadata set by middleware. Runtime `requestContext` is preferred over build-time context when both are available.

**Why:** Previously, `requestContext` values set during workflow step execution were silently dropped before reaching tools, which meant auth data and configuration never arrived. This aligns the agentic workflow path with the agent network path, where `requestContext` was already forwarded correctly.

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
