---
'@mastra/e2b': minor
---

`E2BSandbox.filesystem` reads and writes the sandbox's disk through E2B's files API, one request per operation. Each operation starts the sandbox if needed and retries once when E2B paused or killed it server-side.

```ts
const sandbox = new E2BSandbox();
await sandbox.filesystem.writeFile('/home/user/notes.md', '# Notes');
const entries = await sandbox.filesystem.readdir('/home/user');
```

`appendFile`, `copyFile`, and writes with `overwrite: false` are not atomic; use `executeCommand()` when you need that.
