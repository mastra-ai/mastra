---
'@mastra/core': minor
---

**Split workspace lifecycle interfaces**

The shared `Lifecycle` interface has been split into provider-specific types that match actual usage:

- `FilesystemLifecycle` — two-phase: `init()` → `destroy()`
- `SandboxLifecycle` — three-phase: `start()` → `stop()` → `destroy()`

The base `Lifecycle` type is still exported for backward compatibility.

**Added `onInit` / `onDestroy` callbacks to `MastraFilesystem`**

The `MastraFilesystem` base class now accepts optional lifecycle callbacks via `MastraFilesystemOptions`, matching the existing `onStart` / `onStop` / `onDestroy` callbacks on `MastraSandbox`.

```ts
const fs = new LocalFilesystem({
  basePath: './data',
  onInit: ({ filesystem }) => {
    console.log('Filesystem ready:', filesystem.status);
  },
  onDestroy: ({ filesystem }) => {
    console.log('Cleaning up...');
  },
});
```

`onInit` fires after the filesystem reaches `ready` status (non-fatal on failure). `onDestroy` fires before the filesystem is torn down.
