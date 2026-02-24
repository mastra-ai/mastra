---
'@mastra/core': minor
---

Added local and cloud mount support to `LocalSandbox` so sandboxed commands can access mounted filesystems.

- **Local mounts** use symlinks (no extra tools needed)
- **S3 mounts** use s3fs-fuse (`apt install s3fs` on Linux, `brew install gromgit/fuse/s3fs-mac` + macFUSE on macOS)
- **GCS mounts** use gcsfuse (`apt install gcsfuse` on Linux; macOS not officially supported)

Mount paths resolve under the sandbox's working directory and are automatically allowed by sandbox isolation. All mounts are cleaned up on stop/destroy. Workspace instructions show the resolved mount location so agents use correct paths in sandbox commands.

When a required FUSE tool is not installed, the mount is marked `unavailable` with install guidance — filesystem methods still work, only sandbox process access is affected.

Related issues: COR-725, COR-554, COR-495.

**Usage example:**

**Before** — filesystem methods work, but sandboxed commands cannot access the mount path:
```typescript
const workspace = new Workspace({
  mounts: {
    '/data': new S3Filesystem({ bucket: 'my-bucket', region: 'us-east-1' }),
  },
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
});

await workspace.init();
await workspace.readFile('/data/example.txt'); // works (SDK)
await workspace.executeCommand('ls', ['/data']); // fails (no host path)
```

**After** — sandboxed commands can access the mount path:
```typescript
const workspace = new Workspace({
  mounts: {
    '/data': new S3Filesystem({ bucket: 'my-bucket', region: 'us-east-1' }),
  },
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
});

await workspace.init();
await workspace.readFile('/data/example.txt'); // works (SDK)
await workspace.executeCommand('ls', ['/data']); // works (FUSE mount)
```
