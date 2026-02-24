---
'@mastra/core': minor
---

**Added** local and cloud mounts in `LocalSandbox` so sandboxed commands can access mounted paths.
**Improved** mount path resolution under the sandbox working directory and cleanup on stop/destroy.
**Improved** workspace instructions to show the resolved mount location.

**Why:** Local sandboxes can now run commands against mounted data without manual path workarounds, aligning local behavior with cloud sandbox environments.

**Platform notes**
- S3/GCS mounts require host FUSE tools; if missing, mounts are marked unavailable with install guidance and only filesystem methods work.

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
