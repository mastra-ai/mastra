---
'@mastra/platform-workspace': minor
---

`PlatformSandbox.filesystem` reads and writes the sandbox's disk through E2B's files API, sent straight to the VM with the same lease `executeCommand()` already uses. A file read or stat takes one round trip instead of several commands. On a sandbox that isn't E2B-backed, `filesystem` is `undefined`.

```ts
const sandbox = new PlatformSandbox();
const source = await sandbox.filesystem?.readFile('/workspace/app/src/index.ts', { encoding: 'utf-8' });
```

Copies, appends, and writes or moves with `overwrite: false` run as one command inside the VM, so they're atomic and file contents don't travel through your server.
