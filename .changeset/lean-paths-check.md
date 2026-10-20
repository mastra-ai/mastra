---
'@mastra/code-sdk': minor
---

`SandboxFilesystem` now uses the sandbox's native `filesystem` when it has one. File reads, writes, stats, and listings take one request instead of two or three shell commands, and every file operation goes through it. `grep` and file walks still run as shell commands. Paths with `..` are still rejected.

On the native path, the in-sandbox symlink check is skipped by default, since an agent with a shell can read any file anyway. Set `verifySymlinks: true` when you serve files to people who can't run commands; each path is then checked once per instance:

```ts
const fs = new SandboxFilesystem({ sandbox, workdir: '/workspace/repo', verifySymlinks: true });
```
