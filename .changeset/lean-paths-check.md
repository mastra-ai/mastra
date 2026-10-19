---
'@mastra/code-sdk': minor
---

`SandboxFilesystem` now uses the sandbox's native `filesystem` when it has one. `readFile`, `writeFile`, `stat`, `exists`, `readdir`, `mkdir`, `deleteFile`, and `rmdir` take one request instead of two or three shell commands. Appends, copies, moves, and no-overwrite writes stay on the shell so they remain atomic. Paths with `..` are still rejected.

On the native path, the in-sandbox symlink check is skipped by default, since an agent with a shell can read any file anyway. Set `verifySymlinks: true` when you serve files to people who can't run commands; each path is then checked once per instance:

```ts
const fs = new SandboxFilesystem({ sandbox, workdir: '/workspace/repo', verifySymlinks: true });
```
