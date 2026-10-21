---
'@mastra/e2b': minor
---

`E2BSandbox.filesystem` reads and writes the sandbox's disk through E2B's files API. Each operation starts the sandbox if needed and retries once when E2B paused or killed it server-side.

```ts
const sandbox = new E2BSandbox();
await sandbox.filesystem.writeFile('/home/user/notes.md', '# Notes');
const entries = await sandbox.filesystem.readdir('/home/user');
```

Copies, appends, and writes or moves with `overwrite: false` run as one command inside the VM, so they're atomic and file contents don't travel through your server.
