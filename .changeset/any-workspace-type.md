---
'@mastra/core': patch
---

Export `AnyWorkspace` type from `@mastra/core/workspace` for accepting any Workspace regardless of generic parameters. Updates Agent and Mastra to use `AnyWorkspace` so workspaces with typed mounts/sandbox (e.g. E2BSandbox, GCSFilesystem) are accepted without type errors.
