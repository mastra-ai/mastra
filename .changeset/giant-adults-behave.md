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
