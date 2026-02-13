---
'@mastra/core': minor
---

Added typed workspace providers — `workspace.filesystem` and `workspace.sandbox` now return the concrete types you passed to the constructor, improving autocomplete and eliminating casts.

When mounts are configured, `workspace.filesystem` returns a typed `CompositeFilesystem<TMounts>` with per-key narrowing via `mounts.get()`.

**Before:**

```ts
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: '/tmp' }),
  sandbox: new E2BSandbox({ timeout: 60000 }),
});
workspace.filesystem; // WorkspaceFilesystem | undefined
workspace.sandbox; // WorkspaceSandbox | undefined
```

**After:**

```ts
const workspace = new Workspace({
  filesystem: new LocalFilesystem({ basePath: '/tmp' }),
  sandbox: new E2BSandbox({ timeout: 60000 }),
});
workspace.filesystem; // LocalFilesystem
workspace.sandbox; // E2BSandbox

// Mount-aware workspaces get typed per-key access:
const ws = new Workspace({
  mounts: { '/local': new LocalFilesystem({ basePath: '/tmp' }) },
});
ws.filesystem.mounts.get('/local'); // LocalFilesystem
```
