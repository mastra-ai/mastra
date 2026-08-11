---
'@mastra/core': minor
---

Set `tools.writeLockTimeoutMs` when a remote or cold-starting filesystem needs more than 30 seconds to accept a write. The write tool waits for the configured timeout before returning a `write-lock timeout` error.

```typescript
const workspace = new Workspace({
  filesystem: mySandboxFilesystem,
  tools: {
    // allow a cold-starting sandbox time to accept its first write
    writeLockTimeoutMs: 210_000,
  },
});
```

The default is unchanged at 30 000 ms.
