---
'@mastra/editor': minor
---

`EditorWorkspaceNamespace` can now snapshot a live `Workspace` for persistence — the reverse of `hydrateSnapshotToWorkspace()`:

```ts
const snapshot = await editor.workspace.snapshotFromWorkspace(runtimeWorkspace);
await editor.workspace.create({ id: 'my-workspace', ...snapshot });
```

`snapshotFromWorkspace()` is `async` and awaits `sandbox.getInfo()` and `filesystem.getInfo()` so async providers like `CompositeFilesystem` keep their mount metadata in the stored config.

Also includes two smaller behavioral fixes:

- `EditorSkillNamespace.publishSkillFromSource()` stores the new `files` field on the published skill version and strips `undefined` keys before calling `update()` (libsql/pg adapters reject `undefined` bind arguments).
- `CrudEditorNamespace.clearCache(id)` always calls `onCacheEvict(id)`, even when the entity wasn't cached, so subclasses can clean up runtime registries for version-specific lookups that bypass the editor cache.
