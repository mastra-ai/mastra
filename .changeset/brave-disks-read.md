---
'@mastra/core': minor
---

Sandboxes can now expose their own disk through an optional `filesystem` property on `WorkspaceSandbox`. A provider with a file API answers reads, writes, and listings in one request each instead of a shell command per step. Paths are absolute inside the sandbox, and the provider decides containment. Fall back to `executeCommand()` when the property is absent:

```ts
const pkg = sandbox.filesystem
  ? await sandbox.filesystem.readFile('/workspace/app/package.json', { encoding: 'utf-8' })
  : (await sandbox.executeCommand?.('cat', ['/workspace/app/package.json']))?.stdout;
```
