---
'@mastra/core': minor
---

Added an opt-in `apply_patch` workspace tool that creates, updates, moves and deletes several files in one call. A patch is checked in full before anything is written, so it applies completely or not at all. The tool is off by default; enable it per tool:

```ts
new Workspace({
  filesystem: new LocalFilesystem({ basePath: './workspace' }),
  tools: { [WORKSPACE_TOOLS.FILESYSTEM.APPLY_PATCH]: { enabled: true } },
});
```

Setting the top-level `tools.enabled` does not turn it on, so existing agents keep using `write_file` and `edit_file`. Paths follow the same containment, read-before-write and write-lock rules as the other filesystem tools.
