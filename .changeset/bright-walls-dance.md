---
'@mastra/core': minor
---

Improved workspace with filesystem mount support, structured sandbox errors, and race-condition-safe lifecycle management.

**Mount system:**

- Added `CompositeFilesystem` for mounting multiple filesystems under a single directory tree
- Added `MountManager` for tracking mount state and processing pending mounts during sandbox startup
- Added mount types (`FilesystemMountConfig`, `MountResult`, `FilesystemIcon`) for provider-specific mount configuration

**Lifecycle improvements:**

- `MastraFilesystem` and `MastraSandbox` base classes now handle concurrent lifecycle calls safely (e.g., multiple `start()` calls return the same promise)
- Agent logger is now propagated to workspace instances via `__registerMastra`

**Structured errors:**

- Added `SandboxError`, `SandboxExecutionError`, `SandboxTimeoutError`, `SandboxNotReadyError`, `MountError`, and `MountNotSupportedError`

```ts
import { Workspace, CompositeFilesystem } from "@mastra/core/workspace";

// Mount multiple filesystems under one tree
const composite = new CompositeFilesystem({
  mounts: {
    "/data": s3Filesystem,
    "/models": gcsFilesystem,
  },
});

const workspace = new Workspace({
  filesystem: composite,
  sandbox: e2bSandbox,
});
```
