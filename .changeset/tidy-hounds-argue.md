---
'@mastra/core': minor
---

Made the workspace write-lock timeout configurable via `tools.writeLockTimeoutMs`.

`InMemoryFileWriteLock` already accepted a `timeoutMs` option, but `createWorkspaceTools` constructed it with no arguments, so the 30-second default was unreachable from user code. That default suits a local filesystem, where a write is a sub-second operation. It does not suit a remote or cold-starting sandbox filesystem, where the first write can legitimately take minutes — the lock rejected those writes with `write-lock timeout` before they ever landed, and there was no supported way to widen it.

```typescript
const workspace = new Workspace({
  filesystem: mySandboxFilesystem,
  tools: {
    // allow a cold-starting sandbox time to accept its first write
    writeLockTimeoutMs: 210_000,
  },
});
```

The default is unchanged at 30 000 ms, so existing workspaces behave exactly as before.
