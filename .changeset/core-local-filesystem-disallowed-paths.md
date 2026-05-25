---
'@mastra/core': patch
---

`LocalFilesystem` now accepts `disallowedPaths` for subtrees inside `basePath` and an optional `disallowedPathHint` to customize the `PermissionError` message. Allowed paths still override disallowed paths, so explicit per-call grants can bypass static trust boundaries.

```ts
const filesystem = new LocalFilesystem({
  basePath: projectRoot,
  disallowedPaths: [nodePath.join(projectRoot, 'vendor/other-worktree')],
  disallowedPathHint: 'access (path is inside a separate sandbox; request access before touching it)',
});
```
