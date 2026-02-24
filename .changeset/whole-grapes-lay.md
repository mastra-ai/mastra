---
'@mastra/core': minor
---

Added mount support to `LocalSandbox` for local and cloud filesystems:

- **Local mounts** — `LocalFilesystem` mounts use symlinks (no FUSE tools needed)
- **S3 mounts** — FUSE mount via s3fs-fuse (Linux: `apt install s3fs`, macOS: `brew install gromgit/fuse/s3fs-mac` + macFUSE)
- **GCS mounts** — FUSE mount via gcsfuse (Linux: `apt install gcsfuse`, macOS: not officially supported)

Virtual mount paths (e.g. `/s3`) are resolved under the sandbox's working directory. Mount paths are automatically added to the sandbox isolation allowlist (seatbelt/bwrap). All mounts are cleaned up on stop/destroy. Workspace instructions now show resolved mount paths (e.g. `/tmp/sandbox/s3` instead of `/s3`) so the LLM uses correct paths in sandbox commands.

When a required FUSE tool is not installed, the mount is marked as `unavailable` with a warning rather than failing the workspace — SDK filesystem methods still work, only sandbox process access to the mount path is affected. Install instructions with platform-specific guidance are included in the warning.

**Usage example:**

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
