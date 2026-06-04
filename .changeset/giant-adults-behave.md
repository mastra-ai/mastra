---
'@mastra/core': minor
---

Workspace `sandbox` now accepts a resolver function for per-request sandboxes.

**Before:** `sandbox: WorkspaceSandbox` (static, same sandbox for every request)
**After:** `sandbox: WorkspaceSandbox | (({ requestContext }) => WorkspaceSandbox)` (static or per-request)

This enables per-request sandbox routing from a single Workspace — useful for multi-tenant deployments where each user/role needs an isolated working directory or different execution permissions.

```ts
const workspace = new Workspace({
  sandbox: ({ requestContext }) => {
    const userId = requestContext.get('user-id') as string;
    return new LocalSandbox({ workingDirectory: `/workspaces/${userId}` });
  },
});
```

When using a resolver, the caller owns the returned sandbox's lifecycle — the Workspace will not call `start()` or `destroy()` on it. `mounts` throws an `INVALID_CONFIG` error with a resolver, and `lsp: true` is disabled with a warning because both require a concrete sandbox instance up front.

**Stable prompts by default**

Building workspace instructions no longer calls a sandbox resolver. Resolver-backed sandboxes contribute stable placeholder text to the agent's system message, so constructing the prompt never provisions a caller-owned sandbox and the prompt stays cache-friendly. Opt into concrete per-request instructions with `instructions.dynamicSandbox`:

```ts
const workspace = new Workspace({
  sandbox: ({ requestContext }) => resolveSandbox(requestContext),
  instructions: { dynamicSandbox: 'resolve' }, // or a ({ requestContext }) => string function
});
```

**Background process continuity**

Set `sandboxCacheKey` to keep `execute_command({ background: true })`, `get_process_output`, and `kill_process` on the same sandbox across follow-up requests — continuity is keyed by a stable id rather than the `RequestContext` instance:

```ts
const workspace = new Workspace({
  sandbox: ({ requestContext }) => resolveSandbox(requestContext),
  sandboxCacheKey: ({ requestContext }) => requestContext.get('thread-id') as string,
});
```

Failed sandbox resolver calls are removed from the cache so later calls can retry. Use `workspace.clearSandboxCache(cacheKey)` to drop a keyed sandbox reference when your own lifecycle code has destroyed or replaced that sandbox.

When background process tools cannot find a PID on a dynamic sandbox without `sandboxCacheKey`, the tool output now points to `sandboxCacheKey` so callers can fix continuity across follow-up requests.
