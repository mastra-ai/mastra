---
'@mastra/core': minor
---

**Added** FUSE mount support (S3/GCS) to `LocalSandbox` so sandboxed commands can access cloud storage as local directories.

**Why:** Spawned processes in local sandboxes can now read/write S3 buckets and GCS buckets through the local filesystem, aligning local behavior with cloud sandbox environments.

**Platform notes:**
- S3 mounts require `s3fs-fuse`; GCS mounts require `gcsfuse`. macOS also requires macFUSE.
- If FUSE tools are missing, mounts are marked `unavailable` with install guidance — filesystem SDK methods still work.

```typescript
import { Workspace, LocalSandbox } from '@mastra/core/workspace';
import { S3Filesystem } from '@mastra/s3';

const workspace = new Workspace({
  mounts: {
    '/data': new S3Filesystem({ bucket: 'my-bucket', region: 'us-east-1' }),
  },
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
});

await workspace.init();
// Spawned processes can now read/write /data via the FUSE mount
const result = await workspace.executeCommand('ls', ['/data']);
```
