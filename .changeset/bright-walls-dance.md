---
'@mastra/core': minor
---

Added mount support to workspaces, so you can combine multiple storage providers (S3, GCS, local disk, etc.) under a single directory tree. This lets agents access files from different sources through one unified filesystem.

**Why:** Previously a workspace could only use one filesystem. With mounts, you can organize files from different providers under different paths — for example, S3 data at `/data` and GCS models at `/models` — without agents needing to know which provider backs each path.

**What's new:**

- Added `CompositeFilesystem` for combining multiple filesystems under one tree
- Added descriptive error types for sandbox and mount failures (e.g., `SandboxTimeoutError`, `MountError`)
- Improved `MastraFilesystem` and `MastraSandbox` base classes with safer concurrent lifecycle handling

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
