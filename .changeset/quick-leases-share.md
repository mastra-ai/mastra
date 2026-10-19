---
'@mastra/platform-workspace': minor
---

`PlatformSandbox.filesystem` reads and writes the sandbox's disk through E2B's files API, sent straight to the VM with the same lease `executeCommand()` already uses. A file read or stat takes one round trip instead of several commands. Requires an E2B-backed sandbox.

```ts
const sandbox = new PlatformSandbox();
const source = await sandbox.filesystem.readFile('/workspace/app/src/index.ts', { encoding: 'utf-8' });
```

`appendFile`, `copyFile`, and writes with `overwrite: false` are not atomic; use `executeCommand()` when you need that.
