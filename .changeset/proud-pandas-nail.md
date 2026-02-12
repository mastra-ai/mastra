---
'@mastra/core': minor
---

Added generic type parameters to Workspace, WorkspaceConfig, and CompositeFilesystem so that `workspace.filesystem` and `workspace.sandbox` return the concrete provider types passed to the constructor. When mounts are configured, `workspace.filesystem` returns `CompositeFilesystem<TMounts>` with typed per-key access via `mounts.get()`. Includes `ReadonlyMountMap` and `MountMapEntry` types for type-safe iteration with discriminated-union narrowing.
