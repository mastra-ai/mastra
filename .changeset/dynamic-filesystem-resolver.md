---
'@mastra/core': minor
---

Added support for dynamic filesystem resolution via `requestContext` in Workspace. The `filesystem` config now accepts a resolver function `({ requestContext }) => WorkspaceFilesystem`, allowing a single Workspace instance to serve different filesystems per request. Auto-injected workspace tools resolve the filesystem at execution time, with runtime read-only enforcement for dynamically resolved filesystems. Fixes #13133.
