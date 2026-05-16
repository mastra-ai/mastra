---
'@mastra/editor': minor
---

Editor namespace polish:

- `CrudEditorNamespace.clearCache(id)` now always calls `onCacheEvict(id)`, even when the entity wasn't cached. This lets subclasses clean up runtime registries (e.g. removing an agent from `mastra.#agents`) for version-specific lookups that bypass the editor cache.
- `EditorSkillNamespace.publishSkillFromSource()` now stores the new `files` field on the published skill version and strips `undefined` keys from the snapshot before calling `update()` — matches the libsql/pg adapter behavior of rejecting `undefined` as a bind argument.
- `EditorWorkspaceNamespace` adds `snapshotFromWorkspace(workspace)` — the reverse of `hydrateSnapshotToWorkspace()` — to serialize a live `Workspace` instance (including `CompositeFilesystem` mounts, sandbox provider, and tools config) into a `StorageWorkspaceSnapshotType` for persistence.
