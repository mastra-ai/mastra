---
'@mastra/core': patch
---

Fix `allowedPaths` resolving against `process.cwd()` instead of `basePath`, and fix `assertPathContained` rejecting access to non-existent `allowedPaths` directories.

Previously, relative `allowedPaths` like `../../skills` were resolved against `process.cwd()`, which produced incorrect absolute paths when `basePath` was different from `cwd`. Additionally, `assertPathContained` would skip non-existent `allowedPaths` from its containment check, causing `PermissionError` when accessing paths under directories that hadn't been created yet (e.g., skills discovery).

Now:
- Relative `allowedPaths` resolve against `basePath` (absolute paths are used as-is)
- `assertPathContained` correctly handles non-existent roots by skipping symlink resolution instead of skipping the root entirely
- New `resolveToBasePath` utility unifies path resolution for both `resolvePath` and `allowedPaths`
