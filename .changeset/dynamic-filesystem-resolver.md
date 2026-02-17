---
'@mastra/core': minor
---

The Workspace `filesystem` option now accepts a resolver function in addition to a static instance.

**Before:** `filesystem: WorkspaceFilesystem` (static, same filesystem for every request)
**After:** `filesystem: WorkspaceFilesystem | (({ requestContext }) => WorkspaceFilesystem)` (static or per-request)

This enables per-request filesystem routing from a single Workspace — useful for multi-tenant setups, role-based access (e.g. admin vs user directories), and scoped filesystem permissions without creating separate Workspace instances. Fixes #13133.
