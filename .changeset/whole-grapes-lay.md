---
'@mastra/core': minor
---

**Added** local symlink mounts in `LocalSandbox` so sandboxed commands can access locally-mounted filesystem paths.
**Improved** mounted paths so commands resolve consistently in local sandboxes.
**Improved** workspace instructions so developers can quickly find mounted data paths.

**Why:** Local sandboxes can now run commands against locally-mounted data without manual path workarounds.

**Usage example:**

```typescript
const workspace = new Workspace({
  mounts: {
    '/data': new LocalFilesystem({ basePath: '/path/to/data' }),
  },
  sandbox: new LocalSandbox({ workingDirectory: './workspace' }),
});

await workspace.init();
// Sandboxed commands can access the mount path via symlink
await workspace.sandbox.executeCommand('ls data');
```
