---
'@mastra/core': patch
---

Added a warning when a `LocalFilesystem` mount uses `contained: false`, alerting users to path resolution issues in mount-based workspaces. Use `contained: true` (default) or `allowedPaths` to allow specific host paths.
