---
'@mastra/core': patch
---

Configure the workspace write-lock timeout for remote or cold-starting filesystems, where the first write can legitimately take longer than the 30-second default. Set `tools.writeLockTimeoutMs` to raise it; existing workspaces keep the 30-second default when the option is omitted.

```ts
new Workspace({
  filesystem,
  tools: { writeLockTimeoutMs: 120_000 },
});
```
