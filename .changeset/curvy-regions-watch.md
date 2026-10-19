---
'@mastra/core': minor
---

Fixed workspace search and file listing ignoring `.gitignore` files below the workspace root. Content search and the file tree now apply every `.gitignore` relative to its own directory (for example, each repository in a multi-repo workspace) and skip `node_modules` unless the path points inside it. This keeps search from reading dependency files one by one on remote filesystems, and keeps file listings free of ignored and dependency files.

Filesystems that implement `walk` can now honor two new options: `includeGitignoreFiles` returns `.gitignore` files even when hidden entries are excluded, and `skipDirectoryNames` skips directories such as `node_modules` entirely.

```ts
const entries = await filesystem.walk('.', {
  includeGitignoreFiles: true,
  skipDirectoryNames: ['node_modules'],
});
```
